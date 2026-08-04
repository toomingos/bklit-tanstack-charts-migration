// Migrated Funnel (vertical) scenario -- IDENTICAL usage/scope to
// bklit-funnelvertical.tsx (`orientation="vertical"` is the only prop delta
// vs. the horizontal pair, same D30 grid-landmine fix), only the import
// source changes.
import { useMemo, useEffect, useRef, useState } from "react";
import { FunnelChart } from "@migrated/charts";
import {
  generateFunnel,
  generateFunnelUpdate,
  type SeededFunnelStage,
} from "../../../data";
import { armManualSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";

const STAGGER_DELAY_MS = 120; // FunnelChart's default staggerDelay=0.12s
const ANIMATION_DURATION_MS = 1100; // DEFAULT_ANIMATION_DURATION_MS (animation.ts)

function funnelSettleMs(n: number): number {
  return Math.max(0, n - 1) * STAGGER_DELAY_MS + ANIMATION_DURATION_MS;
}

// Settle arm + margin: identical to migrated-funnel.tsx (docs/LOG.md D48/D51
// settle-arm alignment precedent); see that file's comment for the full
// rationale.
const REVEAL_CLOCK_MARGIN_MS = 250;

export default function MigratedFunnelVertical({ n }: { n: number }) {
  const [data, setData] = useState<SeededFunnelStage[]>(() =>
    generateFunnel("funnelvertical", n),
  );
  const tickRef = useRef(0);

  useMemo(() => {
    const settleMs = funnelSettleMs(n) + REVEAL_CLOCK_MARGIN_MS;
    const { resolve } = armManualSettle(settleMs + 3000);
    window.setTimeout(() => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    }, settleMs);
  }, [n]);

  useEffect(() => {
    window.__benchUpdate = () =>
      measureUpdatePaint(() => {
        tickRef.current += 1;
        setData(generateFunnelUpdate("funnelvertical", n, tickRef.current));
      });
    // See migrated-funnel.tsx: funnel's `n` is stage count, not a
    // time-series window -- no live-append concept applies.
    window.__benchLiveTick = () => {};
  }, [n]);

  return (
    <FunnelChart
      color="var(--chart-1)"
      data={data}
      grid={{ bands: false, lines: false }}
      layers={3}
      orientation="vertical"
    />
  );
}
