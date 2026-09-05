"use client";

import type { CSSProperties, ReactElement } from 'react';
import { useMemo } from 'react';
import { cn } from "./cn";
import { useLegendItem } from './legend-context';

interface LegendMarkerProps {
  readonly className?: string;
}

const LegendMarker = ({ className = "h-2.5 w-2.5" }: Readonly<LegendMarkerProps>): ReactElement => {
  const { item } = useLegendItem();

  const markerStyle = useMemo((): CSSProperties => ({ backgroundColor: item.color }), [item.color]);

  return (
    <div
      className={cn("shrink-0 rounded-full", className)}
      style={markerStyle}
    />
  );
};

LegendMarker.displayName = "LegendMarker";

export type { LegendMarkerProps };
export { LegendMarker };
