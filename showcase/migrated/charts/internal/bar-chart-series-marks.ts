// Grouped-bar series marks and chart definitions (plain and full specs).
// Split from bar-chart.tsx without behaviour change.
import { barY } from "@tanstack/charts/bar";
import { defineChart } from "@tanstack/charts/scene";
import { group } from "@tanstack/charts/group";
import { tooltip } from "@tanstack/charts/tooltip";
import { portal } from "@tanstack/charts/tooltip/portal";
import type { ChartFocusStrategy, ChartMark, ChartMarkState, ChartMotionDefinition, ChartTooltipInput, DomChartDefinition } from "@tanstack/charts";
import type { ScaleBand } from "d3-scale";
import { isNumber, numericBarCell } from "./bar-chart-hover-dots";
import { bandWidthForSquares, computeSquareColumn } from "./bar-squares-layout";
import { barColumnTrackMark } from "./bar-column-track-mark";
import { barDepthBackMark, barDepthFrontMark, BAR_FADED_OPACITY } from "./bar-depth-marks";
import type { BarDepthGradientIds } from "./bar-depth-marks";
import type { BarDepthSegmentsAccessor } from "./bar-depth-geometry";
import { barPulseMark } from "./bar-pulse-mark";
import { barSquaresMark } from "./bar-squares-mark";
import { barTrimmedMark } from "./bar-trimmed-mark";
import { BOX_OFFSET, DISCRETE_INTERACTION_THRESHOLD, TOOLTIP_BOX_SPRING } from "./design-tokens";
import type { resolveGridGuide } from "./grid";
import type { buildBarAxisSection, BuiltDepthGradient } from "./bar-chart-overlays";
import { CARTESIAN_MAX_FOCUS_DISTANCE_PX } from "./cartesian-focus-distance";
import type { createNicedYScale } from "./y-domain";
import type { PatternPresetId } from "./pattern-preset";
import type { BarConfig, BarDepthBackConfig, BarDepthFrontConfig, BarPulseConfig, BarSquaresConfig, ChartDatum } from "./types";
import type { ChartMargin } from "./use-chart-margin";

// Dim transitions mirror bklit timings: bars/track 150ms in-out, squares/depth 150ms ease-out.
const BAR_DIM_TRANSITION: NonNullable<ChartMarkState["transition"]> = { duration: 150, easing: "ease-in-out", type: "tween" };
const BAR_SQUARES_DIM_TRANSITION: NonNullable<ChartMarkState["transition"]> = { duration: 150, easing: "ease-out", type: "tween" };
const BAR_TRACK_DIM_TRANSITION: NonNullable<ChartMarkState["transition"]> = { duration: 150, easing: "ease-in-out", type: "tween" };
const BAR_DEPTH_DIM_TRANSITION: NonNullable<ChartMarkState["transition"]> = { duration: 150, easing: "ease-out", type: "tween" };
/** D481: `barDepthBackMark` nodes per row — side + shade + glass, lid + tip + shade. */
const BAR_DEPTH_BACK_NODES_PER_ROW = 6;
// Bklit parity: round cornerRadius caps at 8px (min with half the bar width).
const BAR_ROUND_CORNER_RADIUS_MAX_PX = 8;

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

interface ResolvedSeries {
  readonly dataKey: string;
  readonly yAxisId?: string | number;
  readonly fill: string;
  readonly dotColor: string;
  readonly lineCap: BarConfig["lineCap"];
  readonly fadedOpacity: number;
}

const resolveCornerRadius = (
  lineCap: BarConfig["lineCap"] | undefined,
  groupBandwidth: number,
): number => {
  if (isNumber(lineCap)) {return lineCap;}
  if (lineCap === "butt") {return 0;}
  // Bklit parity: round cornerRadius is min(barWidth/2, 8).
  return groupBandwidth > 0 ? Math.min(groupBandwidth / 2, BAR_ROUND_CORNER_RADIUS_MAX_PX) : 0;
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
  readonly gradientStops: readonly { offset: number; color: string }[];
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

interface ResolvedBarSquare {
  readonly dataKey: string;
  readonly yAxisId?: string | number;
  readonly fill: string;
  readonly stroke?: string;
  readonly squareGap: number;
  readonly squareRadius: number;
  readonly squareFit: boolean;
  readonly useGradient: boolean;
  readonly gradientStops: readonly { offset: number; color: string }[];
  readonly patternPreset?: BarSquaresConfig["patternPreset"];
  readonly animate: boolean;
  readonly fadedOpacity: number;
  readonly staggerDelay?: number;
  readonly groupGap: number;
}

interface ResolvedBarColumnTrack {
  readonly fill: string;
  readonly opacity: number;
  readonly squareGap: number;
  readonly squareRadius: number;
  readonly groupGap: number;
  readonly squareFit: boolean;
  readonly staggerDelay?: number;
}

interface ResolvedSquareDef {
  readonly dataKey: string;
  readonly gradientId: string;
  readonly patternId: string | undefined;
  readonly fill: string;
  readonly gradientStops: readonly Readonly<{ offset: number; color: string }>[];
  readonly patternPreset?: PatternPresetId;
}

// Bklit parity: legend dim is per-mark opacity, not programmatic focus (single-owner slot).
const barLegendDimOpacity = (
  legendHoveredKey: string | undefined,
  dataKey: string,
  fadedOpacity: number,
): number | undefined => (legendHoveredKey !== undefined && legendHoveredKey !== dataKey ? fadedOpacity : undefined);

interface GroupedBarMarkParams {
  readonly series: ResolvedSeries;
  readonly renderData: readonly Readonly<ChartDatum>[];
  readonly groupScale: ScaleBand<string>;
  readonly groupBandwidth: number;
  readonly barEnterMotion: ChartMotionDefinition<ChartDatum>;
  readonly categoryAccessor: (datum: Readonly<ChartDatum>) => string;
  readonly projectValue: (dataKey: string, value: number) => number;
  readonly legendHoveredKey: string | undefined;
}

const buildGroupedBarMark = ({
  series,
  renderData,
  groupScale,
  groupBandwidth,
  barEnterMotion,
  categoryAccessor,
  projectValue,
  legendHoveredKey,
}: Readonly<GroupedBarMarkParams>): ChartMark<ChartDatum, string, number> =>
  barY(renderData, {
    fill: series.fill,
    fillOpacity: barLegendDimOpacity(legendHoveredKey, series.dataKey, series.fadedOpacity),
    id: series.dataKey,
    layout: group({ scale: groupScale }),
    motion: barEnterMotion,
    radius: resolveCornerRadius(series.lineCap, groupBandwidth),
    states: barRowDimStates(series.fadedOpacity, BAR_DIM_TRANSITION),
    x: (datum: Readonly<ChartDatum>) => categoryAccessor(datum),
    y: (datum: Readonly<ChartDatum>) => projectValue(series.dataKey, numericBarCell(datum, series.dataKey)),
    z: () => series.dataKey,
  });

interface TrimmedBarMarkParams {
  readonly series: ResolvedSeries;
  readonly renderData: readonly Readonly<ChartDatum>[];
  readonly groupBandwidth: number;
  readonly groupScale: ScaleBand<string>;
  readonly categoryAccessor: (datum: Readonly<ChartDatum>) => string;
  readonly projectValue: (dataKey: string, value: number) => number;
  readonly legendHoveredKey: string | undefined;
  readonly minBarHeight?: number;
}

const buildTrimmedBarMark = ({
  series,
  renderData,
  groupBandwidth,
  groupScale,
  categoryAccessor,
  projectValue,
  legendHoveredKey,
  minBarHeight,
}: Readonly<TrimmedBarMarkParams>): ChartMark<ChartDatum, string, number> =>
  barTrimmedMark(renderData, {
    categoryAccessor,
    data: renderData,
    fill: series.fill,
    groupBandwidth,
    groupScale,
    id: series.dataKey,
    minBarHeight,
    // Bklit parity: perspective bars force cornerRadius 0 (flat-top lid meets face gap-free).
    opacity: barLegendDimOpacity(legendHoveredKey, series.dataKey, series.fadedOpacity),
    radius: 0,
    states: barRowDimStates(series.fadedOpacity, BAR_DIM_TRANSITION),
    yAccessor: (datum: Readonly<ChartDatum>) => projectValue(series.dataKey, numericBarCell(datum, series.dataKey)),
  });

interface BarPlainMarksParams {
  readonly resolvedSeries: readonly ResolvedSeries[];
  readonly groupScale: ScaleBand<string>;
  readonly groupBandwidth: number;
  readonly barEnterMotion: ChartMotionDefinition<ChartDatum>;
  readonly categoryAccessor: (datum: Readonly<ChartDatum>) => string;
  readonly projectValue: (dataKey: string, value: number) => number;
  readonly renderData: readonly Readonly<ChartDatum>[];
  readonly legendHoveredKey: string | undefined;
}

const buildBarPlainMarks = ({
  resolvedSeries,
  groupScale,
  groupBandwidth,
  barEnterMotion,
  categoryAccessor,
  projectValue,
  renderData,
  legendHoveredKey,
}: Readonly<BarPlainMarksParams>): ChartMark<ChartDatum, string, number>[] => {
  const marks: ChartMark<ChartDatum, string, number>[] = [];
  for (const series of resolvedSeries) {
    marks.push(
      buildGroupedBarMark({ barEnterMotion, categoryAccessor, groupBandwidth, groupScale, legendHoveredKey, projectValue, renderData, series }),
    );
  }
  return marks;
};

interface BarTrackMarksParams {
  readonly tracks: readonly ResolvedBarColumnTrack[];
  readonly allSeriesKeys: readonly string[];
  readonly categoryAccessor: (datum: Readonly<ChartDatum>) => string;
  readonly projectValue: (dataKey: string, value: number) => number;
  readonly renderData: readonly Readonly<ChartDatum>[];
  readonly seriesCount: number;
}

// Column track paints beneath bars/squares (underlay order).
const buildBarTrackMarks = ({
  tracks,
  allSeriesKeys,
  categoryAccessor,
  projectValue,
  renderData,
  seriesCount,
}: Readonly<BarTrackMarksParams>): ChartMark<ChartDatum, string, number>[] => {
  const marks: ChartMark<ChartDatum, string, number>[] = [];
  for (let trackIndex = 0; trackIndex < tracks.length; trackIndex += 1) {
    const track = tracks[trackIndex];
    for (let seriesIndex = 0; seriesIndex < allSeriesKeys.length; seriesIndex += 1) {
      const dataKey = allSeriesKeys[seriesIndex];
      const trackId = `bar-column-track-${trackIndex}-${seriesIndex}`;
      marks.push(
        barColumnTrackMark(renderData, {
          categoryAccessor,
          data: renderData,
          fill: track.fill,
          groupGap: track.groupGap,
          id: trackId,
          opacity: track.opacity,
          seriesCount,
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
  return marks;
};

interface BarSquareMarksParams {
  readonly squares: readonly ResolvedBarSquare[];
  readonly allSeriesKeys: readonly string[];
  readonly squaresDefsByKey: ReadonlyMap<string, ResolvedSquareDef>;
  readonly squaresBaseId: string;
  readonly categoryAccessor: (datum: Readonly<ChartDatum>) => string;
  readonly projectValue: (dataKey: string, value: number) => number;
  readonly renderData: readonly Readonly<ChartDatum>[];
  readonly seriesCount: number;
  readonly legendHoveredKey: string | undefined;
}

const buildBarSquareMarks = ({
  squares,
  allSeriesKeys,
  squaresDefsByKey,
  squaresBaseId,
  categoryAccessor,
  projectValue,
  renderData,
  seriesCount,
  legendHoveredKey,
}: Readonly<BarSquareMarksParams>): ChartMark<ChartDatum, string, number>[] => {
  const marks: ChartMark<ChartDatum, string, number>[] = [];
  for (let squaresIndex = 0; squaresIndex < squares.length; squaresIndex += 1) {
    const square = squares[squaresIndex];
    const seriesIndex = allSeriesKeys.indexOf(square.dataKey);
    const def = squaresDefsByKey.get(square.dataKey);
    const gradientId = def?.gradientId ?? `${squaresBaseId}-bar-squares-gradient-${squaresIndex}`;
    const patternId = def?.patternId ?? `${squaresBaseId}-bar-squares-pattern-${squaresIndex}`;
    marks.push(
      barSquaresMark(renderData, {
        categoryAccessor,
        data: renderData,
        fill: def ? def.fill : square.fill,
        gradientId,
        gradientStops: square.gradientStops,
        groupGap: square.groupGap,
        id: square.dataKey,
        opacity: barLegendDimOpacity(legendHoveredKey, square.dataKey, square.fadedOpacity),
        patternId,
        patternPreset: square.patternPreset,
        seriesCount,
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
  return marks;
};

interface BarDepthBackMarksParams {
  readonly backs: readonly Readonly<BarDepthBackConfig>[];
  readonly resolvedSeries: readonly ResolvedSeries[];
  readonly categoryAccessor: (datum: Readonly<ChartDatum>) => string;
  readonly projectValue: (dataKey: string, value: number) => number;
  readonly renderData: readonly Readonly<ChartDatum>[];
  readonly depthGradientIds: BarDepthGradientIds;
  readonly depthLegendOpacity: number | undefined;
  readonly depthMinBarHeight?: number;
  readonly depthSegmentsAccessor?: BarDepthSegmentsAccessor;
}

const buildBarDepthBackMarks = ({
  backs,
  resolvedSeries,
  categoryAccessor,
  projectValue,
  renderData,
  depthGradientIds,
  depthLegendOpacity,
  depthMinBarHeight,
  depthSegmentsAccessor,
}: Readonly<BarDepthBackMarksParams>): ChartMark<ChartDatum, string, number>[] => {
  const marks: ChartMark<ChartDatum, string, number>[] = [];
  const seriesByDataKey = new Map(resolvedSeries.map((series) => [series.dataKey, series] as const));
  for (const back of backs) {
    const series = seriesByDataKey.get(back.dataKey);
    if (series) {
      marks.push(
        barDepthBackMark(renderData, {
          categoryAccessor,
          data: renderData,
          fill: back.color ?? series.fill,
          gradientIds: depthGradientIds,
          id: `bar-depth-back-${back.dataKey}`,
          minBarHeight: depthMinBarHeight,
          opacity: depthLegendOpacity,
          segmentsAccessor: depthSegmentsAccessor,
          states: barDepthDimStates(),
          yAccessor: (datum: Readonly<ChartDatum>) => projectValue(back.dataKey, numericBarCell(datum, back.dataKey)),
        }),
      );
    }
  }
  return marks;
};

interface BarSeriesMarksParams {
  readonly resolvedSeries: readonly ResolvedSeries[];
  readonly squaresKeys: ReadonlySet<string>;
  readonly depthKeys: ReadonlySet<string>;
  readonly groupBandwidth: number;
  readonly groupScale: ScaleBand<string>;
  readonly categoryAccessor: (datum: Readonly<ChartDatum>) => string;
  readonly projectValue: (dataKey: string, value: number) => number;
  readonly renderData: readonly Readonly<ChartDatum>[];
  readonly barEnterMotion: ChartMotionDefinition<ChartDatum>;
  readonly legendHoveredKey: string | undefined;
  readonly depthMinBarHeight?: number;
}

const buildBarSeriesMarks = ({
  resolvedSeries,
  squaresKeys,
  depthKeys,
  groupBandwidth,
  groupScale,
  categoryAccessor,
  projectValue,
  renderData,
  barEnterMotion,
  legendHoveredKey,
  depthMinBarHeight,
}: Readonly<BarSeriesMarksParams>): ChartMark<ChartDatum, string, number>[] => {
  const marks: ChartMark<ChartDatum, string, number>[] = [];
  const needsTrim = (dataKey: string): boolean => depthKeys.has(dataKey);
  for (const series of resolvedSeries) {
    if (squaresKeys.has(series.dataKey)) {
      // Squares-owned series render through the squares mark above; skipped here.
    } else if (needsTrim(series.dataKey)) {
      marks.push(
        buildTrimmedBarMark({ categoryAccessor, groupBandwidth, groupScale, legendHoveredKey, minBarHeight: depthMinBarHeight, projectValue, renderData, series }),
      );
    } else {
      marks.push(
        buildGroupedBarMark({ barEnterMotion, categoryAccessor, groupBandwidth, groupScale, legendHoveredKey, projectValue, renderData, series }),
      );
    }
  }
  return marks;
};

interface BarDepthFrontMarksParams {
  readonly fronts: readonly Readonly<BarDepthFrontConfig>[];
  readonly pulses: readonly Readonly<BarPulseConfig>[];
  readonly categoryAccessor: (datum: Readonly<ChartDatum>) => string;
  readonly projectValue: (dataKey: string, value: number) => number;
  readonly renderData: readonly Readonly<ChartDatum>[];
  readonly depthGradientIds: BarDepthGradientIds;
  readonly depthLegendOpacity: number | undefined;
  readonly pulseWaveGradientId: string;
  readonly depthMinBarHeight?: number;
  readonly depthSegmentsAccessor?: BarDepthSegmentsAccessor;
}

const buildBarDepthFrontMarks = ({
  fronts,
  pulses,
  categoryAccessor,
  projectValue,
  renderData,
  depthGradientIds,
  depthLegendOpacity,
  pulseWaveGradientId,
  depthMinBarHeight,
  depthSegmentsAccessor,
}: Readonly<BarDepthFrontMarksParams>): ChartMark<ChartDatum, string, number>[] => {
  const marks: ChartMark<ChartDatum, string, number>[] = [];
  for (const front of fronts) {
    marks.push(
      barDepthFrontMark(renderData, {
        categoryAccessor,
        data: renderData,
        gradientIds: depthGradientIds,
        id: `bar-depth-front-${front.dataKey}`,
        minBarHeight: depthMinBarHeight,
        opacity: depthLegendOpacity,
        segmentsAccessor: depthSegmentsAccessor,
        states: barDepthDimStates(),
        yAccessor: (datum: Readonly<ChartDatum>) => projectValue(front.dataKey, numericBarCell(datum, front.dataKey)),
      }),
    );
  }
  for (const pulse of pulses) {
    const pulseMark = barPulseMark(renderData, {
      activeIndex: pulse.activeIndex,
      categoryAccessor,
      data: renderData,
      gradientId: pulseWaveGradientId,
      id: `bar-pulse-${pulse.dataKey}`,
      pulsePaused: pulse.pulsePaused,
      yAccessor: (datum: Readonly<ChartDatum>) => projectValue(pulse.dataKey, numericBarCell(datum, pulse.dataKey)),
    });
    if (pulseMark) {marks.push(pulseMark);}
  }
  return marks;
};

interface BarTooltipOptionParams {
  readonly renderDataLength: number;
  readonly tooltipEnabled: boolean;
}

const buildBarTooltipOption = ({ renderDataLength, tooltipEnabled }: Readonly<BarTooltipOptionParams>): ChartTooltipInput<ChartDatum, string, number, "dom"> | false => {
  if (!tooltipEnabled) {return false;}
  const discrete = renderDataLength > DISCRETE_INTERACTION_THRESHOLD;
  return {
    anchor: (points, context) => {
      const primaryX = context.focus.primary.x;
      let left = primaryX;
      let right = primaryX;
      for (const candidate of points) {
        left = Math.min(left, candidate.x);
        right = Math.max(right, candidate.x);
      }
      return { x: (left + right) / 2, y: context.plot.y - BOX_OFFSET };
    },
    className: "bkm-native-tooltip",
    motion: discrete
      ? (false as const)
      : { damping: TOOLTIP_BOX_SPRING.damping, stiffness: TOOLTIP_BOX_SPRING.stiffness, type: "spring" as const },
    offset: BOX_OFFSET,
    placement: ["bottom-right", "bottom-left"] as const,
    portal,
    sticky: false,
    use: tooltip,
  };
};

interface BarUnderlayMarksParams extends BarTrackMarksParams, BarSquareMarksParams, BarDepthBackMarksParams {
  readonly hasTrack: boolean;
  readonly hasSquares: boolean;
  readonly hasDepth: boolean;
}

// Track/squares/depth-back all paint beneath the bars (underlay order).
const buildBarUnderlayMarks = ({
  hasTrack,
  hasSquares,
  hasDepth,
  tracks,
  allSeriesKeys,
  categoryAccessor,
  projectValue,
  renderData,
  seriesCount,
  squares,
  squaresDefsByKey,
  squaresBaseId,
  legendHoveredKey,
  backs,
  resolvedSeries,
  depthGradientIds,
  depthLegendOpacity,
  depthMinBarHeight,
  depthSegmentsAccessor,
}: Readonly<BarUnderlayMarksParams>): ChartMark<ChartDatum, string, number>[] => {
  const marks: ChartMark<ChartDatum, string, number>[] = [];
  if (hasTrack) {
    marks.push(...buildBarTrackMarks({ allSeriesKeys, categoryAccessor, projectValue, renderData, seriesCount, tracks }));
  }
  if (hasSquares) {
    marks.push(...buildBarSquareMarks({ allSeriesKeys, categoryAccessor, legendHoveredKey, projectValue, renderData, seriesCount, squares, squaresBaseId, squaresDefsByKey }));
  }
  if (hasDepth) {
    marks.push(...buildBarDepthBackMarks({ backs, categoryAccessor, depthGradientIds, depthLegendOpacity, depthMinBarHeight, depthSegmentsAccessor, projectValue, renderData, resolvedSeries }));
  }
  return marks;
};

interface BarSpecCommonParams {
  readonly margin: ChartMargin;
  readonly gridGuide: ReturnType<typeof resolveGridGuide>;
  readonly xAxisOptions: ReturnType<typeof buildBarAxisSection>["xAxisOptions"];
  readonly yAxisOptions: ReturnType<typeof buildBarAxisSection>["yAxisOptions"];
  readonly xScaleFactory: () => ScaleBand<string>;
  readonly yScale: ReturnType<typeof createNicedYScale>;
  readonly barFocusStrategy: ChartFocusStrategy<ChartDatum, string, number>;
  readonly tooltipOption: ReturnType<typeof buildBarTooltipOption>;
}

interface BarPlainDefinitionParams extends BarPlainMarksParams, Omit<BarSpecCommonParams, "tooltipOption"> {
  readonly hoverMarks: readonly ChartMark<ChartDatum, string, number>[];
  readonly tooltipEnabled: boolean;
}

const buildPlainBarDefinition = ({
  resolvedSeries,
  groupScale,
  groupBandwidth,
  barEnterMotion,
  categoryAccessor,
  projectValue,
  renderData,
  legendHoveredKey,
  hoverMarks,
  margin,
  gridGuide,
  xAxisOptions,
  yAxisOptions,
  xScaleFactory,
  yScale,
  barFocusStrategy,
  tooltipEnabled,
}: Readonly<BarPlainDefinitionParams>): DomChartDefinition<ChartDatum, string, number> => {
  const marks = buildBarPlainMarks({ barEnterMotion, categoryAccessor, groupBandwidth, groupScale, legendHoveredKey, projectValue, renderData, resolvedSeries });
  marks.push(...hoverMarks);
  const tooltipOption = buildBarTooltipOption({ renderDataLength: renderData.length, tooltipEnabled });
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
  return defineChart({ ...spec, focus: barFocusStrategy, focusRing: false, maxFocusDistance: CARTESIAN_MAX_FOCUS_DISTANCE_PX, tooltip: tooltipOption });
};

interface BarFullMarksParams {
  readonly allSeriesKeys: readonly string[];
  readonly margin: ChartMargin;
  readonly resolvedSeries: readonly ResolvedSeries[];
  readonly resolvedBarSquares: readonly ResolvedBarSquare[];
  readonly barDepthBacksRaw: readonly Readonly<BarDepthBackConfig>[];
  readonly barDepthFrontsRaw: readonly Readonly<BarDepthFrontConfig>[];
  readonly barPulsesRaw: readonly Readonly<BarPulseConfig>[];
  readonly hasSquares: boolean;
  readonly hasTrack: boolean;
  readonly hasDepth: boolean;
  readonly totalSeriesCount: number;
  readonly width: number;
  readonly groupBandwidth: number;
  readonly groupScale: ScaleBand<string>;
  readonly categoryAccessor: (datum: Readonly<ChartDatum>) => string;
  readonly projectValue: (dataKey: string, value: number) => number;
  readonly renderData: readonly Readonly<ChartDatum>[];
  readonly barEnterMotion: ChartMotionDefinition<ChartDatum>;
  readonly legendHoveredKey: string | undefined;
  readonly depthLegendOpacity: number | undefined;
  readonly hoverMarks: readonly ChartMark<ChartDatum, string, number>[];
  readonly resolvedBarColumnTracks: readonly ResolvedBarColumnTrack[];
  readonly squaresDefsByKey: ReadonlyMap<string, ResolvedSquareDef>;
  readonly squaresBaseId: string;
  readonly depthGradientIds: BarDepthGradientIds;
  readonly nativeDepthGradients: readonly BuiltDepthGradient[];
  readonly pulseWaveGradientId: string;
  readonly tooltipEnabled: boolean;
  readonly depthMinBarHeight?: number;
  readonly depthSegmentsAccessor?: BarDepthSegmentsAccessor;
}

interface BarFullDefinitionParams extends BarFullMarksParams, Omit<BarSpecCommonParams, "tooltipOption"> {}

const buildFullBarMarks = (params: Readonly<BarFullMarksParams>): ChartMark<ChartDatum, string, number>[] => {
  const marks = buildBarUnderlayMarks({
    allSeriesKeys: params.allSeriesKeys,
    backs: params.barDepthBacksRaw,
    categoryAccessor: params.categoryAccessor,
    depthGradientIds: params.depthGradientIds,
    depthLegendOpacity: params.depthLegendOpacity,
    depthMinBarHeight: params.depthMinBarHeight,
    depthSegmentsAccessor: params.depthSegmentsAccessor,
    hasDepth: params.hasDepth,
    hasSquares: params.hasSquares,
    hasTrack: params.hasTrack,
    legendHoveredKey: params.legendHoveredKey,
    projectValue: params.projectValue,
    renderData: params.renderData,
    resolvedSeries: params.resolvedSeries,
    seriesCount: params.totalSeriesCount,
    squares: params.resolvedBarSquares,
    squaresBaseId: params.squaresBaseId,
    squaresDefsByKey: params.squaresDefsByKey,
    tracks: params.resolvedBarColumnTracks,
  });
  const squaresKeys = new Set(params.resolvedBarSquares.map((square) => square.dataKey));
  const depthKeys = params.hasDepth ? new Set([...params.barDepthBacksRaw.map((back) => back.dataKey), ...params.barDepthFrontsRaw.map((front) => front.dataKey)]) : new Set<string>();
  marks.push(...buildBarSeriesMarks({ barEnterMotion: params.barEnterMotion, categoryAccessor: params.categoryAccessor, depthKeys, depthMinBarHeight: params.depthMinBarHeight, groupBandwidth: params.groupBandwidth, groupScale: params.groupScale, legendHoveredKey: params.legendHoveredKey, projectValue: params.projectValue, renderData: params.renderData, resolvedSeries: params.resolvedSeries, squaresKeys }));
  if (params.hasDepth) {
    marks.push(...buildBarDepthFrontMarks({ categoryAccessor: params.categoryAccessor, depthGradientIds: params.depthGradientIds, depthLegendOpacity: params.depthLegendOpacity, depthMinBarHeight: params.depthMinBarHeight, depthSegmentsAccessor: params.depthSegmentsAccessor, fronts: params.barDepthFrontsRaw, projectValue: params.projectValue, pulseWaveGradientId: params.pulseWaveGradientId, pulses: params.barPulsesRaw, renderData: params.renderData }));
  }
  marks.push(...params.hoverMarks);
  return marks;
};

const buildFullBarDefinition = (params: Readonly<BarFullDefinitionParams>): DomChartDefinition<ChartDatum, string, number> => {
  const marks = buildFullBarMarks(params);
  const tooltipOption = buildBarTooltipOption({ renderDataLength: params.renderData.length, tooltipEnabled: params.tooltipEnabled });
  const spec = {
    gradients: params.nativeDepthGradients,
    margin: params.margin,
    marks,
    // Tick counts reach guides only via axis.ticks.count; a bare ticks: key is never read.
    scales: {
      x: { axis: params.xAxisOptions, grid: params.gridGuide.vertical, scale: params.xScaleFactory },
      y: {
        axis: params.yAxisOptions,
        grid: params.gridGuide.horizontal,
        scale: params.yScale,
      },
    },
    svgAnimation: false as const,
    theme: { muted: "var(--color-chart-label, var(--chart-label))" },
  } as const;
  return defineChart({ ...spec, focus: params.barFocusStrategy, focusRing: false, maxFocusDistance: CARTESIAN_MAX_FOCUS_DISTANCE_PX, tooltip: tooltipOption });
};

// Plain-vs-full dispatch: bare bars take the short path; tracks/squares/depth use the full spec.
const buildBarDefinition = (
  params: Readonly<BarFullDefinitionParams>,
): DomChartDefinition<ChartDatum, string, number> => {
  if (!params.hasSquares && !params.hasTrack && !params.hasDepth) {
    return buildPlainBarDefinition(params);
  }
  return buildFullBarDefinition(params);
};

export type { ResolvedBarColumnTrack, ResolvedBarSquare, ResolvedSeries, ResolvedSquareDef, SquareGradientDef };
export { BAR_DEPTH_BACK_NODES_PER_ROW, buildBarDefinition, buildSquareGradientDef, countSquarePrimitives };
