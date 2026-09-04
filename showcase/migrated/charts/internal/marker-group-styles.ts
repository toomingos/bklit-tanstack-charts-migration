import type { CSSProperties } from "react";

// Guide-line opacity when neither hovered nor crosshair-active.
const MARKER_GUIDE_DIMMED_OPACITY = 0.6;
// Gap between the marker circle edge and the guide-line start.
const MARKER_GUIDE_TOP_OFFSET_PX = 4;
// Pre-reveal scale of the entering marker.
const MARKER_ENTER_INITIAL_SCALE = 0.85;

const MARKER_BLURRED_FILTER = "blur(2px)";
const MARKER_SHARP_FILTER = "blur(0px)";

const resolveGuideOpacity = (hovered: boolean, isActive: boolean): number => {
  if (hovered) {return 1;}
  if (isActive) {return 0;}
  return MARKER_GUIDE_DIMMED_OPACITY;
};

const resolveMarkerFilter = (revealed: boolean, shouldFan: boolean): string => {
  if (!revealed) {return MARKER_BLURRED_FILTER;}
  if (shouldFan) {return MARKER_BLURRED_FILTER;}
  return MARKER_SHARP_FILTER;
};

interface MarkerGuideLineStyleOptions {
  readonly hovered: boolean;
  readonly isActive: boolean;
  readonly lineHeight: number;
  readonly size: number;
  readonly y: number;
}

// Guide-line style is a pure function of its geometry so the render helper stays allocation-free in JSX.
const markerGuideLineStyle = (options: Readonly<MarkerGuideLineStyleOptions>): CSSProperties => {
  const { hovered, isActive, lineHeight, size, y } = options;
  return {
    borderLeft: "1px dashed var(--chart-marker-border)",
    height: lineHeight + Math.abs(y),
    left: 0,
    opacity: resolveGuideOpacity(hovered, isActive),
    pointerEvents: "none",
    position: "absolute",
    top: size / 2 + MARKER_GUIDE_TOP_OFFSET_PX,
    transition: "opacity 200ms ease-out",
    width: 1,
  };
};

interface MarkerEnterStyleOptions {
  readonly collapsedOpacity: number;
  readonly collapsedScale: number;
  readonly revealed: boolean;
  readonly shouldFan: boolean;
  readonly size: number;
}

// Enter-transition style is a pure function of its reveal inputs; see the guide-line factory above.
const markerEnterStyle = (options: Readonly<MarkerEnterStyleOptions>): CSSProperties => {
  const { collapsedOpacity, collapsedScale, revealed, shouldFan, size } = options;
  return {
    cursor: "pointer",
    filter: resolveMarkerFilter(revealed, shouldFan),
    height: size,
    left: -size / 2,
    opacity: revealed ? collapsedOpacity : 0,
    pointerEvents: "auto",
    position: "absolute",
    top: -size / 2,
    transform: `scale(${revealed ? collapsedScale : MARKER_ENTER_INITIAL_SCALE})`,
    transformOrigin: "center center",
    transition: revealed
      ? "opacity 220ms ease-out, transform 220ms ease-out, filter 220ms ease-out"
      : "none",
    width: size,
  };
};

export { markerEnterStyle, markerGuideLineStyle };
export type { MarkerEnterStyleOptions, MarkerGuideLineStyleOptions };
