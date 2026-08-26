// Wave 1 AX2 fixture (P1.1 gate): identical to bklit-line.tsx except the
// Grid child is PROP-LESS — the point of this scenario is to pixel-gate the
// grid `horizontal` DEFAULT (legacy grid.tsx:97 defaults horizontal to true;
// the migrated resolveGridGuide must match). Do not add grid props here.
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

export default function BklitGridDefault({ n }: { n: number }) {
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
