// Pattern-preset data: ids, options, tile math, and circle/line predicates.
// Split from the pattern-preset barrel so that barrel re-exports components only.
import { DEFAULT_PATTERN_SCALE } from "./pattern-geometry";

const PATTERN_PRESET_IDS = [
  "none",
  "diagonal",
  "horizontal",
  "vertical",
  "cross",
  "dots",
  "circles",
  "accent",
] as const;

type PatternPresetId = (typeof PATTERN_PRESET_IDS)[number];

interface PatternPresetOptions {
  readonly color?: string;
  readonly scale?: number;
  readonly strokeWidth?: number;
  readonly radius?: number;
  readonly complement?: boolean;
  readonly fill?: string;
  readonly dotFill?: boolean;
  readonly tileBackground?: string;
}

const isCirclePattern = (preset: PatternPresetId): boolean => preset === "circles" || preset === "dots";


const isCirclesPattern = (preset: PatternPresetId): boolean => isCirclePattern(preset);


interface PatternTileSize {
  readonly width: number;
  readonly height: number;
  readonly strokeWidth: number;
}

const patternPresetTileSize = (preset: PatternPresetId, scale = DEFAULT_PATTERN_SCALE): PatternTileSize => {
  let base = { height: 6, strokeWidth: 1, width: 6 };
  if (preset === "dots") {
    base = { height: 10, strokeWidth: 0, width: 10 };
  } else if (preset === "cross") {
    base = { height: 8, strokeWidth: 1, width: 8 };
  } else if (preset === "circles") {
    base = { height: 6, strokeWidth: 1, width: 6 };
  } else {
    // Remaining presets reuse the default 6x6 tile.
  }
  return {
    height: base.height * scale,
    strokeWidth: base.strokeWidth * scale,
    width: base.width * scale,
  };
}

interface PatternTileCommon {
  readonly id: string;
  readonly height: number;
  readonly width: number;
  readonly strokeWidth: number;
  readonly background?: string;
}

export {
  PATTERN_PRESET_IDS,
  isCirclePattern,
  isCirclesPattern,
  patternPresetTileSize,
};
export type { PatternPresetId, PatternPresetOptions, PatternTileCommon, PatternTileSize };
