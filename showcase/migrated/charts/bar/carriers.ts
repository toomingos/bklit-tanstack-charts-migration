"use client";
// Bar-family config carriers. They render nothing; BarChart reads their props
// with `readBarChildren` and compiles them into one native definition.
import type { ReactNode } from "react";
import { defineCarrier } from "../kit/role";

/** Cap of a bar: `"round"`, `"butt"`, or a corner radius in pixels. */
export type BarLineCap = "round" | "butt" | number;
/** Entrance style of the bars: grow from the baseline or fade in. */
export type BarAnimationType = "grow" | "fade";

export interface BarProps {
  /** Key of the data field that holds this series' values. */
  readonly dataKey: string;
  /**
   * Accepted for bklit-ui compatibility. It has no effect in bklit-tanstack-charts. A bar chart has a single value scale.
   */
  readonly yAxisId?: string | number;
  /**
   * Fill color of the bars. Can be a color or a `url(#id)` reference to a gradient or pattern child.
   * @default "var(--chart-line-primary)"
   */
  readonly fill?: string;
  /** Accepted for bklit-ui compatibility. It has no effect in bklit-tanstack-charts. */
  readonly stroke?: string;
  /**
   * Bar end style: `"round"` rounds the outer corners, `"butt"` leaves them square. A number is treated like `"round"`.
   * @default "round"
   */
  readonly lineCap?: BarLineCap;
  /**
   * Accepted for bklit-ui compatibility. It has no effect in bklit-tanstack-charts. Bars always animate in with the chart's `animationDuration`.
   */
  readonly animate?: boolean;
  /**
   * Accepted for bklit-ui compatibility. It has no effect in bklit-tanstack-charts. Bars always grow from the baseline.
   */
  readonly animationType?: BarAnimationType;
  /**
   * Opacity of the bars that are not hovered while another bar is hovered. Read from the first `Bar`.
   * @default 0.3
   */
  readonly fadedOpacity?: number;
  /**
   * Delay in seconds between the entrances of consecutive bars of this series. Defaults to 40% of `animationDuration` spread across the categories.
   */
  readonly staggerDelay?: number;
  /**
   * Accepted for bklit-ui compatibility. It has no effect in bklit-tanstack-charts. Set `stackGap` on `BarChart` instead.
   */
  readonly stackGap?: number;
  /**
   * Gap in px between the bars of a group. Read from the first `Bar`.
   * @default 4
   */
  readonly groupGap?: number;
  /**
   * Accepted for bklit-ui compatibility. It has no effect in bklit-tanstack-charts. Depth surfaces trim the front face automatically.
   */
  readonly perspective?: boolean;
  /**
   * Accepted for bklit-ui compatibility. It has no effect in bklit-tanstack-charts. Set `minBarHeight` on `BarDepthProvider` for depth surfaces.
   */
  readonly minBarHeight?: number;
}

interface GradientStop {
  readonly offset: number;
  readonly color: string;
}

export interface BarSquaresProps {
  /** Key of the data field that holds this series' values. */
  readonly dataKey: string;
  /** Accepted for bklit-ui compatibility. It has no effect in bklit-tanstack-charts. */
  readonly yAxisId?: string | number;
  /**
   * Fill color of the squares, or a `url(#id)` reference to a gradient or pattern child.
   * @default "var(--chart-line-primary)"
   */
  readonly fill?: string;
  /** Accepted for bklit-ui compatibility. It has no effect in bklit-tanstack-charts. */
  readonly stroke?: string;
  /**
   * Gap between stacked squares in px.
   * @default 3
   */
  readonly squareGap?: number;
  /**
   * Corner radius of each square as a fraction of its size (0 is flat, 0.5 is a circle).
   * @default 0.25
   */
  readonly squareRadius?: number;
  /**
   * Redistribute the gap so the squares fill the bar height exactly.
   * @default false
   */
  readonly squareFit?: boolean;
  /**
   * Paint the column with a gradient built from `gradientStops` (needs at least two stops).
   * @default false
   */
  readonly useGradient?: boolean;
  /** Color stops of the column gradient used when `useGradient` is on. */
  readonly gradientStops?: readonly GradientStop[];
  /** Accepted for bklit-ui compatibility. It has no effect in bklit-tanstack-charts. */
  readonly patternPreset?: string;
  /** Accepted for bklit-ui compatibility. It has no effect in bklit-tanstack-charts. */
  readonly animate?: boolean;
  /**
   * Opacity of the squares that are not hovered while another bar is hovered.
   * @default 0.3
   */
  readonly fadedOpacity?: number;
  /** Delay in seconds between consecutive column entrances. Defaults to 40% of `animationDuration` spread across the categories. */
  readonly staggerDelay?: number;
  /**
   * Gap in px between the columns of a group.
   * @default 4
   */
  readonly groupGap?: number;
}

export interface BarColumnTrackProps {
  /**
   * Fill color of the track squares behind the bars.
   * @default "var(--chart-grid)"
   */
  readonly fill?: string;
  /**
   * Opacity of the track.
   * @default 0.3
   */
  readonly opacity?: number;
  /**
   * Gap between track squares in px. Match the `BarSquares` value.
   * @default 3
   */
  readonly squareGap?: number;
  /**
   * Corner radius of each track square as a fraction of its size. Match the `BarSquares` value.
   * @default 0.25
   */
  readonly squareRadius?: number;
  /**
   * Gap in px between the track columns of a group.
   * @default 4
   */
  readonly groupGap?: number;
  /**
   * Redistribute the gap so the squares fill the column height exactly.
   * @default false
   */
  readonly squareFit?: boolean;
  /** Delay in seconds between consecutive column entrances. Defaults to 40% of `animationDuration` spread across the categories. */
  readonly staggerDelay?: number;
}

export interface BarXAxisProps {
  /**
   * Half-width in px of the zone around the date pill inside which tick labels are hidden.
   * @default 50
   */
  readonly tickerHalfWidth?: number;
  /**
   * Show every category label instead of thinning to `maxLabels`.
   * @default false
   */
  readonly showAllLabels?: boolean;
  /**
   * Maximum number of category labels when `showAllLabels` is off.
   * @default 12
   */
  readonly maxLabels?: number;
}

export interface BarYAxisProps {
  /**
   * Horizontal charts: show every category label instead of thinning to `maxLabels`.
   * @default true
   */
  readonly showAllLabels?: boolean;
  /**
   * Horizontal charts: maximum number of category labels when `showAllLabels` is off.
   * @default 20
   */
  readonly maxLabels?: number;
  /**
   * Vertical charts: target number of value ticks. Grid settings take precedence.
   * @default 5
   */
  readonly numTicks?: number;
  /**
   * Vertical charts: abbreviate values of 1000 and above as thousands, for example `2k`.
   * @default true
   */
  readonly formatLargeNumbers?: boolean;
  /** Vertical charts: formats a value tick into its label. Overrides `formatLargeNumbers`. */
  readonly formatValue?: (value: number) => string;
  /**
   * Accepted for bklit-ui compatibility. It has no effect in bklit-tanstack-charts. The value axis is always on the left.
   */
  readonly orientation?: "left" | "right";
}

export interface BarDepthSegment {
  /** Size of this segment. The values of all segments should add up to the bar's value. */
  readonly value: number;
  /** Color of this segment's side face. */
  readonly color?: string;
}

export interface BarDepthProviderProps {
  /** The chart children that use the shared depth settings. */
  readonly children?: ReactNode;
  /**
   * Splits a stacked bar into segments, bottom to top, so each gets its own side face. Return `null` or `undefined` for a single color.
   */
  readonly segmentsAccessor?: (datum: Record<string, unknown>) => readonly BarDepthSegment[] | null | undefined;
  /**
   * Opacity of the contact shadow under the bars. `0` turns it off.
   * @default 0.26
   */
  readonly groundShadow?: number;
  /**
   * Minimum rendered bar height in px, so short or zero-value bars stay visible.
   * @default 0
   */
  readonly minBarHeight?: number;
}

export interface BarDepthBackProps {
  /** Key of the data field that holds the values drawn as the 3D side and top faces. */
  readonly dataKey: string;
  /** Color of the faces. Defaults to the series fill. */
  readonly color?: string;
  /** Picks a color per row (with its index). Return `undefined` to use `color`. */
  readonly colorAccessor?: (datum: Record<string, unknown>, index: number) => string | undefined;
}

export interface BarDepthFrontProps {
  /** Key of the data field that holds the values drawn as the glass front face. */
  readonly dataKey: string;
}

export interface BarPulseProps {
  /** Key of the data field of the bar that pulses. */
  readonly dataKey: string;
  /**
   * Index of the category whose bar pulses. Defaults to the last category.
   */
  readonly activeIndex?: number;
  /**
   * Pause the pulse animation.
   * @default false
   */
  readonly pulsePaused?: boolean;
}

/** A bar series for the `dataKey` column. Bars grow from the baseline and fade the other bars on hover. It renders nothing itself; place it as a child of the chart. */
export const Bar = /* @__PURE__ */ defineCarrier<BarProps>("bar", "Bar");
/** Draws each bar as a stack of squares instead of one solid rectangle. It renders nothing itself; place it as a child of the chart. */
export const BarSquares = /* @__PURE__ */ defineCarrier<BarSquaresProps>("barSquares", "BarSquares");
/** Draws a faint track of squares behind each bar column. It renders nothing itself; place it as a child of the chart. */
export const BarColumnTrack = /* @__PURE__ */ defineCarrier<BarColumnTrackProps>("barColumnTrack", "BarColumnTrack");
/** The category axis of a `BarChart`: one label per bar group. It renders nothing itself; place it as a child of the chart. */
export const BarXAxis = /* @__PURE__ */ defineCarrier<BarXAxisProps>("barXAxis", "BarXAxis");
/** The value axis of a `BarChart`. It renders nothing itself; place it as a child of the chart. */
export const BarYAxis = /* @__PURE__ */ defineCarrier<BarYAxisProps>("barYAxis", "BarYAxis");
