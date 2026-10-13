"use client";

import type { ReactElement, ReactNode } from "react";
import { cn } from "../cn";
import { intFmt } from "../format";
import { LEGEND_PERCENT_SCALE } from "./chart-legend-progress-item";
import { CustomLegendRow } from "./chart-legend-custom-row";
import { DefaultLegendRow } from "./chart-legend-default-row";

/** One entry of a `ChartLegend`. */
interface LegendItem {
  /** Name shown for the item. */
  readonly label: string;
  /** Current value of the item. */
  readonly value: number;
  /** Value that counts as 100%. Drives the percentage and `LegendProgress`; both are hidden when it is missing or zero. */
  readonly maxValue?: number;
  /** Color of the marker and the progress bar. */
  readonly color: string;
}

/** Props of `ChartLegend`. */
interface ChartLegendProps {
  /** The items to list. */
  readonly items: LegendItem[];
  /**
   * Hovered item index (`null` for none). Pair it with `onHover` to share hover with a chart.
   * @default null
   */
  readonly hoveredIndex?: number | null;
  /** Called with the item index when the pointer enters a row, and `null` when it leaves. */
  readonly onHover?: (index: number | null) => void;
  /**
   * Show a progress bar under each item that has a `maxValue`.
   * @default false
   */
  readonly showProgress?: boolean;
  /**
   * Show the colored dot before each label.
   * @default true
   */
  readonly showMarker?: boolean;
  /**
   * Show each item's value.
   * @default true
   */
  readonly showValue?: boolean;
  /**
   * Show each item's percentage of `maxValue`.
   * @default the value of `showProgress`
   */
  readonly showPercentage?: boolean;
  /**
   * Formats each value.
   * @default en-US number format, for example "1,234"
   */
  readonly formatValue?: (value: number) => string;
  /** Heading shown above the items. */
  readonly title?: string;
  /** Class names added to the legend container. */
  readonly className?: string;
  /** Class names added to the title, on top of the default title style. */
  readonly titleClassName?: string;
  /** Class names added to each row. */
  readonly itemClassName?: string;
  /** Class names that replace the default label text style. */
  readonly labelClassName?: string;
  /** Class names that replace the default value text style. */
  readonly valueClassName?: string;
  /**
   * Renders a row yourself. Receives the item, its index, hover flags and its percentage of `maxValue`. When set, the `show*` options are ignored.
   */
  readonly renderItem?: (props: Readonly<{
    readonly item: LegendItem;
    readonly index: number;
    readonly isHovered: boolean;
    readonly isFaded: boolean;
    readonly percentage: number;
  }>) => ReactNode;
}

interface LegendRowOptions {
  readonly displayPercentage: boolean;
  readonly formatValue: (value: number) => string;
  readonly hoveredIndex: number | null;
  readonly index: number;
  readonly item: LegendItem;
  readonly itemClassName: string;
  readonly labelClassName: string;
  readonly onHover: ChartLegendProps["onHover"];
  readonly renderItem: ChartLegendProps["renderItem"];
  readonly showMarker: boolean;
  readonly showProgress: boolean;
  readonly showValue: boolean;
  readonly valueClassName: string;
}

const renderChartLegendRow = (options: Readonly<LegendRowOptions>): ReactElement => {
  const { item, index, hoveredIndex, renderItem, onHover: handleHover } = options;
  const maxValue = item.maxValue ?? 0;
  const percentage = maxValue === 0
    ? 0
    : (item.value / maxValue) * LEGEND_PERCENT_SCALE;
  const isHovered = hoveredIndex === index;
  const isFaded = hoveredIndex !== null && hoveredIndex !== index;
  if (renderItem) {
    return (
      <CustomLegendRow
        index={index}
        isFaded={isFaded}
        isHovered={isHovered}
        item={item}
        key={`legend-${item.label}-${item.value}`}
        onHover={handleHover}
        percentage={percentage}
        renderItem={renderItem}
      />
    );
  }
  return (
    <DefaultLegendRow
      displayPercentage={options.displayPercentage}
      formatValue={options.formatValue}
      index={index}
      isFaded={isFaded}
      isHovered={isHovered}
      item={item}
      itemClassName={options.itemClassName}
      key={`legend-${item.label}-${item.value}`}
      labelClassName={options.labelClassName}
      onHover={handleHover}
      showMarker={options.showMarker}
      showProgress={options.showProgress}
      showValue={options.showValue}
      valueClassName={options.valueClassName}
    />
  );
};

/**
 * A ready-made legend list with a marker, label, value and optional progress bar per item, driven by props. Use `Legend` instead when you need to compose the rows yourself.
 */
const ChartLegend = ({
  items,
  hoveredIndex = null,
  onHover,
  showProgress = false,
  showMarker = true,
  showValue = true,
  showPercentage,
  formatValue = intFmt,
  title,
  className = "",
  titleClassName = "bk-text-sm bk-font-semibold",
  itemClassName = "",
  labelClassName = "bk-text-sm bk-font-medium",
  valueClassName = "bk-text-sm bk-tabular-nums",
  renderItem,
}: Readonly<ChartLegendProps>): ReactElement => {
  const displayPercentage = showPercentage ?? showProgress;

  return (
    <div className={cn("legend-container bk-legend", className)} data-hovered-any={hoveredIndex === null ? undefined : ""} data-slot="legend">
      {(title ?? "").length > 0 && (
        <h3 className={cn("bk-legend-title", titleClassName)}>
          {title}
        </h3>
      )}
      {items.map((item, i) => renderChartLegendRow({
        displayPercentage,
        formatValue,
        hoveredIndex,
        index: i,
        item,
        itemClassName,
        labelClassName,
        onHover,
        renderItem,
        showMarker,
        showProgress,
        showValue,
        valueClassName,
      }))}
    </div>
  );
}

ChartLegend.displayName = "ChartLegend";

export { ChartLegend };
export type { LegendItem, ChartLegendProps };
