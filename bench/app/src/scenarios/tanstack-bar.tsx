// Ceiling reference: wide seeded rows reshaped to long rows (mark API shape, not a data change).
import { useEffect, useMemo, useRef, useState } from "react";
import { scaleBand, scaleLinear } from "d3-scale";
import { Chart } from "@tanstack/react-charts";
import { barY, defineChart, group } from "@tanstack/charts";
import { tooltip } from "@tanstack/charts/tooltip";
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
          layout: group({
            scale: () =>
              scaleBand<string>().domain(["seriesA", "seriesB"]).paddingInner(0.1),
          }),
          inset: 1,
        }),
      ],
      scales: {
        x: { scale: () => scaleBand<string>().paddingInner(0.2), grid: false },
        y: { scale: scaleLinear, nice: true, grid: true },
      },
      tooltip,
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
