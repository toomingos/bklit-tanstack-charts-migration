// Migrated Projection scenario — IDENTICAL usage to bklit-projection.tsx
// (same component tree, same props), only the import source changes.
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
} from "@migrated/charts";
import {
  generateTimeSeries,
  generateTimeSeriesUpdate,
  type SeededRow,
} from "../../../data";
import { armBklitSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";
import { appendLiveRow } from "../bench/live";

export default function MigratedProjection({ n, state }: { n: number; state?: "ready" | "loading" }) {
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
        horizonPoints: 6,
      }),
    [data],
  );

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
    >
      <Grid horizontal />
      <Line dataKey="seriesA" curve={curveNatural} stroke="var(--chart-line-primary)" />
      <LineSeriesTerminalMarker dataKey="seriesA" ringGap={6} stroke="var(--chart-1)" />
      <ProjectionLine
        curveKind="bezier"
        data={projectionPath}
        gradientEnd="var(--chart-5)"
        gradientStart="var(--chart-3)"
        showEndMarker
        stroke="var(--chart-3)"
        strokeDasharray="1,4"
        strokeStyle="gradient"
        strokeWidth={2}
      />
      <ProjectionLineEndMarker data={projectionPath} stroke="var(--chart-3)" />
      <XAxis />
      <ChartTooltip />
    </LineChart>
  );
}
