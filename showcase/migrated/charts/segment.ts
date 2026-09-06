"use client";

import { createElement } from "react";
import type { ReactElement } from "react";
import { CHART_ROLE } from "./children";

interface SegmentChildComponent<ComponentProps> {
  (props: ComponentProps): ReactElement;
  [CHART_ROLE]?: string;
  displayName: string;
}

interface SegmentBackgroundProps {
  readonly fill?: string;
}

const SegmentBackground: SegmentChildComponent<SegmentBackgroundProps> = Object.assign(
  (_props: Readonly<SegmentBackgroundProps>): ReactElement => createElement("g"),
  { [CHART_ROLE]: "segmentBackground", displayName: "SegmentBackground" },
);

type SegmentLineVariant = "dashed" | "solid" | "gradient";

interface SegmentLineProps {
  stroke?: string;
  strokeWidth?: number;
  readonly variant?: SegmentLineVariant;
}

const SegmentLineFrom: SegmentChildComponent<SegmentLineProps> = Object.assign(
  (_props: Readonly<SegmentLineProps>): ReactElement => createElement("g"),
  { [CHART_ROLE]: "segmentLineFrom", displayName: "SegmentLineFrom" },
);

const SegmentLineTo: SegmentChildComponent<SegmentLineProps> = Object.assign(
  (_props: Readonly<SegmentLineProps>): ReactElement => createElement("g"),
  { [CHART_ROLE]: "segmentLineTo", displayName: "SegmentLineTo" },
);

export { ChartSelectionContext } from "./internal/chart-selection";
export type { ChartSelection } from "./internal/chart-selection";
export { SegmentOverlay } from "./internal/segment-visuals";
export { SegmentBackground, SegmentLineFrom, SegmentLineTo };
export type { SegmentBackgroundProps, SegmentLineVariant, SegmentLineProps };
