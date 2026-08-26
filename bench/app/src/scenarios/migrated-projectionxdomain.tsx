// P6.2 D331 control fixture — the `projection` scenario with a NARROWED
// `xDomain`. This is the only configuration in which P6.2's line-chart change
// is observable at all, so without it the five rewired sites would ship
// un-gated.
//
// bklit builds ONE x scale (`time-series-chart-shell.tsx:284-301`): when
// `xDomain` is set the domain IS `xDomain` and the projection tail is
// deliberately NOT merged in ("Brush defines the viewport"). Every overlay —
// terminal marker, projection line + end marker, projection gradient — reads
// that same scale through `useChartStable().xScale`.
//
// Migrated's line-chart had five inline copies of the time→pixel math that
// recomputed the extent from the FILTERED `renderData` and merged the
// projection max unconditionally, i.e. they diverged from the chart's own
// rendered x domain on both counts. With a projection horizon running well past
// the narrowed viewport the misread max is far larger than the real one, so the
// projection line, its end marker and the terminal marker all collapse toward
// the left of the plot. Under the plain `projection` scenario (no `xDomain`)
// the two formulas agree exactly, which is why every existing gate passed
// while the defect was live.
//
// `xDomain` spans the first 60% of the series; the projection path is still
// built from the FULL data, so its horizon extends past the viewport's right
// edge exactly as a real brushed chart's would.
import { useEffect, useMemo, useRef, useState } from "react";
import { curveNatural } from "@visx/curve";
import {
  LineChart,
  Line,
  Grid,
  XAxis,
  ChartTooltip,
  ProjectionLine,
  ProjectionLineEndMarker,
  LineSeriesTerminalMarker,
  buildProjectionPath,
} from "../../../../showcase/migrated/charts";
import {
  generateTimeSeries,
  generateTimeSeriesUpdate,
  type SeededRow,
} from "../../../data";
import { armBklitSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";
import { appendLiveRow } from "../bench/live";

/** Viewport covers the first 30% of the series; the projection horizon runs
    a long way past its right edge, so a chart that (wrongly) merges the
    projection max into its overlay extent squashes that overlay across most
    of the visible plot instead of clipping it away. */
const X_DOMAIN_FRACTION = 0.3;
/** Long on purpose — see above. */
const HORIZON_POINTS = 600;

export default function MigratedProjectionXDomain({ n, state }: { n: number; state?: "ready" | "loading" }) {
  const [data, setData] = useState<SeededRow[]>(() =>
    generateTimeSeries("projection", n),
  );
  const tickRef = useRef(0);
  const liveTickRef = useRef(0);
  const { onPhaseChange } = useMemo(() => armBklitSettle(), []);
  const projectionPath = useMemo(
    () =>
      buildProjectionPath({
        sourceData: data as unknown as Record<string, unknown>[],
        seriesKey: "seriesA",
        mode: "auto",
        autoMethod: "lastSegment",
        pathDensity: "endpoints",
        horizonPoints: HORIZON_POINTS,
      }),
    [data],
  );
  const xDomain = useMemo<[Date, Date] | undefined>(() => {
    if (data.length < 2) return undefined;
    const first = data[0]!.date;
    const lastIndex = Math.max(1, Math.floor((data.length - 1) * X_DOMAIN_FRACTION));
    return [first, data[lastIndex]!.date];
  }, [data]);

  useEffect(() => {
    window.__benchUpdate = () =>
      measureUpdatePaint(() => {
        tickRef.current += 1;
        setData(generateTimeSeriesUpdate("projection", n, tickRef.current));
      });
    window.__benchLiveTick = () => {
      liveTickRef.current += 1;
      setData((prev) => appendLiveRow("projection", n, prev, liveTickRef.current));
    };
  }, [n]);

  return (
    <LineChart
      data={data}
      onPhaseChange={onPhaseChange}
      status={state === "loading" ? "loading" : "ready"}
      loadingLabel={state === "loading" ? "Loading data" : undefined}
      xDomain={xDomain}
      xDomainSlotCount={data.length}
    >
      <Grid horizontal />
      <Line dataKey="seriesA" curve={curveNatural} stroke="var(--chart-line-primary)" />
      <LineSeriesTerminalMarker dataKey="seriesA" ringGap={6} stroke="var(--chart-1)" />
      {/* Deliberately FAT and SOLID, not the base scenario's 2px `1,4` dashed
          gradient: D337 — pixelmatch at `threshold: 0.1, includeAA: false`
          discards a hairline dashed stroke wholesale, and a first attempt at
          this fixture moved the settled gate by 0.009pp (0.0669% fixed vs
          0.0762% control) with the projection painted that way. A gate that
          cannot detect the presence it seeks is not evidence. */}
      <ProjectionLine
        curveKind="bezier"
        data={projectionPath}
        showEndMarker
        stroke="var(--chart-3)"
        strokeStyle="solid"
        strokeWidth={10}
      />
      <ProjectionLineEndMarker data={projectionPath} stroke="var(--chart-3)" />
      <XAxis />
      <ChartTooltip />
    </LineChart>
  );
}
