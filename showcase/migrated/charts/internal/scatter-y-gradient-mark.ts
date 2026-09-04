// Scatter Y-gradient mark extracted from scatter-marks.ts.
// YGradient paints per-point vertical color via a userSpaceOnUse gradient; one ChartPoint per datum.
import type {
  ChartMark,
  ChartMotionDefinition,
  ChartPoint,
  MarkRenderContext,
  MarkScene,
  SceneNode,
} from "@tanstack/charts";
import type { ChartDatum } from "./types";
import type { ResolvedSeries } from "./scatter-marks";
import { buildYGradientNodes, buildYGradientPoint } from "./scatter-y-gradient-nodes";

// Non-focused series dim via states (bklit inactiveOpacity); hovered group pops separately.
const HOVER_STATE_TRANSITION = {
  duration: 150,
  easing: "ease-in-out",
  type: "tween",
} as const;

const isNumber = <Subject>(value: Subject): value is Subject & number => typeof value === "number";

interface ProjectedDatumChannels {
  readonly xValues: readonly (Readonly<Date> | undefined)[];
  readonly yValues: readonly (number | undefined)[];
}

interface ProjectedDatum {
  readonly dateValue: Readonly<Date>;
  readonly projectedY: number;
}

interface ResolveProjectedDatumParams {
  readonly channels: Readonly<ProjectedDatumChannels>;
  readonly datumIndex: number;
}

const resolveProjectedDatum = ({
  channels,
  datumIndex,
}: Readonly<ResolveProjectedDatumParams>): ProjectedDatum | undefined => {
  const dateValue = channels.xValues[datumIndex];
  const projectedY = channels.yValues[datumIndex];
  if (dateValue === undefined || projectedY === undefined) {return undefined;}
  return { dateValue, projectedY };
};

interface YGradientChannels {
  readonly xValues: readonly (Readonly<Date> | undefined)[];
  readonly yValues: readonly (number | undefined)[];
}

interface BuildYGradientChannelsParams {
  readonly projectY: (value: number) => number;
  readonly series: Readonly<ResolvedSeries>;
  readonly source: readonly Readonly<ChartDatum>[];
  readonly xDataKey: string;
}

const buildYGradientChannels = ({
  projectY,
  series,
  source,
  xDataKey,
}: Readonly<BuildYGradientChannelsParams>): YGradientChannels => {
  const xValues: (Date | undefined)[] = [];
  const yValues: (number | undefined)[] = [];
  for (const datum of source) {
    const dateValue = datum[xDataKey];
    xValues.push(dateValue instanceof Date && Number.isFinite(dateValue.getTime()) ? dateValue : undefined);
    const numericValue = datum[series.dataKey];
    yValues.push(isNumber(numericValue) && Number.isFinite(numericValue) ? projectY(numericValue) : undefined);
  }
  return { xValues, yValues };
};

interface YGradientDatum {
  readonly nodes: readonly SceneNode[];
  readonly point: ChartPoint<ChartDatum, Date, number>;
}

interface ResolveYGradientDatumParams {
  readonly channels: Readonly<YGradientChannels>;
  readonly datum: Readonly<ChartDatum>;
  readonly datumIndex: number;
  readonly discRadius: number;
  readonly fillUrl: string;
  readonly hasRing: boolean;
  readonly ringRadius: number;
  readonly scales: MarkRenderContext["scales"];
  readonly series: Readonly<ResolvedSeries>;
}

const resolveYGradientDatum = ({
  channels,
  datum,
  datumIndex,
  discRadius,
  fillUrl,
  hasRing,
  ringRadius,
  scales,
  series,
}: Readonly<ResolveYGradientDatumParams>): YGradientDatum | undefined => {
  const projected = resolveProjectedDatum({ channels, datumIndex });
  if (projected === undefined) {return undefined;}
  const x = scales.x.map(projected.dateValue);
  const y = scales.y.map(projected.projectedY);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {return undefined;}
  const point = buildYGradientPoint({ dateValue: projected.dateValue, datum, datumIndex, fillUrl, projectedY: projected.projectedY, series, x, y });
  const nodes = buildYGradientNodes({ datumIndex, discRadius, fillUrl, hasRing, point, ringRadius, series, x, y });
  return { nodes, point };
};

interface RenderYGradientSceneParams {
  readonly channels: Readonly<YGradientChannels>;
  readonly discRadius: number;
  readonly fillUrl: string;
  readonly hasRing: boolean;
  readonly ringRadius: number;
  readonly scales: MarkRenderContext["scales"];
  readonly series: Readonly<ResolvedSeries>;
  readonly source: readonly Readonly<ChartDatum>[];
}

const renderYGradientScene = ({
  channels,
  discRadius,
  fillUrl,
  hasRing,
  ringRadius,
  scales,
  series,
  source,
}: Readonly<RenderYGradientSceneParams>): MarkScene<ChartDatum, Date, number> => {
  const nodes: SceneNode[] = [];
  const points: ChartPoint<ChartDatum, Date, number>[] = [];
  for (const [datumIndex, datum] of source.entries()) {
    const rendered = resolveYGradientDatum({
      channels,
      datum,
      datumIndex,
      discRadius,
      fillUrl,
      hasRing,
      ringRadius,
      scales,
      series,
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
        key: series.dataKey,
        kind: "group",
      },
    ],
    points,
  };
};

interface CreateYGradientScatterMarkParams {
  readonly motion: ChartMotionDefinition<ChartDatum>;
  readonly projectY: (value: number) => number;
  readonly series: Readonly<ResolvedSeries>;
  readonly source: readonly Readonly<ChartDatum>[];
  readonly xDataKey: string;
}

const createYGradientScatterMark = ({
  motion,
  projectY,
  series,
  source,
  xDataKey,
}: Readonly<CreateYGradientScatterMarkParams>): ChartMark<ChartDatum, Date, number> => {
  const hasRing = series.strokeWidth > 0;
  const discRadius = series.radius;
  const ringRadius = hasRing ? series.radius + series.ringGap + series.strokeWidth / 2 : 0;
  const fillUrl = `url(#${series.yGradId})`;
  return {
    initialize: () => {
      const channels = buildYGradientChannels({ projectY, series, source, xDataKey });
      return {
        channels: {
          x: { scale: "x", values: channels.xValues },
          y: { scale: "y", values: channels.yValues },
        },
        id: series.dataKey,
        motion,
        render: ({ scales }: Readonly<MarkRenderContext>) =>
          renderYGradientScene({ channels, discRadius, fillUrl, hasRing, ringRadius, scales, series, source }),
        // States.r replaces radius wholesale (no per-sibling pop); yGradient skips the r x1.35 highlight.
        states: series.fadeOnHover
          ? {
              data: source,
              definitions: [
                {
                  style: { opacity: series.inactiveOpacity },
                  transition: HOVER_STATE_TRANSITION,
                  when: { focus: "unmatched" },
                },
              ],
            }
          : undefined,
      };
    },
  };
};

export {
  buildYGradientChannels,
  createYGradientScatterMark,
  renderYGradientScene,
  resolveProjectedDatum,
  resolveYGradientDatum,
};
export type {
  BuildYGradientChannelsParams,
  CreateYGradientScatterMarkParams,
  ProjectedDatum,
  ProjectedDatumChannels,
  RenderYGradientSceneParams,
  ResolveProjectedDatumParams,
  ResolveYGradientDatumParams,
  YGradientChannels,
  YGradientDatum,
};
export type { BuildYGradientNodesParams, BuildYGradientPointParams } from "./scatter-y-gradient-nodes";
