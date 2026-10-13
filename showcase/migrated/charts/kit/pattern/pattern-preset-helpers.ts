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

/**
 * Name of a ready-made pattern: `"none"` (solid), `"diagonal"`, `"horizontal"`, `"vertical"` or `"cross"` lines, `"dots"`, `"circles"` or `"accent"`.
 */
type PatternPresetId = (typeof PATTERN_PRESET_IDS)[number];

/**
 * Options that tune a pattern preset. Which ones apply depends on the preset; unset options use the preset's own values.
 */
interface PatternPresetOptions {
  /** Color of the pattern lines or dots. */
  readonly color?: string;
  /**
   * Scales the tile size. `2` doubles it.
   * @default 1
   */
  readonly scale?: number;
  /** Stroke width of the lines, or of the ring around circles. */
  readonly strokeWidth?: number;
  /** Radius of the dots or circles in px. */
  readonly radius?: number;
  /** Also draw circles at the tile corners so the pattern reads as a staggered grid. */
  readonly complement?: boolean;
  /** Fill color of dots or circles. */
  readonly fill?: string;
  /** Fill the dots of the `"dots"` preset. Set to `false` to draw outlined dots. */
  readonly dotFill?: boolean;
  /** Background color behind the pattern tile. */
  readonly tileBackground?: string;
}

/** @internal */
const isCirclePattern = (preset: PatternPresetId): boolean => preset === "circles" || preset === "dots";


/** @internal */
const isCirclesPattern = (preset: PatternPresetId): boolean => isCirclePattern(preset);


interface PatternTileSize {
  readonly width: number;
  readonly height: number;
  readonly strokeWidth: number;
}

/** @internal */
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
export type { PatternPresetId, PatternPresetOptions, PatternTileCommon };
