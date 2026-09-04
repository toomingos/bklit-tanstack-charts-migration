import type { ReactElement } from "react";
import { LinesImpl } from "./pattern-lines-impl";
import type { PatternOrientationType } from "./pattern-line-utils";

// Public line-pattern component; trivial wrapper preserved verbatim so the
// Pattern tree and element identity are unchanged.
type PatternLinecap = "square" | "butt" | "round" | "inherit";

interface PatternLinesProps {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  readonly className?: string;
  readonly background?: string;
  readonly stroke?: string;
  readonly strokeWidth?: number | string;
  readonly strokeDasharray?: string | number;
  readonly strokeLinecap?: PatternLinecap;
  readonly shapeRendering?: string | number;
  readonly orientation?: readonly PatternOrientationType[];
}

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
    className={className}
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
export type { PatternLinecap, PatternLinesProps };
