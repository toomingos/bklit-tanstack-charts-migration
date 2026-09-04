import type { ReactElement } from "react";
import { cx, Pattern } from "./pattern-lines";
import type { PatternLinecap } from "./pattern-lines";

// Base path-tile pattern (visx port); hexagons and waves build on this.
interface PatternPathProps {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  readonly path?: string;
  readonly fill?: string;
  readonly className?: string;
  readonly background?: string;
  readonly stroke?: string;
  readonly strokeWidth?: number | string;
  readonly strokeDasharray?: string | number;
  readonly strokeLinecap?: PatternLinecap;
  readonly shapeRendering?: string | number;
}

const PathImpl = ({
  id,
  width,
  height,
  path,
  fill = "transparent",
  stroke,
  strokeWidth,
  strokeDasharray,
  strokeLinecap = "square",
  shapeRendering: edgeRendering = "auto",
  background,
  className,
}: Readonly<PatternPathProps>): ReactElement => (
  <Pattern id={id} width={width} height={height}>
    {Boolean(background) && <rect width={width} height={height} fill={background} />}
    <path
      className={cx("visx-pattern-path", className)}
      d={path}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeDasharray={strokeDasharray}
      strokeLinecap={strokeLinecap}
      shapeRendering={edgeRendering}
    />
  </Pattern>
);

PathImpl.displayName = "PathImpl";

export type { PatternPathProps };
export { PathImpl };
