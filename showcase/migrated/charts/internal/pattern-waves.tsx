import type { ReactElement } from "react";
import {
  EIGHTH_DIVISOR,
  HALF_DIVISOR,
  QUARTER_DIVISOR,
  WAVE_CONTROL_NUMERATOR,
} from "./pattern-geometry";
import { cx } from "./pattern-lines";
import type { PatternLinecap } from "./pattern-lines";
import { PathImpl } from "./pattern-path";

// Wave-tile pattern (visx port).
interface PatternWavesProps {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  readonly fill?: string;
  readonly className?: string;
  readonly background?: string;
  readonly stroke?: string;
  readonly strokeWidth?: number | string;
  readonly strokeDasharray?: string | number;
  readonly strokeLinecap?: PatternLinecap;
  readonly shapeRendering?: string | number;
}

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

export type { PatternWavesProps };
export { WavesImpl };
