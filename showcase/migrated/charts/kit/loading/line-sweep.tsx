import { area as d3Area, line as d3Line } from "d3-shape";
import type { CurveFactory } from "d3-shape";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactElement, ReactNode } from "react";

import { useOptionalChartStable } from "../cartesian/chart-context";
import { useSanitizedId } from "../use-sanitized-id";
import { usePrefersReducedMotion } from "./reduced-motion";
import {
  DEFAULT_SWEEP_DURATION_S,
  SweepMask,
  skeletonHeights,
} from "./sweep-mask";

const DEFAULT_POINT_COUNT = 14;
const LINE_STROKE_OPACITY = 0.55;
const AREA_FILL_TOP_OPACITY = 0.18;
const AREA_FILL_BOTTOM_OPACITY = 0.02;
/** bklit line-loading-timing.ts LOADING_LABEL_EXIT_S / LINE_LOADING_PULSE_EASE. */
const transitionAnimation = (mode: "exit" | "enter"): string =>
  `bkm-sweep-fade-${mode} 0.45s cubic-bezier(0.85, 0, 0.15, 1) forwards`;
const TRANSITION_STYLES = {
  exit: { animation: transitionAnimation("exit") },
  enter: { animation: transitionAnimation("enter") },
} as const;

export interface LineLoadingSweepProps {
  /** Curve factory from the host `<Line>` / `<Area>`, so the silhouette matches the chart's interpolation. */
  curve: CurveFactory;
  /** Fill the silhouette as an area (for `<Area>`); otherwise stroke only. */
  withArea?: boolean;
  /** Loading phase: `"loop"` (steady), `"exit"` (loading -> ready) or `"enter"` (ready -> loading). Default: `"loop"`. */
  mode?: "loop" | "exit" | "enter";
  /** Fired when an exit/enter transition finishes, to advance the chart phase. */
  onTransitionComplete?: () => void;
  stroke?: string;
  strokeOpacity?: number;
  strokeWidth?: number;
  pointCount?: number;
  durationSeconds?: number;
  /** Plot size, when rendered outside a chart. Default: the chart's inner size. */
  innerWidth?: number;
  innerHeight?: number;
}

export const LineLoadingSweep = ({
  curve,
  withArea = false,
  mode = "loop",
  onTransitionComplete,
  stroke = "var(--chart-foreground)",
  strokeOpacity = LINE_STROKE_OPACITY,
  strokeWidth = 2,
  pointCount = DEFAULT_POINT_COUNT,
  durationSeconds = DEFAULT_SWEEP_DURATION_S,
  innerWidth: innerWidthProp,
  innerHeight: innerHeightProp,
}: Readonly<LineLoadingSweepProps>): ReactElement | null => {
  const chart = useOptionalChartStable();
  const innerWidth = innerWidthProp ?? chart?.innerWidth ?? 0;
  const innerHeight = innerHeightProp ?? chart?.innerHeight ?? 0;
  const reduceMotion = usePrefersReducedMotion();
  const chartId = `line-sweep-${useSanitizedId()}`;
  const isLoop = mode === "loop";
  const [tick, setTick] = useState(0);
  // Re-roll only while looping; a transition holds the silhouette so it fades as one piece.
  const onSweepComplete = useCallback(() => {
    if (isLoop) {
      setTick((prev) => prev + 1);
    }
  }, [isLoop]);
  const heights = useMemo(
    () => skeletonHeights(pointCount, tick),
    [pointCount, tick]
  );
  const pathD = useMemo(() => {
    if (innerWidth <= 0 || innerHeight <= 0 || heights.length < 2) {
      return null;
    }
    const x = (index: number): number =>
      (index / (heights.length - 1)) * innerWidth;
    const y = (value: number): number =>
      innerHeight - (value / 100) * innerHeight;
    const points = heights.map((value, index) => ({ index, value }));
    return {
      line:
        d3Line<{ index: number; value: number }>()
          .curve(curve)
          .x((d) => x(d.index))
          .y((d) => y(d.value))(points) ?? "",
      area:
        d3Area<{ index: number; value: number }>()
          .curve(curve)
          .x((d) => x(d.index))
          .y0(innerHeight)
          .y1((d) => y(d.value))(points) ?? "",
    };
  }, [heights, innerWidth, innerHeight, curve]);
  // Reduced motion has no fade to wait for: hand off at once or the phase machine would stall mid-transition.
  useEffect(() => {
    if (reduceMotion && !isLoop) {
      onTransitionComplete?.();
    }
  }, [reduceMotion, isLoop, onTransitionComplete]);
  const silhouette: ReactNode = pathD ? (
    <>
      {withArea ? <path d={pathD.area} fill={`url(#${chartId}-area)`} /> : null}
      <path
        d={pathD.line}
        fill="none"
        stroke={stroke}
        strokeLinecap="round"
        strokeOpacity={strokeOpacity}
        strokeWidth={strokeWidth}
      />
    </>
  ) : null;
  if (!pathD) {
    return null;
  }
  const areaGradient = withArea ? (
    <linearGradient id={`${chartId}-area`} x1="0" x2="0" y1="0" y2="1">
      <stop
        offset="0%"
        stopColor={stroke}
        stopOpacity={AREA_FILL_TOP_OPACITY}
      />
      <stop
        offset="100%"
        stopColor={stroke}
        stopOpacity={AREA_FILL_BOTTOM_OPACITY}
      />
    </linearGradient>
  ) : null;
  if (reduceMotion) {
    return (
      <>
        {areaGradient ? <defs>{areaGradient}</defs> : null}
        {silhouette}
      </>
    );
  }
  const transitionStyle = isLoop ? undefined : TRANSITION_STYLES[mode];
  const defs = (
    <defs>
      {areaGradient}
      <SweepMask
        chartId={chartId}
        durationSeconds={durationSeconds}
        height={innerHeight}
        onSweepComplete={onSweepComplete}
        width={innerWidth}
      />
    </defs>
  );
  return (
    <>
      {defs}
      <g
        mask={`url(#${chartId}-mask)`}
        onAnimationEnd={isLoop ? undefined : onTransitionComplete}
        style={transitionStyle}
      >
        {silhouette}
      </g>
    </>
  );
};

LineLoadingSweep.displayName = "LineLoadingSweep";
