// C5/C6 gate: pixel-gates migrated stacked/stackGap against legacy; only the import source changes.
import { useEffect, useMemo, useRef, useState } from "react";
import { curveNatural } from "@visx/curve";
import {
  ComposedChart,
  SeriesBar,
  Line,
  Grid,
  XAxis,
  ChartTooltip,
} from "@migrated/charts";
import {
  generateComposed,
  generateComposedUpdate,
  type SeededComposedRow,
} from "../../../data";
import { armBklitSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";
import { appendLiveComposed } from "../bench/live";

export default function MigratedComposedStacked({ n }: { n: number }) {
  const [data, setData] = useState<SeededComposedRow[]>(() =>
    generateComposed("composedstacked", n),
  );
  const tickRef = useRef(0);
  const liveTickRef = useRef(0);
  const { onPhaseChange } = useMemo(() => armBklitSettle(), []);

  useEffect(() => {
    window.__benchUpdate = () =>
      measureUpdatePaint(() => {
        tickRef.current += 1;
        setData(generateComposedUpdate("composedstacked", n, tickRef.current));
      });
    window.__benchLiveTick = () => {
      liveTickRef.current += 1;
      setData((prev) =>
        appendLiveComposed("composedstacked", n, prev, liveTickRef.current),
      );
    };
  }, [n]);

  return (
    <ComposedChart
      data={data}
      onPhaseChange={onPhaseChange}
      stacked
      stackGap={2}
    >
      <Grid horizontal />
      <SeriesBar dataKey="bars" fill="var(--chart-1)" />
      <SeriesBar dataKey="area" fill="var(--chart-4)" />
      <Line dataKey="line" curve={curveNatural} stroke="var(--chart-2)" />
      <XAxis />
      <ChartTooltip />
    </ComposedChart>
  );
}
