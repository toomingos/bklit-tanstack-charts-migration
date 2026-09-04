// Byte-mirror of bklit-heatmap.tsx; only the import source changes.
import { useEffect, useMemo, useRef, useState } from "react";
import {
  HeatmapChart,
  HeatmapCells,
  HeatmapXAxis,
  HeatmapYAxis,
  HeatmapTooltip,
  HeatmapLegend,
  HeatmapInteractionProvider,
  HeatmapInteractionBoundary,
} from "@migrated/charts";
import {
  generateHeatmap,
  generateHeatmapUpdate,
  type SeededHeatmapColumn,
} from "../../../data";
import { armBklitTimerSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";

// GUARD: settle is n-independent (cell stagger bounded by animationDuration); no phases.
const HEATMAP_ANIMATION_DURATION_MS = 1600;
const HEATMAP_SETTLE_MARGIN_MS = 100;

export default function MigratedHeatmap({ n, state }: { n: number; state?: "ready" | "loading" }) {
  const [columns, setColumns] = useState<SeededHeatmapColumn[]>(() =>
    generateHeatmap("heatmap", n),
  );
  const tickRef = useRef(0);

  // Armed once per mount so data re-renders don't re-arm it.
  useMemo(() => {
    armBklitTimerSettle(HEATMAP_ANIMATION_DURATION_MS + HEATMAP_SETTLE_MARGIN_MS);
  }, []);

  useEffect(() => {
    window.__benchUpdate = () =>
      measureUpdatePaint(() => {
        tickRef.current += 1;
        setColumns(generateHeatmapUpdate("heatmap", n, tickRef.current));
      });
    // GUARD: n is week count; no live-append concept.
    window.__benchLiveTick = () => {};
  }, [n]);

  return (
    <HeatmapInteractionProvider>
      <HeatmapInteractionBoundary>
        <div className="flex w-full flex-col items-stretch gap-3">
          <HeatmapChart
            className="w-full"
            data={columns}
            layout="fluid"
            status={state === "loading" ? "loading" : "ready"}
            loadingLabel={state === "loading" ? "Loading data" : undefined}
          >
            <HeatmapCells />
            <HeatmapXAxis />
            <HeatmapYAxis />
            <HeatmapTooltip />
          </HeatmapChart>
          <HeatmapLegend />
        </div>
      </HeatmapInteractionBoundary>
    </HeatmapInteractionProvider>
  );
}
