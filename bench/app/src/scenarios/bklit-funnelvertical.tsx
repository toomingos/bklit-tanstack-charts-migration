// Funnel (vertical) scenario -- same docs-demo basis as bklit-funnel.tsx
// (repos/bklit-ui/apps/web/content/docs/components/funnel-chart.mdx's
// 5-stage `funnelData`), with `orientation="vertical"` added -- the only
// prop delta between the two orientations, matching `FunnelChartProps`
// directly (`orientation?: "horizontal" | "vertical"`, default
// `"horizontal"`). Per docs/LOG.md D30, horizontal and vertical are
// registered as two disjoint `ChartKind`s (`"funnel"` / `"funnelvertical"`)
// -- exact strings required, matching `TOOLTIPLESS_CHARTS` in
// qa/screenshot.mjs (Fable already added both, verified not touched here) --
// not variants of one scenario, mirroring D28's gauge arc/linear precedent.
//
// Data is independently seeded under the `"funnelvertical"` chart key (see
// bench/data.ts's `generateFunnel` doc: "chart is expected to be `funnel` or
// `funnelvertical`... so the two ChartKinds get independently seeded (but
// structurally identical-shaped) datasets" -- same convention as
// `generateGauge`'s "gauge"/"gaugelinear" key pair).
//
// The D30 grid landmine fix applies identically here (see bklit-funnel.tsx's
// full comment): `VSegment`'s per-segment `<svg>` has the same
// first-in-DOM-order risk as `HSegment`'s when `grid=false`, so
// `grid={{bands:false, lines:false}}` is required on this orientation too.
import { useMemo, useEffect, useRef, useState } from "react";
import { FunnelChart } from "@bklitui/ui/charts";
import {
  generateFunnel,
  generateFunnelUpdate,
  type SeededFunnelStage,
} from "../../../data";
import { armManualSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";

// --- Settle detection (M1b) -------------------------------------------------
// `VSegment` drives its reveal through the exact same `useMountProgress`/
// `useEnterComplete`/`DEFAULT_CHART_ENTER_TRANSITION` path as `HSegment`
// (funnel-chart.tsx) -- orientation only changes the geometry helper
// (`vSegmentPath` vs `hSegmentPath`), not the reveal timing -- so the
// settle formula is identical to bklit-funnel.tsx's (see that file's full
// derivation, not repeated here to avoid drift between two copies of the
// same math): settleMs = (n-1)*120 + 1100.
const STAGGER_DELAY_MS = 120; // FunnelChart's default staggerDelay=0.12s
const ANIMATION_DURATION_MS = 1100; // DEFAULT_ANIMATION_DURATION_MS (animation.ts)

function funnelSettleMs(n: number): number {
  return Math.max(0, n - 1) * STAGGER_DELAY_MS + ANIMATION_DURATION_MS;
}

// Settle arm + margin: identical Fable edit as bklit-funnel.tsx (docs/LOG.md
// D51/D52 settle-arm alignment precedent — the 2500ms fallback resolves
// mid-reveal at n=20/50); see that file's comment for the full rationale.
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
    // See bklit-funnel.tsx: funnel's `n` is stage count, not a time-series
    // window -- no live-append concept applies.
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
