// Q2 API fixture: exercises migrated BarChart public props (grouped-vertical only); must typecheck (tsc --noEmit).
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
      <BarChart data={data} xDataKey="date" onPhaseChange={onPhaseChange}>
        <Grid horizontal />
        <Bar dataKey="seriesA" fill="var(--chart-line-primary)" lineCap="round" />
        <Bar dataKey="seriesB" fill="var(--chart-line-secondary)" lineCap="round" />
        <BarXAxis />
        <ChartTooltip />
      </BarChart>

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
