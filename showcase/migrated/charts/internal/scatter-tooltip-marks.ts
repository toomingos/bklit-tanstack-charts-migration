import type { ChartMark } from "@tanstack/charts";
import { whenFocused } from "@tanstack/charts/focus/mark";
import { toIndicatorConfig } from "./tooltip-mappers";
import { resolveVerticalFadeSides } from "./fade-mask";
import type { ChartDatum, ExtractedChildren } from "./types";
import type { SpringConfig } from "./chart-config-context";
import { buildIndicatorMark, formatShortDateLabel } from "./focus-marks";
import { createHoverDotMark } from "./scatter-hover-dot-mark";
import { isString } from "./scatter-datum-utils";
import type { SeriesMarksProjector } from "./scatter-series-marks";

interface BuildCrosshairMarkParams {
  readonly crosshairGradientId: string;
  readonly discrete: boolean;
  readonly tooltip: ExtractedChildren["tooltip"];
  readonly tooltipSpring: Readonly<SpringConfig>;
}

const buildCrosshairMark = ({
  crosshairGradientId,
  discrete,
  tooltip,
  tooltipSpring,
}: Readonly<BuildCrosshairMarkParams>): ChartMark<ChartDatum, Date, number> | undefined => {
  // Bklit parity quirk: function indicatorColor is never invoked (string form only).
  if (!(tooltip?.enabled ?? false) || !(tooltip?.showCrosshair ?? true)) {return undefined;}
  const indicatorCfg = toIndicatorConfig(tooltip);
  const isDashed = Boolean(indicatorCfg.dasharray);
  const fadeSides = resolveVerticalFadeSides(isDashed ? "none" : (indicatorCfg.fadeEdges ?? "both"));
  const indicatorColorValue = isString(indicatorCfg.color) ? indicatorCfg.color : "var(--chart-crosshair)";
  const indicatorSpringCfg = indicatorCfg.springConfig ?? tooltipSpring;
  // Native crosshair maps legacy indicator geometry one-for-one; strokeOpacity 0.35 overridden to 1.
  return buildIndicatorMark({
    color: indicatorColorValue,
    columnWidth: indicatorCfg.columnWidth,
    dasharray: indicatorCfg.dasharray,
    discrete,
    gradientId: crosshairGradientId,
    span: indicatorCfg.span,
    spring: indicatorSpringCfg,
    strokeOpacity: 1,
    useGradient: !isDashed && fadeSides.any,
    width: indicatorCfg.width,
    xLabelFormat: (tooltip?.showDatePill ?? true) ? formatShortDateLabel : undefined,
  });
};

interface BuildHoverDotMarksParams extends SeriesMarksProjector {
  readonly tooltip: ExtractedChildren["tooltip"];
  readonly tooltipSpring: Readonly<SpringConfig>;
}

const buildHoverDotMarks = ({
  projectorFor,
  renderData,
  resolvedSeries,
  tooltip,
  tooltipSpring,
  xDataKey,
}: Readonly<BuildHoverDotMarksParams>): ChartMark<ChartDatum, Date, number>[] => {
  const marks: ChartMark<ChartDatum, Date, number>[] = [];
  for (const [seriesIndex, series] of resolvedSeries.entries()) {
    const projectY = projectorFor(series.yAxisId);
    marks.push(
      whenFocused(
        createHoverDotMark({ projectY, series, seriesIndex, source: renderData, tooltipCfg: tooltip, tooltipSpring, xDataKey }),
        { match: "group", retarget: true },
      ),
    );
  }
  return marks;
};

interface BuildTooltipMarksParams extends SeriesMarksProjector {
  readonly crosshairGradientId: string;
  readonly discrete: boolean;
  readonly tooltip: ExtractedChildren["tooltip"];
  readonly tooltipSpring: Readonly<SpringConfig>;
}

const buildTooltipMarks = ({
  crosshairGradientId,
  discrete,
  projectorFor,
  renderData,
  resolvedSeries,
  tooltip,
  tooltipSpring,
  xDataKey,
}: Readonly<BuildTooltipMarksParams>): ChartMark<ChartDatum, Date, number>[] => {
  if (!(tooltip?.enabled ?? false)) {return [];}
  const marks: ChartMark<ChartDatum, Date, number>[] = [];
  const crosshair = buildCrosshairMark({ crosshairGradientId, discrete, tooltip, tooltipSpring });
  if (crosshair !== undefined) {marks.push(crosshair);}
  if (tooltip?.showDots ?? true) {
    // Custom whenFocused group/retarget hover dots: legacy draws one enlarged dot per series at x.
    marks.push(...buildHoverDotMarks({ projectorFor, renderData, resolvedSeries, tooltip, tooltipSpring, xDataKey }));
  }
  return marks;
};

export { buildCrosshairMark, buildHoverDotMarks, buildTooltipMarks };
export type { BuildCrosshairMarkParams, BuildHoverDotMarksParams, BuildTooltipMarksParams };
