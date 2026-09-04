// Line x-scale resolution, tick lists, and mark motion gates.
import { scaleLinear, scaleUtc } from "d3-scale";
import type { ScaleTime } from "d3-scale";
import type {
  ChartMotionContext,
  ChartMotionTiming,
  ChartPositionScaleOptions,
  ChartScale,
  ChartScaleResolveContext,
} from "@tanstack/charts";
import {
  buildPrecomputedXAxisOptions,
  buildXAxisTickValues,
  buildYAxisOptions,
  hiddenAxisOptions,
  tickLabelFadeOpacity,
} from "./axis-ticks";
import { bezierEasing } from "./bezier-easing";
import { DEFAULT_Y_DOMAIN_TWEEN_MS } from "./chart-phase";
import { FADE_BUFFER, TICKER_HALF_WIDTH } from "./design-tokens";
import { shortDateFmt } from "./formatters";
import type { resolveGridGuide } from "./grid";
import type { XAxisConfig } from "./series-config-types";
import type { ChartDatum, YAxisConfig } from "./types";

const DEFAULT_X_AXIS_NUM_TICKS = 5;

const isDateOrNumber = <Subject,>(value: Subject): value is Subject & (Date | number) => value instanceof Date || typeof value === "number";

// Empty x-domain (no finite extent yet): a zero-width utc scale with no ticks.
interface EmptyTimeScaleParams {
  readonly id: string;
  readonly rangeEnd: number;
  readonly rangeStart: number;
  readonly scaleRef: { current: ScaleTime<number, number> | null };
}

const resolveEmptyTimeScale = (params: Readonly<EmptyTimeScaleParams>): ReturnType<ChartScale["resolve"]> => {
  const base = scaleUtc();
  base.domain([0, 0]);
  base.range([params.rangeStart, params.rangeEnd]);
  params.scaleRef.current = base;
  return {
    bandwidth: 0,
    domain: base.domain(),
    id: params.id,
    // Base() always returns a finite number for a numeric range (d3-scale ScaleTime.Output = number, never undefined).
      map: (value) => base(isDateOrNumber(value) ? value : new Date(Number.NaN)),
    ticks: [],
    type: "time",
  };
};

interface LineXTickListParams {
  readonly base: ScaleTime<number, number>;
  readonly rangeEnd: number;
  readonly rangeStart: number;
  readonly renderData: readonly ChartDatum[];
  readonly tickCount: number;
  readonly timeExtent: Readonly<{ maxTime: number; minTime: number }> | undefined;
  readonly visibleData: readonly ChartDatum[];
  readonly xAxis: Readonly<XAxisConfig> | null | undefined;
  readonly xDataKey: string;
  readonly xDomain: [Date, Date] | undefined;
}

const resolveLineXTickList = (
  params: Readonly<LineXTickListParams>,
): readonly { readonly label: string; readonly value: Readonly<Date> }[] => {
  if (params.xAxis) {
    return buildXAxisTickValues({
      data: params.xDomain ? params.visibleData : params.renderData,
      domainMaxTime: params.timeExtent?.maxTime,
      formatValue: params.xAxis.formatValue,
      numTicks: params.xAxis.numTicks ?? DEFAULT_X_AXIS_NUM_TICKS,
      rangeEnd: params.rangeEnd,
      rangeStart: params.rangeStart,
      tickMode: params.xAxis.tickMode,
      xDataKey: params.xDataKey,
      xDomain: params.xDomain,
    });
  }
  return params.base.ticks(params.tickCount).map((value: Readonly<Date>) => ({ label: value.toISOString(), value }));
};

interface LineXScaleParams {
  readonly renderData: readonly ChartDatum[];
  readonly scaleRef: { current: ScaleTime<number, number> | null };
  readonly timeExtent: Readonly<{ maxTime: number; minTime: number }> | undefined;
  readonly visibleData: readonly ChartDatum[];
  readonly xAxis: Readonly<XAxisConfig> | null | undefined;
  readonly xDataKey: string;
  readonly xDomain: [Date, Date] | undefined;
}

const createLineXScale = (params: Readonly<LineXScaleParams>): ChartScale => ({
  id: "x",
  resolve(context: Readonly<Pick<ChartScaleResolveContext, "id" | "range" | "tickCount">>) {
    const [r0, r1] = context.range;
    const minTime = params.timeExtent ? params.timeExtent.minTime : Number.NaN;
    const maxTime = params.timeExtent ? params.timeExtent.maxTime : Number.NaN;
    if (!Number.isFinite(minTime)) {
      return resolveEmptyTimeScale({ id: context.id, rangeEnd: r1, rangeStart: r0, scaleRef: params.scaleRef });
    }
    const base = scaleUtc().domain([minTime, maxTime]).range([r0, r1]);
    params.scaleRef.current = base;
    const tickList = resolveLineXTickList({ base, rangeEnd: r1, rangeStart: r0, renderData: params.renderData, tickCount: context.tickCount, timeExtent: params.timeExtent, visibleData: params.visibleData, xAxis: params.xAxis, xDataKey: params.xDataKey, xDomain: params.xDomain });
    return {
      bandwidth: 0,
      domain: base.domain(),
      id: context.id,
      // Base() always returns a finite number for a numeric range (d3-scale ScaleTime.Output = number, never undefined).
    map: (value) => base(isDateOrNumber(value) ? value : new Date(Number.NaN)),
      ticks: tickList.map((tick: { readonly label: string; readonly value: Readonly<Date> }) => ({
        label: tick.label,
        position: base(tick.value),
        value: tick.value,
      })),
      type: "time",
    };
  },
});

type XTickLabelOpacity = (ctx: Readonly<{ value: unknown; position: number }>) => number;

const resolveXTickLabelOpacity = (
  fade: Readonly<LabelFadeState> | undefined,
  xAxis: Readonly<XAxisConfig> | null | undefined,
): XTickLabelOpacity | 1 => {
  if (!fade) {return 1;}
  const captured = fade;
  return (ctx: Readonly<{ value: unknown; position: number }>): number => {
    const formatTickLabel = xAxis?.formatValue ?? ((date: Readonly<Date>): string => shortDateFmt.format(date));
    const tickLabel = ctx.value instanceof Date ? formatTickLabel(ctx.value) : "";
    return tickLabelFadeOpacity(
      ctx.position,
      tickLabel,
      captured.primaryX,
      captured.hoveredLabel,
      xAxis?.tickerHalfWidth ?? TICKER_HALF_WIDTH,
      FADE_BUFFER,
    );
  };
};

interface LineXScaleOptionsParams {
  readonly gridGuide: Readonly<ReturnType<typeof resolveGridGuide>>;
  readonly marginBottom: number;
  readonly tickLabelMotion: LineMotionFn;
  readonly xAxis: Readonly<XAxisConfig> | null | undefined;
  readonly xScale: ChartScale;
  readonly xTickLabelOpacity: XTickLabelOpacity | 1;
}

const buildLineXScaleOptions = (params: Readonly<LineXScaleOptionsParams>): ChartPositionScaleOptions<Date> => ({
  axis: buildPrecomputedXAxisOptions({ columnTicks: params.gridGuide.columnTicks, marginBottom: params.marginBottom, tickLabelMotion: params.tickLabelMotion, xAxis: params.xAxis ?? undefined, xTickLabelOpacity: params.xTickLabelOpacity }),
  grid: params.gridGuide.vertical,
  scale: params.xScale,
});

// Per-role motion for line marks: enter is false (RevealWipe owns it); update tweens only on y-domain change, else snaps.
type LineMotionFn = (context: Readonly<Pick<ChartMotionContext, "phase" | "role">>) => false | ChartMotionTiming | undefined;
const resolveLineMarkMotion = (gateActive: boolean, tweenDurationMs: number): LineMotionFn =>
  (context: Readonly<Pick<ChartMotionContext, "phase" | "role">>): false | ChartMotionTiming | undefined => {
    if (context.role === "line" || context.role === "area" || context.role === "dot") {
      if (context.phase === "enter") {return false as const;}
      if (context.phase === "update") {
        return gateActive
          ? {
              transition: {
                duration: tweenDurationMs,
                easing: bezierEasing,
                type: "tween" as const,
              },
            }
          : (false as const);
      }
    }
    return undefined;
  };

// Label position tween returns via tickLabels.motion (native text has no CSS left/top).
const resolveTickLabelMotion = (): LineMotionFn =>
  (context: Readonly<Pick<ChartMotionContext, "phase" | "role">>): false | ChartMotionTiming | undefined =>
    context.phase === "enter"
      ? (false as const)
      : {
          transition: {
            duration: DEFAULT_Y_DOMAIN_TWEEN_MS,
            easing: bezierEasing,
            type: "tween" as const,
          },
        };

interface LineMotions {
  readonly motion: LineMotionFn;
  readonly tickLabelMotion: LineMotionFn;
}

const resolveLineMotions = (gateActive: boolean, tweenDurationMs: number): LineMotions => ({
  motion: resolveLineMarkMotion(gateActive, tweenDurationMs),
  tickLabelMotion: resolveTickLabelMotion(),
});

// Native y ticks follow bklit's niced-domain clamp; the grid follows the label ticks.
interface LineYScaleOptionsParams {
  readonly gridGuide: Readonly<ReturnType<typeof resolveGridGuide>>;
  readonly niced: [number, number];
  readonly tickLabelMotion: ReturnType<typeof resolveTickLabelMotion>;
  readonly yAxis: Readonly<YAxisConfig> | null | undefined;
}

const buildLineYScaleOptions = (params: Readonly<LineYScaleOptionsParams>): ChartPositionScaleOptions<number> => {
  const yScale = scaleLinear().domain(params.niced);
  if (params.yAxis) {
    return buildYAxisOptions({ gridHorizontal: params.gridGuide.horizontal, scale: yScale, tickLabelMotion: params.tickLabelMotion, yAxis: params.yAxis, yDomainForTicks: params.niced });
  }
  return {
    axis: hiddenAxisOptions(params.gridGuide.ticks),
    grid: params.gridGuide.horizontal,
    scale: yScale,
  };
};

// X tick-label fade target: the hovered tick's pixel position and rendered label.
interface LabelFadeState {
  primaryX: number;
  hoveredLabel: string | null;
}

export {
  buildLineXScaleOptions,
  buildLineYScaleOptions,
  createLineXScale,
  resolveLineMotions,
  resolveXTickLabelOpacity,
};
export type { LabelFadeState, LineMotionFn };
