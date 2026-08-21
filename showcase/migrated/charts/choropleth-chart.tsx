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
} from "react";
import { FeatureCollection, type Feature, type Geometry } from "geojson";
import { geoCentroid, geoMercator, type GeoProjection } from "d3-geo";
import type { TransformMatrix, ProvidedZoom } from "@visx/zoom";
import { identityMatrix } from "@visx/zoom";
import { Zoom } from "@visx/zoom";
import { Chart } from "@tanstack/react-charts";
import { defineChart } from "@tanstack/charts";
import { geoShape } from "@tanstack/charts/geo";
import { CHART_ROLE } from "./children";
import {
  createChoroplethHoverChrome,
  type ChoroplethHoverChrome,
} from "./internal/choropleth-hover-chrome";
import { ChoroplethGraticuleOverlay } from "./internal/choropleth-graticule";
import { onPostPaint, setRevealDeadline } from "./internal/deferred-reveal";
import { parseAspectRatio } from "./internal/parse-aspect-ratio";
import { useContainerWidth } from "./internal";
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
  enterTransition?: unknown;
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

export interface ChoroplethZoomContextValue {
  zoom: ProvidedZoom<SVGSVGElement> | null;
}

export const ChoroplethZoomContext = createContext<ChoroplethZoomContextValue>({ zoom: null });

export function useChoroplethZoom(): ChoroplethZoomContextValue {
  return useContext(ChoroplethZoomContext);
}

export interface ChoroplethContextValue {
  width: number;
  height: number;
}

const ChoroplethContext = createContext<ChoroplethContextValue>({ width: 0, height: 0 });

export function useChoropleth(): ChoroplethContextValue {
  return useContext(ChoroplethContext);
}

const DEFAULT_CHOROPLETH_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
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
    if (width <= 0 || height <= 0 || !projection) return null as unknown as ReturnType<typeof defineChart>;
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
    });
    return d;
  }, [
    width, height, projection, data.features,
    featureConfig?.getFeatureColor, featureConfig?.getFeaturePattern,
    featureConfig?.fill, featureConfig?.stroke, featureConfig?.strokeWidth,
  ]);

  // --- Tooltip state ---
  const [tooltipData, setTooltipData] = useState<{
    feature: ChoroplethFeature;
    x: number;
    y: number;
    key: string;
  } | null>(null);

  const exitTooltipDataRef = useRef<typeof tooltipData>(null);
  const [, setTooltipExitTick] = useState(false);
  useEffect(() => {
    if (tooltipData) {
      exitTooltipDataRef.current = tooltipData;
    } else if (exitTooltipDataRef.current) {
      const id = setTimeout(() => {
        exitTooltipDataRef.current = null;
        setTooltipExitTick((v) => !v);
      }, 200);
      return () => clearTimeout(id);
    }
  }, [tooltipData]);

  const displayTooltipData = tooltipData ?? exitTooltipDataRef.current;

  const domFeatureByTsKeyRef = useRef<Map<string, ChoroplethFeature> | null>(null);

  const hoverChromeRef = useRef<ChoroplethHoverChrome | null>(null);
  const getFeatureByKey = useCallback(
    (key: string): ChoroplethFeature | undefined => domFeatureByTsKeyRef.current?.get(key),
    [],
  );
  const getCentroidForHover = useCallback(
    (key: string) => {
      const f = getFeatureByKey(key);
      if (!f) return { x: width / 2, y: height / 2 };
      return getCentroidForFeature(f) ?? { x: width / 2, y: height / 2 };
    },
    [getFeatureByKey, getCentroidForFeature, width, height],
  );
  const getDimOpacity = useCallback(() => dimOpacity, [dimOpacity]);
  const getBaseOpacity = useCallback(() => baseOpacity, [baseOpacity]);
  const handleHoverChange = useCallback(
    (hd: { key: string; x: number; y: number } | null) => {
      if (!hd) { setTooltipData(null); return; }
      const f = getFeatureByKey(hd.key);
      if (f) setTooltipData({ feature: f, x: hd.x, y: hd.y, key: hd.key });
    },
    [getFeatureByKey],
  );

  const pathElementsRef = useRef<Map<string, SVGPathElement>>(new Map());
  const revealAnimsRef = useRef<Animation[]>([]);
  const revealDeadlineTimerRef = useRef<number | null>(null);
  const revealPostPaintCancelRef = useRef<(() => void) | null>(null);
  const seenRevealedRef = useRef(false);

  const ensureHoverChrome = useCallback(() => {
    if (hoverChromeRef.current) return hoverChromeRef.current;
    hoverChromeRef.current = createChoroplethHoverChrome(
      getDimOpacity, getBaseOpacity, getCentroidForHover, handleHoverChange,
      pathElementsRef,
    );
    return hoverChromeRef.current;
  }, [getDimOpacity, getBaseOpacity, getCentroidForHover, handleHoverChange]);

  const marksGRef = useRef<SVGGElement | null>(null);
  const graticuleGRef = useRef<SVGGElement | null>(null);
  const zoomRefForChrome = useRef<ProvidedZoom<SVGSVGElement> | null>(null);

  type ZoomWithDrag = ProvidedZoom<SVGSVGElement> & { isDragging: boolean };
  const syncZoomTransform = useCallback((zoom: ProvidedZoom<SVGSVGElement> | null) => {
    const z = zoom as ZoomWithDrag | null;
    const t = z ? z.toString() : "matrix(1, 0, 0, 1, 0, 0)";
    const tr = z?.isDragging ? "none" : "transform 0.18s ease-out";
    const mg = marksGRef.current;
    if (mg) {
      mg.setAttribute("transform", t);
      (mg.style as unknown as { transition: string }).transition = tr;
    }
    const gg = graticuleGRef.current;
    if (gg) {
      gg.setAttribute("transform", t);
      (gg.style as unknown as { transition: string }).transition = tr;
    }
    const svg = z?.containerRef.current ?? null;
    if (svg) {
      svg.style.touchAction = "none";
      svg.style.cursor = z?.isDragging ? "grabbing" : "grab";
      (svg.style as unknown as { contain: string }).contain = "layout style paint";
    }
  }, []);

  const applyZoomToGroups = useCallback((zoom: ProvidedZoom<SVGSVGElement> | null, svg: SVGSVGElement, marksG: SVGGElement | null) => {
    const z = zoom as ZoomWithDrag | null;
    const t = z ? z.toString() : "matrix(1, 0, 0, 1, 0, 0)";
    const tr = z?.isDragging ? "none" : "transform 0.18s ease-out";
    if (marksG) {
      marksGRef.current = marksG;
      marksG.setAttribute("transform", t);
      (marksG.style as unknown as { transition: string }).transition = tr;
    }
    const gg = graticuleGRef.current;
    if (gg) {
      gg.setAttribute("transform", t);
      (gg.style as unknown as { transition: string }).transition = tr;
    }
    svg.style.touchAction = "none";
    svg.style.cursor = z?.isDragging ? "grabbing" : "grab";
    (svg.style as unknown as { contain: string }).contain = "layout style paint";
  }, []);

  const handleRender = useCallback(({ container }: { container: HTMLElement }) => {
    const c = container as HTMLElement;
    const svg = c.querySelector("svg.ts-chart") as unknown as SVGSVGElement | null;
    const zoom = zoomRefForChrome.current;
    if (svg && zoom) {
      (zoom.containerRef as { current: SVGSVGElement | null }).current = svg;
      const mg = c.querySelector<SVGGElement>("g.ts-chart__marks");
      applyZoomToGroups(zoom, svg, mg);
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
    const domMap = new Map<string, ChoroplethFeature>();
    let domIdx = 0;
    for (const [domKey] of elements) {
      const feature = data.features[domIdx];
      if (feature) domMap.set(domKey, feature);
      domIdx++;
    }
    domFeatureByTsKeyRef.current = domMap;

    ensureHoverChrome().reconnect(c, elements);

    if (animationDuration <= 0) return;
    if (seenRevealedRef.current) return;
    const svgForBkm = c.querySelector<SVGElement>("svg.ts-chart") as SVGElement | null;
    if (!svgForBkm) return;
    if (svgForBkm.dataset.bkmRevealed === "1") return;
    seenRevealedRef.current = true;
    svgForBkm.dataset.bkmRevealed = "1";

    const geoGroup = c.querySelector<SVGGElement>(".ts-chart__geo");
    if (!geoGroup) return;
    geoGroup.classList.add("ts-chart__marks--revealing");

    revealDeadlineTimerRef.current = setRevealDeadline(FEATURE_ENTER_MS, {
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
        { duration: FEATURE_ENTER_MS, easing: REVEAL_EASING, fill: "backwards" },
      );
      revealAnimsRef.current.push(anim);
      anim.onfinish = () => { try { anim.cancel(); } catch { /* teardown race — already cancelled */ } };
      anim.oncancel = () => { try { anim.cancel(); } catch { /* teardown race — already cancelled */ } };
    });
  }, [animationDuration, ensureHoverChrome, data.features, applyZoomToGroups]);

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
    if (seenRevealedRef.current) return;
    if (animationDuration <= 0) return;
    const c = containerRefForFallback.current;
    if (!c) return;
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (seenRevealedRef.current) return;
        if (!c.querySelector(".ts-chart__marks")) return;
        if (c.querySelector<HTMLElement>("svg.ts-chart")?.dataset.bkmRevealed === "1") return;
        if (c.getAnimations().length > 0) return;
        handleRender({ container: c });
      });
    });
    return () => cancelAnimationFrame(raf);
  }, [animationDuration, handleRender]);

  // --- Tooltip ---
  const hasTooltipChild = tooltipConfig !== null;
  const getFeatureValue = tooltipConfig?.getFeatureValue;
  const getFeatureName = tooltipConfig?.getFeatureName;
  const valueLabel = tooltipConfig?.valueLabel ?? "Value";
  const formatValue = tooltipConfig?.formatValue ??
    ((v: number) => {
      if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
      if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
      return String(Math.round(v));
    });

  const renderTooltip = (zoom: ProvidedZoom<SVGSVGElement> | null) => {
    if (!displayTooltipData || !hasTooltipChild) return null;
    const exiting = !tooltipData;
    let x = displayTooltipData.x;
    let y = displayTooltipData.y;
    if (zoom) {
      const t = zoom.applyToPoint({ x, y });
      x = t.x; y = t.y;
    }
    const name = getFeatureName
      ? getFeatureName(displayTooltipData.feature, -1)
      : (displayTooltipData.feature.properties?.name ?? "Feature");
    const value = getFeatureValue?.(displayTooltipData.feature, -1);
    return (
      <div
        style={{
          position: "absolute",
          left: x + 16,
          top: y,
          transform: "translateY(-50%)",
          background: tooltipConfig?.backgroundColor ?? "var(--chart-tooltip-background, #1e1e2e)",
          color: "var(--chart-tooltip-foreground, #cdd6f4)",
          borderRadius: 8,
          minWidth: 140,
          pointerEvents: "none",
          zIndex: 50,
          boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          opacity: exiting ? 0 : 1,
          transition: "opacity 0.1s ease-out",
          ...tooltipConfig?.panelStyle,
        }}
        className={tooltipConfig?.className}
      >
        <div style={{ padding: "10px 12px", overflow: "hidden" }}>
          {name ? (
            <div style={{
              fontWeight: 500,
              fontSize: 12,
              lineHeight: "16px",
              marginBottom: value !== undefined ? 8 : 0,
              color: "var(--chart-tooltip-foreground, #cdd6f4)",
              textAlign: "left",
            }}>
              {name}
            </div>
          ) : null}
          {value !== undefined ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    backgroundColor: "var(--chart-1)",
                    flexShrink: 0,
                  }} />
                  <span style={{
                    fontSize: 14,
                    lineHeight: "20px",
                    color: "var(--chart-tooltip-muted, #a6adc8)",
                  }}>
                    {valueLabel}
                  </span>
                </div>
                <span style={{
                  fontWeight: 500,
                  fontSize: 14,
                  lineHeight: "20px",
                  color: "var(--chart-tooltip-foreground, #cdd6f4)",
                  fontVariantNumeric: "tabular-nums",
                }}>
                  {formatValue(value)}
                </span>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    );
  };

  const chartNode = (
    <>
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

  const inner = (
    <div
      ref={(el) => { (containerRefForFallback as unknown as { current: HTMLDivElement | null }).current = el; }}
      style={{ position: "absolute", inset: 0 }}
    >
      {chartNode}
      {overlayChildren}
    </div>
  );

  const tooltipFor = (z: ProvidedZoom<SVGSVGElement> | null) => renderTooltip(z);

  if (!zoomEnabled) {
    return (
      <ChoroplethContext.Provider value={{ width, height }}>
        {inner}
        {tooltipFor(null)}
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
        const z = zoom as unknown as ProvidedZoom<SVGSVGElement>;
        return (
          <ChoroplethZoomContext.Provider value={{ zoom: z }}>
            <ChoroplethContext.Provider value={{ width, height }}>
              {inner}
              {renderTooltip(z)}
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
