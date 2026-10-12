// Config carriers for HeatmapChart. They render nothing: the chart reads their props
// (see ../kit/read-children) and folds them into one native definition.
import type { CSSProperties } from "react";
import { defineCarrier } from "../kit/role";
import type { HeatmapYAxisLabelFormat, HeatmapYAxisTickFilter } from "./day-labels";
import type { HeatmapSeparatorGradient, HeatmapSeparatorGroupBy, HeatmapSeparatorStrokeStyle } from "./separators";

interface HeatmapCellsProps {
  readonly cornerRadius?: number;
  readonly colorScale?: (count: number | null | undefined) => string;
  readonly inactiveOpacity?: number;
  readonly inactiveScale?: number;
  readonly activeScale?: number;
  readonly rowOpacity?: number | readonly number[];
  readonly interactive?: boolean;
  readonly hideGhostCells?: boolean;
  readonly ariaLabel?: string;
  readonly ariaDescription?: string;
}

interface HeatmapXAxisProps {
  readonly className?: string;
}

interface HeatmapYAxisProps {
  readonly className?: string;
  readonly tickFilter?: HeatmapYAxisTickFilter;
  readonly labelFormat?: HeatmapYAxisLabelFormat;
  readonly rowOpacity?: number | readonly number[];
}

interface HeatmapTooltipProps {
  readonly formatLabel?: (count: number, date: Readonly<Date>) => string;
  readonly className?: string;
  readonly panelStyle?: Readonly<CSSProperties>;
  readonly backgroundColor?: string;
  /** No enter/leave motion; the leave is held for `hideDelay`. */
  readonly instant?: boolean;
  /** Delay before the tooltip first appears (ms, default 0); moving between cells updates immediately. */
  readonly showDelay?: number;
  /** Hold after the pointer leaves a cell (ms, default 120); applies to the `instant` tooltip. */
  readonly hideDelay?: number;
}

interface HeatmapSeparatorProps {
  readonly every?: number;
  readonly groupBy?: HeatmapSeparatorGroupBy;
  readonly className?: string;
  readonly spacing?: number;
  readonly paddingX?: number;
  readonly paddingY?: number;
  readonly startOffset?: number;
  readonly labelOffset?: number;
  readonly showLabels?: boolean;
  readonly labelFormat?: (quarter: number, startDate: Readonly<Date>) => string;
  readonly labelClassName?: string;
  readonly strokeStyle?: HeatmapSeparatorStrokeStyle;
  readonly strokeDasharray?: string;
  readonly stroke?: string;
  readonly gradient?: Readonly<HeatmapSeparatorGradient>;
  readonly strokeWidth?: number;
  readonly strokeOpacity?: number;
}

const HeatmapCells = /* @__PURE__ */ defineCarrier<HeatmapCellsProps>("heatmapCells", "HeatmapCells");
const HeatmapXAxis = /* @__PURE__ */ defineCarrier<HeatmapXAxisProps>("heatmapXAxis", "HeatmapXAxis");
const HeatmapYAxis = /* @__PURE__ */ defineCarrier<HeatmapYAxisProps>("heatmapYAxis", "HeatmapYAxis");
const HeatmapTooltip = /* @__PURE__ */ defineCarrier<HeatmapTooltipProps>("heatmapTooltip", "HeatmapTooltip");
const HeatmapSeparator = /* @__PURE__ */ defineCarrier<HeatmapSeparatorProps>("heatmapSeparator", "HeatmapSeparator");


export { HeatmapCells, HeatmapSeparator, HeatmapTooltip, HeatmapXAxis, HeatmapYAxis };
export type { HeatmapCellsProps, HeatmapSeparatorProps, HeatmapTooltipProps, HeatmapXAxisProps, HeatmapYAxisProps };
