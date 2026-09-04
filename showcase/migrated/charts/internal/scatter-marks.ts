// Scatter shared series config, enter motion, and y-gradient mark extracted from scatter-chart.tsx.
// Enter is opacity-only with per-datum delay (leadingEdge/innerWidth fraction); blur has no channel.
// No scale/r enter existed in bklit (hidden/visible scale both 1); only hover pops r x1.35.
// YGradient paints per-point vertical color via a userSpaceOnUse gradient; one ChartPoint per datum.
import type {
  ChartMark,
  ChartMotionContext,
  ChartMotionDefinition,
  ChartPoint,
  MarkRenderContext,
  MarkScene,
  SceneNode,
} from "@tanstack/charts";
import type { MotionEasing } from "./reveal-easing";
import type { ChartDatum } from "./types";

// Seconds<->milliseconds conversion for enter-motion delay math.
const MS_PER_SECOND = 1000;
// Non-focused series dim via states (bklit inactiveOpacity); hovered group pops separately.
const HOVER_STATE_TRANSITION = {
  duration: 150,
  easing: "ease-in-out",
  type: "tween",
} as const;

const isNumber = <T>(value: T): value is T & number => typeof value === "number";

interface ResolvedSeries {
  readonly dataKey: string;
  /** Undefined means the default ("left") axis. */
  readonly yAxisId?: string | number;
  /** Animate && !isLoaded gate (bklit series-markers.tsx:104). */
  readonly animate: boolean;
  readonly fill: string;
  readonly stroke: string;
  readonly strokeWidth: number;
  readonly ringGap: number;
  readonly radius: number;
  readonly fadeOnHover: boolean;
  readonly inactiveOpacity: number;
  readonly inactiveBlur: number;
  readonly enterBlur: number;
  readonly showActiveHighlight: boolean;
  /** Hovered-marker outline ring has no native states channel; omitted. */
  readonly outlineWidth: number;
  readonly outlineColor?: string;
  readonly useYGradient: boolean;
  readonly yGradFrom: string;
  readonly yGradTo: string;
  readonly yGradId: string | undefined;
}

interface ScatterEnterMotionParams {
  readonly easing: MotionEasing;
  readonly fadeDurationMs: number;
  readonly innerWidth: number;
  readonly staggerDurationSec: number;
  readonly visualExtent: number;
}

const createScatterEnterMotion = ({
  easing,
  fadeDurationMs,
  innerWidth,
  staggerDurationSec,
  visualExtent,
}: Readonly<ScatterEnterMotionParams>): ChartMotionDefinition<ChartDatum> => (
  ctx: Readonly<ChartMotionContext<ChartDatum>>,
) => {
  if (ctx.phase !== "enter") {return false;}
  const cx = ctx.point?.x ?? 0;
  const leadingEdge = Math.max(0, cx - visualExtent);
  const delayMs =
    innerWidth > 0 ? (leadingEdge / innerWidth) * staggerDurationSec * MS_PER_SECOND : 0;
  return {
    delay: delayMs,
    transition: { duration: fadeDurationMs, easing, type: "tween" },
  };
};

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

interface BuildYGradientPointParams {
  readonly datum: Readonly<ChartDatum>;
  readonly datumIndex: number;
  readonly dateValue: Readonly<Date>;
  readonly fillUrl: string;
  readonly projectedY: number;
  readonly series: Readonly<ResolvedSeries>;
  readonly x: number;
  readonly y: number;
}

const buildYGradientPoint = ({
  datum,
  datumIndex,
  dateValue,
  fillUrl,
  projectedY,
  series,
  x,
  y,
}: Readonly<BuildYGradientPointParams>): ChartPoint<ChartDatum, Date, number> => ({
  color: fillUrl,
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

interface BuildYGradientNodesParams {
  readonly datumIndex: number;
  readonly discRadius: number;
  readonly fillUrl: string;
  readonly hasRing: boolean;
  readonly point: Readonly<ChartPoint<ChartDatum, Date, number>>;
  readonly ringRadius: number;
  readonly series: Readonly<ResolvedSeries>;
  readonly x: number;
  readonly y: number;
}

const buildYGradientNodes = ({
  datumIndex,
  discRadius,
  fillUrl,
  hasRing,
  point,
  ringRadius,
  series,
  x,
  y,
}: Readonly<BuildYGradientNodesParams>): readonly SceneNode[] => {
  const disc: SceneNode = {
    key: `${series.dataKey}:null:${datumIndex}`,
    kind: "dot",
    pointOwner: point,
    radius: discRadius,
    style: { fill: fillUrl, stroke: "none" },
    x,
    y,
  };
  if (!hasRing) {return [disc];}
  const ring: SceneNode = {
    key: `${series.dataKey}:ring:${datumIndex}`,
    kind: "dot",
    pointOwner: point,
    radius: ringRadius,
    style: { fill: "none", stroke: fillUrl, strokeWidth: series.strokeWidth },
    x,
    y,
  };
  return [disc, ring];
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
  buildYGradientNodes,
  buildYGradientPoint,
  createScatterEnterMotion,
  createYGradientScatterMark,
  renderYGradientScene,
  resolveProjectedDatum,
  resolveYGradientDatum,
};
export type {
  BuildYGradientChannelsParams,
  BuildYGradientNodesParams,
  BuildYGradientPointParams,
  CreateYGradientScatterMarkParams,
  ProjectedDatum,
  ProjectedDatumChannels,
  RenderYGradientSceneParams,
  ResolvedSeries,
  ResolveProjectedDatumParams,
  ResolveYGradientDatumParams,
  ScatterEnterMotionParams,
  YGradientChannels,
  YGradientDatum,
};
