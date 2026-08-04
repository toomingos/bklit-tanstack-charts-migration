// Ring scenario -- authored against the docs demo
// (repos/bklit-ui/apps/web/components/docs/ring-chart-demo.tsx's
// `RingChartBasicDemo`), per docs/LOG.md D27's ruling that ring's registry
// example (registry/examples/ring-chart.tsx) is TYPE-BROKEN -- it omits the
// REQUIRED `maxValue` field on its sample data (doesn't typecheck; would
// sweep NaN progress angles at runtime) -- so the docs demo, not the
// registry, is this scenario's basis (D22/D24 precedent for broken registry
// examples):
//
//   <RingChart data={sessionsData} size={280}>
//     {sessionsData.map((item, i) => <Ring index={i} key={item.label} />)}
//     <RingCenter />
//   </RingChart>
//
// `RingCenter` ALWAYS mounts here (D27: "RingCenter always mounts per D27 --
// include it as the docs demo does" -- unlike PieCenter, which the pie pilot
// drops because it's provably inert at `innerRadius=0`). `RingChart` has no
// solid/donut distinction -- its rings are always annuli (`baseInnerRadius`
// is never 0 by default), so `RingCenter`'s center area is always real,
// nonzero, visible space; there is no D27-style inertness argument here.
// Hover is intentionally left UNCONTROLLED (no `hoveredIndex`/
// `onHoverChange` passed to `RingChart`), mirroring bklit-radar.tsx/
// bklit-pie.tsx: `Ring` already wires its own `onMouseEnter`/`onMouseLeave`
// into `RingChart`'s internal uncontrolled hover state (ring-chart.tsx's
// `RingChartCore`), and the docs demo's `RingChartBasicDemo` variant (unlike
// the legend-paired `RingChartDemo`) doesn't control it either.
import { useEffect, useMemo, useRef, useState } from "react";
import { Ring, RingCenter, RingChart } from "@bklitui/ui/charts";
import {
  generateRing,
  generateRingUpdate,
  type SeededRing,
} from "../../../data";
import { armManualSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";

// --- Size ------------------------------------------------------------------
// `RingChartBasicDemo`'s own `size={280}` prop, verbatim -- same footprint
// as bklit-pie.tsx's registry-parity size, comfortably inside #chart-root's
// usable width/height at every gate/structural n. `RingChart`'s own
// concentric-radius scaling (`designOuterRadius`/`scale` in ring-chart.tsx)
// already shrinks `strokeWidth`/`ringGap`/`baseInnerRadius` to fit as ring
// COUNT (`n`) grows, so this fixed size is correct at n=1/4/20/50 alike.
const RING_SIZE = 280;

// --- Settle detection (M1b) for this phase-less chart -----------------------
// Like PieChart/RadarChart, `RingChart` exposes NO `onPhaseChange`/`status`
// prop. Computed directly from the read sources (ring-chart.tsx / ring.tsx /
// use-mount-progress.ts / animation.ts). NOTE: `RingChartProps` declares an
// `animationDuration?: number` prop ("Default: 1100ms" per its own doc
// comment, ring-chart.tsx line 54) but it is NEVER destructured or read
// anywhere else in ring-chart.tsx -- a dead/unused prop (same broken-surface
// pattern D27 already found in ring's registry example and D22/D24 found
// elsewhere). The REAL reveal timing comes from `enterTransition` defaulting
// to `DEFAULT_CHART_ENTER_TRANSITION` (animation.ts: tween,
// `DEFAULT_ANIMATION_DURATION_MS = 1100`ms), exactly like pie/radar -- this
// scenario doesn't override `enterTransition`/`enterStaggerScale`, matching
// the docs demo.
//
// `Ring` (ring.tsx) runs TWO staggered phases per ring index i (0-based):
//   expandDelay(i)   = i * 0.08 * enterStaggerScale         (track scale-pop)
//   progressDelay(i) = (0.6 + i * 0.1) * enterStaggerScale  (progress sweep)
// Both phases share the same 1100ms tween duration (mountProgress via
// `useMountProgress`, no `enterTransition` override, same fallback as
// above). For every index i, progressDelay(i) > expandDelay(i)
// (0.6 + 0.02*i > 0 always), and progressDelay is increasing in i, so the
// LAST-finishing animation across all rings is always the last ring's (i =
// n-1) progress-arc sweep:
//
//   Last-animation-end = (0.6 + (n-1) * 0.1) * 1000 + 1100 ms
//                       = 600 + (n-1) * 100 + 1100 ms
//
//     n=1  (gate)       -> 1700ms      n=4  (gate)       -> 2000ms
//     n=20 (structural) -> 3600ms      n=50 (structural) -> 6600ms
//
// This is docs/LOG.md D27's cited formula: "ring (600+100(n-1))+1100ms".
//
// Settle protocol (Fable edit, docs/LOG.md D51 -- bklit-radar.tsx/
// bklit-pie.tsx D48/D49 precedent applied verbatim): originally
// `armBklitTimerSettle(ringSettleMs(n))`, whose shared 2500ms `FALLBACK_MS`
// wedge-guard resolves BELOW the computed end at the structural sizes
// (n=20 -> 3600ms, n=50 -> 6600ms), i.e. mid-reveal -- and ASYMMETRICALLY
// vs migrated-ring.tsx, which already used the `armManualSettle` pattern:
// QA's n=50 settled capture caught bklit mid-stagger (~2.7s, outer rings
// not yet revealed) against a fully-revealed migrated, a pure harness
// artifact. Switched to `armManualSettle` with the same computed formula +
// the shared REVEAL_CLOCK_MARGIN_MS, matching migrated-ring.tsx exactly so
// M1b absorbs the constant symmetrically -- the two radar/pie scenario
// pairs' arrangement.
function ringSettleMs(n: number): number {
  const enterStaggerScale = 1;
  const enterDurationMs = 1100; // DEFAULT_CHART_ENTER_TRANSITION (animation.ts)
  const baseDelayMs = 0.6 * enterStaggerScale * 1000;
  const staggerMs = 0.1 * enterStaggerScale * 1000;
  return baseDelayMs + Math.max(0, n - 1) * staggerMs + enterDurationMs;
}

// Same constant/derivation as the radar/pie scenario pairs'
// REVEAL_CLOCK_MARGIN_MS (bklit-radar.tsx has the full comment; docs/LOG.md
// D48): covers the gap between this scenario arming the settle timer at
// render and the chart's framer animation timeline actually starting at
// effect time. M1b (not gated) absorbs the constant; migrated-ring.tsx
// applies it identically.
const REVEAL_CLOCK_MARGIN_MS = 250;

export default function BklitRing({ n }: { n: number }) {
  const [data, setData] = useState<SeededRing[]>(() => generateRing("ring", n));
  const tickRef = useRef(0);

  useMemo(() => {
    const settleMs = ringSettleMs(n) + REVEAL_CLOCK_MARGIN_MS;
    const { resolve } = armManualSettle(settleMs + 3000);
    window.setTimeout(() => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    }, settleMs);
  }, [n]);

  useEffect(() => {
    window.__benchUpdate = () =>
      measureUpdatePaint(() => {
        tickRef.current += 1;
        setData(generateRingUpdate("ring", n, tickRef.current));
      });
    // Ring's `n` is RING COUNT, not a time-series window (radar/pie
    // precedent) -- no live-append concept applies.
    window.__benchLiveTick = () => {};
  }, [n]);

  return (
    <RingChart data={data} size={RING_SIZE}>
      {data.map((item, i) => (
        <Ring index={i} key={item.label} />
      ))}
      <RingCenter />
    </RingChart>
  );
}
