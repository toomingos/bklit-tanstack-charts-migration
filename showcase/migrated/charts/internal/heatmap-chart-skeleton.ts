import type { HeatmapBin, HeatmapColumn } from "./heatmap-utils";

// Skeleton rows mirror the target columns with zeroed counts. Split out of the loading wrapper so that file only exports its loading component.
const generateHeatmapSkeletonFromTarget = (target: readonly Readonly<HeatmapColumn>[]): HeatmapColumn[] =>
  target.map((column: Readonly<HeatmapColumn>) => ({
    bin: column.bin,
    bins: column.bins.map((bin: Readonly<HeatmapBin>) => ({ bin: bin.bin, count: 0, date: bin.date })),
  }));

export { generateHeatmapSkeletonFromTarget };
