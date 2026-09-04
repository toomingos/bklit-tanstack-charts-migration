// Shared native tooltip-extension config + series panel-body builders.
import type { CSSProperties, ReactNode } from "react";
import type { ChartTooltipBodyRenderContext } from "@tanstack/react-charts/tooltip";
import type {
  ChartPoint,
  ChartTooltipAnchorContext,
  ChartTooltipOptions,
  ChartValue,
} from "@tanstack/charts";
import { tooltip } from "@tanstack/charts/tooltip";
import { BOX_OFFSET } from "./design-tokens";
import { TooltipContent } from "./tooltip-components";
import type { ChartDatum, ChartTooltipConfig, ChartTooltipPoint, TooltipRow } from "./types";

// X-source mirrors dist/tooltip.js named sources (function form takes over).
type NativeTooltipAnchorX<
  TDatum = unknown,
  TXValue extends ChartValue = ChartValue,
  TYValue extends ChartValue = ChartValue,
> =
  | "point"
  | "group-center"
  | "value"
  | ((
      points: readonly ChartPoint<TDatum, TXValue, TYValue>[],
      context: ChartTooltipAnchorContext<TDatum, TXValue, TYValue>
    ) => number);

// Isolated from resolveNativeAnchorX so the parent stays within max-statements;
// Hoisted to module scope so it is not reallocated per render.
const resolveGroupCenterX = <TDatum = unknown, TXValue extends ChartValue = ChartValue, TYValue extends ChartValue = ChartValue>(
  primaryX: number,
  points: readonly ChartPoint<TDatum, TXValue, TYValue>[]
): number => {
  let x1 = primaryX;
  let x2 = primaryX;
  for (const candidate of points) {
    x1 = Math.min(x1, candidate.x);
    x2 = Math.max(x2, candidate.x);
  }
  return (x1 + x2) / 2;
};

const resolveNativeAnchorX = <TDatum = unknown, TXValue extends ChartValue = ChartValue, TYValue extends ChartValue = ChartValue>(source: NativeTooltipAnchorX<TDatum, TXValue, TYValue>, points: readonly ChartPoint<TDatum, TXValue, TYValue>[], context: ChartTooltipAnchorContext<TDatum, TXValue, TYValue>): number => {
  const {primary} = context.focus;
  if (source === "point") {return primary.x;}
  if (source === "group-center") {return resolveGroupCenterX(primary.x, points);}
  if (source !== "value") {return source(points, context);}
// Viewport-aware via live x scale, falling back to pixel x.
  const scale = context.scales.x;
  const position = (scale.viewport?.map ?? scale.map)(primary.xValue);
  return Number.isFinite(position) ? position : primary.x;
}

// Parameterized over the axes the seven call sites vary on (spring, discrete gate,
// Anchor-x source, className); className has no default, undefined passes through.
interface NativeTooltipExtensionOptions<
  TDatum = unknown,
  TXValue extends ChartValue = ChartValue,
  TYValue extends ChartValue = ChartValue,
> {
  enabled: boolean;
  spring: Readonly<{ stiffness: number; damping: number }>;
// Beyond this, motion snaps instead of springing; live-line always passes false.
  discrete: boolean;
  className: string | undefined;
  offset?: number;
// Panel top always pins to plot top; only x varies per chart.
  anchorX: NativeTooltipAnchorX<TDatum, TXValue, TYValue>;
}

type NativeTooltipExtension<
  TDatum = unknown,
  TXValue extends ChartValue = ChartValue,
  TYValue extends ChartValue = ChartValue,
> = false | ({ use: typeof tooltip } & ChartTooltipOptions<TDatum, TXValue, TYValue>);

const buildNativeTooltipExtension = <TDatum = unknown, TXValue extends ChartValue = ChartValue, TYValue extends ChartValue = ChartValue>(options: Readonly<NativeTooltipExtensionOptions<TDatum, TXValue, TYValue>>): NativeTooltipExtension<TDatum, TXValue, TYValue> => {
  const { enabled, spring, discrete, className, offset = BOX_OFFSET, anchorX } = options;
  if (!enabled) {return false;}
  return {
    anchor: (points, context) => ({
      x: resolveNativeAnchorX(anchorX, points, context),
      y: context.plot.y - offset,
    }),
    className,
    motion: discrete
      ? (false as const)
      : { damping: spring.damping, stiffness: spring.stiffness, type: "spring" as const },
// Panel top = plot top via function anchor + bottom-right/bottom-left placement;
// Gap is the same offset value, so the two stay in sync.
    offset,
    placement: ["bottom-right", "bottom-left"] as const,
    sticky: false,
    use: tooltip,
  };
}

// Panel-wrapper body over caller-built rows + title; bar/candlestick/scatter bodies
// Differ structurally and stay local.
interface RenderSeriesTooltipBodyOptions<
  TXValue extends ChartValue = ChartValue,
  TYValue extends ChartValue = ChartValue,
> {
  tooltip: ChartTooltipConfig | null | undefined;
  buildRows: (
    datum: Readonly<ChartDatum>,
    ctx: ChartTooltipBodyRenderContext<ChartDatum, TXValue, TYValue>
  ) => TooltipRow[];
  resolveTitle: (
    datum: Readonly<ChartDatum>,
    ctx: ChartTooltipBodyRenderContext<ChartDatum, TXValue, TYValue>
  ) => string | undefined;
}

const buildPanelClassName = (cfg: ChartTooltipConfig | null | undefined): string => {
  const className = cfg?.className ?? "";
  return className.length > 0 ? `bkm-tooltip-panel ${className}` : "bkm-tooltip-panel";
};

const buildPanelStyle = (cfg: ChartTooltipConfig | null | undefined): CSSProperties => {
  const backgroundColor = cfg?.backgroundColor ?? "";
  const style: CSSProperties = { ...cfg?.panelStyle };
  if (backgroundColor.length > 0) {
    style.backgroundColor = backgroundColor;
  }
  return style;
};

// Panel chrome shared by both body-render paths; bundled so neither builder
// Exceeds max-params.
interface TooltipPanelParams {
  readonly panelClassName: string;
  readonly panelStyle: CSSProperties;
}

interface CustomTooltipBodyParams<TXValue extends ChartValue = ChartValue, TYValue extends ChartValue = ChartValue> {
  primary: ChartPoint<ChartDatum, TXValue, TYValue>;
  datum: Readonly<ChartDatum>;
  panel: TooltipPanelParams;
}

// Custom `tooltip.content` render path; kept out of renderDefaultTooltipBody so
// Each stays comfortably under max-statements.
const renderCustomTooltipBody = <TXValue extends ChartValue = ChartValue, TYValue extends ChartValue = ChartValue>(
  content: (props: { point: ChartTooltipPoint; index: number }) => ReactNode,
  params: CustomTooltipBodyParams<TXValue, TYValue>
): ReactNode => (
  <div className={params.panel.panelClassName} style={params.panel.panelStyle}>
    {content({ index: params.primary.datumIndex, point: params.datum })}
  </div>
);

interface DefaultTooltipBodyParams<TXValue extends ChartValue = ChartValue, TYValue extends ChartValue = ChartValue> {
  ctx: ChartTooltipBodyRenderContext<ChartDatum, TXValue, TYValue>;
  buildRows: (datum: Readonly<ChartDatum>, ctx: ChartTooltipBodyRenderContext<ChartDatum, TXValue, TYValue>) => TooltipRow[];
  resolveTitle: (datum: Readonly<ChartDatum>, ctx: ChartTooltipBodyRenderContext<ChartDatum, TXValue, TYValue>) => string | undefined;
  cfg: ChartTooltipConfig | null | undefined;
  datum: Readonly<ChartDatum>;
  panel: TooltipPanelParams;
}

const renderDefaultTooltipBody = <TXValue extends ChartValue = ChartValue, TYValue extends ChartValue = ChartValue>(
  params: DefaultTooltipBodyParams<TXValue, TYValue>
): ReactNode => {
  const { ctx, buildRows, resolveTitle, cfg, datum, panel } = params;
  const title = resolveTitle(datum, ctx);
  const rows: TooltipRow[] = cfg?.rows ? cfg.rows(datum) : buildRows(datum, ctx);
  return (
    <div className={panel.panelClassName} style={panel.panelStyle}>
      <TooltipContent title={title} rows={rows}>
        {cfg?.children}
      </TooltipContent>
    </div>
  );
};

const renderSeriesTooltipBody = <TXValue extends ChartValue = ChartValue, TYValue extends ChartValue = ChartValue>(ctx: ChartTooltipBodyRenderContext<ChartDatum, TXValue, TYValue>, options: RenderSeriesTooltipBodyOptions<TXValue, TYValue>): ReactNode => {
  const primary = ctx.points.at(0);
  if (primary === undefined) {return false;}
  const {datum} = primary;
  const cfg = options.tooltip;
  const panel: TooltipPanelParams = { panelClassName: buildPanelClassName(cfg), panelStyle: buildPanelStyle(cfg) };
  return cfg?.content
    ? renderCustomTooltipBody(cfg.content, { datum, panel, primary })
    : renderDefaultTooltipBody({ buildRows: options.buildRows, cfg, ctx, datum, panel, resolveTitle: options.resolveTitle });
}

export { buildNativeTooltipExtension, renderSeriesTooltipBody };
export type { NativeTooltipAnchorX, NativeTooltipExtension, NativeTooltipExtensionOptions, RenderSeriesTooltipBodyOptions };
