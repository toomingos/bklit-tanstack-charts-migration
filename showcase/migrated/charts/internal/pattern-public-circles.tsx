import type { ReactElement } from "react";
import { CirclesImpl } from "./pattern-circles";
import type { PatternCirclesProps } from "./pattern-circles";

// Public circle-pattern component; thin wrapper so the impl stays replaceable.
const PatternCircles = ({
  background,
  className,
  complement,
  fill,
  height,
  id,
  radius,
  stroke,
  strokeDasharray,
  strokeWidth,
  width,
}: Readonly<PatternCirclesProps>): ReactElement => (
  <CirclesImpl
    background={background}
    className={className}
    complement={complement}
    fill={fill}
    height={height}
    id={id}
    radius={radius}
    stroke={stroke}
    strokeDasharray={strokeDasharray}
    strokeWidth={strokeWidth}
    width={width}
  />
);

PatternCircles.displayName = "PatternCircles";

export { PatternCircles };
