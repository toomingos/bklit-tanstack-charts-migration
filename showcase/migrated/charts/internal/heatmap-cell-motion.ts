import { useMemo } from "react";
import type { ChartMotionDefinition, ChartMotionTiming } from "@tanstack/charts";
import { scaleBand, scaleOrdinal } from "d3-scale";
import type { ScaleBand, ScaleOrdinal } from "d3-scale";
import {
  computeHeatmapEnterFadeDelayMs,
  HEATMAP_DEFAULT_ENTER_EASE,
  resolveHeatmapEnterFadeDurationSec,
} from "./heatmap-animation";
import type { HeatmapEnterTransition } from "./heatmap-animation";
import { heatmapLevelPatternId, isHeatmapLevelPattern } from "./heatmap-colors";
import type { HeatmapLevelStyles } from "./heatmap-colors";
import type { HeatmapMargin } from "./heatmap-context";
import type { CellDatum } from "./heatmap-cell-data";

/*
 * Native motion easing accepts only keywords or a progress fn, so the 4-tuple ease is solved here.
 */
// Newton-Raphson iteration budget for the cubic-bezier solver below.
// Changing the count reshapes every cell's enter easing, so it stays verbatim.
const NEWTON_RAPHSON_ITERATION_COUNT = 6;
// Convergence tolerance for the bezier x(t) solve; below this the residual is
// Sub-progress-space noise on the resulting opacity.
const BEZIER_SOLVE_TOLERANCE = 1e-5;
// A heatmap with zero columns still renders one (empty) column slot so the
// Band scales below stay defined.
const MIN_COLUMN_COUNT = 1;
// Seconds-to-milliseconds factor for the enter-fade duration.
const MS_PER_SECOND = 1000;
// Cubic Bernstein weight of the two inner control points in the bezier solver below.
const CUBIC_BEZIER_WEIGHT = 3;
// Derivative weight of the middle control-point span in the Newton-Raphson slope below.
const CUBIC_BEZIER_SLOPE_MIDDLE_WEIGHT = 6;
// Highest heatmap intensity level; the ordinal domain spans the empty slot plus levels 0-4.
const HEATMAP_MAX_LEVEL = 4;
// Second-highest heatmap intensity level.
const HEATMAP_HIGH_LEVEL = 3;

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

interface HeatmapColorScaleParams {
  readonly resolvedLevelStyles: HeatmapLevelStyles;
  readonly patternIdPrefix: string | undefined;
}

const useHeatmapColorScale = ({
  resolvedLevelStyles,
  patternIdPrefix,
}: Readonly<HeatmapColorScaleParams>): ScaleOrdinal<number, string> =>
  useMemo<ScaleOrdinal<number, string>>(() => {
    /*
     * Bklit parity: pattern-mode fills reference overlay-svg defs under the same prefix, useId-scoped
     * so two chart instances do not collide.
     */
    const rangeEntry = (level: number): string => {
      const style = resolvedLevelStyles[level];
      if (!isHeatmapLevelPattern(style)) {return style.color;}
      const id = heatmapLevelPatternId(level);
      const scopedPatternId = patternIdPrefix === undefined ? id : `${patternIdPrefix}-${id}`;
      return `url(#${scopedPatternId})`;
    };
    return (
      scaleOrdinal<number, string>()
        .domain([-1, 0, 1, 2, HEATMAP_HIGH_LEVEL, HEATMAP_MAX_LEVEL])
        .range([
          "transparent",
          rangeEntry(0),
          rangeEntry(1),
          rangeEntry(2),
          rangeEntry(HEATMAP_HIGH_LEVEL),
          rangeEntry(HEATMAP_MAX_LEVEL),
        ])
    );
  }, [resolvedLevelStyles, patternIdPrefix]);

interface HeatmapCellScalesParams {
  readonly columnCount: number;
  readonly dayLabels: readonly string[];
  readonly margin: Readonly<HeatmapMargin>;
  readonly innerWidth: number;
  readonly innerHeight: number;
}

interface HeatmapCellScales {
  readonly xScale: ScaleBand<string>;
  readonly yScale: ScaleBand<string>;
}

const useHeatmapCellScales = ({
  columnCount,
  dayLabels,
  margin,
  innerWidth,
  innerHeight,
}: Readonly<HeatmapCellScalesParams>): HeatmapCellScales => {
  const columnKeys = useMemo(
    () => Array.from({ length: Math.max(columnCount, MIN_COLUMN_COUNT) }, (_unused, index) => String(index)),
    [columnCount],
  );
  const rowKeys = useMemo(() => [...dayLabels], [dayLabels]);

  const xScale = useMemo<ScaleBand<string>>(
    () =>
      scaleBand()
        .domain(columnKeys)
        .range([margin.left, margin.left + innerWidth])
        .paddingInner(0)
        .paddingOuter(0),
    [columnKeys, margin.left, innerWidth],
  );

  const yScale = useMemo<ScaleBand<string>>(
    () =>
      scaleBand()
        .domain(rowKeys)
        .range([margin.top + innerHeight, margin.top])
        .paddingInner(0)
        .paddingOuter(0),
    [rowKeys, margin.top, innerHeight],
  );

  return { xScale, yScale };
};

interface HeatmapCellMotionParams {
  readonly animateCells: boolean;
  readonly animationDuration: number;
  readonly enterTransition: Readonly<HeatmapEnterTransition> | undefined;
  readonly enterStaggerScale: number;
  readonly revealEpoch: number;
}

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

const useHeatmapCellMotion = ({
  animateCells,
  animationDuration,
  enterTransition,
  enterStaggerScale,
  revealEpoch,
}: Readonly<HeatmapCellMotionParams>): ChartMotionDefinition<CellDatum> | false =>
  /*
   * Native cell() motion replaces the old imperative WAAPI driver; delay math stays byte-for-byte
   * seeded-PRNG parity with heatmap-animation.ts.
   */
  useMemo<ChartMotionDefinition<CellDatum> | false>(() => {
    if (!animateCells || animationDuration <= 0) {return false;}
    const fadeDurationSec = resolveHeatmapEnterFadeDurationSec(enterTransition, animationDuration);
    const durMs = fadeDurationSec * MS_PER_SECOND;
    const easingFn = solveCubicBezierEasing(enterTransition?.ease ?? HEATMAP_DEFAULT_ENTER_EASE);
    return createHeatmapCellMotionFn({ animationDuration, durMs, easingFn, enterStaggerScale, fadeDurationSec, revealEpoch });
  }, [animateCells, animationDuration, enterTransition, enterStaggerScale, revealEpoch]);

export {
  createHeatmapCellMotionFn,
  solveCubicBezierEasing,
  useHeatmapCellMotion,
  useHeatmapCellScales,
  useHeatmapColorScale,
};
export type {
  HeatmapCellMotionFnParams,
  HeatmapCellMotionParams,
  HeatmapCellScales,
  HeatmapCellScalesParams,
  HeatmapColorScaleParams,
};
