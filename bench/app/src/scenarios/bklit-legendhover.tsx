// QA-only legend->chart dim probe; bklit uses two index spaces (mixed for line/area, bar-only for bars).
// Settle resolves only after BOTH charts see non-ready -> ready.
import { useEffect, useMemo, useRef, useState } from "react";
import { curveNatural } from "@visx/curve";
import {
  ComposedChart,
  SeriesBar,
  Area,
  Line,
  BarChart,
  Bar,
  BarXAxis,
  Grid,
  XAxis,
  ChartTooltip,
  ChartLegend,
  ChartLegendHoverProvider,
} from "@bklitui/ui/charts";
import {
  generateComposed,
  generateComposedUpdate,
  generateTimeSeries,
  generateTimeSeriesUpdate,
  type SeededComposedRow,
  type SeededRow,
} from "../../../data";
import { armManualSettle, type BklitPhase } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";
import { appendLiveComposed, appendLiveRow } from "../bench/live";

// Index 0 = bar space, index 1 = mixed line/area space (see above).
const LEGEND_ITEMS = [
  { label: "Series 0", value: 100, color: "var(--chart-1)" },
  { label: "Series 1", value: 100, color: "var(--chart-2)" },
];

// Parallel ~1100ms reveals; fallback covers the slower of the two.
const DUAL_SETTLE_FALLBACK_MS = 4000;

export default function BklitLegendHover({ n }: { n: number }) {
  const [composedData, setComposedData] = useState<SeededComposedRow[]>(() =>
    generateComposed("legendhover-composed", n),
  );
  const [barData, setBarData] = useState<SeededRow[]>(() =>
    generateTimeSeries("legendhover-bar", n),
  );
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const tickRef = useRef(0);
  const liveTickRef = useRef(0);

  // Per-chart phase arm; shared settle resolves once both complete.
  const { onComposedPhase, onBarPhase } = useMemo(() => {
    const { resolve } = armManualSettle(DUAL_SETTLE_FALLBACK_MS);
    const done = [false, false];
    const mk = (slot: 0 | 1) => {
      let sawNonReady = false;
      return (phase: BklitPhase) => {
        if (phase !== "ready") {
          sawNonReady = true;
          return;
        }
        if (sawNonReady && !done[slot]) {
          done[slot] = true;
          if (done[0] && done[1]) resolve();
        }
      };
    };
    return { onComposedPhase: mk(0), onBarPhase: mk(1) };
  }, []);

  useEffect(() => {
    window.__benchUpdate = () =>
      measureUpdatePaint(() => {
        tickRef.current += 1;
        setComposedData(
          generateComposedUpdate("legendhover-composed", n, tickRef.current),
        );
        setBarData(
          generateTimeSeriesUpdate("legendhover-bar", n, tickRef.current),
        );
      });
    window.__benchLiveTick = () => {
      liveTickRef.current += 1;
      setComposedData((prev) =>
        appendLiveComposed("legendhover-composed", n, prev, liveTickRef.current),
      );
      setBarData((prev) =>
        appendLiveRow("legendhover-bar", n, prev, liveTickRef.current),
      );
    };
    (window as unknown as Record<string, unknown>).__qaSetLegendHover = (
      i: number | null,
    ) => setHoveredIndex(i);
  }, [n]);

  return (
    <div style={{ display: "flex", gap: 32, height: "100%", alignItems: "stretch" }}>
      <ChartLegendHoverProvider
        hoveredIndex={hoveredIndex}
        onHoverChange={setHoveredIndex}
      >
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <div style={{ flex: 1, minHeight: 0 }}>
            <ComposedChart data={composedData} onPhaseChange={onComposedPhase}>
              <Grid horizontal />
              <SeriesBar dataKey="bars" fill="var(--chart-1)" />
              <Area
                dataKey="line"
                curve={curveNatural}
                fill="var(--chart-4)"
                fillOpacity={0.35}
              />
              <Line dataKey="line" curve={curveNatural} stroke="var(--chart-2)" />
              <XAxis />
              <ChartTooltip />
            </ComposedChart>
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <BarChart data={barData} xDataKey="date" onPhaseChange={onBarPhase}>
              <Grid horizontal />
              <Bar
                dataKey="seriesA"
                fill="var(--chart-line-primary)"
                lineCap="round"
              />
              <Bar
                dataKey="seriesB"
                fill="var(--chart-line-secondary)"
                lineCap="round"
              />
              <BarXAxis />
              <ChartTooltip />
            </BarChart>
          </div>
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
