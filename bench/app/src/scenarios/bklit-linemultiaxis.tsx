// Multi-axis control: seriesC runs ~12 on "right" vs seriesA ~1000; shared-domain collapse is unmissable.
// No YAxis child: gates mark geometry, not axis rendering.
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

// seriesC = seriesB / 50, an order of magnitude below seriesA on purpose.
const SECONDARY_AXIS_DIVISOR = 50;

type MultiAxisRow = SeededRow & { seriesC: number };

function withSecondary(rows: SeededRow[]): MultiAxisRow[] {
  return rows.map((row) => ({
    ...row,
    seriesC: Math.round((row.seriesB / SECONDARY_AXIS_DIVISOR) * 100) / 100,
  }));
}

export default function BklitLineMultiAxis({ n, state }: { n: number; state?: "ready" | "loading" }) {
  const [data, setData] = useState<MultiAxisRow[]>(() =>
    withSecondary(generateTimeSeries("line", n)),
  );
  const tickRef = useRef(0);
  const liveTickRef = useRef(0);
  const { onPhaseChange } = useMemo(() => armBklitSettle(), []);

  useEffect(() => {
    window.__benchUpdate = () =>
      measureUpdatePaint(() => {
        tickRef.current += 1;
        setData(withSecondary(generateTimeSeriesUpdate("line", n, tickRef.current)));
      });
    window.__benchLiveTick = () => {
      liveTickRef.current += 1;
      setData((prev) =>
        withSecondary(appendLiveRow("line", n, prev, liveTickRef.current)),
      );
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
      <Line dataKey="seriesC" yAxisId="right" curve={curveNatural} stroke="var(--chart-3)" />
      <XAxis />
      <ChartTooltip />
    </LineChart>
  );
}
