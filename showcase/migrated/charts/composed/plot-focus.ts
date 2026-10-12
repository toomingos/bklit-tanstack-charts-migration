import { focusGroupX } from "@tanstack/charts/focus";
import type { ChartFocusStrategy } from "@tanstack/charts";
import { navigationPrimary } from "../kit/cartesian/definition";
import type { ChartMargin } from "../kit/theme";
import type { PlotSize } from "../kit/cartesian/plot-size";

/** bklit's bisect keeps the lower point on an exact midpoint tie; focusGroupX would take the higher one on float noise. */
function lowerOfTie<T extends { x: number }>(points: readonly T[], x: number): readonly T[] {
  let best = Number.POSITIVE_INFINITY;
  for (const p of points) {
    best = Math.min(best, Math.abs(p.x - x));
  }
  const tied = points.filter((p) => Math.abs(Math.abs(p.x - x) - best) <= 1e-6);
  const lowX = Math.min(...tied.map((p) => p.x));
  return tied.some((p) => Math.abs(p.x - lowX) > 1e-6) ? tied.filter((p) => Math.abs(p.x - lowX) <= 1e-6) : points;
}

/** bklit's hover overlay is the plot rect only: no focus (tooltip, dim) over the margins or the tick-label row. */
export function plotFocusOf(margin: Readonly<ChartMargin>, size: () => PlotSize): ChartFocusStrategy {
  const inPlot = (x: number, y: number): boolean => {
    const { innerWidth, innerHeight } = size();
    return x >= margin.left && x <= margin.left + innerWidth && y >= margin.top && y <= margin.top + Math.max(0, innerHeight);
  };
  return {
    ...focusGroupX,
    resolve: (points, ctx) => (inPlot(ctx.x, ctx.y) ? navigationPrimary(focusGroupX.resolve(lowerOfTie(points, ctx.x), ctx), points) : []),
  };
}
