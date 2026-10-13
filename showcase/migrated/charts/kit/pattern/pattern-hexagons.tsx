import type { ReactElement } from "react";
import {
  DEFAULT_HEXAGON_SIZE,
  HALF_DIVISOR,
  HEXAGON_TILE_SPAN,
} from "./pattern-geometry";
import { cx } from "./pattern-line-utils";
import type { PatternLinecap } from "./pattern-lines-view";
import { PathImpl } from "./pattern-path";

/** Props of `PatternHexagons`. */
// Hexagon-tile pattern (visx port, quirks included: width ignored by design).
interface PatternHexagonsProps {
  /** Id of the pattern, referenced as `url(#id)` in a fill. */
  readonly id: string;
  /** Height of the pattern tile in px. The tile width is derived from `size`. */
  readonly height: number;
  /**
   * Relative size of the hexagon cell.
   * @default 3
   */
  readonly size?: number;
  /**
   * Fill color of the hexagon path.
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
