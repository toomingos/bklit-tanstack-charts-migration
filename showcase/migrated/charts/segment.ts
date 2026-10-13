"use client";

import { createElement, Fragment } from "react";
import type { ReactElement } from "react";
import { CHART_ROLE } from "./children";

interface SegmentChildComponent<ComponentProps> {
  (props: ComponentProps): ReactElement;
  [CHART_ROLE]?: string;
  displayName: string;
}

/** Props of `SegmentBackground`, the highlight drawn behind a dragged selection. */
interface SegmentBackgroundProps {
  /**
   * Fill color of the selected area.
   * @default "var(--chart-segment-background)"
   */
  readonly fill?: string;
}

/** Shades the area of the current drag selection (`ChartSelection`) in a cartesian chart. */
const SegmentBackground: SegmentChildComponent<SegmentBackgroundProps> = Object.assign(
  (_props: Readonly<SegmentBackgroundProps>): ReactElement => createElement(Fragment),
  { [CHART_ROLE]: "segmentBackground", displayName: "SegmentBackground" },
);

/** Line style of a `SegmentLineFrom` or `SegmentLineTo`: `"dashed"`, `"solid"` or `"gradient"` (fades out). */
type SegmentLineVariant = "dashed" | "solid" | "gradient";

/** Props of `SegmentLineFrom` and `SegmentLineTo`, the vertical lines at the start and end of a dragged selection. */
interface SegmentLineProps {
  /**
   * Line color.
   * @default "var(--chart-segment-line)"
   */
  stroke?: string;
  /**
   * Line width in px.
   * @default 1
   */
  strokeWidth?: number;
  /**
   * Line style: dashed, solid, or a gradient that fades out.
   * @default "dashed"
   */
  readonly variant?: SegmentLineVariant;
}

/** Draws a vertical line at the start of the current drag selection. */
const SegmentLineFrom: SegmentChildComponent<SegmentLineProps> = Object.assign(
  (_props: Readonly<SegmentLineProps>): ReactElement => createElement(Fragment),
  { [CHART_ROLE]: "segmentLineFrom", displayName: "SegmentLineFrom" },
);

/** Draws a vertical line at the end of the current drag selection. */
const SegmentLineTo: SegmentChildComponent<SegmentLineProps> = Object.assign(
  (_props: Readonly<SegmentLineProps>): ReactElement => createElement(Fragment),
  { [CHART_ROLE]: "segmentLineTo", displayName: "SegmentLineTo" },
);

export { SegmentBackground, SegmentLineFrom, SegmentLineTo };
export type { SegmentBackgroundProps, SegmentLineVariant, SegmentLineProps };
