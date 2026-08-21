// Segment drag-selection parity scenario (initiative 6 Q2 drag probe +
// settled Q1) — the bklit-line tree plus the three Segment components at
// their defaults. The settled frame shows no segment chrome (selection
// only exists during a drag); the drag probe drives pointer events.
import { useEffect, useMemo, useRef, useState } from "react";
import { curveNatural } from "@visx/curve";
import {
  LineChart,
  Line,
  Grid,
  XAxis,
  ChartTooltip,
  SegmentBackground,
  SegmentLineFrom,
  SegmentLineTo,
} from "@bklitui/ui/charts";
import {
  generateTimeSeries,
  generateTimeSeriesUpdate,
  type SeededRow,
} from "../../../data";
import { armBklitSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";
import { appendLiveRow } from "../bench/live";

export default function BklitSegment({ n, state }: { n: number; state?: "ready" | "loading" }) {
  const [data, setData] = useState<SeededRow[]>(() =>
    generateTimeSeries("segment", n),
  );
  const tickRef = useRef(0);
  const liveTickRef = useRef(0);
  const { onPhaseChange } = useMemo(() => armBklitSettle(), []);

  useEffect(() => {
    window.__benchUpdate = () =>
      measureUpdatePaint(() => {
        tickRef.current += 1;
        setData(generateTimeSeriesUpdate("segment", n, tickRef.current));
      });
    window.__benchLiveTick = () => {
      liveTickRef.current += 1;
      setData((prev) => appendLiveRow("segment", n, prev, liveTickRef.current));
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
      <SegmentBackground />
      <SegmentLineFrom />
      <SegmentLineTo />
      <Line dataKey="seriesA" curve={curveNatural} stroke="var(--chart-line-primary)" />
      <XAxis />
      <ChartTooltip />
    </LineChart>
  );
}
