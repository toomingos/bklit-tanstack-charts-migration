import type { ReactElement } from "react";
import {
  EIGHTH_DIVISOR,
  HALF_DIVISOR,
  QUARTER_DIVISOR,
  WAVE_CONTROL_NUMERATOR,
} from "./pattern-geometry";
import { cx } from "./pattern-line-utils";
import type { PatternLinecap } from "./pattern-lines-view";
import { PathImpl } from "./pattern-path";

/** Props of `PatternWaves`. */
// Wave-tile pattern (visx port).
interface PatternWavesProps {
  /** Id of the pattern, referenced as `url(#id)` in a fill. */
  readonly id: string;
  /** Width of the pattern tile in px. */
  readonly width: number;
  /** Height of the pattern tile in px. */
  readonly height: number;
  /**
   * Fill color of the wave path.
   * @default "transparent"
   */
  readonly fill?: string;
  /** Class name added to the drawn shapes. */
  readonly className?: string;
  /** Background color of the tile. No background is drawn when omitted. */
  readonly background?: string;
  /** Stroke color of the shapes. */
  readonly stroke?: string;
  /** Stroke width of the shapes. */
  readonly strokeWidth?: number | string;
  /** SVG dash pattern of the stroke. */
  readonly strokeDasharray?: string | number;
  /**
   * Line cap of the stroke: `"square"`, `"butt"`, `"round"` or `"inherit"`.
   * @default "square"
   */
  readonly strokeLinecap?: PatternLinecap;
  /**
   * SVG `shape-rendering` of the shapes.
   * @default "auto"
   */
  readonly shapeRendering?: string | number;
}

/** A pattern tile with wavy lines (exported as `PatternWaves`). Render it as a child of a chart and point a fill at its `id`. */
const WavesImpl = ({
  id,
  width,
  height,
  fill,
  stroke,
  strokeWidth,
  strokeDasharray,
  strokeLinecap,
  shapeRendering,
  background,
  className,
}: Readonly<PatternWavesProps>): ReactElement => (
  <PathImpl
      pathClassName={cx("visx-pattern-wave", className)}
      path={`M 0 ${height / HALF_DIVISOR} c ${height / EIGHTH_DIVISOR} ${-height / QUARTER_DIVISOR} , ${(height * WAVE_CONTROL_NUMERATOR) / EIGHTH_DIVISOR} ${-height / QUARTER_DIVISOR} , ${height / HALF_DIVISOR} 0
             c ${height / EIGHTH_DIVISOR} ${height / QUARTER_DIVISOR} , ${(height * WAVE_CONTROL_NUMERATOR) / EIGHTH_DIVISOR} ${height / QUARTER_DIVISOR} , ${height / HALF_DIVISOR} 0 M ${-height / HALF_DIVISOR} ${height / HALF_DIVISOR}
             c ${height / EIGHTH_DIVISOR} ${height / QUARTER_DIVISOR} , ${(height * WAVE_CONTROL_NUMERATOR) / EIGHTH_DIVISOR} ${height / QUARTER_DIVISOR} , ${height / HALF_DIVISOR} 0 M ${height} ${height / HALF_DIVISOR}
             c ${height / EIGHTH_DIVISOR} ${-height / QUARTER_DIVISOR} , ${(height * WAVE_CONTROL_NUMERATOR) / EIGHTH_DIVISOR} ${-height / QUARTER_DIVISOR} , ${height / HALF_DIVISOR} 0`}
      id={id}
      width={width}
      height={height}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeDasharray={strokeDasharray}
      strokeLinecap={strokeLinecap}
      shapeRendering={shapeRendering}
      background={background}
    />
  );

WavesImpl.displayName = "WavesImpl";

;
export { WavesImpl };
