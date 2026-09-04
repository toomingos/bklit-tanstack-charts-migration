import type { ChartPhase } from "./chart-phase";
import type { ChartDatum } from "./types";
import type { LineLoadingPulseMode } from "./line-loading-pulse";

// Maps lifecycle phase to pulse mode (null draws no pulse); member-for-member with legacy,
// So the mapping ports 1:1.
const resolveLineLoadingPulseMode = (phase: ChartPhase): LineLoadingPulseMode | null => {
  switch (phase) {
    case "loading": {
      return "loop";
    }
    case "exiting": {
      return "exit";
    }
    case "revealingLoading": {
      return "enter";
    }
    case "exitingReady":
    case "gridTweenLoading":
    case "gridTweenReady":
    case "ready":
    case "revealing": {
      return null;
    }
    default: {
      return null;
    }
  }
}

// Placeholder series shape only (public surface deleted); values set the loading y-domain.
const LOADING_SKELETON_POINT_COUNT = 7;

// Skeleton waveform coefficients (placeholder y-domain silhouette; legacy shape verbatim).
const LOADING_SKELETON_BASE_Y = 110;
const LOADING_SKELETON_SINE_FREQUENCY = 1.15;
const LOADING_SKELETON_SINE_AMPLITUDE = 36;
const LOADING_SKELETON_SLOPE_PER_POINT = 9;

const loadingSkeletonValue = (index: number): number => Math.round(LOADING_SKELETON_BASE_Y + Math.sin(index * LOADING_SKELETON_SINE_FREQUENCY) * LOADING_SKELETON_SINE_AMPLITUDE + index * LOADING_SKELETON_SLOPE_PER_POINT);


// Lower-magnitude mirror coefficients for the from-target skeleton variant.
const LOADING_SKELETON_TARGET_BASE_Y = 95;
const LOADING_SKELETON_TARGET_SINE_FREQUENCY = 1.05;
const LOADING_SKELETON_TARGET_SINE_AMPLITUDE = 28;
const LOADING_SKELETON_TARGET_SLOPE_PER_POINT = 7;

// Lower-magnitude mirror when real data exists, so the y-domain has somewhere to tween from.
const loadingSkeletonValueFromTarget = (index: number): number => Math.round(LOADING_SKELETON_TARGET_BASE_Y + Math.sin(index * LOADING_SKELETON_TARGET_SINE_FREQUENCY) * LOADING_SKELETON_TARGET_SINE_AMPLITUDE + index * LOADING_SKELETON_TARGET_SLOPE_PER_POINT);


// Placeholder rows: standalone 7-point series without data, mirror of real rows otherwise;
// Only dataKey is read downstream.
const buildLoadingSkeletonRows = (rowCount: number, dataKey: string): Record<string, number>[] => {
  const fromTarget = rowCount > 0;
  const count = fromTarget ? rowCount : LOADING_SKELETON_POINT_COUNT;
  const value = fromTarget ? loadingSkeletonValueFromTarget : loadingSkeletonValue;
  return Array.from({ length: count }, (_unused, index) => ({ [dataKey]: value(index) }));
}

// Fract-hash multiplier (classic shader hash constant, ported verbatim).
const HASH_FRACT_MULTIPLIER = 43_758.5453;

// Deterministic 0..1 hash: stable silhouette, no RNG.
const hashFract = (value: number): number => {
  const raw = Math.sin(value) * HASH_FRACT_MULTIPLIER;
  return raw - Math.floor(raw);
}

const SKELETON_HEIGHT_MIN_PCT = 20;
const SKELETON_HEIGHT_MAX_PCT = 80;
// Seed multiplier for the bar-skeleton height hash (legacy coefficient verbatim).
const SKELETON_HASH_SEED_MULTIPLIER = 12.9898;

// Legacy bar-skeleton heights as plot-height percentages (relative silhouette exact;
// Uniform vertical stretch from composing a real BarChart with niced domain).
const loadingSkeletonBarHeights = (count: number, seed = 0): number[] => {
  const range = SKELETON_HEIGHT_MAX_PCT - SKELETON_HEIGHT_MIN_PCT;
  return Array.from(
    { length: count },
    (_unused, index) => SKELETON_HEIGHT_MIN_PCT +
      Math.floor(hashFract((index + 1) * SKELETON_HASH_SEED_MULTIPLIER + seed) * range),
  );
}

// Fixed base date so loading ticks never leak "today".
const LOADING_SKELETON_BASE_DATE = "2025-01-01";

// Full standalone skeleton series for the *ChartLoading presets.
const buildLoadingSkeletonSeries = (dataKey: string, pointCount: number = LOADING_SKELETON_POINT_COUNT): ChartDatum[] => {
  const baseDate = new Date(LOADING_SKELETON_BASE_DATE);
  return Array.from({ length: pointCount }, (_unused, index) => {
    const date = new Date(baseDate);
    date.setDate(baseDate.getDate() + index);
    return { date, [dataKey]: loadingSkeletonValue(index) };
  });
}

export {
  resolveLineLoadingPulseMode,
  LOADING_SKELETON_POINT_COUNT,
  loadingSkeletonValue,
  loadingSkeletonValueFromTarget,
  buildLoadingSkeletonRows,
  loadingSkeletonBarHeights,
  buildLoadingSkeletonSeries,
};
export type { LineLoadingPulseMode } from "./line-loading-pulse";
