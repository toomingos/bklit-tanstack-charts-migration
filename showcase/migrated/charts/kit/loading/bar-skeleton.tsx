import { useCallback, useMemo, useState } from "react";
import type { ReactElement } from "react";

import { useSanitizedId } from "../use-sanitized-id";
import { usePrefersReducedMotion } from "./reduced-motion";
import {
  DEFAULT_SWEEP_DURATION_S,
  SweepMask,
  hashFract,
  skeletonHeights,
} from "./sweep-mask";

const BAR_CORNER_RADIUS = 2;
const DEFAULT_BAR_COUNT = 12;
const DEFAULT_FILL = "var(--foreground)";
const DEFAULT_BAR_FILL_OPACITY = 0.45;
const DEFAULT_BAR_FRACTION = 0.7;

const skeletonSigns = (count: number, seed: number): number[] =>
  Array.from({ length: count }, (_unused, i) =>
    hashFract((i + 1) * 78.233 + seed) < 0.5 ? -1 : 1
  );

export interface BarLoadingSkeletonProps {
  innerWidth: number;
  innerHeight: number;
  /** Number of skeleton bars. Default: 12 */
  barCount?: number;
  /** Bar fill color. Default: `var(--foreground)` */
  fill?: string;
  /** Bar fill opacity. Default: 0.45 */
  fillOpacity?: number;
  /** Bars rise from the bottom or diverge from the vertical center. Default: `"bottom"` */
  baseline?: "bottom" | "center";
  /** Bar width as a fraction of its band (0-1). Default: 0.7 */
  barFraction?: number;
  /** One shimmer sweep, in seconds. Default: 2 */
  durationSeconds?: number;
}

/** Skeleton bars under the sweep, in the chart's inner coordinate space (origin at the inner top-left). */
export const BarLoadingSkeleton = ({
  innerWidth,
  innerHeight,
  barCount = DEFAULT_BAR_COUNT,
  fill = DEFAULT_FILL,
  fillOpacity = DEFAULT_BAR_FILL_OPACITY,
  baseline = "bottom",
  barFraction = DEFAULT_BAR_FRACTION,
  durationSeconds = DEFAULT_SWEEP_DURATION_S,
}: Readonly<BarLoadingSkeletonProps>): ReactElement | null => {
  const reduceMotion = usePrefersReducedMotion();
  const chartId = `bar-sweep-${useSanitizedId()}`;
  const [tick, setTick] = useState(0);
  const onSweepComplete = useCallback(() => {
    setTick((prev) => prev + 1);
  }, []);
  const heights = useMemo(
    () => skeletonHeights(barCount, tick),
    [barCount, tick]
  );
  const signs = useMemo(() => skeletonSigns(barCount, tick), [barCount, tick]);
  if (innerWidth <= 0 || innerHeight <= 0) {
    return null;
  }
  const bandWidth = innerWidth / heights.length;
  const barW = bandWidth * barFraction;
  const xOffset = (bandWidth * (1 - barFraction)) / 2;
  const isCenter = baseline === "center";
  const baselineY = isCenter ? innerHeight / 2 : innerHeight;
  const halfBarH = isCenter ? innerHeight / 2 : innerHeight;
  const bars = heights.map((value, i) => {
    const sign = isCenter ? (signs[i] ?? 1) : 1;
    const barH = Math.max(1, halfBarH * (value / 100));
    const x = i * bandWidth + xOffset;
    return (
      <rect
        key={`${x.toFixed(2)}-${value}`}
        fill={fill}
        fillOpacity={fillOpacity}
        height={barH}
        rx={BAR_CORNER_RADIUS}
        width={barW}
        x={x}
        y={sign === 1 ? baselineY - barH : baselineY}
      />
    );
  });
  if (reduceMotion) {
    return <g>{bars}</g>;
  }
  return (
    <>
      <defs>
        <SweepMask
          chartId={chartId}
          durationSeconds={durationSeconds}
          height={innerHeight}
          onSweepComplete={onSweepComplete}
          width={innerWidth}
        />
      </defs>
      <g mask={`url(#${chartId}-mask)`}>{bars}</g>
    </>
  );
};

BarLoadingSkeleton.displayName = "BarLoadingSkeleton";
