"use client";

import type { ReactElement, ReactNode } from "react";
import { intFmt } from "./formatters";
import { cn } from "@/lib/utils";
import { ProgressItem, LEGEND_PERCENT_SCALE } from "./chart-legend-progress-item";
import { SimpleItem } from "./chart-legend-simple-item";

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

interface CustomLegendRowOptions {
  readonly item: LegendItem;
  readonly index: number;
  readonly isHovered: boolean;
  readonly isFaded: boolean;
  readonly percentage: number;
  readonly onHover: ChartLegendProps["onHover"];
  readonly renderItem: NonNullable<ChartLegendProps["renderItem"]>;
}

const renderCustomLegendRow = (options: Readonly<CustomLegendRowOptions>): ReactElement => {
  const { item, index, isHovered, isFaded, percentage, onHover, renderItem } = options;
  return (
    <div
      data-hovered={isHovered ? "" : undefined}
      key={`legend-${item.label}-${item.value}`}
      onMouseEnter={() => onHover?.(index)}
      onMouseLeave={() => onHover?.(null)}
    >
      {renderItem({ index, isFaded, isHovered, item, percentage })}
    </div>
  );
};

interface DefaultLegendRowOptions {
  readonly item: LegendItem;
  readonly index: number;
  readonly isHovered: boolean;
  readonly isFaded: boolean;
  readonly onHover: ChartLegendProps["onHover"];
  readonly showProgress: boolean;
  readonly showMarker: boolean;
  readonly showValue: boolean;
  readonly displayPercentage: boolean;
  readonly formatValue: (value: number) => string;
  readonly labelClassName: string;
  readonly valueClassName: string;
  readonly itemClassName: string;
}

const renderDefaultLegendRow = (options: Readonly<DefaultLegendRowOptions>): ReactElement => {
  const { item, index, isHovered, isFaded, onHover, showProgress, showMarker, showValue } = options;
  const { displayPercentage, formatValue, labelClassName, valueClassName, itemClassName } = options;
  return (
    <div
      className={cn(
        "cursor-pointer rounded-lg px-2 py-1.5 transition-all duration-150 ease-out",
        isHovered && "bg-legend-muted",
        isFaded && "opacity-40",
        itemClassName
      )}
      data-hovered={isHovered ? "" : undefined}
      key={`legend-${item.label}-${item.value}`}
      onMouseEnter={() => onHover?.(index)}
      onMouseLeave={() => onHover?.(null)}
    >
      {showProgress && (item.maxValue ?? 0) !== 0 ? (
        <ProgressItem
          formatValue={formatValue}
          item={item}
          labelClassName={labelClassName}
          showMarker={showMarker}
          showPercentage={displayPercentage}
          showValue={showValue}
          valueClassName={valueClassName}
        />
      ) : (
        <SimpleItem
          formatValue={formatValue}
          item={item}
          labelClassName={labelClassName}
          showMarker={showMarker}
          showValue={showValue}
          valueClassName={valueClassName}
        />
      )}
    </div>
  );
};

type LegendRowOptions = Omit<DefaultLegendRowOptions, "isHovered" | "isFaded"> & {
  readonly hoveredIndex: number | null;
  readonly renderItem: ChartLegendProps["renderItem"];
};

const renderChartLegendRow = (options: Readonly<LegendRowOptions>): ReactElement => {
  const { item, index, hoveredIndex, renderItem } = options;
  const maxValue = item.maxValue ?? 0;
  const percentage = maxValue === 0
    ? 0
    : (item.value / maxValue) * LEGEND_PERCENT_SCALE;
  const isHovered = hoveredIndex === index;
  const isFaded = hoveredIndex !== null && hoveredIndex !== index;
  if (renderItem) {
    return renderCustomLegendRow({ index, isFaded, isHovered, item, onHover: options.onHover, percentage, renderItem });
  }
  return renderDefaultLegendRow({ ...options, isFaded, isHovered });
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
