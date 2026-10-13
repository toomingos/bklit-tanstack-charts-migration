"use client";
// Candlestick config-carrier child: renders nothing, CandlestickChart reads its props.
import { defineCarrier } from "../kit/role";

export interface CandlestickProps {
  /**
   * Animate the candles in on entrance.
   * @default true
   */
  readonly animate?: boolean;
  /**
   * Fill color of candles that closed at or above their open.
   * @default "var(--color-emerald-500, oklch(69.6% 0.17 162.48))"
   */
  readonly positiveFill?: string;
  /**
   * Fill color of candles that closed below their open.
   * @default "var(--color-red-500, oklch(63.7% 0.237 25.331))"
   */
  readonly negativeFill?: string;
  /** Accepted for bklit-ui compatibility. It has no effect in bklit-tanstack-charts. */
  readonly bodyPatternPositive?: string;
  /** Accepted for bklit-ui compatibility. It has no effect in bklit-tanstack-charts. */
  readonly bodyPatternNegative?: string;
  /** Accepted for bklit-ui compatibility. It has no effect in bklit-tanstack-charts. */
  readonly insideStrokeWidth?: number;
  /**
   * Opacity of the candles that are not hovered while another candle is hovered.
   * @default 0.3
   */
  readonly fadedOpacity?: number;
  /**
   * Dim the candles that are not hovered.
   * @default true
   */
  readonly showHoverFade?: boolean;
}

/** The candles of a `CandlestickChart`: a body between open and close and a wick between high and low. It renders nothing itself; place it as a child of the chart. */
export const Candlestick = /* @__PURE__ */ defineCarrier<CandlestickProps>("candlestick", "Candlestick");
