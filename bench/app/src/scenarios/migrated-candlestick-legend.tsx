// Migrated Candlestick + 2-slot legend scenario — IDENTICAL usage to
// bklit-candlestick-legend.tsx (same tree, props, settle, legend items),
// only the import source changes. (initiative 8 loop-2,
// D223 ruling 6 / D225 ruling 6). Mirrors the ONLY real bklit pairing —
// Studio's StudioChartShell + studioCandlestickLegendItems
// (packages/studio/src/lib/studio-legend-items.ts:237-250: item 0 =
// Bullish/up, item 1 = Bearish/down, cross-checked candlestick.tsx:116-120)
// — reduced to its chart-relevant core: ChartLegendHoverProvider wrapping
// the chart, a 2-item ChartLegend sharing the hovered index, candle default
// colors (candlestick.tsx:13-14). Same settle/update machinery as
// bklit-candlestick.tsx; `window.__qaSetLegendHover` drives deterministic
// legend-hover QA captures (loop-1 profitloss/legend precedent).
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CandlestickChart,
  Candlestick,
  Grid,
  XAxis,
  YAxis,
  ChartTooltip,
  ChartLegend,
  ChartLegendHoverProvider,
} from "@migrated/charts";
import {
  generateCandles,
  generateCandlesUpdate,
  type SeededOhlcRow,
} from "../../../data";
import { armBklitTimerSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";
import { appendLiveCandle } from "../bench/live";

const CANDLESTICK_ANIMATION_DURATION_MS = 1100;

// Mirrors studioCandlestickLegendItems: index 0 MUST be Bullish/up.
const LEGEND_ITEMS = [
  { label: "Bullish", value: 100, color: "var(--color-emerald-500)" },
  { label: "Bearish", value: 100, color: "var(--color-red-500)" },
];

export default function MigratedCandlestickLegend({ n }: { n: number }) {
  const [data, setData] = useState<SeededOhlcRow[]>(() =>
    generateCandles("candlestick", n),
  );
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const tickRef = useRef(0);
  const liveTickRef = useRef(0);

  useMemo(() => {
    armBklitTimerSettle(CANDLESTICK_ANIMATION_DURATION_MS);
  }, []);

  useEffect(() => {
    window.__benchUpdate = () =>
      measureUpdatePaint(() => {
        tickRef.current += 1;
        setData(generateCandlesUpdate("candlestick", n, tickRef.current));
      });
    window.__benchLiveTick = () => {
      liveTickRef.current += 1;
      setData((prev) =>
        appendLiveCandle("candlestick", n, prev, liveTickRef.current),
      );
    };
    (window as unknown as Record<string, unknown>).__qaSetLegendHover = (
      i: number | null,
    ) => setHoveredIndex(i);
  }, [n]);

  return (
    <div style={{ display: "flex", gap: 32, alignItems: "flex-start" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <ChartLegendHoverProvider
          hoveredIndex={hoveredIndex}
          onHoverChange={setHoveredIndex}
        >
          <CandlestickChart data={data}>
            <Grid horizontal vertical />
            <Candlestick />
            <XAxis />
            <YAxis />
            <ChartTooltip />
          </CandlestickChart>
        </ChartLegendHoverProvider>
      </div>
      <div style={{ width: 220 }}>
        <ChartLegend
          hoveredIndex={hoveredIndex}
          items={LEGEND_ITEMS}
          onHover={setHoveredIndex}
          title="Candles"
        />
      </div>
    </div>
  );
}
