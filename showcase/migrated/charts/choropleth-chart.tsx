// Migrated bklit-ui ChoroplethChart — same public API, rendered by TanStack
// Charts geoShape mark + @visx/zoom for zoom/pan.
//
// Principles (bklit native, tanstack gap):
//   - bklit uses @visx/zoom <Zoom> with svg ref=zoom.containerRef as gesture
//     target and single <g transform={zoom.toString()}> for content.
//   - TanStack has no geo zoom primitive (interaction-zoom is 1D zoomX for
//     time series only). Gap stays consumer-owned, ported verbatim from bklit.
//   - No wrapper CSS transform, no viewBox fight. Host width/viewBox stable,
//     <g> scales content. Graticule shares same <g> via graticuleGRef.
//     Tooltip via zoom.applyToPoint.

import React, {
  Children,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { FeatureCollection, type Feature, type Geometry } from "geojson";
import { geoCentroid, geoMercator, geoPath, type GeoProjection } from "d3-geo";
import type { TransformMatrix, ProvidedZoom, ZoomState } from "@visx/zoom";
import { identityMatrix } from "@visx/zoom";
import { Zoom } from "@visx/zoom";
import { Chart } from "@tanstack/react-charts";
import { defineChart, type ChartValue, type StaticChartDefinition } from "@tanstack/charts";
import { geoShape } from "@tanstack/charts/geo";
import { CHART_ROLE } from "./children";
import {
  createChoroplethHoverChrome,
  type ChoroplethHoverChrome,
} from "./internal/choropleth-hover-chrome";
import { intFmt } from "./internal/formatters";
import { ChoroplethGraticuleOverlay } from "./internal/choropleth-graticule";
import { findRevealRoot, isRevealed, markRevealed, onPostPaint, setRevealDeadline } from "./internal/deferred-reveal";
import { parseAspectRatio } from "./internal/parse-aspect-ratio";
import { useContainerWidth } from "./internal";
import { clipRevealTiming, type EnterTransition } from "./internal/enter-transition";
import "./styles.css";

// ---------------------------------------------------------------------------
// Types (matching bklit's public API exactly)
// ---------------------------------------------------------------------------

export interface ChoroplethFeatureProperties {
  name?: string;
  id?: string | number;
  [key: string]: unknown;
}

export type ChoroplethFeature = Feature<Geometry, ChoroplethFeatureProperties>;

export interface Margin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface ChoroplethChartProps {
  data: FeatureCollection<Geometry, ChoroplethFeatureProperties>;
  margin?: Partial<Margin>;
  animationDuration?: number;
  /** P5.5 CP1 — bklit `choropleth-chart.tsx:41`. Was typed `unknown` and read
      by nothing; now drives the feature-group enter fade's duration/easing
      (spring coerced to tween, bklit `animation.ts:18`). */
  enterTransition?: EnterTransition;
  /** P5.5 CP2 — bklit `choropleth-chart.tsx:43`. Replay epoch input; bklit
      bumps its epoch from `[animationDuration, revealSignature]`
      (`choropleth-chart.tsx:389-397`). Was forwarded to the body and never
      read inside it. */
  revealSignature?: string;
  aspectRatio?: string;
  scale?: number;
  center?: [number, number];
  translate?: [number, number];
  zoomEnabled?: boolean;
  zoomMin?: number;
  zoomMax?: number;
  initialZoom?: TransformMatrix;
  className?: string;
  children: ReactNode;
}

export interface ChoroplethFeatureProps {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  fadedOpacity?: number;
  getFeatureColor?: (feature: ChoroplethFeature, index: number) => string;
  patterns?: ReactNode;
  getFeaturePattern?: (feature: ChoroplethFeature, index: number) => string | null | undefined;
}

export interface ChoroplethTooltipProps {
  content?: (props: { feature: ChoroplethFeature; index: number }) => ReactNode;
  formatValue?: (value: number) => string;
  getFeatureName?: (feature: ChoroplethFeature, index: number) => string;
  getFeatureValue?: (feature: ChoroplethFeature, index: number) => number | undefined;
  valueLabel?: string;
  className?: string;
  panelStyle?: React.CSSProperties;
  backgroundColor?: string;
}

export interface ChoroplethGraticuleProps {
  stroke?: string;
  strokeWidth?: number;
  step?: [number, number];
}

// ---------------------------------------------------------------------------
// Contexts
// ---------------------------------------------------------------------------

// P5.6 CP10 — legacy's `ZoomInstance<E> = ProvidedZoom<E> & ZoomState`
// (`repos/bklit-ui/.../choropleth-context.tsx:17-28`, which hand-declares
// `ZoomState` because it predates visx exporting one). visx DOES export it now
// (`@visx/zoom/lib/types.d.ts`), and — decisive here — its `<Zoom>` render prop
// already HANDS the child object with `initialTransformMatrix`,
// `transformMatrix` and `isDragging` on it. So this was never missing state:
// the `as unknown as ProvidedZoom<SVGSVGElement>` casts below were narrowing
// three live runtime fields out of the type. Pure type widening, no plumbing.
export type ChoroplethZoomInstance<E extends Element> = ProvidedZoom<E> & ZoomState;

export interface ChoroplethZoomContextValue {
  zoom: ChoroplethZoomInstance<SVGSVGElement> | null;
}

export const ChoroplethZoomContext = createContext<ChoroplethZoomContextValue>({ zoom: null });

export function useChoroplethZoom(): ChoroplethZoomContextValue {
  return useContext(ChoroplethZoomContext);
}

// P5.6 CP9 — this was `{ width, height }`. Legacy's
// `ChoroplethStableContextValue` (`choropleth-context.tsx:68-100`) is far
// wider, and the fields below are the ones legacy's OWN consumers read:
// `containerRef, width, height, features` (choropleth-tooltip.tsx:51),
// `rawPathGenerator` (choropleth-graticule.tsx:21), `enterTransition,
// animationDuration` (choropleth-feature.tsx:161) and `features,
// pathGenerator, projectPoint, isLoaded, revealEpoch, width, height`
// (choropleth-feature.tsx:222-229). All of them are things migrated already
// computes internally; exposing them costs nothing new.
//
// TWO legacy fields are deliberately NOT restored:
//   - `featurePaths` — legacy precomputes one path string per feature because
//     its own `<ChoroplethFeature>` renders them; migrated's features are
//     TanStack `geoShape` marks, so materialising that array would be pure
//     per-render cost for an array nothing reads. `pathGenerator` is exposed,
//     so a caller that wants them can build them.
//   - `animationDuration`'s sibling `margin` IS restored, but legacy's
//     `innerWidth`/`innerHeight` are recomputed here rather than threaded.
export interface ChoroplethContextValue {
  features: ChoroplethFeature[];
  featureCollection: FeatureCollection<Geometry, ChoroplethFeatureProperties>;
  /** Projected SVG path for one feature, or `undefined` before the projection
      exists (width/height still 0). */
  pathGenerator: (feature: ChoroplethFeature) => string | undefined;
  /** Same projection, any GeoJSON object — legacy's graticule path source. */
  // biome-ignore lint/suspicious/noExplicitAny: GeoJSON types are complex
  rawPathGenerator: (geo: any) => string | null;
  projectPoint: (coords: [number, number]) => [number, number] | null;
  width: number;
  height: number;
  innerWidth: number;
  innerHeight: number;
  margin: Margin;
  containerRef: RefObject<HTMLDivElement | null>;
  isLoaded: boolean;
  animationDuration: number;
  enterTransition?: EnterTransition;
  revealEpoch: number;
}

const EMPTY_FEATURE_COLLECTION: FeatureCollection<Geometry, ChoroplethFeatureProperties> = {
  type: "FeatureCollection",
  features: [],
};

const CHOROPLETH_CONTEXT_DEFAULT: ChoroplethContextValue = {
  features: [],
  featureCollection: EMPTY_FEATURE_COLLECTION,
  pathGenerator: () => undefined,
  rawPathGenerator: () => null,
  projectPoint: () => null,
  width: 0,
  height: 0,
  innerWidth: 0,
  innerHeight: 0,
  margin: { top: 0, right: 0, bottom: 0, left: 0 },
  containerRef: { current: null },
  isLoaded: false,
  animationDuration: 0,
  revealEpoch: 0,
};

const ChoroplethContext = createContext<ChoroplethContextValue>(CHOROPLETH_CONTEXT_DEFAULT);

export function useChoropleth(): ChoroplethContextValue {
  return useContext(ChoroplethContext);
}

// bklit choropleth-context.tsx: defaultChoroplethColors = [...CHART_SCALE_VARS]
const DEFAULT_CHOROPLETH_COLORS = [
  "var(--chart-scale-01)",
  "var(--chart-scale-02)",
  "var(--chart-scale-03)",
  "var(--chart-scale-04)",
  "var(--chart-scale-05)",
];

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export { type TransformMatrix } from "@visx/zoom";

const DEFAULT_MARGIN: Margin = { top: 0, right: 0, bottom: 0, left: 0 };

const DEFAULT_INITIAL_ZOOM: TransformMatrix = identityMatrix();

const ANIMATION_DURATION_MS = 800;
const FEATURE_ENTER_MS = 1100;
const REVEAL_EASING = "cubic-bezier(0.85, 0, 0.15, 1)";

// ---------------------------------------------------------------------------
// Config-carrier children
// ---------------------------------------------------------------------------

type RoleCarrier = { [CHART_ROLE]?: string };

function _ChoroplethFeatureComponent(_props: ChoroplethFeatureProps): null { return null; }
(_ChoroplethFeatureComponent as unknown as RoleCarrier)[CHART_ROLE] = "choroplethFeature";

function _ChoroplethTooltip(_props: ChoroplethTooltipProps): null { return null; }
(_ChoroplethTooltip as unknown as RoleCarrier)[CHART_ROLE] = "choroplethTooltip";

function _ChoroplethGraticule(_props: ChoroplethGraticuleProps): null { return null; }
(_ChoroplethGraticule as unknown as RoleCarrier)[CHART_ROLE] = "choroplethGraticule";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveFeatureFill(
  feature: ChoroplethFeature,
  index: number,
  baseFill: string | undefined,
  getFeatureColor: ChoroplethFeatureProps["getFeatureColor"],
  getFeaturePattern: ChoroplethFeatureProps["getFeaturePattern"],
): string {
  const patternId = getFeaturePattern?.(feature, index);
  if (patternId) return `url(#${patternId})`;
  if (baseFill) return baseFill;
  if (getFeatureColor) return getFeatureColor(feature, index);
  return DEFAULT_CHOROPLETH_COLORS[index % DEFAULT_CHOROPLETH_COLORS.length] ?? "var(--chart-1)";
}


interface ExtractedConfig {
  featureConfig: ChoroplethFeatureProps | null;
  tooltipConfig: ChoroplethTooltipProps | null;
  graticuleConfig: ChoroplethGraticuleProps | null;
  overlayChildren: ReactNode[];
}

function extractChoroplethChildren(children: ReactNode): ExtractedConfig {
  let featureConfig: ChoroplethFeatureProps | null = null;
  let tooltipConfig: ChoroplethTooltipProps | null = null;
  let graticuleConfig: ChoroplethGraticuleProps | null = null;
  const overlayChildren: ReactNode[] = [];

  const visit = (node: ReactNode): void => {
    for (const child of Children.toArray(node)) {
      if (!isValidElement(child)) {
        overlayChildren.push(child);
        continue;
      }
      const role = (child.type as unknown as RoleCarrier)?.[CHART_ROLE];
      if (role === "choroplethFeature") featureConfig = child.props as ChoroplethFeatureProps;
      else if (role === "choroplethTooltip") tooltipConfig = child.props as ChoroplethTooltipProps;
      else if (role === "choroplethGraticule") graticuleConfig = child.props as ChoroplethGraticuleProps;
      else overlayChildren.push(child);
    }
  };
  visit(children);
  return { featureConfig, tooltipConfig, graticuleConfig, overlayChildren };
}

// ===========================================================================
// Inner body — owns projection, definition, hover, tooltip, zoom wiring
// ===========================================================================

function ChoroplethChartBody({
  data,
  margin: marginProp,
  animationDuration = ANIMATION_DURATION_MS,
  enterTransition,
  revealSignature = "",
  aspectRatio = "16 / 9",
  scale: scaleProp,
  center = [0, 20],
  translate: translateProp,
  zoomEnabled = false,
  zoomMin = 0.5,
  zoomMax = 4,
  initialZoom = DEFAULT_INITIAL_ZOOM,
  children,
  width,
  height,
}: ChoroplethChartProps & { width: number; height: number }) {
  const margin = useMemo(() => ({ ...DEFAULT_MARGIN, ...marginProp }), [marginProp]);
  const ratio = useMemo(() => parseAspectRatio(aspectRatio), [aspectRatio]);

  const { featureConfig, tooltipConfig, graticuleConfig, overlayChildren } =
    useMemo(() => extractChoroplethChildren(children), [children]);

  const dimOpacity = featureConfig?.fadedOpacity ?? 0.4;
  const baseOpacity = 0.85;

  const projection = useMemo<GeoProjection | null>(() => {
    if (width <= 0 || height <= 0) return null;
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;
    const computedScale = scaleProp ?? (innerW > 0 ? (innerW / 630) * 100 : 100);
    const computedTranslate: [number, number] = translateProp ?? [
      innerW / 2 + margin.left,
      innerH / 2 + margin.top + 50,
    ];
    return geoMercator().center(center).translate(computedTranslate).scale(computedScale);
  }, [width, height, margin, scaleProp, center, translateProp]);

  // P5.6 CP9 — legacy's `isLoaded`/`revealEpoch` state machine, verbatim
  // (`repos/bklit-ui/.../choropleth-chart.tsx:371-397`): epoch bumps and
  // `isLoaded` re-arms on `[animationDuration, revealSignature]`. Nothing in
  // migrated reads either (the reveal is imperative WAAPI) — they exist so
  // `useChoropleth()` reports the same lifecycle legacy's consumers gate on.
  const [isLoaded, setIsLoaded] = useState(false);
  const [revealEpoch, setRevealEpoch] = useState(0);
  useEffect(() => {
    setRevealEpoch((n) => n + 1);
    setIsLoaded(false);
    const timeout = setTimeout(() => setIsLoaded(true), animationDuration);
    return () => clearTimeout(timeout);
  }, [animationDuration, revealSignature]);

  // CP9 — the three geo accessors, all off the projection this component
  // already builds. `geoPath` is d3's own; legacy reaches the same generator
  // through visx's `<Mercator>` render prop.
  const geoPathGenerator = useMemo(
    () => (projection ? geoPath(projection) : null),
    [projection],
  );
  const pathGenerator = useCallback(
    (feature: ChoroplethFeature) => geoPathGenerator?.(feature) ?? undefined,
    [geoPathGenerator],
  );
  const rawPathGenerator = useCallback(
    // biome-ignore lint/suspicious/noExplicitAny: GeoJSON types are complex
    (geo: any) => geoPathGenerator?.(geo) ?? null,
    [geoPathGenerator],
  );
  const projectPoint = useCallback(
    (coords: [number, number]): [number, number] | null => {
      const p = projection?.(coords);
      return p && Number.isFinite(p[0]) && Number.isFinite(p[1]) ? [p[0], p[1]] : null;
    },
    [projection],
  );

  const getCentroidForFeature = useCallback(
    (feature: ChoroplethFeature) => {
      if (!projection) return null;
      try {
        const c = geoCentroid(feature);
        if (!c || !Number.isFinite(c[0]) || !Number.isFinite(c[1])) return null;
        const p = projection([c[0], c[1]]);
        if (!p || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) return null;
        const pad = 60;
        return {
          x: Math.max(pad, Math.min(width - pad, p[0])),
          y: Math.max(pad, Math.min(height - pad, p[1])),
        };
      } catch {
        return null;
      }
    },
    [projection, width, height],
  );

  const definition = useMemo(() => {
    if (width <= 0 || height <= 0 || !projection)
      return null as unknown as StaticChartDefinition<ChoroplethFeature, ChartValue, ChartValue, "dom">;
    const projForMark = projection;
    const d = defineChart({
      marks: [
        geoShape(data.features, {
          key: (f: ChoroplethFeature) => f.properties?.name ?? String(f.id ?? ""),
          projection: () => projForMark,
          fill: (f: ChoroplethFeature, { index }) =>
            resolveFeatureFill(
              f, index,
              featureConfig?.fill,
              featureConfig?.getFeatureColor,
              featureConfig?.getFeaturePattern,
            ),
          stroke: featureConfig?.stroke ?? "var(--background)",
          strokeOpacity: 1,
          strokeWidth: featureConfig?.strokeWidth ?? 0.5,
        }),
      ],
      x: null,
      y: null,
      guides: false,
      margin: 0,
      // P3.3/T-D2 CSS-suppression-cleanup: choropleth owns its own hover
      // feedback (internal/choropleth-hover-chrome.ts), same as every other
      // custom-mark chart in this migration — suppress TanStack's native
      // focus ring natively instead of relying solely on the
      // `[data-ts-chart-focus] {display:none}` CSS rule.
      focusRing: false,
    });
    return d as StaticChartDefinition<ChoroplethFeature, ChartValue, ChartValue, "dom">;
  }, [
    width, height, projection, data.features,
    featureConfig?.getFeatureColor, featureConfig?.getFeaturePattern,
    featureConfig?.fill, featureConfig?.stroke, featureConfig?.strokeWidth,
  ]);

  // --- Hover chrome (owns dim + shared TooltipBox; CP7 flip + instant unmount) ---
  const domFeatureByTsKeyRef = useRef<Map<string, { feature: ChoroplethFeature; index: number }> | null>(null);

  const hoverChromeRef = useRef<ChoroplethHoverChrome | null>(null);
  const getFeatureAt = useCallback(
    (key: string) => domFeatureByTsKeyRef.current?.get(key) ?? null,
    [],
  );
  const getCentroidForHover = useCallback(
    (key: string) => {
      const entry = domFeatureByTsKeyRef.current?.get(key);
      if (!entry) return { x: width / 2, y: height / 2 };
      return getCentroidForFeature(entry.feature) ?? { x: width / 2, y: height / 2 };
    },
    [getCentroidForFeature, width, height],
  );
  const getDimOpacity = useCallback(() => dimOpacity, [dimOpacity]);
  const getBaseOpacity = useCallback(() => baseOpacity, [baseOpacity]);

  // Tooltip config resolution — bklit defaults (OQ parity 8): formatValue =
  // intFmt (CP4), name fallback `Feature ${index}` + real index arg (CP5/CP6)
  // are applied inside the chrome against this config.
  const formatValue = tooltipConfig?.formatValue ?? intFmt;
  const hasTooltipChild = tooltipConfig !== null;
  const tooltipContent = tooltipConfig?.content;
  const getFeatureName = tooltipConfig?.getFeatureName;
  const getFeatureValue = tooltipConfig?.getFeatureValue;
  const valueLabel = tooltipConfig?.valueLabel ?? "Value";
  const getTooltipConfig = useCallback(() => {
    if (!hasTooltipChild) return null;
    return {
      content: tooltipContent,
      formatValue,
      getFeatureName,
      getFeatureValue,
      valueLabel,
      className: tooltipConfig?.className,
      panelStyle: tooltipConfig?.panelStyle,
      backgroundColor: tooltipConfig?.backgroundColor,
    };
  }, [hasTooltipChild, tooltipContent, formatValue, getFeatureName, getFeatureValue, valueLabel, tooltipConfig]);
  const getChartSize = useCallback(() => ({ width, height }), [width, height]);
  const applyZoomToPoint = useCallback(
    (point: { x: number; y: number }) => {
      const z = zoomRefForChrome.current;
      if (!z) return point;
      return z.applyToPoint(point);
    },
    [],
  );

  const pathElementsRef = useRef<Map<string, SVGPathElement>>(new Map());
  const revealAnimsRef = useRef<Animation[]>([]);
  const revealDeadlineTimerRef = useRef<number | null>(null);
  const revealPostPaintCancelRef = useRef<(() => void) | null>(null);
  // CP1/CP2 — reveal timing + replay key. `seenRevealedRef` was a BOOLEAN, so
  // once set it snapped forever and a caller bumping `revealSignature` would
  // get nothing (D311). It now carries sankey's key shape; `null` = never
  // revealed.
  const enterType = enterTransition?.type;
  const enterDurationSec = enterTransition?.duration;
  const enterEaseKey = enterTransition?.ease?.join(",");
  const { durationMs: revealDurationMs, easingCss: revealEasingCss } = useMemo(
    () => clipRevealTiming(enterTransition, FEATURE_ENTER_MS, REVEAL_EASING),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enterType, enterDurationSec, enterEaseKey],
  );
  const revealKeyRef = useRef({ signature: revealSignature, duration: animationDuration });
  revealKeyRef.current = { signature: revealSignature, duration: animationDuration };
  const seenRevealedRef = useRef<{ signature: string; duration: number } | null>(null);

  const ensureHoverChrome = useCallback(() => {
    if (hoverChromeRef.current) return hoverChromeRef.current;
    hoverChromeRef.current = createChoroplethHoverChrome(
      {
        getDimOpacity,
        getBaseOpacity,
        getCentroid: getCentroidForHover,
        getFeatureAt,
        getTooltip: getTooltipConfig,
        getSize: getChartSize,
        applyZoom: applyZoomToPoint,
      },
      pathElementsRef,
    );
    return hoverChromeRef.current;
  }, [getDimOpacity, getBaseOpacity, getCentroidForHover, getFeatureAt, getTooltipConfig, getChartSize, applyZoomToPoint]);

  const marksGRef = useRef<SVGGElement | null>(null);
  const graticuleGRef = useRef<SVGGElement | null>(null);
  const zoomRefForChrome = useRef<ProvidedZoom<SVGSVGElement> | null>(null);

  type ZoomWithDrag = ProvidedZoom<SVGSVGElement> & { isDragging: boolean };
  // Single zoom-DOM writer. `svgOverride`/`marksGOverride` are the
  // first-render wiring path (handleRender): passing them ALSO establishes
  // `marksGRef.current = marksG`, which later ref-based calls depend on.
  const syncZoomTransform = useCallback((zoom: ProvidedZoom<SVGSVGElement> | null, svgOverride?: SVGSVGElement, marksGOverride?: SVGGElement | null) => {
    const z = zoom as ZoomWithDrag | null;
    const t = z ? z.toString() : "matrix(1, 0, 0, 1, 0, 0)";
    const tr = z?.isDragging ? "none" : "transform 0.18s ease-out";
    const mg = marksGOverride !== undefined ? marksGOverride : marksGRef.current;
    if (mg) {
      marksGRef.current = mg;
      mg.setAttribute("transform", t);
      (mg.style as unknown as { transition: string }).transition = tr;
    }
    const gg = graticuleGRef.current;
    if (gg) {
      gg.setAttribute("transform", t);
      (gg.style as unknown as { transition: string }).transition = tr;
    }
    const svg = svgOverride ?? (z?.containerRef.current ?? null);
    if (svg) {
      svg.style.touchAction = "none";
      svg.style.cursor = z?.isDragging ? "grabbing" : "grab";
      (svg.style as unknown as { contain: string }).contain = "layout style paint";
    }
    hoverChromeRef.current?.refreshTooltipPosition();
  }, []);

  const handleRender = useCallback(({ container }: { container: HTMLElement }) => {
    const c = container as HTMLElement;
    const svg = c.querySelector("svg.ts-chart") as unknown as SVGSVGElement | null;
    const zoom = zoomRefForChrome.current;
    if (svg && zoom) {
      (zoom.containerRef as { current: SVGSVGElement | null }).current = svg;
      const mg = c.querySelector<SVGGElement>("g.ts-chart__marks");
      syncZoomTransform(zoom, svg, mg);
    }

    const elements = new Map<string, SVGPathElement>();
    const paths = svg?.querySelectorAll<SVGPathElement>(".ts-chart__geo path[data-ts-key]");
    if (paths) {
      for (const path of paths) {
        const key = path.getAttribute("data-ts-key") ?? "";
        elements.set(key, path);
      }
    }
    pathElementsRef.current = elements;
    const domMap = new Map<string, { feature: ChoroplethFeature; index: number }>();
    let domIdx = 0;
    for (const [domKey] of elements) {
      const feature = data.features[domIdx];
      if (feature) domMap.set(domKey, { feature, index: domIdx });
      domIdx++;
    }
    domFeatureByTsKeyRef.current = domMap;

    ensureHoverChrome().reconnect(c, elements);

    if (animationDuration <= 0) return;
    // CP2: the replay KEY is tested before both the ref and the DOM stamp.
    const seenKey = seenRevealedRef.current;
    const revealKey = revealKeyRef.current;
    const revealKeyChanged =
      seenKey === null ||
      seenKey.signature !== revealKey.signature ||
      seenKey.duration !== revealKey.duration;
    if (!revealKeyChanged) return;
    const svgForBkm = c.querySelector<SVGElement>("svg.ts-chart") as SVGElement | null;
    if (!svgForBkm) return;
    if (isRevealed(svgForBkm) && !revealKeyChanged) return;
    seenRevealedRef.current = { ...revealKey };
    markRevealed(svgForBkm);

    const geoGroup = c.querySelector<SVGGElement>(".ts-chart__geo");
    if (!geoGroup) return;
    geoGroup.classList.add("ts-chart__marks--revealing");

    revealDeadlineTimerRef.current = setRevealDeadline(revealDurationMs, {
      animationsRef: revealAnimsRef,
      onDeadline: () => {},
    });

    revealPostPaintCancelRef.current = onPostPaint(() => {
      const liveSvg = c.querySelector<SVGElement>("svg.ts-chart") as SVGElement | null;
      const liveGeo = c.querySelector<SVGGElement>(".ts-chart__geo");
      if (!liveSvg || !liveGeo) return;
      liveGeo.classList.remove("ts-chart__marks--revealing");
      if ((liveGeo as unknown as HTMLElement).style) (liveGeo as unknown as HTMLElement).style.opacity = "";
      const anim = liveGeo.animate(
        [{ opacity: 0 }, { opacity: 1 }],
        { duration: revealDurationMs, easing: revealEasingCss, fill: "backwards" },
      );
      revealAnimsRef.current.push(anim);
      anim.onfinish = () => { try { anim.cancel(); } catch { /* teardown race — already cancelled */ } };
      anim.oncancel = () => { try { anim.cancel(); } catch { /* teardown race — already cancelled */ } };
    });
  }, [animationDuration, revealDurationMs, revealEasingCss, ensureHoverChrome, data.features, syncZoomTransform]);

  useEffect(() => {
    return () => {
      if (revealDeadlineTimerRef.current !== null) {
        window.clearTimeout(revealDeadlineTimerRef.current);
        revealDeadlineTimerRef.current = null;
      }
      revealPostPaintCancelRef.current?.();
      revealPostPaintCancelRef.current = null;
      for (const a of revealAnimsRef.current) try { a.cancel(); } catch { /* teardown race — already cancelled */ }
      revealAnimsRef.current = [];
      hoverChromeRef.current?.detach();
      hoverChromeRef.current = null;
    };
  }, []);

  const containerRefForFallback = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    if (seenRevealedRef.current !== null) return;
    if (animationDuration <= 0) return;
    const c = containerRefForFallback.current;
    if (!c) return;
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (seenRevealedRef.current !== null) return;
        if (!c.querySelector(".ts-chart__marks")) return;
        if (isRevealed(findRevealRoot(c, "svg.ts-chart"))) return;
        if (c.getAnimations().length > 0) return;
        handleRender({ container: c });
      });
    });
    return () => cancelAnimationFrame(raf);
  }, [animationDuration, handleRender]);

  const chartNode = (
    <>
      {/* P5.5 CP3 — bklit choropleth-feature.tsx:327 renders
          `{patterns ? <defs>{patterns}</defs> : null}` inside its feature
          group. Migrated's marks <svg> is owned by TanStack's renderer, so
          there is no in-tree injection point; the defs go in a zero-size
          sibling <svg> instead. That is equivalent, not a workaround: SVG
          paint servers resolve `url(#id)` by DOCUMENT id, so the fills
          `resolveFeatureFill` emits from `getFeaturePattern` still bind.
          RENDERING rather than stripping is the choice the charter left open —
          `patterns` is public bklit API, and `getFeaturePattern` (already
          wired) is useless without it, so stripping would retire a live prop
          pair rather than a dangling one. */}
      {featureConfig?.patterns ? (
        <svg
          aria-hidden="true"
          focusable="false"
          width={0}
          height={0}
          style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
        >
          <defs>{featureConfig.patterns}</defs>
        </svg>
      ) : null}
      <Chart
        ariaLabel="Choropleth chart"
        aspectRatio={ratio}
        definition={definition}
        onRender={handleRender}
      />
      {graticuleConfig && projection ? (
        <svg
          width={width}
          height={height}
          style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
          aria-hidden="true"
        >
          <g ref={graticuleGRef as unknown as React.RefObject<SVGGElement>}>
            <ChoroplethGraticuleOverlay
              projection={projection}
              stroke={graticuleConfig.stroke}
              strokeWidth={graticuleConfig.strokeWidth}
              step={graticuleConfig.step}
            />
          </g>
        </svg>
      ) : null}
    </>
  );

  // CP9 — one memoised value for both provider sites below (the zoom-enabled
  // and zoom-disabled branches), so consumers don't see a new object identity
  // on every render of this body.
  const choroplethContextValue = useMemo<ChoroplethContextValue>(
    () => ({
      features: data.features,
      featureCollection: data,
      pathGenerator,
      rawPathGenerator,
      projectPoint,
      width,
      height,
      innerWidth: Math.max(0, width - margin.left - margin.right),
      innerHeight: Math.max(0, height - margin.top - margin.bottom),
      margin,
      containerRef: containerRefForFallback,
      isLoaded,
      animationDuration,
      enterTransition,
      revealEpoch,
    }),
    [
      data, pathGenerator, rawPathGenerator, projectPoint,
      width, height, margin, isLoaded, animationDuration,
      enterTransition, revealEpoch,
    ],
  );

  const inner = (
    <div
      ref={(el) => { (containerRefForFallback as unknown as { current: HTMLDivElement | null }).current = el; }}
      style={{ position: "absolute", inset: 0 }}
    >
      {chartNode}
      {overlayChildren}
    </div>
  );

  if (!zoomEnabled) {
    return (
      <ChoroplethContext.Provider value={choroplethContextValue}>
        {inner}
      </ChoroplethContext.Provider>
    );
  }

  return (
    <Zoom<SVGSVGElement>
      height={height}
      width={width}
      initialTransformMatrix={initialZoom}
      scaleXMin={zoomMin}
      scaleXMax={zoomMax}
      scaleYMin={zoomMin}
      scaleYMax={zoomMax}
      wheelDelta={(event) => {
        const s = event.deltaY > 0 ? 0.95 : 1.05;
        return { scaleX: s, scaleY: s };
      }}
    >
      {(zoom) => {
        zoomRefForChrome.current = zoom as unknown as ProvidedZoom<SVGSVGElement>;
        if (typeof window !== "undefined") requestAnimationFrame(() => syncZoomTransform(zoom as unknown as ProvidedZoom<SVGSVGElement>));
        else syncZoomTransform(zoom as unknown as ProvidedZoom<SVGSVGElement>);
        // CP10: keep the state fields visx already put on this object.
        const z = zoom as unknown as ChoroplethZoomInstance<SVGSVGElement>;
        return (
          <ChoroplethZoomContext.Provider value={{ zoom: z }}>
            <ChoroplethContext.Provider value={choroplethContextValue}>
              {inner}
            </ChoroplethContext.Provider>
          </ChoroplethZoomContext.Provider>
        );
      }}
    </Zoom>
  );
}

// ===========================================================================
// Public wrapper — sizing (mirrors bklit ParentSize) + body
// ===========================================================================

export function ChoroplethChart({
  data,
  margin: marginProp,
  animationDuration = ANIMATION_DURATION_MS,
  enterTransition,
  revealSignature = "",
  aspectRatio = "16 / 9",
  scale: scaleProp,
  center = [0, 20],
  translate: translateProp,
  zoomEnabled = false,
  zoomMin = 0.5,
  zoomMax = 4,
  initialZoom = DEFAULT_INITIAL_ZOOM,
  className = "",
  children,
}: ChoroplethChartProps) {
  const margin = useMemo(() => ({ ...DEFAULT_MARGIN, ...marginProp }), [marginProp]);
  const ratio = useMemo(() => parseAspectRatio(aspectRatio), [aspectRatio]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const width = useContainerWidth(containerRef);

  const height = Math.max(0, width / ratio);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ position: "relative", width: "100%", aspectRatio: String(ratio), overflow: "hidden" }}
      data-bkm-chart="choropleth"
    >
      {width > 0 && height > 0 ? (
        <ChoroplethChartBody
          data={data}
          margin={margin}
          animationDuration={animationDuration}
          enterTransition={enterTransition}
          revealSignature={revealSignature}
          aspectRatio={aspectRatio}
          scale={scaleProp}
          center={center}
          translate={translateProp}
          zoomEnabled={zoomEnabled}
          zoomMin={zoomMin}
          zoomMax={zoomMax}
          initialZoom={initialZoom}
          className={className}
          width={width}
          height={height}
        >
          {children}
        </ChoroplethChartBody>
      ) : null}
    </div>
  );
}

ChoroplethChart.displayName = "ChoroplethChart";

export const ChoroplethFeatureComponent = _ChoroplethFeatureComponent;
export const ChoroplethTooltip = _ChoroplethTooltip;
export const ChoroplethGraticule = _ChoroplethGraticule;

export default ChoroplethChart;
