// Migrated twin of bklit-legendhover.tsx (sed-generated: import source +
// component name only). Legend-hover series-dim scenario (initiative 8 loop-2, D225 — QA-ONLY,
// no bench gating: same D223 ruling 4 class as the legend/candlelegend
// pairs, this exists to exercise the legend→chart dim path, not to add a
// new render-cost triangle). ONE ChartLegendHoverProvider wraps BOTH a
// ComposedChart (SeriesBar + Area + Line — the bklit-composed tree
// verbatim) and a 2-series BarChart, so a single hovered index drives:
//   - line/area dim (hover-chrome single-writer OR-term; bklit
//     line.tsx/area.tsx seriesIndex = index into the MIXED `lines` array,
//     which includes the SeriesBar shim upserted by composed-chart.tsx's
//     tryAppendSeriesBar — so here Line/Area sit at MIXED index 1),
//   - composed SeriesBar dim (bklit series-bar.tsx:127-137 seriesIndex =
//     index into composedBarDataKeys, a BAR-ONLY space — so the bar sits
//     at index 0 AND the line sits at index 1 simultaneously; legend
//     index 0 keeps the bar full + dims the line, index 1 the reverse.
//     That two-index-space quirk is bklit's own behavior and this
//     scenario demonstrates it deliberately),
//   - standalone BarChart per-series dim (bar-hover-chrome / bklit
//     bar-squares.tsx `lines.findIndex`).
// `window.__qaSetLegendHover` drives deterministic QA captures (legend /
// candlelegend precedent). Settle: both charts expose the standard
// onPhaseChange reveal contract, so `armManualSettle` resolves only after
// EACH chart has seen non-ready -> ready (armBklitSettle's arm, per chart).
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
} from "@migrated/charts";
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

// Two slots on purpose: index 0 = composed bar (bar-only space) AND bar
// chart seriesA; index 1 = composed line/area (mixed space) AND seriesB.
const LEGEND_ITEMS = [
  { label: "Series 0", value: 100, color: "var(--chart-1)" },
  { label: "Series 1", value: 100, color: "var(--chart-2)" },
];

// The reveals run in parallel (~1100ms default), so the shared 2500ms-class
// fallback still comfortably covers the slower of the two.
const DUAL_SETTLE_FALLBACK_MS = 4000;

export default function MigratedLegendHover({ n }: { n: number }) {
  const [composedData, setComposedData] = useState<SeededComposedRow[]>(() =>
    generateComposed("legendhover-composed", n),
  );
  const [barData, setBarData] = useState<SeededRow[]>(() =>
    generateTimeSeries("legendhover-bar", n),
  );
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const tickRef = useRef(0);
  const liveTickRef = useRef(0);

  // armBklitSettle's "saw a non-ready phase, then ready again" arm, applied
  // per chart; resolve the shared manual settle once BOTH have completed.
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
