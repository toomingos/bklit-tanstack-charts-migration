// Migrated multi-axis ReferenceArea scenario — IDENTICAL usage to
// bklit-refareamultiaxis.tsx (same component tree, same props), only the
// import source changes. See that file for why the fixture is shaped this way.
//
// P6.1 cluster 6 gate fixture (RA2) — refarea with a SECOND y-axis and one
// ReferenceArea per axis.
//
// The point of the fixture is the RIGHT-axis band: bklit's <ReferenceArea>
// resolves its rect through `useYScale(yAxisId)`, so `y1={2} y2={18}` on the
// right axis must fill most of the plot in the ~[0, 20] secondary domain. Read
// against the primary ~[0, 1400] domain those same numbers collapse into a
// sliver on the baseline — which is exactly the failure this gate is built to
// see. The band is deliberately TALL: a first attempt used `12`..`15`, and the
// D331 control PASSED at 0.064% because the misread band was only a few pixels
// of dashed outline. Enlarging it was still not enough — the DEFAULT band fill
// is `color-mix(... 12%, transparent)`, faint enough that pixelmatch's 0.1
// threshold discards a full-height misplaced band (D337 again), so the band
// also carries an explicit opaque `fill`/`fillOpacity`. A gate that cannot
// detect the presence it seeks is not evidence.
//
// The LEFT band keeps the base scenario's `y1={1050} y2={1250}`, so the fixture
// also proves the default-axis path did not move.
//
// No <YAxis> child (matching the `refarea` scenario) so the fixture gates the
// BAND geometry, not right-hand axis rendering.
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

/** `seriesB / 50` — an order of magnitude below `seriesA` on purpose. */
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
