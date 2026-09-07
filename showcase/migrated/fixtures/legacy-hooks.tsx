import { renderToString } from "react-dom/server";
import type { ReactElement } from "react";
import { defineChart, lineY } from "@tanstack/charts";
import { scaleLinear, scaleUtc } from "d3-scale";
import { ChartHost } from "@/migrated/charts/internal/chart-host";
import { buildTimeScale } from "@/migrated/charts/internal/chart-host-store";
import {
  useChart,
  useChartHover,
  useChartStable,
  useYScale,
} from "@/migrated/charts/internal/chart-context";
import type {
  ChartContextValue,
  ChartHoverContextValue,
  ChartStableContextValue,
  LineConfig,
  Margin,
  TooltipData,
} from "@/migrated/charts/internal/chart-context";
import { useChartInteraction } from "@/migrated/charts/internal/use-chart-interaction";
import type { ChartSelection } from "@/migrated/charts/internal/use-chart-interaction";
import type {
  ChartContextValue as LegacyChartContextValue,
  ChartHoverContextValue as LegacyChartHoverContextValue,
  ChartSelection as LegacyChartSelection,
  ChartStableContextValue as LegacyChartStableContextValue,
  LineConfig as LegacyLineConfig,
  Margin as LegacyMargin,
  TooltipData as LegacyTooltipData,
  useChart as legacyUseChart,
  useChartHover as legacyUseChartHover,
  useChartInteraction as legacyUseChartInteraction,
  useChartStable as legacyUseChartStable,
  useYScale as legacyUseYScale,
} from "@showcase/bklit-charts";

// Compile-time equality between the migrated and legacy shapes.
type TypeEquality<First, Second> = [First] extends [Second]
  ? [Second] extends [First]
    ? true
    : false
  : false;

const chartContextMatches: TypeEquality<
  ChartContextValue,
  LegacyChartContextValue
> = true;
const hoverContextMatches: TypeEquality<
  ChartHoverContextValue,
  LegacyChartHoverContextValue
> = true;
const stableContextMatches: TypeEquality<
  ChartStableContextValue,
  LegacyChartStableContextValue
> = true;
const marginMatches: TypeEquality<Margin, LegacyMargin> = true;
const tooltipMatches: TypeEquality<TooltipData, LegacyTooltipData> = true;
const lineConfigMatches: TypeEquality<LineConfig, LegacyLineConfig> = true;
const selectionMatches: TypeEquality<ChartSelection, LegacyChartSelection> =
  true;
const useChartMatches: TypeEquality<
  ReturnType<typeof useChart>,
  ReturnType<typeof legacyUseChart>
> = true;
const useHoverMatches: TypeEquality<
  ReturnType<typeof useChartHover>,
  ReturnType<typeof legacyUseChartHover>
> = true;
const useStableMatches: TypeEquality<
  ReturnType<typeof useChartStable>,
  ReturnType<typeof legacyUseChartStable>
> = true;
const useYScaleMatches: TypeEquality<
  ReturnType<typeof useYScale>,
  ReturnType<typeof legacyUseYScale>
> = true;
const useInteractionMatches: TypeEquality<
  ReturnType<typeof useChartInteraction>,
  ReturnType<typeof legacyUseChartInteraction>
> = true;

const DAY_ONE_MS = 86_400_000;
const DAY_TWO_MS = 172_800_000;
const DAY_THREE_MS = 259_200_000;
const FIXTURE_WIDTH = 640;
const FIXTURE_LABEL = "Legacy hooks";

interface FixtureRow {
  date: Date;
  value: number;
}

const FIXTURE_ROWS: FixtureRow[] = [
  { date: new Date(DAY_ONE_MS), value: 1 },
  { date: new Date(DAY_TWO_MS), value: 2 },
  { date: new Date(DAY_THREE_MS), value: 3 },
];

const fixtureDefinition = defineChart({
  marks: [lineY(FIXTURE_ROWS, { x: "date", y: "value" })],
  scales: { x: { scale: scaleUtc }, y: { scale: scaleLinear() } },
});

// Calls every exported hook so the fixture covers the legacy surface.
const Probe = (): ReactElement => {
  const chart = useChart();
  const hover = useChartHover();
  const stable = useChartStable();
  const yScale = useYScale();
  const interaction = useChartInteraction({
    bisectDate: () => 0,
    canInteract: true,
    data: chart.data,
    lines: stable.lines,
    margin: stable.margin,
    xAccessor: stable.xAccessor,
    xScale: stable.xScale,
    yScale: stable.yScale,
    yScales: stable.yScales,
  });
  const label = `${chart.data.length}:${stable.lines.length}:${
    hover.tooltipData === null ? "idle" : "hovering"
  }:${interaction.selection === null ? "free" : "selected"}:${yScale.domain().length}`;
  return <div>{label}</div>;
};

// Server render at the documented initial width; must contain real SVG.
const renderLegacyHooksHtml = (): string =>
  renderToString(
    <ChartHost
      buildXScale={buildTimeScale}
      ariaLabel={FIXTURE_LABEL}
      definition={fixtureDefinition}
      initialWidth={FIXTURE_WIDTH}
    >
      <Probe />
    </ChartHost>,
  );

export {
  chartContextMatches,
  hoverContextMatches,
  lineConfigMatches,
  marginMatches,
  renderLegacyHooksHtml,
  selectionMatches,
  stableContextMatches,
  tooltipMatches,
  useChartMatches,
  useHoverMatches,
  useInteractionMatches,
  useStableMatches,
  useYScaleMatches,
};
