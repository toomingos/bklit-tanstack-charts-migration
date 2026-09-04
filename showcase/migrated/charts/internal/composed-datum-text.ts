import type { ChartTooltipConfig } from "./types";

// Narrowing predicates for open-ended chart values.
// Props and datum fields arrive as unknown; each predicate carries one typeof check.
const isStringValue = (value: ChartTooltipConfig["indicatorColor"]): value is string => typeof value === "string";
const isNumberValue = <Value,>(value: Value): value is Value & number => typeof value === "number";
const isStringField = <Subject,>(value: Subject): value is Subject & string => typeof value === "string";

interface StringifyDatumFieldParams {
  readonly absent: string;
  readonly value: unknown;
}

// JSON.stringify returns undefined for functions, symbols, and undefined at runtime.
const stringifyJson = (params: Readonly<{ value: unknown }>): string | undefined =>
  JSON.stringify(params.value);

// Stringifies an untyped datum field without Object's default "[object Object]" dump.
const stringifyDatumField = (params: Readonly<StringifyDatumFieldParams>): string => {
  const { absent, value } = params;
  if (isStringField(value)) {return value;}
  if (isNumberValue(value)) {return String(value);}
  if (value instanceof Date) {return String(value);}
  if (value === null || value === undefined) {return absent;}
  return stringifyJson({ value }) ?? absent;
};

export { isNumberValue, isStringValue, stringifyDatumField };
export type { StringifyDatumFieldParams };
