// P6.2 (T-C10 remainder / C15) — the single time→pixel interpolation used by
// every time-series chart's OUT-OF-SPEC overlay geometry: terminal markers,
// projection end markers, projection gradient defs, projection line marks and
// the profit-loss segment overlay.
//
// bklit has exactly ONE x scale per chart: `useChartStable().xScale`, published
// by `chart-context.tsx` and consumed unchanged by
// `line-series-terminal-marker.tsx:46` and `projection-line-end-marker.tsx:27`.
// The migrated charts cannot read TanStack's internal scale from outside the
// spec, so they re-derive it — but they must re-derive the SAME one. Feeding
// this helper `timeExtentRaw.minTime` / `timeExtent.maxTime` (the exact pair the
// chart hands to the spec's x domain) is what keeps the overlay co-located with
// the drawn series.
//
// Before this module line-chart.tsx carried five byte-identical copies that
// recomputed the extent inline from `renderData` and therefore SKIPPED the
// `xDomain` short-circuit `timeExtent` applies — so with a narrowed `xDomain`
// plus a projection the markers landed off the line. area-chart.tsx and
// composed-chart.tsx already read `timeExtent`/`timeExtentRaw`; line now does
// too (D347).

/**
 * Linear interpolation of `date` into `[0, innerWidth]` over `[minTime, maxTime]`.
 * Returns 0 for a degenerate (non-positive) span, matching every call site's
 * previous local guard.
 */
export function timeToPixelX(
  date: Date,
  minTime: number,
  maxTime: number,
  innerWidth: number,
): number {
  const span = maxTime - minTime;
  if (span <= 0) return 0;
  return ((date.getTime() - minTime) / span) * innerWidth;
}
