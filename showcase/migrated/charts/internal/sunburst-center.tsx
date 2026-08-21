// SunburstCenter — config carrier + clickable center overlay for zoom-out.
// Extracted from sunburst-chart.tsx (R6 module split).

// ---------------------------------------------------------------------------
// Config carrier — returns null, classified by displayName in sunburst-chart
// ---------------------------------------------------------------------------

export function SunburstCenter(_props: { className?: string }): null {
  return null;
}

SunburstCenter.displayName = "SunburstCenter";

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

export function SunburstCenterOverlay({
  visible,
  liveCenterR,
  centerColor,
  onZoomToParent,
}: SunburstCenterOverlayProps) {
  if (!visible) return null;

  const diameter = Math.max(liveCenterR - 2, 0) * 2;
  const isClickable = onZoomToParent != null;

  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        pointerEvents: isClickable ? "auto" : "none",
      }}
    >
      <div
        onClick={onZoomToParent}
        style={{
          width: diameter,
          height: diameter,
          borderRadius: "50%",
          backgroundColor: centerColor,
          border: "none",
          cursor: isClickable ? "pointer" : "default",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "auto",
        }}
        title={isClickable ? "Click to zoom out" : undefined}
        role={isClickable ? "button" : undefined}
        tabIndex={isClickable ? 0 : undefined}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onZoomToParent?.();
          }
        }}
      />
    </div>
  );
}
