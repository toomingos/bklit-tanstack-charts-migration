// Visx shape patterns ported verbatim, quirks included.
// Hexagons ignores width by design (public API). Line patterns live in ./pattern-lines.

// Sibling shape patterns live in one-component-per-file modules.
// Re-exported here unchanged so existing importers keep working.
export { PathImpl } from "./pattern-path";
export { CirclesImpl, CirclesImpl as PatternCircles } from "./pattern-circles";
export { HexagonsImpl } from "./pattern-hexagons";
export { WavesImpl, WavesImpl as PatternWaves } from "./pattern-waves";
export { PatternHexagons } from "./pattern-public-hexagons";
export type { PatternPathProps } from "./pattern-path";
export type { PatternCirclesProps } from "./pattern-circles";
export type { PatternHexagonsProps } from "./pattern-hexagons";
export type { PatternWavesProps } from "./pattern-waves";
