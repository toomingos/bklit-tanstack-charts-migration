// Pie scenario -- authored against the registry example
// (repos/bklit-ui/packages/ui/registry/examples/pie-chart.tsx), per
// docs/LOG.md D27's ruling that pie's registry example (unlike ring's) IS
// type-valid and is therefore the pilot's basis:
//
//   <PieChart data={pieData} size={280}>
//     {pieData.map((item, i) => <PieSlice index={i} key={item.label} />)}
//     <PieCenter defaultLabel="Traffic" />
//   </PieChart>
//
// `PieCenter` is DROPPED here (D27): the registry example never sets
// `innerRadius` on `PieChart` (default 0 -> solid pie), and `PieCenter`
// positions itself via `baseInnerRadius`/`centerSize` math that only
// produces a nonzero, visible area for a donut (`innerRadius > 0`) --
// verified directly in pie-chart.tsx (`innerRadius: innerRadiusProp` with no
// override) and ring-center.tsx's `centerSize = baseInnerRadius * 2 - 16`
// analog for pie-center.tsx. With `innerRadius=0` the center HTML layer
// still mounts but renders inert/invisible content in a zero-area center
// hole, so it is out of scope for this registry-parity pilot (donut+center
// is explicitly the extension pass per D27's ruling).
import { useEffect, useMemo, useRef, useState } from "react";
import { PieChart, PieSlice } from "@bklitui/ui/charts";
import {
  generatePie,
  generatePieUpdate,
  type SeededPieSlice,
} from "../../../data";
import { armManualSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";

// --- Size ------------------------------------------------------------------
// The registry example's own `size={280}` prop, verbatim -- comfortably
// inside #chart-root's ~1052px usable width (see bklit-radar.tsx's identical
// sizing note) and the 800px-tall bench viewport, at every gate/structural n
// (1/4/20/50): `PieChart`'s own hover-offset padding scales with `size`, not
// `n`, so slice COUNT never forces a resize here.
const PIE_SIZE = 280;

// --- Settle detection (M1b) for this phase-less chart -----------------------
// Like RadarChart (see bklit-radar.tsx) and CandlestickChart, `PieChart`
// exposes NO `onPhaseChange`/`status` prop -- there is no callback to
// observe when its staggered per-slice angular-sweep reveal has actually
// finished. Computed directly from the read sources (pie-chart.tsx /
// pie-slice.tsx / use-mount-progress.ts / animation.ts), with none of
// `PieChart`'s defaults overridden by this scenario (matching the registry
// example: no `enterTransition`/`enterStaggerScale` props passed):
//
//   pie-slice.tsx (`AnimatedSliceTranslate`/`AnimatedSliceGrow`, both
//   branches -- `PieSlice` defaults to `hoverEffect="translate"`):
//     animationDelay(i) = (0.1 + i * 0.08) * enterStaggerScale   (staggerScale=1)
//   (i = 0-based slice index; the arc's `d` sweeps startAngle -> endAngle
//   over `mountProgress`, which -- since no `enterTransition` prop is
//   threaded through here, matching the registry example -- falls back to
//   `DEFAULT_CHART_ENTER_TRANSITION` (animation.ts): a plain TWEEN of
//   duration `DEFAULT_ANIMATION_DURATION_MS / 1000` = 1.1s, i.e. an exact,
//   non-asymptotic end time, verified against animation.ts directly:
//   `DEFAULT_ANIMATION_DURATION_MS = 1100`.)
//
//   Last-animation-end (slice index n-1, 0-based) =
//     (0.1 + (n-1) * 0.08) * 1000 + 1100 ms  =  100 + (n-1) * 80 + 1100 ms
//
//     n=1  (gate)       -> 1200ms      n=4  (gate)       -> 1440ms
//     n=20 (structural) -> 2620ms      n=50 (structural) -> 4020ms
//
// This is docs/LOG.md D27's cited formula: "pie (100+80(n-1))+1100ms".
//
// Settle protocol (Fable edit, docs/LOG.md D48/D49 -- bklit-radar.tsx
// precedent applied verbatim): originally `armBklitTimerSettle(pieSettleMs
// (n))`, whose shared 2500ms `FALLBACK_MS` wedge-guard resolves BELOW the
// computed end at the structural sizes (n=20 -> 2620ms, n=50 -> 4020ms),
// i.e. mid-reveal -- and whose margin-less computed timer counts from arm
// time while the chart's framer animation timeline starts a beat later
// (effect time), mis-binning the last slices' reveal tail into the
// post-settle idle window (M2a). Switched to `armManualSettle` with the
// same computed formula + the shared REVEAL_CLOCK_MARGIN_MS, applied
// IDENTICALLY in migrated-pie.tsx so M1b absorbs the constant
// symmetrically -- exactly the two radar scenarios' arrangement.
function pieSettleMs(n: number): number {
  const enterStaggerScale = 1;
  const enterDurationMs = 1100; // DEFAULT_CHART_ENTER_TRANSITION (animation.ts)
  const baseDelayMs = 0.1 * enterStaggerScale * 1000;
  const staggerMs = 0.08 * enterStaggerScale * 1000;
  return baseDelayMs + Math.max(0, n - 1) * staggerMs + enterDurationMs;
}

// Same constant/derivation as the two radar scenarios' REVEAL_CLOCK_MARGIN_MS
// (bklit-radar.tsx has the full comment; docs/LOG.md D48): covers the gap
// between this scenario arming the settle timer at render and the chart's
// framer animation timeline actually starting at effect time. M1b (not
// gated) absorbs the constant; migrated-pie.tsx applies it identically.
const REVEAL_CLOCK_MARGIN_MS = 250;

export default function BklitPie({ n }: { n: number }) {
  const [data, setData] = useState<SeededPieSlice[]>(() => generatePie("pie", n));
  const tickRef = useRef(0);

  useMemo(() => {
    const settleMs = pieSettleMs(n) + REVEAL_CLOCK_MARGIN_MS;
    const { resolve } = armManualSettle(settleMs + 3000);
    window.setTimeout(() => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    }, settleMs);
  }, [n]);

  useEffect(() => {
    window.__benchUpdate = () =>
      measureUpdatePaint(() => {
        tickRef.current += 1;
        setData(generatePieUpdate("pie", n, tickRef.current));
      });
    // Pie's `n` is SLICE COUNT, not a time-series window (radar precedent) --
    // there is no "append one live point" concept to port here.
    // `__benchLiveTick` is wired as a documented no-op purely so the global
    // exists for anything that probes for its presence.
    window.__benchLiveTick = () => {};
  }, [n]);

  return (
    <PieChart data={data} size={PIE_SIZE}>
      {data.map((item, i) => (
        <PieSlice index={i} key={item.label} />
      ))}
    </PieChart>
  );
}
