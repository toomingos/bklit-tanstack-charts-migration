// Shared predicates, pattern reference, and numeric spellings for the candlestick chart modules.
import type { PatternPresetId } from "./pattern-preset";

// Default enter is a spring: duration 0.8s (bklit).
const DEFAULT_ENTER_DURATION_SEC = 0.8;
const MS_PER_SECOND = 1000;
const MIN_ENTER_DURATION_MS = 1;
// Shared numeric spellings for the geometry and timing below (no bare literals).
const GEOMETRY_HALF_DIVISOR = 2;
const FLAT_EXTENT_FALLBACK_PX = 1;
const COLLAPSED_GEOMETRY_PX = 0;
const MIN_GEOMETRY_EXTENT_PX = 0;
const NO_ANIMATION_DURATION_MS = 0;
const EMPTY_CONTAINER_PX = 0;
const EMPTY_COUNT = 0;
const MIN_ROW_COUNT = 1;

// Pattern overlay reference shared by the wicks/bodies/highlight marks and the resolver.
interface CandlePatternRef {
  readonly href: string;
  readonly preset: PatternPresetId | undefined;
}

// Both segment ends must be finite before they are mapped through the scales.
const areBothFinite = (first: number, second: number): boolean => Number.isFinite(first) && Number.isFinite(second);

// Primitive narrowing lives in these predicates (anti-slop allowInTypeGuards);
// Call sites branch on the domain value instead of repeating `typeof`.
const isNumber = <Value,>(value: Value): value is Value & number => typeof value === "number";
const isString = <Value,>(value: Value): value is Value & string => typeof value === "string";
const isFiniteNumber = <Value,>(value: Value): value is Value & number => isNumber(value) && Number.isFinite(value);

export type { CandlePatternRef };
export {
  areBothFinite,
  COLLAPSED_GEOMETRY_PX,
  DEFAULT_ENTER_DURATION_SEC,
  EMPTY_CONTAINER_PX,
  EMPTY_COUNT,
  FLAT_EXTENT_FALLBACK_PX,
  GEOMETRY_HALF_DIVISOR,
  isFiniteNumber,
  isNumber,
  isString,
  MIN_ENTER_DURATION_MS,
  MIN_GEOMETRY_EXTENT_PX,
  MIN_ROW_COUNT,
  MS_PER_SECOND,
  NO_ANIMATION_DURATION_MS,
};
