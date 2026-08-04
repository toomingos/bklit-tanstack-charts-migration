// Native TanStack Charts equivalent of bklit's scatter-chart.tsx demo (two
// point-cloud series, `sessions` and `conversions`, both against the same
// date x-axis -- matches the canonical bklit demo's two `<Scatter>` dataKeys).
import { useEffect, useMemo, useRef, useState } from "react";
import { scaleLinear, scaleUtc } from "d3-scale";
import { Chart } from "@tanstack/react-charts";
import { defineChart, dot } from "@tanstack/charts";
import {
  generateScatter,
  generateScatterUpdate,
  type SeededScatterRow,
} from "../../../data";
import { armTanstackSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";
import { appendLiveScatterRow } from "../bench/live";

export default function TanstackScatter({ n }: { n: number }) {
  const [data, setData] = useState<SeededScatterRow[]>(() =>
    generateScatter("scatter", n),
  );
  const tickRef = useRef(0);
  const liveTickRef = useRef(0);
  const { onRender } = useMemo(() => armTanstackSettle(), []);

  useEffect(() => {
    window.__benchUpdate = () =>
      measureUpdatePaint(() => {
        tickRef.current += 1;
        setData(generateScatterUpdate("scatter", n, tickRef.current));
      });
    window.__benchLiveTick = () => {
      liveTickRef.current += 1;
      setData((prev) =>
        appendLiveScatterRow("scatter", n, prev, liveTickRef.current),
      );
    };
  }, [n]);

  const definition = useMemo(
    () =>
      defineChart({
        marks: [
          dot(data, {
            id: "sessions",
            x: "date",
            y: "sessions",
            fill: "var(--ts-chart-1, #2563eb)",
          }),
          dot(data, {
            id: "conversions",
            x: "date",
            y: "conversions",
            fill: "var(--ts-chart-2, #f97316)",
          }),
        ],
        x: { scale: scaleUtc, nice: true },
        y: { scale: scaleLinear, nice: true, grid: true },
        tooltip: true,
      }),
    [data],
  );

  return (
    <Chart
      ariaLabel="Scatter chart benchmark scenario"
      aspectRatio={2}
      definition={definition}
      onRender={onRender}
    />
  );
}
