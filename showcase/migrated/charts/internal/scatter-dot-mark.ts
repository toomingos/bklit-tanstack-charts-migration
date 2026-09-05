// Plain scatter dots mirror bklit MarkerCircles: each dot is one filled disc plus
// One stroked ring (and an outline when configured), never a single gradient dot.
import type {
  ChartMark,
  ChartMotionDefinition,
  ChartPoint,
  MarkRenderContext,
  MarkScene,
  SceneNode,
} from "@tanstack/charts";
import { createMark } from "@tanstack/charts";
import { toDate } from "./coerce-date";
import { isFiniteNumber } from "./scatter-datum-utils";
import type { ChartDatum } from "./types";
import type { ResolvedSeries } from "./scatter-marks";

interface ScatterDotChannels {
  readonly xValues: readonly (Date | undefined)[];
  readonly yValues: readonly (number | undefined)[];
}

interface BuildScatterDotChannelsParams {
  readonly projectY: (value: number) => number;
  readonly series: Readonly<ResolvedSeries>;
  readonly source: readonly Readonly<ChartDatum>[];
  readonly xDataKey: string;
}

const buildScatterDotChannels = ({
  projectY,
  series,
  source,
  xDataKey,
}: Readonly<BuildScatterDotChannelsParams>): ScatterDotChannels => {
  const xValues: (Date | undefined)[] = [];
  const yValues: (number | undefined)[] = [];
  for (const datum of source) {
    xValues.push(toDate(datum[xDataKey]) ?? undefined);
    const numericValue = datum[series.dataKey];
    yValues.push(isFiniteNumber(numericValue) ? projectY(numericValue) : undefined);
  }
  return { xValues, yValues };
};

interface ScatterDotGeometry {
  readonly discRadius: number;
  readonly hasOutline: boolean;
  readonly hasRing: boolean;
  readonly outlineColor: string;
  readonly outlineRadius: number;
  readonly ringRadius: number;
}

// Ring and outline strokes are centred on bklit's exact radii, so outer edges match.
// A uniform scale factor reproduces the active-highlight transform without SVG nesting.
const resolveScatterDotGeometry = (
  series: Readonly<ResolvedSeries>,
  scale: number,
): ScatterDotGeometry => {
  const hasRing = series.strokeWidth > 0;
  const ringOuter = hasRing
    ? series.radius + series.ringGap + series.strokeWidth
    : series.radius;
  const hasOutline = series.outlineWidth > 0;
  return {
    discRadius: series.radius * scale,
    hasOutline,
    hasRing,
    outlineColor: series.outlineColor ?? series.stroke,
    outlineRadius: (ringOuter + series.outlineWidth / 2) * scale,
    ringRadius: hasRing
      ? (series.radius + series.ringGap + series.strokeWidth / 2) * scale
      : 0,
  };
};

interface BuildScatterDotPointParams {
  readonly datum: Readonly<ChartDatum>;
  readonly datumIndex: number;
  readonly dateValue: Readonly<Date>;
  readonly markId: string;
  readonly projectedY: number;
  readonly series: Readonly<ResolvedSeries>;
  readonly x: number;
  readonly y: number;
}

const buildScatterDotPoint = ({
  datum,
  datumIndex,
  dateValue,
  markId,
  projectedY,
  series,
  x,
  y,
}: Readonly<BuildScatterDotPointParams>): ChartPoint<ChartDatum, Date, number> => ({
  color: series.fill,
  datum,
  datumIndex,
  group: null,
  groupLabel: markId,
  key: `${markId}:${datumIndex}`,
  markId,
  x,
  xValue: dateValue,
  y,
  yValue: projectedY,
});

interface BuildScatterDotNodesParams {
  readonly datumIndex: number;
  readonly geometry: Readonly<ScatterDotGeometry>;
  readonly markId: string;
  readonly point: Readonly<ChartPoint<ChartDatum, Date, number>>;
  readonly series: Readonly<ResolvedSeries>;
  readonly strokeWidth: number;
  readonly x: number;
  readonly y: number;
}

const buildScatterDotNodes = ({
  datumIndex,
  geometry,
  markId,
  point,
  series,
  strokeWidth,
  x,
  y,
}: Readonly<BuildScatterDotNodesParams>): readonly SceneNode[] => {
  const nodes: SceneNode[] = [];
  if (geometry.hasOutline) {
    nodes.push({
      key: `${markId}:outline:${datumIndex}`,
      kind: "dot",
      pointOwner: point,
      radius: geometry.outlineRadius,
      style: { fill: "none", stroke: geometry.outlineColor, strokeWidth: series.outlineWidth },
      x,
      y,
    });
  }
  nodes.push({
    key: `${markId}:null:${datumIndex}`,
    kind: "dot",
    pointOwner: point,
    radius: geometry.discRadius,
    style: { fill: series.fill, stroke: "none" },
    x,
    y,
  });
  if (geometry.hasRing) {
    nodes.push({
      key: `${markId}:ring:${datumIndex}`,
      kind: "dot",
      pointOwner: point,
      radius: geometry.ringRadius,
      style: { fill: "none", stroke: series.stroke, strokeWidth },
      x,
      y,
    });
  }
  return nodes;
};

interface ResolveScatterDotDatumParams {
  readonly channels: Readonly<ScatterDotChannels>;
  readonly datum: Readonly<ChartDatum>;
  readonly datumIndex: number;
  readonly geometry: Readonly<ScatterDotGeometry>;
  readonly markId: string;
  readonly scales: MarkRenderContext["scales"];
  readonly series: Readonly<ResolvedSeries>;
  readonly strokeWidth: number;
}

interface ScatterDotDatum {
  readonly nodes: readonly SceneNode[];
  readonly point: ChartPoint<ChartDatum, Date, number>;
}

const resolveScatterDotDatum = ({
  channels,
  datum,
  datumIndex,
  geometry,
  markId,
  scales,
  series,
  strokeWidth,
}: Readonly<ResolveScatterDotDatumParams>): ScatterDotDatum | undefined => {
  const dateValue = channels.xValues[datumIndex];
  const projectedY = channels.yValues[datumIndex];
  if (dateValue === undefined || projectedY === undefined) {return undefined;}
  const x = scales.x.map(dateValue);
  const y = scales.y.map(projectedY);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {return undefined;}
  const point = buildScatterDotPoint({
    dateValue, datum, datumIndex, markId, projectedY, series, x, y,
  });
  const nodes = buildScatterDotNodes({
    datumIndex, geometry, markId, point, series, strokeWidth, x, y,
  });
  return { nodes, point };
};

interface RenderScatterDotSceneParams {
  readonly channels: Readonly<ScatterDotChannels>;
  readonly geometry: Readonly<ScatterDotGeometry>;
  readonly markId: string;
  readonly scales: MarkRenderContext["scales"];
  readonly series: Readonly<ResolvedSeries>;
  readonly source: readonly Readonly<ChartDatum>[];
  readonly strokeWidth: number;
}

const renderScatterDotScene = ({
  channels,
  geometry,
  markId,
  scales,
  series,
  source,
  strokeWidth,
}: Readonly<RenderScatterDotSceneParams>): MarkScene<ChartDatum, Date, number> => {
  const nodes: SceneNode[] = [];
  const points: ChartPoint<ChartDatum, Date, number>[] = [];
  for (const [datumIndex, datum] of source.entries()) {
    const rendered = resolveScatterDotDatum({
      channels, datum, datumIndex, geometry, markId, scales, series, strokeWidth,
    });
    if (rendered !== undefined) {
      nodes.push(...rendered.nodes);
      points.push(rendered.point);
    }
  }
  return {
    nodes: [
      {
        ariaHidden: true,
        children: nodes,
        className: "ts-chart__dot",
        key: markId,
        kind: "group",
      },
    ],
    points,
  };
};

interface CreateScatterDotMarkParams {
  readonly markId: string;
  readonly motion: ChartMotionDefinition<ChartDatum> | false;
  readonly projectY: (value: number) => number;
  readonly scale: number;
  readonly series: Readonly<ResolvedSeries>;
  readonly source: readonly Readonly<ChartDatum>[];
  readonly xDataKey: string;
}

// One ChartPoint per datum feeds every node through pointOwner.
// Focus grouping and tooltip identity therefore match the dot mark this replaces.
const createScatterDotMark = ({
  markId,
  motion,
  projectY,
  scale,
  series,
  source,
  xDataKey,
}: Readonly<CreateScatterDotMarkParams>): ChartMark<ChartDatum, Date, number> => {
  const channels = buildScatterDotChannels({ projectY, series, source, xDataKey });
  const geometry = resolveScatterDotGeometry(series, scale);
  const strokeWidth = series.strokeWidth * scale;
  return createMark(() => ({
    channels: {
      x: { scale: "x", values: channels.xValues },
      y: { scale: "y", values: channels.yValues },
    },
    id: markId,
    render: ({ scales }: Readonly<MarkRenderContext>) =>
      renderScatterDotScene({ channels, geometry, markId, scales, series, source, strokeWidth }),
  }), motion);
};

export {
  buildScatterDotChannels,
  buildScatterDotNodes,
  buildScatterDotPoint,
  createScatterDotMark,
  renderScatterDotScene,
  resolveScatterDotDatum,
  resolveScatterDotGeometry,
};
export type {
  BuildScatterDotChannelsParams,
  BuildScatterDotNodesParams,
  BuildScatterDotPointParams,
  CreateScatterDotMarkParams,
  RenderScatterDotSceneParams,
  ResolveScatterDotDatumParams,
  ScatterDotChannels,
  ScatterDotDatum,
  ScatterDotGeometry,
};
