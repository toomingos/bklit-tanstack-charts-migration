// Vertical funnel: same docs-demo basis plus orientation="vertical"; separately seeded dataset.
// Keep grid object (not false): mounts the full-size first-svg landmark the harness hover math needs.
import { useMemo, useEffect, useRef, useState } from "react";
import { FunnelChart } from "@bklitui/ui/charts";
import {
  generateFunnel,
  generateFunnelUpdate,
  type SeededFunnelStage,
} from "../../../data";
import { armManualSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";

// Same reveal timing as horizontal (orientation only changes geometry): settle = (n-1)*120+1100ms.
const STAGGER_DELAY_MS = 120; // FunnelChart's default staggerDelay=0.12s
const ANIMATION_DURATION_MS = 1100; // DEFAULT_ANIMATION_DURATION_MS (animation.ts)

function funnelSettleMs(n: number): number {
  return Math.max(0, n - 1) * STAGGER_DELAY_MS + ANIMATION_DURATION_MS;
}

// Covers render-to-animation-start gap; mirrored in migrated pair (M1b absorbs it).
const REVEAL_CLOCK_MARGIN_MS = 250;

export default function BklitFunnelVertical({ n }: { n: number }) {
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
    // n = stage count, not a window: no live-append concept.
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
