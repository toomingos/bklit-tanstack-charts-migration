// Ceiling: n stages as barY bars; 3 layers reproduce bklit's 3-rings-per-segment DOM.
// GUARD: ring scale/opacity formulas are verbatim from bklit's HSegment; keep them in sync.
import { useEffect, useMemo, useRef, useState } from "react";
import { scaleBand, scaleLinear } from "d3-scale";
import { Chart } from "@tanstack/react-charts";
import { barY, defineChart } from "@tanstack/charts";
import { tooltip } from "@tanstack/charts/tooltip";
import {
  generateFunnel,
  generateFunnelUpdate,
  type SeededFunnelStage,
} from "../../../data";
import { armTanstackSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";

const FUNNEL_COLOR = "#7c3aed";

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
    // GUARD: n is stage count; no live-append concept.
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
      scales: {
        x: { scale: () => scaleBand<string>().paddingInner(0.15), grid: false },
        y: { scale: scaleLinear, nice: true, grid: true },
      },
      tooltip,
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
