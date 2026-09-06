// Bar tooltip body over the shared series-panel renderer (bklit row/title parity).
import { useCallback } from "react";
import type { ReactNode } from "react";
import type { ChartPoint } from "@tanstack/charts";
import type { ChartTooltipBodyRenderContext } from "@tanstack/react-charts/tooltip";
import { isNumber, isString } from "./bar-chart-hover-dots";
import { renderSeriesTooltipBody } from "./tooltip-components";
import { firstNonEmptyString } from "./scatter-datum-utils";
import type { ChartDatum, ChartTooltipConfig, TooltipRow } from "./types";

interface BarTooltipSeries {
  readonly color: string;
  readonly dataKey: string;
}

interface UseBarTooltipBodyParams {
  readonly categoryAccessor: (datum: Readonly<ChartDatum>) => string;
  readonly series: readonly Readonly<BarTooltipSeries>[];
  readonly tooltip: ChartTooltipConfig | null | undefined;
}

interface BuildBarTooltipRowsParams {
  readonly datum: Readonly<ChartDatum>;
  readonly points: readonly Readonly<ChartPoint<ChartDatum, string, number>>[];
  readonly series: readonly Readonly<BarTooltipSeries>[];
}

/**
 * Point color for a series mark id, used when the series entry has no color.
 *
 * @param {readonly Readonly<ChartPoint<ChartDatum, string, number>>[]} points - Focus group points to search.
 * @param {string} dataKey - Series mark id to match.
 * @returns {string | undefined} Point color for the series, if a point exists.
 */
const findBarPointColor = (points: readonly Readonly<ChartPoint<ChartDatum, string, number>>[], dataKey: string): string | undefined => {
  const match = points.find((point) => point.markId === dataKey);
  return match?.color;
};

/**
 * Bklit row value: numbers and strings pass through, missing cells read as zero.
 *
 * @param {Readonly<ChartDatum>} datum - Hovered datum holding the series cells.
 * @param {string} dataKey - Series field to read.
 * @returns {string | number} Cell value, or zero when the cell is missing.
 */
const resolveBarTooltipValue = (datum: Readonly<ChartDatum>, dataKey: string): string | number => {
  const raw = datum[dataKey];
  if (isNumber(raw) || isString(raw)) {return raw;}
  return 0;
};

/**
 * One row per bar series in declaration order, mirroring bklit's tooltip rows.
 *
 * @param {Readonly<BuildBarTooltipRowsParams>} params - Datum, focus points, and series entries.
 * @returns {TooltipRow[]} Rows labeled by dataKey with the series dot color.
 */
const buildBarTooltipRows = ({ datum, points, series }: Readonly<BuildBarTooltipRowsParams>): TooltipRow[] =>
  series.map((entry) => ({
    color: firstNonEmptyString(entry.color, findBarPointColor(points, entry.dataKey)) ?? "transparent",
    label: entry.dataKey,
    value: resolveBarTooltipValue(datum, entry.dataKey),
  }));

/**
 * Shared-panel tooltip body for bars; the single RendererChart body for plain and full specs.
 *
 * @param {Readonly<UseBarTooltipBodyParams>} params - Category accessor, series entries, and tooltip config.
 * @returns {(ctx: ChartTooltipBodyRenderContext<ChartDatum, string, number>) => ReactNode} Body renderer for RendererChart.
 */
const useBarTooltipBody = ({ categoryAccessor, series, tooltip }: Readonly<UseBarTooltipBodyParams>): ((ctx: ChartTooltipBodyRenderContext<ChartDatum, string, number>) => ReactNode) => {
  const renderTooltipBody = useCallback(
    (ctx: Readonly<ChartTooltipBodyRenderContext<ChartDatum, string, number>>): ReactNode =>
      renderSeriesTooltipBody(ctx, {
        buildRows: (rowDatum, rowsCtx: Readonly<ChartTooltipBodyRenderContext<ChartDatum, string, number>>) =>
          buildBarTooltipRows({ datum: rowDatum, points: rowsCtx.points, series }),
        resolveTitle: (rowDatum) => categoryAccessor(rowDatum),
        tooltip,
      }),
    [categoryAccessor, series, tooltip],
  );
  return renderTooltipBody;
};

export { useBarTooltipBody };
export type { BarTooltipSeries, UseBarTooltipBodyParams };
