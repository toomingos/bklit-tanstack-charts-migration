import type { ChartDatum } from "./types";
import type { ScatterPillChromeState } from "./scatter-pill-chrome";

// Explicit form of `first || second || fallback` for nullable strings: undefined and
// "" both fall through (strict-boolean-expressions forbids truthiness tests on strings).
const firstNonEmptyString = (first: string | undefined, second: string | undefined): string | undefined => {
  if (first !== undefined && first !== "") {return first;}
  if (second !== undefined && second !== "") {return second;}
  return undefined;
};

// Primitive narrowing predicates; typeof stays inside type guards (allowInTypeGuards).
const isString = <Value,>(value: Value): value is Value & string => typeof value === "string";
const isNumber = <Value,>(value: Value): value is Value & number => typeof value === "number";
const isFiniteNumber = <Value,>(value: Value): value is Value & number => typeof value === "number" && Number.isFinite(value);

// Pre-render placeholder: the ref below is reassigned every render before any reader runs.
const INITIAL_SCATTER_PILL_CHROME_STATE: ScatterPillChromeState = {
  dateLabels: [],
  pointCount: 0,
  showDatePill: true,
  xDataKey: "",
};

type ScatterDatumField = ChartDatum[string];

const stringifyDatumValue = (value: ScatterDatumField, fallback: string): string => {
  if (isString(value)) {return value;}
  if (isNumber(value)) {return String(value);}
  if (value instanceof Date) {return String(value);}
  if (value === undefined || value === null) {return fallback;}
  return JSON.stringify(value);
};

interface YGradientConfig {
  readonly from?: string;
  readonly to?: string;
}

const isYGradientConfig = <Value,>(value: Value): value is Value & YGradientConfig => typeof value === "object" && value !== null;

interface ScatterTimeExtent {
  readonly maxTime: number;
  readonly minTime: number;
}

const computeTimeExtent = (data: readonly Readonly<ChartDatum>[], xDataKey: string): ScatterTimeExtent | undefined => {
  const times: number[] = [];
  for (const datum of data) {
    const value = datum[xDataKey];
    if (value instanceof Date) {times.push(value.getTime());}
  }
  if (times.length === 0) {return undefined;}
  return { maxTime: Math.max(...times), minTime: Math.min(...times) };
};

interface ScatterYGradientDef {
  readonly from: string;
  readonly id: string;
  readonly to: string;
}

export {
  computeTimeExtent,
  firstNonEmptyString,
  INITIAL_SCATTER_PILL_CHROME_STATE,
  isFiniteNumber,
  isNumber,
  isString,
  isYGradientConfig,
  stringifyDatumValue,
};
export type { ScatterTimeExtent, ScatterYGradientDef, YGradientConfig };
