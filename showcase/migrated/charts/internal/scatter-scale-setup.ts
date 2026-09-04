import { useMemo } from "react";
import { scaleLinear, scaleUtc } from "d3-scale";
import { buildXAxisTickValues } from "./axis-ticks";
import { toDate } from "./coerce-date";
import { computeTimeExtent, isNumber } from "./scatter-datum-utils";
import type { ScatterTimeExtent } from "./scatter-datum-utils";
import type { ChartDatum, ExtractedChildren } from "./types";
import type { ChartScale, ResolvedScale } from "@tanstack/charts";

// Default tick count for x/y axes when no count is configured.
const SCATTER_TICK_COUNT_DEFAULT = 5;

interface BuildScatterXScaleParams {
  readonly maxTime: number;
  readonly minTime: number;
  readonly renderData: readonly Readonly<ChartDatum>[];
  readonly xAxis: ExtractedChildren["xAxis"];
  readonly xDataKey: string;
  readonly xRangePadding: number;
}

const buildScatterXScale = ({
  maxTime,
  minTime,
  renderData,
  xAxis,
  xDataKey,
  xRangePadding,
}: Readonly<BuildScatterXScaleParams>): ChartScale => ({
  id: "x",
  resolve(context): ResolvedScale {
    const [r0, r1] = context.range;
    const lo = Math.min(r0, r1);
    const hi = Math.max(r0, r1);
    const insetLo = lo + xRangePadding;
    const insetHi = Math.max(insetLo, hi - xRangePadding);
    const scale = scaleUtc().domain([minTime, maxTime]).range([insetLo, insetHi]);
    const ticks = xAxis
      ? buildXAxisTickValues({
          data: renderData,
          formatValue: xAxis.formatValue,
          numTicks: xAxis.numTicks ?? SCATTER_TICK_COUNT_DEFAULT,
          rangeEnd: insetHi,
          rangeStart: insetLo,
          tickMode: xAxis.tickMode,
          xDataKey,
        }).map(({ value, label }) => ({
          label,
          position: scale(value),
          value,
        }))
      : scale.ticks(context.tickCount).map((value) => ({
          label: value.toISOString(),
          position: scale(value),
          value,
        }));
    return {
      bandwidth: 0,
      domain: scale.domain(),
      id: context.id,
      map: (value) => {
        const parsed = toDate(value);
        if (!parsed) {return Number.NaN;}
        return scale(parsed);
      },
      ticks,
      type: "time",
    };
  },
});

const buildScatterYScale = (yDomain: [number, number]): ChartScale => ({
  id: "y",
  resolve(context): ResolvedScale {
    const range: [number, number] = [context.range[0], context.range[1]];
    const scale = scaleLinear()
      .domain(yDomain)
      .nice()
      .range(range);
    const tickValues = scale.ticks(context.tickCount);
    return {
      bandwidth: 0,
      domain: scale.domain(),
      id: context.id,
      map: (value) => {
        if (!isNumber(value) || !Number.isFinite(value)) {return Number.NaN;}
        return scale(value);
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

interface UseScatterScalesParams {
  readonly renderData: readonly Readonly<ChartDatum>[];
  readonly xAxis: ExtractedChildren["xAxis"];
  readonly xDataKey: string;
  readonly xRangePadding: number;
  readonly yDomain: [number, number];
}

interface ScatterScales {
  readonly timeExtent: ScatterTimeExtent | undefined;
  readonly xScale: ChartScale;
  readonly yScale: ChartScale;
}

const useScatterScales = ({
  renderData,
  xAxis,
  xDataKey,
  xRangePadding,
  yDomain,
}: Readonly<UseScatterScalesParams>): ScatterScales => {
  // Single shared x-extent feeds the chart scale, selection scale, and reference-area domain.
  const timeExtent = useMemo(() => computeTimeExtent(renderData, xDataKey), [renderData, xDataKey]);

  // Inset ranges need the resolve() escape hatch: plain instances get re-ranged by TanStack.
  const xScale = useMemo<ChartScale>(() => {
    const { minTime, maxTime } = timeExtent ?? { maxTime: 0, minTime: 0 };
    return buildScatterXScale({ maxTime, minTime, renderData, xAxis, xDataKey, xRangePadding });
  }, [timeExtent, xRangePadding, renderData, xDataKey, xAxis]);

  const yScale = useMemo<ChartScale>(() => buildScatterYScale(yDomain), [yDomain]);

  return { timeExtent, xScale, yScale };
};

export { buildScatterXScale, buildScatterYScale, useScatterScales };
export type { BuildScatterXScaleParams, ScatterScales, UseScatterScalesParams };
