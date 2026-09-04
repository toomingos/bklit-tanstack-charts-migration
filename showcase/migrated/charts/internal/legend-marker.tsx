"use client";

import type { ReactElement } from 'react';
import { cn } from "@/lib/utils";
import { useLegendItem } from './legend-context';

interface LegendMarkerProps {
  className?: string;
}

const LegendMarker = ({ className = "h-2.5 w-2.5" }: Readonly<LegendMarkerProps>): ReactElement => {
  const { item } = useLegendItem();

  return (
    <div
      className={cn("shrink-0 rounded-full", className)}
      style={{ backgroundColor: item.color }}
    />
  );
};

LegendMarker.displayName = "LegendMarker";

export type { LegendMarkerProps };
export { LegendMarker };
