import { useCallback, useMemo } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { ChartTooltipBodyRenderContext } from "@tanstack/react-charts/tooltip";
import type { ChartPoint } from "@tanstack/charts";
import { TooltipContent } from "./tooltip-components";
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

interface BuildDefaultTooltipBodyParams {
  readonly datum: ChartDatum;
  readonly points: readonly Readonly<ChartPoint<ChartDatum, Date, number>>[];
  readonly resolvedSeries: readonly Readonly<ResolvedSeries>[];
  readonly tooltip: ExtractedChildren["tooltip"];
  readonly xDataKey: string;
}

const buildDefaultTooltipBody = ({
  datum,
  points,
  resolvedSeries,
  tooltip,
  xDataKey,
}: Readonly<BuildDefaultTooltipBodyParams>): ReactNode => {
  const dateValue = datum[xDataKey];
  const title: string | undefined = dateValue instanceof Date ? weekdayDateFmt.format(dateValue) : undefined;
  const colorEntries: (readonly [string, string])[] = [];
  for (const point of points) {
    colorEntries.push([point.markId, point.color]);
  }
  const rows: TooltipRow[] = tooltip?.rows
    ? tooltip.rows(datum)
    : buildScatterFallbackTooltipRows(datum, resolvedSeries, colorEntries);
  return (
    <TooltipContent title={title} rows={rows}>
      {tooltip?.children}
    </TooltipContent>
  );
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

const useScatterTooltipBody = ({
  resolvedSeries,
  tooltip,
  xDataKey,
}: Readonly<UseScatterTooltipBodyParams>): ScatterTooltipBody => {
  // Tooltip panel style merge: backgroundColor wins when non-empty.
  const tooltipPanelStyle = useMemo<CSSProperties | undefined>(() => {
    const panelStyle = tooltip?.panelStyle;
    const backgroundColor = tooltip?.backgroundColor;
    if (panelStyle === undefined && (backgroundColor === undefined || backgroundColor === "")) {return undefined;}
    if (backgroundColor === undefined || backgroundColor === "") {return { ...panelStyle };}
    return { ...panelStyle, backgroundColor };
  }, [tooltip]);

  const renderTooltipBody = useCallback(
    (ctx: ChartTooltipBodyRenderContext<ChartDatum, Date, number>): ReactNode => {
      if (ctx.points.length === 0) {return undefined;}
      const [primary] = ctx.points;
      const { datum } = primary;
      const body: ReactNode = tooltip?.content
        ? tooltip.content({
            index: primary.datumIndex,
            point: datum,
          })
        : buildDefaultTooltipBody({ datum, points: ctx.points, resolvedSeries, tooltip, xDataKey });
      if (tooltipPanelStyle === undefined) {return body;}
      return (
        <div style={tooltipPanelStyle}>
          {body}
        </div>
      );
    },
    [tooltip, resolvedSeries, xDataKey, tooltipPanelStyle],
  );
  return { renderTooltipBody, tooltipEnabled: tooltip?.enabled ?? false };
};

export { buildDefaultTooltipBody, buildScatterFallbackTooltipRows, useScatterTooltipBody };
export type { BuildDefaultTooltipBodyParams, ScatterTooltipBody, UseScatterTooltipBodyParams };
