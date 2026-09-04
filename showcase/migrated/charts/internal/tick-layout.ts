// Even-spacing tick-index optimizer: picks tick indices with the most even on-screen spacing.
const MAX_GAP_LAYOUTS = 400;

// Tick-layout scoring weights: interior-gap penalty, count-distance weight, symmetry weight.
const TICK_INTERIOR_GAP_PENALTY = 0.08;
const TICK_COUNT_DISTANCE_WEIGHT = 0.1;
const TICK_SYMMETRY_WEIGHT = 0.02;
// Epsilon for float score comparisons in the layout search.
const TICK_SCORE_EPSILON = 1e-6;

const binomial = (total: number, choose: number): number => {
  if (choose < 0 || choose > total) {
    return 0;
  }
  let result = 1;
  for (let i = 0; i < choose; i+= 1) {
    result = (result * (total - i)) / (i + 1);
  }
  return result;
}

const composePositiveSum = (sum: number, parts: number): number[][] => {
  if (parts === 1) {
    return sum >= 1 ? [[sum]] : [];
  }

  const layouts: number[][] = [];
  for (let gap = 1; gap <= sum - (parts - 1); gap+= 1) {
    for (const tail of composePositiveSum(sum - gap, parts - 1)) {
      layouts.push([gap, ...tail]);
    }
  }
  return layouts;
}

const gapsToIndices = (gaps: readonly number[]): number[] => {
  const indices = [0];
  let position = 0;
  for (const gap of gaps) {
    position += gap;
    indices.push(position);
  }
  return indices;
}

const indicesForTickCount = (length: number, tickCount: number): number[] => {
  const span = length - 1;
  if (span <= 0) {
    return [0];
  }

  const rawIndices = Array.from({ length: tickCount }, (_unused, index) => Math.round((index / (tickCount - 1)) * span),
  );

  const indices = [...new Set(rawIndices)].toSorted((left, right) => left - right);
  if (indices[0] !== 0) {
    indices.unshift(0);
  }
  if (indices.at(-1) !== span) {
    indices.push(span);
  }

  return [...new Set(indices)].toSorted((left, right) => left - right);
}

const allIndexLayouts = (length: number, tickCount: number): number[][] => {
  const span = length - 1;
  if (span <= 0) {
    return [[0]];
  }

  const gapCount = tickCount - 1;
  if (gapCount <= 0) {
    return [[0]];
  }

  const layoutCount = binomial(span - 1, gapCount - 1);
  if (layoutCount > MAX_GAP_LAYOUTS) {
    return [indicesForTickCount(length, tickCount)];
  }

  return composePositiveSum(span, gapCount).map((gaps: readonly number[]) => gapsToIndices(gaps));
}

const appendDedupedIndex = (params: Readonly<{ deduped: number[]; index: number; label: string | undefined; seenLabels: Set<string> }>): void => {
  if (params.label === undefined) {return;}
  if (params.seenLabels.has(params.label)) {return;}
  params.seenLabels.add(params.label);
  params.deduped.push(params.index);
};

const dedupeIndicesByLabel = (indices: readonly number[], labelForIndex: (index: number) => string | undefined): number[] => {
  const seenLabels = new Set<string>();
  const deduped: number[] = [];
  for (const index of indices) {
    appendDedupedIndex({ deduped, index, label: labelForIndex(index), seenLabels });
  }
  return deduped;
}

interface TickLayoutScore {
  readonly score: number;
  readonly symmetryPenalty: number;
  readonly countDistance: number;
  /** 0 = smallest gap at end, 1 = at start, 2 = in the middle */
  readonly edgePreference: number;
}

const indexGaps = (indices: readonly number[]): number[] => {
  const gaps: number[] = [];
  for (let offset = 1; offset < indices.length; offset += 1) {
    gaps.push(indices[offset] - indices[offset - 1]);
  }
  return gaps;
}

const smallestGapEdgePreference = (indices: readonly number[]): number => {
  const gaps = indexGaps(indices);
  const smallestGap = Math.min(...gaps);
  const smallestGapIndex = gaps.indexOf(smallestGap);
  if (smallestGapIndex === gaps.length - 1) {
    return 0;
  }
  if (smallestGapIndex === 0) {
    return 1;
  }
  return 2;
}

const resolvePixelGaps = (indices: readonly number[], resolveXPx: (index: number) => number): number[] => {
  const pixelGaps: number[] = [];
  for (let offset = 1; offset < indices.length; offset += 1) {
    pixelGaps.push(resolveXPx(indices[offset]) - resolveXPx(indices[offset - 1]));
  }
  return pixelGaps;
}

const resolveGapSpread = (pixelGaps: readonly number[]): number => {
  const minGap = Math.min(...pixelGaps);
  const maxGap = Math.max(...pixelGaps);
  const meanGap = pixelGaps.reduce((sum, gap) => sum + gap, 0) / pixelGaps.length;
  if (meanGap > 0) {return (maxGap - minGap) / meanGap;}
  return maxGap - minGap;
}

const scoreTickLayout = (indices: readonly number[], resolveXPx: (index: number) => number, targetCount: number): TickLayoutScore => {
  if (indices.length < 2) {
    return {
      countDistance: Number.POSITIVE_INFINITY,
      edgePreference: Number.POSITIVE_INFINITY,
      score: Number.POSITIVE_INFINITY,
      symmetryPenalty: Number.POSITIVE_INFINITY,
    };
  }

  const pixelGaps = resolvePixelGaps(indices, resolveXPx);
  const spreadRatio = resolveGapSpread(pixelGaps);
  const countDistance = Math.abs(indices.length - targetCount);
  const gaps = indexGaps(indices);
  const smallestGapIndex = gaps.indexOf(Math.min(...gaps));
  const interiorPenalty =
    smallestGapIndex > 0 && smallestGapIndex < gaps.length - 1 ? TICK_INTERIOR_GAP_PENALTY : 0;
  const symmetryPenalty =
    gaps.reduce((penalty, gap, index) => penalty + Math.abs(gap - (gaps.at(-1 - index) ?? gap))
    , 0) / gaps.length;

  return {
    countDistance,
    edgePreference: smallestGapEdgePreference(indices),
    score:
      spreadRatio +
      TICK_COUNT_DISTANCE_WEIGHT * countDistance +
      interiorPenalty +
      symmetryPenalty * TICK_SYMMETRY_WEIGHT,
    symmetryPenalty,
  };
}

const compareTickScores = (next: Readonly<TickLayoutScore>, best: Readonly<TickLayoutScore>): number => {
  if (next.score < best.score - TICK_SCORE_EPSILON) {return -1;}
  if (next.score > best.score + TICK_SCORE_EPSILON) {return 1;}
  return 0;
}

const compareTickSymmetry = (next: Readonly<TickLayoutScore>, best: Readonly<TickLayoutScore>): number => {
  if (next.symmetryPenalty < best.symmetryPenalty - TICK_SCORE_EPSILON) {return -1;}
  if (next.symmetryPenalty > best.symmetryPenalty + TICK_SCORE_EPSILON) {return 1;}
  return 0;
}

interface TickLayoutComparison {
  readonly next: Readonly<TickLayoutScore>;
  readonly best: Readonly<TickLayoutScore>;
  readonly nextCountDistance: number;
  readonly bestCountDistance: number;
}

const isBetterTickLayout = (params: Readonly<TickLayoutComparison>): boolean => {
  const scoreOrder = compareTickScores(params.next, params.best);
  if (scoreOrder !== 0) {return scoreOrder < 0;}
  if (params.nextCountDistance !== params.bestCountDistance) {return params.nextCountDistance < params.bestCountDistance;}
  const symmetryOrder = compareTickSymmetry(params.next, params.best);
  if (symmetryOrder !== 0) {return symmetryOrder < 0;}
  return params.next.edgePreference < params.best.edgePreference;
}

interface TickLayoutBest {
  readonly indices: readonly number[];
  readonly score: TickLayoutScore;
  readonly countDistance: number;
}

interface TickCandidateInput {
  readonly rawIndices: readonly number[];
  readonly resolveXPx: (index: number) => number;
  readonly labelForIndex?: (index: number) => string | undefined;
  readonly targetCount: number;
  readonly best: TickLayoutBest;
}

const considerTickCandidate = (params: Readonly<TickCandidateInput>): TickLayoutBest => {
  const indices = params.labelForIndex ? dedupeIndicesByLabel(params.rawIndices, params.labelForIndex) : params.rawIndices;
  if (indices.length < 2) {return params.best;}
  const layoutScore = scoreTickLayout(indices, params.resolveXPx, params.targetCount);
  const countDistance = Math.abs(indices.length - params.targetCount);
  if (isBetterTickLayout({ best: params.best.score, bestCountDistance: params.best.countDistance, next: layoutScore, nextCountDistance: countDistance })) {
    return { countDistance, indices, score: layoutScore };
  }
  return params.best;
}

interface TickLayoutSearchInput {
  readonly length: number;
  readonly targetCount: number;
  readonly resolveXPx: (index: number) => number;
  readonly labelForIndex?: (index: number) => string | undefined;
}

const searchEvenTickLayout = (params: Readonly<TickLayoutSearchInput>): number[] => {
  const minCount = Math.max(2, params.targetCount - 1);
  const maxCount = Math.min(params.length, params.targetCount + 1);
  const seedIndices = indicesForTickCount(params.length, params.targetCount);
  const seedScore = scoreTickLayout(seedIndices, params.resolveXPx, params.targetCount);
  let best: TickLayoutBest = { countDistance: seedScore.countDistance, indices: seedIndices, score: seedScore };
  for (let tickCount = minCount; tickCount <= maxCount; tickCount+= 1) {
    for (const rawIndices of allIndexLayouts(params.length, tickCount)) {
      best = considerTickCandidate({ best, labelForIndex: params.labelForIndex, rawIndices, resolveXPx: params.resolveXPx, targetCount: params.targetCount });
    }
  }
  return [...best.indices];
}

/** Picks tick indices with the most even on-screen spacing (tries targetCount ± 1). */
const selectEvenlySpacedIndices = (length: number, targetCount: number, options?: {
    readonly labelForIndex?: (index: number) => string | undefined;
    readonly resolveXPx?: (index: number) => number;
  }): number[] => {
  if (length <= 0) {
    return [];
  }
  if (length === 1) {
    return [0];
  }
  if (length <= targetCount) {
    return Array.from({ length }, (_unused, index) => index);
  }
  return searchEvenTickLayout({
    labelForIndex: options?.labelForIndex,
    length,
    resolveXPx: options?.resolveXPx ?? ((index: number): number => index),
    targetCount,
  });
}

export { selectEvenlySpacedIndices };
