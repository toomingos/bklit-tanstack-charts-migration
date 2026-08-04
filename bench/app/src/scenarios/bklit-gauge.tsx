// Gauge (arc) scenario -- authored VERBATIM against the registry example
// (repos/bklit-ui/packages/ui/registry/examples/gauge-chart.tsx), per
// docs/LOG.md D28's ruling that gauge's registry example is VALID (the
// first clean one since bar, per D17/D18) and is therefore the arc pilot's
// basis -- no docs-demo substitution needed (unlike radar/pie/ring/candle's
// broken-registry precedents):
//
//   <Gauge
//     value={72}
//     centerValue={72}
//     totalNotches={40}
//     defaultLabel="Score"
//     formatOptions={{ style: "percent" }}
//   />
//
// This scenario swaps the registry's literal 72/72/40 for this bench's
// seeded `value`/`centerValue` (bench/data.ts's `generateGauge`) and the
// harness's `n` (D28: "n = totalNotches"), keeping every other default
// untouched -- no `orientation` (defaults "arc"), no `spacing`/
// `uniformWidth`/`notchCornerRadius` overrides, matching the registry demo
// exactly. `formatOptions={{style:"percent"}}` is reproduced as-is even
// though it feeds `centerValue` (a bare 0-100-ish number, not a 0-1
// fraction) into `Intl.NumberFormat`'s percent style -- a registry quirk
// (percent multiplies by 100), ported faithfully rather than "fixed" (D19/
// D20/D24 precedent: preserve bklit's own surface, bugs included, when it's
// the demo/registry basis, not our code).
//
// Per D28, gauge has NO interaction of any kind (no hover/tooltip/dim/focus
// -- the strictest polar case yet) and NO children-as-config surface
// (children are a defs-only collector for gradient/pattern fills, unused
// here) -- there is nothing to wire up beyond `value`/`centerValue`/
// `totalNotches`/`defaultLabel`/`formatOptions`.
import { useMemo, useEffect, useRef, useState } from "react";
import { Gauge } from "@bklitui/ui/charts";
import {
  generateGauge,
  generateGaugeUpdate,
  type SeededGauge,
} from "../../../data";
import { armManualSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";

// --- Size --------------------------------------------------------------
// The registry example passes NO `width`/`height`/`minWidth` -- `Gauge`
// (gauge.tsx) falls back to its fully-responsive `ParentSize` branch: an
// `aspect-[21/16]` box, `max-w-[560px]`, `minWidth` default 300 (arc). Left
// unset here too (matching the registry verbatim); `#chart-root`'s ~1052px
// usable width (see bklit-radar.tsx's identical note) comfortably bounds the
// 560px cap at every gated/structural n -- notch COUNT never forces a
// resize (bklit's own arc geometry scales notch angle/gap from `size`, not
// `n`).

// --- Settle detection (M1b) for this phase-less chart -------------------
// Like RadarChart/PieChart/RingChart, `Gauge` exposes NO `onPhaseChange`/
// `status` prop -- there is no callback to observe when its per-notch
// staggered reveal has actually finished. Computed directly from
// gauge.tsx's `GaugeNotchSvg` (shared by both orientations) with none of
// `Gauge`'s defaults overridden here (matching the registry example: no
// `enterTransition`/`enterStaggerScale` props passed):
//
//   DEFAULT_NOTCH_ENTER_TRANSITION = { type: "spring", stiffness: 300,
//                                       damping: 20 }        (gauge.tsx:31-35)
//   stagger = clamp(enterStaggerScale=1, 0.25, 2.5) = 1      (gauge.tsx:299/485)
//
//   EVERY notch (all `totalNotches`, active AND inactive alike) renders as
//   a background path first (gauge.tsx:149-181):
//     bgDelay(i)     = i * 0.015 * stagger                    (i = 0-based)
//   ...then ONLY the active subset (`i < activeNotches`) gets a second,
//   overlaid "active fill" path (gauge.tsx:183-218) -- note `i` here is
//   still the notch's ORIGINAL index (0..activeNotches-1), not a re-indexed
//   position in the filtered array:
//     activeDelay(i) = (0.3 + i * 0.02) * stagger
//
//   The LAST-finishing element is whichever of these two waves ends latest:
//     bgLastDelay     = (totalNotches - 1) * 0.015 * stagger
//     activeLastDelay = activeNotches > 0
//                         ? (0.3 + (activeNotches - 1) * 0.02) * stagger
//                         : 0
//     lastDelaySec    = max(bgLastDelay, activeLastDelay)
//
//   Each notch's delay gates a SPRING (not a fixed-duration tween), so the
//   true end is delay + spring-settle-tail, not delay alone. For a
//   {stiffness: 300, damping: 20, mass: 1 (framer default)} spring, the
//   damping ratio zeta = damping / (2*sqrt(stiffness*mass)) and natural
//   frequency omega0 = sqrt(stiffness/mass) combine as
//   zeta*omega0 = damping / (2*mass) = 20/2 = 10/s (the stiffness term
//   cancels for mass=1) -- the underdamped envelope decays as exp(-10t), so
//   time-to-~1%-settle = ln(100)/10 = 4.605/10 ~= 0.46s. D28's cited
//   "~450ms spring tail" is this same computation (rounded); this file uses
//   450ms verbatim to match the logged ruling.
//
//   settleMs = lastDelaySec * 1000 + 450
//
// Settle protocol (Fable edit, docs/LOG.md D51's settle-arm alignment
// precedent, applied verbatim from bklit-ring.tsx/bklit-pie.tsx/
// bklit-radar.tsx): originally `armBklitTimerSettle(gaugeSettleMs(...))`,
// whose shared 2500ms `FALLBACK_MS` wedge-guard resolves BELOW the computed
// end at the structural sizes (e.g. n=300 with a typical seeded value:
// activeLastDelay alone exceeds 4s), i.e. mid-reveal -- the exact harness
// artifact D47/D51 root-caused on radar/ring. Switched to `armManualSettle`
// with the same computed formula + the shared REVEAL_CLOCK_MARGIN_MS,
// matching the migrated-* scenario pair exactly so M1b absorbs the
// constant symmetrically.
const SPRING_SETTLE_TAIL_MS = 450;

function gaugeSettleMs(value: number, totalNotches: number): number {
  const stagger = 1; // enterStaggerScale default, already inside [0.25, 2.5]
  const activeNotches = Math.round((value / 100) * totalNotches);
  const bgLastDelayMs = Math.max(0, totalNotches - 1) * 0.015 * stagger * 1000;
  const activeLastDelayMs =
    activeNotches > 0
      ? (0.3 + (activeNotches - 1) * 0.02) * stagger * 1000
      : 0;
  const lastDelayMs = Math.max(bgLastDelayMs, activeLastDelayMs);
  return lastDelayMs + SPRING_SETTLE_TAIL_MS;
}

// Same constant/derivation as the radar/pie/ring scenario pairs'
// REVEAL_CLOCK_MARGIN_MS (bklit-radar.tsx has the full comment; docs/LOG.md
// D48): covers the gap between this scenario arming the settle timer at
// render and the chart's framer animation timeline actually starting at
// effect time. M1b (not gated) absorbs the constant; the migrated gauge
// scenarios apply it identically.
const REVEAL_CLOCK_MARGIN_MS = 250;

export default function BklitGauge({ n }: { n: number }) {
  const [gauge, setGauge] = useState<SeededGauge>(() =>
    generateGauge("gauge", n),
  );
  const tickRef = useRef(0);

  useMemo(() => {
    const initial = generateGauge("gauge", n);
    const settleMs =
      gaugeSettleMs(initial.value, initial.totalNotches) + REVEAL_CLOCK_MARGIN_MS;
    const { resolve } = armManualSettle(settleMs + 3000);
    window.setTimeout(() => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    }, settleMs);
  }, [n]);

  useEffect(() => {
    window.__benchUpdate = () =>
      measureUpdatePaint(() => {
        tickRef.current += 1;
        setGauge(generateGaugeUpdate("gauge", n, tickRef.current));
      });
    // Gauge's `n` is totalNotches (D28), not a time-series window -- there
    // is no "append one live point" concept to port here (radar/pie/ring
    // precedent).
    window.__benchLiveTick = () => {};
  }, [n]);

  return (
    <Gauge
      value={gauge.value}
      centerValue={gauge.centerValue}
      totalNotches={gauge.totalNotches}
      defaultLabel="Score"
      formatOptions={{ style: "percent" }}
    />
  );
}
