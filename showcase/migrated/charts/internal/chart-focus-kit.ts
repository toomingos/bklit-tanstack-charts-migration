// Shared internals for the per-chart ChartFocusStrategy implementations
// (bar / scatter / candlestick). Extraction-only: every helper here is the
// byte-identical twin of logic previously inlined in
// internal/{bar,scatter,candlestick}-focus-strategy.ts. Two deliberate,
// bklit-anchored divergences are preserved as parameters:
//   - member identity: bar keys by `group ?? markId` (one entry per series
//     group), scatter/candlestick key by `markId`;
//   - others ordering: NO caller sorts by y (D320/D307: bklit emits tooltip
//     rows by iterating `lines` in declaration order — resolveTooltipFromX
//     builds a yPositions record, no grouped array, and zero `a.y - b.y`
//     sorts exist in legacy charts). TanStack's focusX grouped sorts by y
//     (charts-core-d3/src/focus.ts:64) but is the ceiling reference, not
//     parity; `sortOthersByY` remains a parameter for candlestick's
//     documented opt-out shape and future needs, all callers pass false.
interface ChartPointLike {
  readonly x: number;
  readonly y: number;
  readonly xValue: unknown;
}

/** Byte-identical twin of the `valueKey` helpers inlined in
    bar/scatter-focus-strategy.ts (Date → `date:<ms>`, else typed string). */
export function focusValueKey(value: unknown): string {
  if (value instanceof Date) return `date:${value.getTime()}`;
  return `${typeof value}:${String(value)}`;
}

/** Nearest point to scene-x `x` among `points`, strict `<`: ties keep the
    earlier-scanned point, mirroring bklit's bisectDateLeft +
    resolveNearestIndex tie-break toward the earlier point. */
export function findNearestPointByX<P extends ChartPointLike>(
  points: readonly P[],
  x: number,
  maxDistance: number,
): P | undefined {
  let nearest: P | undefined;
  let distance = maxDistance;
  for (const p of points) {
    const d = Math.abs(p.x - x);
    if (d >= distance) continue;
    nearest = p;
    distance = d;
  }
  return nearest;
}

/** Collects [primary, ...others] for a hover group: one point per member key
    among points sharing the primary's x key; primary first, then others in
    scan order (no y-sort — bklit emits tooltip rows in declaration order;
    see header). */
export function collectFocusGroup<P extends ChartPointLike>(
  points: readonly P[],
  primary: P,
  xKeyOf: (xValue: unknown) => string | number,
  memberKeyOf: (p: P) => string | number,
  sortOthersByY: boolean,
): P[] {
  const key = xKeyOf(primary.xValue);
  const unique = new Map<string | number, P>();
  unique.set(memberKeyOf(primary), primary);
  for (const cand of points) {
    if (xKeyOf(cand.xValue) !== key) continue;
    const mKey = memberKeyOf(cand);
    if (!unique.has(mKey)) unique.set(mKey, cand);
  }
  const others: P[] = [];
  for (const p of unique.values()) {
    if (p !== primary) others.push(p);
  }
  if (sortOthersByY) others.sort((a, b) => a.y - b.y);
  return [primary, ...others];
}

/** Navigation order: all points sorted by scene-x then y, deduped to one
    representative per x key (first wins). */
export function navigationOrder<P extends { readonly x: number; readonly y: number; readonly xValue: unknown }>(
  points: readonly P[],
  xKeyOf: (xValue: unknown) => string | number,
): P[] {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const unique = new Map<string | number, P>();
  for (const p of sorted) {
    const k = xKeyOf(p.xValue);
    if (!unique.has(k)) unique.set(k, p);
  }
  return [...unique.values()];
}
