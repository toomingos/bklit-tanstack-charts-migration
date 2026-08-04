// Native TanStack Charts PERFORMANCE-CEILING approximation of bklit's
// VERTICAL FunnelChart -- same philosophy/ring-approximation as
// tanstack-funnel.tsx (see that file's full header comment for the design
// rationale; not repeated here to avoid drift between two copies of the
// same reasoning). The only structural difference from the horizontal
// ceiling: bars run horizontally from a shared left edge, stacked down a
// categorical stage axis -- `barX` (the horizontal-bar dual of `barY`) over
// the SAME n stages, still the simplest native primitive for "n
// decreasing-length nodes stacked vertically", still x3-ringed the same
// cheap way.
import { useEffect, useMemo, useRef, useState } from "react";
import { scaleBand, scaleLinear } from "d3-scale";
import { Chart } from "@tanstack/react-charts";
import { barX, defineChart } from "@tanstack/charts";
import {
  generateFunnel,
  generateFunnelUpdate,
  type SeededFunnelStage,
} from "../../../data";
import { armTanstackSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";

// Matches tanstack-funnel.tsx's color choice (ceiling scenario styling, not
// a CSS-variable pixel clone).
const FUNNEL_COLOR = "#7c3aed";

// bklit's own per-ring scale/opacity formulas, copied verbatim -- see
// tanstack-funnel.tsx's header comment for the full derivation/citation.
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

export default function TanstackFunnelVertical({ n }: { n: number }) {
  const [data, setData] = useState<SeededFunnelStage[]>(() =>
    generateFunnel("funnelvertical", n),
  );
  const tickRef = useRef(0);
  const { onRender } = useMemo(() => armTanstackSettle(), []);

  useEffect(() => {
    window.__benchUpdate = () =>
      measureUpdatePaint(() => {
        tickRef.current += 1;
        setData(generateFunnelUpdate("funnelvertical", n, tickRef.current));
      });
    // See bklit-funnelvertical.tsx: funnel's `n` is stage count, not a
    // time-series window -- no live-append concept applies.
    window.__benchLiveTick = () => {};
  }, [n]);

  const definition = useMemo(() => {
    const ringRows: FunnelRingRow[][] = Array.from({ length: LAYERS }, (_, l) =>
      data.map((stage) => ({ label: stage.label, value: stage.value * ringScale(l) })),
    );

    return defineChart({
      marks: ringRows.map((rows, l) =>
        barX(rows, {
          id: `ring-${l}`,
          x: "value",
          y: "label",
          key: "label",
          fill: FUNNEL_COLOR,
          fillOpacity: ringOpacity(l),
          inset: 2,
        }),
      ),
      x: { scale: scaleLinear, nice: true, grid: true },
      y: { scale: () => scaleBand<string>().paddingInner(0.15), grid: false },
      tooltip: true,
    });
  }, [data]);

  return (
    <Chart
      ariaLabel="Funnel (vertical) chart benchmark scenario"
      aspectRatio={0.7}
      definition={definition}
      onRender={onRender}
    />
  );
}
