// bklit-ui XAxis parity: HTML overlay labels (not SVG text), positioned at
// `left: tickX, bottom: 12`, centered, 12px, color var(--chart-label).
// Tick selection replicates x-axis.tsx's default `tickMode="data"` path
// (`buildDataAlignedTicks`): ticks are real points of the RENDERED
// (decimated) data chosen for even on-screen spacing (internal/x-ticks.ts),
// deduped by formatted label — not interpolated domain timestamps. When the
// projection horizon extends the scale past the last data point and there is
// no brush (`xDomain == null`), bklit switches to `buildDomainTicks`
// (x-axis.tsx:433-476, 597-603): evenly interpolated DOMAIN timestamps.
// Brush tail variant `appendProjectionTailTicks` ported in this file per
// bklit x-axis.tsx:494-557,596-624 (keeps data-aligned ticks + tail extras).
import * as React from "react";
import { shortDateFmt } from "./formatters";
import { toDate } from "./coerce-date";
import { AXIS_POSITION_TWEEN_MS } from "./design-tokens";
import type { ChartDatum } from "./types";

// ── Data-aligned x-tick selection (folded from ./x-ticks) ────────────────
// Verbatim port of bklit-ui's data-aligned x-tick selection
// (repos/bklit-ui/packages/ui/src/charts/x-axis.tsx, `tickMode="data"` path:
// selectEvenlySpacedIndices + buildDataAlignedTicks and their helpers).
// bklit picks tick indices INTO THE RENDERED (decimated) DATA with the most
// even on-screen spacing, deduped by formatted label — not interpolated
// domain timestamps — so labels always name real data points.

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

export interface XAxisOverlayProps {
  /** Rendered (decimated) data — ticks land on real points of this array. */
  data: ChartDatum[];
  xDataKey: string;
  rangeStart: number; // margin.left
  rangeEnd: number; // width - margin.right
  numTicks: number;
  formatValue?: (value: Date) => string;
  /** Extended x-domain max (ms) — e.g. projection horizon; defaults to the last data point's time. */
  domainMaxTime?: number;
  /** Brushed domain — when present, bklit keeps data-aligned ticks and appends tail extras (x-axis.tsx:596-624). */
  xDomain?: [Date, Date] | null;
  /** CH5: `"data"` (default) snaps ticks to rendered rows; `"domain"` forces
      bklit buildDomainTicks — evenly interpolated DOMAIN timestamps
      (x-axis.tsx:433-476, 588-594) regardless of brush/projection. */
  tickMode?: "domain" | "data";
}

// Shared presentational chrome for one x-axis label (bklit XAxisLabel AND
// BarXAxisLabel parity): positioned `left: x, bottom: 12`, centered, 12px,
// color var(--chart-label), opacity transition 0.4s ease-in-out. Both
// XAxisOverlay and BarXAxisOverlay render their (deliberately different)
// tick selections through this leaf — see each file header for why the
// selection algorithms are NOT unified.
export function XAxisLabel({
  x,
  positionTransition,
  children,
}: {
  x: number;
  /** AX5 position tween (bklit gates it to the un-brushed state) — XAxisOverlay passes it, BarXAxisOverlay does not. */
  positionTransition?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        bottom: 12,
        width: 0,
        display: "flex",
        justifyContent: "center",
        transition: positionTransition,
      }}
    >
      <span
        // Read by *-hover-chrome.ts to fade labels near the date pill
        // (bklit XAxisLabel/BarXAxisLabel: opacity transition 0.4s ease-in-out).
        data-bkm-xlabel=""
        data-bkm-x={x}
        style={{
          whiteSpace: "nowrap",
          fontSize: 12,
          lineHeight: "1rem",
          color: "var(--color-chart-label, var(--chart-label))",
          transition: "opacity 0.4s ease-in-out",
        }}
      >
        {children}
      </span>
    </div>
  );
}

export function XAxisOverlay({
  data,
  xDataKey,
  rangeStart,
  rangeEnd,
  numTicks,
  formatValue,
  domainMaxTime,
  xDomain,
  tickMode = "data",
}: XAxisOverlayProps) {
  const ticks = React.useMemo(() => {
    if (data.length === 0 || rangeEnd <= rangeStart) return [];
    const first = toDate(data[0]?.[xDataKey]);
    const last = toDate(data[data.length - 1]?.[xDataKey]);
    if (!first || !last) return [];
    const startTime = first.getTime();
    const endTime = domainMaxTime ?? last.getTime();
    const timeRange = endTime - startTime;
    const fmt = formatValue ?? ((d: Date) => shortDateFmt.format(d));
    // bklit x-axis.tsx:596-624 — brushed vs un-brushed tail behavior.
    const projectionExtendsPastData = endTime > last.getTime();

    // CH5 tickMode="domain" (bklit x-axis.tsx:588-594): ticks are evenly
    // interpolated DOMAIN timestamps, ignoring data alignment entirely.
    if (tickMode === "domain" && timeRange > 0) {
      const tickCount = Math.max(2, numTicks);
      const seen = new Set<string>();
      const out: Array<{ x: number; label: string }> = [];
      for (let i = 0; i < tickCount; i++) {
        const t = i / (tickCount - 1);
        const date = new Date(startTime + t * timeRange);
        const label = fmt(date);
        if (seen.has(label)) continue;
        seen.add(label);
        out.push({ x: rangeStart + t * (rangeEnd - rangeStart), label });
      }
      return out;
    }

    // bklit x-axis.tsx:597-603 — when the projection horizon extends the scale
    // past the last data point (and there is no brush), ticks are evenly
    // interpolated DOMAIN timestamps, not data-aligned picks.
    if (projectionExtendsPastData && xDomain == null && timeRange > 0) {
      const tickCount = Math.max(2, numTicks);
      const seen = new Set<string>();
      const out: Array<{ x: number; label: string }> = [];
      for (let i = 0; i < tickCount; i++) {
        const t = i / (tickCount - 1);
        const date = new Date(startTime + t * timeRange);
        const label = fmt(date);
        if (seen.has(label)) continue;
        seen.add(label);
        out.push({ x: rangeStart + t * (rangeEnd - rangeStart), label });
      }
      return out;
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
    const out: Array<{ x: number; label: string }> = [];
    for (const index of indices) {
      const label = labelAt(index);
      if (label === undefined || seen.has(label)) continue;
      seen.add(label);
      out.push({ x: xAt(index), label });
    }
    // bklit x-axis.tsx:494-557,614-624 — when brushed and the domain extends
    // past the last data point, keep data-aligned ticks and append up to 3
    // evenly-spaced tail ticks between last data point and domainEnd, plus a
    // tick exactly at domainEnd (deduped by formatted label, sorted by x).
    if (projectionExtendsPastData && timeRange > 0 && xDomain != null) {
      const appended = appendProjectionTailTicksOverlay(out, data, xDataKey, endTime, startTime, rangeStart, rangeEnd, fmt, numTicks);
      if (appended) return appended;
    }
    return out;
  }, [data, xDataKey, rangeStart, rangeEnd, numTicks, formatValue, domainMaxTime, xDomain, tickMode]);

function appendProjectionTailTicksOverlay(
  ticks: Array<{ x: number; label: string }>,
  data: ChartDatum[],
  xDataKey: string,
  endTime: number,
  startTime: number,
  rangeStart: number,
  rangeEnd: number,
  fmt: (d: Date) => string,
  numTicks: number,
): Array<{ x: number; label: string }> | null {
  // bklit x-axis.tsx:494-557 — tail between last datum and domainEnd.
  if (data.length === 0) return null;
  const last = toDate(data[data.length - 1]?.[xDataKey]);
  if (!last) return null;
  const lastTime = last.getTime();
  if (endTime <= lastTime) return null;
  const seen = new Set(ticks.map((t) => t.label));
  const extras: Array<{ x: number; label: string }> = [];
  // bklit :527-550, :596-624 — count = min(maxExtraTicks, 3), maxExtraTicks = max(1, numTicks - dataTicks.length + 1)
  const maxExtraTicks = Math.max(1, numTicks - ticks.length + 1);
  const extraCount = Math.min(maxExtraTicks, 3);
  const span = rangeEnd - rangeStart;
  const fullRange = endTime - startTime;
  if (fullRange <= 0 || span <= 0) return null;
  for (let i = 1; i <= extraCount; i++) {
    const date = new Date(lastTime + (i / (extraCount + 1)) * (endTime - lastTime));
    const label = fmt(date);
    if (seen.has(label)) continue;
    seen.add(label);
    const x = rangeStart + ((date.getTime() - startTime) / fullRange) * span;
    extras.push({ x, label });
  }
  const domainEnd = new Date(endTime);
  const endLabel = fmt(domainEnd);
  if (!seen.has(endLabel)) {
    const x = rangeStart + ((endTime - startTime) / fullRange) * span;
    extras.push({ x, label: endLabel });
  }
  if (extras.length === 0) return null;
  return [...ticks, ...extras].sort((a, b) => a.x - b.x);
}

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
      }}
    >
      {ticks.map((tick) => (
        <XAxisLabel
          key={tick.label}
          x={tick.x}
          positionTransition={
            xDomain == null
              ? `left ${AXIS_POSITION_TWEEN_MS}ms cubic-bezier(0.85, 0, 0.15, 1)`
              : undefined
          }
        >
          {tick.label}
        </XAxisLabel>
      ))}
    </div>
  );
}
