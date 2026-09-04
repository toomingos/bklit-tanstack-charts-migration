// Q2 API fixture: exercises migrated ComposedChart public props; must typecheck (tsc --noEmit).
// `stacked` is accepted for parity but always renders unstacked.
import * as React from "react";
import { curveLinear, curveNatural } from "d3-shape";
import {
  Area,
  ChartTooltip,
  ComposedChart,
  Grid,
  Line,
  SeriesBar,
  XAxis,
  type ChartPhase,
} from "@migrated/charts";

interface Row {
  date: Date;
  bars: number;
  area: number;
  line: number;
  [key: string]: unknown;
}

const data: Row[] = [
  { date: new Date("2026-01-01"), bars: 10, area: 20, line: 20 },
  { date: new Date("2026-01-02"), bars: 15, area: 18, line: 18 },
];

export function ComposedChartApiFixture() {
  const onPhaseChange = (phase: ChartPhase): void => {
    void phase;
  };

  return (
    <>
      {/* Area and Line share one dataKey ("line"): bklit's own upsertLineConfig quirk, kept verbatim. */}
      <ComposedChart data={data} onPhaseChange={onPhaseChange}>
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

      <ComposedChart
        data={data}
        xDataKey="date"
        animationDuration={1100}
        margin={{ top: 40, right: 40, bottom: 40, left: 40 }}
        aspectRatio="2 / 1"
        className="chart"
        barSize={16}
        maxBarSize={24}
        barGap={4}
        stacked={false}
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
        <SeriesBar
          dataKey="bars"
          fill="var(--chart-1)"
          stroke="var(--chart-1)"
          radius={2}
          fadedOpacity={0.3}
        />
        <Area
          dataKey="area"
          stroke="var(--chart-line-primary)"
          strokeWidth={2}
          fill="var(--chart-line-primary)"
          fillOpacity={0.4}
          curve={curveLinear}
          showHighlight
        />
        <Line
          dataKey="area"
          stroke="var(--chart-2)"
          strokeWidth={2.5}
          curve={curveLinear}
          showHighlight
        />
        <XAxis numTicks={5} formatValue={(value: Date) => value.toDateString()} />
        <ChartTooltip enabled showDatePill showCrosshair showDots />
      </ComposedChart>
    </>
  );
}
