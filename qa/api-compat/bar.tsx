// Q2 API-compatibility fixture (research/05): exercises every public prop and
// callback the migrated BarChart supports at pilot scope (grouped-vertical
// demo path only — no stacked/horizontal/perspective, out of scope per the
// migration's architecture decisions). Must typecheck with zero errors via
// `tsc --noEmit` (included from bench/app/tsconfig.json). Runtime smoke is
// covered by the bench scenarios (console-errors column in
// docs/BENCHMARKS.md must be 0).
import * as React from "react";
import {
  Bar,
  BarChart,
  BarXAxis,
  ChartTooltip,
  Grid,
  type ChartPhase,
} from "@migrated/charts";

interface Row {
  date: Date;
  seriesA: number;
  seriesB: number;
  [key: string]: unknown;
}

const data: Row[] = [
  { date: new Date("2026-01-01"), seriesA: 10, seriesB: 20 },
  { date: new Date("2026-01-02"), seriesA: 15, seriesB: 18 },
];

export function BarChartApiFixture() {
  const onPhaseChange = (phase: ChartPhase): void => {
    void phase;
  };

  return (
    <>
      {/* Canonical demo path (registry example parity — bklit-bar.tsx). */}
      <BarChart data={data} xDataKey="date" onPhaseChange={onPhaseChange}>
        <Grid horizontal />
        <Bar dataKey="seriesA" fill="var(--chart-line-primary)" lineCap="round" />
        <Bar dataKey="seriesB" fill="var(--chart-line-secondary)" lineCap="round" />
        <BarXAxis />
        <ChartTooltip />
      </BarChart>

      {/* Full pilot prop surface. */}
      <BarChart
        data={data}
        xDataKey="date"
        animationDuration={1100}
        margin={{ top: 40, right: 40, bottom: 40, left: 40 }}
        aspectRatio="2 / 1"
        className="chart"
        barGap={0.2}
        onPhaseChange={onPhaseChange}
      >
        <Grid
          horizontal
          vertical={false}
          stroke="var(--chart-grid)"
          strokeOpacity={1}
          strokeWidth={1}
          numTicks={5}
        />
        <Bar
          dataKey="seriesA"
          fill="var(--chart-line-primary)"
          stroke="var(--chart-line-primary)"
          lineCap="round"
          fadedOpacity={0.3}
        />
        <Bar dataKey="seriesB" fill="var(--chart-line-secondary)" lineCap={4} />
        <BarXAxis tickerHalfWidth={50} showAllLabels={false} maxLabels={12} />
        <ChartTooltip enabled showDatePill showCrosshair showDots />
      </BarChart>
    </>
  );
}
