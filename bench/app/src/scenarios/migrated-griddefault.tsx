// AX2 gate: prop-less Grid pixel-gates the migrated horizontal default. GUARD: do not add grid props.
import { useEffect, useMemo, useRef, useState } from "react";
import { curveNatural } from "@visx/curve";
import { LineChart, Line, Grid, XAxis, ChartTooltip } from "@migrated/charts";
import {
  generateTimeSeries,
  generateTimeSeriesUpdate,
  type SeededRow,
} from "../../../data";
import { armBklitSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";
import { appendLiveRow } from "../bench/live";

export default function MigratedGridDefault({ n }: { n: number }) {
  const [data, setData] = useState<SeededRow[]>(() =>
    generateTimeSeries("griddefault", n),
  );
  const tickRef = useRef(0);
  const liveTickRef = useRef(0);
  const { onPhaseChange } = useMemo(() => armBklitSettle(), []);

  useEffect(() => {
    window.__benchUpdate = () =>
      measureUpdatePaint(() => {
        tickRef.current += 1;
        setData(generateTimeSeriesUpdate("griddefault", n, tickRef.current));
      });
    window.__benchLiveTick = () => {
      liveTickRef.current += 1;
      setData((prev) =>
        appendLiveRow("griddefault", n, prev, liveTickRef.current),
      );
    };
  }, [n]);

  return (
    <LineChart data={data} onPhaseChange={onPhaseChange}>
      <Grid />
      <Line
        dataKey="seriesA"
        curve={curveNatural}
        stroke="var(--chart-line-primary)"
      />
      <XAxis />
      <ChartTooltip />
    </LineChart>
  );
}
