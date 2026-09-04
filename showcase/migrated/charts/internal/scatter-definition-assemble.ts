import type { ChartMark, ChartScale, DomChartDefinition } from "@tanstack/charts";
import { defineChart } from "@tanstack/charts/scene";
import { buildFadeXAxisOptions, hiddenAxisOptions } from "./axis-ticks";
import { resolveGridGuide } from "./grid";
import { CHART_CATEGORY_PALETTE } from "./design-tokens";
import type { ChartDatum, ExtractedChildren } from "./types";
import type { SpringConfig } from "./chart-config-context";
import type { createScatterFocusStrategy } from "./scatter-focus-strategy";
import type { ScatterLabelFade } from "./scatter-pill-chrome";
import type { ChartMargin } from "./use-chart-margin";
import { buildScatterTooltipExtension } from "./scatter-tooltip-extension";

interface AssembleScatterDefinitionParams {
  readonly discrete: boolean;
  readonly grid: ExtractedChildren["grid"];
  readonly labelFade: ScatterLabelFade | null;
  readonly margin: ChartMargin;
  readonly scatterFocusStrategy: ReturnType<typeof createScatterFocusStrategy>;
  readonly seriesMarks: readonly ChartMark<ChartDatum, Date, number>[];
  readonly tooltip: ExtractedChildren["tooltip"];
  readonly tooltipBoxSpring: Readonly<SpringConfig>;
  readonly tooltipMarks: readonly ChartMark<ChartDatum, Date, number>[];
  readonly xAxis: ExtractedChildren["xAxis"];
  readonly xScale: ChartScale;
  readonly yScale: ChartScale;
}

const assembleScatterDefinition = ({
  discrete,
  grid,
  labelFade,
  margin,
  scatterFocusStrategy,
  seriesMarks,
  tooltip,
  tooltipBoxSpring,
  tooltipMarks,
  xAxis,
  xScale,
  yScale,
}: Readonly<AssembleScatterDefinitionParams>): DomChartDefinition<ChartDatum, Date, number> => {
  const marks = [...seriesMarks, ...tooltipMarks];
  const gridGuide = resolveGridGuide(grid);
  const spec = {
    margin,
    marks,
    // Tick counts reach guides only via axis.ticks.count; a bare ticks: key is never read.
    scales: {
      x: {
        axis: buildFadeXAxisOptions({ columnTicks: gridGuide.columnTicks, labelFade, marginBottom: margin.bottom, xAxis: xAxis ?? undefined }),
        grid: gridGuide.vertical,
        scale: xScale,
      },
      y: {
        // Scatter never drew y-axis labels; only the tick-driven grid count is native-configured.
        axis: hiddenAxisOptions(gridGuide.ticks),
        grid: gridGuide.horizontal,
        scale: yScale,
      },
    },
    // Scatter data updates always snap once loaded (tween-on-update is Line-only).
    svgAnimation: false as const,
    theme: { muted: "var(--color-chart-label, var(--chart-label))", palette: CHART_CATEGORY_PALETTE },
  } as const;
  const base = defineChart(spec);
  const withFocus = defineChart(base, {
    focus: scatterFocusStrategy,
    focusRing: false,
    maxFocusDistance: Number.POSITIVE_INFINITY,
  });
  if (!(tooltip?.enabled ?? false)) {return withFocus;}
  return defineChart(withFocus, {
    tooltip: buildScatterTooltipExtension({ discrete, tooltip, tooltipBoxSpring }),
  });
};

export { assembleScatterDefinition };
export type { AssembleScatterDefinitionParams };
