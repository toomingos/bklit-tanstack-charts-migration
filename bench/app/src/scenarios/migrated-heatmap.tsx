// Migrated HeatmapChart scenario — byte-mirror of bklit-heatmap.tsx (same
// component tree, same props, same n-independent
// armBklitTimerSettle(HEATMAP_ANIMATION_DURATION_MS + HEATMAP_SETTLE_MARGIN_MS)
// settle mechanism since the migrated HeatmapChart exposes no
// onPhaseChange/status output here either, matching the CandlestickChart/
// migrated-candlestick.tsx precedent), only the import source changes
// (@bklitui/ui/charts -> @migrated/charts).
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

// Mirrors bklit-heatmap.tsx exactly: the migrated HeatmapChart intentionally
// keeps the same internal 4-state lifecycle machine
// (loading/revealing/ready/exitingReady) and flips revealing -> ready via a
// plain timer fired `animationDuration` after mount/reveal-signature-change
// — no onPhaseChange/status output is added here either (parity). The
// per-cell staggered fade delay+duration is bounded WITHIN
// animationDuration regardless of `n` (week count), so this settle time is
// intentionally n-independent, matching bklit-heatmap.tsx's own documented
// D31 citation.
const HEATMAP_ANIMATION_DURATION_MS = 1600;
const HEATMAP_SETTLE_MARGIN_MS = 100;

export default function MigratedHeatmap({ n }: { n: number }) {
  const [columns, setColumns] = useState<SeededHeatmapColumn[]>(() =>
    generateHeatmap("heatmap", n),
  );
  const tickRef = useRef(0);

  // Arm once per mount, synchronously during render (matching the
  // bklit-heatmap.tsx convention) so it isn't re-armed on every
  // data-driven re-render.
  useMemo(() => {
    armBklitTimerSettle(HEATMAP_ANIMATION_DURATION_MS + HEATMAP_SETTLE_MARGIN_MS);
  }, []);

  useEffect(() => {
    window.__benchUpdate = () =>
      measureUpdatePaint(() => {
        tickRef.current += 1;
        setColumns(generateHeatmapUpdate("heatmap", n, tickRef.current));
      });
    // Heatmap's `n` is week count (D31), not a live-append time-series
    // axis -- there is no "append one live point" concept to port here
    // (radar/pie/ring/gauge/funnel precedent).
    window.__benchLiveTick = () => {};
  }, [n]);

  return (
    <HeatmapInteractionProvider>
      <HeatmapInteractionBoundary>
        <div className="flex w-full flex-col items-stretch gap-3">
          <HeatmapChart className="w-full" data={columns} layout="fluid">
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
