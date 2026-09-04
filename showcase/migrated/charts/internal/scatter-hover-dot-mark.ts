// Scatter hover-dot mark extracted from scatter-chart.tsx.
// Custom hover-dot mark: resolved pixels + source datum identity for focus matching.
// Bklit parity quirk: function dotColor IS invoked here (unlike indicatorColor, never evaluated).
import type {
  ChartMark,
  ChartMotionDefinition,
  ChartPoint,
  MarkRenderContext,
  MarkScene,
  SceneNode,
} from "@tanstack/charts";
import { toDotConfig } from "./tooltip-mappers";
import type { DotConfig, DotVariant } from "./tooltip-mappers";
import type { ChartDatum, ChartTooltipConfig } from "./types";
import type { SpringConfig } from "./chart-config-context";
import type { ResolvedSeries } from "./scatter-marks";
import { resolveProjectedDatum } from "./scatter-marks";

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

const isString = <T>(value: T): value is T & string => typeof value === "string";

const isNumber = <T>(value: T): value is T & number => typeof value === "number";

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

interface HoverDotPointParams {
  readonly color: string;
  readonly datum: ChartDatum;
  readonly datumIndex: number;
  readonly dateValue: Date;
  readonly projectedY: number;
  readonly series: Readonly<ResolvedSeries>;
  readonly x: number;
  readonly y: number;
}

const buildHoverDotPoint = ({
  color,
  datum,
  datumIndex,
  dateValue,
  projectedY,
  series,
  x,
  y,
}: Readonly<HoverDotPointParams>): ChartPoint<ChartDatum, Date, number> => ({
  color,
  datum,
  datumIndex,
  group: null,
  groupLabel: series.dataKey,
  key: `${series.dataKey}:${datumIndex}`,
  markId: series.dataKey,
  x,
  xValue: dateValue,
  y,
  yValue: projectedY,
});

interface BuildHoverDotNodeParams {
  readonly color: string;
  readonly point: Readonly<ChartPoint<ChartDatum, Date, number>>;
  readonly series: Readonly<ResolvedSeries>;
  readonly style: Readonly<HoverDotStyle>;
  readonly x: number;
  readonly y: number;
}

const buildHoverDotNode = ({ color, point, series, style, x, y }: Readonly<BuildHoverDotNodeParams>): SceneNode => {
  if (style.isRing) {
    return {
      height: style.side,
      key: `${series.dataKey}:hover-dot:${point.datumIndex}`,
      kind: "rect",
      pointOwner: point,
      radius: style.cornerRadius,
      style: { fill: "transparent", stroke: color, strokeWidth: style.strokeWidth },
      width: style.side,
      x: x - style.size,
      y: y - style.size,
    };
  }
  return {
    key: `${series.dataKey}:hover-dot:${point.datumIndex}`,
    kind: "dot",
    pointOwner: point,
    radius: style.size,
    style: { fill: color, stroke: "var(--chart-background)", strokeWidth: style.strokeWidth },
    x,
    y,
  };
};

interface HoverDotDatum {
  readonly node: SceneNode;
  readonly point: ChartPoint<ChartDatum, Date, number>;
}

interface ResolveHoverDotDatumParams {
  readonly channels: Readonly<HoverDotChannels>;
  readonly datum: ChartDatum;
  readonly datumIndex: number;
  readonly scales: MarkRenderContext["scales"];
  readonly series: Readonly<ResolvedSeries>;
  readonly style: Readonly<HoverDotStyle>;
}

const resolveHoverDotDatum = ({
  channels,
  datum,
  datumIndex,
  scales,
  series,
  style,
}: Readonly<ResolveHoverDotDatumParams>): HoverDotDatum | undefined => {
  const projected = resolveProjectedDatum({ channels, datumIndex });
  if (projected === undefined) {return undefined;}
  const x = scales.x.map(projected.dateValue);
  const y = scales.y.map(projected.projectedY);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {return undefined;}
  const color = channels.colors[datumIndex] ?? series.fill;
  const point = buildHoverDotPoint({ color, dateValue: projected.dateValue, datum, datumIndex, projectedY: projected.projectedY, series, x, y });
  return { node: buildHoverDotNode({ color, point, series, style, x, y }), point };
};

interface RenderHoverDotSceneParams {
  readonly channels: Readonly<HoverDotChannels>;
  readonly scales: MarkRenderContext["scales"];
  readonly series: Readonly<ResolvedSeries>;
  readonly source: readonly ChartDatum[];
  readonly style: Readonly<HoverDotStyle>;
}

const renderHoverDotScene = ({
  channels,
  scales,
  series,
  source,
  style,
}: Readonly<RenderHoverDotSceneParams>): MarkScene<ChartDatum, Date, number> => {
  const nodes: SceneNode[] = [];
  const points: ChartPoint<ChartDatum, Date, number>[] = [];
  for (const [datumIndex, datum] of source.entries()) {
    const rendered = resolveHoverDotDatum({ channels, datum, datumIndex, scales, series, style });
    if (rendered !== undefined) {
      nodes.push(rendered.node);
      points.push(rendered.point);
    }
  }
  return {
    nodes: [
      {
        ariaHidden: true,
        children: nodes,
        className: "bkm-chart__hover-dot",
        key: `${series.dataKey}--hover-dot`,
        kind: "group",
      },
    ],
    points,
  };
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
  buildHoverDotNode,
  buildHoverDotPoint,
  createHoverDotMark,
  renderHoverDotScene,
  resolveDotColor,
  resolveHoverDotDatum,
  resolveHoverDotDatumChannels,
  resolveHoverDotStyle,
  ringCornerRadius,
};
export type {
  BuildHoverDotChannelsParams,
  BuildHoverDotNodeParams,
  CreateHoverDotMarkParams,
  DotColorScope,
  HoverDotChannels,
  HoverDotDatum,
  HoverDotDatumChannels,
  HoverDotPointParams,
  HoverDotStyle,
  RenderHoverDotSceneParams,
  ResolveHoverDotDatumChannelsParams,
  ResolveHoverDotDatumParams,
};
