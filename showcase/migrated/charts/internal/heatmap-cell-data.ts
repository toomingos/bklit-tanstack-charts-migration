import { getHeatmapContributionLevel, isHeatmapGhostBin } from "./heatmap-utils";
import type { HeatmapColumn, HeatmapDisplayRange } from "./heatmap-utils";

interface CellDatum {
  colKey: string;
  rowKey: string;
  column: number;
  row: number;
  count: number;
  level: number;
  date: Readonly<Date>;
  bin: number;
  isGhost: boolean;
}

interface BuildCellDataParams {
  readonly columns: readonly HeatmapColumn[];
  readonly dayLabels: readonly string[];
  readonly displayRange: HeatmapDisplayRange | undefined;
  readonly hideGhost: boolean;
}

interface BuildColumnCellDataParams {
  readonly bins: readonly HeatmapColumn["bins"][number][];
  readonly columnIndex: number;
  readonly dayLabels: readonly string[];
  readonly displayRange: HeatmapDisplayRange | undefined;
  readonly hideGhost: boolean;
}

const buildColumnCellData = ({
  bins,
  columnIndex,
  dayLabels,
  displayRange,
  hideGhost,
}: Readonly<BuildColumnCellDataParams>): CellDatum[] => {
  const cells: CellDatum[] = [];
  for (let rowIdx = 0; rowIdx < bins.length; rowIdx += 1) {
    const bin = bins[rowIdx];
    if (bin) {
      const isGhost = hideGhost && displayRange !== undefined && isHeatmapGhostBin(bin, displayRange);
      cells.push({
        bin: bin.bin,
        colKey: String(columnIndex),
        column: columnIndex,
        count: bin.count,
        date: bin.date,
        isGhost,
        level: isGhost ? -1 : getHeatmapContributionLevel(bin.count),
        row: rowIdx,
        rowKey: dayLabels[rowIdx] ?? `${rowIdx}`,
      });
    }
  }
  return cells;
};

const buildCellData = ({
  columns,
  dayLabels,
  displayRange,
  hideGhost,
}: Readonly<BuildCellDataParams>): CellDatum[] => {
  const data: CellDatum[] = [];
  for (let colIdx = 0; colIdx < columns.length; colIdx += 1) {
    const col = columns[colIdx];
    if (col) {
      data.push(...buildColumnCellData({ bins: col.bins, columnIndex: colIdx, dayLabels, displayRange, hideGhost }));
    }
  }
  return data;
};

interface HoverCellGeometry {
  height: number;
  width: number;
  x: number;
  y: number;
}

const buildHoverCellGeometry = (
  columnIndex: number,
  rowIndex: number,
  ctx: Readonly<{ xScale: (columnIndex: number) => number; yScale: (rowIndex: number) => number; binWidth: number; binHeight: number; gap: number }>,
): HoverCellGeometry => ({
  height: Math.max(ctx.binHeight - ctx.gap, 0),
  width: Math.max(ctx.binWidth - ctx.gap, 0),
  x: ctx.xScale(columnIndex),
  y: ctx.yScale(rowIndex) + ctx.gap,
});

export { buildCellData, buildColumnCellData, buildHoverCellGeometry };
export type { BuildCellDataParams, BuildColumnCellDataParams, CellDatum, HoverCellGeometry };
