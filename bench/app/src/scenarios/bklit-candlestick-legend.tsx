// Studio's Bullish/Bearish legend pairing; hover driven via __qaSetLegendHover for deterministic QA.
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
} from "@bklitui/ui/charts";
import {
  generateCandles,
  generateCandlesUpdate,
  type SeededOhlcRow,
} from "../../../data";
import { armBklitTimerSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";
import { appendLiveCandle } from "../bench/live";

const CANDLESTICK_ANIMATION_DURATION_MS = 1100;

// Index 0 MUST be Bullish/up (mirrors studioCandlestickLegendItems).
const LEGEND_ITEMS = [
  { label: "Bullish", value: 100, color: "var(--color-emerald-500)" },
  { label: "Bearish", value: 100, color: "var(--color-red-500)" },
];

export default function BklitCandlestickLegend({ n }: { n: number }) {
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
