// Migrated PieChart scenario -- IDENTICAL usage/scope to bklit-pie.tsx
// (same registry-example-derived data/component tree/props: solid pie,
// `PieCenter` dropped per D27's ruling since `innerRadius` defaults to 0
// here too -- see bklit-pie.tsx's own comment for the full rationale),
// only the import source changes and the settle mechanism is
// `armManualSettle` (D47) rather than `armBklitTimerSettle`.
//
// --- Deviation from bklit-pie.tsx's settle call, disclosed -----------------
// bklit-pie.tsx uses the shared `armBklitTimerSettle(pieSettleMs(n))`, which
// races the computed reveal-end time against a shared, protected 2500ms
// `FALLBACK_MS` safety net -- fine for bklit-pie.tsx itself since it's a
// frozen, already-approved scenario file this agent may not edit. This
// migrated scenario instead follows the explicit D47/migrated-radar.tsx
// precedent (`armManualSettle(settleMs + buffer)` then a `setTimeout` ->
// double-rAF `resolve()` at the actual computed settle time) so QA's
// hover probes never land mid-reveal at the larger structural n (20/50),
// where `100 + (n-1)*80 + 1100`ms exceeds the shared 2500ms fallback --
// same reasoning as migrated-radar.tsx's header comment.
import { useEffect, useMemo, useRef, useState } from "react";
import { PieChart, PieSlice } from "@migrated/charts";
import {
  generatePie,
  generatePieUpdate,
  type SeededPieSlice,
} from "../../../data";
import { armManualSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";

// --- Size --------------------------------------------------------------
// Mirrors bklit-pie.tsx's own `PIE_SIZE` verbatim (registry demo parity).
const PIE_SIZE = 280;

// --- Settle detection (M1b) for this phase-less chart -----------------------
// Identical formula to bklit-pie.tsx's own `pieSettleMs` -- see that file's
// header comment for the full derivation from pie-slice.tsx /
// use-mount-progress.ts / animation.ts (none of PieChart's defaults
// overridden here either: no `enterTransition`/`enterStaggerScale` props
// passed, matching the registry example).
function pieSettleMs(n: number): number {
  const enterStaggerScale = 1;
  const enterDurationMs = 1100; // DEFAULT_CHART_ENTER_TRANSITION (animation.ts)
  const baseDelayMs = 0.1 * enterStaggerScale * 1000;
  const staggerMs = 0.08 * enterStaggerScale * 1000;
  return baseDelayMs + Math.max(0, n - 1) * staggerMs + enterDurationMs;
}

// Same constant/rationale as migrated-radar.tsx's own
// REVEAL_CLOCK_MARGIN_MS (docs/LOG.md D48): covers the component-side gap
// between this scenario arming the settle timer and the chart's own
// per-slice WAAPI reveal animations actually starting.
const REVEAL_CLOCK_MARGIN_MS = 250;

export default function MigratedPie({ n }: { n: number }) {
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
    // Pie's `n` is slice count, not a time-series window -- matches
    // bklit-pie.tsx's own no-op `__benchLiveTick` note.
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
