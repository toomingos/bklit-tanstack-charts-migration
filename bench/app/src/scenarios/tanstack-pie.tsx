// Ceiling reference: docs "Pie and donut" recipe, solid pie (no donut hole, registry-parity scope).
import { useEffect, useMemo, useRef, useState } from "react";
import { pie } from "d3-shape";
import { Chart } from "@tanstack/react-charts";
import { defineChart } from "@tanstack/charts";
import { polar, radialArc } from "@tanstack/charts/polar";
import {
  generatePie,
  generatePieUpdate,
  type SeededPieSlice,
} from "../../../data";
import { armTanstackSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";

const PIE_SIZE = 280;

const PIE_PALETTE = [
  "#7c3aed",
  "#0ea5e9",
  "#f59e0b",
  "#10b981",
  "#ec4899",
  "#64748b",
];

export default function TanstackPie({ n }: { n: number }) {
  const [data, setData] = useState<SeededPieSlice[]>(() =>
    generatePie("pie", n),
  );
  const tickRef = useRef(0);
  const { onRender } = useMemo(() => armTanstackSettle(), []);

  useEffect(() => {
    window.__benchUpdate = () =>
      measureUpdatePaint(() => {
        tickRef.current += 1;
        setData(generatePieUpdate("pie", n, tickRef.current));
      });
    // GUARD: n is slice count; no live-append concept.
    window.__benchLiveTick = () => {};
  }, [n]);

  const definition = useMemo(() => {
    // sort(null) preserves seeded order, like bklit's own d3Pie call.
    const slices = pie<SeededPieSlice>()
      .sort(null)
      .value((d) => d.value)(data);

    return defineChart({
      marks: [
        polar({
          inset: 8,
          radiusRatio: 0.82,
          marks: [
            radialArc(slices, {
              key: (slice) => slice.data.label,
              // Channels omitted: pie() output fields match radialArc defaults.
              innerRadius: 0,
              fill: (slice) => PIE_PALETTE[slice.index % PIE_PALETTE.length] ?? PIE_PALETTE[0],
            }),
          ],
        }),
      ],
      guides: false,
      x: null,
      y: null,
    });
  }, [data]);

  return (
    <Chart
      ariaLabel="Pie chart benchmark scenario"
      width={PIE_SIZE}
      height={PIE_SIZE}
      definition={definition}
      onRender={onRender}
    />
  );
}
