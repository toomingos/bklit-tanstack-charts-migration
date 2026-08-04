// Q2 API-compatibility fixture (research/05): exercises every public prop
// the migrated ScatterChart supports at pilot scope (docs/LOG.md D14 — the
// canonical registry demo path plus the pilot's documented extras). Must
// typecheck with zero errors via `tsc --noEmit` (included from
// bench/app/tsconfig.json). Runtime smoke is covered by the bench scenarios
// (console-errors column in docs/BENCHMARKS.md must be 0).
import * as React from "react";
import {
  ChartTooltip,
  Grid,
  Scatter,
  ScatterChart,
  XAxis,
  type ChartPhase,
} from "@migrated/charts";

interface Row {
  date: Date;
  sessions: number;
  conversions: number;
  [key: string]: unknown;
}

const data: Row[] = [
  { date: new Date("2026-01-01"), sessions: 10, conversions: 2 },
  { date: new Date("2026-01-02"), sessions: 15, conversions: 3 },
];

export function ScatterChartApiFixture() {
  const onPhaseChange = (phase: ChartPhase): void => {
    void phase;
  };

  return (
    <>
      {/* Canonical demo path (registry example parity). */}
      <ScatterChart data={data} onPhaseChange={onPhaseChange}>
        <Grid horizontal />
        <Scatter dataKey="sessions" />
        <Scatter dataKey="conversions" />
        <XAxis />
        <ChartTooltip />
      </ScatterChart>

      {/* Full pilot prop surface. */}
      <ScatterChart
        data={data}
        xDataKey="date"
        animationDuration={1100}
        margin={{ top: 40, right: 40, bottom: 40, left: 40 }}
        aspectRatio="2 / 1"
        className="chart"
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
        <Scatter
          dataKey="sessions"
          fill="var(--chart-1)"
          stroke="var(--chart-1)"
          strokeWidth={2}
          ringGap={2}
          radius={5}
        />
        <Scatter dataKey="conversions" radius={4} strokeWidth={0} />
        <XAxis numTicks={5} formatValue={(value: Date) => value.toDateString()} />
        <ChartTooltip enabled showDatePill showCrosshair showDots />
      </ScatterChart>
    </>
  );
}
