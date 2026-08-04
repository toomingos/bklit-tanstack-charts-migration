// Native TanStack Charts PERFORMANCE-CEILING approximation of bklit's
// horizontal FunnelChart -- NOT a pixel clone (same philosophy as every
// other `tanstack-*.tsx` ceiling scenario's header comment: tanstack-gauge/
// tanstack-radar/tanstack-pie/tanstack-line). Per the task's own ceiling
// instruction ("the SIMPLEST native expression rendering n comparable
// nodes... performance ceiling, not a clone"), this renders bklit's n
// tapering funnel stages as n ordinary `barY` bars over a categorical stage
// axis -- a standard, idiomatic TanStack bar chart is the simplest native
// primitive that reproduces "n decreasing-value nodes side by side", with
// zero bespoke geometry (no custom `createMark`, no cubic-Bezier `path`
// strings -- that bespoke-geometry work is the ACTUAL migrated port's job,
// per docs/LOG.md D30's ruling that the real migration uses a custom
// `createMark` emitting `kind:'area'` trapezoid nodes; this file is
// explicitly the cheaper ceiling reference, not that).
//
// "(x3 rings if cheap)" (task wording) -- reproduced here because it IS
// cheap: bklit renders `layers` (default 3) concentric halo rings PER
// SEGMENT (funnel-chart.tsx's `HRing`/`VRing`, one path per ring), so a
// single flat bar per stage would under-count the real DOM/paint cost by
// 3x. Three separate `barY` calls over the SAME n stages -- each shrinking
// the bar's value by bklit's own per-ring scale factor and fading its
// opacity by bklit's own per-ring opacity formula (both formulas copied
// verbatim from `HSegment`'s `rings` computation, funnel-chart.tsx: `scale
// = 1 - (l/layers)*0.35`, `opacity = 0.18 + (l/(layers-1||1))*0.65`) --
// reproduces the same 3n-rect DOM/paint shape as bklit's real per-segment
// ring stack, still with zero bespoke geometry (plain `barY`, no custom
// mark), i.e. still the simplest native expression that stresses a
// comparable node count.
import { useEffect, useMemo, useRef, useState } from "react";
import { scaleBand, scaleLinear } from "d3-scale";
import { Chart } from "@tanstack/react-charts";
import { barY, defineChart } from "@tanstack/charts";
import {
  generateFunnel,
  generateFunnelUpdate,
  type SeededFunnelStage,
} from "../../../data";
import { armTanstackSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";

// Single fixed color, matching the docs demo's single `color="var(--chart-1)"`
// prop (bklit-funnel.tsx) -- ceiling scenario styling (native/idiomatic
// TanStack hex), not a CSS-variable pixel clone (radar/pie precedent).
const FUNNEL_COLOR = "#7c3aed";

// bklit's own per-ring scale/opacity formulas (funnel-chart.tsx's `HSegment`
// `rings` array), copied verbatim so the 3-ring DOM/paint shape this file
// approximates is derived from the real source, not guessed.
const LAYERS = 3;
function ringScale(l: number): number {
  return 1 - (l / LAYERS) * 0.35;
}
function ringOpacity(l: number): number {
  return 0.18 + (l / (LAYERS - 1 || 1)) * 0.65;
}

interface FunnelRingRow {
  label: string;
  value: number;
}

export default function TanstackFunnel({ n }: { n: number }) {
  const [data, setData] = useState<SeededFunnelStage[]>(() =>
    generateFunnel("funnel", n),
  );
  const tickRef = useRef(0);
  const { onRender } = useMemo(() => armTanstackSettle(), []);

  useEffect(() => {
    window.__benchUpdate = () =>
      measureUpdatePaint(() => {
        tickRef.current += 1;
        setData(generateFunnelUpdate("funnel", n, tickRef.current));
      });
    // See bklit-funnel.tsx: funnel's `n` is stage count, not a time-series
    // window -- no live-append concept applies.
    window.__benchLiveTick = () => {};
  }, [n]);

  const definition = useMemo(() => {
    const ringRows: FunnelRingRow[][] = Array.from({ length: LAYERS }, (_, l) =>
      data.map((stage) => ({ label: stage.label, value: stage.value * ringScale(l) })),
    );

    return defineChart({
      marks: ringRows.map((rows, l) =>
        barY(rows, {
          id: `ring-${l}`,
          x: "label",
          y: "value",
          key: "label",
          fill: FUNNEL_COLOR,
          fillOpacity: ringOpacity(l),
          inset: 2,
        }),
      ),
      x: { scale: () => scaleBand<string>().paddingInner(0.15), grid: false },
      y: { scale: scaleLinear, nice: true, grid: true },
      tooltip: true,
    });
  }, [data]);

  return (
    <Chart
      ariaLabel="Funnel (horizontal) chart benchmark scenario"
      aspectRatio={2.2}
      definition={definition}
      onRender={onRender}
    />
  );
}
