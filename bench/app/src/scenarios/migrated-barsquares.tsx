// Migrated twin of bklit-barsquares.tsx. BarSquares/BarColumnTrack are
// fully wired internally (children.tsx CHART_ROLE registrations, bar-
// chart.tsx resolvedBarSquares/resolvedBarColumnTracks) and are re-exported
// from the top-level `@migrated/charts` barrel (dispatch C landed the
// barrel exports alongside the BarDepth/BarPulse family). These ARE the
// real CHART_ROLE-carrying components bar-chart.tsx's extractChildren()
// recognizes -- not a reimplementation.
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart,
  BarXAxis,
  Grid,
  ChartTooltip,
  ChartLegend,
  ChartLegendHoverProvider,
  BarSquares,
  BarColumnTrack,
} from "@migrated/charts";
import {
  generateTimeSeries,
  generateTimeSeriesUpdate,
  type SeededRow,
} from "../../../data";
import { armBklitSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";
import { appendLiveRow } from "../bench/live";

const LEGEND_ITEMS = [
  { label: "Series A (gradient)", value: 100, color: "var(--chart-1)" },
  { label: "Series B (pattern)", value: 100, color: "var(--chart-2)" },
];

export default function MigratedBarSquares({ n }: { n: number }) {
  const [data, setData] = useState<SeededRow[]>(() =>
    generateTimeSeries("barsquares", n),
  );
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const tickRef = useRef(0);
  const liveTickRef = useRef(0);
  const { onPhaseChange } = useMemo(() => armBklitSettle(), []);

  useEffect(() => {
    window.__benchUpdate = () =>
      measureUpdatePaint(() => {
        tickRef.current += 1;
        setData(generateTimeSeriesUpdate("barsquares", n, tickRef.current));
      });
    window.__benchLiveTick = () => {
      liveTickRef.current += 1;
      setData((prev) => appendLiveRow("barsquares", n, prev, liveTickRef.current));
    };
    (window as unknown as Record<string, unknown>).__qaSetLegendHover = (
      i: number | null,
    ) => setHoveredIndex(i);
  }, [n]);

  return (
    <div style={{ display: "flex", gap: 32, height: "100%", alignItems: "stretch" }}>
      <ChartLegendHoverProvider hoveredIndex={hoveredIndex} onHoverChange={setHoveredIndex}>
        <div style={{ flex: 1, minWidth: 0, height: "100%" }}>
          <BarChart data={data} xDataKey="date" onPhaseChange={onPhaseChange}>
            <Grid horizontal />
            <BarColumnTrack fill="var(--muted)" opacity={0.15} />
            <BarSquares
              dataKey="seriesA"
              fill="var(--chart-1)"
              useGradient
              gradientStops={[
                { offset: 0, color: "var(--chart-1)" },
                { offset: 1, color: "var(--chart-2)" },
              ]}
            />
            <BarSquares dataKey="seriesB" fill="var(--chart-2)" patternPreset="diagonal" />
            <BarXAxis />
            <ChartTooltip />
          </BarChart>
        </div>
      </ChartLegendHoverProvider>
      <div style={{ width: 220 }}>
        <ChartLegend
          hoveredIndex={hoveredIndex}
          items={LEGEND_ITEMS}
          onHover={setHoveredIndex}
          title="Series"
        />
      </div>
    </div>
  );
}
