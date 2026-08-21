// Migrated ReferenceArea scenario — IDENTICAL usage to bklit-refarea.tsx
// (same component tree, same props), only the import source changes.
import { useEffect, useMemo, useRef, useState } from "react";
import { curveNatural } from "@visx/curve";
import { LineChart, Line, Grid, XAxis, ChartTooltip, ReferenceArea } from "@migrated/charts";
import {
  generateTimeSeries,
  generateTimeSeriesUpdate,
  type SeededRow,
} from "../../../data";
import { armBklitSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";
import { appendLiveRow } from "../bench/live";

export default function MigratedRefArea({ n, state }: { n: number; state?: "ready" | "loading" }) {
  const [data, setData] = useState<SeededRow[]>(() =>
    generateTimeSeries("refarea", n),
  );
  const tickRef = useRef(0);
  const liveTickRef = useRef(0);
  const { onPhaseChange } = useMemo(() => armBklitSettle(), []);

  useEffect(() => {
    window.__benchUpdate = () =>
      measureUpdatePaint(() => {
        tickRef.current += 1;
        setData(generateTimeSeriesUpdate("refarea", n, tickRef.current));
      });
    window.__benchLiveTick = () => {
      liveTickRef.current += 1;
      setData((prev) => appendLiveRow("refarea", n, prev, liveTickRef.current));
    };
  }, [n]);

  return (
    <LineChart
      data={data}
      onPhaseChange={onPhaseChange}
      status={state === "loading" ? "loading" : "ready"}
      loadingLabel={state === "loading" ? "Loading data" : undefined}
    >
      <Grid horizontal />
      <ReferenceArea y1={1050} y2={1250} showMarkers strokeStyle="dashed" />
      <Line dataKey="seriesA" curve={curveNatural} stroke="var(--chart-line-primary)" />
      <XAxis />
      <ChartTooltip />
    </LineChart>
  );
}
