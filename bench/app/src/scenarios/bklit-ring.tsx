// Docs-demo basis (registry omits required maxValue). RingCenter always mounts: rings are always annuli.
import { useEffect, useMemo, useRef, useState } from "react";
import { Ring, RingCenter, RingChart } from "@bklitui/ui/charts";
import {
  generateRing,
  generateRingUpdate,
  type SeededRing,
} from "../../../data";
import { armManualSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";

// Demo's own size={280}; radius scaling absorbs ring-count growth.
const RING_SIZE = 280;

// Phase-less chart (no onPhaseChange): manual settle from source stagger+duration: 600+(n-1)*100+1100ms.
function ringSettleMs(n: number): number {
  const enterStaggerScale = 1;
  const enterDurationMs = 1100; // DEFAULT_CHART_ENTER_TRANSITION (animation.ts)
  const baseDelayMs = 0.6 * enterStaggerScale * 1000;
  const staggerMs = 0.1 * enterStaggerScale * 1000;
  return baseDelayMs + Math.max(0, n - 1) * staggerMs + enterDurationMs;
}

// Covers render-to-animation-start gap; mirrored in migrated pair (M1b absorbs it).
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
    // n = ring count, not a window: no live-append concept.
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
