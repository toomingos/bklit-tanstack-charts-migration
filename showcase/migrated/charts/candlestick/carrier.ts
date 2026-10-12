// Candlestick config-carrier child: renders nothing, CandlestickChart reads its props.
import { defineCarrier } from "../kit/role";

export interface CandlestickProps {
  /** Whether to animate the candlesticks. Default: true */
  readonly animate?: boolean;
  /** Fill for positive (close >= open) candles. Default: emerald */
  readonly positiveFill?: string;
  /** Fill for negative candles. Default: red */
  readonly negativeFill?: string;
  readonly bodyPatternPositive?: string;
  readonly bodyPatternNegative?: string;
  /** Accepted for API compatibility; the native body uses a single stroke. */
  readonly insideStrokeWidth?: number;
  /** Opacity when another candle is hovered. Default: 0.3 */
  readonly fadedOpacity?: number;
  /** Dim non-hovered candles on hover. Default: true */
  readonly showHoverFade?: boolean;
}

export const Candlestick = /* @__PURE__ */ defineCarrier<CandlestickProps>("candlestick", "Candlestick");
