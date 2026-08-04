// Migrated Gauge (arc) scenario -- IDENTICAL usage/scope to bklit-gauge.tsx
// (same registry-example-derived data/component tree/props -- see that
// file's own header for the full D28 rationale on why the registry example,
// not a docs-demo substitute, is this scenario's basis: `Gauge value
// centerValue totalNotches defaultLabel formatOptions`, no orientation/
// spacing/uniformWidth/notchCornerRadius overrides), only the import source
// changes.
//
// Both scenarios use `armManualSettle` with the same `gaugeSettleMs` STAGGER
// math + `REVEAL_CLOCK_MARGIN_MS` (docs/LOG.md D48/D51's settle-arm alignment
// precedent, same as the migrated-ring.tsx/migrated-pie.tsx/migrated-radar.tsx
// pairs), but the per-notch reveal TAIL deliberately differs -- see
// SPRING_SETTLE_TAIL_MS below. Gauge is the only family whose default enter
// transition is a spring rather than a tween, so it is the only pair where
// copying bklit's tail constant is wrong (docs/LOG.md D56); the ring/pie/
// radar/funnel pairs all resolve to a fixed 1100ms tween on BOTH sides and
// their shared constants remain correct.
import { useMemo, useEffect, useRef, useState } from "react";
import { Gauge } from "@migrated/charts";
import {
  generateGauge,
  generateGaugeUpdate,
  type SeededGauge,
} from "../../../data";
import { armManualSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";

// DELIBERATELY DIFFERENT from bklit-gauge.tsx's 450 (Fable, docs/LOG.md D56).
// The two impls have genuinely different reveal END CONDITIONS, so an
// identical constant here is a bug, not fidelity:
//   * bklit animates the notch spring live via framer-motion. It has no hard
//     end; bklit-gauge.tsx's 450 is the analytic time-to-1%-settle
//     (ln(100)/10 = 0.46s) — correct for bklit, and a `getAnimations()` probe
//     reads literally 0 animations at settle for bklit, 9/9 checks.
//   * migrated BAKES that spring into a single WAAPI tween whose duration is
//     `estimateSpringSettleMs()` (internal/radar-spring.ts), which uses
//     SETTLE_EPSILON = 0.001 — a 10x TIGHTER epsilon. For Gauge's default
//     enter spring {stiffness:300, damping:20, mass:1} (the only migrated
//     family whose default is a spring rather than a tween) that resolves to
//     712ms: zeta = 0.577, envelope 1.2247*exp(-10t), 0.1% crossing at 711ms,
//     rounded up by the 16ms probe grid. Confirmed empirically — the live
//     WAAPI `getComputedTiming()` reports `duration: 712`.
// Using bklit's 450 here left the real tween 262ms longer than the armed
// settle. REVEAL_CLOCK_MARGIN_MS (250) absorbed all but ~12ms of that, so it
// surfaced as a 15-47ms animation tail still `running` at the instant
// `__benchSettled` resolved, spilling into M2a's idle window and
// UNDER-reporting M1b. Both directions are now corrected by telling the truth
// about migrated's own tween length.
const SPRING_SETTLE_TAIL_MS = 712;

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

// Same constant/derivation as bklit-gauge.tsx's REVEAL_CLOCK_MARGIN_MS
// (docs/LOG.md D48): covers the gap between this scenario arming the
// settle timer at render and the chart's WAAPI reveal timeline actually
// starting at effect time.
const REVEAL_CLOCK_MARGIN_MS = 250;

export default function MigratedGauge({ n }: { n: number }) {
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
    // is no "append one live point" concept to port here.
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
