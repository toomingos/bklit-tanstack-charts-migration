import {
  FIVE_QUARTER_FRACTION,
  HALF_DIVISOR,
  QUARTER_DIVISOR,
  THREE_QUARTER_FRACTION,
} from "./pattern-geometry";

// Class-name join and line-orientation geometry shared by the pattern files.
// Pure helpers in their own module so pattern-lines stays component-only.
type ClassValue = string | false | null | undefined;

const cx = (...classes: readonly ClassValue[]): string => classes.filter(Boolean).join(" ");

const PatternOrientation = {
  diagonal: "diagonal",
  diagonalRightToLeft: "diagonalRightToLeft",
  horizontal: "horizontal",
  vertical: "vertical",
} as const;

type PatternOrientationType =
  (typeof PatternOrientation)[keyof typeof PatternOrientation];

const VERTICAL_ORIENTATION: PatternOrientationType[] = ["vertical"];
const HORIZONTAL_ORIENTATION: PatternOrientationType[] = ["horizontal"];
const DIAGONAL_ORIENTATION: PatternOrientationType[] = ["diagonal"];
const CROSS_ORIENTATION: PatternOrientationType[] = ["diagonal", "diagonalRightToLeft"];

const pathForOrientation = ({
  height,
  orientation,
}: {
  readonly height: number;
  readonly orientation: PatternOrientationType;
}): string => {
  if (orientation === PatternOrientation.horizontal) {
    return `M 0,${height / HALF_DIVISOR} l ${height},0`;
  }
  if (orientation === PatternOrientation.diagonal) {
    return `M 0,${height} l ${height},${-height} M ${-height / QUARTER_DIVISOR},${height / QUARTER_DIVISOR} l ${height / HALF_DIVISOR},${-height / HALF_DIVISOR}
            M ${THREE_QUARTER_FRACTION * height},${FIVE_QUARTER_FRACTION * height} l ${height / HALF_DIVISOR},${-height / HALF_DIVISOR}`;
  }
  if (orientation === PatternOrientation.diagonalRightToLeft) {
    return `M 0,0 l ${height},${height}
      M ${-height / QUARTER_DIVISOR},${THREE_QUARTER_FRACTION * height} l ${height / HALF_DIVISOR},${height / HALF_DIVISOR}
      M ${THREE_QUARTER_FRACTION * height},${-height / QUARTER_DIVISOR} l ${height / HALF_DIVISOR},${height / HALF_DIVISOR}`;
  }
  return `M ${height / HALF_DIVISOR}, 0 l 0, ${height}`;
}

export type { ClassValue, PatternOrientationType };
export {
  CROSS_ORIENTATION,
  cx,
  DIAGONAL_ORIENTATION,
  HORIZONTAL_ORIENTATION,
  pathForOrientation,
  PatternOrientation,
  VERTICAL_ORIENTATION,
};
