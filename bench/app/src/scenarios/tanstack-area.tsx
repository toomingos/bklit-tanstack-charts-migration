// Native TanStack Charts equivalent of bklit's area-chart.tsx demo.
import { useEffect, useMemo, useRef, useState } from "react";
import { scaleLinear, scaleUtc } from "d3-scale";
import { curveNatural } from "d3-shape";
import { Chart } from "@tanstack/react-charts";
import { areaY, d3Curve, defineChart } from "@tanstack/charts";
import {
  generateTimeSeries,
  generateTimeSeriesUpdate,
  type SeededRow,
} from "../../../data";
import { armTanstackSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";
import { appendLiveRow } from "../bench/live";

export default function TanstackArea({ n }: { n: number }) {
  const [data, setData] = useState<SeededRow[]>(() =>
    generateTimeSeries("area", n),
  );
  const tickRef = useRef(0);
  const liveTickRef = useRef(0);
  const { onRender } = useMemo(() => armTanstackSettle(), []);

  useEffect(() => {
    window.__benchUpdate = () =>
      measureUpdatePaint(() => {
        tickRef.current += 1;
        setData(generateTimeSeriesUpdate("area", n, tickRef.current));
      });
    window.__benchLiveTick = () => {
      liveTickRef.current += 1;
      setData((prev) => appendLiveRow("area", n, prev, liveTickRef.current));
    };
  }, [n]);

  const definition = useMemo(
    () =>
      defineChart({
        marks: [
          areaY(data, {
            id: "seriesA",
            x: "date",
            y: "seriesA",
            curve: d3Curve(curveNatural),
            fillOpacity: 0.4,
            strokeWidth: 2.5,
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
      ariaLabel="Area chart benchmark scenario"
      aspectRatio={2}
      definition={definition}
      onRender={onRender}
    />
  );
}
