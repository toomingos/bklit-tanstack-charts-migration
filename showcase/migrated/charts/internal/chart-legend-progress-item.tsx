"use client";

import { Progress } from "@base-ui/react/progress";
import type { ReactElement } from "react";
import { cn } from "@/lib/utils";
import type { LegendItem } from "./chart-legend";

// Fraction-to-percentage scale for value/maxValue legend ratios.
const LEGEND_PERCENT_SCALE = 100;

interface ProgressItemProps {
  readonly item: LegendItem;
  readonly showMarker: boolean;
  readonly showValue: boolean;
  readonly showPercentage: boolean;
  readonly formatValue: (value: number) => string;
  readonly labelClassName: string;
  readonly valueClassName: string;
}

const ProgressItem = ({
  item,
  showMarker,
  showValue,
  showPercentage,
  formatValue,
  labelClassName,
  valueClassName,
}: Readonly<ProgressItemProps>): ReactElement => {
  const maxValue = item.maxValue ?? 0;
  const percentage = maxValue === 0 ? 0 : (item.value / maxValue) * LEGEND_PERCENT_SCALE;

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

      {showValue && (
        <span className={cn("text-legend-muted-foreground", valueClassName)}>
          {formatValue(item.value)}
        </span>
      )}

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

export { ProgressItem, LEGEND_PERCENT_SCALE };
export type { ProgressItemProps };
