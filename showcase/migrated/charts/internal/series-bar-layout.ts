// Slot-fill ratios from bklit: a lone bar fills 88% of its slot; a grouped row is
// Capped at 92% of the slot, shrinking bars to a 4px floor when crowded.
const SERIES_BAR_SLOT_FILL_RATIO = 0.88;
const SERIES_BAR_GROUP_FILL_RATIO = 0.92;
const SERIES_BAR_MIN_SHRUNK_WIDTH_PX = 4;

const resolveSeriesBarSlot = (columnWidth: number, innerWidth: number, dataLength: number): number => {
  if (columnWidth > 0) {return columnWidth;}
  return dataLength < 2 ? innerWidth : innerWidth / (dataLength - 1);
}

interface ShrinkBarWidthParams {
  readonly width: number;
  readonly slot: number;
  readonly groupCount: number;
  readonly gap: number;
}

const shrinkBarWidthToGroup = (params: Readonly<ShrinkBarWidthParams>): number => {
  if (params.groupCount <= 1) {return params.width;}
  const maxGroup = params.slot * SERIES_BAR_GROUP_FILL_RATIO;
  const needed = params.groupCount * params.width + (params.groupCount - 1) * params.gap;
  if (needed <= maxGroup || maxGroup <= 0) {return params.width;}
  return Math.max(SERIES_BAR_MIN_SHRUNK_WIDTH_PX, (maxGroup - (params.groupCount - 1) * params.gap) / params.groupCount);
}

const applyComposedMaxBarSize = (width: number, composedMaxBarSize: number | undefined): number => {
  if (composedMaxBarSize === undefined) {return width;}
  return Math.min(width, composedMaxBarSize);
}
const computeSeriesBarWidth = (input: Readonly<{
  innerWidth: number;
  dataLength: number;
  columnWidth: number;
  seriesCount: number;
  composedBarSize?: number;
  composedMaxBarSize?: number;
  composedBarGap?: number;
  stacked?: boolean;
}>): number => {
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
  const slot = resolveSeriesBarSlot(columnWidth, innerWidth, dataLength);
  const baseWidth =
    composedBarSize ?? Math.min(slot * SERIES_BAR_SLOT_FILL_RATIO, composedMaxBarSize ?? Number.POSITIVE_INFINITY);
  const cappedWidth = applyComposedMaxBarSize(baseWidth, composedMaxBarSize);
  const width = shrinkBarWidthToGroup({ gap, groupCount, slot, width: cappedWidth });
  return Math.max(2, width);
}

// Test-suite parity only; the runtime reveal path uses the rendered bbox instead.
const computeSeriesBarRevealClipPadding = (input: Readonly<{
  barWidth: number;
  seriesCount: number;
  gap?: number;
  stacked?: boolean;
}>): number => {
  const { barWidth, seriesCount, gap = 4, stacked = false } = input;
  if (stacked || seriesCount <= 1) {
    return Math.ceil(barWidth / 2);
  }
  const groupWidth = seriesCount * barWidth + (seriesCount - 1) * gap;
  return Math.ceil(groupWidth / 2);
}

export { computeSeriesBarWidth, computeSeriesBarRevealClipPadding };
