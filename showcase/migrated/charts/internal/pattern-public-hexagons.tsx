import type { ReactElement } from "react";
import { HexagonsImpl } from "./pattern-hexagons";
import type { PatternHexagonsProps } from "./pattern-hexagons";

// Public hexagon-pattern component; thin wrapper so the impl stays replaceable.
const PatternHexagons = ({
  background,
  className,
  fill,
  height,
  id,
  shapeRendering: edgeRendering,
  size,
  stroke,
  strokeDasharray,
  strokeLinecap,
  strokeWidth,
}: Readonly<PatternHexagonsProps>): ReactElement => (
  <HexagonsImpl
    background={background}
    className={className}
    fill={fill}
    height={height}
    id={id}
    shapeRendering={edgeRendering}
    size={size}
    stroke={stroke}
    strokeDasharray={strokeDasharray}
    strokeLinecap={strokeLinecap}
    strokeWidth={strokeWidth}
  />
);

PatternHexagons.displayName = "PatternHexagons";

export { PatternHexagons };
