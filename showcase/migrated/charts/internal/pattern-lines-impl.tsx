import type { ReactElement } from "react";
import { Pattern } from "./pattern";
import { cx, pathForOrientation, VERTICAL_ORIENTATION } from "./pattern-line-utils";
import type { PatternOrientationType } from "./pattern-line-utils";
import type { PatternLinecap } from "./pattern-lines";

// Line-pattern implementation split out so pattern-lines holds only the public PatternLines component.
// Internal class-name prop is lineClassName: forbid-component-props bans className on components.
interface LinesImplProps {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  readonly lineClassName?: string;
  readonly background?: string;
  readonly stroke?: string;
  readonly strokeWidth?: number | string;
  readonly strokeDasharray?: string | number;
  readonly strokeLinecap?: PatternLinecap;
  readonly shapeRendering?: string | number;
  readonly orientation?: readonly PatternOrientationType[];
}
interface LinePathArgs {
  readonly id: string;
  readonly orientation: PatternOrientationType;
  readonly height: number;
  readonly stroke: string | undefined;
  readonly strokeWidth: number | string | undefined;
  readonly strokeDasharray: string | number | undefined;
  readonly strokeLinecap: PatternLinecap;
  readonly shapeRendering: string | number;
  readonly className: string | undefined;
}

// One oriented line path; plain function (not a component) so the pattern tree is unchanged.
const renderLinePath = (pathArgs: Readonly<LinePathArgs>): ReactElement => (
  <path
    key={`visx-${pathArgs.id}-line-${pathArgs.orientation}`}
    className={cx("visx-pattern-line", pathArgs.className)}
    d={pathForOrientation({ height: pathArgs.height, orientation: pathArgs.orientation })}
    stroke={pathArgs.stroke}
    strokeWidth={pathArgs.strokeWidth}
    strokeDasharray={pathArgs.strokeDasharray}
    strokeLinecap={pathArgs.strokeLinecap}
    shapeRendering={pathArgs.shapeRendering}
  />
);

// Array.isArray narrows to any[], which would make the mapped items any.
// This guard keeps the same runtime check with a precise element type.
type OrientationInput = readonly PatternOrientationType[] | PatternOrientationType;
const isOrientationList = (value: OrientationInput): value is readonly PatternOrientationType[] => Array.isArray(value);

const LinesImpl = ({
  id,
  width,
  height,
  stroke,
  strokeWidth,
  strokeDasharray,
  strokeLinecap = "square",
  shapeRendering = "auto",
  orientation = VERTICAL_ORIENTATION,
  background,
  lineClassName,
}: Readonly<LinesImplProps>): ReactElement => {
  const orientations = isOrientationList(orientation) ? orientation : [orientation];
  return (
    <Pattern id={id} width={width} height={height}>
      {Boolean(background) && (
        <rect
          className={cx("visx-pattern-line-background")}
          width={width}
          height={height}
          fill={background}
        />
      )}
      {orientations.map((orientationItem) => renderLinePath({
        className: lineClassName,
        height,
        id,
        orientation: orientationItem,
        shapeRendering,
        stroke,
        strokeDasharray,
        strokeLinecap,
        strokeWidth,
      }))}
    </Pattern>
  );
}

export { LinesImpl };
