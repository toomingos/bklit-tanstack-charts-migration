/*
 * Boundary parsers: ChartDatum fields are `unknown`, narrowed once here for the mark loops.
 * missing values stay `undefined`: module-local only, and the mark channel takes `readonly unknown[]`.
 */
import type { PatternPresetId } from "./pattern-preset";
import type { ChartDatum } from "./types";

const WICK_WIDTH_PX = 1.5;
const PLAIN_DOT_RADIUS = 5;
const PLAIN_DOT_STROKE_WIDTH = 2;
const RING_STROKE_WIDTH_FALLBACK = 1.5;
const CANDLE_BODY_RADIUS = 1;
const CANDLE_CELL_CLASS_NAME = "chart-candle-cell";
const HOVER_HIGHLIGHT_ID = "hover-highlight";
const HOVER_DOT_ID = "hover-dot";

type CandlePattern = Readonly<{ href: string; preset: PatternPresetId | undefined }>;

const isNumber = <Value>(value: Value): value is Value & number => typeof value === "number";

const readFiniteNumberField = (datum: Readonly<ChartDatum>, key: string): number | undefined => {
  const raw = datum[key];
  // SAFETY: no non-typeof mechanism narrows a primitive out of `unknown`; this is the one
  // Every mark loop below funnels its typeof check through here instead of repeating its own.
  return isNumber(raw) && Number.isFinite(raw) ? raw : undefined;
};

const readDateField = (datum: Readonly<ChartDatum>, key: string): Date | undefined => {
  const raw = datum[key];
  return raw instanceof Date ? raw : undefined;
};

const allFinite = (values: readonly number[]): boolean => values.every((value) => Number.isFinite(value));

interface CandleWickHighFields {
  readonly date: Date;
  readonly low: number;
  readonly high: number;
}

const parseWickHighFields = (datum: Readonly<ChartDatum>, xDataKey: string): CandleWickHighFields | undefined => {
  const date = readDateField(datum, xDataKey);
  if (date === undefined) {return undefined;}
  const low = readFiniteNumberField(datum, "low");
  if (low === undefined) {return undefined;}
  const high = readFiniteNumberField(datum, "high");
  if (high === undefined) {return undefined;}
  return { date, high, low };
};

interface CandleBodyFields {
  readonly date: Date;
  readonly open: number;
  readonly close: number;
}

const parseBodyFields = (datum: Readonly<ChartDatum>, xDataKey: string): CandleBodyFields | undefined => {
  const date = readDateField(datum, xDataKey);
  if (date === undefined) {return undefined;}
  const open = readFiniteNumberField(datum, "open");
  if (open === undefined) {return undefined;}
  const close = readFiniteNumberField(datum, "close");
  if (close === undefined) {return undefined;}
  return { close, date, open };
};

interface CandleAllFields {
  readonly date: Date;
  readonly low: number;
  readonly high: number;
  readonly open: number;
  readonly close: number;
}

const parseAllFields = (datum: Readonly<ChartDatum>, xDataKey: string): CandleAllFields | undefined => {
  const wick = parseWickHighFields(datum, xDataKey);
  if (wick === undefined) {return undefined;}
  const body = parseBodyFields(datum, xDataKey);
  if (body === undefined) {return undefined;}
  return { close: body.close, date: wick.date, high: wick.high, low: wick.low, open: body.open };
};

export type {
  CandleAllFields,
  CandleBodyFields,
  CandlePattern,
  CandleWickHighFields,
};
export {
  allFinite,
  CANDLE_BODY_RADIUS,
  CANDLE_CELL_CLASS_NAME,
  HOVER_DOT_ID,
  HOVER_HIGHLIGHT_ID,
  parseAllFields,
  parseBodyFields,
  parseWickHighFields,
  PLAIN_DOT_RADIUS,
  PLAIN_DOT_STROKE_WIDTH,
  readDateField,
  readFiniteNumberField,
  RING_STROKE_WIDTH_FALLBACK,
  WICK_WIDTH_PX,
};
