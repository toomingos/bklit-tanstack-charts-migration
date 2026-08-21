"use client";

import { Progress } from "@base-ui/react/progress";
import {
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import {
  type LegendItemData,
  LegendItemProvider,
  LegendProvider,
  useLegend,
  useLegendItem,
} from "./legend-context";

export interface LegendProps {
  items: LegendItemData[];
  hoveredIndex?: number | null;
  onHoverChange?: (index: number | null) => void;
  title?: string;
  titleClassName?: string;
  className?: string;
  children: ReactElement;
}

export function Legend({
  items,
  hoveredIndex: controlledHoveredIndex,
  onHoverChange,
  title,
  titleClassName = "text-sm font-semibold",
  className = "",
  children,
}: LegendProps) {
  const [internalHoveredIndex, setInternalHoveredIndex] = useState<
    number | null
  >(null);

  const isControlled = controlledHoveredIndex !== undefined;
  const hoveredIndex = isControlled
    ? controlledHoveredIndex
    : internalHoveredIndex;
  const setHoveredIndex = (index: number | null) => {
    if (isControlled) {
      onHoverChange?.(index);
    } else {
      setInternalHoveredIndex(index);
    }
  };

  const contextValue = {
    items,
    hoveredIndex,
    setHoveredIndex,
  };

  return (
    <LegendProvider value={contextValue}>
      <div className={cn("legend-container flex flex-col gap-2", className)}>
        {title && (
          <h3 className={cn("mb-1 text-legend-foreground", titleClassName)}>
            {title}
          </h3>
        )}
        {items.map((item, index) => {
          const isHovered = hoveredIndex === index;
          const isFaded = hoveredIndex !== null && hoveredIndex !== index;
          const percentage = item.maxValue
            ? (item.value / item.maxValue) * 100
            : 0;

          const itemContext = {
            item,
            index,
            isHovered,
            isFaded,
            percentage,
          };

          if (isValidElement(children)) {
            return (
              <LegendItemProvider key={item.label} value={itemContext}>
                {cloneElement(children)}
              </LegendItemProvider>
            );
          }

          return null;
        })}
      </div>
    </LegendProvider>
  );
}

Legend.displayName = "Legend";

export interface LegendItemProps {
  className?: string;
  children: ReactNode;
}

export function LegendItem({ className = "", children }: LegendItemProps) {
  const { setHoveredIndex } = useLegend();
  const { index, isHovered } = useLegendItem();

  return (
    <div
      className={cn(
        "cursor-pointer rounded-lg px-2 py-1.5 transition-all duration-150 ease-out",
        isHovered && "bg-legend-muted",
        className
      )}
      data-hovered={isHovered ? "" : undefined}
      onMouseEnter={() => setHoveredIndex(index)}
      onMouseLeave={() => setHoveredIndex(null)}
    >
      {children}
    </div>
  );
}

LegendItem.displayName = "LegendItem";

export interface LegendMarkerProps {
  className?: string;
}

export function LegendMarker({ className = "h-2.5 w-2.5" }: LegendMarkerProps) {
  const { item } = useLegendItem();

  return (
    <div
      className={cn("shrink-0 rounded-full", className)}
      style={{ backgroundColor: item.color }}
    />
  );
}

LegendMarker.displayName = "LegendMarker";

export interface LegendLabelProps {
  className?: string;
}

export function LegendLabel({
  className = "text-sm font-medium",
}: LegendLabelProps) {
  const { item } = useLegendItem();

  return (
    <span className={cn("text-legend-foreground", className)}>
      {item.label}
    </span>
  );
}

LegendLabel.displayName = "LegendLabel";

const intFmt = new Intl.NumberFormat("en-US").format;

export interface LegendValueProps {
  className?: string;
  showPercentage?: boolean;
  percentageClassName?: string;
  formatValue?: (value: number) => string;
  formatPercentage?: (percentage: number) => string;
}

export function LegendValue({
  className = "text-sm tabular-nums",
  showPercentage = false,
  percentageClassName = "text-xs tabular-nums",
  formatValue = intFmt,
  formatPercentage = (p) => `${p.toFixed(0)}%`,
}: LegendValueProps) {
  const { item, percentage } = useLegendItem();

  return (
    <span
      className={cn(
        "flex items-center gap-2 text-legend-muted-foreground",
        className
      )}
    >
      <span>{formatValue(item.value)}</span>
      {showPercentage && item.maxValue && (
        <span className={percentageClassName}>
          {formatPercentage(percentage)}
        </span>
      )}
    </span>
  );
}

LegendValue.displayName = "LegendValue";

export interface LegendProgressProps {
  trackClassName?: string;
  indicatorClassName?: string;
  height?: string;
}

export function LegendProgress({
  trackClassName = "",
  indicatorClassName = "",
  height = "h-1.5",
}: LegendProgressProps) {
  const { item } = useLegendItem();

  if (!item.maxValue) {
    return null;
  }

  return (
    <Progress.Root max={item.maxValue} value={item.value}>
      <Progress.Track
        className={cn(
          "w-full overflow-hidden rounded-full bg-legend-track",
          height,
          trackClassName
        )}
      >
        <Progress.Indicator
          className={cn(
            "h-full rounded-full transition-all duration-500",
            indicatorClassName
          )}
          style={{ backgroundColor: item.color }}
        />
      </Progress.Track>
    </Progress.Root>
  );
}

LegendProgress.displayName = "LegendProgress";
