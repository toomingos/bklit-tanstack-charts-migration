// Native TanStack Charts equivalent of bklit's bar-chart.tsx demo (two
// grouped series per category). TanStack's grammar-of-graphics model wants
// tidy/long rows, so the shared wide-format seeded rows (`{date, seriesA,
// seriesB}`) are reshaped into long rows here -- same underlying seeded
// values as the bklit scenario, just a different row shape (required by the
// mark API, not a data change).
import { useEffect, useMemo, useRef, useState } from "react";
import { scaleBand, scaleLinear } from "d3-scale";
import { Chart } from "@tanstack/react-charts";
import { barY, defineChart } from "@tanstack/charts";
import {
  generateTimeSeries,
  generateTimeSeriesUpdate,
  type SeededRow,
} from "../../../data";
import { armTanstackSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";
import { appendLiveRow } from "../bench/live";

interface LongBarRow {
  key: string;
  category: string;
  series: "seriesA" | "seriesB";
  value: number;
}

function toLongRows(rows: SeededRow[]): LongBarRow[] {
  const long: LongBarRow[] = [];
  for (const row of rows) {
    const category = row.date.toISOString().slice(0, 10);
    long.push({ key: `${category}:seriesA`, category, series: "seriesA", value: row.seriesA });
    long.push({ key: `${category}:seriesB`, category, series: "seriesB", value: row.seriesB });
  }
  return long;
}

export default function TanstackBar({ n }: { n: number }) {
  const [data, setData] = useState<SeededRow[]>(() =>
    generateTimeSeries("bar", n),
  );
  const tickRef = useRef(0);
  const liveTickRef = useRef(0);
  const { onRender } = useMemo(() => armTanstackSettle(), []);

  useEffect(() => {
    window.__benchUpdate = () =>
      measureUpdatePaint(() => {
        tickRef.current += 1;
        setData(generateTimeSeriesUpdate("bar", n, tickRef.current));
      });
    window.__benchLiveTick = () => {
      liveTickRef.current += 1;
      setData((prev) => appendLiveRow("bar", n, prev, liveTickRef.current));
    };
  }, [n]);

  const definition = useMemo(() => {
    const longRows = toLongRows(data);
    return defineChart({
      marks: [
        barY(longRows, {
          id: "bars",
          x: "category",
          y: "value",
          z: "series",
          color: "series",
          key: "key",
          groupScale: () =>
            scaleBand<string>().domain(["seriesA", "seriesB"]).paddingInner(0.1),
          inset: 1,
        }),
      ],
      x: { scale: () => scaleBand<string>().paddingInner(0.2), grid: false },
      y: { scale: scaleLinear, nice: true, grid: true },
      tooltip: true,
    });
  }, [data]);

  return (
    <Chart
      ariaLabel="Bar chart benchmark scenario"
      aspectRatio={2}
      definition={definition}
      onRender={onRender}
    />
  );
}
