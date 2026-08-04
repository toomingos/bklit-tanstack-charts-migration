// Faithful port of repos/bklit-ui/packages/ui/registry/examples/bar-chart.tsx
// -- the canonical demo uses string `month` categories; we use `xDataKey="date"`
// instead (BarChart's categoryAccessor auto-formats Date values via
// shortDateFmt, confirmed in bar-chart.tsx) so the SAME impl-independent
// seeded time-series generator can be reused across line/area/bar.
import { useEffect, useMemo, useRef, useState } from "react";
import { BarChart, Bar, BarXAxis, Grid, ChartTooltip } from "@bklitui/ui/charts";
import {
  generateTimeSeries,
  generateTimeSeriesUpdate,
  type SeededRow,
} from "../../../data";
import { armBklitSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";
import { appendLiveRow } from "../bench/live";

export default function BklitBar({ n }: { n: number }) {
  const [data, setData] = useState<SeededRow[]>(() =>
    generateTimeSeries("bar", n),
  );
  const tickRef = useRef(0);
  const liveTickRef = useRef(0);
  const { onPhaseChange } = useMemo(() => armBklitSettle(), []);

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

  return (
    <BarChart data={data} xDataKey="date" onPhaseChange={onPhaseChange}>
      <Grid horizontal />
      <Bar dataKey="seriesA" fill="var(--chart-line-primary)" lineCap="round" />
      <Bar dataKey="seriesB" fill="var(--chart-line-secondary)" lineCap="round" />
      <BarXAxis />
      <ChartTooltip />
    </BarChart>
  );
}
