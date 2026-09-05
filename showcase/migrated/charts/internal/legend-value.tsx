"use client";

import type { ReactElement } from 'react';
import { cn } from "./cn";
import { intFmt } from "./formatters";
import { useLegendItem } from './legend-context';

interface LegendValueProps {
  readonly className?: string;
  readonly showPercentage?: boolean;
  readonly percentageClassName?: string;
  readonly formatValue?: (value: number) => string;
  readonly formatPercentage?: (percentage: number) => string;
}

// Stable default percentage formatter (module scope keeps the default-prop reference stable across renders).
const defaultFormatPercentage = (percentageValue: number): string => `${percentageValue.toFixed(0)}%`;

const LegendValue = ({
  className = "text-sm tabular-nums",
  showPercentage = false,
  percentageClassName = "text-xs tabular-nums",
  formatValue = intFmt,
  formatPercentage = defaultFormatPercentage,
}: Readonly<LegendValueProps>): ReactElement => {
  const { item, percentage } = useLegendItem();

  return (
    <span
      className={cn(
        "flex items-center gap-2 text-legend-muted-foreground",
        className
      )}
    >
      <span>{formatValue(item.value)}</span>
      {showPercentage && (item.maxValue ?? 0) !== 0 && (
        <span className={percentageClassName}>
          {formatPercentage(percentage)}
        </span>
      )}
    </span>
  );
};

LegendValue.displayName = "LegendValue";

export type { LegendValueProps };
export { LegendValue };
