"use client";

import { Progress } from "@base-ui/react/progress";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const intFmt = new Intl.NumberFormat("en-US").format;

export interface LegendItem {
  label: string;
  value: number;
  maxValue?: number;
  color: string;
}

export interface ChartLegendProps {
  items: LegendItem[];
  hoveredIndex?: number | null;
  onHover?: (index: number | null) => void;
  showProgress?: boolean;
  showMarker?: boolean;
  showValue?: boolean;
  showPercentage?: boolean;
  formatValue?: (value: number) => string;
  title?: string;
  className?: string;
  titleClassName?: string;
  itemClassName?: string;
  labelClassName?: string;
  valueClassName?: string;
  renderItem?: (props: {
    item: LegendItem;
    index: number;
    isHovered: boolean;
    isFaded: boolean;
    percentage: number;
  }) => ReactNode;
}

interface ProgressItemProps {
  item: LegendItem;
  showMarker: boolean;
  showValue: boolean;
  showPercentage: boolean;
  formatValue: (value: number) => string;
  labelClassName: string;
  valueClassName: string;
}

function ProgressItem({
  item,
  showMarker,
  showValue,
  showPercentage,
  formatValue,
  labelClassName,
  valueClassName,
}: ProgressItemProps) {
  const percentage = item.maxValue ? (item.value / item.maxValue) * 100 : 0;

  return (
    <Progress.Root
      className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1"
      max={item.maxValue}
      value={item.value}
    >
      {showMarker && (
        <div
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: item.color }}
        />
      )}

      <Progress.Label className={cn("text-legend-foreground", labelClassName)}>
        {item.label}
      </Progress.Label>

      {showValue ? (
        <span className={cn("text-legend-muted-foreground", valueClassName)}>
          {formatValue(item.value)}
        </span>
      ) : null}

      <Progress.Track className="col-span-full h-1.5 overflow-hidden rounded-full bg-legend-track">
        <Progress.Indicator
          className="h-full rounded-full transition-all duration-500"
          style={{ backgroundColor: item.color }}
        />
      </Progress.Track>

      {showPercentage && (
        <span className="col-start-3 text-legend-muted-foreground text-xs tabular-nums">
          {percentage.toFixed(0)}%
        </span>
      )}
    </Progress.Root>
  );
}

interface SimpleItemProps {
  item: LegendItem;
  showMarker: boolean;
  showValue: boolean;
  formatValue: (value: number) => string;
  labelClassName: string;
  valueClassName: string;
}

function SimpleItem({
  item,
  showMarker,
  showValue,
  formatValue,
  labelClassName,
  valueClassName,
}: SimpleItemProps) {
  return (
    <div className="flex items-center gap-3">
      {showMarker && (
        <div
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: item.color }}
        />
      )}

      <span className={cn("flex-1 text-legend-foreground", labelClassName)}>
        {item.label}
      </span>

      {showValue ? (
        <span className={cn("text-legend-muted-foreground", valueClassName)}>
          {formatValue(item.value)}
        </span>
      ) : null}
    </div>
  );
}

export function ChartLegend({
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
}: ChartLegendProps) {
  const displayPercentage = showPercentage ?? showProgress;

  return (
    <div className={cn("legend-container flex flex-col gap-2", className)}>
      {title && (
        <h3 className={cn("mb-1 text-legend-foreground", titleClassName)}>
          {title}
        </h3>
      )}
      {items.map((item, i) => {
        const percentage = item.maxValue
          ? (item.value / item.maxValue) * 100
          : 0;
        const isHovered = hoveredIndex === i;
        const isFaded = hoveredIndex !== null && hoveredIndex !== i;

        if (renderItem) {
          return (
            <div
              data-hovered={isHovered ? "" : undefined}
              key={`legend-${item.label}-${item.value}`}
              onMouseEnter={() => onHover?.(i)}
              onMouseLeave={() => onHover?.(null)}
            >
              {renderItem({ item, index: i, isHovered, isFaded, percentage })}
            </div>
          );
        }

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
            onMouseEnter={() => onHover?.(i)}
            onMouseLeave={() => onHover?.(null)}
          >
            {showProgress && item.maxValue ? (
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
      })}
    </div>
  );
}

ChartLegend.displayName = "ChartLegend";

export default ChartLegend;
