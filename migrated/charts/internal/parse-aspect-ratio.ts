export function parseAspectRatio(value: string): number {
  const parts = value.split("/").map(Number);
  if (parts.length !== 2 || parts.some(isNaN) || parts[1] === 0) return 2;
  return parts[0] / parts[1];
}
