"use client";

import { CHART_ROLE } from "./children";

export interface SegmentBackgroundProps {
  fill?: string;
}

export function SegmentBackground(_props: SegmentBackgroundProps): null {
  return null;
}
(SegmentBackground as unknown as Record<symbol, string>)[CHART_ROLE] = "segmentBackground";
SegmentBackground.displayName = "SegmentBackground";

export type SegmentLineVariant = "dashed" | "solid" | "gradient";

export interface SegmentLineProps {
  stroke?: string;
  strokeWidth?: number;
  variant?: SegmentLineVariant;
}

export function SegmentLineFrom(_props: SegmentLineProps): null {
  return null;
}
(SegmentLineFrom as unknown as Record<symbol, string>)[CHART_ROLE] = "segmentLineFrom";
SegmentLineFrom.displayName = "SegmentLineFrom";

export function SegmentLineTo(_props: SegmentLineProps): null {
  return null;
}
(SegmentLineTo as unknown as Record<symbol, string>)[CHART_ROLE] = "segmentLineTo";
SegmentLineTo.displayName = "SegmentLineTo";

export { ChartSelectionContext } from "./internal/chart-selection";
export type { ChartSelection } from "./internal/chart-selection";
export { SegmentOverlay } from "./internal/segment-visuals";
