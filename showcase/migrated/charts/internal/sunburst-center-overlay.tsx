// SunburstCenterOverlay — clickable center overlay for zoom-out.
// Split from ./sunburst-center (react/no-multi-comp): one component per file.

// ---------------------------------------------------------------------------
// Center overlay — absolute-positioned circle over the chart
// ---------------------------------------------------------------------------

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
}: SunburstCenterOverlayProps) => {
  if (!visible) {return null;}

  const diameter = Math.max(liveCenterR - 2, 0) * 2;
  const isClickable = onZoomToParent !== undefined;

  return (
    <div
      style={{
        left: "50%",
        pointerEvents: isClickable ? "auto" : "none",
        position: "absolute",
        top: "50%",
        transform: "translate(-50%, -50%)",
      }}
    >
      <button
        type="button"
        onClick={onZoomToParent}
        style={{
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
        }}
        aria-label={isClickable ? "Click to zoom out" : undefined}
        tabIndex={isClickable ? 0 : -1}
      />
    </div>
  );
};
