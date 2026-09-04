// Twin of bklit-barmultiaxis.tsx; only the import source changes.
import { useEffect, useMemo, useRef, useState } from "react";
import { BarChart, Bar, BarXAxis, Grid, ChartTooltip } from "@migrated/charts";
import {
  generateTimeSeries,
  generateTimeSeriesUpdate,
  type SeededRow,
} from "../../../data";
import { armBklitSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";
import { appendLiveRow } from "../bench/live";

// Secondary series an order of magnitude below seriesA.
const SECONDARY_AXIS_DIVISOR = 50;

type MultiAxisRow = SeededRow & { seriesC: number };

function withSecondary(rows: SeededRow[]): MultiAxisRow[] {
  return rows.map((row) => ({
    ...row,
    seriesC: Math.round((row.seriesB / SECONDARY_AXIS_DIVISOR) * 100) / 100,
  }));
}

export default function MigratedBarMultiAxis({ n }: { n: number }) {
  const [data, setData] = useState<MultiAxisRow[]>(() =>
    withSecondary(generateTimeSeries("bar", n)),
  );
  const tickRef = useRef(0);
  const liveTickRef = useRef(0);
  const { onPhaseChange } = useMemo(() => armBklitSettle(), []);

  useEffect(() => {
    window.__benchUpdate = () =>
      measureUpdatePaint(() => {
        tickRef.current += 1;
        setData(withSecondary(generateTimeSeriesUpdate("bar", n, tickRef.current)));
      });
    window.__benchLiveTick = () => {
      liveTickRef.current += 1;
      setData((prev) =>
        withSecondary(appendLiveRow("bar", n, prev, liveTickRef.current)),
      );
    };
  }, [n]);

  return (
    <BarChart data={data} xDataKey="date" onPhaseChange={onPhaseChange}>
      <Grid horizontal />
      <Bar dataKey="seriesA" fill="var(--chart-line-primary)" lineCap="round" />
      <Bar dataKey="seriesC" yAxisId="right" fill="var(--chart-line-secondary)" lineCap="round" />
      <BarXAxis />
      <ChartTooltip />
    </BarChart>
  );
}
