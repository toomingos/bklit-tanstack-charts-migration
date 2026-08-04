// Migrated Funnel (horizontal) scenario -- IDENTICAL usage/scope to
// bklit-funnel.tsx (same docs-demo-derived data/props: `color`, `layers`,
// the `grid={{bands:false, lines:false}}` D30 grid-landmine fix -- see that
// file's own header for the full rationale), only the import source changes.
//
// Both scenarios use `armManualSettle` with the IDENTICAL computed
// `funnelSettleMs` formula + `REVEAL_CLOCK_MARGIN_MS` (docs/LOG.md D48/D51's
// settle-arm alignment precedent) -- see bklit-funnel.tsx's own header for
// the full derivation (not repeated here to avoid drift between two copies
// of the same math).
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

// Same constant/derivation as bklit-funnel.tsx's REVEAL_CLOCK_MARGIN_MS
// (docs/LOG.md D48): covers the gap between this scenario arming the settle
// timer at render and the chart's WAAPI reveal timeline actually starting at
// effect time.
const REVEAL_CLOCK_MARGIN_MS = 250;

export default function MigratedFunnel({ n }: { n: number }) {
  const [data, setData] = useState<SeededFunnelStage[]>(() =>
    generateFunnel("funnel", n),
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
        setData(generateFunnelUpdate("funnel", n, tickRef.current));
      });
    // Funnel's `n` is stage count, not a time-series window -- no
    // live-append concept applies (see bklit-funnel.tsx).
    window.__benchLiveTick = () => {};
  }, [n]);

  return (
    <FunnelChart
      color="var(--chart-1)"
      data={data}
      grid={{ bands: false, lines: false }}
      layers={3}
    />
  );
}
