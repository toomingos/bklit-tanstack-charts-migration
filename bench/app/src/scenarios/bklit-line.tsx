// Faithful port of repos/bklit-ui/packages/ui/registry/examples/line-chart.tsx
// -- same component tree / props, data comes from the seeded generator
// scaled to `n` instead of the 6-point demo array.
import { useEffect, useMemo, useRef, useState } from "react";
import { curveNatural } from "@visx/curve";
import { LineChart, Line, Grid, XAxis, ChartTooltip } from "@bklitui/ui/charts";
import {
  generateTimeSeries,
  generateTimeSeriesUpdate,
  type SeededRow,
} from "../../../data";
import { armBklitSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";
import { appendLiveRow } from "../bench/live";

export default function BklitLine({ n, state }: { n: number; state?: "ready" | "loading" }) {
  const [data, setData] = useState<SeededRow[]>(() =>
    generateTimeSeries("line", n),
  );
  const tickRef = useRef(0);
  const liveTickRef = useRef(0);
  const { onPhaseChange } = useMemo(() => armBklitSettle(), []);

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

  return (
    <LineChart
      data={data}
      onPhaseChange={onPhaseChange}
      status={state === "loading" ? "loading" : "ready"}
      loadingLabel={state === "loading" ? "Loading data" : undefined}
    >
      <Grid horizontal />
      <Line dataKey="seriesA" curve={curveNatural} stroke="var(--chart-line-primary)" />
      <XAxis />
      <ChartTooltip />
    </LineChart>
  );
}
