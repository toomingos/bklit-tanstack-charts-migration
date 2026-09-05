"use client";

import { useMemo } from "react";
import { scaleLinear, scaleUtc } from "d3-scale";
import type { ChartScale } from "@tanstack/charts";
import { defaultFormatTime, defaultFormatValue, isNumber } from "./live-line-overlay";

// Live-line scales as factories: the package applies the plot range itself.
interface LiveLineScaleDomains {
  readonly domainEndMs: number;
  readonly domainStartMs: number;
  readonly yMax: number;
  readonly yMin: number;
}

interface LiveLineScales {
  readonly xScaleFactory: ChartScale;
  readonly yNicedDomain: readonly [number, number];
  readonly yScaleFactory: ChartScale;
}

const useLiveLineScales = (domains: Readonly<LiveLineScaleDomains>): LiveLineScales => {
  const { domainEndMs, domainStartMs, yMax, yMin } = domains;
  const yNicedDomain = useMemo<readonly [number, number]>(() => {
    const [lo, hi] = scaleLinear().domain([yMin, yMax]).nice().domain();
    return [lo, hi];
  }, [yMin, yMax]);
  const xScaleFactory = useMemo((): ChartScale => {
    const startMs = domainStartMs;
    const endMs = domainEndMs;
    return {
      id: "x",
      resolve: (context) => {
        const [r0, r1] = context.range;
        const scale = scaleUtc().domain([startMs, endMs]).range([r0, r1]);
        return {
          bandwidth: 0,
          domain: scale.domain(),
          id: context.id,
          map: (point: unknown): number => (point instanceof Date ? scale(point) : Number.NaN),
          ticks: scale.ticks(context.tickCount).map((tick) => ({ label: defaultFormatTime(tick.getTime()), position: scale(tick), value: tick })),
          type: "time",
        };
      },
    };
  }, [domainStartMs, domainEndMs]);
  const yScaleFactory = useMemo((): ChartScale => {
    const [lo, hi] = [yMin, yMax];
    return {
      id: "y",
      resolve: (context) => {
        const scale = scaleLinear().domain([lo, hi]).nice().range(context.range);
        return {
          bandwidth: 0,
          domain: scale.domain(),
          id: context.id,
          map: (point: unknown): number => (isNumber(point) ? scale(point) : Number.NaN),
          ticks: scale.ticks(context.tickCount).map((tick) => ({ label: defaultFormatValue(tick), position: scale(tick), value: tick })),
          type: "linear",
        };
      },
    };
  }, [yMin, yMax]);
  return { xScaleFactory, yNicedDomain, yScaleFactory };
};

export { useLiveLineScales };
export type { LiveLineScaleDomains, LiveLineScales };
