"use client";

import type { CSSProperties, ReactElement } from "react";
import type { ChartMarker } from "./types";
import { MarkerTooltipRow } from "./marker-tooltip-row";

// Tooltip content for chart markers; the active-marker store and hooks live in active-markers-store.ts and the provider in marker-active-tooltip-provider.tsx.
// Import the store, provider, and hooks from those sibling modules directly.

const MAX_TOOLTIP_MARKERS = 2;
const LIST_BORDER_STYLE: CSSProperties = { borderTop: "1px solid var(--chart-tooltip-muted)" };
const MORE_COUNT_STYLE: CSSProperties = { color: "var(--chart-tooltip-muted)" };

interface MarkerTooltipContentProps {
  readonly markers: readonly Readonly<ChartMarker>[];
}

const MarkerTooltipContent = ({ markers }: Readonly<MarkerTooltipContentProps>): ReactElement | null => {
  if (markers.length === 0) {
    return null;
  }

  const visibleMarkers = markers.slice(0, MAX_TOOLTIP_MARKERS);
  const hiddenCount = markers.length - MAX_TOOLTIP_MARKERS;

  return (
    <div className="mt-2 space-y-2 pt-2" style={LIST_BORDER_STYLE}>
      {visibleMarkers.map((marker) => (
        <MarkerTooltipRow key={marker.title} marker={marker} />
      ))}
      {hiddenCount > 0 && (
        <div className="pl-7 text-xs" style={MORE_COUNT_STYLE}>
          +{hiddenCount} more...
        </div>
      )}
    </div>
  );
};
MarkerTooltipContent.displayName = "MarkerTooltipContent";

export { MarkerTooltipContent };
export type { MarkerTooltipContentProps };
