// T-C1: shared tooltip-config → visual-primitive-config mappers for the
// hover-chrome family (hover/bar/candlestick/scatter/live). Consolidates the
// near-verbatim per-module copies; `null`/undefined still yields `{}`, so
// every caller's "no tooltip config" path is unchanged.
import type { BoxConfig, DotConfig, IndicatorConfig } from "./tooltip-chrome";
import type { ChartTooltipConfig } from "./types";

/** Structural subset the mappers actually read. ChartTooltipConfig and
    live-hover-chrome's LiveHoverConfig both satisfy it — the one deliberate
    widening is indicatorFadeEdges (IndicatorConfig itself allows boolean). */
export type TooltipMapperSource = Omit<
  Partial<ChartTooltipConfig>,
  "indicatorFadeEdges"
> & {
  indicatorFadeEdges?: IndicatorConfig["fadeEdges"];
};

export function toDotConfig(cfg?: TooltipMapperSource | null): DotConfig {
  if (!cfg) return {};
  return {
    variant: cfg.dotVariant,
    size: cfg.dotSize,
    radiusFraction: cfg.dotRadiusFraction,
    scale: cfg.dotScale,
    strokeWidth: cfg.dotStrokeWidth,
    color: cfg.dotColor as DotConfig["color"],
  };
}

export function toIndicatorConfig(
  cfg?: TooltipMapperSource | null,
): IndicatorConfig {
  if (!cfg) return {};
  return {
    width: cfg.indicatorWidth,
    span: cfg.indicatorSpan,
    columnWidth: cfg.columnWidth,
    color: cfg.indicatorColor as IndicatorConfig["color"],
    dasharray: cfg.indicatorDasharray,
    fadeEdges: cfg.indicatorFadeEdges as IndicatorConfig["fadeEdges"],
    fadeLength: cfg.indicatorFadeLength,
    springConfig: cfg.springConfig,
  };
}

export function toBoxConfig(cfg?: TooltipMapperSource | null): BoxConfig {
  if (!cfg) return {};
  return {
    springConfig: cfg.springConfig,
    matchCrosshair: cfg.matchCrosshair,
    damping: cfg.damping,
    boxSpringConfig: cfg.boxSpringConfig,
    className: cfg.className,
    panelStyle: cfg.panelStyle,
    backgroundColor: cfg.backgroundColor,
    content: cfg.content,
    children: cfg.children,
    rows: cfg.rows,
  };
}
