// Verbatim TanStack guard pattern (charts-core-d3/src/mark.ts: isChartValue +
// charts-core-d3/src/scales.ts: numericValue/isChartValue):
//  - Date is valid iff `instanceof Date && Number.isFinite(getTime())`
//    (rejects Invalid Date / NaN — same guard TanStack uses to gate its
//    temporal branch)
//  - number is valid iff `typeof === "number" && Number.isFinite` (no NaN/Inf)
//  - string|number are NOT auto-parsed to Date — TanStack requires real
//    Date objects (scale-input.ts: temporal map `v instanceof Date ? getTime()
//    : NaN` throws if no Date). bklit compat: reuses that same guard first,
//    then falls back to `new Date(string|number)` ONLY for ISO-8601 clock
//    strings like `composedDocsData`'s `isoDay(i)` — the one documented
//    deviation we inherit, checked again with the same `isFinite` gate.
export function isValidDate(value: unknown): value is Date {
  return value instanceof Date && Number.isFinite(value.getTime());
}

export function toDate(value: unknown): Date | null {
  if (isValidDate(value)) return value;
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value as string & number);
    return isValidDate(parsed) ? parsed : null;
  }
  return null;
}

export function numericValue(value: unknown): number {
  return isValidDate(value) ? value.getTime() : Number(value);
}
