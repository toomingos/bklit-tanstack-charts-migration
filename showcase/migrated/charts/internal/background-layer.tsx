// CH13: host slot for the <Background> child (bklit background.tsx). Legacy
// shells file Background as a CLIP-EXCLUDED child painted first inside the
// translated plot-area group (time-series-chart-shell.tsx:447,685) — i.e.
// behind grid/series, NOT inside the grow-clip reveal, fading in on load.
// TanStack owns the scene svg here, so the layer mounts as its own
// absolutely-positioned sibling svg pinned to the plot-area origin (the
// reference-area-layer.tsx precedent), zIndex behind the marks.
import * as React from "react";
import { Background } from "./background";
import type { BackgroundConfig } from "./types";

export interface BackgroundLayerProps {
  config: BackgroundConfig | null;
  innerWidth: number;
  innerHeight: number;
  marginLeft: number;
  marginTop: number;
  isLoaded?: boolean;
}

export function BackgroundLayer({
  config,
  innerWidth,
  innerHeight,
  marginLeft,
  marginTop,
  isLoaded = true,
}: BackgroundLayerProps) {
  if (!config || innerWidth <= 0 || innerHeight <= 0) return null;
  return (
    <svg
      aria-hidden="true"
      width={innerWidth}
      height={innerHeight}
      style={{
        position: "absolute",
        left: marginLeft,
        top: marginTop,
        overflow: "visible",
        pointerEvents: "none",
        zIndex: -2,
      }}
    >
      <Background {...config} width={innerWidth} height={innerHeight} isLoaded={isLoaded} />
    </svg>
  );
}
