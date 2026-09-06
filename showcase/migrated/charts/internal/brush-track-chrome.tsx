import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import { buildTrackEdgeMasks, renderTrackSide, resolveTrackWidths } from "./brush-chrome-helpers";
import type { BrushHost } from "./brush-chrome";

// Track dimming chrome for the host-owned native brushX, split out so brush-chrome.tsx holds one component per file.

// Backdrop-blur clamp ceiling (default 1.5); above this the track blur costs paint without visible change.
const BRUSH_BLUR_MAX_PX = 5;

const BrushTrackChrome = ({
  host,
  x0,
  x1,
  innerWidth,
  innerHeight,
  blurPx,
  fadeOuterEdges,
  mounted,
}: Readonly<{
  host: BrushHost;
  x0: number;
  x1: number;
  innerWidth: number;
  innerHeight: number;
  blurPx: number;
  fadeOuterEdges: boolean;
  mounted: boolean;
}>): ReactNode => {
  const container = host.containerRef.current;
  // Blur clamped [0,5], default 1.5.
  const clampedBlur = Math.min(BRUSH_BLUR_MAX_PX, Math.max(0, blurPx));
  const { leftMask, rightMask } = buildTrackEdgeMasks(fadeOuterEdges);

  if (!(mounted && container)) {return undefined;}
  const { leftWidth, rightWidth } = resolveTrackWidths(x0, x1, innerWidth);
  if (leftWidth <= 0 && rightWidth <= 0) {return undefined;}

  return createPortal(
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[1]" data-slot="brush-track">
      {renderTrackSide({ clampedBlur, height: innerHeight, left: host.margin.left, mask: leftMask, top: host.margin.top, width: leftWidth })}
      {renderTrackSide({ clampedBlur, height: innerHeight, left: host.margin.left + Math.max(x0, x1), mask: rightMask, top: host.margin.top, width: rightWidth })}
    </div>,
    container,
  );
};

export { BrushTrackChrome };
