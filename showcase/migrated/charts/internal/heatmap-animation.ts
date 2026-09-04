import { getHeatmapContributionLevel } from "./heatmap-utils";

const HEATMAP_DEFAULT_ENTER_DURATION_MS = 1600;
// Cubic-bezier(0.85, 0, 0.916, 0.282): ported bklit reveal easing, x1/y1/x2/y2 in order.
const HEATMAP_ENTER_EASE_X1 = 0.85;
const HEATMAP_ENTER_EASE_X2 = 0.916;
const HEATMAP_ENTER_EASE_Y2 = 0.282;
const HEATMAP_DEFAULT_ENTER_EASE = [HEATMAP_ENTER_EASE_X1, 0, HEATMAP_ENTER_EASE_X2, HEATMAP_ENTER_EASE_Y2] as const;

interface HeatmapEnterTransition {
  type?: "tween" | "spring";
  duration?: number;
  ease?: readonly [number, number, number, number];
  bounce?: number;
  stiffness?: number;
  damping?: number;
  mass?: number;
  delay?: number;
}

const HEATMAP_DEFAULT_ENTER_TRANSITION: HeatmapEnterTransition = {
  duration: 1.6,
  ease: HEATMAP_DEFAULT_ENTER_EASE,
  type: "tween",
};

/** Chart opacity while `status="loading"`. */
const HEATMAP_LOADING_CHART_OPACITY = 1;

/** Default max per-cell opacity during loading shimmer. */
const HEATMAP_DEFAULT_LOADING_CELL_MAX_OPACITY = 0.85;

/** Default share of cells that participate in loading shimmer, 0-1. */
const HEATMAP_DEFAULT_LOADING_CELL_RANDOMNESS = 1;

const HEATMAP_LOADING_CONCEAL_MS = 450;
const HEATMAP_ENTER_STAGGER_SPREAD = 0.6;

// Lehmer / Park-Miller PRNG (modulus 2^31-1, multiplier 7^5).
const PARK_MILLER_MODULUS = 2_147_483_647;
const PARK_MILLER_MODULUS_MINUS_ONE = 2_147_483_646;
const PARK_MILLER_MULTIPLIER = 16_807;
const seededRandom = (seed: number): () => number => {
  let state = seed % PARK_MILLER_MODULUS;
  if (state <= 0) {state += PARK_MILLER_MODULUS_MINUS_ONE;}
  return () => {
    state = (state * PARK_MILLER_MULTIPLIER) % PARK_MILLER_MODULUS;
    return (state - 1) / PARK_MILLER_MODULUS_MINUS_ONE;
  };
}

const HEATMAP_SEED_COLUMN_FACTOR = 1009;
const HEATMAP_SEED_ROW_FACTOR = 9176;
const heatmapCellSeed = (column: number, row: number): number => column * HEATMAP_SEED_COLUMN_FACTOR + row * HEATMAP_SEED_ROW_FACTOR;


interface ComputeHeatmapEnterFadeDelayParams {
  column: number;
  row: number;
  revealEpoch: number;
  animationDurationMs: number;
  enterStaggerScale: number;
  fadeDurationSec: number;
}

const MS_PER_SECOND = 1000;
// Salt separating reveal epochs in the cell-seed hash (2^19 - 1).
const HEATMAP_REVEAL_EPOCH_SALT = 524_287;
// Floor on the stagger scale so cells still spread when animation is nearly instant.
const HEATMAP_MIN_ENTER_STAGGER_SCALE = 0.25;
const computeHeatmapEnterFadeDelayMs = (params: Readonly<ComputeHeatmapEnterFadeDelayParams>): number => {
  const seed = heatmapCellSeed(params.column, params.row) + params.revealEpoch * HEATMAP_REVEAL_EPOCH_SALT;
  const random = seededRandom(seed);
  const fadeMs = params.fadeDurationSec * MS_PER_SECOND;
  const maxDelayMs = Math.max(0, params.animationDurationMs - fadeMs);
  const spreadMs = maxDelayMs * HEATMAP_ENTER_STAGGER_SPREAD * Math.max(params.enterStaggerScale, HEATMAP_MIN_ENTER_STAGGER_SCALE);
  return random() * spreadMs;
}

// Cap on the per-cell fade plus the share of the total duration it may take.
const HEATMAP_MAX_ENTER_FADE_SEC = 0.45;
const HEATMAP_FADE_DURATION_FRACTION = 0.3;
const resolveHeatmapEnterFadeDurationSec = (enterTransition: Readonly<HeatmapEnterTransition> | undefined, animationDurationMs: number): number => {
  if (enterTransition !== undefined && enterTransition.duration !== undefined) {return enterTransition.duration;}
  return Math.min(HEATMAP_MAX_ENTER_FADE_SEC, (animationDurationMs / MS_PER_SECOND) * HEATMAP_FADE_DURATION_FRACTION);
}

/** Min/max contribution levels present in the dataset. */
interface HeatmapLevelRange {
  min: number;
  max: number;
}

// Top of the contribution-level scale (matches getHeatmapContributionLevel's 0-4 range).
const HEATMAP_EMPTY_LEVEL_RANGE_MAX = 4;

interface HeatmapColumnBins {
  readonly bins: readonly { readonly count: number }[];
}

const columnContributionRange = (column: Readonly<HeatmapColumnBins>): HeatmapLevelRange => {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const bin of column.bins) {
    const level = getHeatmapContributionLevel(bin.count);
    if (level < min) {min = level;}
    if (level > max) {max = level;}
  }
  return { max, min };
}

const mergeContributionRange = (accumulated: Readonly<HeatmapLevelRange>, range: Readonly<HeatmapLevelRange>): HeatmapLevelRange => ({
  max: Math.max(accumulated.max, range.max),
  min: Math.min(accumulated.min, range.min),
});

const finalizeContributionRange = (accumulated: Readonly<HeatmapLevelRange>): HeatmapLevelRange => {
  // Empty-data fallback is intentionally {min:0, max:4}, not {min:0, max:0}.
  if (!(Number.isFinite(accumulated.min) && Number.isFinite(accumulated.max))) {return { max: HEATMAP_EMPTY_LEVEL_RANGE_MAX, min: 0 };}
  return { max: accumulated.max, min: accumulated.min };
}

const computeHeatmapLevelRange = (data: readonly HeatmapColumnBins[]): HeatmapLevelRange => {
  let accumulated: HeatmapLevelRange = { max: Number.NEGATIVE_INFINITY, min: Number.POSITIVE_INFINITY };
  for (const column of data) {
    accumulated = mergeContributionRange(accumulated, columnContributionRange(column));
  }
  return finalizeContributionRange(accumulated);
}

export {
  HEATMAP_DEFAULT_ENTER_DURATION_MS,
  HEATMAP_DEFAULT_ENTER_EASE,
  HEATMAP_DEFAULT_ENTER_TRANSITION,
  HEATMAP_LOADING_CHART_OPACITY,
  HEATMAP_DEFAULT_LOADING_CELL_MAX_OPACITY,
  HEATMAP_DEFAULT_LOADING_CELL_RANDOMNESS,
  HEATMAP_LOADING_CONCEAL_MS,
  HEATMAP_ENTER_STAGGER_SPREAD,
  seededRandom,
  heatmapCellSeed,
  computeHeatmapEnterFadeDelayMs,
  resolveHeatmapEnterFadeDurationSec,
  computeHeatmapLevelRange,
};
export type {
  HeatmapEnterTransition,
  ComputeHeatmapEnterFadeDelayParams,
  HeatmapLevelRange,
};
