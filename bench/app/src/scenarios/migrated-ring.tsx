// Same tree/props as bklit-ring.tsx; only the import source changes (manual settle, see below).
import { useEffect, useMemo, useRef, useState } from "react";
import { Ring, RingCenter, RingChart } from "@migrated/charts";
import {
  generateRing,
  generateRingUpdate,
  type SeededRing,
} from "../../../data";
import { armManualSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";

const RING_SIZE = 280;

// GUARD: identical formula to bklit's ringSettleMs; no enterTransition/stagger overrides here either.
function ringSettleMs(n: number): number {
  const enterStaggerScale = 1;
  const enterDurationMs = 1100;
  const baseDelayMs = 0.6 * enterStaggerScale * 1000;
  const staggerMs = 0.1 * enterStaggerScale * 1000;
  return baseDelayMs + Math.max(0, n - 1) * staggerMs + enterDurationMs;
}

// Covers the arming-to-start gap of the chart's per-ring WAAPI reveals.
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
    // GUARD: n is ring count; no live-append concept.
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
