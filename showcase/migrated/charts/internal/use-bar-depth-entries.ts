"use client";

import { useMemo } from "react";
import { useChartStable } from "./chart-context";
import { barDepthAndRise, barDepthMaxDepth } from "./bar-depth-geometry";
import type { BarDepthEntry } from "./parity/bar";

const isNumberValue = <Value>(value: Value): value is Value & number => typeof value === "number";

const readBarValue = (row: Record<string, unknown>, key: string): number => {
  const value: unknown = key === "" ? undefined : row[key];
  return isNumberValue(value) ? value : 0;
};

/**
 * Per-bar 3D depth geometry from chart context.
 *
 * @param {string} dataKey Column read for each bar value.
 * @param {number} [activeIndex] Optional hovered bar index, forwarded to entries for `<BarPulse>`.
 * @returns {BarDepthEntry[]} One entry per renderable bar; bars with no height are excluded.
 */
const useBarDepthEntries = (
  dataKey: string,
  activeIndex?: number,
): BarDepthEntry[] => {
  const {
    data,
    barScale,
    bandWidth,
    yScale,
    innerWidth,
    barXAccessor,
  } = useChartStable();

  return useMemo(() => {
    if (barScale === undefined || barXAccessor === undefined) {
      return [];
    }
    if (bandWidth === undefined || bandWidth === 0 || Number.isNaN(bandWidth)) {
      return [];
    }

    const centerX = innerWidth / 2;
    const zeroY = yScale(0);
    // Step is bandwidth plus gap; depth never spills past the next bar.
    const maxDepth = barDepthMaxDepth(barScale.step(), bandWidth);

    return data.flatMap((row, dataIndex): BarDepthEntry[] => {
      const value = readBarValue(row, dataKey);
      const isActive = activeIndex !== undefined && dataIndex === activeIndex;
      const isNegative = value < 0;
      const label = barXAccessor(row);
      const bandX = barScale(label) ?? 0;
      const cx = bandX + bandWidth / 2;

      const valuePos = yScale(value);
      const naturalHeight = Math.abs(zeroY - valuePos);
      if (naturalHeight <= 0) {
        return [];
      }

      const offsetFromCenter = centerX > 0 ? (cx - centerX) / centerX : 0;
      const isRightOfCenter = offsetFromCenter > 0;
      const absOffset = Math.min(1, Math.abs(offsetFromCenter));
      const { depth, perspectiveRise: rawRise } = barDepthAndRise(
        absOffset,
        naturalHeight,
        maxDepth,
      );
      // Negative bars flatten into a baseline-flush rectangle.
      const perspectiveRise = isNegative ? 0 : rawRise;
      // Trim keeps the lid on the value regardless of depth.
      const topYTrim =
        naturalHeight > 0 && !isNegative
          ? Math.min(perspectiveRise, Math.max(0, naturalHeight - 1))
          : 0;
      const topY = isNegative ? zeroY : zeroY - naturalHeight + topYTrim;
      const bottomY = isNegative ? zeroY + naturalHeight : zeroY;

      return [
        {
          bandWidth,
          bandX,
          barHeight: bottomY - topY,
          baselineY: zeroY,
          bottomY,
          dataIndex,
          datum: row,
          depth,
          isActive,
          isNegative,
          isRightOfCenter,
          label,
          naturalHeight,
          perspectiveRise,
          topY,
          topYTrim,
        },
      ];
    });
  }, [
    data,
    barScale,
    bandWidth,
    yScale,
    innerWidth,
    barXAccessor,
    dataKey,
    activeIndex,
  ]);
};

export { useBarDepthEntries };
