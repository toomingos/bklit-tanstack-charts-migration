"use client";

import { Progress } from "@base-ui/react/progress";
import type { CSSProperties, ReactElement } from 'react';
import { useMemo } from 'react';
import { cn } from "./cn";
import { useLegendItem } from './legend-context';

interface LegendProgressProps {
  readonly trackClassName?: string;
  readonly indicatorClassName?: string;
  height?: string;
}

const LegendProgress = ({
  trackClassName = "",
  indicatorClassName = "",
  height = "h-1.5",
}: Readonly<LegendProgressProps>): ReactElement | undefined => {
  const { item } = useLegendItem();

  const indicatorStyle = useMemo((): CSSProperties => ({ backgroundColor: item.color }), [item.color]);

  if ((item.maxValue ?? 0) === 0) {
    return undefined;
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
          style={indicatorStyle}
        />
      </Progress.Track>
    </Progress.Root>
  );
};

LegendProgress.displayName = "LegendProgress";

export type { LegendProgressProps };
export { LegendProgress };
