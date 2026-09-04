import type { ReactElement } from "react";
import type { ChartMarker } from "./types";
import { MarkerIconBadge } from "./marker-icon-badge";
import { MarkerDefaultBody } from "./marker-default-body";

interface MarkerTooltipRowProps {
  readonly marker: Readonly<ChartMarker>;
}

// Extracted from marker-tooltip.tsx (react(jsx-max-depth)): one marker's icon badge plus content.
// Callers key each instance on `marker.title` (see MarkerTooltipContent).
const MarkerTooltipRow = ({ marker }: Readonly<MarkerTooltipRowProps>): ReactElement => {
  const isClickable = marker.onClick !== undefined || marker.href !== undefined;
  return (
    <div className="flex items-start gap-2">
      <MarkerIconBadge marker={marker} />
      <div className="min-w-0 flex-1">
        {marker.content ?? <MarkerDefaultBody isClickable={isClickable} marker={marker} />}
      </div>
    </div>
  );
};
MarkerTooltipRow.displayName = "MarkerTooltipRow";

export { MarkerTooltipRow };
export type { MarkerTooltipRowProps };
