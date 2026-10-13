import type { ReactElement } from "react";
import {
  DEFAULT_CIRCLE_RADIUS,
  HALF_DIVISOR,
  TILE_ORIGIN,
} from "./pattern-geometry";
import { Pattern } from "./pattern";
import { cx } from "./pattern-line-utils";
import type { ClassValue } from "./pattern-line-utils";

/** Props of `PatternCircles`. */
// Circle-tile pattern (visx port); corner complements mirror bklit's tile.
interface PatternCirclesProps {
  /** Id of the pattern, referenced as `url(#id)` in a fill. */
  readonly id: string;
  /** Width of the pattern tile in px. */
  readonly width: number;
  /** Height of the pattern tile in px. */
  readonly height: number;
  /**
   * Radius of the circle in px.
   * @default 2
   */
  readonly radius?: number;
  /** Fill color of the circle. */
  readonly fill?: string;
  /** Class name added to the drawn shapes. */
  readonly className?: string;
  /** Stroke color of the circle. */
  readonly stroke?: string;
  /** Stroke width of the circle. */
  readonly strokeWidth?: number | string;
  /** SVG dash pattern of the stroke. */
  readonly strokeDasharray?: number | string;
  /**
   * Also draw circles at the four tile corners.
   * @default false
   */
  readonly complement?: boolean;
  /** Background color of the tile. No background is drawn when omitted. */
  readonly background?: string;
}

interface ComplementCircleArgs {
  readonly id: string;
  readonly cornerX: number;
  readonly cornerY: number;
  readonly radius: number;
  readonly fill: string | undefined;
  readonly className: ClassValue;
  readonly stroke: string | undefined;
  readonly strokeWidth: number | string | undefined;
  readonly strokeDasharray: number | string | undefined;
}

// One corner-complement circle; plain function (not a component) so the pattern tree is unchanged.
const renderComplementCircle = (circleArgs: Readonly<ComplementCircleArgs>): ReactElement => (
  <circle
    key={`${circleArgs.id}-complement-${circleArgs.cornerX}-${circleArgs.cornerY}`}
    className={cx(
      "visx-pattern-circle visx-pattern-circle-complement",
      circleArgs.className,
    )}
    cx={circleArgs.cornerX}
    cy={circleArgs.cornerY}
    r={circleArgs.radius}
    fill={circleArgs.fill}
    stroke={circleArgs.stroke}
    strokeWidth={circleArgs.strokeWidth}
    strokeDasharray={circleArgs.strokeDasharray}
  />
);

/**
 * A pattern tile with one circle (exported as `PatternCircles`). Render it as a child of a chart and point a fill at its `id`, for example `fill="url(#my-dots)"`.
 */
const CirclesImpl = ({
  id,
  width,
  height,
  radius = DEFAULT_CIRCLE_RADIUS,
  fill,
  stroke,
  strokeWidth,
  strokeDasharray,
  background,
  complement = false,
  className,
}: Readonly<PatternCirclesProps>): ReactElement => {
  const corners: readonly (readonly [number, number])[] | undefined = complement
    ? [
        [TILE_ORIGIN, TILE_ORIGIN],
        [TILE_ORIGIN, height],
        [width, TILE_ORIGIN],
        [width, height],
      ]
    : undefined;
  return (
    <Pattern id={id} width={width} height={height}>
      {Boolean(background) && <rect width={width} height={height} fill={background} />}
      <circle
        className={cx("visx-pattern-circle", className)}
        cx={width / HALF_DIVISOR}
        cy={height / HALF_DIVISOR}
        r={radius}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeDasharray={strokeDasharray}
      />
      {corners?.map(([cornerX, cornerY]) => renderComplementCircle({
        className,
        cornerX,
        cornerY,
        fill,
        id,
        radius,
        stroke,
        strokeDasharray,
        strokeWidth,
      }))}
    </Pattern>
  );
};

CirclesImpl.displayName = "CirclesImpl";

;
export { CirclesImpl };
