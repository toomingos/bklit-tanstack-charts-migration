import { getHeatmapContributionLevel, isHeatmapGhostBin } from "./heatmap-utils";
import type { HeatmapColumn, HeatmapDisplayRange } from "./heatmap-utils";

interface CellDatum {
  readonly colKey: string;
  readonly rowKey: string;
  readonly column: number;
  readonly row: number;
  count: number;
  readonly level: number;
  readonly date: Readonly<Date>;
  readonly bin: number;
  readonly isGhost: boolean;
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
    data.push(...buildColumnCellData({ bins: col.bins, columnIndex: colIdx, dayLabels, displayRange, hideGhost }));
  }
  return data;
};

// Base cell inset: native-`inset` equivalent of bklit's center-origin scale pop.
const HEATMAP_CELL_INSET = 1;

export { buildCellData, buildColumnCellData, HEATMAP_CELL_INSET };
export type { BuildCellDataParams, BuildColumnCellDataParams, CellDatum };
