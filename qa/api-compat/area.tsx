// Q2 API fixture: exercises migrated AreaChart public props; must typecheck (tsc --noEmit).
import * as React from "react";
import { curveLinear, curveNatural } from "d3-shape";
import {
  Area,
  AreaChart,
  ChartTooltip,
  Grid,
  XAxis,
  type ChartPhase,
  type ChartStatus,
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

export function AreaChartApiFixture() {
  const status: ChartStatus = "ready";
  const onPhaseChange = (phase: ChartPhase): void => {
    void phase;
  };

  return (
    <>
      <AreaChart data={data} animationDuration={1100} onPhaseChange={onPhaseChange}>
        <Grid horizontal />
        <Area
          dataKey="seriesA"
          curve={curveNatural}
          strokeWidth={2.5}
          fillOpacity={0.4}
        />
        <XAxis />
        <ChartTooltip />
      </AreaChart>

      <AreaChart
        data={data}
        xDataKey="date"
        status={status}
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
        <Area
          dataKey="seriesA"
          stroke="var(--chart-line-primary)"
          strokeWidth={2}
          fill="var(--chart-line-primary)"
          fillOpacity={0.4}
          curve={curveLinear}
          fadeEdges
          showHighlight
        />
        <Area
          dataKey="seriesB"
          fadeEdges={false}
          showHighlight={false}
        />
        <XAxis numTicks={5} formatValue={(value: Date) => value.toDateString()} />
        <ChartTooltip enabled showDatePill showCrosshair showDots />
      </AreaChart>
    </>
  );
}
