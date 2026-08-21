// bklit BarSquares + BarColumnTrack scenario (initiative 11, plan-loop-1
// §2.3/§2.4/§8). Combined per the plan's Q1 proposal (shared
// computeSquareColumn quantization dependency, §2.4) -- BarColumnTrack
// renders as an underlay BEFORE the squares series (bar-squares.tsx
// composition order), one gradient-fill series + one pattern-fill series
// (gallery's "shape + gradient/pattern variants", §2.8) to exercise
// ruling 10's nested pattern-inside-gradient composition.
// Per-bar hover-dim ("bar-hover probe") is exercised by the QA harness'
// STANDARD hover-fraction sweep (qa/screenshot.mjs's generic path -- no
// special branch needed, mirrors the plain "bar" scenario). The
// legend-hover probe uses `window.__qaSetLegendHover` (candlelegend /
// legendhover / markers precedent) wrapping BOTH BarSquares series AND
// BarColumnTrack (bar-squares.tsx: BarSquares reads useChartLegendHover
// per-bar; BarColumnTrack fades out entirely, binary, on ANY hover).
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart,
  BarSquares,
  BarColumnTrack,
  BarXAxis,
  Grid,
  ChartTooltip,
  ChartLegend,
  ChartLegendHoverProvider,
} from "@bklitui/ui/charts";
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

export default function BklitBarSquares({ n }: { n: number }) {
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
