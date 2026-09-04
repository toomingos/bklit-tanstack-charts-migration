// Gate fixture RA2: refarea with a second y-axis, one ReferenceArea per axis; same tree as bklit's.
// GUARD: right band is tall (y1=2/y2=18) with opaque fill so a domain misread is detectable.
// GUARD: no YAxis child; fixture gates band geometry, not axis rendering.
// Left band keeps the base y1/y2 so the default-axis path is also gated.
import { useEffect, useMemo, useRef, useState } from "react";
import { curveNatural } from "@visx/curve";
import { LineChart, Line, Grid, XAxis, ChartTooltip, ReferenceArea } from "@migrated/charts";
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

export default function MigratedRefAreaMultiAxis({ n, state }: { n: number; state?: "ready" | "loading" }) {
  const [data, setData] = useState<MultiAxisRow[]>(() =>
    withSecondary(generateTimeSeries("refarea", n)),
  );
  const tickRef = useRef(0);
  const liveTickRef = useRef(0);
  const { onPhaseChange } = useMemo(() => armBklitSettle(), []);

  useEffect(() => {
    window.__benchUpdate = () =>
      measureUpdatePaint(() => {
        tickRef.current += 1;
        setData(withSecondary(generateTimeSeriesUpdate("refarea", n, tickRef.current)));
      });
    window.__benchLiveTick = () => {
      liveTickRef.current += 1;
      setData((prev) =>
        withSecondary(appendLiveRow("refarea", n, prev, liveTickRef.current)),
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
      <ReferenceArea y1={1050} y2={1250} showMarkers strokeStyle="dashed" />
      <ReferenceArea
        y1={2}
        y2={18}
        yAxisId="right"
        strokeStyle="solid"
        showMarkers
        fill="var(--chart-3)"
        fillOpacity={0.5}
      />
      <Line dataKey="seriesA" curve={curveNatural} stroke="var(--chart-line-primary)" />
      <Line dataKey="seriesC" yAxisId="right" curve={curveNatural} stroke="var(--chart-3)" />
      <XAxis />
      <ChartTooltip />
    </LineChart>
  );
}
