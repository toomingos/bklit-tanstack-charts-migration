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

const bucketHeatmapCellsByOpacity = ({
  cellData,
  resolvedLevelStyles,
  rowOpacity,
}: Readonly<BucketHeatmapCellsParams>): Map<number, CellDatum[]> => {
  const buckets = new Map<number, CellDatum[]>();
  for (const d of cellData) {
    const fillOpacity =
      resolveHeatmapRowOpacity(d.row, rowOpacity) *
      heatmapLevelCellFillOpacity(resolvedLevelStyles[d.level] ?? resolvedLevelStyles[0]);
    let bucket = buckets.get(fillOpacity);
    if (!bucket) {
      bucket = [];
      buckets.set(fillOpacity, bucket);
    }
    bucket.push(d);
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
    // D5: epoch-suffixed so a revealEpoch bump re-triggers the 'enter'
    // Motion phase (matching legacy's "reveal replays on refresh") — see
    // The mount-flash trade-off note on the cell-motion helper above.
    key: (d: Readonly<CellDatum>) => `${d.column}-${d.row}:${revealEpoch}`,
    motion: cellMotion,
    radius: cornerRadius,
    states: hoverStates,
    x: (d: Readonly<CellDatum>) => d.colKey,
    y: (d: Readonly<CellDatum>) => d.rowKey,
    z: (d: Readonly<CellDatum>) => d.level,
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
  // Bklit `resolveHeatmapRowOpacity` x `heatmapLevelCellFillOpacity` parity:
  // Legacy applied this product as each cell rect's OWN (non-hover-driven)
  // `fillOpacity`, independent of and layered under the hover dim. Rect/cell
  // Marks only take a single SCALAR `fillOpacity` per mark instance (not a
  // Per-datum channel — dist/rect.d.ts), so cells are bucketed into one
  // `cell()` mark per distinct resolved value. Buckets are keyed by data
  // (row/level), never by hover, so membership — and therefore each cell's
  // Owning mark/DOM element identity — never changes on hover, preserving
  // Smooth `states` transitions (no remount/snap). In the common case
  // (uniform rowOpacity, solid levelStyles) this collapses to exactly one
  // Bucket, i.e. one mark, matching the pre-C3 shape.
  //
  // Trade-off (disclosed, no QA possible per rules): folding `revealEpoch`
  // Into `key()` forces every cell's mark identity (and DOM node) to change
  // On every epoch bump so the native motion engine re-runs the 'enter'
  // Phase — matching legacy's "reveal replays on refresh"
  // Behavior. `heatmap-lifecycle.ts`'s `revealEpoch` bumps both on
  // Loading->ready AND on a mount-time effect that fires on initial mount
  // Too, so mount already goes through key `...:0` -> (if the mount effect
  // Also bumps) `...:1`, i.e. an unmount/remount of every cell's mark within
  // The same paint pass this file cannot single-step through without a
  // Browser (no-QA rule) — flagged here rather than silently assumed benign.
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
