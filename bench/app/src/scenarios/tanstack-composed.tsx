// Ceiling reference: mixed barY/areaY/lineY marks; continuous scaleUtc x, inferBandwidth bars.
import { useEffect, useMemo, useRef, useState } from "react";
import { scaleLinear, scaleUtc } from "d3-scale";
import { curveNatural } from "d3-shape";
import { Chart } from "@tanstack/react-charts";
import { areaY, barY, d3Curve, defineChart, lineY } from "@tanstack/charts";
import { tooltip } from "@tanstack/charts/tooltip";
import {
  generateComposed,
  generateComposedUpdate,
  type SeededComposedRow,
} from "../../../data";
import { armTanstackSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";
import { appendLiveComposed } from "../bench/live";

const monotone = d3Curve(curveNatural);

export default function TanstackComposed({ n }: { n: number }) {
  const [data, setData] = useState<SeededComposedRow[]>(() =>
    generateComposed("composed", n),
  );
  const tickRef = useRef(0);
  const liveTickRef = useRef(0);
  const { onRender } = useMemo(() => armTanstackSettle(), []);

  useEffect(() => {
    window.__benchUpdate = () =>
      measureUpdatePaint(() => {
        tickRef.current += 1;
        setData(generateComposedUpdate("composed", n, tickRef.current));
      });
    window.__benchLiveTick = () => {
      liveTickRef.current += 1;
      setData((prev) =>
        appendLiveComposed("composed", n, prev, liveTickRef.current),
      );
    };
  }, [n]);

  const definition = useMemo(
    () =>
      defineChart({
        marks: [
          // Accessors (not string keys): the row index signature widens keyof to string.
          barY(data, {
            id: "bars",
            x: (d) => d.date,
            y: (d) => d.bars,
            fill: "#94a3b8",
          }),
          areaY(data, {
            id: "area",
            x: (d) => d.date,
            y: (d) => d.line,
            curve: monotone,
            fillOpacity: 0.3,
            fill: "#6366f1",
            stroke: "#6366f1",
          }),
          lineY(data, {
            id: "line",
            x: (d) => d.date,
            y: (d) => d.line,
            curve: monotone,
            stroke: "#22c55e",
            strokeWidth: 2,
          }),
        ],
        scales: {
          x: { scale: scaleUtc, nice: true },
          y: { scale: scaleLinear, nice: true, grid: true },
        },
        tooltip,
      }),
    [data],
  );

  return (
    <Chart
      ariaLabel="Composed chart benchmark scenario"
      aspectRatio={2}
      definition={definition}
      onRender={onRender}
    />
  );
}
