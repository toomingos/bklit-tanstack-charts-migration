// Bar-family config carriers. They render nothing; BarChart reads their props
// with `readBarChildren` and compiles them into one native definition.
import type { ReactNode } from "react";
import { defineCarrier } from "../kit/role";

export type BarLineCap = "round" | "butt" | number;
export type BarAnimationType = "grow" | "fade";

export interface BarProps {
  readonly dataKey: string;
  readonly yAxisId?: string | number;
  readonly fill?: string;
  readonly stroke?: string;
  readonly lineCap?: BarLineCap;
  readonly animate?: boolean;
  readonly animationType?: BarAnimationType;
  readonly fadedOpacity?: number;
  readonly staggerDelay?: number;
  readonly stackGap?: number;
  readonly groupGap?: number;
  readonly perspective?: boolean;
  readonly minBarHeight?: number;
}

interface GradientStop {
  readonly offset: number;
  readonly color: string;
}

export interface BarSquaresProps {
  readonly dataKey: string;
  readonly yAxisId?: string | number;
  readonly fill?: string;
  readonly stroke?: string;
  readonly squareGap?: number;
  readonly squareRadius?: number;
  readonly squareFit?: boolean;
  readonly useGradient?: boolean;
  readonly gradientStops?: readonly GradientStop[];
  readonly patternPreset?: string;
  readonly animate?: boolean;
  readonly fadedOpacity?: number;
  readonly staggerDelay?: number;
  readonly groupGap?: number;
}

export interface BarColumnTrackProps {
  readonly fill?: string;
  readonly opacity?: number;
  readonly squareGap?: number;
  readonly squareRadius?: number;
  readonly groupGap?: number;
  readonly squareFit?: boolean;
  readonly staggerDelay?: number;
}

export interface BarXAxisProps {
  /** Half-width of the date pill: ticks nearer than this to the focused band centre are hidden. Default: 50 */
  readonly tickerHalfWidth?: number;
  readonly showAllLabels?: boolean;
  readonly maxLabels?: number;
}

export interface BarYAxisProps {
  /** Show every category label; otherwise thin to `maxLabels`. Default: true */
  readonly showAllLabels?: boolean;
  /** Maximum number of category labels when `showAllLabels` is off. Default: 20 */
  readonly maxLabels?: number;
  readonly numTicks?: number;
  readonly formatLargeNumbers?: boolean;
  readonly formatValue?: (value: number) => string;
  readonly orientation?: "left" | "right";
}

export interface BarDepthSegment {
  readonly value: number;
  readonly color?: string;
}

export interface BarDepthProviderProps {
  readonly children?: ReactNode;
  readonly segmentsAccessor?: (datum: Record<string, unknown>) => readonly BarDepthSegment[] | null | undefined;
  readonly groundShadow?: number;
  readonly minBarHeight?: number;
}

export interface BarDepthBackProps {
  readonly dataKey: string;
  readonly color?: string;
  readonly colorAccessor?: (datum: Record<string, unknown>, index: number) => string | undefined;
}

export interface BarDepthFrontProps {
  readonly dataKey: string;
}

export interface BarPulseProps {
  readonly dataKey: string;
  readonly activeIndex?: number;
  readonly pulsePaused?: boolean;
}

export const Bar = /* @__PURE__ */ defineCarrier<BarProps>("bar", "Bar");
export const BarSquares = /* @__PURE__ */ defineCarrier<BarSquaresProps>("barSquares", "BarSquares");
export const BarColumnTrack = /* @__PURE__ */ defineCarrier<BarColumnTrackProps>("barColumnTrack", "BarColumnTrack");
export const BarXAxis = /* @__PURE__ */ defineCarrier<BarXAxisProps>("barXAxis", "BarXAxis");
export const BarYAxis = /* @__PURE__ */ defineCarrier<BarYAxisProps>("barYAxis", "BarYAxis");
