// bklit's bar tooltip (category title + dot / label / value rows) as the native tooltip body.
import type { ReactNode } from "react";
import type { ChartPoint } from "@tanstack/charts";
import { TooltipContent } from "../kit/tooltip/tooltip-primitives";
import { tooltipRows } from "../kit/tooltip/tooltip-body";

export interface BarTooltipOptions {
  readonly order: readonly string[];
  readonly colors: Readonly<Record<string, string>>;
  /** Horizontal bars carry the value on x and the category on y. */
  readonly horizontal?: boolean;
}

export const BarTooltipBody = <TDatum,>({
  points,
  options,
}: {
  readonly points: readonly ChartPoint<TDatum>[];
  readonly options: BarTooltipOptions;
}): ReactNode => {
  const oriented = options.horizontal === true ? points.map((p) => ({ ...p, xValue: p.yValue, yValue: p.xValue })) : points;
  if (oriented.length === 0) {
    return null;
  }
  const rows = tooltipRows(oriented, undefined, options.colors).toSorted((a, b) => options.order.indexOf(a.label) - options.order.indexOf(b.label));
  return <TooltipContent rows={rows} title={String(oriented[0].xValue)} />;
};
