// Faithful port of the registry example (verified CLEAN per docs/LOG.md
// D31 -- "first since gauge"):
// repos/bklit-ui/packages/ui/registry/examples/heatmap-chart.tsx
//
//   <HeatmapInteractionProvider>
//     <HeatmapInteractionBoundary>
//       <div className="flex w-full flex-col items-stretch gap-3">
//         <HeatmapChart className="w-full" data={data} layout="fluid">
//           <HeatmapCells />
//           <HeatmapXAxis />
//           <HeatmapYAxis />
//           <HeatmapTooltip />
//         </HeatmapChart>
//         <HeatmapLegend />
//       </div>
//     </HeatmapInteractionBoundary>
//   </HeatmapInteractionProvider>
//
// This scenario swaps the registry's static sample data for this bench's
// seeded `generateHeatmap`/`generateHeatmapUpdate` (bench/data.ts) and the
// harness's `n` (D31: "n = WEEK COUNT"), keeping every other prop/default
// untouched -- no `sizingColumnCount`/`binSize`/`gap`/`colorScale`/
// `levelColors`/`levelStyles`/`animationDuration`/`enterTransition`/
// `enterStaggerScale`/`weekStartDay`/`columnSeparators` overrides, matching
// the registry demo exactly.
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

// --- Settle detection (M1b) for this phase-less chart -------------------
// `HeatmapChartProps` (repos/bklit-ui/packages/ui/src/charts/heatmap/
// heatmap-chart.tsx) has NO `onPhaseChange` prop and no externally
// observable `status` output -- verified by reading the full prop list
// directly (data, xDomain, sizingColumnCount, layout, margin, binSize,
// gap, colorScale, levelColors, levelStyles, aspectRatio, className,
// status, loadingLabel, animationDuration, enterTransition,
// revealSignature, enterStaggerScale, animate, loadingOpacity,
// showLoadingCells, loadingCellMaxOpacity, loadingCellRandomness,
// columnSeparators, weekStartDay, children). Like CandlestickChart, it
// keeps its own internal 4-state lifecycle machine
// (loading/revealing/ready/exitingReady, `useHeatmapChartLifecycle`) and
// flips revealing -> ready via a plain `window.setTimeout(finishReveal,
// animationDuration)` fired at mount -- i.e. the reveal is genuinely done,
// not merely started, exactly `animationDuration` after mount. There is no
// earlier or later externally-observable signal to hook.
//
// We don't override `animationDuration` (mirroring the registry example
// exactly), so the component runs at its documented default,
// `HEATMAP_DEFAULT_ENTER_DURATION_MS` (heatmap-animation.ts) = 1600ms. That
// constant is NOT re-exported from the top-level `@bklitui/ui/charts`
// barrel this bench aliases against (verified: absent from
// packages/ui/src/charts/index.ts's heatmap export list -- only the inner
// charts/heatmap/index.ts barrel exports it), so it is hardcoded here
// instead, matching the `bklit-candlestick.tsx` precedent
// (`CANDLESTICK_ANIMATION_DURATION_MS`). Per docs/LOG.md D31 ("settle =
// 1600ms + ~100ms margin"), this is armed at 1700ms total. Notably, per
// D31's own citation of `computeHeatmapEnterFadeDelayMs`, every per-cell
// staggered fade delay+duration is bounded WITHIN `animationDuration`
// regardless of `n` (week count) -- so unlike gauge/candlestick, this
// settle time is intentionally n-INDEPENDENT. If a future bklit version
// changes this internal default without exposing it via props, this
// constant will silently drift out of sync with reality -- flagged here
// for reviewer attention.
const HEATMAP_ANIMATION_DURATION_MS = 1600;
const HEATMAP_SETTLE_MARGIN_MS = 100;

export default function BklitHeatmap({ n, state }: { n: number; state?: "ready" | "loading" }) {
  const [columns, setColumns] = useState<SeededHeatmapColumn[]>(() =>
    generateHeatmap("heatmap", n),
  );
  const tickRef = useRef(0);

  // Arm once per mount, synchronously during render (matching the
  // bklit-candlestick.tsx convention) so it isn't re-armed on every
  // data-driven re-render. n-independent (see doc block above), so no
  // per-n computation is needed here (unlike bklit-gauge.tsx).
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
