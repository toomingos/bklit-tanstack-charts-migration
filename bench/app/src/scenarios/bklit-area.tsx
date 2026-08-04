// Faithful port of repos/bklit-ui/packages/ui/registry/examples/area-chart.tsx
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

export default function BklitArea({ n }: { n: number }) {
  const [data, setData] = useState<SeededRow[]>(() =>
    generateTimeSeries("area", n),
  );
  const tickRef = useRef(0);
  const liveTickRef = useRef(0);
  const { onPhaseChange } = useMemo(() => armBklitSettle(), []);

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

  return (
    <AreaChart data={data} animationDuration={1100} onPhaseChange={onPhaseChange}>
      <Grid horizontal />
      <Area
        dataKey="seriesA"
        curve={curveNatural}
        strokeWidth={2.5}
        fillOpacity={0.4}
      />
      <XAxis />
      <ChartTooltip />
    </AreaChart>
  );
}
