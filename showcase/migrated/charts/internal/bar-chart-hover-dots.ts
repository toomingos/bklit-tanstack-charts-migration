// Bar hover-dot mark: per-series focus dots projected from band scales.
// Split from bar-chart.tsx without behaviour change.
import type { ChartMark, ChartMotionDefinition, ChartPoint, InitializedMark, MarkRenderContext, MarkScene, SceneNode } from "@tanstack/charts";
import type { SpringConfig } from "./chart-config-context";
import { shortDateFmt } from "./formatters";
import { isFiniteNumber } from "./series-bar-scene";
import type { ChartDatum, ChartTooltipConfig } from "./types";

// Ring-dot corner radius caps at half the side (a full squircle at most).
const BAR_RING_CORNER_RADIUS_MAX_FRACTION = 0.5;

const isString = <Value,>(candidate: Value): candidate is Value & string => typeof candidate === "string";
const isNumber = <Value,>(candidate: Value): candidate is Value & number => typeof candidate === "number";

// Function-typed dotColor has no native per-frame channel; only static branches port.
interface ResolveBarDotColorParams {
  readonly tooltip: ChartTooltipConfig | null | undefined;
  readonly seriesColor: string;
  readonly seriesIndex: number;
  readonly tooltipRowColors: readonly (string | undefined)[] | undefined;
}

const resolveBarDotColor = ({
  tooltip,
  seriesColor,
  seriesIndex,
  tooltipRowColors,
}: Readonly<ResolveBarDotColorParams>): string => {
  const rowColor = tooltipRowColors?.[seriesIndex];
  if (tooltip?.rows && rowColor !== undefined && rowColor !== "") {return rowColor;}
  if (isString(tooltip?.dotColor)) {return tooltip.dotColor;}
  return seriesColor;
};

// TanStack y accessors require numbers but ChartDatum cells are unknown by contract;
// The domain scan only counts finite numbers, so anything else reads as baseline.
const numericBarCell = (datum: Readonly<ChartDatum>, dataKey: string): number => {
  const raw = datum[dataKey];
  return isFiniteNumber(raw) ? raw : 0;
}

const barRingCornerRadius = (halfExtent: number, cornerRadiusFraction: number): number => {
  const side = halfExtent * 2;
  return side * Math.max(0, Math.min(BAR_RING_CORNER_RADIUS_MAX_FRACTION, cornerRadiusFraction));
};

interface HoverDotChannelsParams {
  readonly source: readonly Readonly<ChartDatum>[];
  readonly series: { readonly dataKey: string };
  readonly categoryAccessor: (datum: Readonly<ChartDatum>) => string;
  readonly projectValueForKey: (raw: number) => number;
}

interface HoverDotChannels {
  readonly xValues: readonly (string | undefined)[];
  readonly yValues: readonly (number | undefined)[];
}

const buildHoverDotChannels = ({
  source,
  series,
  categoryAccessor,
  projectValueForKey,
}: Readonly<HoverDotChannelsParams>): HoverDotChannels => {
  const xValues: (string | undefined)[] = [];
  const yValues: (number | undefined)[] = [];
  for (const datum of source) {
    xValues.push(categoryAccessor(datum));
    const raw = datum[series.dataKey];
    yValues.push(isFiniteNumber(raw) ? projectValueForKey(raw) : undefined);
  }
  return { xValues, yValues };
};

const buildHoverDotMotion = (tooltipSpring: Readonly<SpringConfig>): ChartMotionDefinition<ChartDatum> => ({
  // Bklit parity: dots always spring; only fresh mounts snap (free via retarget).
  transition: { damping: tooltipSpring.damping, stiffness: tooltipSpring.stiffness, type: "spring" },
});

interface HoverDotDatumResult {
  readonly node: SceneNode;
  readonly point: ChartPoint<ChartDatum, string, number>;
}

const buildHoverDotPoint = ({
  datum,
  datumIndex,
  seriesKey,
  x,
  y,
  category,
  yv,
  fill,
}: {
  readonly datum: Readonly<ChartDatum>;
  readonly datumIndex: number;
  readonly seriesKey: string;
  readonly x: number;
  readonly y: number;
  readonly category: string;
  readonly yv: number;
  readonly fill: string;
}): ChartPoint<ChartDatum, string, number> => ({
  color: fill,
  datum,
  datumIndex,
  group: null,
  groupLabel: seriesKey,
  key: `${seriesKey}:${datumIndex}`,
  markId: seriesKey,
  x,
  xValue: category,
  y,
  yValue: yv,
});

interface HoverDotDatumParams {
  readonly datum: Readonly<ChartDatum>;
  readonly datumIndex: number;
  readonly seriesKey: string;
  readonly xValues: readonly (string | undefined)[];
  readonly yValues: readonly (number | undefined)[];
  readonly mapY: (value: number) => number;
  readonly bandStartForCategory: (category: string) => number;
  readonly groupOffsetX: number;
  readonly groupHalfWidth: number;
  readonly fill: string;
  readonly isRing: boolean;
  readonly side: number;
  readonly cornerRadius: number;
  readonly size: number;
  readonly strokeWidth: number;
}

interface HoverDotNodeParams {
  readonly seriesKey: string;
  readonly datumIndex: number;
  readonly point: ChartPoint<ChartDatum, string, number>;
  readonly x: number;
  readonly y: number;
  readonly fill: string;
  readonly isRing: boolean;
  readonly side: number;
  readonly cornerRadius: number;
  readonly size: number;
  readonly strokeWidth: number;
}

const buildHoverDotNode = ({
  seriesKey,
  datumIndex,
  point,
  x,
  y,
  fill,
  isRing,
  side,
  cornerRadius,
  size,
  strokeWidth,
}: Readonly<HoverDotNodeParams>): SceneNode => {
  if (isRing) {
    return {
      height: side,
      key: `${seriesKey}:hover-dot:${datumIndex}`,
      kind: "rect",
      pointOwner: point,
      radius: cornerRadius,
      style: { fill: "transparent", stroke: fill, strokeWidth },
      width: side,
      x: x - size,
      y: y - size,
    };
  }
  return {
    key: `${seriesKey}:hover-dot:${datumIndex}`,
    kind: "dot",
    pointOwner: point,
    radius: size,
    style: { fill, stroke: "var(--chart-background)", strokeWidth },
    x,
    y,
  };
};

const buildHoverDotDatum = ({
  datum,
  datumIndex,
  seriesKey,
  xValues,
  yValues,
  mapY,
  bandStartForCategory,
  groupOffsetX,
  groupHalfWidth,
  fill,
  isRing,
  side,
  cornerRadius,
  size,
  strokeWidth,
}: Readonly<HoverDotDatumParams>): HoverDotDatumResult | undefined => {
  const category = xValues[datumIndex];
  const yv = yValues[datumIndex];
  const y = yv === undefined ? Number.NaN : mapY(yv);
  const x = category === undefined ? Number.NaN : bandStartForCategory(category) + groupOffsetX + groupHalfWidth;
  if (category === undefined || yv === undefined || !Number.isFinite(x) || !Number.isFinite(y)) {
    return undefined;
  }
  const point = buildHoverDotPoint({ category, datum, datumIndex, fill, seriesKey, x, y, yv });
  const node = buildHoverDotNode({
    cornerRadius,
    datumIndex,
    fill,
    isRing,
    point,
    seriesKey,
    side,
    size,
    strokeWidth,
    x,
    y,
  });
  return { node, point };
};

interface BarHoverDotSceneParams {
  readonly source: readonly Readonly<ChartDatum>[];
  readonly seriesKey: string;
  readonly xValues: readonly (string | undefined)[];
  readonly yValues: readonly (number | undefined)[];
  readonly mapY: (value: number) => number;
  readonly bandStartForCategory: (category: string) => number;
  readonly groupOffsetX: number;
  readonly groupHalfWidth: number;
  readonly fill: string;
  readonly isRing: boolean;
  readonly side: number;
  readonly cornerRadius: number;
  readonly size: number;
  readonly strokeWidth: number;
}

interface BarHoverDotScene {
  readonly nodes: SceneNode[];
  readonly points: ChartPoint<ChartDatum, string, number>[];
}

const buildBarHoverDotScene = ({
  source,
  seriesKey,
  xValues,
  yValues,
  mapY,
  bandStartForCategory,
  groupOffsetX,
  groupHalfWidth,
  fill,
  isRing,
  side,
  cornerRadius,
  size,
  strokeWidth,
}: Readonly<BarHoverDotSceneParams>): BarHoverDotScene => {
  const nodes: SceneNode[] = [];
  const points: ChartPoint<ChartDatum, string, number>[] = [];
  for (const [datumIndex, datum] of source.entries()) {
    const built = buildHoverDotDatum({
      bandStartForCategory,
      cornerRadius,
      datum,
      datumIndex,
      fill,
      groupHalfWidth,
      groupOffsetX,
      isRing,
      mapY,
      seriesKey,
      side,
      size,
      strokeWidth,
      xValues,
      yValues,
    });
    if (built) {
      nodes.push(built.node);
      points.push(built.point);
    }
  }
  return { nodes, points };
};

// Dot x emits resolved pixels directly: per-series group offset is barY-layout-only, not a dot() channel.
interface BarHoverDotMarkParams {
  readonly source: readonly Readonly<ChartDatum>[];
  readonly series: { readonly dataKey: string };
  readonly categoryAccessor: (datum: Readonly<ChartDatum>) => string;
  readonly projectValueForKey: (raw: number) => number;
  readonly groupOffsetX: number;
  readonly groupHalfWidth: number;
  readonly fill: string;
  readonly dotMarker: { readonly size: number; readonly strokeWidth: number; readonly isRing: boolean; readonly radiusFraction: number };
  readonly tooltipSpring: Readonly<SpringConfig>;
}

const buildHoverDotGroupNode = (seriesKey: string, nodes: SceneNode[]): SceneNode => ({
  // App-owned mark groups use the bkm-chart__ prefix, not ts-chart__.
  ariaHidden: true,
  children: nodes,
  className: "bkm-chart__hover-dot",
  key: `${seriesKey}--hover-dot`,
  kind: "group",
});

interface BarHoverDotInitParams {
  readonly source: readonly Readonly<ChartDatum>[];
  readonly series: { readonly dataKey: string };
  readonly categoryAccessor: (datum: Readonly<ChartDatum>) => string;
  readonly projectValueForKey: (raw: number) => number;
  readonly groupOffsetX: number;
  readonly groupHalfWidth: number;
  readonly fill: string;
  readonly isRing: boolean;
  readonly side: number;
  readonly cornerRadius: number;
  readonly size: number;
  readonly strokeWidth: number;
  readonly motion: ChartMotionDefinition<ChartDatum>;
}

const buildHoverDotInitialState = ({
  source,
  series,
  categoryAccessor,
  projectValueForKey,
  groupOffsetX,
  groupHalfWidth,
  fill,
  isRing,
  side,
  cornerRadius,
  size,
  strokeWidth,
  motion,
}: Readonly<BarHoverDotInitParams>): InitializedMark<ChartDatum, string, number> => {
  const { xValues, yValues } = buildHoverDotChannels({ categoryAccessor, projectValueForKey, series, source });
  return {
    channels: {
      x: { scale: "x", values: xValues },
      y: { scale: "y", values: yValues },
    },
    id: `${series.dataKey}--hover-dot`,
    motion,
    render: ({ scales }: MarkRenderContext): MarkScene<ChartDatum, string, number> => {
      const mapY = (value: number): number => scales.y.map(value);
      // Package band map returns centers; dots place from band starts (V1.2/G6).
      const bandStartForCategory = (category: string): number => {
        const center = scales.x.map(category);
        const half = (scales.x.bandwidth || 0) / 2;
        return Number.isFinite(center) ? center - half : 0;
      };
      const scene = buildBarHoverDotScene({
        bandStartForCategory,
              cornerRadius,
        fill,
        groupHalfWidth,
        groupOffsetX,
        isRing,
        mapY,
        seriesKey: series.dataKey,
        side,
        size,
        source,
        strokeWidth,
        xValues,
        yValues,
      });
      return {
        nodes: [buildHoverDotGroupNode(series.dataKey, scene.nodes)],
        points: scene.points,
      };
    },
  };
};

const createBarHoverDotMark = ({
  source,
  series,
  categoryAccessor,
  projectValueForKey,
  groupOffsetX,
  groupHalfWidth,
  fill,
  dotMarker,
  tooltipSpring,
}: Readonly<BarHoverDotMarkParams>): ChartMark<ChartDatum, string, number> => {
  const { size, strokeWidth, isRing, radiusFraction } = dotMarker;
  const cornerRadius = barRingCornerRadius(size, radiusFraction);
  const side = size * 2;
  const motion = buildHoverDotMotion(tooltipSpring);
  return {
    initialize: () =>
      buildHoverDotInitialState({
              categoryAccessor,
        cornerRadius,
        fill,
        groupHalfWidth,
        groupOffsetX,
        isRing,
        motion,
        projectValueForKey,
        series,
        side,
        size,
        source,
        strokeWidth,
      }),
  };
};

/**
 * Bklit categoryAccessor: shortDateFmt for Date, else String.
 *
 * @param {string} xDataKey - Datum field holding the category value; Date values render via shortDateFmt.
 * @returns {(datum: Readonly<ChartDatum>) => string} Accessor returning the category label, or empty string for unrecognized values.
 */
const barCategoryAccessor = (xDataKey: string) => (datum: Readonly<ChartDatum>): string => {
  const value = datum[xDataKey];
  if (value instanceof Date) {return shortDateFmt.format(value);}
  if (isString(value)) {return value;}
  if (isNumber(value)) {return String(value);}
  return "";
};

export { barCategoryAccessor, createBarHoverDotMark, isNumber, isString, numericBarCell, resolveBarDotColor };
