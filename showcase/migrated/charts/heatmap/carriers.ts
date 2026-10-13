"use client";
// Config carriers for HeatmapChart. They render nothing: the chart reads their props
// (see ../kit/read-children) and folds them into one native definition.
import type { CSSProperties } from "react";
import { defineCarrier } from "../kit/role";
import type { HeatmapYAxisLabelFormat, HeatmapYAxisTickFilter } from "./day-labels";
import type { HeatmapSeparatorGradient, HeatmapSeparatorGroupBy, HeatmapSeparatorStrokeStyle } from "./separators";

/** Props of `HeatmapCells`. */
interface HeatmapCellsProps {
  /**
   * Corner radius of each cell in pixels.
   * @default 2
   */
  readonly cornerRadius?: number;
  /** Overrides the chart color scale for the cells. Receives a count and returns a CSS color. */
  readonly colorScale?: (count: number | null | undefined) => string;
  /**
   * Opacity of the cells that are not highlighted while hovering a cell or a legend level.
   * @default 0.3
   */
  readonly inactiveOpacity?: number;
  /**
   * Scale of the cells that are not highlighted while hovering.
   * @default 1
   */
  readonly inactiveScale?: number;
  /**
   * Scale of the highlighted cell while hovering.
   * @default 1
   */
  readonly activeScale?: number;
  /**
   * Opacity per display row (row `0` is the top row after `weekStartDay` rotation). A single number applies to every row; an array gives one value per row. Pass the same value to `HeatmapYAxis` to keep labels aligned.
   * @default 1
   */
  readonly rowOpacity?: number | readonly number[];
  /**
   * Enables pointer hover, dimming, tooltip and keyboard focus on the cells.
   * @default true
   */
  readonly interactive?: boolean;
  /**
   * Hides the out-of-range cells at the start and end of the grid (GitHub style).
   * @default true
   */
  readonly hideGhostCells?: boolean;
  /** Accessible name of the chart. `HeatmapChart` `ariaLabel` takes precedence. */
  readonly ariaLabel?: string;
  /** Accessible description of the chart. `HeatmapChart` `ariaDescription` takes precedence. */
  readonly ariaDescription?: string;
}

/** Props of `HeatmapXAxis`. */
interface HeatmapXAxisProps {
  /** Accepted for bklit compatibility; it has no effect. */
  readonly className?: string;
}

/** Props of `HeatmapYAxis`. */
interface HeatmapYAxisProps {
  /** Accepted for bklit compatibility; it has no effect. */
  readonly className?: string;
  /**
   * Which rows get a weekday label: every row, odd rows (Mon, Wed, Fri with a Sunday start) or even rows.
   * @default "odd"
   */
  readonly tickFilter?: HeatmapYAxisTickFilter;
  /**
   * `"full"` shows the abbreviated weekday (Mon); `"initial"` shows its first letter (M).
   * @default "full"
   */
  readonly labelFormat?: HeatmapYAxisLabelFormat;
  /** Opacity per display row for the labels. Pass the same value as `HeatmapCells` so faded rows and their labels stay aligned. */
  readonly rowOpacity?: number | readonly number[];
}

/** Props of `HeatmapTooltip`. */
interface HeatmapTooltipProps {
  /**
   * Custom text for the contribution line of the tooltip. Receives the count and the cell date.
   * @default `N contribution(s)`
   */
  readonly formatLabel?: (count: number, date: Readonly<Date>) => string;
  /** Additional class name for the tooltip panel. */
  readonly className?: string;
  /** Inline styles for the tooltip panel. */
  readonly panelStyle?: Readonly<CSSProperties>;
  /** Background of the tooltip panel (a CSS color or variable). */
  readonly backgroundColor?: string;
  /**
   * Shows and hides the tooltip without enter or exit motion; the hide is still held for `hideDelay`.
   * @default false
   */
  readonly instant?: boolean;
  /**
   * Delay in milliseconds before the tooltip first appears. Moving between cells updates it immediately.
   * @default 0
   */
  readonly showDelay?: number;
  /**
   * Hold in milliseconds after the pointer leaves a cell before the tooltip hides. Reduces flicker between adjacent cells.
   * @default 120
   */
  readonly hideDelay?: number;
}

/** Props of `HeatmapSeparator`. */
interface HeatmapSeparatorProps {
  /** Inserts a separator before every Nth column when `groupBy` is `"every"`. */
  readonly every?: number;
  /**
   * Groups columns by a fixed interval (`"every"`) or by calendar quarter (`"quarter"`).
   * @default "every"
   */
  readonly groupBy?: HeatmapSeparatorGroupBy;
  /** Accepted for bklit compatibility; it has no effect. */
  readonly className?: string;
  /**
   * Extra horizontal gap between column groups in pixels.
   * @default 0
   */
  readonly spacing?: number;
  /** Accepted for bklit compatibility; it has no effect. */
  readonly paddingX?: number;
  /**
   * Inset of the line from the bottom of the plot in pixels.
   * @default 0
   */
  readonly paddingY?: number;
  /**
   * Distance from the container top to the start of the line in pixels. Use it to align the line with the month labels.
   * @default the top of the plot
   */
  readonly startOffset?: number;
  /**
   * Distance below the top of the line at which quarter labels sit; `0` aligns them with the line top.
   * @default 0
   */
  readonly labelOffset?: number;
  /**
   * Draws a label at the start of each quarter group.
   * @default false
   */
  readonly showLabels?: boolean;
  /**
   * Formats the quarter labels. Receives the quarter (1 to 4) and the start date of the group.
   * @default `Q{n}`
   */
  readonly labelFormat?: (quarter: number, startDate: Readonly<Date>) => string;
  /** Accepted for bklit compatibility; it has no effect. */
  readonly labelClassName?: string;
  /**
   * Solid or dashed line.
   * @default "solid"
   */
  readonly strokeStyle?: HeatmapSeparatorStrokeStyle;
  /**
   * Dash pattern used when `strokeStyle` is `"dashed"`.
   * @default "4,4"
   */
  readonly strokeDasharray?: string;
  /**
   * Line color, used when `gradient` is omitted.
   * @default "var(--bkm-border)"
   */
  readonly stroke?: string;
  /** Vertical gradient along each line, for fading the ends. Omit for a flat stroke. */
  readonly gradient?: Readonly<HeatmapSeparatorGradient>;
  /**
   * Line width in pixels.
   * @default 1
   */
  readonly strokeWidth?: number;
  /**
   * Opacity multiplier for a solid stroke or for the gradient stops.
   * @default 1
   */
  readonly strokeOpacity?: number;
}

/** Configures the grid of cells (corner radius, hover dimming, row opacity). Renders nothing itself; `HeatmapChart` reads its props. Required for the grid to draw. */
const HeatmapCells = /* @__PURE__ */ defineCarrier<HeatmapCellsProps>("heatmapCells", "HeatmapCells");
/** Shows month labels above the grid. Renders nothing itself; `HeatmapChart` reads its presence. */
const HeatmapXAxis = /* @__PURE__ */ defineCarrier<HeatmapXAxisProps>("heatmapXAxis", "HeatmapXAxis");
/** Shows weekday labels left of the grid; they follow `weekStartDay` on `HeatmapChart`. Renders nothing itself; `HeatmapChart` reads its props. */
const HeatmapYAxis = /* @__PURE__ */ defineCarrier<HeatmapYAxisProps>("heatmapYAxis", "HeatmapYAxis");
/** Enables the hover and keyboard tooltip showing the date and contribution count of a cell. Renders nothing itself; `HeatmapChart` reads its props. */
const HeatmapTooltip = /* @__PURE__ */ defineCarrier<HeatmapTooltipProps>("heatmapTooltip", "HeatmapTooltip");
/** Draws vertical separators between groups of columns (every N columns or per quarter), with optional quarter labels. Renders nothing itself; `HeatmapChart` reads its props. */
const HeatmapSeparator = /* @__PURE__ */ defineCarrier<HeatmapSeparatorProps>("heatmapSeparator", "HeatmapSeparator");


export { HeatmapCells, HeatmapSeparator, HeatmapTooltip, HeatmapXAxis, HeatmapYAxis };
export type { HeatmapCellsProps, HeatmapSeparatorProps, HeatmapTooltipProps, HeatmapXAxisProps, HeatmapYAxisProps };
