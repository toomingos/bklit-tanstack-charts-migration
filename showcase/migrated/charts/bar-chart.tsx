// Bklit BarChart on TanStack Charts. Vertical grouped bars only; stacked/orientation out of scope.
import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CSSProperties, Dispatch, ReactElement, ReactNode, SetStateAction } from "react";
import { scaleBand } from "d3-scale";
import type { ScaleBand } from "d3-scale";
import { RendererChart } from "@tanstack/react-charts/tooltip";
import type { ChartTooltipBodyRenderContext } from "@tanstack/react-charts/tooltip";
import { barY } from "@tanstack/charts/bar";
import { defineChart } from "@tanstack/charts/scene";
import { group } from "@tanstack/charts/group";
import { whenFocused } from "@tanstack/charts/focus/mark";
import type { ChartMark, ChartMarkState, ChartMotionDefinition, ChartMotionPhase, ChartMotionTiming, ChartPoint, ChartRendererRenderContext, DomChartDefinition, SceneNode } from "@tanstack/charts";
import { extractChildren } from "./internal/children-extract";
import { TooltipContent } from "./internal/tooltip-components";
import { BOX_OFFSET, DISCRETE_INTERACTION_THRESHOLD, FADE_BUFFER, TICKER_HALF_WIDTH, TOOLTIP_BOX_SPRING } from "./internal/design-tokens";
import { buildPill } from './internal/date-pill';
import type { PillBuild } from './internal/date-pill';
import { selectBarLabelIndices, tickLabelFadeOpacity, hiddenAxisOptions } from "./internal/axis-ticks";
import { resolveVerticalFadeSides, indicatorFadeGradientStops } from "./internal/fade-mask";
import type { IndicatorFadeGradientStop } from "./internal/fade-mask";
import { toDotConfig, toIndicatorConfig } from "./internal/tooltip-mappers";
import type { SpringConfig } from "./internal/chart-config-context";
import { ReferenceAreaLayers } from "./internal/reference-area-layer";
import type { ReferenceAreaLayersGeom } from "./internal/reference-area-layer";
import { BackgroundLayer } from "./internal/background-layer";
import { extractReferenceAreaProps } from "./internal/reference-area-config";
import { useChartConfig } from "./internal/chart-config-context";
import { useChartLegendHover } from "./internal/chart-legend-hover-context";
import { useFocusInjection } from "./internal/focus-injection";
import { buildIndicatorMark } from "./internal/hover-geometry";
import { buildNativeTooltipExtension } from "./internal/native-tooltip";
import { createBarFocusStrategy } from "./internal/bar-focus-strategy";
import { barSquaresMark } from "./internal/bar-squares-mark";
import { barColumnTrackMark } from "./internal/bar-column-track-mark";
import { barDepthBackMark, barDepthFrontMark, buildNegBarStops, buildPosBarStops, BAR_FADED_OPACITY, DEFAULT_GROUND_SHADOW as DEFAULT_BAR_DEPTH_GROUND_SHADOW } from "./internal/bar-depth-marks";
import type { BarDepthGradientIds, GlassGradientStop } from "./internal/bar-depth-marks";
import { barPulseMark, buildPulseWaveStops, syncBarPulseGroups } from "./internal/bar-pulse-mark";
import type { PulseWaveGradientStop } from "./internal/bar-pulse-mark";
import { barTrimmedMark } from "./internal/bar-trimmed-mark";
import { renderPatternPreset } from "./internal/pattern-preset-render";
import type { PatternPresetId } from "./internal/pattern-preset";
import type { BarConfig, BarColumnTrackConfig, BarDepthBackConfig, BarDepthFrontConfig, BarSquaresConfig, ChartDatum, ChartPhase, ChartTooltipConfig, ChartTooltipPoint, TooltipRow } from "./internal/types";
import { parseAspectRatio } from "./internal/parse-aspect-ratio";
import { resolveGridGuide } from "./internal/grid";
import { isRevealed, markRevealed, setRevealDeadline } from "./internal/deferred-reveal";
import { useChartRenderer } from "./internal/motion-renderer";
import { bandWidthForSquares, computeSquareColumn } from "./internal/bar-squares-layout";
import { isFiniteNumber } from "./internal/series-bar-scene";
import { resolveMotionEasing } from "./internal/reveal-easing";
import { bezierEasing } from "./internal/bezier-easing";
import { useChartMargin, DEFAULT_CHART_MARGIN } from './internal/use-chart-margin';
import { useContainerWidth } from './internal/use-container-size';
import type { ChartMargin } from './internal/use-chart-margin';
import { shortDateFmt } from "./internal/formatters";
import { useSanitizedId } from "./internal/use-sanitized-id";
import {
  createAxisValueProjector,
  createNicedYScale,
  resolveYDomainsByAxis,
} from "./internal/y-domain";
import { DEFAULT_Y_AXIS_ID } from "./internal/y-axis-id";
import {
  DEFAULT_ANIMATION_DURATION_MS,
  DEFAULT_ANIMATION_EASING,
} from "./internal/animation-defaults";
import { clipRevealTiming } from './internal/enter-transition';
import type { EnterTransition } from './internal/enter-transition';
import "./styles.css";

// Reveal is an 1100ms cubic-bezier(.85,0,.15,1) tween (bklit DEFAULT_CHART_ENTER_TRANSITION).
const GROUP_GAP = 4;
// Tooltip overlay covers the plot without intercepting pointer events.
const BAR_TOOLTIP_OVERLAY_STYLE = { inset: 0, pointerEvents: "none", position: "absolute" } as const;
// Hidden gradient-defs SVG takes no space in layout.
const BAR_HIDDEN_DEFS_STYLE = { position: "absolute" } as const;
// Single fixed fill, not a rotating per-series palette (unlike scatter).
const DEFAULT_BAR_FILL = "var(--chart-line-primary)";

// Dim transitions mirror bklit timings: bars/track 150ms in-out, squares/depth 150ms ease-out.
const BAR_DIM_TRANSITION: NonNullable<ChartMarkState["transition"]> = { duration: 150, easing: "ease-in-out", type: "tween" };
const BAR_SQUARES_DIM_TRANSITION: NonNullable<ChartMarkState["transition"]> = { duration: 150, easing: "ease-out", type: "tween" };
const BAR_TRACK_DIM_TRANSITION: NonNullable<ChartMarkState["transition"]> = { duration: 150, easing: "ease-in-out", type: "tween" };
const BAR_DEPTH_DIM_TRANSITION: NonNullable<ChartMarkState["transition"]> = { duration: 150, easing: "ease-out", type: "tween" };
/** D481: `barDepthBackMark` nodes per row — side + shade + glass, lid + tip + shade. */
const BAR_DEPTH_BACK_NODES_PER_ROW = 6;
// Bklit parity: round cornerRadius caps at 8px (min with half the bar width).
const BAR_ROUND_CORNER_RADIUS_MAX_PX = 8;
// Ring-dot corner radius caps at half the side (a full squircle at most).
const BAR_RING_CORNER_RADIUS_MAX_FRACTION = 0.5;
// Enter stagger spreads 40% of the reveal duration across bars.
const BAR_ENTER_STAGGER_SPREAD_FRACTION = 0.4;
// Default gap between squares in squares and column-track marks.
const DEFAULT_SQUARE_GAP = 3;
// Default corner-radius fraction for square marks.
const DEFAULT_SQUARE_RADIUS = 0.25;
// Empty-domain fallback max before headroom; no-series stays [0, 110] via the factor below.
const BAR_DOMAIN_EMPTY_FALLBACK_MAX = 100;
// Y-domain headroom factor over the data max.
const BAR_DOMAIN_HEADROOM_FACTOR = 1.1;
// Percent-string gradient offsets (0-100) scale to 0-1 fractions.
const GRADIENT_STOP_PERCENT_DIVISOR = 100;
// Tick-label baseline offset below the axis (pixels).
const BAR_TICK_LABEL_DY_OFFSET_PX = 26;
// Default cap on visible x tick labels.
const BAR_MAX_TICK_LABELS_DEFAULT = 12;
// Default hover-dot size (pixels).
const DEFAULT_HOVER_DOT_SIZE = 5;
// Default hover-dot stroke width for the ring variant.
const DEFAULT_HOVER_DOT_RING_STROKE_WIDTH = 1.5;
// Default hover-dot corner-radius fraction.
const DEFAULT_HOVER_DOT_RADIUS_FRACTION = 0.25;
// Default crosshair fade length (pixels).
const DEFAULT_INDICATOR_FADE_LENGTH = 10;

/**
 * Row dim is group-scoped (unmatched focus); legend dim is series-scoped via whenSeriesDimmed.
 *
 * @param {number} fadedOpacity - Opacity for unmatched rows, sourced per series/square at the call site.
 * @param {Readonly<NonNullable<ChartMarkState["transition"]>>} transition - Motion transition shared with the row's mark states.
 * @returns {ChartMarkState<ChartDatum>[]} Single unmatched-focus dim state for the row.
 */
const barRowDimStates = (
  fadedOpacity: number,
  transition: Readonly<NonNullable<ChartMarkState["transition"]>>,
): ChartMarkState<ChartDatum>[] => [{ style: { opacity: fadedOpacity }, transition, when: { focus: "unmatched" } }];

/**
 * Depth pointer-row dim; the any-legend-hover half lives in the marks' opacity option.
 *
 * @returns {ChartMarkState<ChartDatum>[]} Single unmatched-focus pointer-source dim state at the faded opacity.
 */
const barDepthDimStates = (): ChartMarkState<ChartDatum>[] => [
  { style: { opacity: BAR_FADED_OPACITY }, transition: BAR_DEPTH_DIM_TRANSITION, when: { focus: "unmatched", source: "pointer" } },
];

/** Track dims to 0 on any pointer-row hover, legend-independent. */
const BAR_TRACK_DIM_STATES: ChartMarkState<ChartDatum>[] = [
  { style: { opacity: 0 }, transition: BAR_TRACK_DIM_TRANSITION, when: (context: { readonly focus: { readonly source: string } }) => context.focus.source === "pointer" },
];

type BarOrientation = "vertical" | "horizontal";

interface BarChartProps {
  data: ChartDatum[];
  xDataKey?: string;
  animationDuration?: number;
  /** Easing for the per-bar grow reveal (bklit shell default cubic-bezier). */
  animationEasing?: string;
  /** Overrides the reveal timing; springs coerce to tweens. */
  enterTransition?: Readonly<EnterTransition>;
  /** Replay epoch input: bumping it replays the grow reveal with no data change. */
  revealSignature?: string;
  margin?: Readonly<Partial<ChartMargin>>;
  aspectRatio?: string;
  className?: string;
  barGap?: number;
  /** DOC-9 (B13): bklit `barWidth` (bar-chart.tsx:81) — type surface only, no behavior. */
  barWidth?: number;
  /** DOC-9 (B13): bklit `orientation` (bar-chart.tsx:83) — type surface only; pilot renders vertical. */
  orientation?: BarOrientation;
  /** DOC-9 (B13): bklit `stacked` (bar-chart.tsx:85) — type surface only; pilot renders grouped. */
  stacked?: boolean;
  /** DOC-9 (B13): bklit `stackGap` (bar-chart.tsx:87) — type surface only, no behavior. */
  stackGap?: number;
  /** DOC-9 (B13): bklit `squareSnap` (bar-chart.tsx:89) — type surface only, no behavior. */
  squareSnap?: { readonly squareGap: number; readonly groupGap?: number; readonly fit?: boolean };
  onPhaseChange?: (phase: ChartPhase) => void;
  children?: ReactNode;
}

// Inert props accepted for API parity; dev-only warning names the ones passed.
let didWarnInertBarProps = false;

interface InertBarPropsWarningParams {
  readonly barWidth: number | undefined;
  readonly orientation: BarOrientation | undefined;
  readonly stacked: boolean | undefined;
  readonly stackGap: number | undefined;
  readonly squareSnap: { readonly squareGap: number; readonly groupGap?: number; readonly fit?: boolean } | undefined;
}

const collectInertBarProps = ({
  barWidth,
  orientation,
  stacked,
  stackGap,
  squareSnap,
}: Readonly<InertBarPropsWarningParams>): string[] => {
  const inert: string[] = [];
  if (barWidth !== undefined) {inert.push("barWidth");}
  if (orientation !== undefined) {inert.push("orientation");}
  if (stacked !== undefined) {inert.push("stacked");}
  if (stackGap !== undefined) {inert.push("stackGap");}
  if (squareSnap !== undefined) {inert.push("squareSnap");}
  return inert;
};

const warnInertBarProps = ({
  barWidth,
  orientation,
  stacked,
  stackGap,
  squareSnap,
}: Readonly<InertBarPropsWarningParams>): void => {
  if (process.env.NODE_ENV === "production" || didWarnInertBarProps) {return;}
  const inert = collectInertBarProps({ barWidth, orientation, squareSnap, stackGap, stacked });
  if (inert.length === 0) {return;}
  didWarnInertBarProps = true;
  console.warn(
    `[BarChart] accepted-but-inert prop${inert.length > 1 ? "s" : ""}: ${inert.join(", ")}. ` +
      "The migrated bar pilot renders vertical, grouped bars only (DOC-9); these are accepted for API parity but have no effect.",
  );
};

interface ResolvedSeries {
  readonly dataKey: string;
  readonly yAxisId?: string | number;
  readonly fill: string;
  readonly dotColor: string;
  readonly lineCap: BarConfig["lineCap"];
  readonly fadedOpacity: number;
}

interface BarChromeState {
  readonly series: readonly Readonly<{ dataKey: string; color: string }>[];
  readonly tooltip: ChartTooltipConfig | undefined;
  readonly dateLabels: string[];
}

const isString = (candidate: unknown): candidate is string => typeof candidate === "string";
const isNumber = (candidate: unknown): candidate is number => typeof candidate === "number";

const resolveCornerRadius = (
  lineCap: BarConfig["lineCap"] | undefined,
  groupBandwidth: number,
): number => {
  if (isNumber(lineCap)) {return lineCap;}
  if (lineCap === "butt") {return 0;}
  // Bklit parity: round cornerRadius is min(barWidth/2, 8).
  return groupBandwidth > 0 ? Math.min(groupBandwidth / 2, BAR_ROUND_CORNER_RADIUS_MAX_PX) : 0;
};

// Function-typed dotColor has no native per-frame channel; only static branches port.
interface ResolveBarDotColorParams {
  readonly tooltip: ChartTooltipConfig | null | undefined;
  readonly seriesColor: string;
  readonly seriesIndex: number;
  readonly tooltipRowColors: readonly (string | undefined)[] | undefined;
}

const resolveBarDotColor = ({
  tooltip,
  seriesColor,
  seriesIndex,
  tooltipRowColors,
}: Readonly<ResolveBarDotColorParams>): string => {
  const rowColor = tooltipRowColors?.[seriesIndex];
  if (tooltip?.rows && rowColor !== undefined && rowColor !== "") {return rowColor;}
  if (isString(tooltip?.dotColor)) {return tooltip.dotColor;}
  return seriesColor;
};

// TanStack y accessors require numbers but ChartDatum cells are unknown by contract;
// The domain scan only counts finite numbers, so anything else reads as baseline.
const numericBarCell = (datum: Readonly<ChartDatum>, dataKey: string): number => {
  const raw = datum[dataKey];
  return isFiniteNumber(raw) ? raw : 0;
}

const barRingCornerRadius = (halfExtent: number, cornerRadiusFraction: number): number => {
  const side = halfExtent * 2;
  return side * Math.max(0, Math.min(BAR_RING_CORNER_RADIUS_MAX_FRACTION, cornerRadiusFraction));
};

interface HoverDotChannelsParams {
  readonly source: readonly Readonly<ChartDatum>[];
  readonly series: { readonly dataKey: string };
  readonly categoryAccessor: (datum: Readonly<ChartDatum>) => string;
  readonly projectValueForKey: (raw: number) => number;
}

interface HoverDotChannels {
  readonly xValues: (string | undefined)[];
  readonly yValues: (number | undefined)[];
}

const buildHoverDotChannels = ({
  source,
  series,
  categoryAccessor,
  projectValueForKey,
}: Readonly<HoverDotChannelsParams>): HoverDotChannels => {
  const xValues: (string | undefined)[] = [];
  const yValues: (number | undefined)[] = [];
  for (const datum of source) {
    xValues.push(categoryAccessor(datum));
    const raw = datum[series.dataKey];
    yValues.push(isFiniteNumber(raw) ? projectValueForKey(raw) : undefined);
  }
  return { xValues, yValues };
};

const buildHoverDotMotion = (tooltipSpring: Readonly<SpringConfig>): ChartMotionDefinition<ChartDatum> => ({
  // Bklit parity: dots always spring; only fresh mounts snap (free via retarget).
  transition: { damping: tooltipSpring.damping, stiffness: tooltipSpring.stiffness, type: "spring" },
});

interface HoverDotDatumParams {
  readonly datum: Readonly<ChartDatum>;
  readonly datumIndex: number;
  readonly seriesKey: string;
  readonly xValues: readonly (string | undefined)[];
  readonly yValues: readonly (number | undefined)[];
  readonly mapY: (value: number) => number;
  readonly bandStartForCategory: (category: string) => number;
  readonly groupOffsetX: number;
  readonly groupHalfWidth: number;
  readonly fill: string;
  readonly isRing: boolean;
  readonly side: number;
  readonly cornerRadius: number;
  readonly size: number;
  readonly strokeWidth: number;
}

interface HoverDotDatumResult {
  readonly node: SceneNode;
  readonly point: ChartPoint<ChartDatum, string, number>;
}

const buildHoverDotDatum = ({
  datum,
  datumIndex,
  seriesKey,
  xValues,
  yValues,
  mapY,
  bandStartForCategory,
  groupOffsetX,
  groupHalfWidth,
  fill,
  isRing,
  side,
  cornerRadius,
  size,
  strokeWidth,
}: Readonly<HoverDotDatumParams>): HoverDotDatumResult | undefined => {
  const category = xValues[datumIndex];
  const yv = yValues[datumIndex];
  const y = yv === undefined ? Number.NaN : mapY(yv);
  const x = category === undefined ? Number.NaN : bandStartForCategory(category) + groupOffsetX + groupHalfWidth;
  if (category === undefined || yv === undefined || !Number.isFinite(x) || !Number.isFinite(y)) {
    return undefined;
  }
  const point: ChartPoint<ChartDatum, string, number> = {
    color: fill,
    datum,
    datumIndex,
    group: null,
    groupLabel: seriesKey,
    key: `${seriesKey}:${datumIndex}`,
    markId: seriesKey,
    x,
    xValue: category,
    y,
    yValue: yv,
  };
  if (isRing) {
    return {
      node: {
        height: side,
        key: `${seriesKey}:hover-dot:${datumIndex}`,
        kind: "rect",
        pointOwner: point,
        radius: cornerRadius,
        style: { fill: "transparent", stroke: fill, strokeWidth },
        width: side,
        x: x - size,
        y: y - size,
      },
      point,
    };
  }
  return {
    node: {
      key: `${seriesKey}:hover-dot:${datumIndex}`,
      kind: "dot",
      pointOwner: point,
      radius: size,
      style: { fill, stroke: "var(--chart-background)", strokeWidth },
      x,
      y,
    },
    point,
  };
};

// Dot x emits resolved pixels directly: per-series group offset is barY-layout-only, not a dot() channel.
interface BarHoverDotMarkParams {
  readonly source: readonly Readonly<ChartDatum>[];
  readonly series: { readonly dataKey: string };
  readonly categoryAccessor: (datum: Readonly<ChartDatum>) => string;
  readonly projectValueForKey: (raw: number) => number;
  readonly bandStartForCategory: (category: string) => number;
  readonly groupOffsetX: number;
  readonly groupHalfWidth: number;
  readonly fill: string;
  readonly dotMarker: { readonly size: number; readonly strokeWidth: number; readonly isRing: boolean; readonly radiusFraction: number };
  readonly tooltipSpring: Readonly<SpringConfig>;
}

const createBarHoverDotMark = ({
  source,
  series,
  categoryAccessor,
  projectValueForKey,
  bandStartForCategory,
  groupOffsetX,
  groupHalfWidth,
  fill,
  dotMarker,
  tooltipSpring,
}: Readonly<BarHoverDotMarkParams>): ChartMark<ChartDatum, string, number> => {
  const { size, strokeWidth, isRing, radiusFraction } = dotMarker;
  const cornerRadius = barRingCornerRadius(size, radiusFraction);
  const side = size * 2;
  const motion = buildHoverDotMotion(tooltipSpring);
  return {
    initialize: () => {
      const { xValues, yValues } = buildHoverDotChannels({ categoryAccessor, projectValueForKey, series, source });
      return {
        channels: {
          x: { scale: "x", values: xValues },
          y: { scale: "y", values: yValues },
        },
        id: `${series.dataKey}--hover-dot`,
        motion,
        render: ({ scales }) => {
          const nodes: SceneNode[] = [];
          const points: ChartPoint<ChartDatum, string, number>[] = [];
          const mapY = (value: number): number => scales.y.map(value);
          for (const [datumIndex, datum] of source.entries()) {
            const built = buildHoverDotDatum({
              bandStartForCategory,
              cornerRadius,
              datum,
              datumIndex,
              fill,
              groupHalfWidth,
              groupOffsetX,
              isRing,
              mapY,
              seriesKey: series.dataKey,
              side,
              size,
              strokeWidth,
              xValues,
              yValues,
            });
            if (built) {
              nodes.push(built.node);
              points.push(built.point);
            }
          }
          return {
            nodes: [
              {
                // App-owned mark groups use the bkm-chart__ prefix, not ts-chart__.
                ariaHidden: true,
                children: nodes,
                className: "bkm-chart__hover-dot",
                key: `${series.dataKey}--hover-dot`,
                kind: "group",
              },
            ],
            points,
          };
        },
      };
    },
  };
};

/**
 * Bklit categoryAccessor: shortDateFmt for Date, else String.
 *
 * @param {string} xDataKey - Datum field holding the category value; Date values render via shortDateFmt.
 * @returns {(datum: Readonly<ChartDatum>) => string} Accessor returning the category label, or empty string for unrecognized values.
 */
const barCategoryAccessor = (xDataKey: string) => (datum: Readonly<ChartDatum>): string => {
  const value = datum[xDataKey];
  if (value instanceof Date) {return shortDateFmt.format(value);}
  if (isString(value)) {return value;}
  if (isNumber(value)) {return String(value);}
  return "";
};

interface SquareGradientDefSquare {
  readonly dataKey: string;
  readonly fill: string;
  readonly useGradient: boolean;
  readonly patternPreset?: BarSquaresConfig["patternPreset"];
  readonly gradientStops: readonly { readonly offset: number; readonly color: string }[];
}

interface SquareGradientDefParams {
  readonly square: Readonly<SquareGradientDefSquare>;
  readonly index: number;
  readonly baseId: string;
}

interface SquareGradientDef {
  readonly dataKey: string;
  readonly fill: string;
  readonly gradientId: string;
  readonly gradientStops: { offset: number; color: string }[];
  readonly patternId: string | undefined;
  readonly patternPreset: BarSquaresConfig["patternPreset"];
}

const buildSquareGradientDef = ({
  square,
  index,
  baseId,
}: Readonly<SquareGradientDefParams>): SquareGradientDef | undefined => {
  if (!square.useGradient) {return undefined;}
  const gradientId = `${baseId}-bar-squares-gradient-${index}`;
  const isPatternFill = square.fill.startsWith("url(");
  const hasPattern = Boolean(isPatternFill && square.patternPreset && square.patternPreset !== "none");
  const patternId = `${baseId}-bar-squares-pattern-${index}`;
  const stops = square.gradientStops.length >= 2 ? [...square.gradientStops] : [{ color: square.fill, offset: 0 }, { color: square.fill, offset: 100 }];
  return { dataKey: square.dataKey, fill: square.fill, gradientId, gradientStops: stops, patternId: hasPattern ? patternId : undefined, patternPreset: hasPattern ? square.patternPreset : undefined };
};

interface SquarePrimitiveCountParams {
  readonly squares: readonly Readonly<{
    groupGap: number;
    squareFit: boolean;
    squareGap: number;
  }>[];
  readonly rows: number;
  readonly barLengthPx: number;
  readonly bandWidth: number;
  readonly totalSeriesCount: number;
}

const countSquarePrimitives = ({
  squares,
  rows,
  barLengthPx,
  bandWidth,
  totalSeriesCount,
}: Readonly<SquarePrimitiveCountParams>): number => {
  let total = 0;
  for (const square of squares) {
    const squareSize = bandWidthForSquares(bandWidth, totalSeriesCount, square.groupGap);
    const { count } = computeSquareColumn({ barLengthPx, fit: square.squareFit, gap: square.squareGap, squareSize });
    total += rows * count;
  }
  return total;
};

interface ClearDatePillParams {
  readonly pillBuild: PillBuild | null;
  readonly visibilityRef: { current: boolean };
  readonly setLabelFade: Dispatch<SetStateAction<Readonly<{ primaryX: number; hoveredLabel: string | null }> | undefined>>;
}

const clearDatePillForEmptyFocus = ({
  pillBuild,
  visibilityRef,
  setLabelFade,
}: Readonly<ClearDatePillParams>): void => {
  visibilityRef.current = false;
  if (pillBuild) {
    pillBuild.layer.style.display = "none";
    pillBuild.spring.stop();
    pillBuild.label.textContent = "";
  }
  setLabelFade((prev) => (prev === undefined ? prev : undefined));
};

interface DatePillContentParams {
  readonly pillBuild: PillBuild;
  readonly dateLabels: readonly string[] | undefined;
  readonly categoryIndex: number;
  readonly categoryLabel: string;
  readonly anchorX: number;
  readonly discrete: boolean;
  readonly showing: boolean;
}

const updateDatePillContent = ({
  pillBuild,
  dateLabels,
  categoryIndex,
  categoryLabel,
  anchorX,
  discrete,
  showing,
}: Readonly<DatePillContentParams>): void => {
  pillBuild.layer.style.display = "";
  if (pillBuild.ticker && dateLabels && dateLabels.length > 0) {
    pillBuild.ticker.update(categoryIndex, discrete);
  } else {
    pillBuild.label.textContent = categoryLabel;
  }
  if (showing || discrete) {pillBuild.spring.jump(anchorX);}
  else {pillBuild.spring.set(anchorX);}
};

interface BarTooltipPanelParams {
  readonly tooltip: ChartTooltipConfig | undefined;
}

interface BarTooltipPanel {
  readonly panelClassName: string;
  readonly panelStyle: CSSProperties | undefined;
}

const resolveBarTooltipPanel = ({ tooltip: tt }: Readonly<BarTooltipPanelParams>): BarTooltipPanel => {
  const tooltipClassName = tt?.className;
  const panelClassName = tooltipClassName !== undefined && tooltipClassName !== "" ? `bkm-tooltip-panel ${tooltipClassName}` : "bkm-tooltip-panel";
  const tooltipPanelStyle = tt?.panelStyle;
  const tooltipBackgroundColor = tt?.backgroundColor;
  const panelStyle: CSSProperties | undefined =
    tooltipPanelStyle !== undefined || (tooltipBackgroundColor !== undefined && tooltipBackgroundColor !== "")
      ? { ...tooltipPanelStyle, ...(tooltipBackgroundColor !== undefined && tooltipBackgroundColor !== "" ? { backgroundColor: tooltipBackgroundColor } : undefined) }
      : undefined;
  return { panelClassName, panelStyle };
};

interface BarRevealSyncParams {
  readonly svgRoot: SVGSVGElement;
  readonly marksGroup: SVGGElement;
  readonly revealKeyChanged: boolean;
  readonly isReadyPhase: boolean;
}

const syncBarPulseIfRevealed = ({
  svgRoot,
  marksGroup,
  revealKeyChanged,
  isReadyPhase,
}: Readonly<BarRevealSyncParams>): boolean => {
  if (isRevealed(marksGroup) && !revealKeyChanged) {
    syncBarPulseGroups(svgRoot, isReadyPhase);
    return true;
  }
  return false;
};

interface BeginBarRevealParams {
  readonly svgRoot: SVGSVGElement;
  readonly marksGroup: SVGGElement;
  readonly renderDataLength: number;
  readonly revealDurationMs: number;
  readonly revealedForDataRef: { current: unknown };
  readonly latestRenderData: unknown;
  readonly revealKeyRef: { current: string | null };
  readonly currentRevealKey: string;
  readonly revealDeadlineTimerRef: { current: number | null };
  readonly setPhase: (phase: ChartPhase) => void;
}

interface MarkBarRevealedParams {
  readonly marksGroup: SVGGElement;
  readonly revealedForDataRef: { current: unknown };
  readonly latestRenderData: unknown;
  readonly revealKeyRef: { current: string | null };
  readonly currentRevealKey: string;
  readonly setPhase: (phase: ChartPhase) => void;
}

const markBarRevealed = ({
  marksGroup,
  revealedForDataRef,
  latestRenderData,
  revealKeyRef,
  currentRevealKey,
  setPhase,
}: Readonly<MarkBarRevealedParams>): void => {
  revealedForDataRef.current = latestRenderData;
  revealKeyRef.current = currentRevealKey;
  markRevealed(marksGroup);
  setPhase("revealing");
};

interface ArmBarRevealDeadlineParams {
  readonly svgRoot: SVGSVGElement;
  readonly renderDataLength: number;
  readonly revealDurationMs: number;
  readonly revealDeadlineTimerRef: { current: number | null };
  readonly setPhase: (phase: ChartPhase) => void;
}

const armBarRevealDeadline = ({
  svgRoot,
  renderDataLength,
  revealDurationMs,
  revealDeadlineTimerRef,
  setPhase,
}: Readonly<ArmBarRevealDeadlineParams>): void => {
  const staggerSpreadMs = revealDurationMs * BAR_ENTER_STAGGER_SPREAD_FRACTION;
  const staggerMs = renderDataLength > 1 ? staggerSpreadMs : 0;
  const deadlineMs = revealDurationMs + staggerMs;
  revealDeadlineTimerRef.current = setRevealDeadline(deadlineMs, {
    onDeadline: () => {
      setPhase("ready");
      syncBarPulseGroups(svgRoot, true);
    },
  });
};

const beginBarReveal = ({
  svgRoot,
  marksGroup,
  renderDataLength,
  revealDurationMs,
  revealedForDataRef,
  latestRenderData,
  revealKeyRef,
  currentRevealKey,
  revealDeadlineTimerRef,
  setPhase,
}: Readonly<BeginBarRevealParams>): void => {
  markBarRevealed({ currentRevealKey, latestRenderData, marksGroup, revealKeyRef, revealedForDataRef, setPhase });
  armBarRevealDeadline({ renderDataLength, revealDeadlineTimerRef, revealDurationMs, setPhase, svgRoot });
};

const BarChart = ({
  data,
  xDataKey = "name",
  animationDuration = DEFAULT_ANIMATION_DURATION_MS,
  animationEasing = DEFAULT_ANIMATION_EASING,
  enterTransition,
  revealSignature = "",
  margin: marginProp,
  aspectRatio = "2 / 1",
  className,
  barGap = 0.2,
  barWidth,
  orientation,
  stacked,
  stackGap,
  squareSnap,
  onPhaseChange,
  children,
}: Readonly<BarChartProps>): ReactElement => {
  warnInertBarProps({ barWidth, orientation, squareSnap, stackGap, stacked });
  const margin = useChartMargin(marginProp, DEFAULT_CHART_MARGIN);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const width = useContainerWidth(containerRef);
  // Bklit parity: the first phase is always "revealing"; bypass the ref guard once.
  const phaseRef = useRef<ChartPhase>("revealing");
  const revealDeadlineTimerRef = useRef<number | null>(null);
  const onPhaseChangeRef = useRef(onPhaseChange);
  onPhaseChangeRef.current = onPhaseChange;

  const setPhase = useCallback((phase: ChartPhase) => {
    if (phaseRef.current === phase) {return;}
    phaseRef.current = phase;
    onPhaseChangeRef.current?.(phase);
  }, []);

  useEffect(() => {
    onPhaseChangeRef.current?.("revealing");
  }, []);

  // Cancel the reveal-deadline timer on unmount; an uncancelled one fires on detached DOM.
  useEffect(() =>
    (): void => {
      if (revealDeadlineTimerRef.current !== null) {
        globalThis.clearTimeout(revealDeadlineTimerRef.current);
        revealDeadlineTimerRef.current = null;
      }
    }
  , []);

  const { bars, barSquares: barSquaresRaw, barColumnTracks: barColumnTracksRaw, barDepthBacks: barDepthBacksRaw, barDepthFronts: barDepthFrontsRaw, barPulses: barPulsesRaw, barDepthProvider, grid, barXAxis, background, tooltip } = useMemo(
    () => extractChildren(children),
    [children],
  );
  const { hoveredIndex: legendHoveredIndex } = useChartLegendHover();
  const { captureRenderContext } = useFocusInjection<ChartDatum, string, number>();
  const tooltipEnabled = tooltip?.enabled ?? false;

  // Bklit parity: no decimation — every row renders a bar.
  const renderData = data;
  // Reveal replays on data change only; legend-hover recreations must not replay.
  const latestRenderDataRef = useRef(renderData);
  latestRenderDataRef.current = renderData;
  const revealedForDataRef = useRef<unknown>(null);
  // Reveal replays on data change or revealSignature/animationDuration change (bklit epoch).
  const enterType = enterTransition?.type;
  const enterDuration = enterTransition?.duration;
  const enterEaseKey = enterTransition?.ease?.join(",");
  const { durationMs: revealDurationMs, easingCss: revealEasingCss } = useMemo(
    () => clipRevealTiming(enterTransition, animationDuration, animationEasing),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enterType, enterDuration, enterEaseKey, animationDuration, animationEasing],
  );
  const revealKey = `${revealSignature}|${animationDuration}`;
  const revealedKeyRef = useRef<string | null>(null);
  const revealKeyRef = useRef(revealKey);
  revealKeyRef.current = revealKey;

  // Explicit per-mark enter motion: native auto-stagger is fixed at 1100ms, not prop-derived.
  // Update/exit stay false — legacy never animated those.
  const barEnterMotion = useMemo<ChartMotionDefinition<ChartDatum>>(() => {
    const easing = resolveMotionEasing(revealEasingCss);
    return (context: Readonly<{ phase: ChartMotionPhase; datumCount: number; datumIndex: number }>): false | ChartMotionTiming | undefined => {
      if (context.phase !== "enter") {return false;}
      const count = Math.max(1, context.datumCount);
      return {
        delay: (revealDurationMs * BAR_ENTER_STAGGER_SPREAD_FRACTION * context.datumIndex) / count,
        transition: { duration: revealDurationMs, easing, type: "tween" },
      };
    };
  }, [revealDurationMs, revealEasingCss]);

  const categoryAccessor = useMemo(() => barCategoryAccessor(xDataKey), [xDataKey]);

  const resolvedSeries = useMemo<ResolvedSeries[]>(
    () =>
      bars.map((bar: Readonly<BarConfig>) => {
        const fill = bar.fill ?? DEFAULT_BAR_FILL;
        return {
          dataKey: bar.dataKey,
          dotColor: bar.stroke ?? fill,
          fadedOpacity: bar.fadedOpacity ?? BAR_FADED_OPACITY,
          fill,
          lineCap: bar.lineCap ?? "round",
          yAxisId: bar.yAxisId,
        };
      }),
    [bars],
  );

  const hasBarSquares = barSquaresRaw.length > 0;
  const hasBarColumnTrack = barColumnTracksRaw.length > 0;

  const resolvedBarSquares = useMemo<readonly Readonly<(Required<Pick<BarSquaresConfig, "dataKey">> & Omit<BarSquaresConfig, "dataKey"> & { fill: string; squareGap: number; squareRadius: number; squareFit: boolean; useGradient: boolean; gradientStops: { offset: number; color: string }[]; fadedOpacity: number; groupGap: number; animate: boolean })>[] >(() => {
    if (!hasBarSquares) {return [];}
    return barSquaresRaw.map((square: Readonly<BarSquaresConfig>) => ({
      animate: square.animate ?? true,
      dataKey: square.dataKey,
      fadedOpacity: square.fadedOpacity ?? BAR_FADED_OPACITY,
      fill: square.fill ?? DEFAULT_BAR_FILL,
      gradientStops: square.gradientStops ?? [],
      groupGap: square.groupGap ?? GROUP_GAP,
      patternPreset: square.patternPreset,
      squareFit: square.squareFit ?? false,
      squareGap: square.squareGap ?? DEFAULT_SQUARE_GAP,
      squareRadius: square.squareRadius ?? DEFAULT_SQUARE_RADIUS,
      staggerDelay: square.staggerDelay,
      stroke: square.stroke,
      useGradient: square.useGradient ?? false,
      yAxisId: square.yAxisId,
    }));
  }, [barSquaresRaw, hasBarSquares]);

  const resolvedBarColumnTracks = useMemo<readonly Readonly<(Required<Pick<BarColumnTrackConfig, "fill">> & BarColumnTrackConfig & { opacity: number; squareGap: number; squareRadius: number; groupGap: number; squareFit: boolean })>[] >(() => {
    if (!hasBarColumnTrack) {return [];}
    return barColumnTracksRaw.map((track: Readonly<BarColumnTrackConfig>) => ({
      fill: track.fill ?? "var(--chart-grid)",
      groupGap: track.groupGap ?? GROUP_GAP,
      opacity: track.opacity ?? BAR_FADED_OPACITY,
      squareFit: track.squareFit ?? false,
      squareGap: track.squareGap ?? DEFAULT_SQUARE_GAP,
      squareRadius: track.squareRadius ?? DEFAULT_SQUARE_RADIUS,
      staggerDelay: track.staggerDelay,
    }));
  }, [barColumnTracksRaw, hasBarColumnTrack]);

  const allSeriesForDomain = useMemo(
    () => [
      ...resolvedSeries.map((series) => ({ dataKey: series.dataKey, yAxisId: series.yAxisId })),
      ...resolvedBarSquares.map((square) => ({ dataKey: square.dataKey, yAxisId: square.yAxisId })),
    ],
    [resolvedSeries, resolvedBarSquares],
  );

  const dotSeriesList = useMemo(
    () => [
      ...resolvedSeries.map((series) => ({ color: series.dotColor, dataKey: series.dataKey })),
      ...resolvedBarSquares.map((square) => ({ color: square.stroke ?? square.fill, dataKey: square.dataKey })),
    ],
    [resolvedSeries, resolvedBarSquares],
  );

  const innerWidth = Math.max(0, width - margin.left - margin.right);

  const categoryOrder = useMemo(
    () => renderData.map((datum: Readonly<ChartDatum>) => categoryAccessor(datum)),
    [renderData, categoryAccessor],
  );

  // X/y are factories: TanStack infers domains and applies the margin-inclusive range itself.
  const xScaleFactory = useMemo(
    () => (): ScaleBand<string> => scaleBand().domain(categoryOrder).padding(barGap),
    [categoryOrder, barGap],
  );

  // Bklit parity: [0, (max || 100) * 1.1], empty input falls back to 100.
  const resolveBarAxisDomain = useCallback(
    (axisSeries: readonly { readonly dataKey: string }[]): [number, number] => {
      let max = 0;
      for (const series of axisSeries) {
        for (const datum of renderData) {
          const value = datum[series.dataKey];
          if (isFiniteNumber(value) && value > max) {max = value;}
        }
      }
      return [0, (max || BAR_DOMAIN_EMPTY_FALLBACK_MAX) * BAR_DOMAIN_HEADROOM_FACTOR];
    },
    [renderData],
  );

  const yDomainsByAxis = useMemo(
    () =>
      resolveYDomainsByAxis({
        resolveDomain: resolveBarAxisDomain,
        series: allSeriesForDomain,
      }),
    [allSeriesForDomain, resolveBarAxisDomain],
  );

  // No-series fallback stays [0, 110] via the same closure, not domainForAxis's [0, 100].
  const yDomain = useMemo<[number, number]>(
    () => yDomainsByAxis[DEFAULT_Y_AXIS_ID] ?? resolveBarAxisDomain([]),
    [yDomainsByAxis, resolveBarAxisDomain],
  );
  // Pre-domained y instance preserves the *1.1 headroom; a factory would re-infer it away.
  const yScale = useMemo(() => createNicedYScale(yDomain), [yDomain]);
  // D3 domain() returns number[]; destructure with defaults to recover the known pair.
  const nicedPrimaryDomain = useMemo<[number, number]>(() => {
    const [lo = 0, hi = 0] = yScale.domain();
    return [lo, hi];
  }, [yScale]);

  // Secondary axes reproject per dataKey so all four mark families agree on each series.
  const nicedDomainsByAxis = useMemo(() => {
    const out: Record<string, [number, number]> = {};
    for (const [axisId, domain] of Object.entries(yDomainsByAxis)) {
      const [nicedLo = 0, nicedHi = 0] = createNicedYScale(domain).domain();
      const niced: [number, number] = [nicedLo, nicedHi];
      out[axisId] = niced;
    }
    return out;
  }, [yDomainsByAxis]);

  const projectYByKey = useMemo(() => {
    const projectorFor = createAxisValueProjector(
      nicedDomainsByAxis,
      nicedPrimaryDomain,
    );
    const byKey = new Map<string, (value: number) => number>();
    for (const series of allSeriesForDomain) {
      byKey.set(series.dataKey, projectorFor(series.yAxisId));
    }
    return byKey;
  }, [nicedDomainsByAxis, nicedPrimaryDomain, allSeriesForDomain]);

  const projectValue = useCallback(
    (dataKey: string, value: number) => {
      const project = projectYByKey.get(dataKey);
      return project ? project(value) : value;
    },
    [projectYByKey],
  );

  const bandWidth = useMemo(() => {
    if (innerWidth <= 0 || categoryOrder.length === 0) {return 0;}
    const ranged = scaleBand()
      .domain(categoryOrder)
      .range([margin.left, margin.left + innerWidth])
      .padding(barGap);
    return ranged.bandwidth();
  }, [categoryOrder, barGap, innerWidth, margin.left]);

  const seriesCount = resolvedSeries.length;
  const totalSeriesCount = resolvedSeries.length + resolvedBarSquares.length;
  const allSeriesKeys = useMemo(() => [...resolvedSeries.map((series) => series.dataKey), ...resolvedBarSquares.map((square) => square.dataKey)], [resolvedSeries, resolvedBarSquares]);
  // Bklit parity: individualBarWidth = (bandWidth - gap*(n-1))/n; squares join the count.
  const groupBandwidth = useMemo(() => {
    const groupCount = totalSeriesCount > 0 ? totalSeriesCount : seriesCount;
    if (groupCount === 0) {return bandWidth;}
    const effectiveGroupGap = groupCount > 1 ? GROUP_GAP : 0;
    return (bandWidth - effectiveGroupGap * (groupCount - 1)) / groupCount;
  }, [bandWidth, seriesCount, totalSeriesCount]);

  // PaddingInner is derived so bandwidth() equals bklit's individualBarWidth exactly.
  const groupScale = useMemo<ScaleBand<string>>(() => {
    const groupCount = totalSeriesCount > 0 ? totalSeriesCount : seriesCount;
    const paddingInner = groupCount > 1 ? (groupCount * GROUP_GAP) / (bandWidth + GROUP_GAP) : 0;
    const domain = groupCount === totalSeriesCount && totalSeriesCount > 0 ? allSeriesKeys : resolvedSeries.map((series) => series.dataKey);
    return scaleBand()
      .domain(domain)
      .paddingInner(paddingInner)
      .paddingOuter(0);
  }, [resolvedSeries, seriesCount, totalSeriesCount, bandWidth, allSeriesKeys]);

  const categoryScaleForOverlay = useMemo<ScaleBand<string>>(() => 
    scaleBand()
      .domain(categoryOrder)
      .range([margin.left, margin.left + innerWidth])
      .padding(barGap)
  , [categoryOrder, margin.left, innerWidth, barGap]);

  const groupScaleForOverlay = useMemo<ScaleBand<string>>(() => 
    scaleBand()
      .domain(groupScale.domain())
      .paddingInner(groupScale.paddingInner())
      .paddingOuter(groupScale.paddingOuter())
      .range([0, bandWidth])
  , [groupScale, bandWidth]);

  // Bklit-parity band-index focus (floor((x-margin.left)/innerWidth*n)), not nearest-center.
  const getCategoryOrder = useCallback(() => categoryOrder, [categoryOrder]);
  const getInnerWidth = useCallback(() => innerWidth, [innerWidth]);
  const barFocusStrategy = useMemo(
    () =>
      createBarFocusStrategy({
        getCategoryOrder,
        getInnerWidth,
        marginLeft: margin.left,
        phaseRef,
      }),
    [getCategoryOrder, getInnerWidth, margin.left],
  );

  const isHorizontalOrStacked = false;
  const barSquaresEnabled = hasBarSquares && totalSeriesCount > 0;
  const barColumnTrackEnabled = hasBarColumnTrack && totalSeriesCount > 0;
  const hasBarDepth = barDepthBacksRaw.length > 0 || barDepthFrontsRaw.length > 0 || barPulsesRaw.length > 0;
  const barDepthEnabled = hasBarDepth && !isHorizontalOrStacked;

  // UserSpaceOnUse required: the crosshair is a zero-bbox line with nothing to map onto.
  const indicatorGradientId = useSanitizedId();
  const squaresBaseId = useSanitizedId();
  const squaresDefs = useMemo<readonly Readonly<{ dataKey: string; gradientId: string; patternId: string | undefined; fill: string; gradientStops: readonly Readonly<{ offset: number; color: string }>[]; patternPreset?: PatternPresetId }>[]>(() => {
    if (!barSquaresEnabled) {return [];}
    const out: { dataKey: string; gradientId: string; patternId: string | undefined; fill: string; gradientStops: { offset: number; color: string }[]; patternPreset?: PatternPresetId }[] = [];
    for (let i = 0; i < resolvedBarSquares.length; i += 1) {
      const def = buildSquareGradientDef({ baseId: squaresBaseId, index: i, square: resolvedBarSquares[i] });
      if (def) {
        out.push(def);
      }
    }
    return out;
  }, [barSquaresEnabled, resolvedBarSquares, squaresBaseId]);
  const squaresDefsByKey = useMemo(() => {
    const defsByKey = new Map<string, typeof squaresDefs[number]>();
    for (const def of squaresDefs) {defsByKey.set(def.dataKey, def);}
    return defsByKey;
  }, [squaresDefs]);

  // One shared def: objectBoundingBox makes a single gradient correct for every bar height.
  const depthBaseId = useSanitizedId();
  const depthGroundShadow = barDepthProvider?.groundShadow ?? DEFAULT_BAR_DEPTH_GROUND_SHADOW;
  const depthGradientIds = useMemo<BarDepthGradientIds>(
    () => ({
      glassNegId: `${depthBaseId}-bar-depth-glass-neg`,
      glassPosId: `${depthBaseId}-bar-depth-glass-pos`,
      sideShadeLtrId: `${depthBaseId}-bar-depth-side-ltr`,
      sideShadeRtlId: `${depthBaseId}-bar-depth-side-rtl`,
      topShadeId: `${depthBaseId}-bar-depth-top-shade`,
    }),
    [depthBaseId],
  );
  const depthGlassPosStops = useMemo(() => buildPosBarStops(depthGroundShadow), [depthGroundShadow]);
  const depthGlassNegStops = useMemo(() => buildNegBarStops(depthGroundShadow), [depthGroundShadow]);
  const pulseWaveGradientId = `${depthBaseId}-bar-pulse-wave-grad`;
  const pulseWaveStops = useMemo(() => buildPulseWaveStops(), []);

  const nativeDepthGradients = useMemo(
    () => [
      {
        id: depthGradientIds.glassPosId,
        stops: depthGlassPosStops.map((stop: Readonly<GlassGradientStop>) => ({
          color: stop.color,
          offset: Number.parseFloat(stop.offset) / GRADIENT_STOP_PERCENT_DIVISOR,
          opacity: Number(stop.opacity),
        })),
        x1: 0,
        x2: 0,
        y1: 0,
        y2: 1,
      },
      {
        id: depthGradientIds.glassNegId,
        stops: depthGlassNegStops.map((stop: Readonly<GlassGradientStop>) => ({
          color: stop.color,
          offset: Number.parseFloat(stop.offset) / GRADIENT_STOP_PERCENT_DIVISOR,
          opacity: Number(stop.opacity),
        })),
        x1: 0,
        x2: 0,
        y1: 0,
        y2: 1,
      },
      {
        id: depthGradientIds.sideShadeRtlId,
        stops: [
          { color: "black", offset: 0, opacity: 0.05 },
          { color: "black", offset: 1, opacity: 0.55 },
        ],
        x1: 1,
        x2: 0,
        y1: 0,
        y2: 1,
      },
      {
        id: depthGradientIds.sideShadeLtrId,
        stops: [
          { color: "black", offset: 0, opacity: 0.05 },
          { color: "black", offset: 1, opacity: 0.55 },
        ],
        x1: 0,
        x2: 1,
        y1: 0,
        y2: 1,
      },
      {
        id: depthGradientIds.topShadeId,
        stops: [
          { color: "black", offset: 0, opacity: 0 },
          { color: "black", offset: 1, opacity: 0.18 },
        ],
        x1: 0,
        x2: 0,
        y1: 1,
        y2: 0,
      },
      {
        id: pulseWaveGradientId,
        stops: pulseWaveStops.map((stop: Readonly<PulseWaveGradientStop>) => ({
          color: stop.color,
          offset: Number.parseFloat(stop.offset) / GRADIENT_STOP_PERCENT_DIVISOR,
          opacity: Number(stop.opacity),
        })),
        x1: 0,
        x2: 0,
        y1: 1,
        y2: 0,
      },
    ],
    [depthGradientIds, depthGlassPosStops, depthGlassNegStops, pulseWaveStops, pulseWaveGradientId],
  );

  const chartConfig = useChartConfig();

  const [labelFade, setLabelFade] = useState<Readonly<{ primaryX: number; hoveredLabel: string | null }> | undefined>();

  const definition = useMemo((): DomChartDefinition<ChartDatum, string, number> | undefined => {
    if (width <= 0 || (resolvedSeries.length === 0 && resolvedBarSquares.length === 0)) {return undefined;}
    const gridGuide = resolveGridGuide(grid);
    const hasSquares = barSquaresEnabled;
    const hasTrack = barColumnTrackEnabled;
    const hasDepth = barDepthEnabled;

    // Values/count are mutually exclusive on tick options (passing both throws).
    const xAxisOptions = barXAxis
      ? {
          line: false as const,
          tickLabels: {
            dy: margin.bottom - BAR_TICK_LABEL_DY_OFFSET_PX,
            fontSize: 12,
            // Label position tween returns via tickLabels.motion (native text has no CSS left/top).
            motion: (ctx: Readonly<{ phase: ChartMotionPhase; datumCount: number; datumIndex: number }>): false | ChartMotionTiming | undefined =>
              ctx.phase === "enter" ? false : { transition: { duration: 500, easing: bezierEasing, type: "tween" as const } },
            opacity: labelFade
              ? (ctx: { readonly position: number; readonly value: unknown }): number =>
                  tickLabelFadeOpacity(
                    ctx.position,
                    String(ctx.value),
                    labelFade.primaryX,
                    labelFade.hoveredLabel,
                    barXAxis.tickerHalfWidth ?? TICKER_HALF_WIDTH,
                    FADE_BUFFER,
                  )
              : 1,
            thin: false,
          },
          ticks: {
            format: String,
            padding: 0,
            size: 0,
            values: selectBarLabelIndices(
              categoryOrder.length,
              barXAxis.showAllLabels ?? false,
              barXAxis.maxLabels ?? BAR_MAX_TICK_LABELS_DEFAULT,
            ).map((i) => categoryOrder[i]),
          },
        }
      : {
          line: false as const,
          tickLabels: false as const,
          ticks: { count: gridGuide.columnTicks, size: 0 },
        };
    // Bar never drew y-axis labels; nothing may paint once the axes CSS gate lifts.
    const yAxisOptions = hiddenAxisOptions(gridGuide.ticks);
    const tooltipOption = buildNativeTooltipExtension<ChartDatum, string, number>({
      anchorX: "group-center",
      className: "bkm-native-tooltip",
      discrete: renderData.length > DISCRETE_INTERACTION_THRESHOLD,
      enabled: tooltipEnabled,
      offset: BOX_OFFSET,
      spring: TOOLTIP_BOX_SPRING,
    });

    // Dense data snaps instead of springing (bklit threshold, strict >).
    const discrete = renderData.length > DISCRETE_INTERACTION_THRESHOLD;

    const hoverMarks: ChartMark<ChartDatum, string, number>[] = [];
    if (tooltipEnabled) {
      if (tooltip?.showCrosshair ?? true) {
        // Bklit parity quirk: function indicatorColor is never invoked (string form only).
        const indicatorCfg = toIndicatorConfig(tooltip);
        const isDashed = Boolean(indicatorCfg.dasharray);
        const fadeSides = resolveVerticalFadeSides(isDashed ? "none" : (indicatorCfg.fadeEdges ?? "both"));
        const indicatorColorValue = isString(indicatorCfg.color) ? indicatorCfg.color : "var(--chart-crosshair)";
        const indicatorSpringCfg = indicatorCfg.springConfig ?? chartConfig.tooltipSpring;
        // Native crosshair defaults strokeOpacity to 0.35; override to 1.
        hoverMarks.push(
          buildIndicatorMark({
            color: indicatorColorValue,
            columnWidth: indicatorCfg.columnWidth,
            dasharray: indicatorCfg.dasharray,
            discrete,
            gradientId: indicatorGradientId,
            span: indicatorCfg.span,
            spring: indicatorSpringCfg,
            strokeOpacity: 1,
            useGradient: !isDashed && fadeSides.any,
            width: indicatorCfg.width,
          }),
        );
      }
      if (tooltip?.showDots ?? true) {
        // Bklit parity: ring-dot sizing is inert (bandWidth was never populated).
        const dotCfg = toDotConfig(tooltip);
        const variant = dotCfg.variant ?? "dot";
        const isRing = variant === "ring";
        const rawSize = dotCfg.size ?? DEFAULT_HOVER_DOT_SIZE;
        const size = rawSize * (dotCfg.scale ?? 1);
        const strokeWidth = dotCfg.strokeWidth ?? (isRing ? DEFAULT_HOVER_DOT_RING_STROKE_WIDTH : 2);
        const radiusFraction = dotCfg.radiusFraction ?? DEFAULT_HOVER_DOT_RADIUS_FRACTION;
        const tooltipRowColors = tooltip?.rows?.({}).map((row: Readonly<TooltipRow>) => row.color);
        const groupHalfWidth = groupScaleForOverlay.bandwidth() / 2;
        for (const [seriesIndex, series] of dotSeriesList.entries()) {
          const groupOffsetX = groupScaleForOverlay(series.dataKey) ?? 0;
          const fill = resolveBarDotColor({ seriesColor: series.color, seriesIndex, tooltip, tooltipRowColors });
          hoverMarks.push(
            whenFocused(
              createBarHoverDotMark({
                bandStartForCategory: (category) => categoryScaleForOverlay(category) ?? 0,
                categoryAccessor,
                dotMarker: { isRing, radiusFraction, size, strokeWidth },
                fill,
                groupHalfWidth,
                groupOffsetX,
                projectValueForKey: (raw) => projectValue(series.dataKey, raw),
                series,
                source: renderData,
                tooltipSpring: chartConfig.tooltipSpring,
              }),
              { match: "group", retarget: true },
            ),
          );
        }
      }
    }

    // Bklit parity: legend dim is per-mark opacity, not programmatic focus (single-owner slot).
    const legendHoveredKey = legendHoveredIndex === null ? undefined : (allSeriesKeys[legendHoveredIndex] ?? undefined);
    const legendDimOpacity = (dataKey: string, fadedOpacity: number): number | undefined =>
      legendHoveredKey !== undefined && legendHoveredKey !== dataKey ? fadedOpacity : undefined;
    const depthLegendOpacity = legendHoveredIndex === null ? undefined : BAR_FADED_OPACITY;
    if (!hasSquares && !hasTrack && !hasDepth) {
      const marks: ChartMark<ChartDatum, string, number>[] = [];
      for (const series of resolvedSeries) {
        marks.push(
          barY(renderData, {
            fill: series.fill,
            fillOpacity: legendDimOpacity(series.dataKey, series.fadedOpacity),
            id: series.dataKey,
            layout: group({ scale: groupScale }),
            motion: barEnterMotion,
            radius: resolveCornerRadius(series.lineCap, groupBandwidth),
            states: barRowDimStates(series.fadedOpacity, BAR_DIM_TRANSITION),
            x: (datum: Readonly<ChartDatum>) => categoryAccessor(datum),
            y: (datum: Readonly<ChartDatum>) => projectValue(series.dataKey, numericBarCell(datum, series.dataKey)),
            z: () => series.dataKey,
          }),
        );
      }
      marks.push(...hoverMarks);
      const spec = {
        margin,
        marks,
        // Tick counts reach guides only via axis.ticks.count; a bare ticks: key is never read.
        scales: {
          x: { axis: xAxisOptions, grid: gridGuide.vertical, scale: xScaleFactory },
          y: {
            axis: yAxisOptions,
            grid: gridGuide.horizontal,
            scale: yScale,
          },
        },
        svgAnimation: false as const,
        theme: { muted: "var(--color-chart-label, var(--chart-label))" },
      } as const;
      const base = defineChart(spec);
      return defineChart(base, { focus: barFocusStrategy, focusRing: false, maxFocusDistance: Number.POSITIVE_INFINITY, tooltip: tooltipOption });
    }
    const marks: ChartMark<ChartDatum, string, number>[] = [];
    const bandPosFn = (label: string): number => categoryScaleForOverlay(label) ?? 0;
    const totalN = totalSeriesCount;
    // Column track paints beneath bars/squares (underlay order).
    if (hasTrack) {
      for (let trackIndex = 0; trackIndex < resolvedBarColumnTracks.length; trackIndex += 1) {
        const track = resolvedBarColumnTracks[trackIndex];
        for (let seriesIndex = 0; seriesIndex < allSeriesKeys.length; seriesIndex += 1) {
          const dataKey = allSeriesKeys[seriesIndex];
          const trackId = `bar-column-track-${trackIndex}-${seriesIndex}`;
          marks.push(
            barColumnTrackMark(renderData, {
              bandPos: bandPosFn,
              bandWidth,
              categoryAccessor,
              data: renderData,
              fill: track.fill,
              groupGap: track.groupGap,
              id: trackId,
              opacity: track.opacity,
              seriesCount: totalN,
              seriesIndex,
              squareFit: track.squareFit,
              squareGap: track.squareGap,
              squareRadius: track.squareRadius,
              states: BAR_TRACK_DIM_STATES,
              yAccessor: (datum: Readonly<ChartDatum>) => projectValue(dataKey, numericBarCell(datum, dataKey)),
            }),
          );
        }
      }
    }
    if (hasSquares) {
      for (let squaresIndex = 0; squaresIndex < resolvedBarSquares.length; squaresIndex += 1) {
        const square = resolvedBarSquares[squaresIndex];
        const seriesIndex = allSeriesKeys.indexOf(square.dataKey);
        const def = squaresDefsByKey.get(square.dataKey);
        const gradientId = def?.gradientId ?? `${squaresBaseId}-bar-squares-gradient-${squaresIndex}`;
        const patternId = def?.patternId ?? `${squaresBaseId}-bar-squares-pattern-${squaresIndex}`;
        marks.push(
          barSquaresMark(renderData, {
            bandPos: bandPosFn,
            bandWidth,
            categoryAccessor,
            data: renderData,
            fill: def ? def.fill : square.fill,
            gradientId,
            gradientStops: square.gradientStops,
            groupGap: square.groupGap,
            id: square.dataKey,
            opacity: legendDimOpacity(square.dataKey, square.fadedOpacity),
            patternId,
            patternPreset: square.patternPreset,
            seriesCount: totalN,
            seriesIndex: seriesIndex === -1 ? squaresIndex : seriesIndex,
            squareFit: square.squareFit,
            squareGap: square.squareGap,
            squareRadius: square.squareRadius,
            states: barRowDimStates(square.fadedOpacity, BAR_SQUARES_DIM_TRANSITION),
            useGradient: square.useGradient,
            yAccessor: (datum: Readonly<ChartDatum>) => projectValue(square.dataKey, numericBarCell(datum, square.dataKey)),
          }),
        );
      }
    }
    if (hasDepth) {
      const seriesByDataKey = new Map(resolvedSeries.map((series) => [series.dataKey, series] as const));
      for (const back of barDepthBacksRaw) {
        const series = seriesByDataKey.get(back.dataKey);
        if (series) {
          marks.push(
            barDepthBackMark(renderData, {
              bandPos: bandPosFn,
              bandScale: categoryScaleForOverlay,
              bandWidth,
              categoryAccessor,
              data: renderData,
              fill: back.color ?? series.fill,
              gradientIds: depthGradientIds,
              id: `bar-depth-back-${back.dataKey}`,
              opacity: depthLegendOpacity,
              states: barDepthDimStates(),
              yAccessor: (datum: Readonly<ChartDatum>) => projectValue(back.dataKey, numericBarCell(datum, back.dataKey)),
            }),
          );
        }
      }
    }
    const squaresKeys = new Set(resolvedBarSquares.map((square) => square.dataKey));
    const depthKeys = hasDepth ? new Set([...barDepthBacksRaw.map((back: Readonly<BarDepthBackConfig>) => back.dataKey), ...barDepthFrontsRaw.map((front: Readonly<BarDepthFrontConfig>) => front.dataKey)]) : new Set<string>();
    const needsTrim = (dataKey: string): boolean => hasDepth && depthKeys.has(dataKey);
    for (const series of resolvedSeries) {
      if (squaresKeys.has(series.dataKey)) {
        // Squares-owned series render through the squares mark above; skipped here.
      } else if (needsTrim(series.dataKey)) {
        const innerW = Math.max(0, width - margin.left - margin.right);
        marks.push(
          barTrimmedMark(renderData, {
            bandScale: categoryScaleForOverlay,
            bandWidth,
            categoryAccessor,
            centerX: margin.left + innerW / 2,
            chartX: margin.left,
            data: renderData,
            fill: series.fill,
            groupBandwidth,
            groupScale,
            id: series.dataKey,
            innerWidth: innerW,
            maxDepth: 0,
            // Bklit parity: perspective bars force cornerRadius 0 (flat-top lid meets face gap-free).
            opacity: legendDimOpacity(series.dataKey, series.fadedOpacity),
            radius: 0,
            states: barRowDimStates(series.fadedOpacity, BAR_DIM_TRANSITION),
            yAccessor: (datum: Readonly<ChartDatum>) => projectValue(series.dataKey, numericBarCell(datum, series.dataKey)),
          }),
        );
      } else {
        marks.push(
          barY(renderData, {
            fill: series.fill,
            fillOpacity: legendDimOpacity(series.dataKey, series.fadedOpacity),
            id: series.dataKey,
            layout: group({ scale: groupScale }),
            motion: barEnterMotion,
            radius: resolveCornerRadius(series.lineCap, groupBandwidth),
            states: barRowDimStates(series.fadedOpacity, BAR_DIM_TRANSITION),
            x: (datum: Readonly<ChartDatum>) => categoryAccessor(datum),
            y: (datum: Readonly<ChartDatum>) => projectValue(series.dataKey, numericBarCell(datum, series.dataKey)),
            z: () => series.dataKey,
          }),
        );
      }
    }
    if (hasDepth) {
      for (const front of barDepthFrontsRaw) {
        marks.push(
          barDepthFrontMark(renderData, {
            bandPos: bandPosFn,
            bandScale: categoryScaleForOverlay,
            bandWidth,
            categoryAccessor,
            data: renderData,
            gradientIds: depthGradientIds,
            id: `bar-depth-front-${front.dataKey}`,
            opacity: depthLegendOpacity,
            states: barDepthDimStates(),
            yAccessor: (datum: Readonly<ChartDatum>) => projectValue(front.dataKey, numericBarCell(datum, front.dataKey)),
          }),
        );
      }
      for (const pulse of barPulsesRaw) {
        const pulseMark = barPulseMark(renderData, {
          activeIndex: pulse.activeIndex,
          bandPos: bandPosFn,
          bandScale: categoryScaleForOverlay,
          bandWidth,
          categoryAccessor,
          data: renderData,
          gradientId: pulseWaveGradientId,
          id: `bar-pulse-${pulse.dataKey}`,
          pulsePaused: pulse.pulsePaused,
          yAccessor: (datum: Readonly<ChartDatum>) => projectValue(pulse.dataKey, numericBarCell(datum, pulse.dataKey)),
        });
        if (pulseMark) {marks.push(pulseMark);}
      }
    }
    marks.push(...hoverMarks);
    const spec = {
      gradients: nativeDepthGradients,
      margin,
      marks,
      // Tick counts reach guides only via axis.ticks.count; a bare ticks: key is never read.
      scales: {
        x: { axis: xAxisOptions, grid: gridGuide.vertical, scale: xScaleFactory },
        y: {
          axis: yAxisOptions,
          grid: gridGuide.horizontal,
          scale: yScale,
        },
      },
      svgAnimation: false as const,
      theme: { muted: "var(--color-chart-label, var(--chart-label))" },
    } as const;
    const base = defineChart(spec);
    return defineChart(base, { focus: barFocusStrategy, focusRing: false, maxFocusDistance: Number.POSITIVE_INFINITY, tooltip: tooltipOption });
  }, [
    renderData,
    categoryAccessor,
    resolvedSeries,
    resolvedBarSquares,
    resolvedBarColumnTracks,
    barDepthBacksRaw,
    barDepthFrontsRaw,
    barPulsesRaw,
    groupScale,
    groupBandwidth,
    xScaleFactory,
    yScale,
    projectValue,
    grid,
    margin,
    width,
    barFocusStrategy,
    barSquaresEnabled,
    barColumnTrackEnabled,
    barDepthEnabled,
    totalSeriesCount,
    allSeriesKeys,
    legendHoveredIndex,
    bandWidth,
    categoryScaleForOverlay,
    squaresDefsByKey,
    squaresBaseId,
    depthGradientIds,
    nativeDepthGradients,
    pulseWaveGradientId,
    tooltipEnabled,
    tooltip,
    chartConfig,
    groupScaleForOverlay,
    dotSeriesList,
    indicatorGradientId,
    barXAxis,
    categoryOrder,
    labelFade,
    barEnterMotion,
  ]);

  const chromeStateRef = useRef<BarChromeState | null>(null);
  const dateLabelsForPill = useMemo(() => renderData.map((datum: Readonly<ChartDatum>) => {
    const rawValue = datum[xDataKey];
    if (rawValue instanceof Date) {return shortDateFmt.format(rawValue);}
    if (isString(rawValue)) {return rawValue;}
    if (isNumber(rawValue)) {return String(rawValue);}
    return "";
  }), [renderData, xDataKey]);
  chromeStateRef.current = {
    dateLabels: dateLabelsForPill,
    series: dotSeriesList,
    tooltip: tooltip ?? undefined,
  };

  const overlayHostRef = useRef<HTMLDivElement | null>(null);
  const hasDefinition = width > 0;

  const pillRef = useRef<PillBuild | null>(null);
  // First pill show jumps the spring; later moves spring (mirrors legacy showing flag).
  const pillVisibleRef = useRef(false);

  useLayoutEffect((): (() => void) | undefined => {
    const el = overlayHostRef.current;
    if (!el || !tooltipEnabled) {return undefined;}
    const doc = el.ownerDocument;
    const pillBuild = buildPill(doc, chartConfig.tooltipSpring, () => chromeStateRef.current?.dateLabels ?? []);
    el.append(pillBuild.layer);
    pillRef.current = pillBuild;
    return (): void => {
      pillRef.current = null;
      pillVisibleRef.current = false;
      pillBuild.spring.stop();
      pillBuild.ticker?.detach();
      pillBuild.layer.remove();
    };
  }, [tooltipEnabled, hasDefinition, chartConfig]);

  const categoryIndexByLabel = useMemo(() => {
    const indexByLabel = new Map<string, number>();
    for (let i = 0; i < categoryOrder.length; i += 1) {indexByLabel.set(categoryOrder[i], i);}
    return indexByLabel;
  }, [categoryOrder]);

interface SyncDatePillParams {
  readonly pillBuild: PillBuild | null;
  readonly showDatePill: boolean;
  readonly dateLabels: readonly string[] | undefined;
  readonly categoryIndex: number;
  readonly categoryLabel: string;
  readonly anchorX: number;
  readonly discrete: boolean;
  readonly showing: boolean;
}

const syncDatePillForCategory = ({
  pillBuild,
  showDatePill,
  dateLabels,
  categoryIndex,
  categoryLabel,
  anchorX,
  discrete,
  showing,
}: Readonly<SyncDatePillParams>): void => {
  if (!pillBuild) {return;}
  if (!showDatePill) {
    pillBuild.layer.style.display = "none";
    return;
  }
  updateDatePillContent({ anchorX, categoryIndex, categoryLabel, dateLabels, discrete, pillBuild, showing });
};

  const handleFocusGroupChange = useCallback(
    (points: readonly Readonly<ChartPoint<ChartDatum, string, number>>[]) => {
      const pillBuild = pillRef.current;
      if (points.length === 0) {
        clearDatePillForEmptyFocus({ pillBuild, setLabelFade, visibilityRef: pillVisibleRef });
        return;
      }
      const categoryLabel = points[0].xValue;
      const categoryIndex = categoryIndexByLabel.get(categoryLabel) ?? 0;
      // Anchor from the band-scale clone, not mean point.x (asymmetric under group padding).
      const anchorX = (categoryScaleForOverlay(categoryLabel) ?? 0) + bandWidth / 2;
      syncDatePillForCategory({
        anchorX,
        categoryIndex,
        categoryLabel,
        dateLabels: chromeStateRef.current?.dateLabels,
        discrete: renderData.length > DISCRETE_INTERACTION_THRESHOLD,
        pillBuild,
        showDatePill: tooltipEnabled && (tooltip?.showDatePill ?? true),
        showing: !pillVisibleRef.current,
      });
      pillVisibleRef.current = true;

      setLabelFade((prev) =>
        prev?.primaryX === anchorX && prev.hoveredLabel === categoryLabel
          ? prev
          : { hoveredLabel: categoryLabel, primaryX: anchorX },
      );
    },
    [categoryIndexByLabel, categoryScaleForOverlay, bandWidth, renderData.length, tooltipEnabled, tooltip],
  );

const getBarTooltipValue = (point: Readonly<ChartPoint<ChartDatum, string, number>>): number => {
  const raw: unknown = point.datum[point.markId];
  return isNumber(raw) ? raw : (point.yValue);
};

interface CustomBarTooltipContentParams {
  readonly content: (props: { readonly point: Readonly<ChartTooltipPoint>; readonly index: number }) => ReactNode;
  readonly categoryIndex: number;
  readonly categoryLabel: string;
  readonly points: readonly Readonly<ChartPoint<ChartDatum, string, number>>[];
  readonly panelClassName: string;
  readonly panelStyle: CSSProperties | undefined;
}

const renderCustomBarTooltipContent = ({
  content,
  categoryIndex,
  categoryLabel,
  points,
  panelClassName,
  panelStyle,
}: Readonly<CustomBarTooltipContentParams>): ReactNode => {
  const pointRec: ChartTooltipPoint = { label: categoryLabel };
  for (const point of points) {pointRec[point.markId] = getBarTooltipValue(point);}
  return (
    <div className={panelClassName} style={panelStyle}>
      {content({ index: categoryIndex, point: pointRec })}
    </div>
  );
};

interface DefaultBarTooltipContentParams {
  readonly tooltip: ChartTooltipConfig | undefined;
  readonly points: readonly Readonly<ChartPoint<ChartDatum, string, number>>[];
  readonly pointByMark: ReadonlyMap<string, Readonly<ChartPoint<ChartDatum, string, number>>>;
  readonly seriesList: readonly Readonly<{ dataKey: string; color: string }>[];
  readonly categoryLabel: string;
  readonly panelClassName: string;
  readonly panelStyle: CSSProperties | undefined;
}

interface BarTooltipRowsParams {
  readonly tooltip: ChartTooltipConfig | undefined;
  readonly pointRec: Readonly<ChartTooltipPoint>;
  readonly pointByMark: ReadonlyMap<string, Readonly<ChartPoint<ChartDatum, string, number>>>;
  readonly seriesList: readonly Readonly<{ dataKey: string; color: string }>[];
}

const buildBarTooltipRows = ({
  tooltip: tt,
  pointRec,
  pointByMark,
  seriesList,
}: Readonly<BarTooltipRowsParams>): TooltipRow[] =>
  tt?.rows
    ? tt.rows(pointRec)
    : seriesList.map((series) => {
      const point = pointByMark.get(series.dataKey);
      const pointColor = point?.color;
      return { color: series.color || (pointColor !== undefined && pointColor !== "" ? pointColor : "transparent"), label: series.dataKey, value: point ? getBarTooltipValue(point) : 0 };
    });

const renderDefaultBarTooltipContent = ({
  tooltip: tt,
  points,
  pointByMark,
  seriesList,
  categoryLabel,
  panelClassName,
  panelStyle,
}: Readonly<DefaultBarTooltipContentParams>): ReactNode => {
  const pointRec: ChartTooltipPoint = { label: categoryLabel };
  for (const point of points) {pointRec[point.markId] = getBarTooltipValue(point);}
  const rows = buildBarTooltipRows({ pointByMark, pointRec, seriesList, tooltip: tt });
  return (
    <div className={panelClassName} style={panelStyle}>
      <TooltipContent title={categoryLabel} rows={rows}>
        {tt?.children}
      </TooltipContent>
    </div>
  );
};

  const renderTooltipBody = useCallback(
    (ctx: Readonly<ChartTooltipBodyRenderContext<ChartDatum, string, number>>): ReactNode => {
      if (ctx.points.length === 0) {return undefined;}
      const state = chromeStateRef.current;
      const tt = state?.tooltip ?? undefined;
      const categoryLabel = ctx.points[0].xValue;
      const categoryIndex = categoryIndexByLabel.get(categoryLabel) ?? 0;
      const pointByMark = new Map(ctx.points.map((point: Readonly<ChartPoint<ChartDatum, string, number>>) => [point.markId, point]));
      const { panelClassName, panelStyle } = resolveBarTooltipPanel({ tooltip: tt });
      if (tt?.content) {
        return renderCustomBarTooltipContent({ categoryIndex, categoryLabel, content: tt.content, panelClassName, panelStyle, points: ctx.points });
      }
      return renderDefaultBarTooltipContent({ categoryLabel, panelClassName, panelStyle, pointByMark, points: ctx.points, seriesList: state?.series ?? [], tooltip: tt });
    },
    [categoryIndexByLabel],
  );

// HandleRender only tracks phase and syncs BarPulse; native motion owns the reveal.
// Reveal end is timer-approximated: native motion exposes no per-mark completion hook.
  const handleRender = useCallback((context: Readonly<ChartRendererRenderContext<ChartDatum, string, number>>) => {
    captureRenderContext(context);
    const surfaceElement = context.surface.element;
    if (!(surfaceElement instanceof SVGSVGElement)) {
      setPhase("ready");
      return;
    }
    const svgRoot = surfaceElement;
    const marksGroup = svgRoot.querySelector<SVGGElement>(".ts-chart__marks");
    if (!marksGroup || animationDuration <= 0) {
      setPhase("ready");
      syncBarPulseGroups(svgRoot, true);
      return;
    }
    // Test the replay key before the DOM stamp (a latched stamp would swallow signature bumps).
    if (syncBarPulseIfRevealed({ isReadyPhase: phaseRef.current === "ready", marksGroup, revealKeyChanged: revealedKeyRef.current !== revealKeyRef.current, svgRoot })) {
      return;
    }
    syncBarPulseGroups(svgRoot, false);
    if (revealedForDataRef.current === latestRenderDataRef.current && revealedKeyRef.current === revealKeyRef.current) {
      markRevealed(marksGroup);
      syncBarPulseGroups(svgRoot, phaseRef.current === "ready");
      return;
    }
    beginBarReveal({
      currentRevealKey: revealKeyRef.current,
      latestRenderData: latestRenderDataRef.current,
      marksGroup,
      renderDataLength: renderData.length,
      revealDeadlineTimerRef,
      revealDurationMs,
      revealKeyRef,
      revealedForDataRef,
      setPhase,
      svgRoot,
    });
  }, [animationDuration, revealDurationMs, setPhase, renderData.length, captureRenderContext]);

  const refAreaChildrenBar = useMemo(() => extractReferenceAreaProps(children), [children]);
  const heightPxBar = width > 0 ? width / parseAspectRatio(aspectRatio) : 0;
  // Count emitted primitives (not data rows) for the motion/static renderer gate.
  // Gate on declared depth marks, not applicable ones: the renderer choice latches at first render.
  const motionPrimitiveEstimate = useMemo(() => {
    const rows = renderData.length;
    const squaresN = hasBarSquares ? resolvedBarSquares.length : 0;
    let total = rows * Math.max(0, totalSeriesCount - squaresN);
    if (squaresN > 0) {
      const barLengthPx = Math.max(0, heightPxBar - margin.top - margin.bottom);
      total += countSquarePrimitives({ bandWidth, barLengthPx, rows, squares: resolvedBarSquares, totalSeriesCount });
    }
    if (hasBarDepth) {
      total += rows * (barDepthBacksRaw.length * BAR_DEPTH_BACK_NODES_PER_ROW + barDepthFrontsRaw.length);
    }
    return total;
  }, [hasBarSquares, resolvedBarSquares, renderData.length, heightPxBar, margin.top, margin.bottom, totalSeriesCount, bandWidth, hasBarDepth, barDepthBacksRaw, barDepthFrontsRaw]);
  const barChartRenderer = useChartRenderer<ChartDatum, string, number>(motionPrimitiveEstimate);

  const crosshairFadeGradient = useMemo((): { readonly color: string; readonly id: string; readonly stops: IndicatorFadeGradientStop[] } | undefined => {
    if (!tooltipEnabled || !(tooltip?.showCrosshair ?? true)) {return undefined;}
    const indicatorCfg = toIndicatorConfig(tooltip);
    if (indicatorCfg.dasharray !== undefined && indicatorCfg.dasharray !== "") {return undefined;}
    const fadeSides = resolveVerticalFadeSides(indicatorCfg.fadeEdges ?? "both");
    if (!fadeSides.any) {return undefined;}
    const colorValue = isString(indicatorCfg.color) ? indicatorCfg.color : "var(--chart-crosshair)";
    return {
      color: colorValue,
      id: indicatorGradientId,
      stops: indicatorFadeGradientStops(fadeSides, indicatorCfg.fadeLength ?? DEFAULT_INDICATOR_FADE_LENGTH),
    };
  }, [tooltipEnabled, tooltip, indicatorGradientId]);

  const barScaleForRef = useMemo((): ScaleBand<string> | undefined => {
    if (categoryOrder.length === 0) {return undefined;}
    return scaleBand().domain(categoryOrder).range([0, Math.max(0, width - margin.left - margin.right)]).padding(barGap);
  }, [categoryOrder, width, margin.left, margin.right, barGap]);

  const barRootStyle = useMemo((): CSSProperties => ({ aspectRatio, isolation: "isolate", position: "relative", width: "100%" }), [aspectRatio]);

  const referenceAreaGeom = useMemo((): ReferenceAreaLayersGeom | undefined => {
    if (heightPxBar <= 0 || barScaleForRef === undefined) { return undefined; }
    return {
      barScale: barScaleForRef,
      height: heightPxBar,
      isBarChart: true,
      margin,
      width,
      // Reference areas need the NICED domain the bars paint in, not raw yDomain.
      yDomain: nicedPrimaryDomain,
      yDomainsByAxis: nicedDomainsByAxis,
    };
  }, [barScaleForRef, heightPxBar, margin, nicedDomainsByAxis, nicedPrimaryDomain, width]);

  const tooltipBody = tooltipEnabled ? renderTooltipBody : undefined;
  const squaresGradientDefs = squaresDefs.map((def) => (
    <Fragment key={def.gradientId}>
      <linearGradient id={def.gradientId} gradientUnits="userSpaceOnUse" x1={0} x2={0} y1={0} y2={100}>
        {def.gradientStops.map((stop) => (
          <stop key={`${stop.offset}-${stop.color}`} offset={`${stop.offset}%`} stopColor={stop.color} />
        ))}
      </linearGradient>
      {def.patternId !== undefined && def.patternId !== "" && def.patternPreset !== undefined && renderPatternPreset(def.patternPreset, def.patternId, { color: `url(#${def.gradientId})` })}
    </Fragment>
  ));
  const crosshairGradientDef = crosshairFadeGradient && (
    <linearGradient
      key={crosshairFadeGradient.id}
      id={crosshairFadeGradient.id}
      gradientUnits="userSpaceOnUse"
      x1={0}
      x2={0}
      y1={margin.top}
      y2={margin.top + Math.max(0, heightPxBar - margin.top - margin.bottom)}
    >
      {crosshairFadeGradient.stops.map((stop: Readonly<IndicatorFadeGradientStop>) => (
        <stop key={`${stop.offset}-${stop.opacity}`} offset={stop.offset} stopColor={crosshairFadeGradient.color} stopOpacity={stop.opacity} />
      ))}
    </linearGradient>
  );
  const referenceAreaLayer = referenceAreaGeom === undefined ? undefined : (
    <ReferenceAreaLayers
      configs={refAreaChildrenBar}
      geom={referenceAreaGeom}
    />
  );

  return (
    <div
      ref={containerRef}
      className={className}
      style={barRootStyle}
      data-bkm-chart="bar"
    >
      {background && (
        <BackgroundLayer
          config={background}
          innerWidth={innerWidth}
          innerHeight={Math.max(0, heightPxBar - margin.top - margin.bottom)}
          marginLeft={margin.left}
          marginTop={margin.top}
        />
      )}
      {definition && (
        <>
          <RendererChart
            ariaLabel="Bar chart"
            aspectRatio={parseAspectRatio(aspectRatio)}
            definition={definition}
            renderer={barChartRenderer}
            onFocusGroupChange={handleFocusGroupChange}
            onRender={handleRender}
            renderTooltipBody={tooltipBody}
          />
          {referenceAreaLayer}
          {tooltipEnabled && (
            <div
              ref={overlayHostRef}
              style={BAR_TOOLTIP_OVERLAY_STYLE}
            />
          )}
        </>
      )}
      {(squaresDefs.length > 0 || crosshairFadeGradient) && (
        <svg width={0} height={0} style={BAR_HIDDEN_DEFS_STYLE} aria-hidden="true" focusable="false">
          <defs>
            {squaresGradientDefs}
            {crosshairGradientDef}
          </defs>
        </svg>
      )}
    </div>
  );
};

export type { BarChartProps, BarOrientation };
export { BarChart };
