import { useMemo } from "react";
import { DEFAULT_MARGIN } from "./heatmap-context";
import type { HeatmapMargin } from "./heatmap-context";
import {
  buildHeatmapBrushYScale,
  buildHeatmapTimeXScale,
  computeHeatmapDimensions,
  filterHeatmapColumns,
  getHeatmapColumnXOffset,
  getHeatmapTimeExtent,
  normalizeHeatmapSeparatorConfig,
  resolveHeatmapSeparatorLayout,
  rotateHeatmapColumnBins,
} from "./heatmap-utils";
import type {
  HeatmapColumn,
  HeatmapColumnSeparatorsConfig,
  HeatmapDimensions,
  HeatmapSeparatorLayout,
  HeatmapWeekStartDay,
} from "./heatmap-utils";
import { buildHeatmapColorScaleFromStyles, buildHeatmapFillScale, resolveHeatmapLevelStyles } from "./heatmap-colors";
import type { HeatmapLevelColors, HeatmapLevelStyles } from "./heatmap-colors";

// Sibling split keeps heatmap-chart-inner.tsx under the file line-count limit.
// Memoisation shape and dependency arrays match the original single-file implementation.

const DEFAULT_WEEK_ROW_COUNT = 7;
const MIN_RENDERABLE_DIMENSION_PX = 10;

const useHeatmapMargin = (marginProp: Partial<HeatmapMargin> | undefined): HeatmapMargin => {
  const marginTop = marginProp?.top ?? DEFAULT_MARGIN.top;
  const marginRight = marginProp?.right ?? DEFAULT_MARGIN.right;
  const marginBottom = marginProp?.bottom ?? DEFAULT_MARGIN.bottom;
  const marginLeft = marginProp?.left ?? DEFAULT_MARGIN.left;
  return useMemo(
    () => ({ bottom: marginBottom, left: marginLeft, right: marginRight, top: marginTop }),
    [marginTop, marginRight, marginBottom, marginLeft],
  );
};

interface HeatmapColumnLayout {
  columns: HeatmapColumn[];
  rowCount: number;
  columnCount: number;
  separatorLayout: HeatmapSeparatorLayout | null;
}

interface HeatmapColumnLayoutInputs {
  readonly data: HeatmapColumn[];
  readonly xDomain: readonly [Readonly<Date>, Readonly<Date>] | undefined;
  readonly weekStartDay: HeatmapWeekStartDay;
  readonly separatorConfig: Readonly<HeatmapColumnSeparatorsConfig> | undefined;
}

const useHeatmapColumnLayout = (inputs: Readonly<HeatmapColumnLayoutInputs>): HeatmapColumnLayout => {
  const filtered = useMemo(() => filterHeatmapColumns(inputs.data, inputs.xDomain), [inputs.data, inputs.xDomain]);
  const columns = useMemo(() => rotateHeatmapColumnBins(filtered, inputs.weekStartDay), [filtered, inputs.weekStartDay]);
  const normalizedSeparatorConfig = useMemo(
    () => normalizeHeatmapSeparatorConfig(inputs.separatorConfig),
    [inputs.separatorConfig],
  );
  const separatorLayout = useMemo(
    () => resolveHeatmapSeparatorLayout(normalizedSeparatorConfig, columns),
    [normalizedSeparatorConfig, columns],
  );
  const rowCount = columns[0]?.bins.length ?? DEFAULT_WEEK_ROW_COUNT;
  const columnCount = columns.length;
  return useMemo(
    () => ({ columnCount, columns, rowCount, separatorLayout }),
    [columnCount, columns, rowCount, separatorLayout],
  );
};

interface HeatmapDimensionsResult {
  dimensions: HeatmapDimensions;
  xScale: (columnIndex: number) => number;
  yScale: (rowIndex: number) => number;
  timeXScale: (date: Readonly<Date>) => number;
  brushYScale: (value: number) => number;
  isReady: boolean;
}

interface HeatmapDimensionsInputs {
  readonly containerWidth: number;
  readonly containerHeight: number;
  readonly margin: Readonly<HeatmapMargin>;
  readonly sizingColumnCount: number | undefined;
  readonly columnCount: number;
  readonly rowCount: number;
  readonly layout: "fluid" | "fill";
  readonly binSize: number;
  readonly separatorLayout: Readonly<HeatmapSeparatorLayout> | null;
  readonly columns: readonly HeatmapColumn[];
}

const useHeatmapDimensions = (params: Readonly<HeatmapDimensionsInputs>): HeatmapDimensionsResult => {
  const dimensions = useMemo(
    () =>
      computeHeatmapDimensions({
        binSize: params.binSize,
        columnCount: params.sizingColumnCount ?? params.columnCount,
        layout: params.layout,
        margin: params.margin,
        parentHeight: params.containerHeight,
        rowCount: params.rowCount,
        separator: params.separatorLayout,
        width: params.containerWidth,
      }),
    [
      params.containerWidth,
      params.containerHeight,
      params.margin,
      params.sizingColumnCount,
      params.columnCount,
      params.rowCount,
      params.layout,
      params.binSize,
      params.separatorLayout,
    ],
  );
  const xScale = useMemo(
    () =>
      (columnIndex: number): number =>
        columnIndex * dimensions.binWidth + getHeatmapColumnXOffset(columnIndex, params.separatorLayout),
    [dimensions.binWidth, params.separatorLayout],
  );
  const yScale = useMemo(
    () =>
      (rowIndex: number): number =>
        rowIndex * dimensions.binHeight,
    [dimensions.binHeight],
  );
  const timeExtent = useMemo(() => getHeatmapTimeExtent(params.columns), [params.columns]);
  const timeXScale = useMemo(() => buildHeatmapTimeXScale(timeExtent, dimensions.innerWidth), [timeExtent, dimensions.innerWidth]);
  const brushYScale = useMemo(() => buildHeatmapBrushYScale(dimensions.innerHeight), [dimensions.innerHeight]);
  const isReady = dimensions.width >= MIN_RENDERABLE_DIMENSION_PX && dimensions.height >= MIN_RENDERABLE_DIMENSION_PX;
  return useMemo(
    () => ({ brushYScale, dimensions, isReady, timeXScale, xScale, yScale }),
    [brushYScale, dimensions, isReady, timeXScale, xScale, yScale],
  );
};

interface HeatmapLayoutDimensions {
  columnLayout: HeatmapColumnLayout;
  dims: HeatmapDimensionsResult;
}

interface HeatmapLayoutDimensionsInputs {
  readonly data: HeatmapColumn[];
  readonly xDomain: readonly [Readonly<Date>, Readonly<Date>] | undefined;
  readonly weekStartDay: HeatmapWeekStartDay;
  readonly separatorConfig: Readonly<HeatmapColumnSeparatorsConfig> | undefined;
  readonly binSize: number;
  readonly containerHeight: number;
  readonly containerWidth: number;
  readonly layout: "fluid" | "fill";
  readonly sizingColumnCount: number | undefined;
}

/*
 * Local inputs shape avoids an import cycle back into heatmap-chart-inner.tsx.
 */
const useHeatmapLayoutDimensions = (
  inputs: Readonly<HeatmapLayoutDimensionsInputs>,
  margin: Readonly<HeatmapMargin>,
): HeatmapLayoutDimensions => {
  const columnLayout = useHeatmapColumnLayout({
    data: inputs.data,
    separatorConfig: inputs.separatorConfig,
    weekStartDay: inputs.weekStartDay,
    xDomain: inputs.xDomain,
  });
  const dims = useHeatmapDimensions({
    binSize: inputs.binSize,
    columnCount: columnLayout.columnCount,
    columns: columnLayout.columns,
    containerHeight: inputs.containerHeight,
    containerWidth: inputs.containerWidth,
    layout: inputs.layout,
    margin,
    rowCount: columnLayout.rowCount,
    separatorLayout: columnLayout.separatorLayout,
    sizingColumnCount: inputs.sizingColumnCount,
  });
  return { columnLayout, dims };
};

interface HeatmapColorScalesResult {
  resolvedLevelStyles: HeatmapLevelStyles;
  colorScale: (count: number) => string;
  fillScale: (count: number) => string;
}

const useHeatmapColorScales = (
  levelColors: Readonly<HeatmapLevelColors> | undefined,
  levelStyles: Readonly<HeatmapLevelStyles> | undefined,
  colorScaleProp: ((count: number) => string) | undefined,
): HeatmapColorScalesResult => {
  const resolvedLevelStyles = useMemo(() => resolveHeatmapLevelStyles(levelColors, levelStyles), [levelColors, levelStyles]);
  const colorScale = useMemo(
    () => colorScaleProp ?? buildHeatmapColorScaleFromStyles(resolvedLevelStyles),
    [colorScaleProp, resolvedLevelStyles],
  );
  const fillScale = useMemo(() => buildHeatmapFillScale(resolvedLevelStyles), [resolvedLevelStyles]);
  return useMemo(
    () => ({ colorScale, fillScale, resolvedLevelStyles }),
    [colorScale, fillScale, resolvedLevelStyles],
  );
};

export {
  MIN_RENDERABLE_DIMENSION_PX,
  useHeatmapMargin,
  useHeatmapLayoutDimensions,
  useHeatmapColorScales,
  type HeatmapColumnLayout,
  type HeatmapDimensionsResult,
  type HeatmapColorScalesResult,
};
