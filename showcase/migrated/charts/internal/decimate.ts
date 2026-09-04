// Largest-Triangle-Three-Buckets downsampling; keeps first/last, picks per-bucket maxima.
// Minimum point budget below which decimation is a no-op (first + last + >=1 pick).
const LTTB_MIN_POINTS = 3;
// Lookahead offset for the next-bucket average window (range ends at i + 2, average window at i + 3).
const LTTB_NEXT_BUCKET_END_OFFSET = 3;
// Triangle-area scale factor (half the parallelogram area).
const TRIANGLE_AREA_HALF = 0.5;

// Typeof checks live only in the predicate below; call sites use the guard.
const isNumber = (value: unknown): value is number => typeof value === "number";

type BucketValueAt = (index: number) => number;

interface NextBucketAverage {
  readonly avgX: number;
  readonly avgY: number;
}

interface NextBucketAverageParams {
  readonly start: number;
  readonly end: number;
  readonly fallbackX: number;
  readonly fallbackY: number;
  readonly valueAt: BucketValueAt;
}

const averageNextBucket = (params: Readonly<NextBucketAverageParams>): NextBucketAverage => {
  const nextCount = Math.max(0, params.end - params.start);
  if (nextCount <= 0) {
    return { avgX: params.fallbackX, avgY: params.fallbackY };
  }
  let avgX = 0;
  let avgY = 0;
  for (let j = params.start; j < params.end; j += 1) {
    avgX += j;
    avgY += params.valueAt(j);
  }
  return { avgX: avgX / nextCount, avgY: avgY / nextCount };
};

interface BucketMaxParams {
  readonly rangeStart: number;
  readonly rangeEnd: number;
  readonly ax: number;
  readonly ay: number;
  readonly avgX: number;
  readonly avgY: number;
  readonly valueAt: BucketValueAt;
}

const pickBucketMaxIndex = (params: Readonly<BucketMaxParams>): number => {
  let maxArea = -1;
  let maxIndex = params.rangeStart;
  for (let j = params.rangeStart; j < params.rangeEnd; j += 1) {
    const area = Math.abs(
      (params.ax - params.avgX) * (params.valueAt(j) - params.ay) - (params.ax - j) * (params.avgY - params.ay),
    ) * TRIANGLE_AREA_HALF;
    if (area > maxArea) {
      maxArea = area;
      maxIndex = j;
    }
  }
  return maxIndex;
};

interface BucketPickParams {
  readonly bucketSize: number;
  readonly bucketIndex: number;
  readonly len: number;
  readonly previousIndex: number;
  readonly valueAt: BucketValueAt;
}

const selectBucketPick = (params: Readonly<BucketPickParams>): number => {
  const rangeStart = Math.floor((params.bucketIndex + 1) * params.bucketSize) + 1;
  const rangeEnd = Math.min(Math.floor((params.bucketIndex + 2) * params.bucketSize) + 1, params.len - 1);
  const nextRangeStart = Math.floor((params.bucketIndex + 2) * params.bucketSize) + 1;
  const nextRangeEnd = Math.min(Math.floor((params.bucketIndex + LTTB_NEXT_BUCKET_END_OFFSET) * params.bucketSize) + 1, params.len);
  const avg = averageNextBucket({ end: nextRangeEnd, fallbackX: params.len - 1, fallbackY: params.valueAt(params.len - 1), start: nextRangeStart, valueAt: params.valueAt });
  const ay = params.valueAt(params.previousIndex);
  return pickBucketMaxIndex({ avgX: avg.avgX, avgY: avg.avgY, ax: params.previousIndex, ay, rangeEnd, rangeStart, valueAt: params.valueAt });
};

interface BucketSampleParams<Row> {
  readonly data: readonly Row[];
  readonly maxPoints: number;
  readonly valueAt: BucketValueAt;
}

const sampleLttbBuckets = <Row>(params: Readonly<BucketSampleParams<Row>>): Row[] => {
  const bucketSize = (params.data.length - 2) / (params.maxPoints - 2);
  const sampled: Row[] = [params.data[0]];
  let previousIndex = 0;
  for (let i = 0; i < params.maxPoints - 2; i += 1) {
    const maxIndex = selectBucketPick({ bucketIndex: i, bucketSize, len: params.data.length, previousIndex, valueAt: params.valueAt });
    sampled.push(params.data[maxIndex]);
    previousIndex = maxIndex;
  }
  sampled.push(params.data[params.data.length - 1]);
  return sampled;
};

const decimateTimeSeries = <Row extends Partial<Record<string, unknown>>>(data: readonly Row[], maxPoints: number, valueKeys: readonly string[] = []): readonly Row[] => {
  const averagedKeyValue = (point: Row, index: number): number => {
    let sum = 0;
    let count = 0;
    for (const key of valueKeys) {
      const val = point[key];
      if (isNumber(val)) {
        sum += val;
        count += 1;
      }
    }
    return count > 0 ? sum / count : index;
  };
  const rowYValue = (point: Row, index: number): number => {
    if (valueKeys.length > 0) {
      return averagedKeyValue(point, index);
    }
    for (const val of Object.values(point)) {
      if (isNumber(val)) {
        return val;
      }
    }
    return index;
  };
  const len = data.length;
  if (maxPoints >= len || maxPoints < LTTB_MIN_POINTS) {
    return data;
  }
  const valueAt = (index: number): number => rowYValue(data[index], index);
  return sampleLttbBuckets({ data, maxPoints, valueAt });
}

/** Minimum render points even for narrow charts (avoids degenerate buckets). */
const MIN_RENDER_POINTS = 64;
/** Points-per-pixel density target — enough for crisp curves without over-drawing. */
const POINTS_PER_PIXEL = 1.5;
/** ~1.5 points per pixel — enough for crisp curves without over-drawing. */
const maxRenderPointsForWidth = (innerWidth: number): number => Math.max(MIN_RENDER_POINTS, Math.ceil(innerWidth * POINTS_PER_PIXEL));

export { decimateTimeSeries, maxRenderPointsForWidth };
