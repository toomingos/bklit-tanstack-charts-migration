// C4 (phase 6): pure tick-CHOICE functions feeding the native axis pipeline.
// The HTML axis overlays (x-axis-overlay.tsx / y-axis-overlay.tsx /
// bar-x-axis-overlay.tsx) are deleted in C4; their tick-selection algorithms
// survive here verbatim (research/phase-6/04: the optimizers are bklit parity
// surface — only the RENDERING goes native). Charts consume these from their
// `ChartScale.resolve` implementations (custom time scales emit the tick list
// directly) or via `axis.ticks.values` (plain d3 scales: bar's band, the y
// linear scales); positions always come from the chart's own rendered scale.
// No DOM, no React — pure math.
import { scaleLinear } from "d3-scale";
import { shortDateFmt } from "./formatters";
import { toDate } from "./coerce-date";
import { resolveYAxisTickCount } from "./y-axis-ticks";
import type { ChartDatum } from "./types";

// ── Data-aligned x-tick selection ────────────────────────────────────────
// Verbatim move from x-axis-overlay.tsx (itself a verbatim port of bklit-ui
// x-axis.tsx `tickMode="data"`: selectEvenlySpacedIndices +
// buildDataAlignedTicks). bklit picks tick indices INTO THE RENDERED
// (decimated) DATA with the most even on-screen spacing, deduped by formatted
// label — labels always name real data points.

const MAX_GAP_LAYOUTS = 400;

function binomial(n: number, k: number): number {
  if (k < 0 || k > n) {
    return 0;
  }
  let result = 1;
  for (let i = 0; i < k; i++) {
    result = (result * (n - i)) / (i + 1);
  }
  return result;
}

/** All ways to split `span` into `parts` positive integer gaps. */
function composePositiveSum(sum: number, parts: number): number[][] {
  if (parts === 1) {
    return sum >= 1 ? [[sum]] : [];
  }

  const layouts: number[][] = [];
  for (let gap = 1; gap <= sum - (parts - 1); gap++) {
    for (const tail of composePositiveSum(sum - gap, parts - 1)) {
      layouts.push([gap, ...tail]);
    }
  }
  return layouts;
}

function gapsToIndices(gaps: number[]): number[] {
  const indices = [0];
  let position = 0;
  for (const gap of gaps) {
    position += gap;
    indices.push(position);
  }
  return indices;
}

function indicesForTickCount(length: number, tickCount: number): number[] {
  const span = length - 1;
  if (span <= 0) {
    return [0];
  }

  const rawIndices = Array.from({ length: tickCount }, (_, index) =>
    Math.round((index / (tickCount - 1)) * span),
  );

  const indices = [...new Set(rawIndices)].sort((a, b) => a - b);
  if (indices[0] !== 0) {
    indices.unshift(0);
  }
  if (indices.at(-1) !== span) {
    indices.push(span);
  }

  return [...new Set(indices)].sort((a, b) => a - b);
}

function allIndexLayouts(length: number, tickCount: number): number[][] {
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

  return composePositiveSum(span, gapCount).map(gapsToIndices);
}

function dedupeIndicesByLabel(
  indices: number[],
  labelForIndex: (index: number) => string | undefined,
): number[] {
  const seenLabels = new Set<string>();
  const deduped: number[] = [];

  for (const index of indices) {
    const label = labelForIndex(index);
    if (label === undefined) {
      continue;
    }
    if (seenLabels.has(label)) {
      continue;
    }
    seenLabels.add(label);
    deduped.push(index);
  }

  return deduped;
}

interface TickLayoutScore {
  score: number;
  symmetryPenalty: number;
  countDistance: number;
  /** 0 = smallest gap at end, 1 = at start, 2 = in the middle */
  edgePreference: number;
}

function indexGaps(indices: number[]): number[] {
  const gaps: number[] = [];
  for (let i = 1; i < indices.length; i++) {
    const current = indices[i];
    const previous = indices[i - 1];
    if (current == null || previous == null) {
      continue;
    }
    gaps.push(current - previous);
  }
  return gaps;
}

function smallestGapEdgePreference(indices: number[]): number {
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

function scoreTickLayout(
  indices: number[],
  resolveXPx: (index: number) => number,
  targetCount: number,
): TickLayoutScore {
  if (indices.length < 2) {
    return {
      score: Number.POSITIVE_INFINITY,
      symmetryPenalty: Number.POSITIVE_INFINITY,
      countDistance: Number.POSITIVE_INFINITY,
      edgePreference: Number.POSITIVE_INFINITY,
    };
  }

  const pixelGaps: number[] = [];
  for (let i = 1; i < indices.length; i++) {
    const current = indices[i];
    const previous = indices[i - 1];
    if (current == null || previous == null) {
      continue;
    }
    pixelGaps.push(resolveXPx(current) - resolveXPx(previous));
  }

  const minGap = Math.min(...pixelGaps);
  const maxGap = Math.max(...pixelGaps);
  const meanGap =
    pixelGaps.reduce((sum, gap) => sum + gap, 0) / pixelGaps.length;
  const spreadRatio =
    meanGap > 0 ? (maxGap - minGap) / meanGap : maxGap - minGap;
  const countDistance = Math.abs(indices.length - targetCount);

  const gaps = indexGaps(indices);
  const smallestGap = Math.min(...gaps);
  const smallestGapIndex = gaps.indexOf(smallestGap);
  const interiorPenalty =
    smallestGapIndex > 0 && smallestGapIndex < gaps.length - 1 ? 0.08 : 0;

  const symmetryPenalty =
    gaps.reduce((penalty, gap, index) => {
      return penalty + Math.abs(gap - (gaps.at(-1 - index) ?? gap));
    }, 0) / gaps.length;

  return {
    score:
      spreadRatio +
      0.1 * countDistance +
      interiorPenalty +
      symmetryPenalty * 0.02,
    symmetryPenalty,
    countDistance,
    edgePreference: smallestGapEdgePreference(indices),
  };
}

function isBetterTickLayout(
  next: TickLayoutScore,
  best: TickLayoutScore,
  nextCountDistance: number,
  bestCountDistance: number,
): boolean {
  if (next.score < best.score - 1e-6) {
    return true;
  }
  if (Math.abs(next.score - best.score) > 1e-6) {
    return false;
  }
  if (nextCountDistance < bestCountDistance) {
    return true;
  }
  if (nextCountDistance > bestCountDistance) {
    return false;
  }
  if (next.symmetryPenalty < best.symmetryPenalty - 1e-6) {
    return true;
  }
  if (next.symmetryPenalty > best.symmetryPenalty + 1e-6) {
    return false;
  }
  return next.edgePreference < best.edgePreference;
}

/**
 * Picks tick indices with the most even on-screen spacing. Tries
 * `targetCount ± 1` and evaluates every gap layout when feasible.
 */
export function selectEvenlySpacedIndices(
  length: number,
  targetCount: number,
  options?: {
    labelForIndex?: (index: number) => string | undefined;
    resolveXPx?: (index: number) => number;
  },
): number[] {
  if (length <= 0) {
    return [];
  }
  if (length === 1) {
    return [0];
  }
  if (length <= targetCount) {
    return Array.from({ length }, (_, index) => index);
  }

  const resolveXPx = options?.resolveXPx ?? ((index: number) => index);

  const minCount = Math.max(2, targetCount - 1);
  const maxCount = Math.min(length, targetCount + 1);

  let bestIndices = indicesForTickCount(length, targetCount);
  let bestScore = scoreTickLayout(bestIndices, resolveXPx, targetCount);
  let bestCountDistance = bestScore.countDistance;

  for (let tickCount = minCount; tickCount <= maxCount; tickCount++) {
    for (const rawIndices of allIndexLayouts(length, tickCount)) {
      const indices = options?.labelForIndex
        ? dedupeIndicesByLabel(rawIndices, options.labelForIndex)
        : rawIndices;

      if (indices.length < 2) {
        continue;
      }

      const layoutScore = scoreTickLayout(indices, resolveXPx, targetCount);
      const countDistance = Math.abs(indices.length - targetCount);

      if (
        isBetterTickLayout(
          layoutScore,
          bestScore,
          countDistance,
          bestCountDistance,
        )
      ) {
        bestIndices = indices;
        bestScore = layoutScore;
        bestCountDistance = countDistance;
      }
    }
  }

  return bestIndices;
}

export interface XAxisTickValue {
  value: Date;
  label: string;
}

export interface XAxisTickInput {
  /** Rendered (decimated) data — ticks land on real points of this array. */
  data: ChartDatum[];
  xDataKey: string;
  /** Pixel range the ticks will render into — ONLY used for spacing scores
      (legacy overlay scored with the same linear time interpolation the
      rendered scale performs; candlestick/scatter pass their inset ranges). */
  rangeStart: number;
  rangeEnd: number;
  numTicks: number;
  formatValue?: (value: Date) => string;
  /** Extended x-domain max (ms) — e.g. projection horizon; defaults to the last data point's time. */
  domainMaxTime?: number;
  /** Brushed domain — when present, bklit keeps data-aligned ticks and appends tail extras (x-axis.tsx:596-624). */
  xDomain?: [Date, Date] | null;
  /** `"data"` (default) snaps ticks to rendered rows; `"domain"` forces
      evenly interpolated DOMAIN timestamps (bklit x-axis.tsx:433-476). */
  tickMode?: "domain" | "data";
}

/**
 * The full x-tick CHOICE previously computed inside XAxisOverlay's useMemo
 * (verbatim logic move): domain mode, projection-domain mode, data-aligned
 * selection, and the brushed projection-tail append. Returns domain values +
 * final labels; the chart's own scale maps values to pixels.
 */
export function buildXAxisTickValues({
  data,
  xDataKey,
  rangeStart,
  rangeEnd,
  numTicks,
  formatValue,
  domainMaxTime,
  xDomain,
  tickMode = "data",
}: XAxisTickInput): XAxisTickValue[] {
  if (data.length === 0 || rangeEnd <= rangeStart) return [];
  const first = toDate(data[0]?.[xDataKey]);
  const last = toDate(data[data.length - 1]?.[xDataKey]);
  if (!first || !last) return [];
  const startTime = first.getTime();
  const endTime = domainMaxTime ?? last.getTime();
  const timeRange = endTime - startTime;
  const fmt = formatValue ?? ((d: Date) => shortDateFmt.format(d));
  const projectionExtendsPastData = endTime > last.getTime();

  const interpolatedDomainTicks = (): XAxisTickValue[] => {
    const tickCount = Math.max(2, numTicks);
    const seen = new Set<string>();
    const out: XAxisTickValue[] = [];
    for (let i = 0; i < tickCount; i++) {
      const t = i / (tickCount - 1);
      const date = new Date(startTime + t * timeRange);
      const label = fmt(date);
      if (seen.has(label)) continue;
      seen.add(label);
      out.push({ value: date, label });
    }
    return out;
  };

  // bklit x-axis.tsx:588-594 — tickMode="domain" ignores data alignment.
  if (tickMode === "domain" && timeRange > 0) {
    return interpolatedDomainTicks();
  }

  // bklit x-axis.tsx:597-603 — projection horizon past the last data point
  // with no brush: evenly interpolated DOMAIN timestamps.
  if (projectionExtendsPastData && xDomain == null && timeRange > 0) {
    return interpolatedDomainTicks();
  }

  const dateCache = new Map<number, Date | null>();
  const dateAtCached = (index: number) => {
    if (!dateCache.has(index)) dateCache.set(index, toDate(data[index]?.[xDataKey]));
    return dateCache.get(index)!;
  };
  const xAt = (index: number) => {
    const date = dateAtCached(index);
    if (!date || timeRange <= 0) return rangeStart;
    return (
      rangeStart +
      ((date.getTime() - startTime) / timeRange) * (rangeEnd - rangeStart)
    );
  };
  const labelAt = (index: number) => {
    const date = dateAtCached(index);
    return date ? fmt(date) : undefined;
  };

  const indices = selectEvenlySpacedIndices(data.length, numTicks, {
    labelForIndex: labelAt,
    resolveXPx: xAt,
  });

  // buildDataAlignedTicks: final pass dedupes by label again.
  const seen = new Set<string>();
  const out: XAxisTickValue[] = [];
  for (const index of indices) {
    const label = labelAt(index);
    const date = dateAtCached(index);
    if (label === undefined || !date || seen.has(label)) continue;
    seen.add(label);
    out.push({ value: date, label });
  }

  // bklit x-axis.tsx:494-557,614-624 — brushed with the domain extending past
  // the last data point: keep data-aligned ticks, append up to 3 evenly
  // spaced tail ticks plus one at domainEnd (deduped by label, time-sorted).
  if (projectionExtendsPastData && timeRange > 0 && xDomain != null) {
    const lastTime = last.getTime();
    const seenTail = new Set(out.map((t) => t.label));
    const extras: XAxisTickValue[] = [];
    const maxExtraTicks = Math.max(1, numTicks - out.length + 1);
    const extraCount = Math.min(maxExtraTicks, 3);
    for (let i = 1; i <= extraCount; i++) {
      const date = new Date(lastTime + (i / (extraCount + 1)) * (endTime - lastTime));
      const label = fmt(date);
      if (seenTail.has(label)) continue;
      seenTail.add(label);
      extras.push({ value: date, label });
    }
    const domainEnd = new Date(endTime);
    const endLabel = fmt(domainEnd);
    if (!seenTail.has(endLabel)) {
      extras.push({ value: domainEnd, label: endLabel });
    }
    if (extras.length > 0) {
      return [...out, ...extras].sort(
        (a, b) => a.value.getTime() - b.value.getTime(),
      );
    }
  }
  return out;
}

// ── Y-axis ticks ─────────────────────────────────────────────────────────

/** bklit y-axis.tsx `formatLabel` verbatim (moved from y-axis-overlay.tsx):
    formatValue overrides, else large numbers compact to `${(v/1000).toFixed(0)}k`. */
export function formatYAxisTick(
  value: number,
  formatValue: ((value: number) => string) | undefined,
  formatLargeNumbers: boolean,
): string {
  if (formatValue) return formatValue(value);
  if (formatLargeNumbers && value >= 1000) {
    return `${(value / 1000).toFixed(0)}k`;
  }
  return String(value);
}

/**
 * The y tick VALUES the deleted YAxisOverlay computed: d3 linear ticks of the
 * (idempotently re-niced) y domain with the bklit 1–10 count clamp. Injected
 * via `axis.ticks.values`; positions come from the chart's rendered y scale,
 * which shares the same niced domain (line-chart.tsx C2 comment).
 */
export function buildYAxisTickValues(
  yDomain: [number, number],
  numTicks?: number,
): number[] {
  return scaleLinear()
    .domain(yDomain)
    .nice()
    .ticks(resolveYAxisTickCount(numTicks));
}

// ── Bar category label thinning ──────────────────────────────────────────

/**
 * bklit bar-x-axis.tsx `labelsToShow` modulo thinning (moved from
 * bar-x-axis-overlay.tsx): `step = ceil(count / maxLabels)`, keep
 * `i % step === 0`. Deliberately NOT the even-spacing optimizer above — see
 * the deleted overlay's header for why the two algorithms never unified.
 * Returns the kept indices into the category list.
 */
export function selectBarLabelIndices(
  count: number,
  showAllLabels: boolean,
  maxLabels: number = 12,
): number[] {
  const all = Array.from({ length: count }, (_, i) => i);
  if (showAllLabels || count <= maxLabels) return all;
  const step = Math.ceil(count / maxLabels);
  return all.filter((i) => i % step === 0);
}

// ── Axis-label proximity fade (near the date pill) ───────────────────────

/**
 * Per-label fade opacity — the math of date-pill.ts `applyLabelFade` (whose
 * imperative span-styling twin dies with the overlays): labels within
 * `tickerHalfWidth` of the pill (or matching the hovered label) vanish, then
 * ramp back to 1 across `fadeBuffer`. Consumed by the native
 * `tickLabels.opacity` per-tick callback (`context.position` is the same
 * scene-x space as the focus point the pill anchors to).
 */
export function tickLabelFadeOpacity(
  labelX: number,
  labelText: string,
  primaryX: number,
  hoveredLabel: string | null,
  tickerHalfWidth: number,
  fadeBuffer: number,
): number {
  const distance = Math.abs(labelX - primaryX);
  if (distance < tickerHalfWidth) return 0;
  if (hoveredLabel && labelText === hoveredLabel) return 0;
  if (distance < tickerHalfWidth + fadeBuffer) {
    return (distance - tickerHalfWidth) / fadeBuffer;
  }
  return 1;
}
