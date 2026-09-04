// Bklit ChoroplethChart on TanStack geoShape; zoom rides projection params, not group transforms.
import React, { Children, createContext, isValidElement, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement, ReactNode, RefObject } from 'react';
import type { FeatureCollection,Feature,Geometry} from "geojson";
import { geoCentroid, geoMercator, geoPath } from 'd3-geo';
import type { GeoPermissibleObjects, GeoProjection } from 'd3-geo';
import type { TransformMatrix, ProvidedZoom, ZoomState, GenericWheelEvent, Scale } from "./internal/zoom-engine";
import { Zoom } from "./internal/zoom-engine";
import { identityMatrix } from "./internal/zoom-math";
import { RendererChart } from "@tanstack/react-charts/tooltip";
import type { ChartTooltipBodyRenderContext } from "@tanstack/react-charts/tooltip";
import type {
  ChartPoint,
  ChartRendererRenderContext,
  ChartValue,
  StaticChartDefinition,
} from "@tanstack/charts";
import { defineChart } from "@tanstack/charts/scene";
import { tooltip } from "@tanstack/charts/tooltip";
import { geoShape } from "@tanstack/charts/geo";
import { chartMotionRenderer } from "./internal/motion-renderer";
import { CHART_ROLE } from "./children";
import { roleOf } from "./internal/children-extract";
import { createChoroplethHoverChrome } from './internal/choropleth-hover-chrome';
import type { ChoroplethHoverChrome } from './internal/choropleth-hover-chrome';
import { intFmt } from "./internal/formatters";
import { ChoroplethGraticuleOverlay } from "./internal/choropleth-graticule";
import { findRevealRoot, isRevealed, markRevealed, onPostPaint, setRevealDeadline } from "./internal/deferred-reveal";
import { parseAspectRatio } from "./internal/parse-aspect-ratio";
import { useContainerWidth } from "./internal/use-container-size";
import { clipRevealTiming } from './internal/enter-transition';
import type { EnterTransition } from './internal/enter-transition';
import "./styles.css";

// Open-ended GeoJSON property bag; the chart only reads `name`/`id`, values stay JSON scalars.
type ChoroplethPropertyValue = string | number | boolean | null | undefined;

interface ChoroplethFeatureProperties {
  readonly name?: string;
  readonly id?: string | number;
  readonly [key: string]: ChoroplethPropertyValue;
}

type ChoroplethFeature = Feature<Geometry, ChoroplethFeatureProperties>;

interface Margin {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

interface ChoroplethChartProps {
  data: FeatureCollection<Geometry, ChoroplethFeatureProperties>;
  margin?: Partial<Margin>;
  animationDuration?: number;
  enterTransition?: EnterTransition;
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

interface ChoroplethFeatureProps {
  readonly fill?: string;
  readonly stroke?: string;
  readonly strokeWidth?: number;
  readonly fadedOpacity?: number;
  readonly getFeatureColor?: (feature: ChoroplethFeature, index: number) => string;
  readonly patterns?: ReactNode;
  readonly getFeaturePattern?: (feature: ChoroplethFeature, index: number) => string | null | undefined;
}

interface ChoroplethTooltipProps {
  readonly content?: (props: { feature: ChoroplethFeature; index: number }) => ReactNode;
  readonly formatValue?: (value: number) => string;
  readonly getFeatureName?: (feature: ChoroplethFeature, index: number) => string;
  readonly getFeatureValue?: (feature: ChoroplethFeature, index: number) => number | undefined;
  readonly valueLabel?: string;
  readonly className?: string;
  readonly panelStyle?: React.CSSProperties;
  readonly backgroundColor?: string;
}

interface ChoroplethGraticuleProps {
  readonly stroke?: string;
  readonly strokeWidth?: number;
  readonly step?: [number, number];
}

type ChoroplethZoomInstance<TElement extends Element> = ProvidedZoom<TElement> & ZoomState;

interface ChoroplethZoomContextValue {
  zoom: ChoroplethZoomInstance<HTMLElement> | null;
}

const ChoroplethZoomContext = createContext<ChoroplethZoomContextValue>({ zoom: null });

const useChoroplethZoom = (): ChoroplethZoomContextValue => useContext(ChoroplethZoomContext)

// No featurePaths array: geoShape marks own the paths; pathGenerator serves callers that want them.
interface ChoroplethContextValue {
  features: ChoroplethFeature[];
  featureCollection: FeatureCollection<Geometry, ChoroplethFeatureProperties>;
  pathGenerator: (feature: ChoroplethFeature) => string | undefined;
  rawPathGenerator: (geo: GeoPermissibleObjects) => string | null;
  projectPoint: (coords: [number, number]) => [number, number] | null;
  unprojectPoint: (point: [number, number]) => [number, number] | null;
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
  features: [],
  type: "FeatureCollection",
};

const CHOROPLETH_CONTEXT_DEFAULT: ChoroplethContextValue = {
  animationDuration: 0,
  containerRef: { current: null },
  featureCollection: EMPTY_FEATURE_COLLECTION,
  features: [],
  height: 0,
  innerHeight: 0,
  innerWidth: 0,
  isLoaded: false,
  margin: { bottom: 0, left: 0, right: 0, top: 0 },
  // No-op default: returns no path string until a real generator is provided.
  pathGenerator: (): string | undefined => undefined,
  projectPoint: () => null,
  rawPathGenerator: () => null,
  revealEpoch: 0,
  unprojectPoint: () => null,
  width: 0,
};

const ChoroplethContext = createContext<ChoroplethContextValue>(CHOROPLETH_CONTEXT_DEFAULT);

const useChoropleth = (): ChoroplethContextValue => useContext(ChoroplethContext)

const DEFAULT_CHOROPLETH_COLORS = [
  "var(--chart-scale-01)",
  "var(--chart-scale-02)",
  "var(--chart-scale-03)",
  "var(--chart-scale-04)",
  "var(--chart-scale-05)",
];

const DEFAULT_MARGIN: Margin = { bottom: 0, left: 0, right: 0, top: 0 };

const DEFAULT_INITIAL_ZOOM: TransformMatrix = identityMatrix();

const ANIMATION_DURATION_MS = 800;
const FEATURE_ENTER_MS = 1100;
const REVEAL_EASING = "cubic-bezier(0.85, 0, 0.15, 1)";
const CHOROPLETH_TOOLTIP_OFFSET = 16;
// Selector for the TanStack-rendered svg element within a chart container.
const TS_CHART_SVG_SELECTOR = "svg.ts-chart";

// Config-carrier marker declared on the component type (children.tsx ChartChildComponent
// Pattern), so attaching the role needs no assertion; the runtime shape is unchanged.
interface ChoroplethChildComponent<ComponentProps> {
  (props: ComponentProps): undefined;
  [CHART_ROLE]?: string;
}

const ChoroplethFeatureComponent: ChoroplethChildComponent<ChoroplethFeatureProps> = (_props: Readonly<ChoroplethFeatureProps>): undefined => undefined;
ChoroplethFeatureComponent[CHART_ROLE] = "choroplethFeature";

const ChoroplethTooltip: ChoroplethChildComponent<ChoroplethTooltipProps> = (_props: Readonly<ChoroplethTooltipProps>): undefined => undefined;
ChoroplethTooltip[CHART_ROLE] = "choroplethTooltip";

const ChoroplethGraticule: ChoroplethChildComponent<ChoroplethGraticuleProps> = (_props: Readonly<ChoroplethGraticuleProps>): undefined => undefined;
ChoroplethGraticule[CHART_ROLE] = "choroplethGraticule";

const resolveFeatureFill = (feature: ChoroplethFeature, index: number, baseFill: string | undefined, getFeatureColor: ChoroplethFeatureProps["getFeatureColor"], getFeaturePattern: ChoroplethFeatureProps["getFeaturePattern"]): string => {
  const patternId = getFeaturePattern?.(feature, index);
  const baseFillValue = baseFill ?? "";
  if ((patternId ?? "").length > 0) {return `url(#${patternId})`;}
  if (baseFillValue.length > 0) {return baseFillValue;}
  if (getFeatureColor) {return getFeatureColor(feature, index);}
  return DEFAULT_CHOROPLETH_COLORS[index % DEFAULT_CHOROPLETH_COLORS.length] ?? "var(--chart-1)";
}

const choroplethFeatureKey = (feature: Readonly<Pick<ChoroplethFeature, "properties" | "id">>): string => feature.properties?.name ?? String(feature.id ?? "")

// Feature keys carry valueKey's string:<length>: wrapper; match the wrapped form, not the raw name.
const geoValueKey = (value: string): string => `string:${value.length}:${value}`

const choroplethSceneKey = (feature: Readonly<Pick<ChoroplethFeature, "properties" | "id">>): string => `choropleth:${geoValueKey(choroplethFeatureKey(feature))}`

// Fraction (0-1) to color-mix percent scale for withAlpha.
const ALPHA_TO_PERCENT = 100;

// FillOpacity is per-call, not per-datum: hover dim bakes into fill/stroke alpha via color-mix.
const withAlpha = (color: string, alphaPercent: number): string => {
  const pct = Math.max(0, Math.min(ALPHA_TO_PERCENT, alphaPercent));
  return `color-mix(in oklab, ${color} ${pct}%, transparent)`;
}

// Base 0.85, hovered 1, dimmed 0.4 (bklit hover-chrome values).
const resolveFeatureAlpha = (key: string, hoveredKey: string | null, baseOpacity: number, dimOpacity: number): number => {
  if (hoveredKey === null) {return baseOpacity;}
  if (hoveredKey === key) {return 1;}
  return dimOpacity;
}


// Zoom application eases matrix values over 180ms per frame (retired CSS transition's timing).
const ZOOM_EASE_MS = 180;

// Binomial coefficient of the cubic Bernstein basis in the bezier solver below.
const CUBIC_BEZIER_COEFFICIENT = 3;
// Newton-Raphson iteration cap and slope epsilon of the bezier solver.
const BEZIER_SOLVER_MAX_ITERATIONS = 8;
const BEZIER_SOLVER_EPSILON = 1e-6;
// Default map center latitude (longitude 0 needs no name: it is exempt).
const DEFAULT_CENTER_LATITUDE = 20;
// Default map center (stable reference for the center prop default).
const DEFAULT_CENTER: [number, number] = [0, DEFAULT_CENTER_LATITUDE];
// Dimmed-feature opacity when another feature is hovered (bklit hover-chrome value).
const DEFAULT_FADED_OPACITY = 0.4;
// Scale calibration for the d3 mercator: base scale unit at the reference viewport width.
const CHOROPLETH_REFERENCE_WIDTH = 630;
const CHOROPLETH_BASE_SCALE = 100;
// Downward nudge of the default projection center (title/legend space).
const CHOROPLETH_TRANSLATE_Y_OFFSET = 50;
const DEFAULT_STROKE_WIDTH = 0.5;
// Wheel-zoom step factors per tick, out and in.
const WHEEL_ZOOM_OUT_FACTOR = 0.95;
const WHEEL_ZOOM_IN_FACTOR = 1.05;

// Static prop values hoisted so JSX props below keep a stable identity across renders.
// Wheel step as a scale-delta pair; hoisted so the Zoom prop keeps a stable callback identity.
const resolveWheelZoomDelta = (event: GenericWheelEvent): Scale => {
  const zoomScale = event.deltaY > 0 ? WHEEL_ZOOM_OUT_FACTOR : WHEEL_ZOOM_IN_FACTOR;
  return { scaleX: zoomScale, scaleY: zoomScale };
};
// Swatch marker for the tooltip value row.
const TOOLTIP_SWATCH_STYLE = { backgroundColor: "var(--chart-1)" } as const;
// Graticule overlay svg floats above the map without intercepting pointer events.
const GRATICULE_LAYER_STYLE = { left: 0, pointerEvents: "none", position: "absolute", top: 0 } as const;
// Zero-size svg hosting pattern defs; url(#id) paint servers resolve document-wide.
const PATTERN_DEFS_STYLE = { height: 0, overflow: "hidden", position: "absolute", width: 0 } as const;
// Inner overlay container fills the sized body.
const CHOROPLETH_INNER_STYLE = { inset: 0, position: "absolute" } as const;

interface CubicBezierCoefficients {
  readonly ax: number;
  readonly bx: number;
  readonly cx: number;
  readonly ay: number;
  readonly by: number;
  readonly cy: number;
}

// Ease-out control points (0, 0, 0.58, 1); the only curve the zoom easing uses.
const easeOutCoefficients = (): CubicBezierCoefficients => {
  const cx = CUBIC_BEZIER_COEFFICIENT * 0;
  const bx = CUBIC_BEZIER_COEFFICIENT * (0.58 - 0) - cx;
  const ax = 1 - cx - bx;
  const cy = CUBIC_BEZIER_COEFFICIENT * 0;
  const by = CUBIC_BEZIER_COEFFICIENT * (1 - 0) - cy;
  const ay = 1 - cy - by;
  return { ax, ay, bx, by, cx, cy };
}

const sampleBezierX = (coeffs: Readonly<CubicBezierCoefficients>, curveParam: number): number =>
  ((coeffs.ax * curveParam + coeffs.bx) * curveParam + coeffs.cx) * curveParam;

const sampleBezierY = (coeffs: Readonly<CubicBezierCoefficients>, curveParam: number): number =>
  ((coeffs.ay * curveParam + coeffs.by) * curveParam + coeffs.cy) * curveParam;

const sampleBezierDX = (coeffs: Readonly<CubicBezierCoefficients>, curveParam: number): number =>
  (CUBIC_BEZIER_COEFFICIENT * coeffs.ax * curveParam + 2 * coeffs.bx) * curveParam + coeffs.cx;

const solveBezierT = (coeffs: Readonly<CubicBezierCoefficients>, time: number): number => {
  let solution = time;
  for (let iteration = 0; iteration < BEZIER_SOLVER_MAX_ITERATIONS; iteration += 1) {
    const dx = sampleBezierDX(coeffs, solution);
    if (Math.abs(dx) < BEZIER_SOLVER_EPSILON) {break;}
    solution -= (sampleBezierX(coeffs, solution) - time) / dx;
  }
  return solution;
}

const cubicBezierEaseOut = (time: number): number => {
  if (time <= 0) {return 0;}
  if (time >= 1) {return 1;}
  const coeffs = easeOutCoefficients();
  return sampleBezierY(coeffs, solveBezierT(coeffs, time));
}

const lerpMatrix = (from: Readonly<TransformMatrix>, to: Readonly<TransformMatrix>, progress: number): TransformMatrix => ({
    scaleX: from.scaleX + (to.scaleX - from.scaleX) * progress,
    scaleY: from.scaleY + (to.scaleY - from.scaleY) * progress,
    skewX: from.skewX + (to.skewX - from.skewX) * progress,
    skewY: from.skewY + (to.skewY - from.skewY) * progress,
    translateX: from.translateX + (to.translateX - from.translateX) * progress,
    translateY: from.translateY + (to.translateY - from.translateY) * progress,
  })

const matricesEqual = (matrixA: Readonly<TransformMatrix>, matrixB: Readonly<TransformMatrix>): boolean => {
    const scaleMatches = matrixA.scaleX === matrixB.scaleX && matrixA.scaleY === matrixB.scaleY;
    const translateMatches = matrixA.translateX === matrixB.translateX && matrixA.translateY === matrixB.translateY;
    const skewMatches = matrixA.skewX === matrixB.skewX && matrixA.skewY === matrixB.skewY;
    return scaleMatches && translateMatches && skewMatches;
  }

type ZoomEaseState = { from: TransformMatrix; start: number };

interface ZoomFrameOptions {
  readonly dragging: boolean;
  readonly easeRef: RefObject<ZoomEaseState | undefined>;
  readonly target: TransformMatrix;
  readonly now: number;
}

const resolveZoomFrameMatrix = (options: Readonly<ZoomFrameOptions>): TransformMatrix => {
  const { dragging, easeRef, target, now } = options;
  const ease = easeRef.current;
  if (dragging || !ease) {return target;}
  const progress = Math.min((now - ease.start) / ZOOM_EASE_MS, 1);
  if (progress >= 1) {
    easeRef.current = undefined;
    return target;
  }
  return lerpMatrix(ease.from, target, cubicBezierEaseOut(progress));
};

// True when the committed zoom snapshot differs (matrix or dragging flag).
interface ZoomSnapshotOptions {
  readonly matrix: TransformMatrix;
  readonly dragging: boolean;
  readonly committedMatrix: Readonly<TransformMatrix>;
  readonly committedDragging: boolean;
}

const zoomSnapshotChanged = (options: Readonly<ZoomSnapshotOptions>): boolean =>
  options.dragging !== options.committedDragging || !matricesEqual(options.matrix, options.committedMatrix);

const queueZoomFrame = (shouldContinue: boolean, frame: (now: number) => void): number | undefined => {
  if (!shouldContinue) {return undefined;}
  return requestAnimationFrame(frame);
};

interface ExtractedConfig {
  featureConfig: ChoroplethFeatureProps | undefined;
  tooltipConfig: ChoroplethTooltipProps | undefined;
  graticuleConfig: ChoroplethGraticuleProps | undefined;
  overlayChildren: ReactNode[];
}

interface FeaturePaintOptions {
  readonly featureConfig: ChoroplethFeatureProps | undefined;
  readonly hoveredKey: string | null;
  readonly baseOpacity: number;
  readonly dimOpacity: number;
}

interface FeaturePainters {
  readonly fill: (feature: ChoroplethFeature, context: { readonly index: number }) => string;
  readonly stroke: (feature: Readonly<Pick<ChoroplethFeature, "properties" | "id">>) => string;
}

const makeFeaturePainters = (options: Readonly<FeaturePaintOptions>): FeaturePainters => {
  const { featureConfig, hoveredKey, baseOpacity, dimOpacity } = options;
  return {
    // Pattern fills can't alpha-blend: pattern-filled features skip hover dim (fidelity gap).
    fill: (feature: ChoroplethFeature, { index }: { readonly index: number }): string => {
      const resolved = resolveFeatureFill(
        feature, index,
        featureConfig?.fill,
        featureConfig?.getFeatureColor,
        featureConfig?.getFeaturePattern,
      );
      if ((featureConfig?.getFeaturePattern?.(feature, index) ?? "").length > 0) {return resolved;}
      const alpha = resolveFeatureAlpha(choroplethSceneKey(feature), hoveredKey, baseOpacity, dimOpacity);
      return withAlpha(resolved, alpha * ALPHA_TO_PERCENT);
    },
    stroke: (feature: Readonly<Pick<ChoroplethFeature, "properties" | "id">>): string => {
      const alpha = resolveFeatureAlpha(choroplethSceneKey(feature), hoveredKey, baseOpacity, dimOpacity);
      return withAlpha(featureConfig?.stroke ?? "var(--background)", alpha * ALPHA_TO_PERCENT);
    },
  };
};

// MultiPolygon anchors use projectPoint(geoCentroid(feature)): path.centroid skews toward Alaska.
const choroplethTooltipAnchor = (projForMark: GeoProjection) =>
  (
    points: readonly ChartPoint<ChoroplethFeature>[],
  ): { x: number; y: number } | undefined => {
    const [firstPoint] = points;
    if (!firstPoint) {return undefined;}
    const centroid = geoCentroid(firstPoint.datum);
    const projected =
      centroid && Number.isFinite(centroid[0]) && Number.isFinite(centroid[1])
        ? projForMark(centroid)
        : undefined;
    return projected && Number.isFinite(projected[0]) && Number.isFinite(projected[1])
      ? { x: projected[0], y: projected[1] }
      : { x: firstPoint.x, y: firstPoint.y };
  };

interface ChoroplethDefinitionOptions {
  readonly data: FeatureCollection<Geometry, ChoroplethFeatureProperties>;
  readonly width: number;
  readonly height: number;
  readonly projection: GeoProjection | undefined;
  readonly featureConfig: ChoroplethFeatureProps | undefined;
  readonly hoveredKey: string | null;
  readonly baseOpacity: number;
  readonly dimOpacity: number;
  readonly hasTooltipChild: boolean;
}

// The generics are pinned explicitly: geoShape infers its value type from the feature
// Data (number), but the chart is driven with ChartValue, and RendererChart takes its
// Generics from this prop. Annotating the return states that once, where it is checked —
// The previous `undefined as unknown as StaticChartDefinition<…>` cast asserted the same
// Thing unsafely, and on a branch that cannot run (the parent gates on width/height).
const buildChoroplethDefinition = (
  options: Readonly<ChoroplethDefinitionOptions>,
): StaticChartDefinition<ChoroplethFeature, ChartValue, ChartValue, "dom"> | undefined => {
  const { data, width, height, projection, featureConfig, hoveredKey, baseOpacity, dimOpacity, hasTooltipChild } = options;
  if (width <= 0 || height <= 0 || !projection) {return undefined;}
  const projForMark = projection;
  const painters = makeFeaturePainters({ baseOpacity, dimOpacity, featureConfig, hoveredKey });
  const chartDefinition = defineChart({
    focusRing: false,
    guides: false,
    margin: 0,
    marks: [
      geoShape(data.features, {
        fill: painters.fill,
        id: "choropleth",
        key: choroplethFeatureKey,
        // Native motion suppressed per-mark so the default enter fade never races the app-owned group fade.
        motion: false,
        projection: () => projForMark,
        stroke: painters.stroke,
        strokeOpacity: 1,
        strokeWidth: featureConfig?.strokeWidth ?? DEFAULT_STROKE_WIDTH,
      }),
    ],
    // Library pointer handling stays off: app-owned detection is the single hover source of truth.
    pointer: false,
    scales: { x: null, y: null },
    // Tooltip is instant-mount/instant-unmount (sticky/motion false), matching the retired box.
    tooltip: hasTooltipChild
      ? {
          anchor: choroplethTooltipAnchor(projForMark),
          className: "bkm-native-tooltip",
          motion: false,
          offset: CHOROPLETH_TOOLTIP_OFFSET,
          placement: ["right", "left"],
          sticky: false,
          use: tooltip,
        }
      : false,
  });
  return chartDefinition;
};

interface ChoroplethTooltipCardConfig {
  readonly backgroundColor: ChoroplethTooltipProps["backgroundColor"];
  readonly className: ChoroplethTooltipProps["className"];
  readonly content: ChoroplethTooltipProps["content"];
  readonly formatValue: (value: number) => string;
  readonly getFeatureName: ChoroplethTooltipProps["getFeatureName"];
  readonly getFeatureValue: ChoroplethTooltipProps["getFeatureValue"];
  readonly panelStyle: ChoroplethTooltipProps["panelStyle"];
  readonly valueLabel: string;
}

interface ChoroplethTooltipBodyContext {
  readonly defaultBody: ReactNode;
  readonly points: readonly ChartPoint<ChoroplethFeature>[];
}

const tooltipCardStyle = (cfg: Readonly<ChoroplethTooltipCardConfig>): React.CSSProperties => {
  const tooltipBackground = cfg.backgroundColor ?? "";
  const backgroundOverride = tooltipBackground.length > 0 ? { backgroundColor: tooltipBackground } : undefined;
  return {
    ...backgroundOverride,
    ...cfg.panelStyle,
  };
};

const renderCustomTooltipCard = (
  cfg: Readonly<ChoroplethTooltipCardConfig>,
  feature: ChoroplethFeature,
  index: number,
): ReactElement | undefined => {
  if (!cfg.content) {return undefined;}
  return (
    <div className="bkm-tooltip-panel" style={tooltipCardStyle(cfg)}>
      {cfg.content({ feature, index })}
    </div>
  );
};

const renderTooltipValueRow = (cfg: Readonly<ChoroplethTooltipCardConfig>, value: number): ReactElement => (
  <div className="bkm-tooltip-row">
    <div className="bkm-tooltip-row-label">
      <span className="bkm-tooltip-swatch" style={TOOLTIP_SWATCH_STYLE} />
      <span className="bkm-tooltip-series">{cfg.valueLabel}</span>
    </div>
    <span className="bkm-tooltip-value">{cfg.formatValue(value)}</span>
  </div>
);

const renderDefaultTooltipCard = (
  cfg: Readonly<ChoroplethTooltipCardConfig>,
  feature: ChoroplethFeature,
  index: number,
): ReactElement => {
  const name = cfg.getFeatureName
    ? cfg.getFeatureName(feature, index)
    : (feature.properties?.name ?? `Feature ${index}`);
  const value = cfg.getFeatureValue?.(feature, index);
  return (
    <div
      className={(cfg.className ?? "").length > 0 ? `bkm-tooltip-panel ${cfg.className}` : "bkm-tooltip-panel"}
      style={tooltipCardStyle(cfg)}
    >
      <div className="bkm-tooltip-content">
        <div className="bkm-tooltip-title">{name}</div>
        {value === undefined ? undefined : (
          <div className="bkm-tooltip-rows">
            {renderTooltipValueRow(cfg, value)}
          </div>
        )}
      </div>
    </div>
  );
};

const renderFeatureTooltipCard = (
  cfg: Readonly<ChoroplethTooltipCardConfig>,
  feature: ChoroplethFeature,
  index: number,
): ReactNode => renderCustomTooltipCard(cfg, feature, index) ?? renderDefaultTooltipCard(cfg, feature, index);

const renderChoroplethTooltipBody = (
  ctx: Readonly<ChoroplethTooltipBodyContext>,
  getTooltipConfig: () => ChoroplethTooltipCardConfig | undefined,
): ReactNode => {
  const cfg = getTooltipConfig();
  if (!cfg) {return ctx.defaultBody;}
  const [firstPoint] = ctx.points;
  if (!firstPoint) {return undefined;}
  return renderFeatureTooltipCard(cfg, firstPoint.datum, firstPoint.datumIndex);
};

interface RevealPlaybackOptions {
  readonly chartContainer: HTMLElement;
  readonly durationMs: number;
  readonly easingCss: string;
  readonly animationsRef: RefObject<Animation[]>;
}

// Settle a reveal tween: drop the backwards fill once finished or cancelled.
const settleGeoReveal = (anim: Animation): void => {
  anim.onfinish = (): void => { try { anim.cancel(); } catch {
    // Cancelling a finished tween throws: the reveal is already settled.
  } };
  anim.addEventListener("cancel", (): void => { try { anim.cancel(); } catch {
    // Cancelling a cancelled tween throws: the settle is already done.
  } });
};

const playGeoReveal = (options: Readonly<RevealPlaybackOptions>): void => {
  const { chartContainer, durationMs, easingCss, animationsRef } = options;
  const liveSvg = chartContainer.querySelector<SVGElement>(TS_CHART_SVG_SELECTOR);
  const liveGeo = chartContainer.querySelector<SVGGElement>(".ts-chart__geo");
  if (!liveSvg || !liveGeo) {return;}
  liveGeo.classList.remove("ts-chart__marks--revealing");
  // SVGGElement carries style via ElementCSSInlineStyle, so no HTMLElement cast is needed.
  liveGeo.style.opacity = "";
  const anim = liveGeo.animate(
    [{ opacity: 0 }, { opacity: 1 }],
    { duration: durationMs, easing: easingCss, fill: "backwards" },
  );
  animationsRef.current.push(anim);
  settleGeoReveal(anim);
};

interface ArmRevealOptions {
  readonly chartContainer: HTMLElement;
  readonly durationMs: number;
  readonly easingCss: string;
  readonly animationsRef: RefObject<Animation[]>;
  readonly deadlineRef: RefObject<number | undefined>;
  readonly cancelRef: RefObject<(() => void) | undefined>;
}

const armRevealAnimation = (options: Readonly<ArmRevealOptions>): void => {
  const { chartContainer, durationMs, easingCss, animationsRef, deadlineRef, cancelRef } = options;
  const geoGroup = chartContainer.querySelector<SVGGElement>(".ts-chart__geo");
  if (!geoGroup) {return;}
  geoGroup.classList.add("ts-chart__marks--revealing");
  deadlineRef.current = setRevealDeadline(durationMs, {
    animationsRef,
    onDeadline: () => {
      // No deadline fallback: the animation finish handlers settle the reveal.
    },
  });
  cancelRef.current = onPostPaint(() => {
    playGeoReveal({ animationsRef, chartContainer, durationMs, easingCss });
  });
};

interface RevealKey {
  readonly signature: string;
  readonly duration: number;
}

const readPendingRevealKey = (
  seenKey: Readonly<RevealKey> | undefined,
  revealKey: Readonly<RevealKey>,
): RevealKey | undefined => {
  const revealKeyChanged =
    !seenKey ||
    seenKey.signature !== revealKey.signature ||
    seenKey.duration !== revealKey.duration;
  if (!revealKeyChanged) {return undefined;}
  return { ...revealKey };
};

interface ChoroplethRevealOptions {
  readonly animationDuration: number;
  readonly revealSignature: string;
  readonly enterTransition: EnterTransition | undefined;
}

interface RevealKeyState {
  readonly revealDurationMs: number;
  readonly revealEasingCss: string;
  readonly revealKeyRef: RefObject<RevealKey>;
  readonly seenRevealedRef: RefObject<RevealKey | undefined>;
}

// Reveal timing plus the pending/seen key refs the reveal decision reads.
const useRevealKeyState = (
  enterTransition: EnterTransition | undefined,
  animationDuration: number,
  revealSignature: string,
): RevealKeyState => {
  // Reveal key carries sankey's shape; null means never revealed (boolean snapped forever).
  const { durationMs: revealDurationMs, easingCss: revealEasingCss } = useMemo(
    () => clipRevealTiming(enterTransition, FEATURE_ENTER_MS, REVEAL_EASING),
    [enterTransition],
  );
  const revealKeyRef = useRef({ duration: animationDuration, signature: revealSignature });
  revealKeyRef.current = { duration: animationDuration, signature: revealSignature };
  const seenRevealedRef = useRef<RevealKey | undefined>(undefined);
  return { revealDurationMs, revealEasingCss, revealKeyRef, seenRevealedRef };
};

interface ChoroplethRevealApi {
  readonly maybeStartReveal: (chartContainer: HTMLElement, svg: SVGSVGElement | null | undefined) => void;
  readonly cancelReveal: () => void;
  readonly hasRevealed: () => boolean;
}

const useChoroplethReveal = (options: Readonly<ChoroplethRevealOptions>): ChoroplethRevealApi => {
  const { animationDuration, revealSignature, enterTransition } = options;
  const { revealDurationMs, revealEasingCss, revealKeyRef, seenRevealedRef } = useRevealKeyState(enterTransition, animationDuration, revealSignature);
  const revealAnimsRef = useRef<Animation[]>([]);
  const revealDeadlineTimerRef = useRef<number | undefined>(undefined);
  const revealPostPaintCancelRef = useRef<(() => void) | undefined>(undefined);

  const maybeStartReveal = useCallback((chartContainer: HTMLElement, svg: SVGSVGElement | null | undefined): void => {
    if (animationDuration <= 0) {return;}
    const pendingKey = readPendingRevealKey(seenRevealedRef.current, revealKeyRef.current);
    if (!pendingKey || !svg || isRevealed(svg)) {return;}
    seenRevealedRef.current = pendingKey;
    markRevealed(svg);
    armRevealAnimation({
      animationsRef: revealAnimsRef,
      cancelRef: revealPostPaintCancelRef,
      chartContainer,
      deadlineRef: revealDeadlineTimerRef,
      durationMs: revealDurationMs,
      easingCss: revealEasingCss,
    });
  }, [animationDuration, revealDurationMs, revealEasingCss, seenRevealedRef, revealKeyRef]);

  const cancelReveal = useCallback((): void => {
    if ((revealDeadlineTimerRef.current ?? 0) !== 0) {
      globalThis.clearTimeout(revealDeadlineTimerRef.current);
      revealDeadlineTimerRef.current = undefined;
    }
    revealPostPaintCancelRef.current?.();
    revealPostPaintCancelRef.current = undefined;
    for (const revealAnim of revealAnimsRef.current) {try { revealAnim.cancel(); } catch {
      // Cancelling a finished animation throws: the cancel already settled it.
    }}
    revealAnimsRef.current = [];
  }, []);

  useEffect(() => (): void => { cancelReveal(); }, [cancelReveal]);

  const hasRevealed = useCallback((): boolean => seenRevealedRef.current !== undefined, [seenRevealedRef]);

  return { cancelReveal, hasRevealed, maybeStartReveal };
};

const syncZoomContainer = (
  chartContainer: HTMLElement,
  zoom: ProvidedZoom<HTMLElement> | null,
  isDragging: boolean,
): void => {
  if (!zoom) {return;}
  // The zoom target is the host div (gestures bind the whole chart box, not just the svg).
  // The zoom plumbing is typed for HTMLElement so this assigns directly.
  zoom.containerRef.current = chartContainer;
  chartContainer.style.touchAction = "none";
  chartContainer.style.cursor = isDragging ? "grabbing" : "grab";
  chartContainer.style.contain = "layout style paint";
};

const collectGeoElements = (svg: SVGSVGElement | null | undefined): Map<string, SVGPathElement> => {
  const elements = new Map<string, SVGPathElement>();
  const paths = svg?.querySelectorAll<SVGPathElement>(".ts-chart__geo path[data-ts-key]");
  if (paths) {
    for (const path of paths) {
      const pathKey = path.dataset.tsKey ?? "";
      elements.set(pathKey, path);
    }
  }
  return elements;
};

const resolveSurfaceSvg = (chartContainer: HTMLElement, surfaceElement: Element | undefined): SVGSVGElement | undefined => {
  // The surface element is typed as a plain Element; narrow to the svg with
  // Using instanceof narrows to the svg, falling back to a typed query, so no assertion is needed.
  if (surfaceElement instanceof SVGSVGElement) {return surfaceElement;}
  return chartContainer.querySelector<SVGSVGElement>(TS_CHART_SVG_SELECTOR) ?? undefined;
};

interface GraticuleLayerOptions {
  readonly graticuleConfig: ChoroplethGraticuleProps;
  readonly projection: GeoProjection;
  readonly width: number;
  readonly height: number;
}

const renderGraticuleLayer = (options: Readonly<GraticuleLayerOptions>): ReactElement => {
  const { graticuleConfig, projection, width, height } = options;
  return (
    <svg
      width={width}
      height={height}
      style={GRATICULE_LAYER_STYLE}
      aria-hidden="true"
    >
      <g>
        <ChoroplethGraticuleOverlay
          projection={projection}
          stroke={graticuleConfig.stroke}
          strokeWidth={graticuleConfig.strokeWidth}
          step={graticuleConfig.step}
        />
      </g>
    </svg>
  );
};

const extractChoroplethChildren = (children: ReactNode): ExtractedConfig => {
  let featureConfig: ChoroplethFeatureProps | undefined = undefined;
  let tooltipConfig: ChoroplethTooltipProps | undefined = undefined;
  let graticuleConfig: ChoroplethGraticuleProps | undefined = undefined;
  const overlayChildren: ReactNode[] = [];

  const visit = (node: ReactNode): void => {
    for (const child of Children.toArray(node)) {
      if (isValidElement(child)) {
        // The roleOf helper maps each child component type to its props contract, so pinning the
        // The isValidElement generic pinned to the role's config type recovers props without asserting.
        const role = roleOf(child.type);
        if (role === "choroplethFeature" && isValidElement<ChoroplethFeatureProps>(child)) {featureConfig = child.props;}
        else if (role === "choroplethTooltip" && isValidElement<ChoroplethTooltipProps>(child)) {tooltipConfig = child.props;}
        else if (role === "choroplethGraticule" && isValidElement<ChoroplethGraticuleProps>(child)) {graticuleConfig = child.props;}
        else {overlayChildren.push(child);}
      } else {overlayChildren.push(child);}
    }
  };
  visit(children);
  return { featureConfig, graticuleConfig, overlayChildren, tooltipConfig };
}


const ChoroplethChartBody = ({
  data,
  margin: marginProp,
  animationDuration = ANIMATION_DURATION_MS,
  enterTransition,
  revealSignature = "",
  aspectRatio = "16 / 9",
  scale: scaleProp,
  center = DEFAULT_CENTER,
  translate: translateProp,
  zoomEnabled = false,
  zoomMin = 0.5,
  zoomMax = 4,
  initialZoom = DEFAULT_INITIAL_ZOOM,
  children,
  width,
  height,
}: ChoroplethChartProps & { width: number; height: number }): ReactElement => {
  const margin = useMemo(() => ({ ...DEFAULT_MARGIN, ...marginProp }), [marginProp]);
  const ratio = useMemo(() => parseAspectRatio(aspectRatio), [aspectRatio]);

  const { featureConfig, tooltipConfig, graticuleConfig, overlayChildren } =
    useMemo(() => extractChoroplethChildren(children), [children]);

  const dimOpacity = featureConfig?.fadedOpacity ?? DEFAULT_FADED_OPACITY;
  const baseOpacity = 0.85;
  const hasTooltipChild = Boolean(tooltipConfig);

  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const zoomRefForChrome = useRef<ProvidedZoom<HTMLElement> | null>(null);

  const [displayMatrix, setDisplayMatrix] = useState<TransformMatrix>(() => initialZoom);
  const targetMatrixRef = useRef<TransformMatrix>(initialZoom);
  const isDraggingRef = useRef(false);
  const committedMatrixRef = useRef<TransformMatrix>(initialZoom);
  const committedDraggingRef = useRef(false);
  const easeRef = useRef<{ from: TransformMatrix; start: number } | undefined>(undefined);
  const zoomRafRef = useRef<number | undefined>(undefined);
  const refreshTooltipAnchorRef = useRef<() => void>(() => {
    // No-op until the tooltip anchor registers its refresh.
  });

  const stepZoomFrame = useCallback(function stepZoomFrame(now: number): void {
    zoomRafRef.current = undefined;
    const dragging = isDraggingRef.current;
    const next = resolveZoomFrameMatrix({ dragging, easeRef, now, target: targetMatrixRef.current });
    if (zoomSnapshotChanged({ committedDragging: committedDraggingRef.current, committedMatrix: committedMatrixRef.current, dragging, matrix: next })) {
      committedMatrixRef.current = next;
      committedDraggingRef.current = dragging;
      setDisplayMatrix(next);
      refreshTooltipAnchorRef.current();
    }
    zoomRafRef.current = queueZoomFrame(dragging || easeRef.current !== undefined, stepZoomFrame);
  }, []);

  const scheduleZoomFrame = useCallback(() => {
    if ((zoomRafRef.current ?? 0) !== 0) {return;}
    zoomRafRef.current = requestAnimationFrame(stepZoomFrame);
  }, [stepZoomFrame]);

  const onZoomTick = useCallback((zoom: Readonly<Pick<ChoroplethZoomInstance<HTMLElement>, "transformMatrix" | "isDragging">>) => {
    targetMatrixRef.current = zoom.transformMatrix;
    isDraggingRef.current = zoom.isDragging;
    if (typeof globalThis === "undefined") {return;}
    if (zoom.isDragging) {
      easeRef.current = undefined;
    } else if (matricesEqual(zoom.transformMatrix, committedMatrixRef.current)) {
      // Settled on the committed matrix: the existing ease (if any) already applies.
    }
    else {easeRef.current = { from: committedMatrixRef.current, start: performance.now() };}
    scheduleZoomFrame();
  }, [scheduleZoomFrame]);

  const projection = useMemo((): GeoProjection | undefined => {
    if (width <= 0 || height <= 0) {return undefined;}
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;
    const baseScale = scaleProp ?? (innerW > 0 ? (innerW / CHOROPLETH_REFERENCE_WIDTH) * CHOROPLETH_BASE_SCALE : CHOROPLETH_BASE_SCALE);
    const baseTranslate: [number, number] = translateProp ?? [
      innerW / 2 + margin.left,
      innerH / 2 + margin.top + CHOROPLETH_TRANSLATE_Y_OFFSET,
    ];
    // Composition stays exact only for skew-free, uniform-scale matrices (the only shape gestures produce).
    const currentMatrix = displayMatrix;
    return geoMercator()
      .center(center)
      .scale(baseScale * currentMatrix.scaleX)
      .translate([
        currentMatrix.scaleX * baseTranslate[0] + currentMatrix.translateX,
        currentMatrix.scaleY * baseTranslate[1] + currentMatrix.translateY,
      ]);
  }, [width, height, margin, scaleProp, center, translateProp, displayMatrix]);

  // IsLoaded/revealEpoch exist for useChoropleth() lifecycle parity; the reveal itself is WAAPI.
  const [isLoaded, setIsLoaded] = useState(false);
  const [revealEpoch, setRevealEpoch] = useState(0);
  useEffect(() => {
    setRevealEpoch((epoch) => epoch + 1);
    setIsLoaded(false);
    const timeout = setTimeout((): void =>{  setIsLoaded(true); }, animationDuration);
    return (): void =>{  clearTimeout(timeout); };
  }, [animationDuration, revealSignature]);

  const geoPathGenerator = useMemo(
    () => (projection ? geoPath(projection) : undefined),
    [projection],
  );
  const pathGenerator = useCallback(
    (feature: ChoroplethFeature) => geoPathGenerator?.(feature) ?? undefined,
    [geoPathGenerator],
  );
  const rawPathGenerator = useCallback(
    (geo: GeoPermissibleObjects) => geoPathGenerator?.(geo) ?? null,
    [geoPathGenerator],
  );
  const projectPoint = useCallback(
    (coords: [number, number]): [number, number] | null => {
      const projected = projection?.(coords);
      return projected && Number.isFinite(projected[0]) && Number.isFinite(projected[1]) ? [projected[0], projected[1]] : null;
    },
    [projection],
  );

  // Anchors arrive already zoomed (projection carries zoom); no forward matrix apply needed.
  const unprojectPoint = useCallback(
    (point: [number, number]): [number, number] | null => {
      const unprojected = projection?.invert?.(point);
      return unprojected && Number.isFinite(unprojected[0]) && Number.isFinite(unprojected[1]) ? [unprojected[0], unprojected[1]] : null;
    },
    [projection],
  );

  const definition = useMemo<
    StaticChartDefinition<ChoroplethFeature, ChartValue, ChartValue, "dom"> | undefined
  >(() => buildChoroplethDefinition({
    baseOpacity,
    data,
    dimOpacity,
    featureConfig,
    hasTooltipChild,
    height,
    hoveredKey,
    projection,
    width,
  }), [
    baseOpacity, data, dimOpacity, featureConfig, hasTooltipChild, height, hoveredKey, projection, width,
  ]);

  const hoverChromeRef = useRef<ChoroplethHoverChrome | undefined>(undefined);
  const renderContextRef = useRef<Pick<
    ChartRendererRenderContext<ChoroplethFeature>,
    "scene" | "interaction"
  > | null>(null);
  const hoveredKeyRef = useRef<string | null>(null);

  const formatValue = tooltipConfig?.formatValue ?? intFmt;
  const tooltipContent = tooltipConfig?.content;
  const getFeatureName = tooltipConfig?.getFeatureName;
  const getFeatureValue = tooltipConfig?.getFeatureValue;
  const valueLabel = tooltipConfig?.valueLabel ?? "Value";
  const getTooltipConfig = useCallback((): ChoroplethTooltipCardConfig | undefined => {
    if (!hasTooltipChild) {return undefined;}
    return {
      backgroundColor: tooltipConfig?.backgroundColor,
      className: tooltipConfig?.className,
      content: tooltipContent,
      formatValue,
      getFeatureName,
      getFeatureValue,
      panelStyle: tooltipConfig?.panelStyle,
      valueLabel,
    };
  }, [hasTooltipChild, tooltipContent, formatValue, getFeatureName, getFeatureValue, valueLabel, tooltipConfig]);

  // Focus bridge uses source 'pointer': programmatic would trigger legend-dim states.
  const onFocusChange = useCallback((key: string | null) => {
    hoveredKeyRef.current = key;
    const ctx = renderContextRef.current;
    if (!ctx) {return;}
    const candidate = key === null ? null : (ctx.scene.points.find((point: Readonly<Pick<ChartPoint<ChoroplethFeature>, "key">>) => point.key === key) ?? null);
    ctx.interaction.setControlledFocus(candidate, { source: "pointer" });
  }, []);

  const reveal = useChoroplethReveal({ animationDuration, enterTransition, revealSignature });

  const ensureHoverChrome = useCallback(() => {
    if (hoverChromeRef.current) {return hoverChromeRef.current;}
    hoverChromeRef.current = createChoroplethHoverChrome({
      onFocusChange,
      onHoverChange: setHoveredKey,
    });
    return hoverChromeRef.current;
  }, [onFocusChange]);

  const refreshTooltipAnchor = useCallback(() => {
    const ctx = renderContextRef.current;
    const key = hoveredKeyRef.current;
    if (!ctx || key === null) {return;}
    const candidate = ctx.scene.points.find((point: Readonly<Pick<ChartPoint<ChoroplethFeature>, "key">>) => point.key === key);
    if (!candidate) {return;}
    ctx.interaction.setControlledFocus(candidate, { source: "pointer" });
  }, []);
  refreshTooltipAnchorRef.current = refreshTooltipAnchor;

  const { maybeStartReveal: startReveal } = reveal;
  const handleRender = useCallback((
    context: { container: HTMLElement } & Partial<
      Pick<ChartRendererRenderContext<ChoroplethFeature>, "scene" | "interaction" | "surface">
    >,
  ) => {
    const { container, scene, interaction, surface } = context;
    if (scene && interaction) {renderContextRef.current = { interaction, scene };}
    const chartContainer = container;
    const svg = resolveSurfaceSvg(chartContainer, surface?.element);
    syncZoomContainer(chartContainer, zoomRefForChrome.current, isDraggingRef.current);
    ensureHoverChrome().reconnect(chartContainer, collectGeoElements(svg));
    startReveal(chartContainer, svg);
  }, [ensureHoverChrome, startReveal]);

  useEffect(() =>
    (): void => {
      hoverChromeRef.current?.detach();
      hoverChromeRef.current = undefined;
    }
  , []);

  const containerRefForFallback = useRef<HTMLDivElement | null>(null);
  const handleFallbackRef = useCallback((el: HTMLDivElement | null): void => {
    containerRefForFallback.current = el;
  }, []);
  const handleTooltipBody = useCallback(
    (ctx: ChartTooltipBodyRenderContext<ChoroplethFeature, ChartValue, ChartValue>): ReactNode =>
      renderChoroplethTooltipBody(ctx, getTooltipConfig),
    [getTooltipConfig],
  );
  const revealHasRevealed = reveal.hasRevealed;
  useLayoutEffect((): (() => void) | undefined => {
    if (revealHasRevealed()) {return undefined;}
    if (animationDuration <= 0) {return undefined;}
    const fallbackContainer = containerRefForFallback.current;
    if (!fallbackContainer) {return undefined;}
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (revealHasRevealed()) {return;}
        if (!fallbackContainer.querySelector(".ts-chart__marks")) {return;}
        if (isRevealed(findRevealRoot(fallbackContainer, TS_CHART_SVG_SELECTOR))) {return;}
        if (fallbackContainer.getAnimations().length > 0) {return;}
        handleRender({ container: fallbackContainer });
      });
    });
    return (): void =>{  cancelAnimationFrame(raf); };
  }, [animationDuration, handleRender, revealHasRevealed]);

  const chartNode = (
    <>
      {/* Defs live in a zero-size sibling svg; url(#id) paint servers resolve document-wide. */}
      {featureConfig?.patterns ? (
        <svg
          aria-hidden="true"
          focusable="false"
          width={0}
          height={0}
          style={PATTERN_DEFS_STYLE}
        >
          <defs>{featureConfig.patterns}</defs>
        </svg>
      ) : undefined}
      {definition ? (
        <RendererChart
          renderer={chartMotionRenderer<ChoroplethFeature>()}
          ariaLabel="Choropleth chart"
          aspectRatio={ratio}
          definition={definition}
          onRender={handleRender}
          renderTooltipBody={handleTooltipBody}
        />
      ) : undefined}
      {graticuleConfig && projection ? renderGraticuleLayer({ graticuleConfig, height, projection, width }) : undefined}
    </>
  );

  const choroplethContextValue = useMemo<ChoroplethContextValue>(
    () => ({
      animationDuration,
      containerRef: containerRefForFallback,
      enterTransition,
      featureCollection: data,
      features: data.features,
      height,
      innerHeight: Math.max(0, height - margin.top - margin.bottom),
      innerWidth: Math.max(0, width - margin.left - margin.right),
      isLoaded,
      margin,
      pathGenerator,
      projectPoint,
      rawPathGenerator,
      revealEpoch,
      unprojectPoint,
      width,
    }),
    [
      data, pathGenerator, rawPathGenerator, projectPoint, unprojectPoint,
      width, height, margin, isLoaded, animationDuration,
      enterTransition, revealEpoch,
    ],
  );

  const inner = (
    <div
      ref={handleFallbackRef}
      style={CHOROPLETH_INNER_STYLE}
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
    <Zoom<HTMLElement>
      height={height}
      width={width}
      initialTransformMatrix={initialZoom}
      scaleXMin={zoomMin}
      scaleXMax={zoomMax}
      scaleYMin={zoomMin}
      scaleYMax={zoomMax}
      wheelDelta={resolveWheelZoomDelta}
    >
      {(zoom) => {
        zoomRefForChrome.current = zoom;
        const activeZoom = zoom;
        onZoomTick(activeZoom);
        return (
          <ChoroplethZoomContext.Provider value={{ zoom: activeZoom }}>
            <ChoroplethContext.Provider value={choroplethContextValue}>
              {inner}
            </ChoroplethContext.Provider>
          </ChoroplethZoomContext.Provider>
        );
      }}
    </Zoom>
  );
}


interface SizedBodyOptions {
  readonly data: ChoroplethChartProps["data"];
  readonly margin: Margin;
  readonly animationDuration: number;
  readonly enterTransition: EnterTransition | undefined;
  readonly revealSignature: string;
  readonly aspectRatio: string;
  readonly scaleProp: number | undefined;
  readonly center: [number, number];
  readonly translateProp: [number, number] | undefined;
  readonly zoomEnabled: boolean;
  readonly zoomMin: number;
  readonly zoomMax: number;
  readonly initialZoom: TransformMatrix;
  readonly width: number;
  readonly ratio: number;
  readonly children: ReactNode;
}

const renderSizedBody = (options: Readonly<SizedBodyOptions>): ReactElement | undefined => {
  const { width } = options;
  const height = Math.max(0, width / options.ratio);
  if (width <= 0 || height <= 0) {return undefined;}
  return (
    <ChoroplethChartBody
      data={options.data}
      margin={options.margin}
      animationDuration={options.animationDuration}
      enterTransition={options.enterTransition}
      revealSignature={options.revealSignature}
      aspectRatio={options.aspectRatio}
      scale={options.scaleProp}
      center={options.center}
      translate={options.translateProp}
      zoomEnabled={options.zoomEnabled}
      zoomMin={options.zoomMin}
      zoomMax={options.zoomMax}
      initialZoom={options.initialZoom}
      width={width}
      height={height}
    >
      {options.children}
    </ChoroplethChartBody>
  );
};


const ChoroplethChart = ({
  data,
  margin: marginProp,
  animationDuration = ANIMATION_DURATION_MS,
  enterTransition,
  revealSignature = "",
  aspectRatio = "16 / 9",
  scale: scaleProp,
  center = DEFAULT_CENTER,
  translate: translateProp,
  zoomEnabled = false,
  zoomMin = 0.5,
  zoomMax = 4,
  initialZoom = DEFAULT_INITIAL_ZOOM,
  className = "",
  children,
}: ChoroplethChartProps): ReactElement => {
  const margin = useMemo(() => ({ ...DEFAULT_MARGIN, ...marginProp }), [marginProp]);
  const ratio = useMemo(() => parseAspectRatio(aspectRatio), [aspectRatio]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const width = useContainerWidth(containerRef);
  const containerStyle = useMemo(() => ({ aspectRatio: String(ratio), overflow: "hidden", position: "relative", width: "100%" }) as const, [ratio]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={containerStyle}
      data-bkm-chart="choropleth"
    >
      {renderSizedBody({
        animationDuration,
        aspectRatio,
        center,
        children,
        data,
        enterTransition,
        initialZoom,
        margin,
        ratio,
        revealSignature,
        scaleProp,
        translateProp,
        width,
        zoomEnabled,
        zoomMax,
        zoomMin,
      })}
    </div>
  );
}

ChoroplethChart.displayName = "ChoroplethChart";

export type { TransformMatrix } from "./internal/zoom-engine";
export {
  ChoroplethChart,
  ChoroplethFeatureComponent,
  ChoroplethGraticule,
  ChoroplethTooltip,
  ChoroplethZoomContext,
  useChoropleth,
  useChoroplethZoom,
};
export type {
  ChoroplethChartProps,
  ChoroplethContextValue,
  ChoroplethFeature,
  ChoroplethFeatureProperties,
  ChoroplethFeatureProps,
  ChoroplethGraticuleProps,
  ChoroplethTooltipProps,
  ChoroplethZoomContextValue,
  ChoroplethZoomInstance,
  Margin,
};

export default ChoroplethChart;
