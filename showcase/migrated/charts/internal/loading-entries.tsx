// V3.4b parity: legacy loading names over declared dependencies only.
"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactElement } from "react";
import { scaleLinear } from "d3-scale";
import { area, line } from "d3-shape";
import type { CurveFactory } from "d3-shape";
import { ResourceHost, scopeResourceIds } from "./resource-host";
import { chartCssVars, useChartStable } from "./chart-context";
import { fadeGradientStops, resolveFadeSides, viewportFadeGradientAttrs } from "./fade-mask";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";
import { cn } from "./cn";
import {
  PERCENT_SCALE,
  generateEasedGradientStops,
  getSkeletonHeights,
  getSkeletonSigns,
} from "./skeleton-data";

// Timing mirrors legacy `line-loading-timing.ts`.
const LINE_LOADING_PULSE_CYCLE_S = 2.2;
const LOADING_LABEL_EXIT_S = 0.45;
const LOADING_LABEL_EXIT_Y_PX = 30;
const LOADING_LABEL_EXIT_EASE = "cubic-bezier(0.85, 0, 0.15, 1)";
const MS_PER_SECOND = 1000;

// Sweep geometry mirrors legacy `loading-sweep.tsx`.
const DEFAULT_SWEEP_DURATION_S = 2;
const SWEEP_START_X = -1;
const SWEEP_END_X = 2;
const SWEEP_ANGLE_DEG = 25;
const SWEEP_PATTERN_TILE_WIDTH = 3;
const DEFAULT_POINT_COUNT = 14;
const BAR_CORNER_RADIUS = 2;
const DEFAULT_BAR_COUNT = 12;
const DEFAULT_BAR_FILL = "var(--foreground)";
const DEFAULT_BAR_FILL_OPACITY = 0.45;
const LINE_STROKE_OPACITY = 0.55;
const AREA_FILL_TOP_OPACITY = 0.18;
const AREA_FILL_BOTTOM_OPACITY = 0.02;
const DEFAULT_BAR_FRACTION = 0.7;
const Y_DOMAIN_MAX = 100;

interface SweepMaskDefsProps {
  readonly chartId: string;
  readonly width: number;
  readonly height: number;
  readonly durationSeconds: number;
  readonly onSweepComplete: () => void;
}

// Shimmer sweep defs with a `requestAnimationFrame` band position.
// Ramp, re-roll gate and def ids match the legacy motion version.
const SweepMaskDefs = ({
  chartId,
  width,
  height,
  durationSeconds,
  onSweepComplete,
}: SweepMaskDefsProps): ReactElement => {
  const gradientStops = useMemo(() => generateEasedGradientStops(), []);
  const completeRef = useRef(onSweepComplete);
  completeRef.current = onSweepComplete;
  const lastXRef = useRef(SWEEP_START_X);
  const [sweepX, setSweepX] = useState(SWEEP_START_X);
  useEffect(() => {
    const travel = SWEEP_END_X - SWEEP_START_X;
    const start = performance.now();
    let frame = 0;
    const step = (now: number): void => {
      const elapsed = (now - start) / MS_PER_SECOND;
      const next = SWEEP_START_X + ((elapsed % durationSeconds) / durationSeconds) * travel;
      // Re-roll once the band clears the visible area (crossed past 1).
      // Steady silhouettes never change shape under the user's eye.
      if (next >= 1 && lastXRef.current < 1) {
        completeRef.current();
      }
      lastXRef.current = next;
      setSweepX(next);
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return (): void => {
      cancelAnimationFrame(frame);
    };
  }, [durationSeconds]);
  return (
    <>
      <linearGradient id={`${chartId}-grad`} x1="0" x2="1" y1="0" y2="0">
        {gradientStops.map(({ offset, opacity }) => (
          <stop key={offset} offset={offset} stopColor="white" stopOpacity={opacity} />
        ))}
      </linearGradient>
      <pattern
        height="1"
        id={`${chartId}-pattern`}
        patternContentUnits="objectBoundingBox"
        patternTransform={`rotate(${SWEEP_ANGLE_DEG})`}
        patternUnits="objectBoundingBox"
        width={SWEEP_PATTERN_TILE_WIDTH}
        x="0"
        y="0"
      >
        <rect fill={`url(#${chartId}-grad)`} height="1" width="1" x={sweepX} y="0" />
      </pattern>
      {/* Explicit region: the seam host is 0×0, so the userSpaceOnUse default region would be empty (D559). */}
      <mask height={height} id={`${chartId}-mask`} maskUnits="userSpaceOnUse" width={width} x={0} y={0}>
        <rect fill={`url(#${chartId}-pattern)`} height={height} width={width} />
      </mask>
    </>
  );
};

interface SweepPoint {
  readonly index: number;
  readonly value: number;
}

interface LineLoadingSweepProps {
  /** Curve factory from the host `<Line>` / `<Area>`, so the silhouette matches the chart's interpolation. */
  curve: CurveFactory;
  /** Fill the silhouette as an area (for `<Area>`); otherwise stroke only. */
  withArea?: boolean;
  /** Loading phase: `"loop"` (steady), `"exit"` (loading to ready), or `"enter"` (ready to loading). Default: `"loop"`. */
  mode?: "loop" | "exit" | "enter";
  /** Fired when an exit/enter transition finishes, to advance the chart phase. */
  onTransitionComplete?: () => void;
  stroke?: string;
  strokeOpacity?: number;
  strokeWidth?: number;
  pointCount?: number;
  durationSeconds?: number;
}

// Placeholder line/area silhouette with the shimmer sweeping across it.
// Silhouette re-randomizes between passes; reads dimensions from context.
const LineLoadingSweep = ({  curve,
  withArea = false,
  mode = "loop",
  onTransitionComplete,
  stroke = chartCssVars.foreground,
  strokeOpacity = LINE_STROKE_OPACITY,
  strokeWidth = 2,
  pointCount = DEFAULT_POINT_COUNT,
  durationSeconds = DEFAULT_SWEEP_DURATION_S,
}: LineLoadingSweepProps): ReactElement | null => {
  const { innerWidth, innerHeight } = useChartStable();
  const reduceMotion = usePrefersReducedMotion();
  const reactId = useId();
  const chartId = `line-sweep-${reactId.replaceAll(":", "")}`;
  const isLoop = mode === "loop";
  const [tick, setTick] = useState(0);
  // Re-randomize only while looping; the transition holds one steady shape.
  const handleSweepComplete = useMemo(
    () =>
      (): void => {
        if (isLoop) {
          setTick((previous) => previous + 1);
        }
      },
    [isLoop],
  );
  const heights = useMemo(() => getSkeletonHeights(pointCount, tick), [pointCount, tick]);
  // Exit/enter handoff without motion; the silhouette holds steady.
  // Phase machine advances after the legacy exit duration.
  const completeRef = useRef(onTransitionComplete);
  completeRef.current = onTransitionComplete;
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isLoop) {
        completeRef.current?.();
      }
    }, LOADING_LABEL_EXIT_S * MS_PER_SECOND);
    return (): void => {
      clearTimeout(timer);
    };
  }, [isLoop]);
  // With reduced motion there is no fade to await; the handoff signals at once.
  useEffect((): void => {
    if (reduceMotion && !isLoop) {
      completeRef.current?.();
    }
  }, [reduceMotion, isLoop]);

  if (innerWidth <= 0 || innerHeight <= 0 || heights.length < 2) {
    return null;
  }

  const xScale = scaleLinear()
    .domain([0, heights.length - 1])
    .range([0, innerWidth]);
  const yScale = scaleLinear().domain([0, Y_DOMAIN_MAX]).range([innerHeight, 0]);
  const points: SweepPoint[] = heights.map((value, index) => ({ index, value }));
  const getX = (point: SweepPoint): number => xScale(point.index);
  const getY = (point: SweepPoint): number => yScale(point.value);
  const linePath = line<SweepPoint>().x(getX).y(getY).curve(curve)(points) ?? "";
  const areaPath = area<SweepPoint>().x(getX).y0(innerHeight).y1(getY).curve(curve)(points) ?? "";

  // Seam-bound paints ride a call (the funnel precedent); the prop never holds a literal.
  const areaGradient = withArea ? scopeResourceIds(
    <linearGradient id={`${chartId}-area`} x1="0" x2="0" y1="0" y2="1">
      <stop offset="0%" stopColor={stroke} stopOpacity={AREA_FILL_TOP_OPACITY} />
      <stop offset="100%" stopColor={stroke} stopOpacity={AREA_FILL_BOTTOM_OPACITY} />
    </linearGradient>,
    chartId,
  ) : undefined;

  const silhouette = (
    <>
      {withArea ? <path d={areaPath} fill={`url(#${chartId}-area)`} /> : undefined}
      <path
        d={linePath}
        fill="none"
        stroke={stroke}
        strokeLinecap="round"
        strokeOpacity={strokeOpacity}
        strokeWidth={strokeWidth}
      />
    </>
  );

  if (reduceMotion) {
    return (
      <>
        {areaGradient === undefined ? undefined : (
          <ResourceHost idPrefix={chartId} resources={areaGradient} />
        )}
        {silhouette}
      </>
    );
  }

  const maskUrl = `url(#${chartId}-mask)`;
  const sweepResources = (
    <>
      {areaGradient}
      <SweepMaskDefs
        chartId={chartId}
        durationSeconds={durationSeconds}
        height={innerHeight}
        onSweepComplete={handleSweepComplete}
        width={innerWidth}
      />
    </>
  );
  const defs = (
    <ResourceHost
      idPrefix={chartId}
      resources={sweepResources}
    />
  );

  if (isLoop) {
    return (
      <>
        {defs}
        <g mask={maskUrl}>{silhouette}</g>
      </>
    );
  }

  // Transition holds the resting opacity, then hands off to the chart.
  const restingOpacity = mode === "exit" ? 0 : 1;
  return (
    <>
      {defs}
      <g mask={maskUrl} opacity={restingOpacity}>
        {silhouette}
      </g>
    </>
  );
};

LineLoadingSweep.displayName = "LineLoadingSweep";

interface SkeletonBarsProps {
  readonly heights: number[];
  readonly signs: number[];
  readonly innerWidth: number;
  readonly innerHeight: number;
  readonly baseline: "bottom" | "center";
  readonly barFraction: number;
  readonly fill: string;
  readonly fillOpacity: number;
}

const SkeletonBars = ({
  heights,
  signs,
  innerWidth,
  innerHeight,
  baseline,
  barFraction,
  fill,
  fillOpacity,
}: SkeletonBarsProps): ReactElement => {
  const bandWidth = innerWidth / heights.length;
  const barWidth = bandWidth * barFraction;
  const xOffset = (bandWidth * (1 - barFraction)) / 2;
  const isCenter = baseline === "center";
  const baselineY = isCenter ? innerHeight / 2 : innerHeight;
  const halfBarHeight = isCenter ? innerHeight / 2 : innerHeight;
  return (
    <>
      {heights.map((value, index) => {
        const sign = isCenter ? (signs[index] ?? 1) : 1;
        const barHeight = Math.max(1, (halfBarHeight * value) / PERCENT_SCALE);
        const barX = index * bandWidth + xOffset;
        const barY = sign === 1 ? baselineY - barHeight : baselineY;
        return (
          <rect
            fill={fill}
            fillOpacity={fillOpacity}
            height={barHeight}
            key={`${barX.toFixed(2)}-${value}`}
            rx={BAR_CORNER_RADIUS}
            width={barWidth}
            x={barX}
            y={barY}
          />
        );
      })}
    </>
  );
};

interface BarLoadingSkeletonProps {
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

// Skeleton bars masked by the shimmer sweep in inner coordinates, so a
// `BarChart` drops the silhouette inside its margin-translated group.
const BarLoadingSkeleton = ({
  innerWidth,
  innerHeight,
  barCount = DEFAULT_BAR_COUNT,
  fill = DEFAULT_BAR_FILL,
  fillOpacity = DEFAULT_BAR_FILL_OPACITY,
  baseline = "bottom",
  barFraction = DEFAULT_BAR_FRACTION,
  durationSeconds = DEFAULT_SWEEP_DURATION_S,
}: BarLoadingSkeletonProps): ReactElement | null => {
  const reduceMotion = usePrefersReducedMotion();
  const reactId = useId();
  const chartId = `bar-sweep-${reactId.replaceAll(":", "")}`;
  const [tick, setTick] = useState(0);
  const handleSweepComplete = useMemo(
    () =>
      (): void => {
        setTick((previous) => previous + 1);
      },
    [],
  );
  const heights = useMemo(() => getSkeletonHeights(barCount, tick), [barCount, tick]);
  const signs = useMemo(() => getSkeletonSigns(barCount, tick), [barCount, tick]);

  if (innerWidth <= 0 || innerHeight <= 0) {
    return null;
  }

  const bars = (
    <SkeletonBars
      barFraction={barFraction}
      baseline={baseline}
      fill={fill}
      fillOpacity={fillOpacity}
      heights={heights}
      innerHeight={innerHeight}
      innerWidth={innerWidth}
      signs={signs}
    />
  );

  if (reduceMotion) {
    return bars;
  }

  // Seam-bound paints ride a call (the funnel precedent); the prop never holds a literal.
  const sweepResources = scopeResourceIds(
    <SweepMaskDefs
      chartId={chartId}
      durationSeconds={durationSeconds}
      height={innerHeight}
      onSweepComplete={handleSweepComplete}
      width={innerWidth}
    />,
    chartId,
  );
  return (
    <>
      <ResourceHost
        idPrefix={chartId}
        resources={sweepResources}
      />
      <g mask={`url(#${chartId}-mask)`}>{bars}</g>
    </>
  );
};

BarLoadingSkeleton.displayName = "BarLoadingSkeleton";

const PULSE_CLIP_PADDING = 10;
const PULSE_MIDPOINT = 0.5;

type LineLoadingPulseMode = "loop" | "exit" | "enter";

interface LineLoadingPulseStrokeProps {
  pathD: string;
  mode?: LineLoadingPulseMode;
  /** Bumps to restart loop cycles without remounting the stroke. */
  loopEpoch?: number;
  stroke?: string;
  /** Stroke opacity for the animated segment. Default: 0.5 */
  strokeOpacity?: number;
  strokeWidth?: number;
  onCycleComplete?: () => void;
}

// Grow-then-shrink clip window over the legacy pulse cycle.
// Progress runs on `requestAnimationFrame`; window math is unchanged.
const usePulseProgress = (
  innerWidth: number,
  mode: LineLoadingPulseMode,
  loopEpoch: number,
  onComplete?: () => void,
): number => {
  const [progress, setProgress] = useState(0);
  const progressRef = useRef(0);
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;
  useEffect(() => {
    let frame = 0;
    const halfCycleMs = (LINE_LOADING_PULSE_CYCLE_S / 2) * MS_PER_SECOND;
    const start = performance.now();
    const target = mode === "enter" ? PULSE_MIDPOINT : 1;
    if (mode === "loop") {
      progressRef.current = 0;
    }
    const from = mode === "exit" ? progressRef.current : 0;
    const step = (now: number): void => {
      const total = mode === "enter" ? halfCycleMs : LINE_LOADING_PULSE_CYCLE_S * MS_PER_SECOND;
      const span = target - from;
      const ratio = span <= 0 ? 1 : Math.min(1, (now - start) / (total * (span / target)));
      const next = from + span * ratio;
      progressRef.current = next;
      // Loop restarts from the next epoch; exit and enter hand off at target.
      if (ratio >= 1) {
        completeRef.current?.();
        return;
      }
      setProgress(next);
      frame = requestAnimationFrame(step);
    };
    if (innerWidth > 0) {
      frame = requestAnimationFrame(step);
    }
    return (): void => {
      cancelAnimationFrame(frame);
    };
    // LoopEpoch restarts the pulse when the orchestrator advances.
  }, [innerWidth, loopEpoch, mode]);
  return progress;
};

const LineLoadingPulseStroke = ({
  pathD,
  mode = "loop",
  loopEpoch = 0,
  stroke = chartCssVars.foreground,
  strokeOpacity = 0.5,
  strokeWidth = 2.5,
  onCycleComplete,
}: LineLoadingPulseStrokeProps): ReactElement | null => {
  const { innerWidth, innerHeight } = useChartStable();
  const reactId = useId();
  const clipPathId = `line-loading-clip-${reactId}`;
  const gradientId = `line-loading-gradient-${reactId}`;
  const fadeStops = fadeGradientStops(resolveFadeSides(true));
  const clipHeight = innerHeight + PULSE_CLIP_PADDING * 2;
  const progress = usePulseProgress(innerWidth, mode, loopEpoch, onCycleComplete);
  const paddedFullWidth = innerWidth + PULSE_CLIP_PADDING * 2;
  const rightEdge = innerWidth + PULSE_CLIP_PADDING;
  const shrink = progress <= PULSE_MIDPOINT ? 0 : (progress - PULSE_MIDPOINT) / PULSE_MIDPOINT;
  const clipWidth =
    progress <= PULSE_MIDPOINT
      ? (progress / PULSE_MIDPOINT) * paddedFullWidth
      : (1 - shrink) * paddedFullWidth;
  const clipX = progress <= PULSE_MIDPOINT ? -PULSE_CLIP_PADDING : rightEdge - (1 - shrink) * paddedFullWidth;

  if (innerWidth <= 0) {
    return null;
  }

  const pulseResources = (
    <>
      <clipPath id={clipPathId}>
        <rect height={clipHeight} width={clipWidth} x={clipX} y={-PULSE_CLIP_PADDING} />
      </clipPath>
      <linearGradient id={gradientId} {...viewportFadeGradientAttrs(innerWidth)}>
        {fadeStops.map((stop) => (
          <stop key={stop.offset} offset={stop.offset} stopColor={stroke} stopOpacity={stop.opacity} />
        ))}
      </linearGradient>
    </>
  );
  return (
    <>
      <ResourceHost
        idPrefix={reactId}
        resources={pulseResources}
      />
      <path
        clipPath={`url(#${clipPathId})`}
        d={pathD}
        fill="none"
        opacity={strokeOpacity}
        stroke={`url(#${gradientId})`}
        strokeLinecap="round"
        strokeWidth={strokeWidth}
      />
    </>
  );
};

LineLoadingPulseStroke.displayName = "LineLoadingPulseStroke";

interface ChartLoadingLabelProps {
  /** Label shown centered over the chart. */
  text?: string;
  className?: string;
  /** Animate down, fade, and blur during loading to ready handoff. */
  exiting?: boolean;
}

const SPAN_MUTED_STYLE: CSSProperties = { color: "var(--muted-foreground)" };

const ChartLoadingLabel = ({ text = "Loading", className, exiting = false }: ChartLoadingLabelProps): ReactElement | null => {
  const labelStyle = useMemo(
    (): CSSProperties => ({
      filter: exiting ? "blur(2px)" : "blur(0px)",
      opacity: exiting ? 0 : 1,
      transform: exiting ? `translateY(${LOADING_LABEL_EXIT_Y_PX}px)` : "translateY(0px)",
      transition: `opacity ${LOADING_LABEL_EXIT_S}s ${LOADING_LABEL_EXIT_EASE}, transform ${LOADING_LABEL_EXIT_S}s ${LOADING_LABEL_EXIT_EASE}, filter ${LOADING_LABEL_EXIT_S}s ${LOADING_LABEL_EXIT_EASE}`,
    }),
    [exiting],
  );
  if (text.trim() === "") {
    return null;
  }
  // ShimmeringText substitute with a plain centered span.
  // Host owns that component; exit motion matches the legacy duration.
  return (
    <output
      aria-live="polite"
      className={cn("pointer-events-none absolute inset-0 flex items-center justify-center", className)}
      style={labelStyle}
    >
      <span className="font-medium text-sm tracking-wide" style={SPAN_MUTED_STYLE}>
        {text}
      </span>
    </output>
  );
};

export { BarLoadingSkeleton, ChartLoadingLabel, LineLoadingPulseStroke, LineLoadingSweep };
export type {
  BarLoadingSkeletonProps,
  ChartLoadingLabelProps,
  LineLoadingPulseStrokeProps,
  LineLoadingSweepProps,
};
