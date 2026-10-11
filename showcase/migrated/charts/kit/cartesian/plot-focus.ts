// Focus of the cartesian definition: group-x inside the inner plot only, bklit's tie-break and a keyboard-continuing primary.
import type { ChartFocusResolveContext, ChartFocusStrategy, ChartPoint } from "@tanstack/charts";
import { focusGroupX } from "@tanstack/charts/focus";
import { erase } from "./erased-types";
import type { CartesianInput } from "./input";

/** Native keyboard navigation (`focusGroupX.navigation`) walks one point per x, the first in (x, y) order; the pointer's primary is the series nearest its y, so an arrow after a hover
 * restarted at the first column. Resolving the same representative continues from the hovered column (tooltip rows are unaffected). */
export function navigationPrimary<P extends { readonly y: number }>(resolved: readonly P[], universe: readonly P[]): readonly P[] {
  if (resolved.length < 2) {
    return resolved;
  }
  let rep = resolved[0];
  for (const p of resolved) {
    if (p.y < rep.y || (p.y === rep.y && universe.indexOf(p) < universe.indexOf(rep))) {
      rep = p;
    }
  }
  return rep === resolved[0] ? resolved : [rep, ...resolved.filter((p) => p !== rep)];
}

/** group-x, but only inside the inner plot (bklit: an inner-sized transparent hit rect), so the margins and axes show no tooltip, crosshair or pill. */
export function cartesianFocus(input: CartesianInput): ChartFocusStrategy<never, never, never> {
  const insidePlot = ({ x, y }: ChartFocusResolveContext): boolean => {
    const w = input.plotWidth ?? 0;
    const h = Math.max(0, input.plotHeight ?? 0);
    if (w <= 0 || h <= 0) {
      return true;
    }
    return x >= input.margin.left && x <= input.margin.left + w && y >= input.margin.top && y <= input.margin.top + h;
  };
  return erase({
    ...focusGroupX,
    resolve: (points: readonly ChartPoint[], context: ChartFocusResolveContext): readonly ChartPoint[] => {
      if (!insidePlot(context)) {
        return [];
      }
      // bklit's bisectDate (x0 - d0 > d1 - x0) picks the lower point on an exact tie; focusGroupX keeps the first in input
      // order. Narrow to the points tied for nearest (a genuine tie only) and put the lower x first.
      const best = Math.min(...points.map((p) => Math.abs(p.x - context.x)));
      const tied = points.filter((p) => Math.abs(Math.abs(p.x - context.x) - best) <= 1e-6);
      if (tied.length > 1 && tied.some((p) => Math.abs(p.x - tied[0].x) > 1e-6)) {
        // Only the lower-x points: focusGroupX would still pick the higher one on float noise (|d| differs by ~1e-14).
        const lowX = Math.min(...tied.map((p) => p.x));
        return navigationPrimary(focusGroupX.resolve(tied.filter((p) => Math.abs(p.x - lowX) <= 1e-6), context), points);
      }
      return navigationPrimary(focusGroupX.resolve(points, context), points);
    },
  });
}
