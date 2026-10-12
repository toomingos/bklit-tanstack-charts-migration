import { useMemo } from "react";
import type { RefObject } from "react";
import type { ChartDefinition } from "@tanstack/charts";
import { bklitYDomain, buildCartesianDefinition, SINGLE_TIME_SPAN_MS } from "../kit/cartesian/definition";
import { propsFor } from "../kit/read-children";
import { DEFAULT_Y_AXIS_ID } from "../kit/cartesian/series";
import type { resolveSeries, Row } from "../kit/cartesian/series";
import { useDataUpdateStep } from "../kit/cartesian/use-data-update-step";
import type { CartesianSpec } from "../kit/cartesian/input";
import type { PlotSize, PlotSnapshot } from "../kit/cartesian/plot-size";
import { erase } from "../kit/erased-types";
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
  readonly aspectRatio: string;
  readonly barSize?: number;
  readonly maxBarSize?: number;
  readonly barGap: number;
  readonly stacked: boolean;
  readonly stackGap: number;
  readonly entered: boolean;
  /** Read by the bar mark `motion` during the render that flips `entered`. */
  readonly growing: RefObject<number | null>;
  /** Receives every build TanStack's draw makes (see `buildCartesianDefinition`). */
  readonly onBuilt: (snapshot: PlotSnapshot) => void;
}

interface ComposedBuild {
  readonly definition: ChartDefinition<Row, Date, number>;
  readonly settle: ReturnType<typeof useDataUpdateStep>["settle"];
}

/** The composed definition: kit lines/areas plus rect bars, in JSX paint order, with the plot-rect focus. Everything that depends on the plot size (bar widths, the wipe padding, the focus rect) resolves inside TanStack's draw. */
export function useComposedBuild(input: Readonly<ComposedBuildInput>): ComposedBuild {
  const { data, xDataKey, table, series, bars, order, margin, uid, duration, aspectRatio, barSize, maxBarSize, barGap, stacked, stackGap, entered, growing, onBuilt } = input;
  const update = useDataUpdateStep(data, [xDataKey, table, series, bars, order, margin, uid, duration, aspectRatio, barSize, maxBarSize, barGap, stacked, stackGap, entered]);
  const definition = useMemo(() => {
    const barKeys = bars.map((b) => b.dataKey);
    const barValues = barYValues(data, barKeys, stacked);
    const seriesValues = series.flatMap((s) => data.map((row) => Number(row[s.dataKey])));
    const yDomain = update.from?.[DEFAULT_Y_AXIS_ID] ?? bklitYDomain([...seriesValues.filter(Number.isFinite), ...barValues]);
    const times = data.map((row) => dateValue(row[xDataKey]).getTime());
    const spread = Math.max(...times) - Math.min(...times);
    const span = spread > 0 ? spread : SINGLE_TIME_SPAN_MS;
    const tooltipProps = propsFor<{ showDots?: boolean; dotSize?: number; dotStrokeWidth?: number; dotColor?: unknown }>(table, "tooltip").at(0);
    const dots =
      tooltipProps !== undefined && tooltipProps.showDots !== false
        ? { radius: tooltipProps.dotSize ?? 5, strokeWidth: tooltipProps.dotStrokeWidth ?? 2, color: stringValue(tooltipProps.dotColor) }
        : false;
    // bklit's one ChartRevealClip wipes lines, areas and bars together (native `wipe-` groups, kit wipeWrap), padded by half a bar/group
    // (computeSeriesBarRevealClipPadding); a revealSignature change remounts with `entered` false, so the wipe replays with the grow.
    const barPad = (innerWidth: number): number => {
      if (bars.length === 0) {
        return 0;
      }
      const barWidth = seriesBarWidth({ innerWidth, dataLength: data.length, seriesCount: bars.length, barSize, maxBarSize, gap: barGap, stacked });
      return Math.ceil((stacked || bars.length <= 1 ? barWidth : bars.length * barWidth + (bars.length - 1) * barGap) / 2);
    };
    const barMarks = ({ innerWidth, innerHeight }: PlotSize) =>
      buildBarMarks({
        data,
        xKey: xDataKey,
        bars,
        innerWidth,
        innerHeight: Math.max(0, innerHeight),
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
        growingSince: () => growing.current,
        dots,
      });
    const spec: CartesianSpec = {
      updateStep: update.step,
      yDomainFrom: update.from,
      data,
      xKey: xDataKey,
      table,
      series,
      margin,
      uid,
      animationDuration: duration,
      wipe: { ms: duration, progress: () => (duration > 0 && !entered ? 0 : 1), pad: ({ innerWidth }) => barPad(innerWidth), armedAt: growing },
      extraMarks: barMarks,
      extraXValues: NONE,
      extraYValues: barValues,
      extraGradients: NONE,
      renderTooltipEnabled: true,
      orderMarks: (marks) => erase(orderSeriesMarks(erase(marks), order)),
      focusOf: (size) => plotFocusOf(margin, size),
    };
    return buildCartesianDefinition(spec, onBuilt);
  }, [data, xDataKey, table, series, bars, order, margin, uid, duration, aspectRatio, barSize, maxBarSize, barGap, stacked, stackGap, entered, update.step, update.from, growing, onBuilt]);
  return { definition, settle: update.settle };
}
