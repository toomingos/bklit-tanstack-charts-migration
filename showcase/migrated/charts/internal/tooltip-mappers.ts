import type { CSSProperties, ReactNode } from "react";
import type { IndicatorFadeEdges } from "./fade-mask";
import type { SpringConfig } from "./chart-config-context";
import type { ChartDatum, ChartTooltipConfig, ChartTooltipPoint, IndicatorWidth, TooltipRow } from "./types";

type DotVariant = "dot" | "ring";

const INDICATOR_WIDTH_MEDIUM_PX = 4;
const INDICATOR_WIDTH_THICK_PX = 8;

const isNumericWidth = (width: IndicatorWidth): width is number => typeof width === "number";

const resolveIndicatorWidth = (width: IndicatorWidth): number => {
  if (isNumericWidth(width)) {return width;}
  switch (width) {
    case "line": { return 1;
    }
    case "thin": { return 2;
    }
    case "medium": { return INDICATOR_WIDTH_MEDIUM_PX;
    }
    case "thick": { return INDICATOR_WIDTH_THICK_PX;
    }
    default: { return 1;
    }
  }
};

const resolveIndicatorPixelWidth = (cfg: Readonly<{ width?: IndicatorWidth; span?: number; columnWidth?: number }>): number => {
  if (cfg.span !== undefined && cfg.columnWidth !== undefined) {return cfg.span * cfg.columnWidth;}
  return resolveIndicatorWidth(cfg.width ?? "line");
};

interface IndicatorConfig {
  width?: IndicatorWidth;
  readonly span?: number;
  readonly columnWidth?: number;
  readonly color?: string | ((point: Readonly<ChartDatum>) => string);
  readonly dasharray?: string;
  readonly fadeEdges?: IndicatorFadeEdges | boolean;
  readonly fadeLength?: number;
  readonly springConfig?: SpringConfig;
}

interface DotConfig {
  readonly variant?: DotVariant;
  readonly size?: number;
  readonly radiusFraction?: number;
  readonly scale?: number;
  strokeWidth?: number;
  readonly color?: string | ((point: Readonly<ChartDatum>, line: Readonly<{ dataKey: string; stroke?: string }>) => string);
}

interface BoxConfig {
  readonly springConfig?: SpringConfig;
  readonly matchCrosshair?: boolean;
  readonly damping?: number;
  readonly boxSpringConfig?: SpringConfig;
  readonly className?: string;
  readonly panelStyle?: CSSProperties;
  readonly backgroundColor?: string;
  readonly content?: (props: Readonly<{ point: Readonly<ChartTooltipPoint>; index: number }>) => ReactNode;
  readonly children?: ReactNode;
  readonly rows?: (point: Readonly<ChartDatum>) => TooltipRow[];
}

type TooltipMapperSource = Omit<
  Partial<ChartTooltipConfig>,
  "indicatorFadeEdges"
> & {
  indicatorFadeEdges?: IndicatorConfig["fadeEdges"];
};

/*
 * Read-views of the tooltip config: ChartTooltipConfig carries mutable fields, so mappers take these narrower views.
 * both ChartTooltipConfig and TooltipMapperSource remain assignable here.
 */
interface DotMapperSource {
  readonly dotColor?: string | ((point: Readonly<ChartDatum>, line: Readonly<{ dataKey: string; stroke?: string }>) => string);
  readonly dotRadiusFraction?: number;
  readonly dotScale?: number;
  readonly dotSize?: number;
  readonly dotStrokeWidth?: number;
  readonly dotVariant?: DotVariant;
}

interface IndicatorMapperSource {
  readonly columnWidth?: number;
  readonly indicatorColor?: string | ((point: Readonly<ChartDatum>) => string);
  readonly indicatorDasharray?: string;
  readonly indicatorFadeEdges?: IndicatorConfig["fadeEdges"];
  readonly indicatorFadeLength?: number;
  readonly indicatorSpan?: number;
  readonly indicatorWidth?: IndicatorWidth;
  readonly springConfig?: SpringConfig;
}

const toDotConfig = (cfg?: Readonly<DotMapperSource> | null): DotConfig => {
  if (!cfg) {return {};}
  return {
    color: cfg.dotColor,
    radiusFraction: cfg.dotRadiusFraction,
    scale: cfg.dotScale,
    size: cfg.dotSize,
    strokeWidth: cfg.dotStrokeWidth,
    variant: cfg.dotVariant,
  };
};

const toIndicatorConfig = (cfg?: Readonly<IndicatorMapperSource> | null): IndicatorConfig => {
  if (!cfg) {return {};}
  return {
    color: cfg.indicatorColor,
    columnWidth: cfg.columnWidth,
    dasharray: cfg.indicatorDasharray,
    fadeEdges: cfg.indicatorFadeEdges,
    fadeLength: cfg.indicatorFadeLength,
    span: cfg.indicatorSpan,
    springConfig: cfg.springConfig,
    width: cfg.indicatorWidth,
  };
};

export { resolveIndicatorWidth, resolveIndicatorPixelWidth, toDotConfig, toIndicatorConfig };
export type { DotVariant, IndicatorConfig, DotConfig, BoxConfig, TooltipMapperSource };
