"use client";

import { createElement, Fragment } from "react";
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
  (_props: Readonly<SegmentBackgroundProps>): ReactElement => createElement(Fragment),
  { [CHART_ROLE]: "segmentBackground", displayName: "SegmentBackground" },
);

type SegmentLineVariant = "dashed" | "solid" | "gradient";

interface SegmentLineProps {
  stroke?: string;
  strokeWidth?: number;
  readonly variant?: SegmentLineVariant;
}

const SegmentLineFrom: SegmentChildComponent<SegmentLineProps> = Object.assign(
  (_props: Readonly<SegmentLineProps>): ReactElement => createElement(Fragment),
  { [CHART_ROLE]: "segmentLineFrom", displayName: "SegmentLineFrom" },
);

const SegmentLineTo: SegmentChildComponent<SegmentLineProps> = Object.assign(
  (_props: Readonly<SegmentLineProps>): ReactElement => createElement(Fragment),
  { [CHART_ROLE]: "segmentLineTo", displayName: "SegmentLineTo" },
);

export { SegmentBackground, SegmentLineFrom, SegmentLineTo };
export type { SegmentBackgroundProps, SegmentLineVariant, SegmentLineProps };
