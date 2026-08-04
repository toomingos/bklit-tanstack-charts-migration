// Funnel (horizontal) scenario -- authored against the docs demo
// (repos/bklit-ui/apps/web/content/docs/components/funnel-chart.mdx), per
// docs/LOG.md D30's ruling that funnel's registry example
// (registry/examples/funnel-chart.tsx) is the FIFTH broken registry example
// found in this migration -- it passes a nonexistent `aspectRatio` prop to
// `FunnelChart`, which has no such prop (verified directly against
// `FunnelChartProps` in funnel-chart.tsx) -- so the docs demo's 5-stage
// snippet is the basis instead:
//
//   <FunnelChart
//     data={funnelData}
//     color="var(--chart-1)"
//     layers={3}
//   />
//
// This scenario swaps the demo's literal 5-stage `funnelData` for this
// bench's seeded `data` (bench/data.ts's `generateFunnel`, `n` = stage
// count per D30) and keeps every other prop identical to the docs demo
// (`color`, `layers` -- both are already the component's own defaults, kept
// explicit here purely for docs-demo-verbatim parity, not because either
// value differs from what omitting them would produce).
//
// --- The D30 grid landmine (READ BEFORE TOUCHING THIS PROP) ---------------
// `FunnelChart` defaults `grid` to `false` (funnel-chart.tsx:767,
// `grid: gridProp = false`). With `grid=false`, `gridEnabled` is false and
// NO grid `<svg>` renders at all -- the first `<svg>` element under the
// chart root would then be whichever per-SEGMENT `<svg>` mounts first
// inside `HSegment`/`VSegment` (funnel-chart.tsx's `enterComplete` branches),
// which is only ~W/n px wide, not the full chart. The bench/QA harness's
// hover-fraction math (and pixelmatch's bounding-box assumptions) are keyed
// off the FIRST `<svg>`'s bounding box being the full chart -- a per-segment
// svg there would silently corrupt every hover coordinate on the bklit side
// ONLY (the tanstack ceiling has no such per-node svg quirk), a QA landmine
// D30 found by reading the source, not by a failing gate.
//
// The fix (D30, "the bklit scenarios MUST pass
// `grid={{bands:false, lines:false}}`"): passing an OBJECT (even one that
// disables both bands and lines) makes `gridEnabled = gridProp !== false`
// true, so the grid `<svg>` wrapper still mounts FIRST in DOM order, sized
// to the full chart (`viewBox="0 0 ${W} ${H}"`) -- but since
// `showBands`/`showGridLines` both resolve to `false` inside it, it renders
// completely empty (no `<rect>`/`<line>` children). Net effect: a real,
// full-size, invisible `<svg>` landmark first in the DOM, byte-identical
// final pixels to the `grid=false` default (nothing else in the chart reads
// the grid config), and the harness's first-svg bounding box is now correct.
// This is the exact fix-from-scaffolding precedent D16 (scatter)/D19
// (candlestick) established for other charts' first-svg landmines.
import { useMemo, useEffect, useRef, useState } from "react";
import { FunnelChart } from "@bklitui/ui/charts";
import {
  generateFunnel,
  generateFunnelUpdate,
  type SeededFunnelStage,
} from "../../../data";
import { armManualSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";

// --- Settle detection (M1b) for this phase-less chart -----------------------
// Like RadarChart/PieChart/RingChart/Gauge, `FunnelChart` exposes NO
// `onPhaseChange`/`status` prop -- there is no callback to observe when its
// per-segment staggered reveal has actually finished. Computed directly from
// the read source (funnel-chart.tsx's `useMountProgress`/`useEnterComplete`
// plus the shared `DEFAULT_CHART_ENTER_TRANSITION` in animation.ts), with
// none of `FunnelChart`'s defaults overridden here (matching the docs demo:
// no `staggerDelay`/`enterTransition` props passed):
//
//   staggerDelay = 0.12s (FunnelChart's own default, funnel-chart.tsx:759)
//   Each segment's `useMountProgress(enterTransition, index*staggerDelay, i)`
//   drives a MotionValue 0->1 via `animate(progress, 1, {...transition,
//   delay: index*staggerDelay})`; since `enterTransition` is left undefined
//   here (docs-demo parity), it falls back to
//   `DEFAULT_CHART_ENTER_TRANSITION` (animation.ts): a plain TWEEN (not a
//   spring -- no settle-tail overshoot to account for, unlike gauge/pie's
//   spring-driven reveals) of duration `DEFAULT_ANIMATION_DURATION_MS/1000`
//   = 1.1s.
//
//   The LAST-finishing segment is index n-1 (0-based), so:
//     settleMs = (n-1) * staggerDelay*1000 + animationDurationMs
//              = (n-1) * 120 + 1100
//
// This is docs/LOG.md D30's cited formula verbatim: "settle = (n-1)*120+1100
// ms via armBklitTimerSettle". Verified against source: `staggerDelay=0.12`
// (funnel-chart.tsx:759, `staggerDelay = 0.12`) and the 1100ms tween
// (animation.ts's `DEFAULT_ANIMATION_DURATION_MS = 1100`, consumed as a
// plain `{type:"tween", duration: 1.1, ease:[0.85,0,0.15,1]}` transition --
// no spring, no settle tail to add, unlike gauge's {300,20} spring reveal).
//
//   n=5  (primary gate, D30)  -> (5-1)*120+1100  = 1580ms
//   n=20 (structural)         -> (20-1)*120+1100 = 3380ms
//   n=50 (structural)         -> (50-1)*120+1100 = 6980ms
//
// Settle protocol (Fable edit, docs/LOG.md D51/D52 settle-arm alignment
// precedent): originally `armBklitTimerSettle(funnelSettleMs(n))`, whose
// shared 2500ms `FALLBACK_MS` wedge-guard resolves BELOW the computed end
// at the structural sizes (n=20 -> 3380ms, n=50 -> 6980ms), i.e.
// mid-reveal. The old "harmless, no gate reads those rows" note was
// disproven by D47: qa/screenshot.mjs gates EVERY capture on
// `__benchSettled`, and n=20/50 ARE in the QA matrix (D39/D41). Switched
// to `armManualSettle` + the shared REVEAL_CLOCK_MARGIN_MS, matching the
// migrated pair exactly so M1b absorbs the constant symmetrically.
const STAGGER_DELAY_MS = 120; // FunnelChart's default staggerDelay=0.12s
const ANIMATION_DURATION_MS = 1100; // DEFAULT_ANIMATION_DURATION_MS (animation.ts)

function funnelSettleMs(n: number): number {
  return Math.max(0, n - 1) * STAGGER_DELAY_MS + ANIMATION_DURATION_MS;
}

// Same constant/derivation as every other phase-less scenario pair's
// REVEAL_CLOCK_MARGIN_MS (bklit-radar.tsx has the full comment; docs/LOG.md
// D48). M1b (not gated) absorbs it; the migrated pair applies it identically.
const REVEAL_CLOCK_MARGIN_MS = 250;

export default function BklitFunnel({ n }: { n: number }) {
  const [data, setData] = useState<SeededFunnelStage[]>(() =>
    generateFunnel("funnel", n),
  );
  const tickRef = useRef(0);

  useMemo(() => {
    const settleMs = funnelSettleMs(n) + REVEAL_CLOCK_MARGIN_MS;
    const { resolve } = armManualSettle(settleMs + 3000);
    window.setTimeout(() => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    }, settleMs);
  }, [n]);

  useEffect(() => {
    window.__benchUpdate = () =>
      measureUpdatePaint(() => {
        tickRef.current += 1;
        setData(generateFunnelUpdate("funnel", n, tickRef.current));
      });
    // Funnel's `n` is STAGE COUNT, not a time-series window (radar/pie/ring/
    // gauge precedent) -- there is no "append one live point" concept to
    // port here. `__benchLiveTick` is wired as a documented no-op purely so
    // the global exists for anything that probes for its presence.
    window.__benchLiveTick = () => {};
  }, [n]);

  return (
    <FunnelChart
      color="var(--chart-1)"
      data={data}
      grid={{ bands: false, lines: false }}
      layers={3}
    />
  );
}
