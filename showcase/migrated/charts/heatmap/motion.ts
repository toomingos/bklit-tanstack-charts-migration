import type { ChartMotionDefinition, ChartMotionTiming } from "@tanstack/charts";
import { MS_PER_SECOND } from "../kit/theme";
import { erase } from "../kit/erased-types";
import { cubicBezier } from "../kit/motion/easing";
import type { EnterTransition } from "../kit/motion/phase";
import { resumeEnter, type EnterPlan } from "../kit/motion/resume-enter";

/* Heatmap entrance choreography as native per-datum `motion` timing (a `delay` + tween per cell); the renderer owns the clock, so this is pure arithmetic. */

type HeatmapRevealMode = "enter" | "fromLoading" | null;

/** Enter transition. `duration` is in seconds (bklit/motion convention); `ease` is a cubic-bezier tuple. */
type HeatmapEnterTransition = EnterTransition;

const HEATMAP_DEFAULT_ENTER_DURATION_MS = 1600;
// Ported bklit reveal easing: cubic-bezier(0.85, 0, 0.916, 0.282).
const HEATMAP_DEFAULT_ENTER_EASE = [0.85, 0, 0.916, 0.282] as const;
const HEATMAP_DEFAULT_ENTER_TRANSITION: HeatmapEnterTransition = {
  duration: 1.6,
  ease: HEATMAP_DEFAULT_ENTER_EASE,
  type: "tween",
};
const HEATMAP_LOADING_CHART_OPACITY = 1;
const HEATMAP_DEFAULT_LOADING_CELL_MAX_OPACITY = 0.85;
const HEATMAP_DEFAULT_LOADING_CELL_RANDOMNESS = 1;
const HEATMAP_LOADING_CONCEAL_MS = 450;
const HEATMAP_ENTER_STAGGER_SPREAD = 0.6;
const HEATMAP_HOVER_TRANSITION_MS = 220;
// bklit re-runs every cell's enter `animate` at the trailing ParentSize render (debounce 300 ms, heatmap-chart.tsx:685): the tween restarts from its current value, measured ~340 ms after the cells mount.
const HEATMAP_RESTART_MS = 340;
// The reveal timer (heatmap-chart.tsx:607) cuts the enter at `animationDuration` into the ready tween (heatmap-cells.tsx:41-44,149).
const SETTLED_OPACITY = 0.999;
const HEATMAP_READY_EASE = cubicBezier(0.4, 0, 0.2, 1);

// Lehmer / Park-Miller PRNG (modulus 2^31-1, multiplier 7^5).
const PARK_MILLER_MODULUS = 2_147_483_647;
const PARK_MILLER_MODULUS_MINUS_ONE = 2_147_483_646;
const PARK_MILLER_MULTIPLIER = 16_807;
const seededRandom = (seed: number): (() => number) => {
  let state = seed % PARK_MILLER_MODULUS;
  if (state <= 0) {state += PARK_MILLER_MODULUS_MINUS_ONE;}
  return () => {
    state = (state * PARK_MILLER_MULTIPLIER) % PARK_MILLER_MODULUS;
    return (state - 1) / PARK_MILLER_MODULUS_MINUS_ONE;
  };
};

const HEATMAP_SEED_COLUMN_FACTOR = 1009;
const HEATMAP_SEED_ROW_FACTOR = 9176;
const HEATMAP_REVEAL_EPOCH_SALT = 524_287;
const HEATMAP_MIN_ENTER_STAGGER_SCALE = 0.25;
const HEATMAP_MAX_ENTER_FADE_SEC = 0.45;
const HEATMAP_FADE_DURATION_FRACTION = 0.3;

const heatmapCellSeed = (column: number, row: number): number =>
  column * HEATMAP_SEED_COLUMN_FACTOR + row * HEATMAP_SEED_ROW_FACTOR;

interface ComputeHeatmapEnterFadeDelayParams {
  readonly column: number;
  readonly row: number;
  readonly revealEpoch: number;
  readonly animationDurationMs: number;
  readonly enterStaggerScale: number;
  readonly fadeDurationSec: number;
}

const computeHeatmapEnterFadeDelayMs = (params: Readonly<ComputeHeatmapEnterFadeDelayParams>): number => {
  const seed = heatmapCellSeed(params.column, params.row) + params.revealEpoch * HEATMAP_REVEAL_EPOCH_SALT;
  const random = seededRandom(seed);
  const fadeMs = params.fadeDurationSec * MS_PER_SECOND;
  const maxDelayMs = Math.max(0, params.animationDurationMs - fadeMs);
  const spreadMs = maxDelayMs * HEATMAP_ENTER_STAGGER_SPREAD * Math.max(params.enterStaggerScale, HEATMAP_MIN_ENTER_STAGGER_SCALE);
  return random() * spreadMs;
};

const resolveHeatmapEnterFadeDurationSec = (
  enterTransition: Readonly<HeatmapEnterTransition> | undefined,
  animationDurationMs: number,
): number => {
  if (enterTransition?.duration !== undefined) {return enterTransition.duration;}
  return Math.min(HEATMAP_MAX_ENTER_FADE_SEC, (animationDurationMs / MS_PER_SECOND) * HEATMAP_FADE_DURATION_FRACTION);
};

const isBezierTuple = (ease: unknown): ease is readonly [number, number, number, number] =>
  Array.isArray(ease) && ease.length === 4 && ease.every((point) => Number.isFinite(point));

interface HeatmapCellMotionParams {
  readonly animate: boolean;
  readonly animationDuration: number;
  readonly enterTransition: Readonly<HeatmapEnterTransition> | undefined;
  readonly enterStaggerScale: number;
  readonly revealEpoch: number;
  /** First-enter clock, owned by the chart (the definition is rebuilt on layout changes; the schedule must outlive it). */
  readonly clock: HeatmapEnterClock;
}

interface HeatmapEnterClock {
  at: number | null;
  /** The render that mounted the svg, where bklit's enter clock starts (null on a replay); read once at the first enter. */
  readonly origin: () => number | null;
}

/** One cell's whole opacity curve (0 -> 1 over `cutMs + readyMs`): the enter tween, its restart at `HEATMAP_RESTART_MS`, then the cut into the ready tween. */
const cellEnterCurve = (enter: (t: number) => number, delayMs: number, durationMs: number, cutMs: number): ((t: number) => number) => {
  const total = cutMs + HEATMAP_HOVER_TRANSITION_MS;
  const restarts = HEATMAP_RESTART_MS < cutMs;
  const atRestart = enter(Math.max(0, HEATMAP_RESTART_MS - delayMs) / durationMs);
  const valueAtCut = restarts ? atRestart + (1 - atRestart) * enter(Math.max(0, cutMs - HEATMAP_RESTART_MS - delayMs) / durationMs) : enter(Math.max(0, cutMs - delayMs) / durationMs);
  const at = (t: number): number => {
    const ms = t * total;
    if (ms >= cutMs) { return valueAtCut + (1 - valueAtCut) * HEATMAP_READY_EASE((ms - cutMs) / HEATMAP_HOVER_TRANSITION_MS); }
    if (!restarts || ms < HEATMAP_RESTART_MS) { return enter(Math.max(0, ms - delayMs) / durationMs); }
    return atRestart + (1 - atRestart) * enter(Math.max(0, ms - HEATMAP_RESTART_MS - delayMs) / durationMs);
  };
  // The renderer writes opacity to 3 decimals: a last frame at 0.999 would hand the cells a 0.999 -> 1 CSS opacity transition (hover rule) after the tween.
  return (t) => { const v = at(t); return v >= SETTLED_OPACITY ? 1 : v; };
};

/* Per-datum enter timing for cells. Exit fades over the conceal window so a loading skeleton dissolves instead of popping; resize/update stay instant. */
const createHeatmapCellMotion = <Datum extends { readonly column: number; readonly row: number }>(
  params: Readonly<HeatmapCellMotionParams>,
): ChartMotionDefinition<Datum> | false => {
  if (!params.animate || params.animationDuration <= 0) {return false;}
  const fadeDurationSec = resolveHeatmapEnterFadeDurationSec(params.enterTransition, params.animationDuration);
  const durationMs = fadeDurationSec * MS_PER_SECOND;
  const ease = params.enterTransition?.ease;
  const easing = cubicBezier(...(isBezierTuple(ease) ? ease : HEATMAP_DEFAULT_ENTER_EASE));
  // A render forced mid-reveal (web-font swap) is an update, which resumes the schedule of the first enter call instead of snapping.
  const { clock } = params;
  const delayOf = (datum: Datum): number =>
    computeHeatmapEnterFadeDelayMs({
      animationDurationMs: params.animationDuration,
      column: datum.column,
      enterStaggerScale: params.enterStaggerScale,
      fadeDurationSec,
      revealEpoch: params.revealEpoch,
      row: datum.row,
    });
  const cutMs = Math.max(params.animationDuration, durationMs);
  const planOf = (datum: Datum): EnterPlan => ({ delay: 0, duration: cutMs + HEATMAP_HOVER_TRANSITION_MS, easing: cellEnterCurve(easing, delayOf(datum), durationMs, cutMs) });
  return (context): false | ChartMotionTiming<Datum> | undefined => {
    if (context.phase === "exit") {
      return { transition: { duration: HEATMAP_LOADING_CONCEAL_MS, easing: "ease-in-out", type: "tween" } };
    }
    const { datum } = context;
    if (context.phase === "update") {
      return datum === undefined ? false : erase(resumeEnter(planOf(datum), clock.at));
    }
    if (datum === undefined) {return undefined;}
    // The cells join one commit after the svg (UPSTREAM-GAPS #12); the clock starts where bklit's does so the late join does not shift the tween (heatmap-chart.tsx:566-585).
    clock.at ??= clock.origin() ?? performance.now();
    return erase(resumeEnter(planOf(datum), clock.at));
  };
};

export {
  HEATMAP_DEFAULT_ENTER_DURATION_MS,
  HEATMAP_DEFAULT_ENTER_TRANSITION,
  HEATMAP_DEFAULT_LOADING_CELL_MAX_OPACITY,
  HEATMAP_DEFAULT_LOADING_CELL_RANDOMNESS,
  HEATMAP_HOVER_TRANSITION_MS,
  HEATMAP_LOADING_CHART_OPACITY,
  createHeatmapCellMotion,
  heatmapCellSeed,
  seededRandom,
};
export type {
  HeatmapEnterClock,
  HeatmapEnterTransition,
  HeatmapRevealMode,
};
