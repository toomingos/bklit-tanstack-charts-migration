"use client";

import type { BrushHost, BrushChromePattern, BrushSelectedBoxStyle } from "./brush-chrome";
import type { BrushSelection } from "./brush-selection";
import { CHART_ROLE } from "../children";

export type { BrushHost } from "./brush-chrome";
export type BrushSelectionPattern = BrushChromePattern;
export type ChartBrushSelectedBoxStyle = BrushSelectedBoxStyle;

export interface ChartBrushProps {
  /**
   * C6: vestigial. `brush-drag.ts` (BrushHostContext + useBrushDrag) was
   * deleted — the host chart (line-chart.tsx / area-chart.tsx) now builds
   * the native `brushX` control and renders `BrushChrome` directly against
   * its own containerRef/margin/trackExtent, without going through this
   * component or a discovered "host". Kept only so any existing caller that
   * passes `host` explicitly still type-checks; the value is now ignored.
   */
  host?: BrushHost | null;
  onSelectionChange?: (selection: BrushSelection | null) => void;
  initialSelection?: BrushSelection | null;
  blurPx?: number;
  fadeOuterEdges?: boolean;
  selectionPattern?: BrushChromePattern;
  selectedBoxStyle?: BrushSelectedBoxStyle;
}

// C6: pure config carrier — same pattern as ChartMarkers (children.tsx):
// this never renders. Its props are extracted by extractChildren() into
// ExtractedChildren.brushes and consumed directly by the host chart, which
// owns both the native brushX control (mechanics) and the BrushChrome
// portal (track blur/fade mask + pattern fill + border + pill handles —
// pieces CSS/native SceneStyle can't reach). The old "missing host" dev
// warning depended on this component actually mounting under
// BrushHostContext; there is no host discovery left to warn about, so it is
// dropped (see C6 executor report for the full rationale).
export function ChartBrush(_props: ChartBrushProps): null {
  return null;
}
(ChartBrush as unknown as Record<symbol, unknown>)[CHART_ROLE] = "brush";
ChartBrush.displayName = "ChartBrush";

// Legacy parity: bklit `chart-brush.tsx` ships `export default ChartBrush;` (T-E2).
export default ChartBrush;
