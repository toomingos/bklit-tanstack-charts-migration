"use client";

import type { ReactElement } from "react";
import { cn } from "@/lib/utils";
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
}: Readonly<SimpleItemProps>): ReactElement => (
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

      {showValue && (
        <span className={cn("text-legend-muted-foreground", valueClassName)}>
          {formatValue(item.value)}
        </span>
      )}
    </div>
  );

export { SimpleItem };
export type { SimpleItemProps };
