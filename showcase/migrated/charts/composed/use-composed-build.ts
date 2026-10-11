import { useEffect, useMemo } from "react";
import type { RefObject } from "react";
import type { ChartMark, ChartValue, StaticChartDefinition } from "@tanstack/charts";
import { bklitYDomain, buildCartesianDefinition, SINGLE_TIME_SPAN_MS } from "../kit/cartesian/definition";
import { propsFor } from "../kit/read-children";
import { DEFAULT_Y_AXIS_ID } from "../kit/cartesian/series";
import type { resolveSeries, Row } from "../kit/cartesian/series";
import { useDataUpdateStep } from "../kit/cartesian/use-data-update-step";
import { parseAspectRatio } from "../kit/theme";
import type { ChartMargin } from "../kit/theme";
import type { ChartDatum } from "../kit/types";
import { buildBarMarks, barYValues, seriesBarWidth } from "./bars";
import type { SeriesBarSpec } from "./bars";
import { dateValue, stringValue } from "./narrow";
import { plotFocusOf } from "./plot-focus";
import { orderSeriesMarks } from "./series-order";

const NONE: never[] = [];

interface ComposedBuildInput {
  readonly data: ChartDatum[];
  readonly xDataKey: string;
  readonly table: Parameters<typeof resolveSeries>[0];
  readonly series: ReturnType<typeof resolveSeries>;
  readonly bars: readonly SeriesBarSpec[];
  readonly order: readonly string[];
  readonly margin: Readonly<ChartMargin>;
  readonly uid: string;
  readonly duration: number;
  readonly width: number;
  readonly aspectRatio: string;
  readonly barSize?: number;
  readonly maxBarSize?: number;
  readonly barGap: number;
  readonly stacked: boolean;
  readonly stackGap: number;
  readonly entered: boolean;
  /** Read by the bar mark `motion` during the render that flips `entered`. */
  readonly growing: RefObject<boolean>;
}

type IdentifiedMark = ChartMark<unknown, ChartValue, ChartValue, ChartValue, ChartValue, string, string> & { readonly id?: string };
type CartesianBuild = ReturnType<typeof buildCartesianDefinition>;
type ComposedBuild = Omit<CartesianBuild, "definition"> & { readonly definition: StaticChartDefinition<Row, Date, number> };

/** The composed definition: kit lines/areas plus rect bars, in JSX paint order, with the plot-rect focus. */
export function useComposedBuild(input: Readonly<ComposedBuildInput>): ComposedBuild {
  const { data, xDataKey, table, series, bars, order, margin, uid, duration, width, aspectRatio, barSize, maxBarSize, barGap, stacked, stackGap, entered, growing } = input;
  // bklit's one ChartRevealClip wipes lines, areas and bars together (native `wipe-` groups, kit wipeWrap), padded by half a bar/group
  // (computeSeriesBarRevealClipPadding); a revealSignature change remounts with `entered` false, so the wipe replays with the grow.
  const barPad = useMemo(() => {
    if (bars.length === 0) {
      return 0;
    }
    const barWidth = seriesBarWidth({ innerWidth: Math.max(0, width - margin.left - margin.right), dataLength: data.length, seriesCount: bars.length, barSize, maxBarSize, gap: barGap, stacked });
    return Math.ceil((stacked || bars.length <= 1 ? barWidth : bars.length * barWidth + (bars.length - 1) * barGap) / 2);
  }, [bars, width, margin, data.length, barSize, maxBarSize, barGap, stacked]);

  const update = useDataUpdateStep(data, [xDataKey, table, series, bars, order, margin, uid, duration, width, aspectRatio, barSize, maxBarSize, barGap, stacked, stackGap, entered]);
  const built = useMemo(() => {
    const barKeys = bars.map((b) => b.dataKey);
    const barValues = barYValues(data, barKeys, stacked);
    const seriesValues = series.flatMap((s) => data.map((row) => Number(row[s.dataKey])));
    const yDomain = update.from?.[DEFAULT_Y_AXIS_ID] ?? bklitYDomain([...seriesValues.filter(Number.isFinite), ...barValues]);
    const times = data.map((row) => dateValue(row[xDataKey]).getTime());
    const spread = Math.max(...times) - Math.min(...times);
    const span = spread > 0 ? spread : SINGLE_TIME_SPAN_MS;
    const innerWidth = Math.max(0, width - margin.left - margin.right);
    const innerHeight = Math.max(0, width / parseAspectRatio(aspectRatio) - margin.top - margin.bottom);
    const tooltipProps = propsFor<{ showDots?: boolean; dotSize?: number; dotStrokeWidth?: number; dotColor?: unknown }>(table, "tooltip").at(0);
    const barMarks = buildBarMarks({
      data,
      xKey: xDataKey,
      bars,
      innerWidth,
      innerHeight,
      xSpanMs: span,
      yDomain,
      barSize,
      maxBarSize,
      barGap,
      stacked,
      stackGap,
      animationDuration: duration,
      entered,
      glide: update.step === "glide",
      isGrowing: () => growing.current,
      dots:
        tooltipProps !== undefined && tooltipProps.showDots !== false
          ? {
              radius: tooltipProps.dotSize ?? 5,
              strokeWidth: tooltipProps.dotStrokeWidth ?? 2,
              color: stringValue(tooltipProps.dotColor),
            }
          : false,
    });
    const result = buildCartesianDefinition({
      updateStep: update.step,
      yDomainFrom: update.from,
      data,
      xKey: xDataKey,
      table,
      series,
      margin,
      uid,
      animationDuration: duration,
      wipe: { p: duration > 0 && !entered ? 0 : 1, ms: duration, w: innerWidth, h: innerHeight, pad: barPad },
      innerWidth: Math.max(0, width - margin.left - margin.right),
      extraMarks: barMarks,
      extraXValues: NONE,
      extraYValues: barValues,
      extraGradients: NONE,
      renderTooltipEnabled: true,
    });
    // SAFETY: the kit builds a static definition whose marks carry the `id` they were created with (the public type hides it).
    const raw = result.definition as StaticChartDefinition<Row, Date, number> & { readonly marks: readonly IdentifiedMark[] };
    const definition = { ...raw, focus: plotFocusOf(margin, innerWidth, innerHeight), marks: orderSeriesMarks(raw.marks, order) };
    return { ...result, definition };
  }, [data, xDataKey, table, series, bars, order, margin, uid, duration, width, aspectRatio, barSize, maxBarSize, barGap, stacked, stackGap, entered, barPad, update.step, update.from, growing]);
  const { settle } = update;
  useEffect(() => {
    settle(built);
  }, [built, settle]);
  return built;
}
