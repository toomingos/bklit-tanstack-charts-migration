"use client";

import type { ReactElement, ReactNode } from "react";
import { intFmt } from "./formatters";
import { cn } from "@/lib/utils";
import { LEGEND_PERCENT_SCALE } from "./chart-legend-progress-item";
import { CustomLegendRow } from "./chart-legend-custom-row";
import { DefaultLegendRow } from "./chart-legend-default-row";

interface LegendItem {
  readonly label: string;
  readonly value: number;
  readonly maxValue?: number;
  readonly color: string;
}

interface ChartLegendProps {
  readonly items: readonly LegendItem[];
  readonly hoveredIndex?: number | null;
  readonly onHover?: (index: number | null) => void;
  readonly showProgress?: boolean;
  readonly showMarker?: boolean;
  readonly showValue?: boolean;
  readonly showPercentage?: boolean;
  readonly formatValue?: (value: number) => string;
  readonly title?: string;
  readonly className?: string;
  readonly titleClassName?: string;
  readonly itemClassName?: string;
  readonly labelClassName?: string;
  readonly valueClassName?: string;
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
  titleClassName = "text-sm font-semibold",
  itemClassName = "",
  labelClassName = "text-sm font-medium",
  valueClassName = "text-sm tabular-nums",
  renderItem,
}: Readonly<ChartLegendProps>): ReactElement => {
  const displayPercentage = showPercentage ?? showProgress;

  return (
    <div className={cn("legend-container flex flex-col gap-2", className)}>
      {(title ?? "").length > 0 && (
        <h3 className={cn("mb-1 text-legend-foreground", titleClassName)}>
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

export default ChartLegend;
