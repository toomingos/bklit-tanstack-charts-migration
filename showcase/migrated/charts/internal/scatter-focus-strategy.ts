import type { ChartFocusStrategy, ChartPoint } from "@tanstack/charts";
import { isChartInteractionPhase } from "./chart-phase";
import type { ChartDatum, ChartPhase } from "./types";

function valueKey(value: unknown): string {
  if (value instanceof Date) return `date:${value.getTime()}`;
  return `${typeof value}:${String(value)}`;
}

function collectPerMark(
  points: readonly ChartPoint<ChartDatum, Date, number>[],
  primary: ChartPoint<ChartDatum, Date, number>,
): readonly ChartPoint<ChartDatum, Date, number>[] {
  const key = valueKey(primary.xValue);
  const unique = new Map<string, ChartPoint<ChartDatum, Date, number>>();
  unique.set(primary.markId, primary);
  for (const cand of points) {
    if (valueKey((cand as ChartPoint<ChartDatum, Date, number>).xValue) !== key) continue;
    const id = (cand as ChartPoint<ChartDatum, Date, number>).markId;
    if (!unique.has(id)) unique.set(id, cand as ChartPoint<ChartDatum, Date, number>);
  }
  const others = [...unique.values()]
    .filter((p) => p !== primary)
    .sort((a, b) => a.y - b.y);
  return [primary, ...others];
}

/**
 * Custom ChartFocusStrategy that reproduces bklit's bisectDateLeft +
 * resolveNearestIndex semantics (strict `>` tie-break toward earlier point)
 * but expressed over ChartPoints.
 *
 * - resolve: finds the nearest xValue by scene-x distance to `x`, using
 *   the same strict `>=` tie-break that the bisector used (earlier point
 *   wins on equal distance). Returns all points sharing that xValue, one
 *   per markId (mirrors scatter-chart.tsx:485-497 per-series mapping).
 * - group: collects per-series points sharing the resolved xValue (one per
 *   markId), sorted by y like TanStack's focusX grouped strategy.
 * - navigation: unique xValues sorted by x→y, one representative per xValue.
 *
 * The strategy respects bklit's canInteract gate: when phaseRef.current !==
 * "ready" it returns [] so the hover chrome hides.
 */
export function createScatterFocusStrategy(
  phaseRef: { current: ChartPhase },
): ChartFocusStrategy<ChartDatum, Date, number> {
  return {
    resolve(
      points: readonly ChartPoint<ChartDatum, Date, number>[],
      { x, maxDistance },
    ): readonly ChartPoint<ChartDatum, Date, number>[] {
      if (!isChartInteractionPhase(phaseRef.current)) return [];
      if (points.length === 0) return [];
      let nearest: ChartPoint<ChartDatum, Date, number> | undefined;
      let distance = maxDistance;
      for (const p of points) {
        const d = Math.abs(p.x - x);
        if (d >= distance) continue;
        nearest = p;
        distance = d;
      }
      if (!nearest) return [];
      return collectPerMark(points, nearest);
    },

    group(
      points: readonly ChartPoint<ChartDatum, Date, number>[],
      { point },
    ): readonly ChartPoint<ChartDatum, Date, number>[] {
      if (points.length === 0) return [point];
      return collectPerMark(points, point);
    },

    navigation(
      points: readonly ChartPoint<ChartDatum, Date, number>[],
    ): readonly ChartPoint<ChartDatum, Date, number>[] {
      const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
      const unique = new Map<string, ChartPoint<ChartDatum, Date, number>>();
      for (const p of sorted) {
        const k = valueKey(p.xValue);
        if (!unique.has(k)) unique.set(k, p);
      }
      return [...unique.values()];
    },
  };
}
