// Same tree/props as bklit-pie.tsx; only the import source changes (manual settle, see below).
import { useEffect, useMemo, useRef, useState } from "react";
import { PieChart, PieSlice } from "@migrated/charts";
import {
  generatePie,
  generatePieUpdate,
  type SeededPieSlice,
} from "../../../data";
import { armManualSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";

const PIE_SIZE = 280;

// GUARD: identical formula to bklit's pieSettleMs; no enterTransition/stagger overrides here either.
function pieSettleMs(n: number): number {
  const enterStaggerScale = 1;
  const enterDurationMs = 1100;
  const baseDelayMs = 0.1 * enterStaggerScale * 1000;
  const staggerMs = 0.08 * enterStaggerScale * 1000;
  return baseDelayMs + Math.max(0, n - 1) * staggerMs + enterDurationMs;
}

// Covers the arming-to-effect gap before per-slice WAAPI reveals start.
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
    // GUARD: n is slice count; no live-append concept.
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
