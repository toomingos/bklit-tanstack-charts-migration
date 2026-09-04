// Scatter hover-dot scene assembly extracted from scatter-hover-dot-mark.ts.
// Resolves per-datum hover-dot points and nodes over the shared projected channels.
import type {
  ChartPoint,
  MarkRenderContext,
  MarkScene,
  SceneNode,
} from "@tanstack/charts";
import { resolveProjectedDatum } from "./scatter-marks";
import type { ChartDatum } from "./types";
import type { ResolvedSeries } from "./scatter-marks";
import type { HoverDotChannels, HoverDotStyle } from "./scatter-hover-dot-mark";

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

export {
  buildHoverDotNode,
  buildHoverDotPoint,
  renderHoverDotScene,
  resolveHoverDotDatum,
};
export type {
  BuildHoverDotNodeParams,
  HoverDotDatum,
  HoverDotPointParams,
  RenderHoverDotSceneParams,
  ResolveHoverDotDatumParams,
};
