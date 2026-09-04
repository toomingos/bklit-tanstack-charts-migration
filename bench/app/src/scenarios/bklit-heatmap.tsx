// Registry-verbatim port (n = week count); seeded data replaces the static sample.
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
} from "@bklitui/ui/charts";
import {
  generateHeatmap,
  generateHeatmapUpdate,
  type SeededHeatmapColumn,
} from "../../../data";
import { armBklitTimerSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";

// Phase-less chart (no onPhaseChange): settle replicates the internal 1600ms reveal timer + 100ms margin.
const HEATMAP_ANIMATION_DURATION_MS = 1600;
const HEATMAP_SETTLE_MARGIN_MS = 100;

export default function BklitHeatmap({ n, state }: { n: number; state?: "ready" | "loading" }) {
  const [columns, setColumns] = useState<SeededHeatmapColumn[]>(() =>
    generateHeatmap("heatmap", n),
  );
  const tickRef = useRef(0);

  // Arm once per mount; n-independent (cell fades are bounded within the reveal).
  useMemo(() => {
    armBklitTimerSettle(HEATMAP_ANIMATION_DURATION_MS + HEATMAP_SETTLE_MARGIN_MS);
  }, []);

  useEffect(() => {
    window.__benchUpdate = () =>
      measureUpdatePaint(() => {
        tickRef.current += 1;
        setColumns(generateHeatmapUpdate("heatmap", n, tickRef.current));
      });
    // n = week count, not a window: no live-append concept.
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
