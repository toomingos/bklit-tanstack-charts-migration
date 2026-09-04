import type { ReactElement } from "react";
import {
  DEFAULT_HEXAGON_SIZE,
  HALF_DIVISOR,
  HEXAGON_TILE_SPAN,
} from "./pattern-geometry";
import { cx } from "./pattern-lines";
import type { PatternLinecap } from "./pattern-lines";
import { PathImpl } from "./pattern-path";

// Hexagon-tile pattern (visx port, quirks included: width ignored by design).
interface PatternHexagonsProps {
  readonly id: string;
  readonly height: number;
  readonly size?: number;
  readonly fill?: string;
  readonly className?: string;
  readonly background?: string;
  readonly stroke?: string;
  readonly strokeWidth?: number | string;
  readonly strokeDasharray?: string | number;
  readonly strokeLinecap?: PatternLinecap;
  readonly shapeRendering?: string | number;
}

const HexagonsImpl = ({
  id,
  height,
  fill,
  stroke,
  strokeWidth,
  strokeDasharray,
  strokeLinecap,
  shapeRendering,
  background,
  className,
  size = DEFAULT_HEXAGON_SIZE,
}: Readonly<PatternHexagonsProps>): ReactElement => {
  const sqrtSize = Math.sqrt(size);
  return (
    <PathImpl
      pathClassName={cx("visx-pattern-hexagon", className)}
      path={`M ${height},0 l ${height},0 l ${height / HALF_DIVISOR},${(height * sqrtSize) / HALF_DIVISOR} l ${-height / HALF_DIVISOR},${(height * sqrtSize) / HALF_DIVISOR} l ${-height},0 l ${-height / HALF_DIVISOR},${(-height * sqrtSize) / HALF_DIVISOR} Z M 0,${(height * sqrtSize) / HALF_DIVISOR} l ${height / HALF_DIVISOR},0 M ${HEXAGON_TILE_SPAN * height},${(height * sqrtSize) / HALF_DIVISOR} l ${-height / HALF_DIVISOR},0`}
      id={id}
      width={size}
      height={sqrtSize}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeDasharray={strokeDasharray}
      strokeLinecap={strokeLinecap}
      shapeRendering={shapeRendering}
      background={background}
    />
  );
};

HexagonsImpl.displayName = "HexagonsImpl";

export type { PatternHexagonsProps };
export { HexagonsImpl };
