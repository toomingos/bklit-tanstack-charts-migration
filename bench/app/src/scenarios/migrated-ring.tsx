// Migrated RingChart scenario -- IDENTICAL usage/scope to bklit-ring.tsx
// (same docs-demo-derived data/component tree/props -- see that file's own
// header for the full D27 rationale on why the docs demo, not the
// type-broken registry example, is this scenario's basis: `RingChart data
// size={280}` + one `<Ring index />` per datum + an always-mounted
// `<RingCenter />`, uncontrolled hover), only the import source changes.
// Both scenarios use `armManualSettle` (D47) with the identical computed
// formula + REVEAL_CLOCK_MARGIN_MS: bklit-ring.tsx originally used
// `armBklitTimerSettle`, whose shared 2500ms fallback resolved mid-reveal
// at the structural sizes (n=20/50) and asymmetrically vs this file; Fable
// aligned it to the D47/radar/pie pattern (docs/LOG.md D51).
import { useEffect, useMemo, useRef, useState } from "react";
import { Ring, RingCenter, RingChart } from "@migrated/charts";
import {
  generateRing,
  generateRingUpdate,
  type SeededRing,
} from "../../../data";
import { armManualSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";

// --- Size --------------------------------------------------------------
// Mirrors bklit-ring.tsx's own `RING_SIZE` verbatim (docs-demo parity).
const RING_SIZE = 280;

// --- Settle detection (M1b) for this phase-less chart -----------------------
// Identical formula to bklit-ring.tsx's own `ringSettleMs` -- see that
// file's header comment for the full derivation from ring.tsx /
// use-mount-progress.ts / animation.ts (none of RingChart's defaults
// overridden here either: no `enterTransition`/`enterStaggerScale` props
// passed, matching the docs demo).
function ringSettleMs(n: number): number {
  const enterStaggerScale = 1;
  const enterDurationMs = 1100; // DEFAULT_CHART_ENTER_TRANSITION (animation.ts)
  const baseDelayMs = 0.6 * enterStaggerScale * 1000;
  const staggerMs = 0.1 * enterStaggerScale * 1000;
  return baseDelayMs + Math.max(0, n - 1) * staggerMs + enterDurationMs;
}

// Same constant/rationale as migrated-pie.tsx/migrated-radar.tsx's own
// REVEAL_CLOCK_MARGIN_MS (docs/LOG.md D48): covers the component-side gap
// between this scenario arming the settle timer and the chart's own
// per-ring WAAPI reveal animations actually starting.
const REVEAL_CLOCK_MARGIN_MS = 250;

export default function MigratedRing({ n }: { n: number }) {
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
