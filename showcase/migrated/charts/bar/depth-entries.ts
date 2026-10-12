// bklit `useBarDepthEntries` (bar-depth.tsx:380-519) on the public chart context: the same geometry the native depth marks use
// (geometry.ts depthEntry), for consumers drawing their own layers aligned with the bars.
import { createContext, useContext, useMemo } from "react";
import { useChartStable } from "../kit/cartesian/chart-context";
import { depthEntry } from "./geometry";
import { numberOrZero } from "./model";
import type { BarDepthProviderProps } from "./carriers";

export interface BarDepthEntry {
  label: string;
  /** Index in the original `data` array. */
  dataIndex: number;
  datum: Record<string, unknown>;
  /** True when `dataIndex === activeIndex`. */
  isActive: boolean;
  isNegative: boolean;
  /** y of the baseline (`yScale(0)`). */
  baselineY: number;
  bandX: number;
  bandWidth: number;
  /** Visual top of the bar in screen y. */
  topY: number;
  bottomY: number;
  barHeight: number;
  /** Untrimmed pixel height of the bar. */
  naturalHeight: number;
  /** Pixels subtracted from the visual top so the lid's back edge lands on `yScale(value)`. */
  topYTrim: number;
  depth: number;
  perspectiveRise: number;
  isRightOfCenter: boolean;
}

export type BarDepthConfig = Pick<BarDepthProviderProps, "segmentsAccessor" | "minBarHeight">;

const BarDepthConfigContext = createContext<BarDepthConfig>({});

/** Publishes the `<BarDepthProvider>` config child to the chart's passthrough children (the hook's only reader). */
export const BarDepthConfigProvider = BarDepthConfigContext.Provider;

export function useBarDepthEntries(dataKey: string, activeIndex?: number): BarDepthEntry[] {
  const { data, barScale, bandWidth, yScale, innerHeight, innerWidth, barXAccessor } = useChartStable();
  const { segmentsAccessor, minBarHeight = 0 } = useContext(BarDepthConfigContext);
  return useMemo(() => {
    if (barScale === undefined || bandWidth === undefined || bandWidth === 0 || barXAccessor === undefined) {
      return [];
    }
    const zeroY = yScale(0);
    const step = barScale.step();
    return data.flatMap((datum, dataIndex): BarDepthEntry[] => {
      const segments = segmentsAccessor?.(datum)?.filter((seg) => seg.value > 0) ?? [];
      const segmentTotal = segments.reduce((sum, seg) => sum + seg.value, 0);
      const raw = datum[dataKey];
      const value = segments.length > 0 ? segmentTotal : numberOrZero(raw);
      const label = barXAccessor(datum);
      const top = segments.at(-1);
      const hasTop = top !== undefined && segmentTotal > 0;
      const entry = depthEntry({
        index: dataIndex,
        label,
        value,
        bandX: barScale(label) ?? 0,
        bandWidth,
        step,
        innerWidth,
        plotLeft: 0,
        baselineY: zeroY,
        // d3 returns undefined for a NaN input.
        valueY: Number.isNaN(value) ? innerHeight : yScale(value),
        minBarHeight,
        topSegmentFraction: hasTop ? top.value / segmentTotal : undefined,
      });
      if (!entry) {
        return [];
      }
      const { index, ...geometry } = entry;
      return [{ ...geometry, dataIndex: index, datum, isActive: activeIndex !== undefined && dataIndex === activeIndex }];
    });
  }, [data, barScale, bandWidth, yScale, innerHeight, innerWidth, barXAccessor, segmentsAccessor, minBarHeight, dataKey, activeIndex]);
}
