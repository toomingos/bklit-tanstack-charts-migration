import type { ChartMark, DomChartDefinition } from "@tanstack/charts";
import { erase } from "../kit/erased-types";
import { defineChart } from "@tanstack/charts/scene";
import { decorative } from "@tanstack/charts/mark/decorative";
import { scaleBand } from "@tanstack/charts/scales/band";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { cell, rect } from "@tanstack/charts/rect";
import { link } from "@tanstack/charts/link";
import { text } from "@tanstack/charts/text";
import { tooltip } from "@tanstack/charts/tooltip";
import { createHeatmapFocus } from "./focus";
import type { HeatmapScene } from "./focus";
import {
  heatmapLevelCellFillOpacity,
  heatmapLevelPatternId,
  isHeatmapLevelPattern,
} from "./colors";
import type { HeatmapLevelStyles } from "./colors";
import type { HeatmapMargin, HeatmapSeparatorStyle, HeatmapYAxisConfig } from "./context";
import { createHeatmapCellMotion, heatmapCellSeed, seededRandom } from "./motion";
import { bklitTooltipPlacement } from "../kit/tooltip/bklit-tooltip-portal";
import { TOOLTIP_OFFSET } from "../kit/theme";
import type { HeatmapEnterClock, HeatmapEnterTransition } from "./motion";
import { getHeatmapColumnMonthAnchor, isHeatmapGhostBin } from "./columns";
import { getHeatmapContributionLevel } from "./contribution-level";
import { formatHeatmapYAxisLabel, shouldShowHeatmapYAxisTick } from "./day-labels";
import { formatHeatmapMonthShort } from "./format";
import { resolveHeatmapRowOpacity } from "./hover-style";
import { resolveHeatmapSeparatorStrokeDasharray } from "./separators";
import type { HeatmapColumn, HeatmapDisplayRange } from "./columns";
import type { HeatmapSeparatorLayout } from "./separators";

/** One heatmap cell as a chart datum. */
interface CellDatum {
  readonly colKey: string;
  readonly rowKey: string;
  readonly column: number;
  readonly row: number;
  readonly count: number;
  readonly level: number;
  readonly date: Readonly<Date>;
  readonly x0: number;
  readonly x1: number;
}

/** bklit's useDelayedTooltipData hideDelay (default 120ms, the `hideDelay` prop overrides): the tooltip holds that long before unmounting (opacity/scale neutralised in CSS). */
const HEATMAP_HOLD_MOTION = { type: "tween", duration: 120, easing: "linear" } as const;

/** Rendered height of the default heatmap tooltip body (date, weekday, rule, count). */
const LOADING_BASE_OPACITY = 0.2;
const SHIMMER_SEED_SALT = 73_133;
const FALLBACK_LEVEL = 0;
const LEVELS = [0, 1, 2, 3, 4] as const;
const QUARTER_LABEL_RISE_PX = 8;

/** Left edge of a column in plot pixels, including separator gutters. */
export const columnStartX = (column: number, cellSize: number, layout: Readonly<HeatmapSeparatorLayout> | null): number => {
  let gutters = 0;
  if (layout && layout.spacing > 0) {
    for (const at of layout.atColumns) {
      if (at <= column) {gutters += 1;}
    }
  }
  return column * cellSize + gutters * (layout?.spacing ?? 0);
};

interface BuildCellDataParams {
  readonly columns: readonly HeatmapColumn[];
  readonly dayLabels: readonly string[];
  readonly displayRange: HeatmapDisplayRange | undefined;
  readonly cellSize: number;
  readonly layout: Readonly<HeatmapSeparatorLayout> | null;
}

/** Ghost bins (outside the display range) are not data: they never draw and never take focus. */
const buildCellData = ({ columns, dayLabels, displayRange, cellSize, layout }: Readonly<BuildCellDataParams>): CellDatum[] => {
  const data: CellDatum[] = [];
  for (const [column, col] of columns.entries()) {
    const x0 = columnStartX(column, cellSize, layout);
    for (const [row, bin] of col.bins.entries()) {
      if (displayRange === undefined || !isHeatmapGhostBin(bin, displayRange)) {
        data.push({
          colKey: String(column),
          column,
          count: bin.count,
          date: bin.date,
          level: getHeatmapContributionLevel(bin.count),
          row,
          rowKey: dayLabels[row] ?? String(row),
          x0,
          x1: x0 + cellSize,
        });
      }
    }
  }
  return data;
};

const patternRef = (id: string, prefix: string | undefined): string => (prefix === undefined || prefix === "" ? id : `${prefix}-${id}`);

const levelFill = (level: number, styles: HeatmapLevelStyles, patternIdPrefix: string | undefined): string => {
  const style = styles[level] ?? styles[FALLBACK_LEVEL];
  if (isHeatmapLevelPattern(style)) {
    const id = heatmapLevelPatternId(level);
    return `url(#${patternRef(id, patternIdPrefix)})`;
  }
  return style.color;
};

type RowOpacity = number | readonly number[] | undefined;

interface BuildHeatmapDefinitionParams {
  readonly getScene: () => HeatmapScene | null;
  readonly status: "loading" | "ready" | "error";
  readonly columns: readonly HeatmapColumn[];
  readonly dayLabels: readonly string[];
  readonly cellData: readonly CellDatum[];
  readonly cellSize: number;
  readonly gap: number;
  readonly margin: Readonly<HeatmapMargin>;
  readonly innerWidth: number;
  readonly layout: Readonly<HeatmapSeparatorLayout> | null;
  readonly separator: Readonly<HeatmapSeparatorStyle> | null;
  readonly levelStyles: HeatmapLevelStyles;
  readonly patternIdPrefix: string | undefined;
  readonly cornerRadius: number;
  readonly rowOpacity: RowOpacity;
  readonly yAxis: Readonly<HeatmapYAxisConfig>;
  readonly tooltipEnabled: boolean;
  readonly tooltipInstant: boolean;
  /** bklit HeatmapTooltip hideDelay (ms): how long the instant tooltip is held after the pointer leaves. */
  readonly tooltipHideDelay: number;
  readonly tooltipClassName: string;
  readonly animateCells: boolean;
  readonly animationDuration: number;
  readonly enterTransition: Readonly<HeatmapEnterTransition> | undefined;
  readonly enterStaggerScale: number;
  readonly revealEpoch: number;
  readonly revealKey: string;
  readonly enterClock: HeatmapEnterClock;
  /** First paint: one seed cell per group, so the group exists and every other cell ENTERS with its own delay. */
  readonly seedOnly: boolean;
  readonly interactive: boolean;
  /** Loading shimmer: share of cells that pulse (0-1) and whether pulsing is on. */
  readonly loadingCellRandomness: number;
  readonly loadingShimmer: boolean;
  readonly separatorGradientId: string;
  readonly separatorSpan: Readonly<{ y1: number; y2: number }>;
  readonly showXAxis: boolean;
  readonly showYAxis: boolean;
}

type CellMark = ChartMark<Readonly<CellDatum>, number | string, string>;

interface ColumnMonthTicks {
  readonly values: number[];
  readonly labels: Map<number, string>;
}

const monthKey = (anchor: Readonly<Date>): string => `${anchor.getFullYear()}-${anchor.getMonth()}`;

/** One tick per month transition, anchored at the first column of the month. */
const monthTicks = (columns: readonly HeatmapColumn[]): ColumnMonthTicks => {
  const values: number[] = [];
  const labels = new Map<number, string>();
  let lastKey = "";
  for (const [index, column] of columns.entries()) {
    const anchor = getHeatmapColumnMonthAnchor(column);
    if (anchor !== null && monthKey(anchor) !== lastKey) {
      lastKey = monthKey(anchor);
      values.push(index);
      labels.set(index, formatHeatmapMonthShort(anchor));
    }
  }
  return { labels, values };
};

type DecorativeMark = ReturnType<typeof decorative>;

type MakeCells = (data: readonly CellDatum[], options: Record<string, unknown>) => CellMark;

const createCellMaker = (linearX: boolean, baseInset: number, cornerRadius: number): MakeCells => {
  const positions = linearX
    ? { x1: (datum: Readonly<CellDatum>): number => datum.x0, x2: (datum: Readonly<CellDatum>): number => datum.x1, y: (datum: Readonly<CellDatum>): string => datum.rowKey }
    : { x: (datum: Readonly<CellDatum>): string => datum.colKey, y: (datum: Readonly<CellDatum>): string => datum.rowKey };
  return (data, options) => {
    const common = { inset: baseInset, radius: cornerRadius, ...options };
    return linearX ? rect(data, { ...common, ...positions }) : cell(data, { ...common, ...positions });
  };
};

const shimmers = (datum: Readonly<CellDatum>, randomness: number, shimmer: boolean): boolean => {
  const random = seededRandom(heatmapCellSeed(datum.column, datum.row) + SHIMMER_SEED_SALT);
  return shimmer && (randomness >= 1 || (randomness > 0 && random() < randomness));
};

// bklit heatmap-cells.tsx:313-348 gives every cell its own random target/duration/pause. Marks take no per-datum opacity channel, so the cells that
// shimmer share one group (`heatmap-loading-shimmer`) and styles.css derives each rect's own timing and peaks from its sibling index.
const loadingMarks = ({ cellData, levelStyles, patternIdPrefix, loadingCellRandomness, loadingShimmer }: Readonly<BuildHeatmapDefinitionParams>, makeCells: MakeCells): CellMark[] => {
  const still: CellDatum[] = [];
  const pulsing: CellDatum[] = [];
  for (const datum of cellData) {
    (shimmers(datum, loadingCellRandomness, loadingShimmer) ? pulsing : still).push(datum);
  }
  const marks: CellMark[] = [];
  for (const [id, data, fillOpacity] of [["heatmap-loading", still, LOADING_BASE_OPACITY], ["heatmap-loading-shimmer", pulsing, 1]] as const) {
    if (data.length > 0) {
      marks.push(makeCells(data, {
        fill: levelFill(0, levelStyles, patternIdPrefix),
        fillOpacity,
        id,
        key: (datum: Readonly<CellDatum>) => `load-${datum.column}-${datum.row}`,
        // bklit heatmap-cells.tsx:149-151: the shimmer layer drops to 0 at once on reveal, the data layer fades in.
        motion: false as const,
      }));
    }
  }
  return marks;
};

interface CellGroup {
  readonly opacity: number;
  readonly data: CellDatum[];
}

// Marks take a scalar fillOpacity, so cells group by effective opacity; the level -> paint mapping is the chart-level `color` scale.
// Groups are per level (stable ids) so legend dimming only changes fillOpacity, never re-enters cells.
const groupCells = (cellData: readonly CellDatum[], levelStyles: HeatmapLevelStyles, rowOpacity: RowOpacity): Map<string, CellGroup> => {
  const groups = new Map<string, CellGroup>();
  for (const datum of cellData) {
    const opacity = resolveHeatmapRowOpacity(datum.row, rowOpacity) * heatmapLevelCellFillOpacity(levelStyles[datum.level] ?? levelStyles[FALLBACK_LEVEL]);
    const id = `heatmap-cells-l${datum.level}-o${opacity}`;
    const entry = groups.get(id);
    if (entry === undefined) {
      groups.set(id, { data: [datum], opacity });
    } else {
      entry.data.push(datum);
    }
  }
  return groups;
};

const readyMarks = ({ cellData, levelStyles, rowOpacity, seedOnly, revealKey }: Readonly<BuildHeatmapDefinitionParams>, makeCells: MakeCells, motionFor: ReturnType<typeof createHeatmapCellMotion<CellDatum>>): CellMark[] => {
  const marks: CellMark[] = [];
  for (const [groupId, { opacity, data }] of groupCells(cellData, levelStyles, rowOpacity)) {
    // First paint (seedOnly): one transparent placeholder keeps the mark group alive, so the real cells
    // ENTER it afterwards with their own delays (the motion renderer only animates entering elements).
    const seeded = seedOnly ? { fill: "transparent", key: (): string => "seed", motion: false as const } : null;
    marks.push(makeCells(seeded ? data.slice(0, 1) : data, {
      ...(seeded ?? {
        color: (datum: Readonly<CellDatum>): number => datum.level,
        key: (datum: Readonly<CellDatum>): string => `${datum.column}-${datum.row}:${revealKey}`,
        motion: motionFor,
      }),
      fillOpacity: opacity,
      id: groupId,
    }));
  }
  return marks;
};

// One vertical segment per gutter, spanning bklit's [startOffset+paddingY, innerHeight-paddingY] on a
// pixel-linear helper y scale (`link` is the native segment mark; `ruleX` can only span the full plot).
const separatorRules = ({ cellSize, separatorGradientId, separatorSpan }: Readonly<BuildHeatmapDefinitionParams>, layout: Readonly<HeatmapSeparatorLayout>, separator: Readonly<HeatmapSeparatorStyle>): DecorativeMark => {
  const xs = layout.atColumns.map((at) => columnStartX(at, cellSize, layout) - layout.spacing / 2);
  return decorative(link(xs, {
    id: "heatmap-separators",
    stroke: separator.gradient === undefined ? separator.stroke ?? "var(--bkm-border)" : `url(#${separatorGradientId})`,
    strokeDasharray: resolveHeatmapSeparatorStrokeDasharray(separator.strokeStyle ?? "solid", separator.strokeDasharray),
    strokeOpacity: separator.gradient === undefined ? separator.strokeOpacity ?? 1 : undefined,
    strokeWidth: separator.strokeWidth ?? 1,
    x1: (value: number) => value,
    x2: (value: number) => value,
    y1: () => separatorSpan.y1,
    y2: () => separatorSpan.y2,
    yScale: "sepY",
  }));
};

const separatorLabels = ({ cellSize, dayLabels }: Readonly<BuildHeatmapDefinitionParams>, layout: Readonly<HeatmapSeparatorLayout>, separator: Readonly<HeatmapSeparatorStyle>, linearX: boolean): DecorativeMark => {
  const labelFormat = separator.labelFormat ?? ((quarter: number): string => `Q${quarter}`);
  const first = dayLabels[0];
  const labelRows = layout.groups.map((group) => ({
    text: labelFormat(group.quarter, group.startDate),
    x: linearX ? columnStartX(group.startColumnIndex, cellSize, layout) : String(group.startColumnIndex),
  }));
  const options = erase({
    anchor: "start",
    dy: -(cellSize / 2) - QUARTER_LABEL_RISE_PX + (separator.labelOffset ?? 0),
    fill: "var(--chart-label)",
    fontSize: 12,
    id: "heatmap-separator-labels",
    text: (row: { readonly text: string }) => row.text,
    x: (row: { readonly x: number | string }) => row.x,
    y: () => first,
  });
  return decorative(text(labelRows, options));
};

const separatorMarks = (params: Readonly<BuildHeatmapDefinitionParams>, linearX: boolean): DecorativeMark[] => {
  const { layout, separator, dayLabels } = params;
  const marks: DecorativeMark[] = [];
  if (layout === null) {
    return marks;
  }
  if (linearX && layout.atColumns.length > 0 && separator !== null) {
    marks.push(separatorRules(params, layout, separator));
  }
  if (separator?.showLabels === true && layout.groups.length > 0 && dayLabels.length > 0) {
    marks.push(separatorLabels(params, layout, separator, linearX));
  }
  return marks;
};

const buildHeatmapDefinition = (params: Readonly<BuildHeatmapDefinitionParams>): DomChartDefinition<Readonly<CellDatum>, number | string, string> => {
  const {
    status, columns, dayLabels, cellSize, gap, margin, innerWidth, layout, levelStyles, patternIdPrefix, cornerRadius,
    rowOpacity, yAxis, tooltipEnabled, tooltipInstant, tooltipHideDelay, tooltipClassName, animateCells, animationDuration, enterTransition, enterStaggerScale,
    revealEpoch, enterClock, showXAxis, showYAxis, getScene,
  } = params;
  // Separator gutters make the column grid non-uniform, which a band scale cannot express:
  // that case alone uses a linear pixel x scale with `rect` (x1/x2); otherwise a band scale with `cell`.
  const linearX = layout !== null && layout.spacing > 0;
  // Native cells inset by gap/2 on every side, so the plot shifts by it and the svg is gap/2 taller than bklit's (UPSTREAM-GAPS #65).
  const baseInset = gap / 2;
  const loading = status === "loading";

  const xScale = linearX ? scaleLinear().domain([0, innerWidth]) : scaleBand().domain(columns.map((_c, index) => String(index))).padding(0);
  const yScale = scaleBand().domain([...dayLabels]).padding(0);

  const motionFor = createHeatmapCellMotion<CellDatum>({
    animate: animateCells, animationDuration, clock: enterClock, enterStaggerScale, enterTransition, revealEpoch,
  });

  const makeCells = createCellMaker(linearX, baseInset, cornerRadius);

  // bklit anchors on the centre of the cell's full bin; the box top/flip rules live in the position-only tooltip portal.
  const tooltipAnchor = (points: readonly { readonly x: number; readonly y: number }[]): { readonly x: number; readonly y: number } | null => {
    const point = points.at(0);
    return point === undefined ? null : { x: point.x + baseInset, y: point.y + baseInset };
  };

  const marks = loading ? loadingMarks(params, makeCells) : readyMarks(params, makeCells, motionFor);
  const decorativeMarks = loading ? [] : separatorMarks(params, linearX);

  const { values: monthValues, labels: monthLabels } = monthTicks(columns);
  const xTickValues = linearX ? monthValues.map((index) => columnStartX(index, cellSize, layout)) : monthValues.map(String);
  const xLabelByTick = new Map<number | string, string>();
  for (const [position, index] of monthValues.entries()) {
    xLabelByTick.set(xTickValues[position], monthLabels.get(index) ?? "");
  }
  const yTickValues = dayLabels.filter((_label, row) => shouldShowHeatmapYAxisTick(row, yAxis.tickFilter));
  const yOpacity = yAxis.rowOpacity ?? rowOpacity;

  const xHidden = !showXAxis;
  const yHidden = !showYAxis;
  const axisOff = { axis: false as const, guide: false as const };
  const spec = {
    color: { domain: [...LEVELS], range: LEVELS.map((level) => levelFill(level, levelStyles, patternIdPrefix)) },
    focus: createHeatmapFocus(getScene),
    focusRing: false,
    // bklit's cells start at the plot's left edge and sit `gap` below its top; the native cell is inset by gap/2 on every side, so the plot moves gap/2 left and down
    // (right and height grow back, stride unchanged) and the axis tick padding absorbs the shift.
    margin: { bottom: margin.bottom, left: margin.left - baseInset, right: margin.right + baseInset, top: margin.top + baseInset },
    marks: erase([...marks, ...decorativeMarks]),
    scales: {
      sepY: { axis: false as const, channel: "y" as const, guide: false as const, scale: scaleLinear().domain([dayLabels.length * cellSize, 0]) },
      x: xHidden
        ? { ...axisOff, scale: xScale }
        : {
            axis: {
              line: false,
              // bklit heatmap-x-axis.tsx:25-52 draws one label per month, no collision test.
              tickLabels: {
                anchor: "start" as const,
                dx: ({ bandwidth }: Readonly<{ bandwidth: number }>): number => (linearX ? 0 : -bandwidth / 2) + baseInset,
                dy: -2.4,
                fontSize: 12,
                opacity: 1,
                thin: false,
              },
              ticks: { format: (value: number | string): string => xLabelByTick.get(value) ?? "", padding: 4 + baseInset, size: 0, values: xTickValues },
            },
            guide: false,
            scale: xScale,
            side: "top" as const,
          },
      y: yHidden
        ? { ...axisOff, scale: yScale }
        : {
            axis: {
              line: false,
              // bklit heatmap-y-axis.tsx:44-49 draws every filtered label, no collision test.
              tickLabels: {
                dy: -1.2,
                fontSize: 12,
                opacity: yOpacity === undefined ? 1 : ({ value, index }: Readonly<{ value: string; index: number }>): number => {
                  const row = dayLabels.indexOf(value);
                  return resolveHeatmapRowOpacity(row === -1 ? index : row, yOpacity);
                },
                thin: false,
              },
              ticks: { format: (value: string): string => formatHeatmapYAxisLabel(value, yAxis.labelFormat), padding: 7, size: 0, values: yTickValues },
            },
            guide: false,
            scale: yScale,
            side: "left" as const,
          },
    },
    svgAnimation: false,
    tooltip: tooltipEnabled && !loading
      ? { className: `bkm-heatmap-tooltip${tooltipInstant ? " bkm-heatmap-tooltip--instant" : ""} ${tooltipClassName}`.trim(), motion: { ...HEATMAP_HOLD_MOTION, duration: tooltipHideDelay }, anchor: tooltipAnchor, offset: TOOLTIP_OFFSET, portal: bklitTooltipPlacement({ animate: false, bottomInset: baseInset }), sticky: false, use: tooltip }
      : false as const,
  };
  return erase(defineChart(erase(spec)));
};

export { buildCellData, buildHeatmapDefinition };
export type { CellDatum };
