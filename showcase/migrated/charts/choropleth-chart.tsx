// Migrated bklit-ui ChoroplethChart — same public API, rendered by TanStack
// Charts geoShape mark + @visx/zoom matrix utilities for zoom/pan.
//
// Architecture (D34/D37):
//   1. Mark: TanStack `geoShape(features, { projection: geoMercator, ... })`
//      with x: null, y: null, guides: false (positionless — geo owns coords).
//      bklit uses Mercator (NOT Equal Earth!) with explicit center=[0,20],
//      scale=(innerWidth/630)*100, translate=[innerWidth/2, innerHeight/2+50].
//   2. Zoom/pan: uses @visx/zoom's matrix utilities. Zoom state managed in
//      React state as a TransformMatrix. Applied as CSS transform on the
//      Chart's outer wrapper (since TanStack owns its SVG, we transform the
//      wrapper instead of injecting into the SVG). ±5% wheel delta, hard
//      clamp-by-rejection. 180ms CSS ease on non-drag transform changes.
//      No dbl-click zoom, no inertia — matches bklit verbatim.
//   3. Reveal: TWO unsynchronized timers:
//      (a) 800ms setTimeout → isLoaded flag (internal state)
//      (b) 1100ms WAAPI feature enter fade on `.ts-chart__geo` group
//   4. Hover: dim non-hovered features to 0.4 opacity, 180ms CSS ease.
//      Tooltip positioned at projected centroid of hovered feature.
//   5. Tooltip: light-DOM tooltip, zoom-transform-aware via applyMatrixToPoint.
//   6. Color: 100% consumer-owned via `getFeatureColor` callback — pass-through.
//   7. Context: React context for zoom state + choropleth data.

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
import type {
  TransformMatrix,
  ProvidedZoom,
  Point,
  Translate,
  ScaleSignature,
  InteractionEvent,
} from "@visx/zoom";
import {
  identityMatrix,
  applyMatrixToPoint,
  scaleMatrix,
  translateMatrix,
  composeMatrices,
} from "@visx/zoom";
import { Chart } from "@tanstack/react-charts";
import { defineChart } from "@tanstack/charts";
import { geoShape } from "@tanstack/charts/geo";
import { CHART_ROLE } from "./children";
import {
  createChoroplethHoverChrome,
  type ChoroplethHoverChrome,
} from "./internal/choropleth-hover-chrome";
import { ChoroplethGraticuleOverlay } from "./internal/choropleth-graticule";
import { parseAspectRatio } from "./internal/parse-aspect-ratio";
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

// ---------------------------------------------------------------------------
// Manual zoom state manager — mirrors @visx/zoom's ProvidedZoom API
// ---------------------------------------------------------------------------

function createProvidedZoom(
  getMatrix: () => TransformMatrix,
  setMatrix: (m: TransformMatrix) => void,
  getIsDragging: () => boolean,
  setIsDragging: (v: boolean) => void,
  initialZoom: TransformMatrix,
  zoomMin: number,
  zoomMax: number,
): ProvidedZoom<SVGSVGElement> & { isDragging: boolean; transformMatrix: TransformMatrix } {
  const containerRef: React.RefObject<SVGSVGElement | null> = { current: null };

  const clamp = (m: TransformMatrix): TransformMatrix => ({
    ...m,
    scaleX: Math.min(zoomMax, Math.max(zoomMin, m.scaleX)),
    scaleY: Math.min(zoomMax, Math.max(zoomMin, m.scaleY)),
  });

  // Mutable drag/pinch state — mirrors @visx/zoom's internal state machine.
  let dragStartPoint: Point | null = null;
  let dragStartTranslate: Translate | null = null;
  let pinchStart: { distance: number; scale: number; midpoint: Point } | null = null;

  /** Compute Euclidean distance between two touch points. */
  function touchDistance(e: React.TouchEvent | TouchEvent): number {
    if (e.touches.length < 2) return 0;
    const t0 = e.touches[0]!;
    const t1 = e.touches[1]!;
    return Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
  }

  /** Compute touch midpoint (center of the two-finger pinch). */
  function touchMidpoint(e: React.TouchEvent | TouchEvent): Point {
    if (e.touches.length < 2) return { x: 0, y: 0 };
    const t0 = e.touches[0]!;
    const t1 = e.touches[1]!;
    return { x: (t0.clientX + t1.clientX) / 2, y: (t0.clientY + t1.clientY) / 2 };
  }

  return {
    containerRef,
    get isDragging() { return getIsDragging(); },
    get transformMatrix() { return getMatrix(); },

    center() {},
    clear() { setMatrix(identityMatrix()); },
    scale({ scaleX, scaleY, point }: ScaleSignature) {
      const prev = getMatrix();
      const sx = scaleX;
      const sy = scaleY ?? sx;
      let m: TransformMatrix;
      if (point) {
        m = composeMatrices(
          translateMatrix(-point.x, -point.y),
          scaleMatrix(sx, sy),
          translateMatrix(point.x, point.y),
          prev,
        );
      } else {
        m = composeMatrices(prev, scaleMatrix(sx, sy));
      }
      setMatrix(clamp(m));
    },
    translate(tr: Translate) {
      setMatrix(clamp(composeMatrices(getMatrix(), translateMatrix(tr.translateX, tr.translateY))));
    },
    translateTo(point: Point) {
      setMatrix(clamp({ ...getMatrix(), translateX: point.x, translateY: point.y }));
    },
    setTranslate(tr: Translate) {
      setMatrix(clamp({ ...getMatrix(), translateX: tr.translateX, translateY: tr.translateY }));
    },
    setTransformMatrix(m: TransformMatrix) { setMatrix(clamp(m)); },
    reset() { setMatrix(initialZoom); },
    handleWheel(event: React.WheelEvent | WheelEvent) {
      event.preventDefault();
      const zoomScale = event.deltaY > 0 ? 0.95 : 1.05;
      let point = { x: 0, y: 0 };
      const el = containerRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      }
      const prev = getMatrix();
      setMatrix(clamp(composeMatrices(
        translateMatrix(-point.x, -point.y),
        scaleMatrix(zoomScale, zoomScale),
        translateMatrix(point.x, point.y),
        prev,
      )));
    },
    handlePinch(event: React.TouchEvent | TouchEvent) {
      if (!("touches" in event) || event.touches.length < 2) {
        pinchStart = null;
        return;
      }
      const currentDistance = touchDistance(event as React.TouchEvent | TouchEvent);
      if (currentDistance === 0) return;

      if (!pinchStart) {
        const m = getMatrix();
        pinchStart = {
          distance: currentDistance,
          scale: (m.scaleX + m.scaleY) / 2,
          midpoint: touchMidpoint(event as React.TouchEvent | TouchEvent),
        };
        return;
      }

      // Compute new scale factor: distance ratio × initial scale,
      // then relative to current scale.
      const newScale = (currentDistance / pinchStart.distance) * pinchStart.scale;
      const currentMatrix = getMatrix();
      const currentScale = (currentMatrix.scaleX + currentMatrix.scaleY) / 2;
      const scaleFactor = newScale / currentScale;

      // Scale around the initial pinch midpoint, mapped to container coords.
      let point = { ...pinchStart.midpoint };
      const el = containerRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        point = { x: pinchStart.midpoint.x - rect.left, y: pinchStart.midpoint.y - rect.top };
      }

      setMatrix(clamp(composeMatrices(
        translateMatrix(-point.x, -point.y),
        scaleMatrix(scaleFactor, scaleFactor),
        translateMatrix(point.x, point.y),
        currentMatrix,
      )));
    },
    dragStart(event: InteractionEvent) {
      setIsDragging(true);
      dragStartPoint = { x: event.clientX, y: event.clientY };
      const m = getMatrix();
      dragStartTranslate = { translateX: m.translateX, translateY: m.translateY };
      // Initialize pinch state if this is a touch event with 2+ touches.
      if ("touches" in event && event.touches.length >= 2) {
        const dist = touchDistance(event as unknown as React.TouchEvent | TouchEvent);
        if (dist > 0) {
          pinchStart = {
            distance: dist,
            scale: (m.scaleX + m.scaleY) / 2,
            midpoint: touchMidpoint(event as unknown as React.TouchEvent | TouchEvent),
          };
        }
      }
    },
    dragMove(event: InteractionEvent, options?: { offsetX?: number; offsetY?: number }) {
      if (!getIsDragging() || !dragStartPoint || !dragStartTranslate) return;
      let deltaX = event.clientX - dragStartPoint.x;
      let deltaY = event.clientY - dragStartPoint.y;
      if (options?.offsetX) deltaX += options.offsetX;
      if (options?.offsetY) deltaY += options.offsetY;
      setMatrix(clamp({
        ...getMatrix(),
        translateX: dragStartTranslate.translateX + deltaX,
        translateY: dragStartTranslate.translateY + deltaY,
      }));
    },
    dragEnd() {
      setIsDragging(false);
      dragStartPoint = null;
      dragStartTranslate = null;
      pinchStart = null;
    },
    toString() {
      const m = getMatrix();
      return `matrix(${m.scaleX}, ${m.skewY}, ${m.skewX}, ${m.scaleY}, ${m.translateX}, ${m.translateY})`;
    },
    invert() {
      const m = getMatrix();
      const det = m.scaleX * m.scaleY - m.skewX * m.skewY;
      if (det === 0) return identityMatrix();
      return {
        scaleX: m.scaleY / det,
        scaleY: m.scaleX / det,
        translateX: (m.skewY * m.translateY - m.scaleY * m.translateX) / det,
        translateY: (m.skewX * m.translateX - m.scaleX * m.translateY) / det,
        skewX: -m.skewX / det,
        skewY: -m.skewY / det,
      };
    },
    toStringInvert() {
      const inv = this.invert();
      return `matrix(${inv.scaleX}, ${inv.skewY}, ${inv.skewX}, ${inv.scaleY}, ${inv.translateX}, ${inv.translateY})`;
    },
    applyToPoint({ x, y }: Point) {
      return applyMatrixToPoint(getMatrix(), { x, y });
    },
    applyInverseToPoint({ x, y }: Point) {
      return applyMatrixToPoint(this.invert(), { x, y });
    },
  };
}

function useZoomState(
  width: number,
  height: number,
  initialZoom: TransformMatrix,
  zoomMin: number,
  zoomMax: number,
  enabled: boolean,
) {
  const [matrix, setMatrix] = useState<TransformMatrix>(initialZoom);
  const [isDragging, setIsDragging] = useState(false);
  const matrixRef = useRef(matrix);
  matrixRef.current = matrix;
  const isDraggingRef = useRef(isDragging);
  isDraggingRef.current = isDragging;

  const getMatrix = useCallback(() => matrixRef.current, []);
  const getIsDragging = useCallback(() => isDraggingRef.current, []);

  const zoomObjRef = useRef<ProvidedZoom<SVGSVGElement> & { isDragging: boolean; transformMatrix: TransformMatrix } | null>(null);
  if (!zoomObjRef.current) {
    zoomObjRef.current = createProvidedZoom(
      getMatrix, setMatrix, getIsDragging, setIsDragging,
      initialZoom, zoomMin, zoomMax,
    );
  }

  // Wheel event on the chart's SVG
  const zoomContainerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const container = zoomContainerRef.current;
    if (!container) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomObjRef.current!.handleWheel(e);
    };

    container.addEventListener("wheel", onWheel, { passive: false });

    // Touch pinch + drag
    const onTouchStart = (e: TouchEvent) => { zoomObjRef.current!.dragStart(e); };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length >= 2) zoomObjRef.current!.handlePinch(e);
      zoomObjRef.current!.dragMove(e);
    };
    const onTouchEnd = () => { zoomObjRef.current!.dragEnd(); };

    // Mouse drag (mousemove/mouseup on window for capture)
    const onMouseDown = (e: MouseEvent) => { zoomObjRef.current!.dragStart(e); };
    const onMouseMove = (e: MouseEvent) => { zoomObjRef.current!.dragMove(e); };
    const onMouseUp = () => { zoomObjRef.current!.dragEnd(); };

    container.addEventListener("touchstart", onTouchStart, { passive: false });
    container.addEventListener("touchmove", onTouchMove, { passive: false });
    container.addEventListener("touchend", onTouchEnd);
    container.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    return () => {
      container.removeEventListener("wheel", onWheel);
      container.removeEventListener("touchstart", onTouchStart);
      container.removeEventListener("touchmove", onTouchMove);
      container.removeEventListener("touchend", onTouchEnd);
      container.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [enabled]);

  return {
    zoom: zoomObjRef.current!,
    zoomContainerRef,
    matrix,
    isDragging,
  };
}

// ===========================================================================
// Main component
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

  // --- Container dimensions ---
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setWidth((prev) => (Math.abs(prev - w) > 0.5 ? w : prev));
    });
    ro.observe(el);
    setWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);

  const height = Math.max(0, width / ratio);

  // --- Zoom ---
  const { zoom, zoomContainerRef, matrix, isDragging } = useZoomState(
    width, height, initialZoom, zoomMin, zoomMax, zoomEnabled,
  );

  // --- Extract children ---
  const { featureConfig, tooltipConfig, graticuleConfig, overlayChildren } =
    useMemo(() => extractChoroplethChildren(children), [children]);

  const dimOpacity = featureConfig?.fadedOpacity ?? 0.4;
  // bklit's StaticFeatureLayer wraps all paths in <g opacity={0.85}> as
  // the resting/base state. The hover chrome uses this to restore features
  // after pointer leave.
  const baseOpacity = 0.85;

  // --- Reveal (timer a: 800ms isLoaded) ---
  const [isLoaded, setIsLoaded] = useState(false);
  const [revealEpoch, setRevealEpoch] = useState(0);
  useEffect(() => {
    setRevealEpoch((n) => n + 1);
    setIsLoaded(false);
    const t = setTimeout(() => setIsLoaded(true), animationDuration);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animationDuration, revealSignature]);

  // --- Projection (Mercator — matches bklit's @visx/geo Mercator) ---
  // bklit: Mercator center={center} scale={scale??(innerWidth/630)*100}
  //        translate={translate??[innerWidth/2+margin.left, innerHeight/2+margin.top+50]}
  const projectionFactory = useCallback(
    (): GeoProjection => {
      const innerW = width - margin.left - margin.right;
      const innerH = height - margin.top - margin.bottom;
      const computedScale = scaleProp ?? (innerW > 0 ? (innerW / 630) * 100 : 100);
      const computedTranslate: [number, number] = translateProp ?? [
        innerW / 2 + margin.left,
        innerH / 2 + margin.top + 50,
      ];
      return geoMercator()
        .center(center)
        .translate(computedTranslate)
        .scale(computedScale);
    },
    [width, height, margin, scaleProp, center, translateProp],
  );

  const projection = useMemo(() => {
    if (width <= 0 || height <= 0) return null;
    return projectionFactory();
  }, [projectionFactory, width, height]);

  // --- Centroids (computed lazily on hover — saves 3ms from M1a) ---
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

  // --- Definition ---
  const definition = useMemo(() => {
    if (width <= 0 || height <= 0) return null;
    const d = defineChart({
      marks: [
        geoShape(data.features, {
          key: (f: ChoroplethFeature) => f.properties?.name ?? String(f.id ?? ""),
          projection: () => projectionFactory(),
          fill: (f: ChoroplethFeature, i: number) =>
            resolveFeatureFill(
              f, i,
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
    width, height, data.features,
    featureConfig?.getFeatureColor, featureConfig?.getFeaturePattern,
    featureConfig?.fill, featureConfig?.stroke, featureConfig?.strokeWidth,
    projectionFactory,
  ]);

  // --- Tooltip state ---
  const [tooltipData, setTooltipData] = useState<{
    feature: ChoroplethFeature;
    x: number;
    y: number;
    key: string;
  } | null>(null);

  // bklit's TooltipBox uses Framer Motion exit animation — the tooltip DOM
  // remains in the tree during the exit fade (≈180ms), so textContent-based
  // detection still finds it. We replicate this: when tooltipData becomes
  // null, we keep rendering the last tooltip for 200ms (exit phase), then clear.
  const exitTooltipDataRef = useRef<typeof tooltipData>(null);
  const [tooltipExitTick, setTooltipExitTick] = useState(false);
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

  // Derived: show tooltip if currently hovered OR still in exit phase
  const displayTooltipData = tooltipData ?? exitTooltipDataRef.current;

  // --- Precompute TanStack key → feature lookup ---
  // TanStack geoShape constructs the `data-ts-key` as:
  //   ${markId}:${valueKey(group)}:${valueKey(datumKey)}
  // For this chart: markId="geo-shape-0", group=null, datumKey=feature name.
  // valueKey(null) = "object:null", valueKey("France") = "string:France"
  // So the full key is e.g. "geo-shape-0:object:null:string:France"
  const featureByTsKey = useMemo(() => {
    const map = new Map<string, ChoroplethFeature>();
    for (const feature of data.features) {
      const featureName = feature.properties?.name ?? String(feature.id ?? "");
      const tsKey = `geo-shape-0:object:null:string:${featureName}`;
      map.set(tsKey, feature);
    }
    return map;
  }, [data.features]);

  // --- Hover chrome ---
  const hoverChromeRef = useRef<ChoroplethHoverChrome | null>(null);
  const getCentroidForHover = useCallback(
    (key: string) => {
      const f = featureByTsKey.get(key);
      if (!f) return { x: width / 2, y: height / 2 };
      return getCentroidForFeature(f) ?? { x: width / 2, y: height / 2 };
    },
    [featureByTsKey, getCentroidForFeature, width, height],
  );
  const getDimOpacity = useCallback(() => dimOpacity, [dimOpacity]);
  const getBaseOpacity = useCallback(() => baseOpacity, [baseOpacity]);
  const handleHoverChange = useCallback(
    (hd: { key: string; x: number; y: number } | null) => {
      if (!hd) { setTooltipData(null); return; }
      const f = featureByTsKey.get(hd.key);
      if (f) setTooltipData({ feature: f, x: hd.x, y: hd.y, key: hd.key });
    },
    [featureByTsKey],
  );

  // --- Post-render: SVG ref for zoom, path element tracking, reveal ---
  const pathElementsRef = useRef<Map<string, SVGPathElement>>(new Map());
  const revealAnimRef = useRef<Animation | null>(null);

  const ensureHoverChrome = useCallback(() => {
    if (hoverChromeRef.current) return hoverChromeRef.current;
    hoverChromeRef.current = createChoroplethHoverChrome(
      getDimOpacity, getBaseOpacity, getCentroidForHover, handleHoverChange,
      pathElementsRef,
    );
    return hoverChromeRef.current;
  }, [getDimOpacity, getBaseOpacity, getCentroidForHover, handleHoverChange]);

  const handleRender = useCallback(() => {
    const c = containerRef.current;
    if (!c) return;

    const svg = c.querySelector("svg");
    if (svg) {
      (zoom.containerRef as { current: SVGSVGElement | null }).current = svg as unknown as SVGSVGElement;
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

    ensureHoverChrome().reconnect(c, elements);

    if (animationDuration <= 0) return;

    const geoGroup = c.querySelector<SVGGElement>(".ts-chart__geo");
    if (!geoGroup || geoGroup.dataset.bkmRevealed === "1") return;
    geoGroup.dataset.bkmRevealed = "1";

    revealAnimRef.current?.cancel();
    revealAnimRef.current = geoGroup.animate(
      [{ opacity: 0 }, { opacity: 1 }],
      { duration: FEATURE_ENTER_MS, easing: REVEAL_EASING, fill: "backwards" },
    );
  }, [animationDuration, ensureHoverChrome, zoom]);

  useEffect(() => {
    return () => {
      hoverChromeRef.current?.detach();
      hoverChromeRef.current = null;
      revealAnimRef.current?.cancel();
    };
  }, []);

  // --- Tooltip ---
  const tooltipEnabled = tooltipConfig?.getFeatureValue !== undefined;
  const getFeatureValue = tooltipConfig?.getFeatureValue;
  const valueLabel = tooltipConfig?.valueLabel ?? "Value";
  const formatValue = tooltipConfig?.formatValue ??
    ((v: number) => {
      if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
      if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
      return String(Math.round(v));
    });

  const renderTooltip = () => {
    if (!displayTooltipData || !tooltipEnabled) return null;
    // Exit phase: tooltipData is null but displayTooltipData still has stale
    // content — fade out with CSS transition matching bklit's exit animation.
    const exiting = !tooltipData;
    let x = displayTooltipData.x;
    let y = displayTooltipData.y;
    if (zoomEnabled) {
      const t = zoom.applyToPoint({ x, y });
      x = t.x; y = t.y;
    }
    const name = displayTooltipData.feature.properties?.name ?? "Feature";
    const value = getFeatureValue?.(displayTooltipData.feature, -1);
    // Tooltip styling matches bklit's TooltipBox + TooltipContent:
    // glassmorphism panel, color-indicator row, tabular-nums value.
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

  // --- Render ---
  const zoomTransform = zoomEnabled ? zoom.toString() : undefined;
  const zoomTransition = isDragging ? "none" : "transform 0.18s ease-out";

  return (
    <ChoroplethZoomContext.Provider value={{ zoom: zoomEnabled ? zoom : null }}>
      <ChoroplethContext.Provider value={{ width, height }}>
        <div
          ref={containerRef}
          className={className}
          style={{ position: "relative", width: "100%", aspectRatio: String(ratio), overflow: "hidden" }}
          data-bkm-chart="choropleth"
        >
          {definition ? (
            <>
              <div
                ref={zoomContainerRef}
                style={{
                  position: "absolute",
                  inset: 0,
                  transform: zoomTransform,
                  transition: zoomTransition,
                  transformOrigin: "0 0",
                  touchAction: "none",
                  cursor: isDragging ? "grabbing" : "grab",
                }}
              >
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
                    <ChoroplethGraticuleOverlay
                      projection={projection}
                      width={width}
                      height={height}
                      stroke={graticuleConfig.stroke}
                      strokeWidth={graticuleConfig.strokeWidth}
                      step={graticuleConfig.step}
                    />
                  </svg>
                ) : null}
              </div>
              {renderTooltip()}
              {overlayChildren}
            </>
          ) : null}
        </div>
      </ChoroplethContext.Provider>
    </ChoroplethZoomContext.Provider>
  );
}

ChoroplethChart.displayName = "ChoroplethChart";

export const ChoroplethFeatureComponent = _ChoroplethFeatureComponent;
export const ChoroplethTooltip = _ChoroplethTooltip;
export const ChoroplethGraticule = _ChoroplethGraticule;

export default ChoroplethChart;
