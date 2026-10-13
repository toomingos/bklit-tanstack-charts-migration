"use client";
// Config-carrier children for the native LiveLineChart. They render nothing;
// the chart reads their props with the kit's `readChildren` (kit/role.ts).
import type { CurveFactory } from "d3-shape";
import { defineCarrier } from "../kit/role";

export interface MomentumColors {
  /** Color while the value is rising. */
  up: string;
  /** Color while the value is falling. */
  down: string;
  /** Color while the value is steady. */
  flat: string;
}

export interface LiveLineConfig {
  /** Key of the data field that holds the y values. */
  readonly dataKey: string;
  /**
   * Stroke color of the line.
   * @default "var(--chart-line-primary)"
   */
  readonly stroke?: string;
  /**
   * Stroke width of the line in px.
   * @default 2
   */
  readonly strokeWidth?: number;
  /**
   * Accepted for bklit-ui compatibility and ignored: the line is always bklit's default curveMonotoneX. Native rolling refuses a custom curve path (`custom-path`, `dist/motion-path.js:16`), so the curve is sampled into rows (`smoothRows` in definition.ts) and another factory cannot be swapped in.
   */
  readonly curve?: CurveFactory;
  /**
   * Show the gradient fill under the line.
   * @default true
   */
  readonly fill?: boolean;
  /**
   * Show the pulsing live dot at the right edge.
   * @default true
   */
  readonly pulse?: boolean;
  /**
   * Radius of the live dot in px.
   * @default 4
   */
  readonly dotSize?: number;
  /**
   * Show the value badge at the live tip.
   * @default true
   */
  readonly badge?: boolean;
  /** Formats a value for the badge, the tooltip and the y axis labels. Defaults to two decimals. */
  readonly formatValue?: (value: number) => string;
  /** Colors the line, fill and dot by momentum direction. Overrides `stroke` for the line. */
  readonly momentumColors?: MomentumColors;
}

export interface LiveXAxisConfig {
  /** Number of time labels. Defaults to the chart's `numXTicks`. */
  readonly numTicks?: number;
  /** Formats a time (in milliseconds since the epoch) into its label. Defaults to `HH:MM:SS`. */
  readonly formatTime?: (time: number) => string;
}

export interface LiveYAxisConfig {
  /**
   * Minimum gap in px between labels.
   * @default 36
   */
  readonly minGap?: number;
  /**
   * Side of the plot the labels sit on.
   * @default "left"
   */
  readonly position?: "left" | "right";
  /** Formats a tick value into its label. Defaults to the `LiveLine` `formatValue`. */
  readonly formatValue?: (value: number) => string;
  /**
   * Allow fractional tick values.
   * @default true
   */
  readonly allowDecimals?: boolean;
}

/** The scrolling live line of a `LiveLineChart`, with a gradient fill, a pulsing dot and a value badge at the live tip. It renders nothing itself; place it as a child of the chart. */
export const LiveLine = /* @__PURE__ */ defineCarrier<Readonly<LiveLineConfig>>("liveLine", "LiveLine");
/** The time axis of a `LiveLineChart`. Labels roll with the window. It renders nothing itself; place it as a child of the chart. */
export const LiveXAxis = /* @__PURE__ */ defineCarrier<Readonly<LiveXAxisConfig>>("liveXAxis", "LiveXAxis");
/** The value axis of a `LiveLineChart`, with labels spaced by a minimum pixel gap. It renders nothing itself; place it as a child of the chart. */
export const LiveYAxis = /* @__PURE__ */ defineCarrier<Readonly<LiveYAxisConfig>>("liveYAxis", "LiveYAxis");
