// SunburstCenterOverlay — clickable center overlay for zoom-out.
// Split from ./sunburst-center (react/no-multi-comp): one component per file.

import type { CSSProperties, ReactElement } from "react";

// ---------------------------------------------------------------------------
// Center overlay — absolute-positioned circle over the chart
// ---------------------------------------------------------------------------

// Overlay positioning is static; only pointer events depend on clickability.
const SUNBURST_OVERLAY_CLICKABLE_STYLE = {
  left: "50%",
  pointerEvents: "auto",
  position: "absolute",
  top: "50%",
  transform: "translate(-50%, -50%)",
} as const;
const SUNBURST_OVERLAY_STATIC_STYLE = {
  left: "50%",
  pointerEvents: "none",
  position: "absolute",
  top: "50%",
  transform: "translate(-50%, -50%)",
} as const;

// Builds the center-button style from live geometry; hoisted so the component stays short.
const buildCenterButtonStyle = (centerColor: string, diameter: number, isClickable: boolean): CSSProperties => ({
  alignItems: "center",
  backgroundColor: centerColor,
  border: "none",
  borderRadius: "50%",
  cursor: isClickable ? "pointer" : "default",
  display: "flex",
  height: diameter,
  justifyContent: "center",
  padding: 0,
  pointerEvents: "auto",
  width: diameter,
});

export interface SunburstCenterOverlayProps {
  /** Show the overlay (gated on centerChildren.length > 0 && liveCenterR > 1). */
  visible: boolean;
  /** Inner radius of the center hole (pixels). */
  liveCenterR: number;
  /** Background color of the center circle. */
  centerColor: string;
  /** Callback when the center circle is clicked (zoom out to parent). */
  onZoomToParent?: () => void;
}

export const SunburstCenterOverlay = ({
  visible,
  liveCenterR,
  centerColor,
  onZoomToParent,
}: SunburstCenterOverlayProps): ReactElement | undefined => {
  if (!visible) {return undefined;}

  const diameter = Math.max(liveCenterR - 2, 0) * 2;
  const isClickable = onZoomToParent !== undefined;

  return (
    <div
      style={isClickable ? SUNBURST_OVERLAY_CLICKABLE_STYLE : SUNBURST_OVERLAY_STATIC_STYLE}
    >
      <button
        type="button"
        onClick={onZoomToParent}
        style={buildCenterButtonStyle(centerColor, diameter, isClickable)}
        aria-label={isClickable ? "Click to zoom out" : undefined}
        tabIndex={isClickable ? 0 : -1}
      />
    </div>
  );
};
