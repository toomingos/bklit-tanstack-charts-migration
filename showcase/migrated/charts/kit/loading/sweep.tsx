// Standalone bklit loading-sweep.tsx: a CSS-animated shimmer band (styles.css `bkm-sweep-travel`) crosses a seeded
// skeleton silhouette through an SVG mask; it re-rolls once per pass, when the band is off-screen.
import { area as d3Area, line as d3Line } from "d3-shape";
import type { CurveFactory } from "d3-shape";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import "../../styles.css";
import { useOptionalChartStable } from "../cartesian/chart-context";
import { usePrefersReducedMotion } from "./reduced-motion";
import { useSanitizedId } from "../use-sanitized-id";

/** One shimmer sweep, in seconds. */
const DEFAULT_SWEEP_DURATION_S = 2;
/** Diagonal tilt of the shimmer band, in degrees. */
const SWEEP_ANGLE_DEG = 25;
const HEIGHT_MIN_PCT = 20;
const HEIGHT_MAX_PCT = 80;
const DEFAULT_POINT_COUNT = 14;
const BAR_CORNER_RADIUS = 2;
const DEFAULT_BAR_COUNT = 12;
const DEFAULT_FILL = "var(--foreground)";
const DEFAULT_BAR_FILL_OPACITY = 0.45;
const LINE_STROKE_OPACITY = 0.55;
const AREA_FILL_TOP_OPACITY = 0.18;
const AREA_FILL_BOTTOM_OPACITY = 0.02;
const DEFAULT_BAR_FRACTION = 0.7;
/** bklit line-loading-timing.ts LOADING_LABEL_EXIT_S / LINE_LOADING_PULSE_EASE. */
const transitionAnimation = (mode: "exit" | "enter"): string => `bkm-sweep-fade-${mode} 0.45s cubic-bezier(0.85, 0, 0.15, 1) forwards`;
const TRANSITION_STYLES = { exit: { animation: transitionAnimation("exit") }, enter: { animation: transitionAnimation("enter") } } as const;

// Heights come from a deterministic hash of (index, seed), never Math.random(), so server and client renders agree.
const hashFract = (n: number): number => {
  const x = Math.sin(n) * 43_758.5453;
  return x - Math.floor(x);
};

const skeletonHeights = (count: number, seed: number): number[] =>
  Array.from({ length: count }, (_unused, i) => HEIGHT_MIN_PCT + Math.floor(hashFract((i + 1) * 12.9898 + seed) * (HEIGHT_MAX_PCT - HEIGHT_MIN_PCT)));

const skeletonSigns = (count: number, seed: number): number[] =>
  Array.from({ length: count }, (_unused, i) => (hashFract((i + 1) * 78.233 + seed) < 0.5 ? -1 : 1));

/** Bell-curve opacity stops (sin squared) for the band's soft edges. */
const BAND_STOPS = Array.from({ length: 17 }, (_unused, i) => {
  const t = i / 16;
  return { offset: `${(t * 100).toFixed(0)}%`, opacity: Number((0.05 + Math.sin(t * Math.PI) ** 2 * 0.85).toFixed(3)) };
});

interface SweepMaskProps {
  readonly chartId: string;
  readonly width: number;
  readonly height: number;
  readonly durationSeconds: number;
  readonly onSweepComplete: () => void;
}

const SweepMask = ({ chartId, width, height, durationSeconds, onSweepComplete }: SweepMaskProps): ReactElement => {
  const style = useMemo(() => ({ "--bkm-sweep-w": `${width}px`, animation: `bkm-sweep-travel ${durationSeconds}s linear infinite` }), [width, durationSeconds]);
  return (
    <>
      <linearGradient id={`${chartId}-grad`} x1="0" x2="1" y1="0" y2="0">
        {BAND_STOPS.map(({ offset, opacity }) => (
          <stop key={offset} offset={offset} stopColor="white" stopOpacity={opacity} />
        ))}
      </linearGradient>
      <mask id={`${chartId}-mask`} maskUnits="userSpaceOnUse">
        {/* Oversized rect so the rotated band still covers the plot corners. */}
        <g transform={`rotate(${SWEEP_ANGLE_DEG} ${width / 2} ${height / 2})`}>
          <rect fill={`url(#${chartId}-grad)`} height={height * 3} onAnimationIteration={onSweepComplete} style={style} width={width} x={0} y={-height} />
        </g>
      </mask>
    </>
  );
};

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
  const heights = useMemo(() => skeletonHeights(pointCount, tick), [pointCount, tick]);
  const pathD = useMemo(() => {
    if (innerWidth <= 0 || innerHeight <= 0 || heights.length < 2) {
      return null;
    }
    const x = (index: number): number => (index / (heights.length - 1)) * innerWidth;
    const y = (value: number): number => innerHeight - (value / 100) * innerHeight;
    const points = heights.map((value, index) => ({ index, value }));
    return {
      line: d3Line<{ index: number; value: number }>().curve(curve).x((d) => x(d.index)).y((d) => y(d.value))(points) ?? "",
      area: d3Area<{ index: number; value: number }>().curve(curve).x((d) => x(d.index)).y0(innerHeight).y1((d) => y(d.value))(points) ?? "",
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
      <path d={pathD.line} fill="none" stroke={stroke} strokeLinecap="round" strokeOpacity={strokeOpacity} strokeWidth={strokeWidth} />
    </>
  ) : null;
  if (!pathD) {
    return null;
  }
  const areaGradient = withArea ? (
    <linearGradient id={`${chartId}-area`} x1="0" x2="0" y1="0" y2="1">
      <stop offset="0%" stopColor={stroke} stopOpacity={AREA_FILL_TOP_OPACITY} />
      <stop offset="100%" stopColor={stroke} stopOpacity={AREA_FILL_BOTTOM_OPACITY} />
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
      <SweepMask chartId={chartId} durationSeconds={durationSeconds} height={innerHeight} onSweepComplete={onSweepComplete} width={innerWidth} />
    </defs>
  );
  return (
    <>
      {defs}
      <g mask={`url(#${chartId}-mask)`} onAnimationEnd={isLoop ? undefined : onTransitionComplete} style={transitionStyle}>
        {silhouette}
      </g>
    </>
  );
};

LineLoadingSweep.displayName = "LineLoadingSweep";

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
  const heights = useMemo(() => skeletonHeights(barCount, tick), [barCount, tick]);
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
    return <rect key={`${x.toFixed(2)}-${value}`} fill={fill} fillOpacity={fillOpacity} height={barH} rx={BAR_CORNER_RADIUS} width={barW} x={x} y={sign === 1 ? baselineY - barH : baselineY} />;
  });
  if (reduceMotion) {
    return <g>{bars}</g>;
  }
  return (
    <>
      <defs>
        <SweepMask chartId={chartId} durationSeconds={durationSeconds} height={innerHeight} onSweepComplete={onSweepComplete} width={innerWidth} />
      </defs>
      <g mask={`url(#${chartId}-mask)`}>{bars}</g>
    </>
  );
};

BarLoadingSkeleton.displayName = "BarLoadingSkeleton";
