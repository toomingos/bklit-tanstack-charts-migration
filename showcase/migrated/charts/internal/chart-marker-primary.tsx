import { useMemo } from "react";
import type { CSSProperties, ReactElement } from "react";
import type { ChartMarker } from "./types";
import { Badge } from "./chart-marker-badge";
import { MarkerCircleHtml } from "./chart-marker-circle";

const MARKER_FAN_COLLAPSE_SCALE = 0.6;
const MARKER_PRE_REVEAL_SCALE = 0.85;
const MARKER_BLURRED_FILTER = "blur(2px)";
const MARKER_SHARP_FILTER = "blur(0px)";

const resolvePrimaryFilter = (revealed: boolean, shouldFan: boolean): string => {
  if (!revealed) {
    return MARKER_BLURRED_FILTER;
  }
  return shouldFan ? MARKER_BLURRED_FILTER : MARKER_SHARP_FILTER;
};

export interface MarkerPrimaryProps {
  readonly primaryMarker: ChartMarker;
  count: number;
  readonly size: number;
  readonly revealed: boolean;
  readonly shouldFan: boolean;
  readonly onEnter: () => void;
  readonly onLeave: () => void;
}

/*
 * Outer wrapper is already `position: absolute` at size x size, so it doubles as Badge's positioning context.
 * No separate relative-sized child wrapper is needed.
 */
export const MarkerPrimary = ({
  primaryMarker,
  count,
  size,
  revealed,
  shouldFan,
  onEnter,
  onLeave,
}: Readonly<MarkerPrimaryProps>): ReactElement => {
  const collapsedOpacity = shouldFan ? 0 : 1;
  const collapsedScale = shouldFan ? MARKER_FAN_COLLAPSE_SCALE : 1;
  const handlePrimaryClick = (): void => {
    primaryMarker.onClick?.();
  };

  const primaryStyle = useMemo<CSSProperties>(
    () => ({
      cursor: "pointer",
      filter: resolvePrimaryFilter(revealed, shouldFan),
      height: size,
      left: -size / 2,
      opacity: revealed ? collapsedOpacity : 0,
      pointerEvents: "auto",
      position: "absolute",
      top: -size / 2,
      transform: `scale(${revealed ? collapsedScale : MARKER_PRE_REVEAL_SCALE})`,
      transformOrigin: "center center",
      transition: revealed
        ? "opacity 220ms ease-out, transform 220ms ease-out, filter 220ms ease-out"
        : "none",
      width: size,
    }),
    [revealed, shouldFan, collapsedOpacity, collapsedScale, size],
  );

  return (
    <div onMouseEnter={onEnter} onMouseLeave={onLeave} style={primaryStyle}>
      <MarkerCircleHtml
        icon={primaryMarker.icon}
        size={size}
        color={primaryMarker.color}
        onClick={primaryMarker.onClick === undefined ? undefined : handlePrimaryClick}
        href={primaryMarker.href}
        target={primaryMarker.target}
      />
      {count > 1 && !shouldFan && <Badge count={count} size={size} />}
    </div>
  );
};
