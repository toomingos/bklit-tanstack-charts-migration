// Visx shape patterns ported verbatim, quirks included.
// Hexagons ignores width by design (public API). Line patterns live in ./pattern-lines.
//
// This file is the family hub.
// Every pattern is implemented in a one-component-per-file sibling module.
// Re-exported here unchanged: this file declares zero React components
// (react/no-multi-comp) and existing importers keep working.

// Sibling shape patterns live in one-component-per-file modules.
// Re-exported here unchanged so existing importers keep working.
export { PathImpl } from "./pattern-path";
export { CirclesImpl } from "./pattern-circles";
export { HexagonsImpl } from "./pattern-hexagons";
export { WavesImpl } from "./pattern-waves";
export { PatternCircles } from "./pattern-public-circles";
export { PatternHexagons } from "./pattern-public-hexagons";
export { PatternWaves } from "./pattern-public-waves";
export type { PatternPathProps } from "./pattern-path";
export type { PatternCirclesProps } from "./pattern-circles";
export type { PatternHexagonsProps } from "./pattern-hexagons";
export type { PatternWavesProps } from "./pattern-waves";
