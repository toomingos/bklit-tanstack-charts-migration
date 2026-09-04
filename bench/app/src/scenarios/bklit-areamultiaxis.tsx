// Multi-axis control (same shape as line): area projects BOTH fill and boundary line marks.
import { useEffect, useMemo, useRef, useState } from "react";
import { curveNatural } from "@visx/curve";
import { AreaChart, Area, Grid, XAxis, ChartTooltip } from "@bklitui/ui/charts";
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

export default function BklitAreaMultiAxis({ n, state }: { n: number; state?: "ready" | "loading" }) {
  const [data, setData] = useState<MultiAxisRow[]>(() =>
    withSecondary(generateTimeSeries("area", n)),
  );
  const tickRef = useRef(0);
  const liveTickRef = useRef(0);
  const { onPhaseChange } = useMemo(() => armBklitSettle(), []);

  useEffect(() => {
    window.__benchUpdate = () =>
      measureUpdatePaint(() => {
        tickRef.current += 1;
        setData(withSecondary(generateTimeSeriesUpdate("area", n, tickRef.current)));
      });
    window.__benchLiveTick = () => {
      liveTickRef.current += 1;
      setData((prev) =>
        withSecondary(appendLiveRow("area", n, prev, liveTickRef.current)),
      );
    };
  }, [n]);

  return (
    <AreaChart
      data={data}
      animationDuration={1100}
      onPhaseChange={onPhaseChange}
      status={state === "loading" ? "loading" : "ready"}
      loadingLabel={state === "loading" ? "Loading data" : undefined}
    >
      <Grid horizontal />
      <Area
        dataKey="seriesA"
        curve={curveNatural}
        strokeWidth={2.5}
        fillOpacity={0.4}
      />
      <Area
        dataKey="seriesC"
        yAxisId="right"
        curve={curveNatural}
        stroke="var(--chart-3)"
        fill="var(--chart-3)"
        strokeWidth={2.5}
        fillOpacity={0.4}
      />
      <XAxis />
      <ChartTooltip />
    </AreaChart>
  );
}
