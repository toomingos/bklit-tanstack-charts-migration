// T-C1: shared tooltip-config → visual-primitive-config mappers for the
// hover-chrome family (hover/bar/candlestick/scatter/live). Consolidates the
// near-verbatim per-module copies; `null`/undefined still yields `{}`, so
// every caller's "no tooltip config" path is unchanged.
// C3: the config interfaces (IndicatorConfig/DotConfig/BoxConfig) and the
// indicator-width resolvers moved here verbatim from tooltip-chrome.ts, which
// is deleted in C3 — this file is now their owner (live-hover-chrome remains
// the last builder-style consumer until C5).
import type * as React from "react";
import type { IndicatorFadeEdges } from "./fade-mask";
import type { SpringConfig } from "./chart-config-context";
import type {
  ChartTooltipConfig,
  ChartTooltipPoint,
  IndicatorWidth,
  TooltipRow,
} from "./types";

export type DotVariant = "dot" | "ring";

export function resolveIndicatorWidth(width: IndicatorWidth): number {
  if (typeof width === "number") return width;
  switch (width) {
    case "line": return 1;
    case "thin": return 2;
    case "medium": return 4;
    case "thick": return 8;
    default: return 1;
  }
}

export function resolveIndicatorPixelWidth(cfg: { width?: IndicatorWidth; span?: number; columnWidth?: number }): number {
  if (cfg.span !== undefined && cfg.columnWidth !== undefined) return cfg.span * cfg.columnWidth;
  return resolveIndicatorWidth(cfg.width ?? "line");
}

export interface IndicatorConfig {
  width?: IndicatorWidth;
  span?: number;
  columnWidth?: number;
  color?: string | ((point: Record<string, unknown>) => string);
  dasharray?: string;
  fadeEdges?: IndicatorFadeEdges | boolean;
  fadeLength?: number;
  springConfig?: SpringConfig;
}

export interface DotConfig {
  variant?: DotVariant;
  size?: number;
  radiusFraction?: number;
  scale?: number;
  strokeWidth?: number;
  color?: string | ((point: Record<string, unknown>, line: { dataKey: string; stroke?: string }) => string);
}

export interface BoxConfig {
  springConfig?: SpringConfig;
  matchCrosshair?: boolean;
  damping?: number;
  boxSpringConfig?: SpringConfig;
  className?: string;
  panelStyle?: React.CSSProperties;
  backgroundColor?: string;
  content?: (props: { point: ChartTooltipPoint; index: number }) => React.ReactNode;
  children?: React.ReactNode;
  rows?: (point: Record<string, unknown>) => TooltipRow[];
}

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

