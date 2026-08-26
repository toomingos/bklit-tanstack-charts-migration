// P6.1 / T-F1 (B7) — the BAR multi-axis NEW-BEHAVIOUR fixture. Same shape and
// reasoning as `bklit-linemultiaxis.tsx`: `seriesA` (~1000) on the default
// "left" axis, `seriesC = seriesB / 50` (~12) on "right". Bar is the strongest
// of the four control-wise — without per-axis domains the second series' bars
// are a row of ~1px stubs on the baseline, with them they are full-height.
//
// n=100 always for the bar family (never 1000) — the mandated bar density.
import { useEffect, useMemo, useRef, useState } from "react";
import { BarChart, Bar, BarXAxis, Grid, ChartTooltip } from "@bklitui/ui/charts";
import {
  generateTimeSeries,
  generateTimeSeriesUpdate,
  type SeededRow,
} from "../../../data";
import { armBklitSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";
import { appendLiveRow } from "../bench/live";

/** `seriesB / 50` — an order of magnitude below `seriesA` on purpose. */
const SECONDARY_AXIS_DIVISOR = 50;

type MultiAxisRow = SeededRow & { seriesC: number };

function withSecondary(rows: SeededRow[]): MultiAxisRow[] {
  return rows.map((row) => ({
    ...row,
    seriesC: Math.round((row.seriesB / SECONDARY_AXIS_DIVISOR) * 100) / 100,
  }));
}

export default function BklitBarMultiAxis({ n }: { n: number }) {
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
