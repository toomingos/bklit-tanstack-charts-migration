/*
 * Hover-dot carries datum identity for focus matching; function dotColor is invoked here,
 * unlike indicatorColor which is never evaluated (bklit parity).
 */
import type {
  ChartMark,
  ChartMotionDefinition,
  MarkRenderContext,
} from "@tanstack/charts";
import { toDotConfig } from "./tooltip-mappers";
import type { DotConfig, DotVariant } from "./tooltip-mappers";
import type { ChartDatum, ChartTooltipConfig } from "./types";
import type { SpringConfig } from "./chart-config-context";
import type { ResolvedSeries } from "./scatter-marks";
import { renderHoverDotScene } from "./scatter-hover-dot-scene";

// Default hover-dot size when the tooltip config omits it.
const HOVER_DOT_SIZE_DEFAULT = 5;
// Ring-variant hover-dot outline width when the tooltip config omits it.
const HOVER_RING_STROKE_WIDTH = 1.5;
// Ring corner-radius fraction of the dot side when the tooltip config omits it.
const HOVER_RING_RADIUS_FRACTION_DEFAULT = 0.25;
// Ring corner radius never exceeds half the dot side.
const SCATTER_CORNER_RADIUS_FRACTION_MAX = 0.5;

interface DotColorScope {
  readonly fill: string;
  readonly line: { readonly dataKey: string; readonly stroke?: string };
  readonly pointColor: string;
  readonly tooltip: Readonly<ChartTooltipConfig> | null | undefined;
}

const isString = <Value>(value: Value): value is Value & string => typeof value === "string";

const isNumber = <Value>(value: Value): value is Value & number => typeof value === "number";

const resolveDotColor = (
  scope: Readonly<DotColorScope>,
  point: Readonly<ChartDatum>,
  rowColor: string | undefined,
): string => {
  if (scope.tooltip?.rows && rowColor !== undefined && rowColor !== "") {return rowColor;}
  if (scope.tooltip?.dotColor !== undefined) {
    if (isString(scope.tooltip.dotColor)) {return scope.tooltip.dotColor;}
    return scope.tooltip.dotColor(point, scope.line);
  }
  return scope.fill || scope.pointColor;
};

const ringCornerRadius = (halfExtent: number, cornerRadiusFraction: number): number => {
  const side = halfExtent * 2;
  return side * Math.max(0, Math.min(SCATTER_CORNER_RADIUS_FRACTION_MAX, cornerRadiusFraction));
};

interface HoverDotStyle {
  readonly cornerRadius: number;
  readonly isRing: boolean;
  readonly side: number;
  readonly size: number;
  readonly strokeWidth: number;
}

const resolveHoverDotStyle = (dotCfg: Readonly<DotConfig>): HoverDotStyle => {
  const variant: DotVariant = dotCfg.variant ?? "dot";
  const isRing = variant === "ring";
  const rawSize = dotCfg.size ?? HOVER_DOT_SIZE_DEFAULT;
  const size = rawSize * (dotCfg.scale ?? 1);
  const strokeWidth = dotCfg.strokeWidth ?? (isRing ? HOVER_RING_STROKE_WIDTH : 2);
  const radiusFraction = dotCfg.radiusFraction ?? HOVER_RING_RADIUS_FRACTION_DEFAULT;
  return { cornerRadius: ringCornerRadius(size, radiusFraction), isRing, side: size * 2, size, strokeWidth };
};

interface HoverDotChannels {
  readonly colors: readonly string[];
  readonly xValues: readonly (Date | undefined)[];
  readonly yValues: readonly (number | undefined)[];
}

interface HoverDotDatumChannels {
  readonly color: string;
  readonly x: Date | undefined;
  readonly y: number | undefined;
}

interface ResolveHoverDotDatumChannelsParams {
  readonly datum: Readonly<ChartDatum>;
  readonly projectY: (value: number) => number;
  readonly scope: Readonly<DotColorScope>;
  readonly series: Readonly<ResolvedSeries>;
  readonly seriesIndex: number;
  readonly tooltipCfg: Readonly<ChartTooltipConfig> | null;
  readonly xDataKey: string;
}

const resolveHoverDotDatumChannels = ({
  datum,
  projectY,
  scope,
  series,
  seriesIndex,
  tooltipCfg,
  xDataKey,
}: Readonly<ResolveHoverDotDatumChannelsParams>): HoverDotDatumChannels => {
  const dateValue = datum[xDataKey];
  const numericValue = datum[series.dataKey];
  const tooltipRows = tooltipCfg?.rows ? tooltipCfg.rows(datum) : undefined;
  return {
    color: resolveDotColor(scope, datum, tooltipRows?.[seriesIndex]?.color),
    x: dateValue instanceof Date && Number.isFinite(dateValue.getTime()) ? dateValue : undefined,
    y: isNumber(numericValue) && Number.isFinite(numericValue) ? projectY(numericValue) : undefined,
  };
};

interface BuildHoverDotChannelsParams {
  readonly projectY: (value: number) => number;
  readonly scope: Readonly<DotColorScope>;
  readonly series: Readonly<ResolvedSeries>;
  readonly seriesIndex: number;
  readonly source: readonly ChartDatum[];
  readonly tooltipCfg: ChartTooltipConfig | null;
  readonly xDataKey: string;
}

const buildHoverDotChannels = ({
  projectY,
  scope,
  series,
  seriesIndex,
  source,
  tooltipCfg,
  xDataKey,
}: Readonly<BuildHoverDotChannelsParams>): HoverDotChannels => {
  const xValues: (Date | undefined)[] = [];
  const yValues: (number | undefined)[] = [];
  const colors: string[] = [];
  for (const datum of source) {
    const resolved = resolveHoverDotDatumChannels({ datum, projectY, scope, series, seriesIndex, tooltipCfg, xDataKey });
    xValues.push(resolved.x);
    yValues.push(resolved.y);
    colors.push(resolved.color);
  }
  return { colors, xValues, yValues };
};

interface CreateHoverDotMarkParams {
  readonly projectY: (value: number) => number;
  readonly series: Readonly<ResolvedSeries>;
  readonly seriesIndex: number;
  readonly source: readonly ChartDatum[];
  readonly tooltipCfg: ChartTooltipConfig | null;
  readonly tooltipSpring: Readonly<SpringConfig>;
  readonly xDataKey: string;
}

const createHoverDotMark = ({
  projectY,
  series,
  seriesIndex,
  source,
  tooltipCfg,
  tooltipSpring,
  xDataKey,
}: Readonly<CreateHoverDotMarkParams>): ChartMark<ChartDatum, Date, number> => {
  const style = resolveHoverDotStyle(toDotConfig(tooltipCfg));
  const motion: ChartMotionDefinition<ChartDatum> = {
    transition: { damping: tooltipSpring.damping, stiffness: tooltipSpring.stiffness, type: "spring" },
  };
  const scope: DotColorScope = { fill: series.fill, line: { dataKey: series.dataKey, stroke: series.fill }, pointColor: series.fill, tooltip: tooltipCfg };
  return {
    initialize: () => {
      const channels = buildHoverDotChannels({ projectY, scope, series, seriesIndex, source, tooltipCfg, xDataKey });
      return {
        channels: {
          x: { scale: "x", values: channels.xValues },
          y: { scale: "y", values: channels.yValues },
        },
        id: `${series.dataKey}--hover-dot`,
        motion,
        render: ({ scales }: MarkRenderContext) => renderHoverDotScene({ channels, scales, series, source, style }),
      };
    },
  };
};

export {
  buildHoverDotChannels,
  createHoverDotMark,
  resolveDotColor,
  resolveHoverDotDatumChannels,
  resolveHoverDotStyle,
  ringCornerRadius,
};
export type {
  BuildHoverDotChannelsParams,
  CreateHoverDotMarkParams,
  DotColorScope,
  HoverDotChannels,
  HoverDotDatumChannels,
  HoverDotStyle,
  ResolveHoverDotDatumChannelsParams,
};
export {
  buildHoverDotNode,
  buildHoverDotPoint,
  renderHoverDotScene,
  resolveHoverDotDatum,
} from "./scatter-hover-dot-scene";
export type {
  BuildHoverDotNodeParams,
  HoverDotDatum,
  HoverDotPointParams,
  RenderHoverDotSceneParams,
  ResolveHoverDotDatumParams,
} from "./scatter-hover-dot-scene";
