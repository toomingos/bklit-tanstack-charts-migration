/** Leftmost bisect — returns first index i such that accessor(data[i]) >= target. */
export function bisectDateLeft<T>(
  data: readonly T[],
  accessor: (d: T) => number,
  target: number,
  lo: number,
  hi: number,
): number {
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    const midVal = accessor(data[mid]!);
    if (midVal < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Resolves the nearest datum index by bisecting, then comparing the two
 * neighbors by distance (strict `>` tie-break toward the earlier point —
 * matches bklit's `resolveTooltipFromX` behavior exactly).
 */
export function resolveNearestIndex<T>(
  data: readonly T[],
  accessor: (d: T) => number,
  target: number,
): number {
  const index = bisectDateLeft(data, accessor, target, 1, data.length);
  const d0 = data[index - 1];
  const d1 = data[index];
  if (!d0) return -1;
  if (d1) {
    const d0Val = accessor(d0);
    const d1Val = accessor(d1);
    if (target - d0Val > d1Val - target) return index;
  }
  return index - 1;
}
