// SunburstCenterOverlay — clickable center overlay for zoom-out.
// Split from ./sunburst-center (react/no-multi-comp): one component per file.

import type { CSSProperties, ReactElement } from "react";

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
  readonly visible: boolean;
  /** Inner radius of the center hole (pixels). */
  readonly liveCenterR: number;
  /** Background color of the center circle. */
  readonly centerColor: string;
  /** Callback when the center circle is clicked (zoom out to parent). */
  readonly onZoomToParent?: () => void;
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
      <button // oxlint-disable-line jsx-a11y/control-has-associated-label -- legacy parity: center zoom-out is click-only, no name or tab stop
        type="button"
        onClick={onZoomToParent}
        style={buildCenterButtonStyle(centerColor, diameter, isClickable)}
        tabIndex={-1}
      />
    </div>
  );
};
