import type { ReactElement } from "react";
import { LinesImpl } from "./pattern-lines-impl";
import type { PatternOrientationType } from "./pattern-line-utils";

/** Line cap of a pattern stroke: `"square"`, `"butt"`, `"round"` or `"inherit"`. */
// Public line-pattern component; trivial wrapper preserved verbatim so the
// Pattern tree and element identity are unchanged.
type PatternLinecap = "square" | "butt" | "round" | "inherit";

/** Props of `PatternLines`. */
interface PatternLinesProps {
  /** Id of the pattern, referenced as `url(#id)` in a fill. */
  readonly id: string;
  /** Width of the pattern tile in px. */
  readonly width: number;
  /** Height of the pattern tile in px. */
  readonly height: number;
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
  /**
   * Directions of the lines: any of `"vertical"`, `"horizontal"`, `"diagonal"` and `"diagonalRightToLeft"`.
   * @default ["vertical"]
   */
  readonly orientation?: PatternOrientationType[];
}

/** A pattern tile with straight lines in one or more directions. Render it as a child of a chart and point a fill at its `id`. */
const PatternLines = ({
  background,
  className,
  height,
  id,
  orientation,
  shapeRendering,
  stroke,
  strokeDasharray,
  strokeLinecap,
  strokeWidth,
  width,
}: Readonly<PatternLinesProps>): ReactElement => (
  <LinesImpl
    background={background}
    lineClassName={className}
    height={height}
    id={id}
    orientation={orientation}
    shapeRendering={shapeRendering}
    stroke={stroke}
    strokeDasharray={strokeDasharray}
    strokeLinecap={strokeLinecap}
    strokeWidth={strokeWidth}
    width={width}
  />
);

PatternLines.displayName = "PatternLines";

export { PatternLines };
export type { PatternLinecap };
