import { useMemo } from "react";
import type { ChartMark, ChartMarkState, ChartMotionDefinition, ChartRectStateStyle } from "@tanstack/charts";
import { cell } from "@tanstack/charts/rect";
import { heatmapLevelCellFillOpacity } from "./heatmap-colors";
import type { HeatmapLevelStyles } from "./heatmap-colors";
import { HEATMAP_CELL_INSET } from "./heatmap-hover-states";
import { resolveHeatmapRowOpacity } from "./heatmap-utils";
import type { CellDatum } from "./heatmap-cell-data";

type HeatmapHoverStateList = readonly Readonly<ChartMarkState<CellDatum, ChartRectStateStyle<CellDatum>>>[] | undefined;

type HeatmapRowOpacity = number | readonly number[] | undefined;

interface HeatmapCellMarksParams {
  readonly cellData: readonly Readonly<CellDatum>[];
  readonly resolvedLevelStyles: HeatmapLevelStyles;
  readonly rowOpacity: HeatmapRowOpacity;
  readonly cornerRadius: number;
  readonly hoverStates: HeatmapHoverStateList;
  readonly cellMotion: ChartMotionDefinition<CellDatum> | false;
  readonly revealEpoch: number;
}

interface BucketHeatmapCellsParams {
  readonly cellData: readonly Readonly<CellDatum>[];
  readonly resolvedLevelStyles: HeatmapLevelStyles;
  readonly rowOpacity: HeatmapRowOpacity;
}

// Fallback level used when a datum's level has no resolved style: the first (empty) level.
const FALLBACK_LEVEL_INDEX = 0;

const bucketHeatmapCellsByOpacity = ({
  cellData,
  resolvedLevelStyles,
  rowOpacity,
}: Readonly<BucketHeatmapCellsParams>): Map<number, CellDatum[]> => {
  const buckets = new Map<number, CellDatum[]>();
  for (const datum of cellData) {
    const fillOpacity =
      resolveHeatmapRowOpacity(datum.row, rowOpacity) *
      heatmapLevelCellFillOpacity(resolvedLevelStyles[datum.level] ?? resolvedLevelStyles[FALLBACK_LEVEL_INDEX]);
    let bucket = buckets.get(fillOpacity);
    if (!bucket) {
      bucket = [];
      buckets.set(fillOpacity, bucket);
    }
    bucket.push(datum);
  }
  return buckets;
};

interface BuildHeatmapCellMarkParams {
  readonly fillOpacity: number;
  readonly data: readonly Readonly<CellDatum>[];
  readonly cornerRadius: number;
  readonly hoverStates: HeatmapHoverStateList;
  readonly cellMotion: ChartMotionDefinition<CellDatum> | false;
  readonly revealEpoch: number;
}

const buildHeatmapCellMark = ({
  fillOpacity,
  data,
  cornerRadius,
  hoverStates,
  cellMotion,
  revealEpoch,
}: Readonly<BuildHeatmapCellMarkParams>): ChartMark<Readonly<CellDatum>, string, string> =>
  cell(data, {
    fillOpacity,
    id: `heatmap-cell-fo-${fillOpacity}`,
    inset: HEATMAP_CELL_INSET,
    // D5: epoch-suffixed so a revealEpoch bump re-triggers the 'enter' motion phase.
    // Matching legacy's "reveal replays on refresh" behavior.
    key: (datum: Readonly<CellDatum>) => `${datum.column}-${datum.row}:${revealEpoch}`,
    motion: cellMotion,
    radius: cornerRadius,
    states: hoverStates,
    x: (datum: Readonly<CellDatum>) => datum.colKey,
    y: (datum: Readonly<CellDatum>) => datum.rowKey,
    z: (datum: Readonly<CellDatum>) => datum.level,
  });

const useHeatmapCellMarks = ({
  cellData,
  resolvedLevelStyles,
  rowOpacity,
  cornerRadius,
  hoverStates,
  cellMotion,
  revealEpoch,
}: Readonly<HeatmapCellMarksParams>): ChartMark<Readonly<CellDatum>, string, string>[] => {
  /*
   * One mark per distinct fillOpacity (marks take a scalar, not a per-datum channel), keyed by
   * data so hover never remounts cells; epoch-folded keys replay legacy's reveal on refresh.
   */
  const cellMarks = useMemo(() => {
    const buckets = bucketHeatmapCellsByOpacity({ cellData, resolvedLevelStyles, rowOpacity });
    return [...buckets.entries()].map(([fillOpacity, data]: readonly [number, readonly Readonly<CellDatum>[]]) =>
      buildHeatmapCellMark({ cellMotion, cornerRadius, data, fillOpacity, hoverStates, revealEpoch }),
    );
  }, [cellData, resolvedLevelStyles, rowOpacity, cornerRadius, hoverStates, cellMotion, revealEpoch]);
  return cellMarks;
};

type HeatmapCellMark = ReturnType<typeof useHeatmapCellMarks>[number];

export { bucketHeatmapCellsByOpacity, buildHeatmapCellMark, useHeatmapCellMarks };
export type {
  BucketHeatmapCellsParams,
  BuildHeatmapCellMarkParams,
  HeatmapCellMark,
  HeatmapCellMarksParams,
  HeatmapHoverStateList,
  HeatmapRowOpacity,
};
