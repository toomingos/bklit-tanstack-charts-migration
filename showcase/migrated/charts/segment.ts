"use client";

import { CHART_ROLE } from "./children";

interface SegmentChildComponent<ComponentProps> {
  (props: ComponentProps): undefined;
  [CHART_ROLE]?: string;
  displayName?: string;
}

interface SegmentBackgroundProps {
  fill?: string;
}

const SegmentBackground: SegmentChildComponent<SegmentBackgroundProps> = (_props: Readonly<SegmentBackgroundProps>): undefined => undefined;

SegmentBackground[CHART_ROLE] = "segmentBackground";
SegmentBackground.displayName = "SegmentBackground";

type SegmentLineVariant = "dashed" | "solid" | "gradient";

interface SegmentLineProps {
  stroke?: string;
  strokeWidth?: number;
  variant?: SegmentLineVariant;
}

const SegmentLineFrom: SegmentChildComponent<SegmentLineProps> = (_props: Readonly<SegmentLineProps>): undefined => undefined;

SegmentLineFrom[CHART_ROLE] = "segmentLineFrom";
SegmentLineFrom.displayName = "SegmentLineFrom";

const SegmentLineTo: SegmentChildComponent<SegmentLineProps> = (_props: Readonly<SegmentLineProps>): undefined => undefined;

SegmentLineTo[CHART_ROLE] = "segmentLineTo";
SegmentLineTo.displayName = "SegmentLineTo";

export { ChartSelectionContext } from "./internal/chart-selection";
export type { ChartSelection } from "./internal/chart-selection";
export { SegmentOverlay } from "./internal/segment-visuals";
export { SegmentBackground, SegmentLineFrom, SegmentLineTo };
export type { SegmentBackgroundProps, SegmentLineVariant, SegmentLineProps };
