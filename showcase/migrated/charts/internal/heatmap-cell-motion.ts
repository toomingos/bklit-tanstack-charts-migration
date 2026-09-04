import { useMemo } from "react";
import type { ChartMotionDefinition } from "@tanstack/charts";
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

// D5: local cubic-bezier progress-function solver — `ChartAnimationOptions`'s
// `easing` field (dist/types.d.ts) only accepts the named keywords or a
// Custom `(progress:number)=>number`, never a raw `cubic-bezier()` string
// (same constraint already documented above HEATMAP_HOVER_TRANSITION), so
// `HeatmapEnterTransition.ease`'s 4-tuple control points (bklit parity, e.g.
// HEATMAP_DEFAULT_ENTER_EASE = [0.85, 0, 0.916, 0.282], heatmap-animation.ts:17)
// Need converting to a progress function for the native per-cell `motion`
// Transition below. Newton-Raphson on the bezier's x(t) (5 iterations is
// More than enough at this curve's slope) to find t for a given x=p, then
// Evaluates y(t).
const solveCubicBezierEasing = (points: readonly [number, number, number, number]): ((p: number) => number) => {
  const [x1, y1, x2, y2] = points;
  const bx = (t: number) => 3 * t * (1 - t) * (1 - t) * x1 + 3 * t * t * (1 - t) * x2 + t * t * t;
  const by = (t: number) => 3 * t * (1 - t) * (1 - t) * y1 + 3 * t * t * (1 - t) * y2 + t * t * t;
  return (p: number) => {
    if (p <= 0 || p >= 1) {return p <= 0 ? 0 : 1;}
    let t = p;
    for (let i = 0; i < 6; i += 1) {
      const err = bx(t) - p;
      const dx = 3 * (1 - t) * (1 - t) * x1 + 6 * t * (1 - t) * (x2 - x1) + 3 * t * t * (1 - x2);
      if (Math.abs(err) < 1e-5 || dx === 0) {break;}
      t -= err / dx;
    }
    return by(t);
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
    // Bklit parity (buildHeatmapFillScale): pattern-mode levels fill with
    // `url(#<prefix>heatmap-level-N)`; the matching <pattern> defs are
    // Mounted in HeatmapCells' overlay svg under the same prefix (useId-
    // Scoped, so two chart instances don't collide — HM14/HM7 lesson).
    const rangeEntry = (level: number) => {
      const style = resolvedLevelStyles[level];
      if (!style || !isHeatmapLevelPattern(style)) {return style?.color ?? "currentColor";}
      const id = heatmapLevelPatternId(level);
      const scopedPatternId = patternIdPrefix ? `${patternIdPrefix}-${id}` : id;
      return `url(#${scopedPatternId})`;
    };
    return (
      scaleOrdinal<number, string>()
        .domain([-1, 0, 1, 2, 3, 4])
        .range([
          "transparent",
          rangeEntry(0),
          rangeEntry(1),
          rangeEntry(2),
          rangeEntry(3),
          rangeEntry(4),
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
    () => Array.from({ length: Math.max(columnCount, 1) }, (_, i) => String(i)),
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
  (motionCtx: Readonly<{ phase: string; datum: Readonly<CellDatum> | undefined }>) => {
    if (motionCtx.phase !== "enter") {return false;}
    const d = motionCtx.datum;
    if (!d) {return undefined;}
    return {
      delay: computeHeatmapEnterFadeDelayMs({
        animationDurationMs: animationDuration,
        column: d.column,
        enterStaggerScale,
        fadeDurationSec,
        revealEpoch,
        row: d.row,
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
  // D5: per-cell enter-fade reveal, expressed via `cell()`'s native `motion`
  // Option (dist/types.d.ts:449, `ChartMarkMotionOptions`) instead of the old
  // Imperative WAAPI driver (deferred-reveal.ts, now unused here). The
  // Per-cell delay math is byte-for-byte the seeded-PRNG formula already
  // Ported verbatim in heatmap-animation.ts (`computeHeatmapEnterFadeDelayMs`,
  // :73-80 — `seed = heatmapCellSeed(column,row) + revealEpoch*524_287`) —
  // `revealEpoch` is captured by closure below exactly as that formula
  // Requires (coordinator correction 2). Only `opacity` is animated
  // (`motionAttributes` allowlist confirms opacity is in; legacy's reveal
  // Was itself opacity-only per prior confirmation), so this is a pure
  // 1:1 native substitution — no reach-in needed for T1-parity-tier heatmap.
  useMemo<ChartMotionDefinition<CellDatum> | false>(() => {
    if (!animateCells || animationDuration <= 0) {return false;}
    const fadeDurationSec = resolveHeatmapEnterFadeDurationSec(enterTransition, animationDuration);
    const durMs = fadeDurationSec * 1000;
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
