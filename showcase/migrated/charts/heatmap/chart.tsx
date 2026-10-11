// Bklit HeatmapChart on TanStack Charts: `cell`/`rect` marks on band scales, chart-level `color` scale, host-attribute hover/focus dimming (gap #31), `tooltip`, per-datum `motion` delay.
// Grid arrows: host capture keydown + `interaction.setControlledFocus` (gap #34). Custom: Less/More legend, config carriers, pattern <defs> host (ResourceHost), loading label.
import { erase } from "../kit/cartesian/erased-types";
import { clearAttribute, writeAttribute } from "../kit/host-write";
import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { CSSProperties, FocusEvent as ReactFocusEvent, KeyboardEvent as ReactKeyboardEvent, NamedExoticComponent, ReactElement, ReactNode, RefObject } from "react";
import { useParentSizeMounted } from "../kit/size/parent-size-arm";
import { useFluidWidth } from "../kit/size/use-fluid-width";
import { RendererChart } from "../kit/tooltip/tooltip-leaf";
import { useKeyboardFocusHold } from "../kit/cartesian/keyboard-hold";
import { useInteractionHandle, useTapFocus } from "../kit/cartesian/touch-focus";
import type { InteractionHandle } from "../kit/cartesian/touch-focus";
import { isNumber } from "../kit/guards";
import { LoadingLabel } from "../kit/loading-label";
import { motion } from "@tanstack/charts/motion";
import type { ChartPoint, ChartRendererRenderContext } from "@tanstack/charts";
import { readChildren, propsFor } from "../kit/read-children";
import { warnUnrenderedChildren } from "../kit/stable-children";
import { ResourceHost } from "../kit/resource-host";
import { useSanitizedId } from "../kit/use-sanitized-id";
import { renderPatternPreset } from "../kit/pattern/pattern-preset-render";
import {
  DEFAULT_MARGIN,
  HeatmapContext,
  HeatmapInteractionProvider,
  HEATMAP_INACTIVE_OPACITY,
  createHeatmapHoverCoordinator,
  useHeatmapCoordinatorOptional,
} from "./context";
import type { ChartStatus, HeatmapHoverCoordinator, HeatmapContextValue, HeatmapMargin, HeatmapSeparatorStyle, HeatmapTooltipConfig } from "./context";
import {
  HEATMAP_DEFAULT_ENTER_DURATION_MS,
  HEATMAP_DEFAULT_ENTER_TRANSITION,
  HEATMAP_DEFAULT_LOADING_CELL_MAX_OPACITY,
  HEATMAP_DEFAULT_LOADING_CELL_RANDOMNESS,
  HEATMAP_HOVER_TRANSITION_MS,
  HEATMAP_LOADING_CHART_OPACITY,
} from "./motion";
import type { HeatmapEnterClock, HeatmapEnterTransition } from "./motion";
import {
  buildHeatmapColorScaleFromStyles,
  buildHeatmapFillScale,
  heatmapLevelPatternId,
  heatmapLevelPatternRenderOptions,
  isHeatmapLevelPattern,
  resolveHeatmapLevelStyles,
} from "./colors";
import type { HeatmapLevelColors, HeatmapLevelStyle, HeatmapLevelStyles } from "./colors";
import { filterHeatmapColumns, getHeatmapTimeExtent, resolveHeatmapDisplayRange, rotateHeatmapColumnBins } from "./columns";
import { getHeatmapDayLabels } from "./day-labels";
import { formatHeatmapContributionLabel, formatHeatmapTooltipDate, formatHeatmapTooltipWeekday } from "./format";
import { isHeatmapHoverEffectEnabled } from "./hover-style";
import { buildHeatmapSeparatorGradientStops, getHeatmapSeparatorLineY, normalizeHeatmapSeparatorConfig, resolveHeatmapSeparatorLayout } from "./separators";
import type { HeatmapColumn } from "./columns";
import type { HeatmapWeekStartDay } from "./day-labels";
import type { HeatmapSeparatorParsedConfig } from "./separators";
import type { HeatmapScene } from "./focus";
import { buildCellData, buildHeatmapDefinition, columnStartX } from "./definition";
import { scaleLinear, scaleTime } from "d3-scale";
import type { CellDatum } from "./definition";
import { HeatmapCells, HeatmapXAxis, HeatmapYAxis } from "./carriers";
import type { HeatmapCellsProps, HeatmapSeparatorProps, HeatmapTooltipProps, HeatmapYAxisProps } from "./carriers";
import { keyHas, keyStarts } from "../kit/renderer-dom";

const MIN_RENDERABLE_DIMENSION_PX = 10;
const DEFAULT_WEEK_ROW_COUNT = 7;
const INITIAL_WIDTH_PX = 720;
const WIDTH_EPSILON_PX = 0.5;
const REVEAL_HASH_MULTIPLIER = 31;
const REVEAL_HASH_MODULUS = 1_000_003;

const NO_TIME_EXTENT: [Date, Date] = [new Date(0), new Date(0)];

// One module-level renderer: entrance replays on mount, reduced motion honoured.
const heatmapRenderer = motion({ initial: "always", respectReducedMotion: true });

const SURFACE_STYLE: CSSProperties = { position: "relative" };
const SVG_STYLE: CSSProperties = { overflow: "visible" };
// bklit heatmap-chart.tsx:482-497: the label box is the plot area (margin-inset), not the whole surface.
const loadingLabelBoxStyle = (margin: Readonly<HeatmapMargin>, width: number, height: number): CSSProperties => ({
  height: Math.max(height - margin.top - margin.bottom, 0), left: margin.left, pointerEvents: "none", position: "absolute", top: margin.top, width: Math.max(width - margin.left - margin.right, 0),
});

interface HeatmapChartProps {
  readonly data: HeatmapColumn[];
  readonly xDomain?: [Date, Date];
  readonly sizingColumnCount?: number;
  readonly layout?: "fluid" | "fill";
  readonly margin?: Readonly<Partial<HeatmapMargin>>;
  readonly binSize?: number;
  readonly gap?: number;
  readonly colorScale?: (count: number | null | undefined) => string;
  readonly levelColors?: HeatmapLevelColors;
  readonly levelStyles?: HeatmapLevelStyles;
  readonly aspectRatio?: string;
  readonly className?: string;
  readonly status?: ChartStatus;
  readonly loadingLabel?: string;
  readonly animationDuration?: number;
  readonly enterTransition?: HeatmapEnterTransition;
  readonly revealSignature?: string;
  readonly enterStaggerScale?: number;
  readonly animate?: boolean;
  readonly loadingOpacity?: number;
  readonly showLoadingCells?: boolean;
  readonly loadingCellMaxOpacity?: number;
  readonly loadingCellRandomness?: number;
  readonly columnSeparators?: HeatmapSeparatorParsedConfig;
  readonly weekStartDay?: HeatmapWeekStartDay;
  readonly children?: ReactNode;
  readonly ariaLabel?: string;
  readonly ariaDescription?: string;
}

const hashSignature = (signature: string): number => {
  let hash = 0;
  for (let index = 0; index < signature.length; index += 1) {
    hash = (hash * REVEAL_HASH_MULTIPLIER + (signature.codePointAt(index) ?? 0)) % REVEAL_HASH_MODULUS;
  }
  return hash;
};

const renderPatternNodes = (levelStyles: HeatmapLevelStyles, patternIdPrefix: string | undefined, phaseX: number, phaseY: number): ReactNode =>
  levelStyles.flatMap((style: Readonly<HeatmapLevelStyle>, level) => {
    if (!isHeatmapLevelPattern(style) || !style.pattern) {return [];}
    const id = heatmapLevelPatternId(level);
    const scopedId = patternIdPrefix !== undefined && patternIdPrefix !== "" ? `${patternIdPrefix}-${id}` : id;
    const node = renderPatternPreset(style.pattern, `${scopedId}-base`, heatmapLevelPatternRenderOptions(style));
    if (node === undefined || node === null) {return [];}
    return [
      <Fragment key={scopedId}>
        {node}
        <pattern id={scopedId} href={`#${scopedId}-base`} xlinkHref={`#${scopedId}-base`} patternTransform={`translate(${phaseX} ${phaseY})`} />
      </Fragment>,
    ];
  });

interface HoverCssParams {
  readonly activeScale: number;
  readonly inactiveOpacity: number;
  readonly inactiveScale: number;
  readonly showDelay: number;
}

const HEATMAP_TOOLTIP_HIDE_DELAY_MS = 120;

// Hover emphasis is a fixed styles.css rule set keyed on host `data-hm-hover` (cell | level) plus one scoped rule for the hovered cell or level; opacity/scale props are host CSS vars.
type CssVars = CSSProperties & { readonly [name: `--${string}`]: string | number };

const hoverVars = (params: Readonly<HoverCssParams>): CssVars => ({
  "--hm-active-s": params.activeScale,
  "--hm-hover-ms": `${HEATMAP_HOVER_TRANSITION_MS}ms`,
  "--hm-inactive-o": params.inactiveOpacity,
  "--hm-inactive-s": params.inactiveScale,
  "--hm-show-delay": `${params.showDelay}ms`,
});

type CellPoint = ChartPoint<Readonly<CellDatum>, number | string, string>;

// 2-D grid steps (UPSTREAM-GAPS #34): ArrowLeft/Right move one week column on the same weekday, ArrowUp/Down one day in the column.
const GRID_STEPS: ReadonlyMap<string, readonly [number, number]> = new Map([
  ["ArrowDown", [0, 1]], ["ArrowLeft", [-1, 0]], ["ArrowRight", [1, 0]], ["ArrowUp", [0, -1]],
]);

/** Next focusable cell from `from` along `step`, skipping ghost/missing bins; the current cell when the edge is reached (clamp). */
const gridTarget = (points: ReadonlyMap<string, CellPoint>, from: Readonly<CellDatum>, step: readonly [number, number], columnCount: number, rowCount: number): CellPoint | undefined => {
  let column = from.column + step[0];
  let row = from.row + step[1];
  while (column >= 0 && column < columnCount && row >= 0 && row < rowCount) {
    const point = points.get(`${column}-${row}`);
    if (point !== undefined) {return point;}
    column += step[0];
    row += step[1];
  }
  return points.get(`${from.column}-${from.row}`);
};

const partialDatum = (point: CellPoint): Partial<CellDatum> | undefined => erase(point.datum);

/** Focusable cell points of a scene by grid position (the `heatmap-cells-*` level groups; decorative and loading marks excluded). */
const cellPointsByGrid = (points: readonly CellPoint[]): Map<string, CellPoint> => {
  const byGrid = new Map<string, CellPoint>();
  for (const point of points) {
    // A point's datum is a CellDatum, partial while a cell is still being created.
    const datum = partialDatum(point);
    if (point.markId.startsWith("heatmap-cells-") && isNumber(datum?.column) && isNumber(datum.row)) {
      byGrid.set(`${datum.column}-${datum.row}`, point);
    }
  }
  return byGrid;
};

// The key `<column>-<row>:<reveal>` sits after the mark's `:` separator, so `:1-2:` never matches `:11-2:` or `:1-21:`.
interface HoverAttrsProps {
  readonly coordinator: HeatmapHoverCoordinator;
  readonly hostRef: { readonly current: HTMLElement | null };
  readonly idPrefix: string;
}

const HOVER_ATTR = "data-hm-hover";

const RenderHoverAttrs = ({ coordinator, hostRef, idPrefix }: Readonly<HoverAttrsProps>): ReactElement | null => {
  useEffect(() => {
    const apply = (): void => {
      const host = hostRef.current;
      if (host === null) {return;}
      if (coordinator.getHoveredCell() !== null) {
        writeAttribute(host, HOVER_ATTR, "cell");
      } else if (coordinator.getHoveredLegendLevel() === null) {
        clearAttribute(host, HOVER_ATTR);
      } else {
        writeAttribute(host, HOVER_ATTR, "level");
      }
    };
    apply();
    return coordinator.subscribe(apply);
  }, [coordinator, hostRef]);
  const hovered = useSyncExternalStore(coordinator.subscribe, coordinator.getHoveredCell, () => null);
  const level = useSyncExternalStore(coordinator.subscribe, coordinator.getHoveredLegendLevel, () => null);
  const scope = `[data-bkm-chart="heatmap"][data-hm-id="${idPrefix}"]`;
  if (hovered !== null) {
    return <style>{`${scope}[data-hm-hover="cell"] rect${keyStarts("heatmap-cells-")}${keyHas(`:${hovered.column}-${hovered.row}:`)}{opacity:1;transform:scale(var(--hm-active-s))}`}</style>;
  }
  if (level === null) {return null;}
  const own = `heatmap-cells-l${level}-`;
  return <style>{`${scope}[data-hm-hover="level"] g${keyStarts("heatmap-cells-")}:not(${keyStarts(own)}) rect{opacity:var(--hm-inactive-o);transform:scale(var(--hm-inactive-s))}${scope}[data-hm-hover="level"] g${keyStarts(own)} rect{transform:scale(var(--hm-active-s))}`}</style>;
};

const HeatmapHoverAttrs: NamedExoticComponent<Readonly<HoverAttrsProps>> = memo(RenderHoverAttrs);

const panelStyleOf = (config: Readonly<HeatmapTooltipConfig>): CSSProperties => ({ backgroundColor: config.backgroundColor, ...config.panelStyle });

const tooltipBody = (datum: Readonly<CellDatum>, config: Readonly<HeatmapTooltipConfig>): ReactElement => {
  const panelClass = config.className ? `bkm-tooltip-panel ${config.className}` : "bkm-tooltip-panel";
  const panelStyle = panelStyleOf(config);
  return (
    <div className={panelClass} style={panelStyle}>
      <div className="bkm-tooltip-content">
        <div className="ts-bkm-heatmap-tooltip-date">{formatHeatmapTooltipDate(datum.date)}</div>
        <div className="ts-bkm-heatmap-tooltip-weekday">{formatHeatmapTooltipWeekday(datum.date)}</div>
        <div className="ts-bkm-heatmap-tooltip-divider" />
        <div className="ts-bkm-heatmap-tooltip-value">{config.formatLabel(datum.count, datum.date)}</div>
      </div>
    </div>
  );
};

type Columns = ReturnType<typeof rotateHeatmapColumnBins>;
type SeparatorLayout = ReturnType<typeof resolveHeatmapSeparatorLayout>;
type ResolvedLevelStyles = ReturnType<typeof resolveHeatmapLevelStyles>;
type ColorScale = NonNullable<HeatmapChartProps["colorScale"]>;

interface YAxisConfig {
  readonly labelFormat: NonNullable<HeatmapYAxisProps["labelFormat"]>;
  readonly rowOpacity: HeatmapYAxisProps["rowOpacity"];
  readonly tickFilter: NonNullable<HeatmapYAxisProps["tickFilter"]>;
}

interface ChartConfigInput {
  readonly children: ReactNode;
  readonly columnSeparators: HeatmapSeparatorParsedConfig | undefined;
  readonly marginProp: Readonly<Partial<HeatmapMargin>> | undefined;
}

interface ChartConfig {
  readonly cellsProps: HeatmapCellsProps | undefined;
  readonly hasXAxis: boolean;
  readonly hasYAxis: boolean;
  readonly margin: HeatmapMargin;
  readonly separatorConfig: HeatmapSeparatorParsedConfig | undefined;
  readonly separatorStyle: HeatmapSeparatorStyle | null;
  readonly tooltipConfig: HeatmapTooltipConfig | null;
  readonly yAxis: YAxisConfig;
}

/** The config carriers among the children, normalised to the chart's margin, y axis, separator and tooltip settings. */
const useChartConfig = ({ children, columnSeparators, marginProp }: Readonly<ChartConfigInput>): ChartConfig => {
  const table = useMemo(() => { warnUnrenderedChildren(children, "HeatmapChart"); return readChildren(children); }, [children]);
  const cellsProps = propsFor<HeatmapCellsProps>(table, "heatmapCells").at(0);
  const yAxisProps = propsFor<HeatmapYAxisProps>(table, "heatmapYAxis").at(0);
  const tooltipProps = propsFor<HeatmapTooltipProps>(table, "heatmapTooltip").at(0);
  const separatorProps = propsFor<HeatmapSeparatorProps>(table, "heatmapSeparator").at(0);

  const margin: HeatmapMargin = useMemo(() => ({
    bottom: marginProp?.bottom ?? DEFAULT_MARGIN.bottom,
    left: marginProp?.left ?? DEFAULT_MARGIN.left,
    right: marginProp?.right ?? DEFAULT_MARGIN.right,
    top: marginProp?.top ?? DEFAULT_MARGIN.top,
  }), [marginProp]);

  const yAxis: YAxisConfig = useMemo(() => ({
    labelFormat: yAxisProps?.labelFormat ?? "full",
    rowOpacity: yAxisProps?.rowOpacity,
    tickFilter: yAxisProps?.tickFilter ?? "odd",
  }), [yAxisProps]);

  const separatorConfig = useMemo(
    () => columnSeparators ?? normalizeHeatmapSeparatorConfig(separatorProps === undefined ? undefined : { every: separatorProps.every, groupBy: separatorProps.groupBy, spacing: separatorProps.spacing }) ?? undefined,
    [columnSeparators, separatorProps],
  );
  const separatorStyle: HeatmapSeparatorStyle | null = useMemo(() => (separatorProps === undefined ? null : {
    labelClassName: separatorProps.labelClassName, labelFormat: separatorProps.labelFormat, labelOffset: separatorProps.labelOffset,
    showLabels: separatorProps.showLabels, stroke: separatorProps.stroke, strokeDasharray: separatorProps.strokeDasharray,
    strokeOpacity: separatorProps.strokeOpacity, strokeStyle: separatorProps.strokeStyle, strokeWidth: separatorProps.strokeWidth,
    gradient: separatorProps.gradient, paddingY: separatorProps.paddingY, startOffset: separatorProps.startOffset,
  }), [separatorProps]);

  const tooltipConfig: HeatmapTooltipConfig | null = useMemo(() => (tooltipProps === undefined ? null : {
    backgroundColor: tooltipProps.backgroundColor,
    className: tooltipProps.className ?? "",
    instant: tooltipProps.instant ?? false,
    showDelay: tooltipProps.showDelay ?? 0,
    hideDelay: tooltipProps.hideDelay ?? HEATMAP_TOOLTIP_HIDE_DELAY_MS,
    formatLabel: tooltipProps.formatLabel ?? formatHeatmapContributionLabel,
    panelStyle: tooltipProps.panelStyle,
  }), [tooltipProps]);

  return { cellsProps, hasXAxis: table.has("heatmapXAxis"), hasYAxis: yAxisProps !== undefined, margin, separatorConfig, separatorStyle, tooltipConfig, yAxis };
};

interface ColumnModelInput {
  readonly colorScaleProp: HeatmapChartProps["colorScale"];
  readonly data: HeatmapColumn[];
  readonly levelColors: HeatmapLevelColors | undefined;
  readonly levelStyles: HeatmapLevelStyles | undefined;
  readonly separatorConfig: HeatmapSeparatorParsedConfig | undefined;
  readonly weekStartDay: HeatmapWeekStartDay;
  readonly xDomain: [Date, Date] | undefined;
}

interface ColumnModel {
  readonly colorScale: ColorScale;
  readonly columns: Columns;
  readonly fillScale: ReturnType<typeof buildHeatmapFillScale>;
  readonly hasPattern: boolean;
  readonly resolvedLevelStyles: ResolvedLevelStyles;
  readonly separatorLayout: SeparatorLayout;
}

const useColumnModel = ({ colorScaleProp, data, levelColors, levelStyles, separatorConfig, weekStartDay, xDomain }: Readonly<ColumnModelInput>): ColumnModel => {
  const columns = useMemo(() => rotateHeatmapColumnBins(filterHeatmapColumns(data, xDomain), weekStartDay), [data, xDomain, weekStartDay]);
  const normalizedSeparator = useMemo(() => normalizeHeatmapSeparatorConfig(separatorConfig), [separatorConfig]);
  const separatorLayout = useMemo(() => resolveHeatmapSeparatorLayout(normalizedSeparator, columns), [normalizedSeparator, columns]);
  const resolvedLevelStyles = useMemo(() => resolveHeatmapLevelStyles(levelColors, levelStyles), [levelColors, levelStyles]);
  const colorScale = useMemo(() => colorScaleProp ?? buildHeatmapColorScaleFromStyles(resolvedLevelStyles), [colorScaleProp, resolvedLevelStyles]);
  const fillScale = useMemo(() => buildHeatmapFillScale(resolvedLevelStyles), [resolvedLevelStyles]);
  const hasPattern = useMemo(() => resolvedLevelStyles.some((style) => isHeatmapLevelPattern(style)), [resolvedLevelStyles]);
  return { colorScale, columns, fillScale, hasPattern, resolvedLevelStyles, separatorLayout };
};

interface MetricsInput {
  readonly binSize: number;
  readonly columns: Columns;
  readonly layout: "fluid" | "fill";
  readonly liveWidth: number;
  readonly margin: HeatmapMargin;
  readonly separatorLayout: SeparatorLayout;
}

interface Metrics {
  readonly cellSize: number;
  readonly chartHeight: number;
  readonly chartWidth: number;
  readonly columnCount: number;
  readonly innerHeight: number;
  readonly innerWidth: number;
  readonly isRenderable: boolean;
  readonly rowCount: number;
}

const computeMetrics = ({ binSize, columns, layout, liveWidth, margin, separatorLayout }: Readonly<MetricsInput>): Metrics => {
  const rowCount = columns[0]?.bins.length ?? DEFAULT_WEEK_ROW_COUNT;
  const columnCount = columns.length;
  const gutterTotal = separatorLayout ? separatorLayout.atColumns.length * separatorLayout.spacing : 0;
  const explicitBinSize = binSize > 0 ? binSize : undefined;
  const cellSize = explicitBinSize ?? Math.max((liveWidth - margin.left - margin.right - gutterTotal) / Math.max(columnCount, 1), 0);
  const innerWidth = columnCount * cellSize + gutterTotal;
  const innerHeight = rowCount * cellSize;
  const chartHeight = margin.top + innerHeight + margin.bottom;
  const chartWidth = explicitBinSize !== undefined && layout === "fluid" ? margin.left + innerWidth + margin.right : liveWidth;
  const isRenderable = chartWidth >= MIN_RENDERABLE_DIMENSION_PX && chartHeight >= MIN_RENDERABLE_DIMENSION_PX;
  return { cellSize, chartHeight, chartWidth, columnCount, innerHeight, innerWidth, isRenderable, rowCount };
};

interface CellModelInput {
  readonly cellSize: number;
  readonly columns: Columns;
  readonly hideGhostCells: boolean;
  readonly separatorLayout: SeparatorLayout;
  readonly weekStartDay: HeatmapWeekStartDay;
}

interface CellModel {
  readonly cellData: readonly CellDatum[];
  readonly dayLabels: ReturnType<typeof getHeatmapDayLabels>;
}

const useCellModel = ({ cellSize, columns, hideGhostCells, separatorLayout, weekStartDay }: Readonly<CellModelInput>): CellModel => {
  const dayLabels = useMemo(() => getHeatmapDayLabels(weekStartDay), [weekStartDay]);
  const displayRange = useMemo(() => (hideGhostCells ? resolveHeatmapDisplayRange(columns) : undefined), [columns, hideGhostCells]);
  const cellData = useMemo(
    () => buildCellData({ cellSize, columns, dayLabels, displayRange, layout: separatorLayout }),
    [cellSize, columns, dayLabels, displayRange, separatorLayout],
  );
  return { cellData, dayLabels };
};

interface ScalesInput {
  readonly cellSize: number;
  readonly columns: Columns;
  readonly innerHeight: number;
  readonly innerWidth: number;
  readonly separatorLayout: SeparatorLayout;
}

const useScales = ({ cellSize, columns, innerHeight, innerWidth, separatorLayout }: Readonly<ScalesInput>): Pick<HeatmapContextValue, "brushYScale" | "timeXScale" | "xScale" | "yScale"> => {
  const xScale = useCallback((column: number) => columnStartX(column, cellSize, separatorLayout), [cellSize, separatorLayout]);
  const yScale = useCallback((row: number) => row * cellSize, [cellSize]);
  const timeExtent = useMemo(() => getHeatmapTimeExtent(columns), [columns]);
  const timeXScale = useMemo(() => scaleTime().domain(timeExtent ?? NO_TIME_EXTENT).range([0, innerWidth]), [timeExtent, innerWidth]);
  const brushYScale = useMemo(() => scaleLinear().domain([0, 1]).range([innerHeight, 0]), [innerHeight]);
  return { brushYScale, timeXScale, xScale, yScale };
};

/** Tooltip body for the focused cell: the full cell datum (by grid key) rendered with the tooltip config. */
const useTooltipBody = (cellData: readonly CellDatum[], tooltipConfig: HeatmapTooltipConfig | null): ((context: TooltipContext) => ReactNode) => {
  const cellByKey = useMemo(() => new Map(cellData.map((datum) => [`${datum.column}-${datum.row}`, datum])), [cellData]);
  return useCallback((context: TooltipContext): ReactNode => {
    const point = context.primaryPoint ?? context.points.at(0);
    if (point === undefined || tooltipConfig === null) {return undefined;}
    return tooltipBody(cellByKey.get(`${point.datum.column}-${point.datum.row}`) ?? point.datum, tooltipConfig);
  }, [cellByKey, tooltipConfig]);
};

interface TooltipContext {
  readonly primaryPoint?: CellPoint;
  readonly points: readonly CellPoint[];
}

interface GridFocusInput {
  readonly captureInteraction: InteractionHandle["onRender"];
  readonly columnCount: number;
  readonly containerRef: RefObject<HTMLDivElement | null>;
  readonly coordinator: HeatmapHoverCoordinator;
  readonly interaction: InteractionHandle["interaction"];
  readonly interactive: boolean;
  readonly rowCount: number;
}

interface GridFocus {
  readonly getScene: () => HeatmapScene | null;
  readonly handleBlur: (event: ReactFocusEvent<HTMLDivElement>) => void;
  readonly handleFocusChange: (point: CellPoint | null) => void;
  readonly handleKeyDownCapture: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
  readonly handleRender: (context: ChartRendererRenderContext<never, never, never>) => void;
  readonly releaseGridFocus: () => void;
}

/** Native focus plumbing: scene capture, hover/tooltip publishing, legend release, and the 2-D grid arrows. */
const useGridFocus = ({ captureInteraction, columnCount, containerRef, coordinator, interaction, interactive, rowCount }: Readonly<GridFocusInput>): GridFocus => {
  // The last rendered scene: grid arrows read its points, the focus strategy hit-tests it (see `focus.ts`).
  const sceneRef = useRef<HeatmapScene | null>(null);
  const getScene = useCallback((): HeatmapScene | null => sceneRef.current, []);
  // Grid arrows run through the public controller: the scene's points come from `onRender`, the current cell from
  // `onFocusChange` (pointer or keyboard, so hover→arrow continues from the hovered cell).
  const focusedRef = useRef<CellPoint | null>(null);
  const gridRef = useRef<{ points: readonly CellPoint[] | null; byGrid: Map<string, CellPoint> }>({ byGrid: new Map(), points: null });
  const gridFocusRef = useRef(false);
  const handleRender = useCallback((context: ChartRendererRenderContext<never, never, never>): void => {
    captureInteraction(context);
    sceneRef.current = context.scene;
  }, [captureInteraction]);

  const holdFocus = useKeyboardFocusHold(containerRef, () => interaction.current);
  const handleFocusChange = useCallback((point: CellPoint | null): void => {
    holdFocus(erase(point));
    focusedRef.current = point;
    if (!interactive) {return;}
    if (point === null) {
      coordinator.setHoveredCell(null);
      coordinator.setTooltipData(null);
      return;
    }
    const { datum } = point;
    coordinator.setHoveredLegendLevel(null);
    coordinator.setHoveredCell({ column: datum.column, row: datum.row });
    coordinator.setTooltipData({ column: datum.column, count: datum.count, date: datum.date, row: datum.row, x: point.x, y: point.y });
  }, [coordinator, holdFocus, interactive]);

  // bklit's legend enter clears the hovered cell and its tooltip (heatmap-legend.tsx handleLegendEnter). The cell is the renderer's focus (keyboard-held included), so a published
  // legend level releases it via the public controller and `handleFocusChange(null)` clears highlight and tooltip. Only the legend publishes a non-null level.
  useEffect(() => coordinator.subscribe(() => {
    if (focusedRef.current !== null && coordinator.getHoveredLegendLevel() !== null) {interaction.current?.setControlledFocus(null);}
  }), [coordinator, interaction]);

  // Capture phase on the host (an ancestor of the renderer's container): a grid arrow is handled here and stopped, so the
  // renderer's 1-D keydown step never runs. Tab-in, Home/End and Enter keep the native `focus.navigation` path.
  const handleKeyDownCapture = useCallback((event: ReactKeyboardEvent<HTMLDivElement>): void => {
    const step = GRID_STEPS.get(event.key);
    const {current} = focusedRef;
    const controller = interaction.current;
    const scene = sceneRef.current;
    const modified = event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
    const blocked = modified || !interactive || step === undefined;
    const missing = current === null || controller === null || scene === null;
    if (blocked || missing) {return;}
    if (gridRef.current.points !== scene.points) {gridRef.current = { byGrid: cellPointsByGrid(scene.points), points: scene.points };}
    const target = gridTarget(gridRef.current.byGrid, current.datum, step, columnCount, rowCount);
    if (target === undefined) {return;}
    event.preventDefault();
    event.stopPropagation();
    gridFocusRef.current = true;
    holdFocus.markKeyboard();
    controller.setControlledFocus(erase(target));
  }, [columnCount, holdFocus, interaction, interactive, rowCount]);
  // Controlled focus is not keyboard-owned, so the renderer's focusout clear skips it: blur clears it here.
  const handleBlur = useCallback((event: ReactFocusEvent<HTMLDivElement>): void => {
    if (!gridFocusRef.current || (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget))) {return;}
    gridFocusRef.current = false;
    interaction.current?.setControlledFocus(null);
  }, [interaction]);
  const releaseGridFocus = useCallback((): void => { gridFocusRef.current = false; }, []);
  return { getScene, handleBlur, handleFocusChange, handleKeyDownCapture, handleRender, releaseGridFocus };
};

interface ResourcesInput {
  readonly hasPattern: boolean;
  readonly levelStyles: ResolvedLevelStyles;
  readonly margin: HeatmapMargin;
  readonly patternIdPrefix: string | undefined;
  readonly separatorGradientId: string;
  readonly separatorLayout: SeparatorLayout;
  readonly separatorSpan: ReturnType<typeof getHeatmapSeparatorLineY>;
  readonly separatorStyle: HeatmapSeparatorStyle | null;
}

/** The pattern `<defs>` and the separator gradient, hosted by `ResourceHost`; null when neither is configured. */
const buildResources = ({ hasPattern, levelStyles, margin, patternIdPrefix, separatorGradientId, separatorLayout, separatorSpan, separatorStyle }: Readonly<ResourcesInput>): ReactElement | null => {
  const patternResources = hasPattern ? renderPatternNodes(levelStyles, patternIdPrefix, margin.left, margin.top) : null;
  const separatorGradient = separatorStyle?.gradient === undefined || separatorLayout === null ? null : (
    // Vertical stroke gradient in user space; sized to the line span (see definition `separatorSpan`).
    <linearGradient id={separatorGradientId} gradientUnits="userSpaceOnUse" x1={0} x2={0} y1={margin.top + separatorSpan.y1} y2={margin.top + separatorSpan.y2}>
      {buildHeatmapSeparatorGradientStops(separatorStyle.gradient, separatorStyle.strokeOpacity ?? 1).map((stop) => (
        <stop key={stop.offset} offset={stop.offset} stopColor={stop.color} stopOpacity={stop.opacity} />
      ))}
    </linearGradient>
  );
  return patternResources === null && separatorGradient === null ? null : <>{patternResources}{separatorGradient}</>;
};

interface HoverEmphasis {
  readonly hoverEffect: boolean;
  readonly hoverStyle: CssVars;
}

/** Host CSS vars for the hover emphasis, and whether emphasis is enabled at all. */
const useHoverEmphasis = (cellsProps: HeatmapCellsProps | undefined, tooltipConfig: HeatmapTooltipConfig | null): HoverEmphasis => {
  const activeScale = cellsProps?.activeScale ?? 1;
  const inactiveOpacity = cellsProps?.inactiveOpacity ?? HEATMAP_INACTIVE_OPACITY;
  const inactiveScale = cellsProps?.inactiveScale ?? 1;
  const showDelay = tooltipConfig?.showDelay ?? 0;
  const hoverStyle = useMemo(() => hoverVars({ activeScale, inactiveOpacity, inactiveScale, showDelay }), [activeScale, inactiveOpacity, inactiveScale, showDelay]);
  // bklit gates cell emphasis on these props (heatmap-cells.tsx:500-508, isHeatmapHoverEffectEnabled): with all three at 1 nothing dims,
  // so the host attributes are not written (each write restyles every cell and replays a no-op none -> scale(1) transition).
  const hoverEffect = isHeatmapHoverEffectEnabled({ activeScale, inactiveOpacity, inactiveScale });
  return { hoverEffect, hoverStyle };
};

const HeatmapChart = (props: Readonly<HeatmapChartProps>): ReactElement => {
  const {
    data, layout = "fluid", binSize = 0, gap = 2, colorScale: colorScaleProp, margin: marginProp, weekStartDay = 0, xDomain, levelColors, levelStyles,
    status = "ready", animationDuration = HEATMAP_DEFAULT_ENTER_DURATION_MS, enterTransition = HEATMAP_DEFAULT_ENTER_TRANSITION, enterStaggerScale = 1,
    revealSignature = "", loadingCellMaxOpacity = HEATMAP_DEFAULT_LOADING_CELL_MAX_OPACITY, loadingCellRandomness = HEATMAP_DEFAULT_LOADING_CELL_RANDOMNESS,
    loadingLabel, animate = true, loadingOpacity = HEATMAP_LOADING_CHART_OPACITY, showLoadingCells = true, ariaDescription, ariaLabel, aspectRatio,
    className, columnSeparators, children,
  } = props;

  const upstream = useHeatmapCoordinatorOptional();
  const ownCoordinator = useMemo(() => createHeatmapHoverCoordinator(), []);
  const coordinator = upstream ?? ownCoordinator;
  const idPrefix = useSanitizedId();

  // The entrance replays only if the first painted scene is final: a post-mount width change is a resize (not animated) and would cancel it,
  // so the container is measured once, synchronously, before the chart mounts at that width.
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { interaction, onRender: captureInteraction } = useInteractionHandle();
  useTapFocus(containerRef, () => interaction.current, { mode: "press" });
  const { ready: measured, width: liveWidth } = useFluidWidth(containerRef, { epsilon: WIDTH_EPSILON_PX, initialWidth: INITIAL_WIDTH_PX });
  // The motion renderer animates only keyed marks that ENTER a painted scene (rect marks have no first-paint baseline), so the scene paints without cells and they enter with their per-datum delay,
  // released on bklit's chain (ParentSize svg after its first ResizeObserver delivery + a frame; reveal effects and motion's clock follow) via kit/size/parent-size-arm.tsx.
  const sized = useParentSizeMounted(containerRef, measured);
  // bklit's svg first renders on the ParentSize commit (heatmap-chart.tsx:685); a mount effect then moves it to "revealing" (:566-585), where the cells' tween starts.
  const [cellsEntered, setCellsEntered] = useState(false);
  // UPSTREAM-GAPS #12: first paint and group joins get no per-datum enter, so cells join on a second commit (loading -> ready re-seeds the same way).
  // oxlint-disable-next-line react/set-state-in-effect, react/no-deriving-state-in-effects -- the cells must enter on a second commit, after the cell-less seed has painted
  useEffect(() => { setCellsEntered(sized && status === "ready"); }, [sized, status]);

  const { cellsProps, hasXAxis, hasYAxis, margin, separatorConfig, separatorStyle, tooltipConfig, yAxis } = useChartConfig({ children, columnSeparators, marginProp });
  const { colorScale, columns, fillScale, hasPattern, resolvedLevelStyles, separatorLayout } = useColumnModel({ colorScaleProp, data, levelColors, levelStyles, separatorConfig, weekStartDay, xDomain });
  const { cellSize, chartHeight, chartWidth, columnCount, innerHeight, innerWidth, isRenderable, rowCount } = computeMetrics({ binSize, columns, layout, liveWidth, margin, separatorLayout });
  const { cellData, dayLabels } = useCellModel({ cellSize, columns, hideGhostCells: cellsProps?.hideGhostCells ?? true, separatorLayout, weekStartDay });

  const patternIdPrefix = hasPattern ? `${idPrefix}-hm` : undefined;
  const interactive = cellsProps?.interactive ?? true;
  const animateCells = animate && animationDuration > 0;
  const separatorGradientId = `${idPrefix}-hm-sep`;
  const separatorSpan = useMemo(
    () => getHeatmapSeparatorLineY({ innerHeight, marginTop: margin.top, paddingY: separatorStyle?.paddingY, startOffset: separatorStyle?.startOffset }),
    [innerHeight, margin.top, separatorStyle?.paddingY, separatorStyle?.startOffset],
  );
  const revealEpoch = useMemo(() => hashSignature(revealSignature), [revealSignature]);

  // One entrance clock per reveal: survives the definition rebuilds a layout change (font swap) causes mid-entrance.
  const enterClock = useMemo((): HeatmapEnterClock => ({ at: null }), [revealEpoch]);
  const { getScene, handleBlur, handleFocusChange, handleKeyDownCapture, handleRender, releaseGridFocus } = useGridFocus({ captureInteraction, columnCount, containerRef, coordinator, interaction, interactive, rowCount });

  const definition = useMemo(() => buildHeatmapDefinition({
    enterClock, getScene,
    animateCells, animationDuration, cellData, seedOnly: animateCells && !cellsEntered && status === "ready", cellSize, columns, cornerRadius: cellsProps?.cornerRadius ?? 2, dayLabels, enterStaggerScale, enterTransition,
    gap,
    innerWidth, interactive, layout: separatorLayout, levelStyles: resolvedLevelStyles, margin, patternIdPrefix, revealEpoch, revealKey: revealSignature,
    rowOpacity: cellsProps?.rowOpacity, separator: separatorStyle, separatorGradientId, separatorSpan, showXAxis: hasXAxis, showYAxis: hasYAxis, status, tooltipClassName: "",
    loadingCellRandomness, loadingShimmer: animate && showLoadingCells, tooltipEnabled: tooltipConfig !== null, tooltipInstant: tooltipConfig?.instant ?? false, tooltipHideDelay: tooltipConfig?.hideDelay ?? HEATMAP_TOOLTIP_HIDE_DELAY_MS, yAxis,
  }), [
    animateCells, animationDuration, cellData, cellsEntered, cellSize, columns, cellsProps, dayLabels, enterStaggerScale, enterTransition, gap, innerWidth,
    interactive, separatorLayout, resolvedLevelStyles, margin, patternIdPrefix, revealEpoch, revealSignature, separatorStyle, separatorGradientId, separatorSpan, hasXAxis, hasYAxis, status,
    tooltipConfig, yAxis, enterClock, getScene,
  ]);

  const renderTooltipBody = useTooltipBody(cellData, tooltipConfig);
  const { brushYScale, timeXScale, xScale, yScale } = useScales({ cellSize, columns, innerHeight, innerWidth, separatorLayout });

  const contextValue: HeatmapContextValue = useMemo(() => ({
    brushYScale, containerRef, timeXScale, xScale, yScale,
    animateCells, animationDuration, ariaDescription, ariaLabel, binHeight: cellSize, binWidth: cellSize,
    chartPhase: status === "loading" ? "loading" : "ready", chartStatus: status, colorScale, columnCount, data: columns, enterStaggerScale, enterTransition,
    fillScale, fixedWidth: undefined, gap, hasCustomColorScale: colorScaleProp !== undefined, height: chartHeight, innerHeight, innerWidth,
    isLoaded: status !== "loading", isReady: isRenderable, levelStyles: resolvedLevelStyles, loadingCellMaxOpacity, loadingCellRandomness, loadingLabel,
    loadingOpacity, margin, revealEpoch, revealMode: null, rowCount, separator: separatorStyle, separatorLayout, showLoadingCells,
    showLoadingLabel: (loadingLabel ?? "").trim().length > 0 && status === "loading", tooltip: tooltipConfig, weekStartDay, width: chartWidth,
    yLabelFormat: yAxis.labelFormat, yRowOpacity: yAxis.rowOpacity, yTickFilter: yAxis.tickFilter,
  }), [
    brushYScale, timeXScale, xScale, yScale,
    animateCells, animationDuration, ariaDescription, ariaLabel, cellSize, status, colorScale, colorScaleProp, columnCount, columns, enterStaggerScale,
    enterTransition, fillScale, gap, chartHeight, innerHeight, innerWidth, isRenderable, resolvedLevelStyles, loadingCellMaxOpacity, loadingCellRandomness,
    loadingLabel, loadingOpacity, margin, revealEpoch, rowCount, separatorStyle, separatorLayout, showLoadingCells, tooltipConfig,
    weekStartDay, chartWidth, yAxis,
  ]);

  const containerStyle: CssVars = useMemo(() => ({
    "--bkm-hm-load-max": loadingCellMaxOpacity,
    aspectRatio: (aspectRatio ?? "").length > 0 ? aspectRatio : undefined,
    height: "100%", position: "relative", width: "100%",
  }), [aspectRatio, loadingCellMaxOpacity]);

  const resources = buildResources({ hasPattern, levelStyles: resolvedLevelStyles, margin, patternIdPrefix, separatorGradientId, separatorLayout, separatorSpan, separatorStyle });
  const { hoverEffect, hoverStyle } = useHoverEmphasis(cellsProps, tooltipConfig);
  const surfaceStyle = useMemo((): CssVars => (interactive ? { ...containerStyle, ...hoverStyle } : containerStyle), [containerStyle, hoverStyle, interactive]);
  const innerStyle = useMemo((): CSSProperties => ({ ...SURFACE_STYLE, marginBottom: -gap / 2 }), [gap]);

  const surface = (
    <div className={className} data-bkm-chart="heatmap" data-hm-id={idPrefix} data-slot="chart" ref={containerRef} style={surfaceStyle} onBlur={handleBlur} onKeyDownCapture={handleKeyDownCapture} onPointerMove={releaseGridFocus}>
      {sized && isRenderable && cellsProps !== undefined ? (
        <HeatmapContext.Provider value={contextValue}>
          <div style={innerStyle}>
            <RendererChart
              ariaDescription={ariaDescription ?? cellsProps.ariaDescription}
              ariaLabel={ariaLabel ?? cellsProps.ariaLabel ?? "Heatmap chart"}
              className="ts-bkm-heatmap-svg"
              definition={definition}
              height={chartHeight + gap / 2}
              idPrefix={idPrefix}
              initialWidth={liveWidth}
              width={chartWidth}
              onFocusChange={handleFocusChange}
              onRender={erase(handleRender)}
              renderer={heatmapRenderer}
              renderTooltipBody={renderTooltipBody}
              style={SVG_STYLE}
            />
            {resources === null ? null : <ResourceHost idPrefix={idPrefix} resources={resources} />}
            {status === "loading" && (loadingLabel ?? "").trim().length > 0 ? (
              <div className="ts-bkm-heatmap-loading-box" style={loadingLabelBoxStyle(margin, chartWidth, chartHeight)}><LoadingLabel text={loadingLabel ?? ""} /></div>
            ) : null}
            {interactive && hoverEffect ? <HeatmapHoverAttrs coordinator={coordinator} hostRef={containerRef} idPrefix={idPrefix} /> : null}
            {children}
          </div>
        </HeatmapContext.Provider>
      ) : null}
    </div>
  );

  return upstream === null ? <HeatmapInteractionProvider coordinator={coordinator}>{surface}</HeatmapInteractionProvider> : surface;
};

HeatmapChart.displayName = "HeatmapChart";

// Skeleton columns mirror the target with zeroed counts.
const generateHeatmapSkeletonFromTarget = (target: readonly Readonly<HeatmapColumn>[]): HeatmapColumn[] =>
  target.map((column: Readonly<HeatmapColumn>) => ({
    bin: column.bin,
    bins: column.bins.map((bin) => ({ bin: bin.bin, count: 0, date: bin.date })),
  }));

interface HeatmapChartLoadingProps {
  readonly data: HeatmapColumn[];
  readonly xDomain?: [Date, Date];
  readonly margin?: Readonly<Partial<HeatmapMargin>>;
  readonly gap?: number;
  readonly cornerRadius?: number;
  readonly label?: string;
  readonly className?: string;
}

const HeatmapChartLoading = ({ data, xDomain, margin, gap = 2, cornerRadius = 2, label = "Loading", className = "" }: Readonly<HeatmapChartLoadingProps>): ReactElement => {
  const skeletonData = useMemo(() => generateHeatmapSkeletonFromTarget(data), [data]);
  const mutableXDomain = useMemo((): [Date, Date] | undefined => (xDomain === undefined ? undefined : [xDomain[0], xDomain[1]]), [xDomain]);
  return (
    <HeatmapChart className={className} data={skeletonData} gap={gap} loadingLabel={label} margin={margin} status="loading" xDomain={mutableXDomain}>
      <HeatmapCells cornerRadius={cornerRadius} interactive={false} />
      <HeatmapXAxis />
      <HeatmapYAxis />
    </HeatmapChart>
  );
};

export { HeatmapChart, HeatmapChartLoading };
export type { HeatmapChartLoadingProps, HeatmapChartProps };
