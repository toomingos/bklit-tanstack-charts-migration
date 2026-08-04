// Gauge (linear) scenario -- authored against the docs mdx's "with label
// below center" linear pattern (repos/bklit-ui/apps/web/content/docs/
// components/gauge-chart.mdx, "Linear gauge" section, second snippet):
//
//   <Gauge
//     orientation="linear"
//     value={72}
//     centerValue={428_000}
//     defaultLabel="ARR run rate"
//     labelPlacement="bottom"
//     labelAlign="center"
//     totalNotches={72}
//     spacing={0}
//     notchCornerRadius={3}
//     inactiveFillOpacity={0.4}
//     useGradient
//   />
//
// Per docs/LOG.md D28, this is a SEPARATE `ChartKind` ("gaugelinear") from
// the arc pilot (bklit-gauge.tsx), not a variant of the same scenario: the
// harness's `?chart=` param selects one component per render, and arc vs.
// linear are two structurally disjoint `Gauge` code paths (`GaugeArcInner`
// vs `GaugeLinearInner` in gauge.tsx) that D28 requires covering
// independently, each at its own gated `n` (arc: n=40 registry-parity;
// linear: n=72, this docs-mdx pattern -- the mdx snippet's own literal
// `totalNotches={72}`).
//
// `formatOptions` is intentionally OMITTED here, matching the mdx snippet
// verbatim (it never sets one) -- `centerValue` therefore renders through
// `defaultChartStatFlowFormat` (chart-stat-flow.tsx: `{ notation:
// "standard", maximumFractionDigits: 0 }`, plain decimal), unlike the arc
// scenario's percent style.
import { useMemo, useEffect, useRef, useState } from "react";
import { Gauge } from "@bklitui/ui/charts";
import {
  generateGauge,
  generateGaugeUpdate,
  type SeededGauge,
} from "../../../data";
import { armManualSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";

// --- Settle detection (M1b) -----------------------------------------------
// `GaugeLinearInner` renders its notch track through the SAME shared
// `GaugeNotchSvg` component as the arc orientation (gauge.tsx:453-643 calls
// the identical `GaugeNotchSvg` with the identical `notchTransition`/
// `stagger`/per-notch `delay` formulas at gauge.tsx:149-218) -- geometry
// differs (horizontal slots vs. polar trig) but the REVEAL TIMING is
// orientation-agnostic: same `DEFAULT_NOTCH_ENTER_TRANSITION` spring
// ({stiffness:300, damping:20}), same bg-wave delay `i*0.015*stagger` over
// ALL `totalNotches`, same active-overlay delay `(0.3+i*0.02)*stagger` over
// the active subset, same ~450ms spring settle tail (see bklit-gauge.tsx's
// full derivation -- not repeated here to avoid drift between two copies of
// the same math; reuse the identical formula).
const SPRING_SETTLE_TAIL_MS = 450;

function gaugeSettleMs(value: number, totalNotches: number): number {
  const stagger = 1; // enterStaggerScale default
  const activeNotches = Math.round((value / 100) * totalNotches);
  const bgLastDelayMs = Math.max(0, totalNotches - 1) * 0.015 * stagger * 1000;
  const activeLastDelayMs =
    activeNotches > 0
      ? (0.3 + (activeNotches - 1) * 0.02) * stagger * 1000
      : 0;
  const lastDelayMs = Math.max(bgLastDelayMs, activeLastDelayMs);
  return lastDelayMs + SPRING_SETTLE_TAIL_MS;
}

// Settle arm + margin: identical Fable edit as bklit-gauge.tsx (docs/LOG.md
// D51's settle-arm alignment precedent — `armBklitTimerSettle`'s 2500ms
// fallback resolves mid-reveal at structural sizes); see that file's
// comment for the full rationale. The migrated pair applies it identically.
const REVEAL_CLOCK_MARGIN_MS = 250;

export default function BklitGaugeLinear({ n }: { n: number }) {
  const [gauge, setGauge] = useState<SeededGauge>(() =>
    generateGauge("gaugelinear", n),
  );
  const tickRef = useRef(0);

  useMemo(() => {
    const initial = generateGauge("gaugelinear", n);
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
        setGauge(generateGaugeUpdate("gaugelinear", n, tickRef.current));
      });
    // Same as bklit-gauge.tsx: `n` is totalNotches, no live-append concept.
    window.__benchLiveTick = () => {};
  }, [n]);

  return (
    <Gauge
      orientation="linear"
      value={gauge.value}
      centerValue={gauge.centerValue}
      defaultLabel="ARR run rate"
      labelPlacement="bottom"
      labelAlign="center"
      totalNotches={gauge.totalNotches}
      spacing={0}
      notchCornerRadius={3}
      inactiveFillOpacity={0.4}
      useGradient
    />
  );
}
