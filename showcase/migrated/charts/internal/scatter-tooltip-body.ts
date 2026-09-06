import { useCallback } from "react";
import type { ReactNode } from "react";
import type { ChartTooltipBodyRenderContext } from "@tanstack/react-charts/tooltip";
import { renderSeriesTooltipBody } from "./tooltip-components";
import { weekdayDateFmt } from "./formatters";
import { firstNonEmptyString, isNumber, stringifyDatumValue } from "./scatter-datum-utils";
import type { ResolvedSeries } from "./scatter-marks";
import type { ChartDatum, ExtractedChildren, TooltipRow } from "./types";

// Fallback tooltip rows (bklit parity): one row per series, dot color lookup by mark id.
const buildScatterFallbackTooltipRows = (
  datum: Readonly<ChartDatum>,
  resolvedSeries: readonly Readonly<ResolvedSeries>[],
  colorEntries: readonly (readonly [string, string])[],
): TooltipRow[] => {
  const colorByMarkId = new Map<string, string>(colorEntries);
  return resolvedSeries.map((series) => {
    const value = datum[series.dataKey];
    const pointColor = colorByMarkId.get(series.dataKey);
    return {
      color: firstNonEmptyString(series.fill, pointColor) ?? "transparent",
      label: series.dataKey,
      value: isNumber(value) ? value : stringifyDatumValue(value, "0"),
    };
  });
};

interface UseScatterTooltipBodyParams {
  readonly resolvedSeries: readonly Readonly<ResolvedSeries>[];
  readonly tooltip: ExtractedChildren["tooltip"];
  readonly xDataKey: string;
}

interface ScatterTooltipBody {
  readonly renderTooltipBody: (ctx: ChartTooltipBodyRenderContext<ChartDatum, Date, number>) => ReactNode;
  readonly tooltipEnabled: boolean;
}

// Same body path as line/area/bar: the shared renderer owns the `.bkm-tooltip-panel` box and
// The custom `content`/`rows`/`children` branches; a package-chrome box sized 21×13 px larger.
const useScatterTooltipBody = ({
  resolvedSeries,
  tooltip,
  xDataKey,
}: Readonly<UseScatterTooltipBodyParams>): ScatterTooltipBody => {
  const renderTooltipBody = useCallback(
    (ctx: ChartTooltipBodyRenderContext<ChartDatum, Date, number>): ReactNode =>
      renderSeriesTooltipBody(ctx, {
        buildRows: (datum, rowsCtx: Readonly<ChartTooltipBodyRenderContext<ChartDatum, Date, number>>) =>
          buildScatterFallbackTooltipRows(datum, resolvedSeries, rowsCtx.points.map((point) => [point.markId, point.color] as const)),
        resolveTitle: (datum) => {
          const dateValue = datum[xDataKey];
          return dateValue instanceof Date ? weekdayDateFmt.format(dateValue) : undefined;
        },
        tooltip,
      }),
    [tooltip, resolvedSeries, xDataKey],
  );
  return { renderTooltipBody, tooltipEnabled: tooltip?.enabled ?? false };
};

export { buildScatterFallbackTooltipRows, useScatterTooltipBody };
export type { ScatterTooltipBody, UseScatterTooltipBodyParams };
