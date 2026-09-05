import { scaleLinear, scaleUtc } from "d3-scale";
import type {
  ChartMotionContext,
  ChartMotionTiming,
  ChartScale,
} from "@tanstack/charts";
import { buildXAxisTickValues, tickLabelFadeOpacity } from "./axis-ticks";
import { bezierEasing } from "./bezier-easing";
import { DEFAULT_Y_DOMAIN_TWEEN_MS } from "./chart-phase";
import { toDate } from "./coerce-date";
import { resolveComposedXDomain } from "./composed-data-math";
import type { ComposedScalesContext } from "./composed-model";
import {
  buildComposedProjectionGradient,
} from "./composed-overlay-geometry";
import type {
  ProjectionMarkerFallbacks,
  ProjectionStrokeFallbacks,
} from "./composed-data-math";
import type { ProjectionGradientDef } from "./projection-line-mark";
import type { ProjectionLineConfig } from "./projection-config";
import { shortDateFmt } from "./formatters";
import { resolveGridGuide } from "./grid";
import { TICKER_HALF_WIDTH, FADE_BUFFER } from "./design-tokens";
import type { ChartDatum, XAxisConfig } from "./types";

interface TickFadeContext {
  readonly position: number;
  readonly value: unknown;
}

interface BuildXTickOpacityParams {
  readonly labelFade: Readonly<{ hoveredLabel: string | null; primaryX: number }> | undefined;
  readonly xAxis: XAxisConfig | undefined;
}

type MotionResult = false | ChartMotionTiming | undefined;

interface ComposedMotion {
  readonly motion: (context: ChartMotionContext) => MotionResult;
  readonly tickLabelMotion: (context: ChartMotionContext) => MotionResult;
}

interface CollectProjectionGradientsParams {
  readonly cfgs: readonly Readonly<ProjectionLineConfig>[];
  readonly gradientBaseId: string;
  readonly lines: readonly Readonly<ChartDatum>[];
  readonly markerFallbacks: Readonly<ProjectionMarkerFallbacks>;
  readonly rightEdge: number;
  readonly strokeFallbacks: Readonly<ProjectionStrokeFallbacks>;
  readonly xMap: (value: Readonly<Date>) => number;
  readonly yMap: (value: number) => number;
}

// The engine always provides resolve-context tickCount, but the chart-level fallback stays.
// Nullable params keep the coalescing guard genuinely conditional (candlestick-chart parity).
const coalesceTickCount = (primary: number | undefined, secondary: number): number =>
  primary ?? secondary;

const buildComposedXScale = (ctx: Readonly<ComposedScalesContext>): ChartScale => ({
  id: "x",
  resolve(context) {
    const [r0, r1] = context.range;
    const [minTime, maxTime] = resolveComposedXDomain(ctx.data, ctx.xDataKey, ctx.projectionConfigs);
    const scale = scaleUtc().domain([minTime, maxTime]).range([r0, r1]);
    ctx.xScaleRef.current = scale;
    const tickList = ctx.xAxis
      ? buildXAxisTickValues({
          data: ctx.renderData,
          domainMaxTime: ctx.timeExtent?.maxTime,
          formatValue: ctx.xAxis.formatValue,
          numTicks: ctx.xAxis.numTicks ?? ctx.tickCountFallback,
          rangeEnd: r1,
          rangeStart: r0,
          tickMode: ctx.xAxis.tickMode,
          xDataKey: ctx.xDataKey,
        })
      : scale.ticks(coalesceTickCount(context.tickCount, ctx.tickCountFallback)).map((value: Readonly<Date>) => ({ label: value.toISOString(), value }));
    return {
      bandwidth: 0,
      domain: scale.domain(),
      id: context.id,
      map: (value) => {
        const parsed = toDate(value);
        if (!parsed) {return Number.NaN;}
        const mapped = scale(parsed);
        return mapped;
      },
      ticks: tickList.map((tick) => ({
        label: tick.label,
        position: scale(tick.value),
        value: tick.value,
      })),
      type: "time",
    };
  },
});

// Anti-slop permits `typeof` inside a type guard; the y-scale map branches on this predicate instead.
// Generic parameter (same shape as composed-data-math) keeps `unknown` call sites compiling.
const isNumber = <Value>(value: Value): value is Value & number => typeof value === "number";

const buildComposedYScale = (ctx: Readonly<ComposedScalesContext>): ChartScale => ({
  id: "y",
  resolve(context) {
    // The host supplies a 2-stop range; re-housing it as a tuple satisfies d3's
    // Range signature without asserting the wider number[] type.
    const [rangeStart, rangeEnd] = context.range;
    const scale = scaleLinear().domain(ctx.yDomain).range([rangeStart, rangeEnd]);
    ctx.yScaleRef.current = scale;
    const tickValues = scale.ticks(coalesceTickCount(context.tickCount, resolveGridGuide(ctx.grid).ticks));
    return {
      bandwidth: 0,
      domain: scale.domain(),
      id: context.id,
      map: (value) => {
        const mapped = isNumber(value) ? scale(value) : Number.NaN;
        return mapped;
      },
      ticks: tickValues.map((value) => ({
        label: String(value),
        position: scale(value),
        value,
      })),
      type: "linear",
    };
  },
});

const tickLabelMotion = (context: ChartMotionContext): MotionResult =>
  context.phase === "enter"
    ? (false as const)
    : { transition: { duration: DEFAULT_Y_DOMAIN_TWEEN_MS, easing: bezierEasing, type: "tween" as const } };

const buildComposedMotion = (gateActive: boolean): ComposedMotion => {
  const motion = (context: ChartMotionContext): MotionResult => {
    if (context.role === "line" || context.role === "area" || context.role === "dot" || context.role === "bar") {
      if (context.phase === "enter") {return false as const;}
      if (context.phase === "update") {
        return gateActive
          ? { transition: { duration: DEFAULT_Y_DOMAIN_TWEEN_MS, easing: bezierEasing, type: "tween" as const } }
          : (false as const);
      }
    }
    return undefined;
  };
  return { motion, tickLabelMotion };
};

const buildXTickLabelOpacity = (
  params: Readonly<BuildXTickOpacityParams>,
): number | ((ctx: Readonly<TickFadeContext>) => number) => {
  const { labelFade } = params;
  if (!labelFade) {return 1;}
  const formatValue = params.xAxis?.formatValue ?? ((date: Date): string => shortDateFmt.format(date));
  return (ctx: Readonly<TickFadeContext>): number =>
    tickLabelFadeOpacity({
      fadeBuffer: FADE_BUFFER,
      hoveredLabel: labelFade.hoveredLabel,
      labelText: formatValue(toDate(ctx.value) ?? new Date(Number.NaN)),
      labelX: ctx.position,
      primaryX: labelFade.primaryX,
      tickerHalfWidth: params.xAxis?.tickerHalfWidth ?? TICKER_HALF_WIDTH,
    });
};

const collectProjectionGradients = (params: Readonly<CollectProjectionGradientsParams>): ProjectionGradientDef[] => {
  const defs: ProjectionGradientDef[] = [];
  for (let projIndex = 0; projIndex < params.lines.length; projIndex += 1) {
    const proj = params.lines[projIndex];
    const gd = buildComposedProjectionGradient({
      cfg: params.cfgs[projIndex],
      gradientBaseId: params.gradientBaseId,
      markerFallbacks: params.markerFallbacks,
      proj,
      projIndex,
      rightEdge: params.rightEdge,
      strokeFallbacks: params.strokeFallbacks,
      xMap: params.xMap,
      yMap: params.yMap,
    });
    if (gd) {defs.push(gd);}
  }
  return defs;
};

export {
  buildComposedMotion,
  buildComposedXScale,
  buildComposedYScale,
  buildXTickLabelOpacity,
  collectProjectionGradients,
};
export type { CollectProjectionGradientsParams, ComposedMotion };
