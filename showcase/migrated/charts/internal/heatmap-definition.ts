import { useMemo } from "react";
import type { ChartFocusMatch, ChartMark, ChartMarkState, ChartMotionDefinition, ChartMotionTiming, ChartRectStateStyle, DomChartDefinition } from "@tanstack/charts";
import { defineChart } from "@tanstack/charts/scene";
import { scaleBand } from "@tanstack/charts/scales/band";
import { tooltip } from "@tanstack/charts/tooltip";
import { cell } from "@tanstack/charts/rect";
import { withStates } from "./with-states";
import {
  computeHeatmapEnterFadeDelayMs,
  HEATMAP_DEFAULT_ENTER_EASE,
  resolveHeatmapEnterFadeDurationSec,
} from "./heatmap-lifecycle";
import type { HeatmapEnterTransition } from "./heatmap-lifecycle";
import { heatmapLevelCellFillOpacity, heatmapLevelPatternId, isHeatmapLevelPattern } from "./heatmap-colors";
import type { HeatmapLevelStyles } from "./heatmap-colors";
import type { HeatmapMargin } from "./heatmap-context";
import {
  formatHeatmapMonthShort,
  formatHeatmapYAxisLabel,
  getHeatmapColumnMonthAnchor,
  getHeatmapDayLabels,
  resolveHeatmapRowOpacity,
  shouldShowHeatmapYAxisTick,
} from "./heatmap-utils";
import type {
  HeatmapColumn,
  HeatmapWeekStartDay,
  HeatmapYAxisLabelFormat,
  HeatmapYAxisTickFilter,
} from "./heatmap-utils";
import type { CellDatum } from "./heatmap-cell-data";
import { HEATMAP_CELL_INSET } from "./heatmap-cell-data";

/*
 * Bklit `positionBox` parity: 16px stand-off shared by the native tooltip offset and legacy call sites.
 */
const HEATMAP_TOOLTIP_DEFAULT_OFFSET = 16;

// Newton-Raphson iteration budget for the cubic-bezier solver below.
const NEWTON_RAPHSON_ITERATION_COUNT = 6;
// Convergence tolerance for the bezier x(t) solve.
const BEZIER_SOLVE_TOLERANCE = 1e-5;
// Cubic Bernstein weight of the two inner control points.
const CUBIC_BEZIER_WEIGHT = 3;
// Derivative weight of the middle control-point span.
const CUBIC_BEZIER_SLOPE_MIDDLE_WEIGHT = 6;
// Seconds-to-milliseconds factor for the enter-fade duration.
const MS_PER_SECOND = 1000;

const solveCubicBezierEasing = (points: readonly [number, number, number, number]): ((progress: number) => number) => {
  const [x1, y1, x2, y2] = points;
  const bezierX = (param: number): number => CUBIC_BEZIER_WEIGHT * param * (1 - param) * (1 - param) * x1 + CUBIC_BEZIER_WEIGHT * param * param * (1 - param) * x2 + param * param * param;
  const bezierY = (param: number): number => CUBIC_BEZIER_WEIGHT * param * (1 - param) * (1 - param) * y1 + CUBIC_BEZIER_WEIGHT * param * param * (1 - param) * y2 + param * param * param;
  return (progress: number) => {
    if (progress <= 0 || progress >= 1) {return progress <= 0 ? 0 : 1;}
    let param = progress;
    for (let iteration = 0; iteration < NEWTON_RAPHSON_ITERATION_COUNT; iteration += 1) {
      const err = bezierX(param) - progress;
      const dx = CUBIC_BEZIER_WEIGHT * (1 - param) * (1 - param) * x1 + CUBIC_BEZIER_SLOPE_MIDDLE_WEIGHT * param * (1 - param) * (x2 - x1) + CUBIC_BEZIER_WEIGHT * param * param * (1 - x2);
      if (Math.abs(err) < BEZIER_SOLVE_TOLERANCE || dx === 0) {break;}
      param -= err / dx;
    }
    return bezierY(param);
  };
};

/*
 * Named easing only: the engine rejects raw `cubic-bezier()` strings, so legacy standard ease is approximated.
 */
const HEATMAP_HOVER_TRANSITION: NonNullable<ChartMarkState["transition"]> = {
  duration: 220,
  easing: "ease-in-out",
  type: "tween",
};

/*
 * Absolute `inset` target, not a delta: symmetric shrink about center reproduces a centered CSS scale.
 * Bandwidth here is the host-derived cell-size hint (no d3 scale object).
 */
const heatmapHoverInset = (bandwidth: number, scale: number, baseInset: number): number => {
  if (scale === 1) {return baseInset;}
  const contentSize = Math.max(0, bandwidth - baseInset * 2);
  return Math.max(0, (bandwidth - contentSize * scale) / 2);
};

interface HeatmapHoverStatesParams {
  readonly bandwidth: number;
  readonly baseInset: number;
  readonly inactiveOpacity: number;
  readonly inactiveScale: number;
  readonly activeScale: number;
}

const heatmapHoverStates = ({
  bandwidth,
  baseInset,
  inactiveOpacity,
  inactiveScale,
  activeScale,
}: Readonly<HeatmapHoverStatesParams>): ChartMarkState<CellDatum, ChartRectStateStyle<CellDatum>>[] | undefined => {
  const states: ChartMarkState<CellDatum, ChartRectStateStyle<CellDatum>>[] = [];
  if (activeScale !== 1) {
    states.push({
      style: { inset: heatmapHoverInset(bandwidth, activeScale, baseInset) },
      transition: HEATMAP_HOVER_TRANSITION,
      when: (context: Readonly<{ datum: Readonly<CellDatum>; focus: Readonly<{ source: string }>; matches: (match: ChartFocusMatch) => boolean }>) =>
        context.focus.source === "pointer" && !context.datum.isGhost && context.matches("primary"),
    });
  }
  if (inactiveOpacity !== 1 || inactiveScale !== 1) {
    const hoverInset = inactiveScale === 1 ? undefined : { inset: heatmapHoverInset(bandwidth, inactiveScale, baseInset) };
    states.push({
      style: {
        opacity: inactiveOpacity,
        ...hoverInset,
      },
      transition: HEATMAP_HOVER_TRANSITION,
      when: (context: Readonly<{ datum: Readonly<CellDatum>; focus: Readonly<{ source: string }>; matches: (match: ChartFocusMatch) => boolean }>) =>
        context.focus.source === "pointer" && !context.datum.isGhost && !context.matches("primary"),
    });
  }
  return states.length === 0 ? undefined : states;
};

interface HeatmapLegendDimStatesParams {
  readonly bandwidth: number;
  readonly baseInset: number;
  readonly inactiveOpacity: number;
  readonly inactiveScale: number;
  readonly activeScale: number;
}

interface HeatmapLegendDimContext {
  readonly datum: Readonly<CellDatum>;
  readonly focus: Readonly<{ source: string; primary: Readonly<{ datum: Readonly<CellDatum> }> }>;
}

// Legend dim resolves against the programmatic primary (legacy level parity).
// Same-level cells stay bright while the rest dim.
const heatmapLegendDimStates = ({
  bandwidth,
  baseInset,
  inactiveOpacity,
  inactiveScale,
  activeScale,
}: Readonly<HeatmapLegendDimStatesParams>): ChartMarkState<CellDatum, ChartRectStateStyle<CellDatum>>[] | undefined => {
  const states: ChartMarkState<CellDatum, ChartRectStateStyle<CellDatum>>[] = [];
  if (activeScale !== 1) {
    states.push({
      style: { inset: heatmapHoverInset(bandwidth, activeScale, baseInset) },
      transition: HEATMAP_HOVER_TRANSITION,
      when: (context: Readonly<HeatmapLegendDimContext>) =>
        context.focus.source === "programmatic" && !context.datum.isGhost && context.datum.level === context.focus.primary.datum.level,
    });
  }
  if (inactiveOpacity !== 1 || inactiveScale !== 1) {
    const dimInset = inactiveScale === 1 ? undefined : { inset: heatmapHoverInset(bandwidth, inactiveScale, baseInset) };
    states.push({
      style: {
        opacity: inactiveOpacity,
        ...dimInset,
      },
      transition: HEATMAP_HOVER_TRANSITION,
      when: (context: Readonly<HeatmapLegendDimContext>) =>
        context.focus.source === "programmatic" && !context.datum.isGhost && context.datum.level !== context.focus.primary.datum.level,
    });
  }
  return states.length === 0 ? undefined : states;
};

interface HeatmapCellMotionFnParams {
  readonly animationDuration: number;
  readonly durMs: number;
  readonly easingFn: (progress: number) => number;
  readonly enterStaggerScale: number;
  readonly fadeDurationSec: number;
  readonly revealEpoch: number;
}

const createHeatmapCellMotionFn = ({
  animationDuration,
  durMs,
  easingFn,
  enterStaggerScale,
  fadeDurationSec,
  revealEpoch,
}: Readonly<HeatmapCellMotionFnParams>): ChartMotionDefinition<CellDatum> =>
  (motionCtx: Readonly<{ phase: string; datum: Readonly<CellDatum> | undefined }>): false | ChartMotionTiming<CellDatum> | undefined => {
    if (motionCtx.phase !== "enter") {return false;}
    const { datum } = motionCtx;
    if (!datum) {return undefined;}
    return {
      delay: computeHeatmapEnterFadeDelayMs({
        animationDurationMs: animationDuration,
        column: datum.column,
        enterStaggerScale,
        fadeDurationSec,
        revealEpoch,
        row: datum.row,
      }),
      transition: { duration: durMs, easing: easingFn, type: "tween" },
    };
  };

interface HeatmapCellMotionParams {
  readonly animateCells: boolean;
  readonly animationDuration: number;
  readonly enterTransition: Readonly<HeatmapEnterTransition> | undefined;
  readonly enterStaggerScale: number;
  readonly revealEpoch: number;
}

const useHeatmapCellMotion = ({
  animateCells,
  animationDuration,
  enterTransition,
  enterStaggerScale,
  revealEpoch,
}: Readonly<HeatmapCellMotionParams>): ChartMotionDefinition<CellDatum> | false =>
  useMemo<ChartMotionDefinition<CellDatum> | false>(() => {
    if (!animateCells || animationDuration <= 0) {return false;}
    const fadeDurationSec = resolveHeatmapEnterFadeDurationSec(enterTransition, animationDuration);
    const durMs = fadeDurationSec * MS_PER_SECOND;
    const easingFn = solveCubicBezierEasing(enterTransition?.ease ?? HEATMAP_DEFAULT_ENTER_EASE);
    return createHeatmapCellMotionFn({ animationDuration, durMs, easingFn, enterStaggerScale, fadeDurationSec, revealEpoch });
  }, [animateCells, animationDuration, enterTransition, enterStaggerScale, revealEpoch]);

const buildHeatmapTooltipOption = (
  tooltipEnabled: boolean,
): false | {
  className: string;
  motion: false;
  offset: number;
  placement: readonly ["right", "left"];
  sticky: boolean;
  use: typeof tooltip;
} => {
  if (!tooltipEnabled) {return false;}
  const placement: readonly ["right", "left"] = ["right", "left"];
  return {
    className: "bkm-native-tooltip",
    motion: false,
    offset: HEATMAP_TOOLTIP_DEFAULT_OFFSET,
    placement,
    sticky: false,
    use: tooltip,
  };
};

// One x tick per month transition across week columns (package `ticks.values`).
const buildHeatmapXTickValues = (columns: readonly HeatmapColumn[]): string[] => {
  const values: string[] = [];
  let lastMonthKey = "";
  for (const [columnIndex, column] of columns.entries()) {
    const anchor = getHeatmapColumnMonthAnchor(column);
    if (anchor !== undefined) {
      const monthKey = `${anchor.getFullYear()}-${anchor.getMonth()}`;
      if (monthKey !== lastMonthKey) {
        lastMonthKey = monthKey;
        values.push(String(columnIndex));
      }
    }
  }
  return values;
};

const buildHeatmapXTickFormat = (columns: readonly HeatmapColumn[]): ((value: string) => string) => {
  const labelByKey = new Map<string, string>();
  let lastMonthKey = "";
  for (const [columnIndex, column] of columns.entries()) {
    const anchor = getHeatmapColumnMonthAnchor(column);
    if (anchor !== undefined) {
      const monthKey = `${anchor.getFullYear()}-${anchor.getMonth()}`;
      if (monthKey !== lastMonthKey) {
        lastMonthKey = monthKey;
        labelByKey.set(String(columnIndex), formatHeatmapMonthShort(anchor));
      }
    }
  }
  return (value: string): string => labelByKey.get(value) ?? value;
};

type HeatmapRowOpacity = number | readonly number[] | undefined;

interface HeatmapCellMarkParams {
  readonly cellData: readonly Readonly<CellDatum>[];
  readonly resolvedLevelStyles: HeatmapLevelStyles;
  readonly rowOpacity: HeatmapRowOpacity;
  readonly cornerRadius: number;
  readonly focusStates: ChartMarkState<CellDatum, ChartRectStateStyle<CellDatum>>[] | undefined;
  readonly cellMotion: ChartMotionDefinition<CellDatum> | false;
  readonly revealEpoch: number;
  readonly patternIdPrefix: string | undefined;
}

type HeatmapCellMark = ChartMark<Readonly<CellDatum>, string, string>;

// Fallback level used when a datum's level has no resolved style.
const FALLBACK_LEVEL_INDEX = 0;

const heatmapCellFill = (
  level: number,
  resolvedLevelStyles: HeatmapLevelStyles,
  patternIdPrefix: string | undefined,
): string => {
  const style = resolvedLevelStyles[level] ?? resolvedLevelStyles[FALLBACK_LEVEL_INDEX];
  if (isHeatmapLevelPattern(style)) {
    const id = heatmapLevelPatternId(level);
    const scoped = patternIdPrefix === undefined || patternIdPrefix === "" ? id : `${patternIdPrefix}-${id}`;
    return `url(#${scoped})`;
  }
  return style.color;
};

const useHeatmapCellMarks = ({
  cellData,
  resolvedLevelStyles,
  rowOpacity,
  cornerRadius,
  focusStates,
  cellMotion,
  revealEpoch,
  patternIdPrefix,
}: Readonly<HeatmapCellMarkParams>): HeatmapCellMark[] => useMemo(() => {
  // One mark per (level, fillOpacity): marks take a scalar fillOpacity, so levels
  // With different paints never share a mark and the color scale is unnecessary.
  const buckets = new Map<string, { level: number; fillOpacity: number; data: Readonly<CellDatum>[] }>();
  for (const datum of cellData) {
    const style = resolvedLevelStyles[datum.level] ?? resolvedLevelStyles[FALLBACK_LEVEL_INDEX];
    const fillOpacity = resolveHeatmapRowOpacity(datum.row, rowOpacity) * heatmapLevelCellFillOpacity(style);
    const key = `${datum.level}:${fillOpacity}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { data: [], fillOpacity, level: datum.level };
      buckets.set(key, bucket);
    }
    bucket.data.push(datum);
  }
  return [...buckets.values()].map((bucket) => {
    const mark = cell(bucket.data, {
      fill: heatmapCellFill(bucket.level, resolvedLevelStyles, patternIdPrefix),
      fillOpacity: bucket.fillOpacity,
      id: `heatmap-cell-l${bucket.level}-fo-${bucket.fillOpacity}`,
      inset: HEATMAP_CELL_INSET,
      key: (datum: Readonly<CellDatum>) => `${datum.column}-${datum.row}:${revealEpoch}`,
      motion: cellMotion,
      radius: cornerRadius,
      x: (datum: Readonly<CellDatum>) => datum.colKey,
      y: (datum: Readonly<CellDatum>) => datum.rowKey,
      z: (datum: Readonly<CellDatum>) => datum.level,
    });
    // I1 wrapper (D528 pattern): package resolves hover plus legend dim.
    // Empty definitions leave the mark untouched.
    return withStates(mark, bucket.data, focusStates ?? []);
  });
}, [cellData, resolvedLevelStyles, rowOpacity, cornerRadius, focusStates, cellMotion, revealEpoch, patternIdPrefix]);

interface HeatmapChartDefinitionParams {
  readonly cellData: readonly Readonly<CellDatum>[];
  readonly columns: readonly HeatmapColumn[];
  readonly weekStartDay: HeatmapWeekStartDay;
  readonly margin: Readonly<HeatmapMargin>;
  readonly cornerRadius: number;
  readonly resolvedLevelStyles: HeatmapLevelStyles;
  readonly patternIdPrefix: string | undefined;
  readonly tooltipEnabled: boolean;
  readonly inactiveOpacity: number;
  readonly inactiveScale: number;
  readonly activeScale: number;
  readonly rowOpacity: HeatmapRowOpacity;
  readonly yTickFilter: HeatmapYAxisTickFilter;
  readonly yLabelFormat: HeatmapYAxisLabelFormat;
  readonly yRowOpacity: HeatmapRowOpacity;
  readonly bandwidthHint: number;
  readonly chartStatus: string;
  readonly revealEpoch: number;
  readonly animationDuration: number;
  readonly enterTransition: Readonly<HeatmapEnterTransition> | undefined;
  readonly enterStaggerScale: number;
  readonly animateCells: boolean;
}

const useHeatmapChartDefinition = ({
  cellData,
  columns,
  weekStartDay,
  margin,
  cornerRadius,
  resolvedLevelStyles,
  patternIdPrefix,
  tooltipEnabled,
  inactiveOpacity,
  inactiveScale,
  activeScale,
  rowOpacity,
  yTickFilter,
  yLabelFormat,
  yRowOpacity,
  bandwidthHint,
  chartStatus,
  revealEpoch,
  animationDuration,
  enterTransition,
  enterStaggerScale,
  animateCells,
}: Readonly<HeatmapChartDefinitionParams>): DomChartDefinition<Readonly<CellDatum>, string, string> => {
  const hoverStates = useMemo(
    () =>
      heatmapHoverStates({
        activeScale,
        bandwidth: bandwidthHint,
        baseInset: HEATMAP_CELL_INSET,
        inactiveOpacity,
        inactiveScale,
      }),
    [bandwidthHint, inactiveOpacity, inactiveScale, activeScale],
  );
  const legendStates = useMemo(
    () =>
      heatmapLegendDimStates({
        activeScale,
        bandwidth: bandwidthHint,
        baseInset: HEATMAP_CELL_INSET,
        inactiveOpacity,
        inactiveScale,
      }),
    [bandwidthHint, inactiveOpacity, inactiveScale, activeScale],
  );
  const focusStates = useMemo(
    () => [...(hoverStates ?? []), ...(legendStates ?? [])],
    [hoverStates, legendStates],
  );
  const cellMotion = useHeatmapCellMotion({ animateCells, animationDuration, enterStaggerScale, enterTransition, revealEpoch });
  const cellMarks = useHeatmapCellMarks({
    cellData,
    cellMotion,
    cornerRadius,
    focusStates,
    patternIdPrefix,
    resolvedLevelStyles,
    revealEpoch,
    rowOpacity,
  });

  const xTickValues = useMemo(() => buildHeatmapXTickValues(columns), [columns]);
  const xTickFormat = useMemo(() => buildHeatmapXTickFormat(columns), [columns]);
  const dayLabels = useMemo(() => getHeatmapDayLabels(weekStartDay), [weekStartDay]);
  // Fixed domains: factory inference scrambles row order across marks.
  const colKeys = useMemo(() => columns.map((_column, columnIndex) => String(columnIndex)), [columns]);
  const xScale = useMemo(() => scaleBand().domain(colKeys).padding(0), [colKeys]);
  const yScale = useMemo(() => scaleBand().domain([...dayLabels]).padding(0), [dayLabels]);
  const yTickValues = useMemo(
    () => dayLabels.filter((_label, row) => shouldShowHeatmapYAxisTick(row, yTickFilter)),
    [dayLabels, yTickFilter],
  );
  const yTickFormat = useMemo(
    () => (value: string): string => formatHeatmapYAxisLabel(value, yLabelFormat),
    [yLabelFormat],
  );
  const yTickOpacity = useMemo(() => {
    const opacity = yRowOpacity ?? rowOpacity;
    if (opacity === undefined) {return 1;}
    return (ctx: Readonly<{ value: string; index: number }>): number => {
      const row = dayLabels.indexOf(ctx.value);
      return resolveHeatmapRowOpacity(row === -1 ? ctx.index : row, opacity);
    };
  }, [dayLabels, rowOpacity, yRowOpacity]);

  return useMemo(() => {
    if (chartStatus === "loading") {
      return defineChart({
        focusRing: false,
        margin,
        // SAFETY: an empty array inhabits every array type; the assertion keeps
        // Both definition branches on the same mark element type.
        marks: [] as typeof cellMarks,
        scales: {
          x: { axis: false, guide: false, scale: xScale },
          y: { axis: false, guide: false, scale: yScale },
        },
        svgAnimation: false,
      });
    }
    // V2.2 pointer: package resolves the hovered cell (finite default distance).
    // Band rects need no spatial index; pointer stays enabled.
    return defineChart({
      focusRing: false,
      margin,
      marks: cellMarks,
      scales: {
        x: {
          axis: {
            line: false,
            tickLabels: {
              dx: ({ bandwidth }: Readonly<{ bandwidth: number }>): number => -bandwidth / 2,
              fontSize: 12,
              thin: true,
            },
            ticks: { format: xTickFormat, padding: 4, size: 0, values: xTickValues },
          },
          guide: false,
          scale: xScale,
          side: "top",
        },
        y: {
          axis: {
            line: false,
            tickLabels: { fontSize: 12, opacity: yTickOpacity, thin: false },
            ticks: { format: yTickFormat, padding: 4, size: 0, values: yTickValues },
          },
          guide: false,
          scale: yScale,
          side: "left",
        },
      },
      svgAnimation: false,
      tooltip: buildHeatmapTooltipOption(tooltipEnabled),
    });
  }, [cellMarks, margin, chartStatus, tooltipEnabled, xScale, xTickFormat, xTickValues, yScale, yTickFormat, yTickValues, yTickOpacity]);
};

const hasPatternLevelStyles = (levelStyles: HeatmapLevelStyles): boolean =>
  levelStyles.some((style) => isHeatmapLevelPattern(style));

export {
  HEATMAP_TOOLTIP_DEFAULT_OFFSET,
  buildHeatmapTooltipOption,
  createHeatmapCellMotionFn,
  hasPatternLevelStyles,
  heatmapHoverStates,
  heatmapLegendDimStates,
  solveCubicBezierEasing,
  useHeatmapCellMarks,
  useHeatmapCellMotion,
  useHeatmapChartDefinition,
};
export type { HeatmapCellMark, HeatmapCellMarkParams, HeatmapCellMotionFnParams, HeatmapCellMotionParams, HeatmapChartDefinitionParams, HeatmapRowOpacity };
