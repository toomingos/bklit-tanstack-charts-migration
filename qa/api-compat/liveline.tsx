// Q2 API-compatibility fixture (research/05): exercises every public prop
// the migrated LiveLineChart supports at pilot scope (docs/LOG.md D22 — a
// NEW top-level component, not a LineChart variant; canonical demo path is
// repos/bklit-ui/apps/web/components/docs/live-line-chart-demo.tsx, see
// bench/app/src/scenarios/bklit-liveline.tsx's header for why the registry
// example itself is not the basis). Must typecheck with zero errors via
// `tsc --noEmit` (included from bench/app/tsconfig.json). Runtime smoke is
// covered by the bench scenarios (console-errors column in
// docs/BENCHMARKS.md must be 0).
import * as React from "react";
import { curveLinear } from "d3-shape";
import {
  ChartTooltip,
  LiveLine,
  LiveLineChart,
  LiveXAxis,
  LiveYAxis,
  type LiveLinePoint,
  type MomentumColors,
} from "@migrated/charts";

const data: LiveLinePoint[] = [
  { time: Date.now() / 1000 - 2, value: 100 },
  { time: Date.now() / 1000 - 1, value: 102 },
];

function formatUsd(v: number): string {
  return `$${v.toFixed(2)}`;
}

const momentumColors: MomentumColors = {
  up: "var(--chart-1)",
  down: "var(--chart-5)",
  flat: "var(--chart-line-primary)",
};

export function LiveLineChartApiFixture() {
  return (
    <>
      {/* Canonical demo path (live-line-chart-demo.tsx parity). */}
      <LiveLineChart data={data} value={102} window={30}>
        <LiveLine
          dataKey="value"
          formatValue={formatUsd}
          stroke="var(--chart-line-primary)"
        />
        <ChartTooltip
          content={({ point }) => {
            const val = typeof point.value === "number" ? point.value : 0;
            return <span>{formatUsd(val)}</span>;
          }}
          showDatePill={false}
        />
        <LiveXAxis />
        <LiveYAxis formatValue={formatUsd} position="left" />
      </LiveLineChart>

      {/* Full pilot prop surface. */}
      <LiveLineChart
        data={data}
        value={102}
        dataKey="value"
        window={30}
        numXTicks={6}
        nowOffsetUnits={1}
        exaggerate
        lerpSpeed={0.1}
        margin={{ top: 16, right: 16, bottom: 40, left: 56 }}
        paused={false}
        className="chart"
        style={{ height: 260 }}
      >
        <LiveLine
          dataKey="value"
          stroke="var(--chart-line-primary)"
          strokeWidth={2.5}
          curve={curveLinear}
          fill
          pulse
          dotSize={5}
          badge
          formatValue={formatUsd}
          momentumColors={momentumColors}
        />
        <ChartTooltip enabled showDatePill showCrosshair showDots />
        <LiveXAxis numTicks={6} formatTime={(t: number) => new Date(t).toISOString()} />
        <LiveYAxis
          minGap={40}
          position="left"
          formatValue={formatUsd}
          allowDecimals={false}
        />
      </LiveLineChart>

      {/* A second series — momentumColors unset (dot still recolors by
          momentum via the default triple; stroke does not), fill/pulse/badge
          all disabled. */}
      <LiveLineChart data={data} value={102} window={30}>
        <LiveLine dataKey="value" fill={false} pulse={false} badge={false} />
      </LiveLineChart>
    </>
  );
}
