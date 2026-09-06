// Loading placeholders as chart definitions (V3.9, sparkline silence).
// Geometry reuses legacy skeleton numbers; sweep is R10 paint on the marks.

import { defineChart } from "@tanstack/charts/scene";
import { createMarkWithScaleValues } from "@tanstack/charts/mark/scale-values";
import type { ChartMark, ChartPoint, DomChartDefinition, SceneNode } from "@tanstack/charts";
import { curveNatural } from "d3-shape";
import type { CurveFactory } from "d3-shape";
import { getSkeletonHeights, getSkeletonSigns } from "./skeleton-data";
import {
  buildLoadingAreaPath,
  buildLoadingLinePath,
  projectLoadingLinePoints,
} from "./line-loading-sweep";

// Shared definition surface for every placeholder (nothing owned twice).
const LOADING_DEFINITION_BASE = {
  focus: false,
  focusRing: false,
  guides: false,
  pointer: false,
  svgAnimation: false,
  tooltip: false,
} as const;

const PERCENT_SCALE = 100;
const DEFAULT_PLACEHOLDER_PAINT = "var(--foreground)";
const MIN_BAR_HEIGHT_PX = 1;
const DEFAULT_BAR_COUNT = 12;
const DEFAULT_BAR_FILL_OPACITY = 0.45;
const DEFAULT_BAR_FRACTION = 0.7;
const DEFAULT_BAR_CORNER_RADIUS = 2;
const DEFAULT_LINE_POINT_COUNT = 14;
const DEFAULT_LINE_STROKE_OPACITY = 0.5;
const DEFAULT_LINE_STROKE_WIDTH = 2.5;
const DEFAULT_AREA_STROKE_WIDTH = 2;
const AREA_FILL_TOP_OPACITY = 0.18;
const AREA_FILL_BOTTOM_OPACITY = 0.02;
const DEFAULT_HEATMAP_ROW_COUNT = 7;
const DEFAULT_HEATMAP_GAP_PX = 2;
const DEFAULT_HEATMAP_CORNER_RADIUS = 2;
const DEFAULT_HEATMAP_MIN_OPACITY = 0.25;
const DEFAULT_HEATMAP_OPACITY_SPAN = 0.55;

interface LoadingDefinitionMargin {
  readonly top?: number;
  readonly right?: number;
  readonly bottom?: number;
  readonly left?: number;
}

interface BarLoadingRows {
  readonly heights: readonly number[];
  readonly signs: readonly number[];
}

interface BarLoadingDefinitionOptions {
  readonly barCount?: number;
  readonly seed?: number;
  /** Solid or `url(#id)` paint; reduced-motion callers pass the solid base. */
  readonly fill?: string;
  readonly fillOpacity?: number;
  readonly barFraction?: number;
  readonly baseline?: "bottom" | "center";
  readonly cornerRadius?: number;
  readonly margin?: number | LoadingDefinitionMargin;
}

interface BarPlaceholderDatum {
  readonly index: number;
  readonly value: number;
}

const resolveBarLoadingRows = (options: Readonly<BarLoadingDefinitionOptions>): BarLoadingRows => {
  const barCount = options.barCount ?? DEFAULT_BAR_COUNT;
  const seed = options.seed ?? 0;
  return {
    heights: getSkeletonHeights(barCount, seed),
    signs: getSkeletonSigns(barCount, seed),
  };
};

const buildBarLoadingMark = (
  rows: BarLoadingRows,
  options: Readonly<BarLoadingDefinitionOptions>,
): ChartMark<BarPlaceholderDatum, number, number, never, never> => {
  const baseline = options.baseline ?? "bottom";
  const barFraction = options.barFraction ?? DEFAULT_BAR_FRACTION;
  const cornerRadius = options.cornerRadius ?? DEFAULT_BAR_CORNER_RADIUS;
  const fill = options.fill ?? DEFAULT_PLACEHOLDER_PAINT;
  const fillOpacity = options.fillOpacity ?? DEFAULT_BAR_FILL_OPACITY;
  const data: readonly BarPlaceholderDatum[] = rows.heights.map((value, index) => ({ index, value }));
  return createMarkWithScaleValues<BarPlaceholderDatum, number, number, never, never>(() => ({
    channels: {},
    id: "loading-bars",
    render: ({ chart }) => {
      const count = data.length;
      if (count === 0 || chart.width <= 0 || chart.height <= 0) {
        return { nodes: [], points: [] };
      }
      const isCenter = baseline === "center";
      const bandWidth = chart.width / count;
      const barWidth = bandWidth * barFraction;
      const xOffset = (bandWidth * (1 - barFraction)) / 2;
      const baselineY = chart.y + (isCenter ? chart.height / 2 : chart.height);
      const halfBarHeight = isCenter ? chart.height / 2 : chart.height;
      const nodes: SceneNode[] = data.map((datum) => {
        const sign = isCenter ? (rows.signs[datum.index] ?? 1) : 1;
        const barHeight = Math.max(MIN_BAR_HEIGHT_PX, (halfBarHeight * datum.value) / PERCENT_SCALE);
        return {
          height: barHeight,
          key: `loading-bars:bar:${datum.index}`,
          kind: "rect",
          radius: cornerRadius,
          style: { fill, fillOpacity },
          width: barWidth,
          x: chart.x + datum.index * bandWidth + xOffset,
          y: sign === 1 ? baselineY - barHeight : baselineY,
        };
      });
      const points: ChartPoint<BarPlaceholderDatum, number, number>[] = [];
      return { nodes, points };
    },
  }));
};

// Placeholder bars from skeleton heights; the sweep rides `fill` as `url(#id)`.
const buildBarLoadingDefinition = (
  options: Readonly<BarLoadingDefinitionOptions> = {},
): DomChartDefinition<BarPlaceholderDatum, number, number> => {
  const rows = resolveBarLoadingRows(options);
  return defineChart({
    ...LOADING_DEFINITION_BASE,
    ...(options.margin === undefined ? undefined : { margin: options.margin }),
    marks: [buildBarLoadingMark(rows, options)],
    scales: { x: null, y: null },
  });
};

interface LineLoadingDefinitionOptions {
  readonly pointCount?: number;
  readonly seed?: number;
  /** Explicit y values (plot percentages); default from the skeleton heights. */
  readonly values?: readonly number[];
  readonly curve?: CurveFactory;
  /** Solid or `url(#id)` paint; reduced-motion callers pass the solid base. */
  readonly stroke?: string;
  readonly strokeOpacity?: number;
  readonly strokeWidth?: number;
  /** Area wash under the line (the `<Area>` silhouette); off by default. */
  readonly withArea?: boolean;
  readonly areaFill?: string;
  readonly areaFillOpacity?: number;
  readonly margin?: number | LoadingDefinitionMargin;
}

interface LinePlaceholderDatum {
  readonly index: number;
  readonly value: number;
}

const resolveLineLoadingValues = (options: Readonly<LineLoadingDefinitionOptions>): readonly number[] => {
  if (options.values !== undefined) {
    return options.values;
  }
  return getSkeletonHeights(options.pointCount ?? DEFAULT_LINE_POINT_COUNT, options.seed ?? 0);
};

const buildLineLoadingMark = (
  values: readonly number[],
  options: Readonly<LineLoadingDefinitionOptions>,
): ChartMark<LinePlaceholderDatum, number, number, never, never> => {
  const curve = options.curve ?? curveNatural;
  const stroke = options.stroke ?? DEFAULT_PLACEHOLDER_PAINT;
  const strokeOpacity = options.strokeOpacity ?? DEFAULT_LINE_STROKE_OPACITY;
  const strokeWidth = options.strokeWidth ?? DEFAULT_LINE_STROKE_WIDTH;
  const withArea = options.withArea ?? false;
  const areaFill = options.areaFill ?? "transparent";
  const areaFillOpacity = options.areaFillOpacity ?? 0;
  const data: readonly LinePlaceholderDatum[] = values.map((value, index) => ({ index, value }));
  return createMarkWithScaleValues<LinePlaceholderDatum, number, number, never, never>(() => ({
    channels: {},
    id: withArea ? "loading-area" : "loading-line",
    render: ({ chart }) => {
      if (data.length < 2 || chart.width <= 0 || chart.height <= 0) {
        return { nodes: [], points: [] };
      }
      const segment = projectLoadingLinePoints(values, chart);
      const linePath = buildLoadingLinePath(segment, curve);
      const nodes: SceneNode[] = [];
      if (withArea) {
        const areaPath = buildLoadingAreaPath(segment, chart, curve);
        nodes.push({
          key: "loading-area:wash",
          kind: "area",
          path: areaPath,
          points: segment.map((point) => [point.x, point.y] as const),
          style: { fill: areaFill, fillOpacity: areaFillOpacity },
        });
      }
      nodes.push({
        key: "loading-line:segment:0",
        kind: "polyline",
        path: linePath,
        points: segment.map((point) => [point.x, point.y] as const),
        style: {
          fill: "none",
          lineCap: "round",
          lineJoin: "round",
          stroke,
          strokeOpacity,
          strokeWidth,
        },
      });
      const points: ChartPoint<LinePlaceholderDatum, number, number>[] = [];
      return { nodes, points };
    },
  }));
};

// Placeholder line (or area wash and line) from skeleton heights.
const buildLineLoadingDefinition = (
  options: Readonly<LineLoadingDefinitionOptions> = {},
): DomChartDefinition<LinePlaceholderDatum, number, number> => {
  const values = resolveLineLoadingValues(options);
  return defineChart({
    ...LOADING_DEFINITION_BASE,
    ...(options.margin === undefined ? undefined : { margin: options.margin }),
    marks: [buildLineLoadingMark(values, options)],
    scales: { x: null, y: null },
  });
};

interface AreaLoadingDefinitionOptions extends LineLoadingDefinitionOptions {
  readonly strokeWidth?: number;
  /** Solid base for the wash gradient stops (the sweep paint cannot color stops). */
  readonly washColor?: string;
}

// Placeholder area: the line silhouette with a native spec-gradient wash.
const buildAreaLoadingDefinition = (
  options: Readonly<AreaLoadingDefinitionOptions> = {},
): DomChartDefinition<LinePlaceholderDatum, number, number> => {
  const values = resolveLineLoadingValues(options);
  const stroke = options.stroke ?? DEFAULT_PLACEHOLDER_PAINT;
  const washColor = options.washColor ?? stroke;
  const areaGradientId = "loading-area-wash";
  return defineChart({
    ...LOADING_DEFINITION_BASE,
    ...(options.margin === undefined ? undefined : { margin: options.margin }),
    gradients: [
      {
        id: areaGradientId,
        stops: [
          { color: washColor, offset: 0, opacity: AREA_FILL_TOP_OPACITY },
          { color: washColor, offset: 1, opacity: AREA_FILL_BOTTOM_OPACITY },
        ],
        x1: 0,
        x2: 0,
        y1: 0,
        y2: 1,
      },
    ],
    marks: [
      buildLineLoadingMark(values, {
        ...options,
        areaFill: `url(#${areaGradientId})`,
        areaFillOpacity: 1,
        strokeWidth: options.strokeWidth ?? DEFAULT_AREA_STROKE_WIDTH,
        withArea: true,
      }),
    ],
    scales: { x: null, y: null },
  });
};

interface HeatmapLoadingDefinitionOptions {
  readonly columnCount: number;
  readonly rowCount?: number;
  readonly seed?: number;
  /** Solid or `url(#id)` paint; reduced-motion callers pass the solid base. */
  readonly fill?: string;
  readonly gap?: number;
  readonly cornerRadius?: number;
  readonly margin?: number | LoadingDefinitionMargin;
}

interface HeatmapPlaceholderDatum {
  readonly column: number;
  readonly row: number;
  readonly value: number;
}

interface HeatmapLoadingFrame {
  readonly data: readonly HeatmapPlaceholderDatum[];
  readonly columnCount: number;
  readonly rowCount: number;
  readonly gap: number;
  readonly cornerRadius: number;
  readonly fill: string;
}

const buildHeatmapLoadingMark = (
  frame: Readonly<HeatmapLoadingFrame>,
): ChartMark<HeatmapPlaceholderDatum, number, number, never, never> =>
  createMarkWithScaleValues<HeatmapPlaceholderDatum, number, number, never, never>(() => ({
    channels: {},
    id: "loading-cells",
    render: ({ chart }) => {
      if (frame.data.length === 0 || chart.width <= 0 || chart.height <= 0) {
        return { nodes: [], points: [] };
      }
      const cellWidth = (chart.width - frame.gap * (frame.columnCount - 1)) / frame.columnCount;
      const cellHeight = (chart.height - frame.gap * (frame.rowCount - 1)) / frame.rowCount;
      if (cellWidth <= 0 || cellHeight <= 0) {
        return { nodes: [], points: [] };
      }
      const nodes: SceneNode[] = frame.data.map((datum) => ({
        height: cellHeight,
        key: `loading-cells:cell:${datum.column}:${datum.row}`,
        kind: "rect",
        radius: frame.cornerRadius,
        style: {
          fill: frame.fill,
          fillOpacity:
            DEFAULT_HEATMAP_MIN_OPACITY + (datum.value / PERCENT_SCALE) * DEFAULT_HEATMAP_OPACITY_SPAN,
        },
        width: cellWidth,
        x: chart.x + datum.column * (cellWidth + frame.gap),
        y: chart.y + datum.row * (cellHeight + frame.gap),
      }));
      const points: ChartPoint<HeatmapPlaceholderDatum, number, number>[] = [];
      return { nodes, points };
    },
  }));

// Placeholder heatmap: a deterministic rect grid; the sweep rides `fill`.
const buildHeatmapLoadingDefinition = (
  options: Readonly<HeatmapLoadingDefinitionOptions>,
): DomChartDefinition<HeatmapPlaceholderDatum, number, number> => {
  const rowCount = options.rowCount ?? DEFAULT_HEATMAP_ROW_COUNT;
  const seed = options.seed ?? 0;
  const values = getSkeletonHeights(options.columnCount * rowCount, seed);
  const frame: HeatmapLoadingFrame = {
    columnCount: options.columnCount,
    cornerRadius: options.cornerRadius ?? DEFAULT_HEATMAP_CORNER_RADIUS,
    data: values.map((value, index) => ({
      column: Math.floor(index / rowCount),
      row: index % rowCount,
      value,
    })),
    fill: options.fill ?? DEFAULT_PLACEHOLDER_PAINT,
    gap: options.gap ?? DEFAULT_HEATMAP_GAP_PX,
    rowCount,
  };
  return defineChart({
    ...LOADING_DEFINITION_BASE,
    ...(options.margin === undefined ? undefined : { margin: options.margin }),
    marks: [buildHeatmapLoadingMark(frame)],
    scales: { x: null, y: null },
  });
};

export {
  buildAreaLoadingDefinition,
  buildBarLoadingDefinition,
  buildHeatmapLoadingDefinition,
  buildLineLoadingDefinition,
};
export type {
  AreaLoadingDefinitionOptions,
  BarLoadingDefinitionOptions,
  BarPlaceholderDatum,
  HeatmapLoadingDefinitionOptions,
  HeatmapPlaceholderDatum,
  LineLoadingDefinitionOptions,
  LinePlaceholderDatum,
  LoadingDefinitionMargin,
};
