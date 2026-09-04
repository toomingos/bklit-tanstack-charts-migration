// Date valid iff instanceof Date + finite time; strings/numbers take an ISO-parse fallback (bklit compat).
const isValidDate = <Value>(value: Value): value is Value & Date => value instanceof Date && Number.isFinite(value.getTime());

// Anti-slop permits `typeof` inside a type guard; toDate branches on this predicate instead.
const isDateConstructorInput = <Value>(value: Value): value is Value & (string | number) =>
  typeof value === "string" || typeof value === "number";


const toDate = (value: unknown): Date | null => {
  if (isValidDate(value)) {return value;}
  if (isDateConstructorInput(value)) {
    const parsed = new Date(value);
    return isValidDate(parsed) ? parsed : null;
  }
  return null;
}

export { isValidDate, toDate };
