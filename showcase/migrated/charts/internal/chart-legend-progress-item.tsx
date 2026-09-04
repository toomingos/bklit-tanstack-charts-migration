"use client";

import { Progress } from "@base-ui/react/progress";
import type { CSSProperties, ReactElement } from "react";
import { cn } from "@/lib/utils";
import type { LegendItem } from "./chart-legend";

// Fraction-to-percentage scale for value/maxValue legend ratios.
// Fallback for a missing or empty progress maximum; zero disables the ratio.
// Fraction digits for the whole-percent legend label.
const LEGEND_PERCENT_SCALE = 100;
const LEGEND_EMPTY_VALUE = 0;
const LEGEND_PERCENT_FRACTION_DIGITS = 0;

// Builds the color style for a legend swatch; hoisted so the row stays short.
const buildItemColorStyle = (color: string): CSSProperties => ({
  backgroundColor: color,
});

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
  const maxValue = item.maxValue ?? LEGEND_EMPTY_VALUE;
  const percentage = maxValue === LEGEND_EMPTY_VALUE ? LEGEND_EMPTY_VALUE : (item.value / maxValue) * LEGEND_PERCENT_SCALE;

  return (
    <Progress.Root
      className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1"
      max={item.maxValue}
      value={item.value}
    >
      {showMarker && (
        <div
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={buildItemColorStyle(item.color)}
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
          style={buildItemColorStyle(item.color)}
        />
      </Progress.Track>

      {showPercentage && (
        <span className="col-start-3 text-legend-muted-foreground text-xs tabular-nums">
          {percentage.toFixed(LEGEND_PERCENT_FRACTION_DIGITS)}%
        </span>
      )}
    </Progress.Root>
  );
}

export { ProgressItem, LEGEND_PERCENT_SCALE };
export type { ProgressItemProps };
