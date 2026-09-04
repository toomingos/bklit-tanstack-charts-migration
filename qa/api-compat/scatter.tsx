// Q2 API fixture: exercises migrated ScatterChart public props; must typecheck (tsc --noEmit).
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
      <ScatterChart data={data} onPhaseChange={onPhaseChange}>
        <Grid horizontal />
        <Scatter dataKey="sessions" />
        <Scatter dataKey="conversions" />
        <XAxis />
        <ChartTooltip />
      </ScatterChart>

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
