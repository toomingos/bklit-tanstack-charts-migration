"use client";

import { Progress } from "@base-ui/react/progress";
import type { ReactElement } from 'react';
import { cn } from "@/lib/utils";
import { useLegendItem } from './legend-context';

interface LegendProgressProps {
  trackClassName?: string;
  indicatorClassName?: string;
  height?: string;
}

const LegendProgress = ({
  trackClassName = "",
  indicatorClassName = "",
  height = "h-1.5",
}: Readonly<LegendProgressProps>): ReactElement | null => {
  const { item } = useLegendItem();

  if ((item.maxValue ?? 0) === 0) {
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
};

LegendProgress.displayName = "LegendProgress";

export type { LegendProgressProps };
export { LegendProgress };
