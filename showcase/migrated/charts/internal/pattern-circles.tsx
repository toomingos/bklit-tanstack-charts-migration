import type { ReactElement } from "react";
import {
  DEFAULT_CIRCLE_RADIUS,
  HALF_DIVISOR,
  TILE_ORIGIN,
} from "./pattern-geometry";
import { cx, Pattern } from "./pattern-lines";
import type { ClassValue } from "./pattern-lines";

// Circle-tile pattern (visx port); corner complements mirror the legacy tile.
interface PatternCirclesProps {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  readonly radius?: number;
  readonly fill?: string;
  readonly className?: string;
  readonly stroke?: string;
  readonly strokeWidth?: number | string;
  readonly strokeDasharray?: number | string;
  readonly complement?: boolean;
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

export type { PatternCirclesProps };
export { CirclesImpl };
