// Native TanStack Charts equivalent of bklit's line-chart.tsx demo, expressed
// via `defineChart` + `lineY` per research/02-tanstack-charts-inventory.md.
// Default/unstyled TanStack theming only (see docs/LOG.md) -- this is the
// performance-ceiling reference, not a bklit-styled clone.
import { useEffect, useMemo, useRef, useState } from "react";
import { scaleLinear, scaleUtc } from "d3-scale";
import { curveNatural } from "d3-shape";
import { Chart } from "@tanstack/react-charts";
import { d3Curve, defineChart, lineY } from "@tanstack/charts";
import {
  generateTimeSeries,
  generateTimeSeriesUpdate,
  type SeededRow,
} from "../../../data";
import { armTanstackSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";
import { appendLiveRow } from "../bench/live";

export default function TanstackLine({ n }: { n: number }) {
  const [data, setData] = useState<SeededRow[]>(() =>
    generateTimeSeries("line", n),
  );
  const tickRef = useRef(0);
  const liveTickRef = useRef(0);
  const { onRender } = useMemo(() => armTanstackSettle(), []);

  useEffect(() => {
    window.__benchUpdate = () =>
      measureUpdatePaint(() => {
        tickRef.current += 1;
        setData(generateTimeSeriesUpdate("line", n, tickRef.current));
      });
    window.__benchLiveTick = () => {
      liveTickRef.current += 1;
      setData((prev) => appendLiveRow("line", n, prev, liveTickRef.current));
    };
  }, [n]);

  const definition = useMemo(
    () =>
      defineChart({
        marks: [
          lineY(data, {
            id: "seriesA",
            x: "date",
            y: "seriesA",
            curve: d3Curve(curveNatural),
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
      ariaLabel="Line chart benchmark scenario"
      aspectRatio={2}
      definition={definition}
      onRender={onRender}
    />
  );
}
