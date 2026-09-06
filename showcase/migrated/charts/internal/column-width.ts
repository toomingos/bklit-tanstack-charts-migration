// Tooltip indicator column width (legacy time-series-chart-shell parity).
const resolveColumnWidth = (params: Readonly<{
  readonly plotWidth: number;
  readonly xDomain: readonly [Readonly<Date>, Readonly<Date>] | undefined;
  readonly xDomainSlotCount: number | undefined;
  readonly dataLength: number;
}>): number => {
  // Brush selections keep full-dataset slots; otherwise slots are the visible rows.
  const slotCount = params.xDomain !== undefined && params.xDomainSlotCount !== undefined ? params.xDomainSlotCount : params.dataLength;
  if (slotCount < 2) {return 0;}
  return params.plotWidth / (slotCount - 1);
};

export { resolveColumnWidth };
