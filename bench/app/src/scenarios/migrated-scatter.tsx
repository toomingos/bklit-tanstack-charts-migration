// Drop-in twin of bklit-scatter.tsx; only the import source changes.
import { useEffect, useMemo, useRef, useState } from "react";
import { ScatterChart, Scatter, Grid, XAxis, ChartTooltip } from "@migrated/charts";
import {
  generateScatter,
  generateScatterUpdate,
  type SeededScatterRow,
} from "../../../data";
import { armBklitSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";
import { appendLiveScatterRow } from "../bench/live";

export default function MigratedScatter({ n }: { n: number }) {
  const [data, setData] = useState<SeededScatterRow[]>(() =>
    generateScatter("scatter", n),
  );
  const tickRef = useRef(0);
  const liveTickRef = useRef(0);
  const { onPhaseChange } = useMemo(() => armBklitSettle(), []);

  useEffect(() => {
    window.__benchUpdate = () =>
      measureUpdatePaint(() => {
        tickRef.current += 1;
        setData(generateScatterUpdate("scatter", n, tickRef.current));
      });
    window.__benchLiveTick = () => {
      liveTickRef.current += 1;
      setData((prev) =>
        appendLiveScatterRow("scatter", n, prev, liveTickRef.current),
      );
    };
  }, [n]);

  return (
    <ScatterChart data={data} onPhaseChange={onPhaseChange}>
      <Grid horizontal />
      <Scatter dataKey="sessions" />
      <Scatter dataKey="conversions" />
      <XAxis />
      <ChartTooltip />
    </ScatterChart>
  );
}
