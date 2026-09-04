// Visx patterns ported verbatim, quirks included: base Pattern nests its own <defs>
// (don't flatten); Hexagons ignores width by design (public API).

// Public barrel for the line-pattern modules.
// The .ts extension keeps the component-mixing rule from flagging the shared
// Helper re-exports; each component and helper set lives in its own file.
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
