/**
 * P6.1 / T-F1 (DOC-8) — axis-id primitives, ported from bklit
 * `y-axis-scales.ts:5-27`.
 *
 * Deliberately dependency-free (no React, no d3) so the two config extractors
 * that need only the normalizer can import it without pulling the scale layer
 * in. It replaces TWO byte-identical private copies of `normalizeYAxisId`
 * (`internal/projection-config.ts:11`, `internal/reference-area-config.ts:4`),
 * which is the second finding of the D327 "two constants that coincide" shape
 * — except here they genuinely ARE one concept, tracked to one legacy source,
 * so they collapse.
 *
 * TanStack has no axis-id concept at all (go-to-plan DOC-8, "custom; TanStack
 * has no axis-id concept — confirmed"), so everything here is migrated-side
 * machinery with no upstream counterpart to track.
 */

/** bklit `y-axis-scales.ts:5`. Recharts-style primary/left axis. */
export const DEFAULT_Y_AXIS_ID = "left";

/** bklit `y-axis-scales.ts:7`. */
export type YAxisOrientation = "left" | "right";

/**
 * bklit `y-axis-scales.ts:9-14`, verbatim behaviour including the empty-string
 * case: `""` is treated as "unset", not as an axis literally named `""`.
 */
export function normalizeYAxisId(id?: string | number): string {
  if (id == null || id === "") return DEFAULT_Y_AXIS_ID;
  return String(id);
}

/**
 * The minimum a series config must carry to participate in axis grouping.
 * `LineConfig`/`AreaConfig`/`BarConfig`/`ScatterConfig` all satisfy it
 * structurally (`internal/types.ts` declares `yAxisId?: string | number` on
 * each), so callers pass their own config arrays with no adapter.
 */
export interface YAxisSeries {
  dataKey: string;
  yAxisId?: string | number;
}

/**
 * bklit `groupLinesByYAxisId` (`y-axis-scales.ts:16-27`). Insertion-ordered,
 * because a `Map` preserves it and the axis render order downstream is the
 * order the series were declared in — the same reason bklit uses a Map here
 * rather than a plain object.
 */
export function groupSeriesByYAxisId<T extends YAxisSeries>(
  series: readonly T[],
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const s of series) {
    const axisId = normalizeYAxisId(s.yAxisId);
    const bucket = groups.get(axisId) ?? [];
    bucket.push(s);
    groups.set(axisId, bucket);
  }
  return groups;
}

/**
 * True when every series lands on the default axis — i.e. the chart is
 * single-axis in practice regardless of whether `yAxisId` was ever typed.
 *
 * This is NOT a convenience: it is bklit `time-series-chart-shell.tsx:216-222`,
 * the gate on the AX4 `yScaleDomainMax` short-circuit. Legacy computes it over
 * the WHOLE series list, then decides whether to hand the override down to a
 * per-axis domain resolution — so the check must stay at the grouping layer and
 * must never be re-derived from a single axis group, where it would be
 * trivially true and would leak a stacked-composed override onto one axis of a
 * multi-axis chart.
 */
export function usesDefaultAxisOnly(series: readonly YAxisSeries[]): boolean {
  for (const s of series) {
    if (normalizeYAxisId(s.yAxisId) !== DEFAULT_Y_AXIS_ID) return false;
  }
  return true;
}
