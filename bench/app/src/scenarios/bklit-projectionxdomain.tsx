// Control fixture: projection scenario with narrowed xDomain; overlays must use the chart's x scale.
// Projection path is built from full data so its horizon extends past the viewport like a brushed chart.
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
} from "@bklitui/ui/charts";
import {
  generateTimeSeries,
  generateTimeSeriesUpdate,
  type SeededRow,
} from "../../../data";
import { armBklitSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";
import { appendLiveRow } from "../bench/live";

/** Narrow viewport + long horizon: a wrong overlay extent squashes the projection across the plot. */
const X_DOMAIN_FRACTION = 0.3;
const HORIZON_POINTS = 600;

export default function BklitProjectionXDomain({ n, state }: { n: number; state?: "ready" | "loading" }) {
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
      {/* Keep fat solid stroke: pixelmatch discards hairline dashed strokes, hiding the overlay. */}
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
