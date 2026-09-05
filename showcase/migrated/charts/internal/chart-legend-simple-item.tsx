"use client";

import type { CSSProperties, ReactElement } from "react";
import { useMemo } from "react";
import { cn } from "./cn";
import type { LegendItem } from "./chart-legend";

// Simple legend row split out so chart-legend holds only the ChartLegend component.
interface SimpleItemProps {
  readonly item: LegendItem;
  readonly showMarker: boolean;
  readonly showValue: boolean;
  readonly formatValue: (value: number) => string;
  readonly labelClassName: string;
  readonly valueClassName: string;
}

const SimpleItem = ({
  item,
  showMarker,
  showValue,
  formatValue,
  labelClassName,
  valueClassName,
}: Readonly<SimpleItemProps>): ReactElement => {
  const markerStyle = useMemo((): CSSProperties => ({ backgroundColor: item.color }), [item.color]);
  return (
    <div className="flex items-center gap-3">
      {showMarker && (
        <div
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={markerStyle}
        />
      )}

      <span className={cn("flex-1 text-legend-foreground", labelClassName)}>
        {item.label}
      </span>

      {showValue && (
        <span className={cn("text-legend-muted-foreground", valueClassName)}>
          {formatValue(item.value)}
        </span>
      )}
    </div>
  );
};

export { SimpleItem };
export type { SimpleItemProps };
