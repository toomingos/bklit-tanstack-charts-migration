// V3.4b parity: legacy skeleton-data and skeleton-height helpers, verbatim.

// Skeleton-data defaults mirror legacy `generate-chart-skeleton-data.ts`.
const DEFAULT_SKELETON_DATA_KEY = "value";
const DEFAULT_SKELETON_POINT_COUNT = 7;
const DEFAULT_SKELETON_BASE_DATE = "2025-01-01";
const SKELETON_BASE_VALUE = 110;
const SKELETON_SINE_SCALE = 36;
const SKELETON_SINE_FREQUENCY = 1.15;
const SKELETON_INDEX_STEP = 9;
const SKELETON_TARGET_BASE_VALUE = 95;
const SKELETON_TARGET_SINE_SCALE = 28;
const SKELETON_TARGET_SINE_FREQUENCY = 1.05;
const SKELETON_TARGET_INDEX_STEP = 7;

interface GenerateChartSkeletonDataOptions {
  /** Key used for y values in each row. Default: `"value"`. */
  dataKey?: string;
  /** Number of points. Default: 7. */
  pointCount?: number;
  /** Start date for the x axis. Default: 2025-01-01. */
  baseDate?: Date;
}

// Placeholder series used while loading and data is empty.
const generateChartSkeletonData = (
  options: GenerateChartSkeletonDataOptions = {},
): Record<string, unknown>[] => {
  const dataKey = options.dataKey ?? DEFAULT_SKELETON_DATA_KEY;
  const pointCount = options.pointCount ?? DEFAULT_SKELETON_POINT_COUNT;
  const baseDate = options.baseDate ?? new Date(DEFAULT_SKELETON_BASE_DATE);
  return Array.from({ length: pointCount }, (_unused, index) => {
    const date = new Date(baseDate);
    date.setDate(baseDate.getDate() + index);
    return {
      date,
      [dataKey]: Math.round(
        SKELETON_BASE_VALUE + Math.sin(index * SKELETON_SINE_FREQUENCY) * SKELETON_SINE_SCALE + index * SKELETON_INDEX_STEP,
      ),
    };
  });
};

// Skeleton rows mirroring target dates with lower magnitudes for Y tween.
const generateChartSkeletonFromTarget = (
  targetData: Record<string, unknown>[],
  dataKey: string,
): Record<string, unknown>[] =>
  targetData.map((row, index) => ({
    ...row,
    [dataKey]: Math.round(
      SKELETON_TARGET_BASE_VALUE +
        Math.sin(index * SKELETON_TARGET_SINE_FREQUENCY) * SKELETON_TARGET_SINE_SCALE +
        index * SKELETON_TARGET_INDEX_STEP,
    ),
  }));

// Point value for the loading y-domain silhouette (shared with loading-chrome).
const getSkeletonValue = (index: number): number => Math.round(
  SKELETON_BASE_VALUE + Math.sin(index * SKELETON_SINE_FREQUENCY) * SKELETON_SINE_SCALE + index * SKELETON_INDEX_STEP,
);

// Lower-magnitude mirror when real data exists, so the y-domain has somewhere to tween from.
const getSkeletonTargetValue = (index: number): number => Math.round(
  SKELETON_TARGET_BASE_VALUE + Math.sin(index * SKELETON_TARGET_SINE_FREQUENCY) * SKELETON_TARGET_SINE_SCALE + index * SKELETON_TARGET_INDEX_STEP,
);

// Heights come from a deterministic hash of (index, seed), never
// `Math.random()`, so the first server render and first client render agree.
const HEIGHT_MIN_PCT = 20;
const HEIGHT_MAX_PCT = 80;
const HASH_SCALE = 43_758.5453;
const HEIGHT_HASH_SALT = 12.9898;
const SIGN_HASH_SALT = 78.233;
const SIGN_THRESHOLD = 0.5;

// Cheap deterministic hash to a fractional part in [0, 1).
const hashFract = (source: number): number => {
  const hashed = Math.sin(source) * HASH_SCALE;
  return hashed - Math.floor(hashed);
};

// Deterministic heights (percentages of the available height) for a seed.
const getSkeletonHeights = (
  count: number,
  seed = 0,
  min = HEIGHT_MIN_PCT,
  max = HEIGHT_MAX_PCT,
): number[] => {
  const range = max - min;
  return Array.from(
    { length: count },
    (_unused, index) => min + Math.floor(hashFract((index + 1) * HEIGHT_HASH_SALT + seed) * range),
  );
};

// Deterministic up/down signs per bar for the center baseline.
const getSkeletonSigns = (count: number, seed = 0): number[] =>
  Array.from({ length: count }, (_unused, index) =>
    hashFract((index + 1) * SIGN_HASH_SALT + seed) < SIGN_THRESHOLD ? -1 : 1,
  );

// Sweep-stop math mirrors legacy `loading-sweep.tsx`.
const GRADIENT_DEFAULT_STEPS = 17;
const GRADIENT_MIN_OPACITY = 0.05;
const GRADIENT_MAX_OPACITY = 0.9;
const PERCENT_SCALE = 100;
const OPACITY_PRECISION = 3;

interface EasedGradientStop {
  readonly offset: string;
  readonly opacity: number;
}

// Bell-curve opacity stops for the shimmer band soft edges.
const generateEasedGradientStops = (
  steps = GRADIENT_DEFAULT_STEPS,
  minOpacity = GRADIENT_MIN_OPACITY,
  maxOpacity = GRADIENT_MAX_OPACITY,
): EasedGradientStop[] =>
  Array.from({ length: steps }, (_unused, index) => {
    const ratio = index / (steps - 1);
    const eased = Math.sin(ratio * Math.PI) ** 2;
    const opacity = minOpacity + eased * (maxOpacity - minOpacity);
    return {
      offset: `${(ratio * PERCENT_SCALE).toFixed(0)}%`,
      opacity: Number(opacity.toFixed(OPACITY_PRECISION)),
    };
  });

export {
  DEFAULT_SKELETON_DATA_KEY,
  DEFAULT_SKELETON_POINT_COUNT,
  generateChartSkeletonData,
  generateChartSkeletonFromTarget,
  getSkeletonHeights,
  getSkeletonSigns,
  getSkeletonTargetValue,
  getSkeletonValue,
  generateEasedGradientStops,
  PERCENT_SCALE,
};
export type { EasedGradientStop, GenerateChartSkeletonDataOptions };
