// Bar loading skeleton: bklit BarLoadingSkeleton as a plain React SVG overlay.
// Geometry, stops, timing, and the re-roll rule port loading-sweep.tsx verbatim.
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactElement } from "react";
import { loadingSkeletonBarHeights } from "./loading-chrome";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";
import { useSanitizedId } from "./use-sanitized-id";

// One shimmer sweep, in seconds (bklit DEFAULT_SWEEP_DURATION_S).
const BAR_SWEEP_DURATION_S = 2;
// Sweep travel in objectBoundingBox space: off the left edge to off the right.
const BAR_SWEEP_START_X = -1;
const BAR_SWEEP_END_X = 2;
// Band position that clears the visible area and re-rolls the silhouette.
const BAR_SWEEP_REROLL_X = 1;
// Diagonal tilt of the shimmer band, in degrees.
const BAR_SWEEP_ANGLE_DEG = 25;
// Pattern tile width in objectBoundingBox units (bklit pattern width).
const BAR_SWEEP_PATTERN_TILE_WIDTH = 3;
// Bar corner radius, in pixels.
const BAR_SKELETON_CORNER_RADIUS = 2;
// Bar width as a fraction of its band (the rest is the inter-bar gap).
const BAR_SKELETON_FRACTION = 0.7;
// Eased shimmer-band stop count (bklit generateEasedGradientStops steps).
const BAR_SWEEP_GRADIENT_STEPS = 17;
// Shimmer-band opacity floor and peak (bklit min/max opacity).
const BAR_SWEEP_GRADIENT_MIN_OPACITY = 0.05;
const BAR_SWEEP_GRADIENT_MAX_OPACITY = 0.9;
// Shimmer-band opacity decimal precision (bklit toFixed digits).
const GRADIENT_OPACITY_PRECISION = 3;
// Unit-to-percent scale for gradient offsets and height fractions.
const PERCENT_SCALE = 100;
// Seconds-to-milliseconds factor for the rAF loop clock.
const MS_PER_SECOND = 1000;
// Default skeleton bar count (bklit DEFAULT_BAR_COUNT).
const DEFAULT_BAR_SKELETON_COUNT = 12;
// Default bar fill (bklit DEFAULT_FILL).
const DEFAULT_BAR_SKELETON_FILL = "var(--foreground)";
// Default bar fill opacity (bklit DEFAULT_BAR_FILL_OPACITY).
const DEFAULT_BAR_SKELETON_FILL_OPACITY = 0.45;

interface BarLoadingSweepProps {
  readonly innerWidth: number;
  readonly innerHeight: number;
  /** Number of skeleton bars. Default: 12 */
  readonly barCount?: number;
  /** Bar fill color. Default: `var(--foreground)` */
  readonly fill?: string;
  /** Bar fill opacity. Default: 0.45 */
  readonly fillOpacity?: number;
  /** Freeze the mask at its initial phase (migrated-only QA determinism). */
  readonly pulsePaused?: boolean;
}

interface EasedGradientStop {
  readonly offset: string;
  readonly opacity: number;
}

// Bell-curve opacity stops for the shimmer band soft edges (bklit formula).
const generateEasedGradientStops = (): EasedGradientStop[] =>
  Array.from({ length: BAR_SWEEP_GRADIENT_STEPS }, (_unused, index) => {
    const phaseRatio = index / (BAR_SWEEP_GRADIENT_STEPS - 1);
    const eased = Math.sin(phaseRatio * Math.PI) ** 2;
    const opacity =
      BAR_SWEEP_GRADIENT_MIN_OPACITY +
      eased * (BAR_SWEEP_GRADIENT_MAX_OPACITY - BAR_SWEEP_GRADIENT_MIN_OPACITY);
    return {
      offset: `${(phaseRatio * PERCENT_SCALE).toFixed(0)}%`,
      opacity: Number(opacity.toFixed(GRADIENT_OPACITY_PRECISION)),
    };
  });

interface SkeletonBarGeometry {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly key: string;
}

// Static bar layout in inner coordinates (bklit SkeletonBars, bottom baseline).
const layoutSkeletonBars = (
  heights: readonly number[],
  innerWidth: number,
  innerHeight: number,
): SkeletonBarGeometry[] => {
  const bandWidth = innerWidth / heights.length;
  const barWidth = bandWidth * BAR_SKELETON_FRACTION;
  const xOffset = (bandWidth * (1 - BAR_SKELETON_FRACTION)) / 2;
  return heights.map((value, index) => {
    const barHeight = Math.max(1, (innerHeight * value) / PERCENT_SCALE);
    const x = index * bandWidth + xOffset;
    return {
      height: barHeight,
      key: `${x.toFixed(2)}-${value}`,
      width: barWidth,
      x,
      y: innerHeight - barHeight,
    };
  });
};

interface SweepDefsParams {
  readonly gradientId: string;
  readonly patternId: string;
  readonly maskId: string;
  readonly stops: readonly EasedGradientStop[];
  readonly sweepX: number;
  readonly innerWidth: number;
  readonly innerHeight: number;
}

// Mask defs subtree (bklit LoadingSweepMask; rect x is the rAF loop state).
const renderSweepDefs = ({
  gradientId,
  patternId,
  maskId,
  stops,
  sweepX,
  innerWidth,
  innerHeight,
}: Readonly<SweepDefsParams>): ReactElement => (
  <defs>
    <linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="0">
      {stops.map((stop) => (
        <stop
          key={stop.offset}
          offset={stop.offset}
          stopColor="white"
          stopOpacity={stop.opacity}
        />
      ))}
    </linearGradient>
    <pattern
      height="1"
      id={patternId}
      patternContentUnits="objectBoundingBox"
      patternTransform={`rotate(${BAR_SWEEP_ANGLE_DEG})`}
      patternUnits="objectBoundingBox"
      width={BAR_SWEEP_PATTERN_TILE_WIDTH}
      x="0"
      y="0"
    >
      <rect fill={`url(#${gradientId})`} height="1" width="1" x={sweepX} y="0" />
    </pattern>
    <mask id={maskId} maskUnits="userSpaceOnUse">
      <rect
        fill={`url(#${patternId})`}
        height={innerHeight}
        width={innerWidth}
      />
    </mask>
  </defs>
);

interface SkeletonBarsParams {
  readonly bars: readonly SkeletonBarGeometry[];
  readonly fill: string;
  readonly fillOpacity: number;
}

const renderSkeletonBars = ({
  bars,
  fill,
  fillOpacity,
}: Readonly<SkeletonBarsParams>): ReactElement => (
  <>
    {bars.map((bar) => (
      <rect
        fill={fill}
        fillOpacity={fillOpacity}
        height={bar.height}
        key={bar.key}
        rx={BAR_SKELETON_CORNER_RADIUS}
        width={bar.width}
        x={bar.x}
        y={bar.y}
      />
    ))}
  </>
);

interface SweepClock {
  readonly sweepX: number;
  readonly tick: number;
}

// Linear x loop over BAR_SWEEP_DURATION_S; re-rolls past BAR_SWEEP_REROLL_X.
const useSweepClock = (staticFrame: boolean): SweepClock => {
  const [sweepX, setSweepX] = useState(BAR_SWEEP_START_X);
  const [tick, setTick] = useState(0);
  const lastXRef = useRef(BAR_SWEEP_START_X);
  useEffect((): (() => void) | undefined => {
    if (staticFrame) {
      lastXRef.current = BAR_SWEEP_START_X;
      return undefined;
    }
    let frame = 0;
    let cancelled = false;
    const loopMs = BAR_SWEEP_DURATION_S * MS_PER_SECOND;
    const travel = BAR_SWEEP_END_X - BAR_SWEEP_START_X;
    const startMs = performance.now();
    const step = (nowMs: number): void => {
      if (cancelled) {
        return;
      }
      const elapsedMs = (nowMs - startMs) % loopMs;
      const x = BAR_SWEEP_START_X + (travel * elapsedMs) / loopMs;
      if (x >= BAR_SWEEP_REROLL_X && lastXRef.current < BAR_SWEEP_REROLL_X) {
        setTick((prev) => prev + 1);
      }
      lastXRef.current = x;
      setSweepX(x);
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return (): void => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [staticFrame]);
  return { sweepX, tick };
};

const BarLoadingSweep = ({
  innerWidth,
  innerHeight,
  barCount = DEFAULT_BAR_SKELETON_COUNT,
  fill = DEFAULT_BAR_SKELETON_FILL,
  fillOpacity = DEFAULT_BAR_SKELETON_FILL_OPACITY,
  pulsePaused = false,
}: Readonly<BarLoadingSweepProps>): ReactElement | null => {
  const sanitizedId = useSanitizedId();
  const chartId = `bar-sweep-${sanitizedId}`;
  const reduceMotion = usePrefersReducedMotion();
  // Frozen frame covers reduced motion and the migrated-only pause input.
  const staticFrame = reduceMotion || pulsePaused;
  const { sweepX, tick } = useSweepClock(staticFrame);

  const heights = useMemo(
    () => loadingSkeletonBarHeights(barCount, tick),
    [barCount, tick],
  );
  const bars = useMemo(
    () => layoutSkeletonBars(heights, innerWidth, innerHeight),
    [heights, innerWidth, innerHeight],
  );
  const stops = useMemo(() => generateEasedGradientStops(), []);

  if (innerWidth <= 0 || innerHeight <= 0 || bars.length === 0) {
    return null;
  }

  const barNodes = renderSkeletonBars({ bars, fill, fillOpacity });

  if (staticFrame) {
    return barNodes;
  }

  const gradientId = `${chartId}-grad`;
  const patternId = `${chartId}-pattern`;
  const maskId = `${chartId}-mask`;
  return (
    <>
      {renderSweepDefs({
        gradientId,
        innerHeight,
        innerWidth,
        maskId,
        patternId,
        stops,
        sweepX,
      })}
      <g mask={`url(#${maskId})`}>{barNodes}</g>
    </>
  );
};

export { BarLoadingSweep };
export type { BarLoadingSweepProps };
