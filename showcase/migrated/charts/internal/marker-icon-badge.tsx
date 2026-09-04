import { useMemo } from "react";
import type { CSSProperties, ReactElement } from "react";
import type { ChartMarker } from "./types";

const BADGE_BORDER = "1px solid var(--chart-marker-border)";
const BADGE_DEFAULT_BACKGROUND = "var(--chart-marker-background)";
const ICON_STYLE: CSSProperties = { color: "var(--chart-marker-foreground)" };

interface MarkerIconBadgeProps {
  marker: Readonly<ChartMarker>;
}

// Extracted from marker-tooltip.tsx (react(jsx-max-depth) splits the tooltip row).
// This component owns the small circular icon chip.
const MarkerIconBadge = ({ marker }: Readonly<MarkerIconBadgeProps>): ReactElement => {
  const badgeStyle = useMemo<CSSProperties>(
    () => ({
      backgroundColor: marker.color ?? BADGE_DEFAULT_BACKGROUND,
      border: BADGE_BORDER,
    }),
    [marker.color],
  );
  return (
    <div
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
      style={badgeStyle}
    >
      <span className="text-xs" style={ICON_STYLE}>
        {marker.icon}
      </span>
    </div>
  );
};
MarkerIconBadge.displayName = "MarkerIconBadge";

export { MarkerIconBadge };
export type { MarkerIconBadgeProps };
