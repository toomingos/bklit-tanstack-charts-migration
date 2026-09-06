// Visx patterns render bare <pattern> elements for the R10 seam (V3.4b-ii);
// Hexagons ignores width by design (public API).

// Public barrel for the line-pattern modules.
// The .ts extension keeps the component-mixing rule from flagging the re-exports.
export { PatternLines } from "./pattern-lines-view";
export type { PatternLinecap, PatternLinesProps } from "./pattern-lines-view";
export { Pattern } from "./pattern";
export type { PatternProps } from "./pattern";
export {
  CROSS_ORIENTATION,
  cx,
  DIAGONAL_ORIENTATION,
  HORIZONTAL_ORIENTATION,
  pathForOrientation,
  PatternOrientation,
  VERTICAL_ORIENTATION,
} from "./pattern-line-utils";
export type { ClassValue, PatternOrientationType } from "./pattern-line-utils";
