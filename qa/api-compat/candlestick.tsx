// Q2 API-compatibility fixture (research/05): exercises every public prop
// the migrated CandlestickChart supports at pilot scope. Must typecheck
// with zero errors via `tsc --noEmit` (included from bench/app/tsconfig.json).
// Runtime smoke is covered by the bench scenarios (console-errors column in
// docs/BENCHMARKS.md must be 0). Note: CandlestickChart has no
// onPhaseChange/status prop (bklit parity — verified directly in
// repos/bklit-ui/packages/ui/src/charts/candlestick-chart.tsx).
import * as React from "react";
import {
  Candlestick,
  CandlestickChart,
  ChartTooltip,
  Grid,
  XAxis,
  YAxis,
} from "@migrated/charts";

interface Row {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  [key: string]: unknown;
}

const data: Row[] = [
  { date: new Date("2026-01-01"), open: 10, high: 12, low: 9, close: 11 },
  { date: new Date("2026-01-02"), open: 11, high: 13, low: 10, close: 9 },
  { date: new Date("2026-01-03"), open: 9, high: 10, low: 8, close: 9.5 },
];

export function CandlestickChartApiFixture() {
  return (
    <>
      {/* Canonical demo path (registry example parity). */}
      <CandlestickChart data={data}>
        <Grid horizontal vertical />
        <Candlestick />
        <XAxis />
        <YAxis />
        <ChartTooltip />
      </CandlestickChart>

      {/* Full pilot prop surface. */}
      <CandlestickChart
        data={data}
        xDataKey="date"
        margin={{ top: 40, right: 40, bottom: 40, left: 40 }}
        animationDuration={1100}
        enterTransition={{ duration: 0.8, bounce: 0.15 }}
        revealSignature="epoch-1"
        aspectRatio="2 / 1"
        className="chart"
        style={{ width: "100%" }}
        candleGap={0.2}
        candleWidth={8}
      >
        <Grid
          horizontal
          vertical
          stroke="var(--chart-grid)"
          strokeOpacity={1}
          strokeWidth={1}
          numTicks={5}
        />
        <Candlestick
          positiveFill="var(--color-emerald-500)"
          negativeFill="var(--color-red-500)"
          insideStrokeWidth={0}
          fadedOpacity={0.3}
          showHoverFade
        />
        <XAxis numTicks={5} formatValue={(value: Date) => value.toDateString()} />
        <YAxis
          yAxisId="left"
          orientation="left"
          numTicks={5}
          formatLargeNumbers
          formatValue={(value: number) => value.toFixed(2)}
        />
        <ChartTooltip enabled showDatePill showCrosshair showDots />
      </CandlestickChart>
    </>
  );
}
