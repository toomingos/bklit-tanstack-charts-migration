// Registry basis; PieCenter dropped: inert at default innerRadius=0 (solid pie, zero-area center).
import { useEffect, useMemo, useRef, useState } from "react";
import { PieChart, PieSlice } from "@bklitui/ui/charts";
import {
  generatePie,
  generatePieUpdate,
  type SeededPieSlice,
} from "../../../data";
import { armManualSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";

// Registry's own size={280}; slice count never forces a resize.
const PIE_SIZE = 280;

// Phase-less chart (no onPhaseChange): manual settle from source stagger+duration: 100+(n-1)*80+1100ms.
function pieSettleMs(n: number): number {
  const enterStaggerScale = 1;
  const enterDurationMs = 1100; // DEFAULT_CHART_ENTER_TRANSITION (animation.ts)
  const baseDelayMs = 0.1 * enterStaggerScale * 1000;
  const staggerMs = 0.08 * enterStaggerScale * 1000;
  return baseDelayMs + Math.max(0, n - 1) * staggerMs + enterDurationMs;
}

// Covers render-to-animation-start gap; mirrored in migrated pair (M1b absorbs it).
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
    // n = slice count, not a window: no live-append; no-op keeps the global present.
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
