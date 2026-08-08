// Verbatim port of bklit-ui's packages/ui/src/charts/series-bar-layout.ts
// (read-only source at repos/bklit-ui/.../series-bar-layout.ts). Pure
// geometry, no framework deps — safe to copy byte-for-byte logic.

export function computeSeriesBarWidth(input: {
  innerWidth: number;
  dataLength: number;
  columnWidth: number;
  seriesCount: number;
  composedBarSize?: number;
  composedMaxBarSize?: number;
  composedBarGap?: number;
  stacked?: boolean;
}): number {
  const {
    innerWidth,
    dataLength,
    columnWidth,
    seriesCount,
    composedBarSize,
    composedMaxBarSize,
    composedBarGap = 4,
    stacked = false,
  } = input;
  const gap = composedBarGap;
  const groupCount = stacked ? 1 : Math.max(1, seriesCount);
  let slot = columnWidth;
  if (slot <= 0) {
    slot = dataLength < 2 ? innerWidth : innerWidth / (dataLength - 1);
  }
  let width =
    composedBarSize ?? Math.min(slot * 0.88, composedMaxBarSize ?? Number.POSITIVE_INFINITY);
  if (composedMaxBarSize != null) {
    width = Math.min(width, composedMaxBarSize);
  }
  if (groupCount > 1) {
    const maxGroup = slot * 0.92;
    const needed = groupCount * width + (groupCount - 1) * gap;
    if (needed > maxGroup && maxGroup > 0) {
      width = Math.max(4, (maxGroup - (groupCount - 1) * gap) / groupCount);
    }
  }
  return Math.max(2, width);
}

// Ported for parity/testability with bklit's own series-bar-layout.test.ts.
// NOT used by composed-chart.tsx's reveal implementation: the shared
// clip-path wipe there reuses the same plain SVG-bbox percentage technique
// as Line/Area (`inset(0 100% 0 0)` -> `inset(0 0% 0 0)`), and the marks
// group's own rendered bounding box (leftmost/rightmost bar edges) already
// equals `[-groupWidth/2, innerWidth+groupWidth/2]` for the unstacked-grouped
// case (verified algebraically against `computeSeriesBarLayout`'s barLeft
// formula in series-bar.tsx) — i.e. the browser's fill-box computation
// reproduces this exact padding automatically, with no separate padded
// clip-rect element needed. Kept here for documentation/parity only.
export function computeSeriesBarRevealClipPadding(input: {
  barWidth: number;
  seriesCount: number;
  gap?: number;
  stacked?: boolean;
}): number {
  const { barWidth, seriesCount, gap = 4, stacked = false } = input;
  if (stacked || seriesCount <= 1) {
    return Math.ceil(barWidth / 2);
  }
  const groupWidth = seriesCount * barWidth + (seriesCount - 1) * gap;
  return Math.ceil(groupWidth / 2);
}
