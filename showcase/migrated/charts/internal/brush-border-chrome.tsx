import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import { resolveSelectionBounds } from "./brush-chrome-helpers";
import type { BrushHost, BrushSelectedBoxStyle } from "./brush-chrome";

// Border chrome for the host-owned native brushX, split out so brush-chrome.tsx holds one component per file.

const DEFAULT_SELECTED_BOX_STYLE = {
  fill: "transparent",
  fillOpacity: 0,
  stroke: "var(--chart-brush-border)",
  strokeWidth: 1,
} satisfies BrushSelectedBoxStyle;

const BrushBorderChrome = ({
  host,
  x0,
  x1,
  innerHeight,
  selectedBoxStyle,
  mounted,
}: Readonly<{
  host: BrushHost;
  x0: number;
  x1: number;
  innerWidth: number;
  innerHeight: number;
  selectedBoxStyle?: BrushSelectedBoxStyle;
  mounted: boolean;
}>): ReactNode => {
  const container = host.containerRef.current;
  if (!(mounted && container)) {return null;}
  const bounds = resolveSelectionBounds(x0, x1);
  if (bounds === undefined) {return null;}
  // Replace (??), not merge: legacy hands visx a style with no fill, so the rect paints opaque black.
  const style: BrushSelectedBoxStyle = selectedBoxStyle ?? DEFAULT_SELECTED_BOX_STYLE;
  return createPortal(
    <svg aria-hidden="true" className="pointer-events-none absolute inset-0 z-[1]" width="100%" height="100%">
      <rect
        x={host.margin.left + bounds.left}
        y={host.margin.top}
        width={bounds.width}
        height={innerHeight}
        {...style}
      />
    </svg>,
    container,
  );
};

export { BrushBorderChrome };
