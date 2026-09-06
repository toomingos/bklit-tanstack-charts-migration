// Legacy loading names over placeholder definitions (V3.9, sweep restored).

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import type { CurveFactory } from "d3-shape";
import { reconcileChartSvgFragment } from "@tanstack/charts/reconcile";
import { ChartHost, HOST_INITIAL_WIDTH } from "./chart-host";
import { chartCssVars, useChartStable } from "./chart-context";
import { LINE_LOADING_LOOP_PAUSE_MS } from "./design-tokens";
import { buildLoadingLinePath, projectLoadingLinePoints } from "./line-loading-sweep";
import { PULSE_CLIP_PADDING, PULSE_HALF_PROGRESS, pulseClipWindow, pulseEnterSegments, pulseExitSegments, pulseLoopProgressAt, pulseLoopSegments } from "./line-loading-pulse-window";
import type { PulseClipSegment, PulseClipWindow } from "./line-loading-pulse-window";
import { fadeGradientStops, resolveFadeSides, viewportFadeGradientAttrs } from "./fade-mask";
import { chartMotionRenderer } from "./motion-renderer";
import { LoadingSweepResources, loadingSweepMaskStyle } from "./resource-host";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";
import { useSanitizedId } from "./use-sanitized-id";
import {
  buildAreaLoadingDefinition,
  buildBarLoadingDefinition,
  buildLineLoadingDefinition,
} from "./loading-definitions";
import type {
  BarPlaceholderDatum,
  LinePlaceholderDatum,
} from "./loading-definitions";
import { cn } from "./cn";

// Handoff delay for one-shot exit/enter modes (legacy label-exit duration).
const LOADING_HANDOFF_S = 0.45;
const MS_PER_SECOND = 1000;
const DEFAULT_SWEEP_DURATION_S = 2;
const DEFAULT_POINT_COUNT = 14;
const DEFAULT_BAR_COUNT = 12;
const DEFAULT_BAR_FILL = "var(--foreground)";
const DEFAULT_BAR_FILL_OPACITY = 0.45;
const LINE_STROKE_OPACITY = 0.55;
const DEFAULT_BAR_FRACTION = 0.7;
const LOADING_ASPECT_RATIO = 2;

const PLACEHOLDER_ROOT_STYLE: CSSProperties = { position: "relative", width: "100%" };

// One-shot exit and enter handoff without motion.
const useLoadingHandoff = (isLoop: boolean, onTransitionComplete?: () => void): void => {
  useEffect((): (() => void) | undefined => {
    if (isLoop || onTransitionComplete === undefined) {
      return undefined;
    }
    const timer = setTimeout(onTransitionComplete, LOADING_HANDOFF_S * MS_PER_SECOND);
    return (): void => {
      clearTimeout(timer);
    };
  }, [isLoop, onTransitionComplete]);
};

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

// Placeholder line/area silhouette under the traveling sweep mask.
const LineLoadingSweep = ({
  curve,
  withArea = false,
  mode = "loop",
  onTransitionComplete,
  stroke = chartCssVars.foreground,
  strokeOpacity = LINE_STROKE_OPACITY,
  strokeWidth = 2,
  pointCount = DEFAULT_POINT_COUNT,
  durationSeconds = DEFAULT_SWEEP_DURATION_S,
}: LineLoadingSweepProps): ReactElement | null => {
  void durationSeconds;
  const reduceMotion = usePrefersReducedMotion();
  const idPrefix = useSanitizedId();
  const isLoop = mode === "loop";
  useLoadingHandoff(isLoop, onTransitionComplete);
  const [tick, setTick] = useState(0);
  const handleSweepIteration = useCallback((): void => {
    setTick((prev) => prev + 1);
  }, []);
  const definition = useMemo(
    () =>
      withArea
        ? buildAreaLoadingDefinition({
            curve,
            pointCount,
            seed: tick,
            stroke,
            strokeOpacity,
            strokeWidth,
            washColor: stroke,
          })
        : buildLineLoadingDefinition({
            curve,
            pointCount,
            seed: tick,
            stroke,
            strokeOpacity,
            strokeWidth,
          }),
    [curve, pointCount, stroke, strokeOpacity, strokeWidth, tick, withArea],
  );
  const renderer = useMemo(
    () => chartMotionRenderer<LinePlaceholderDatum, number, number>(),
    [],
  );
  const resources = useMemo((): ReactNode => {
    if (reduceMotion) {
      return undefined;
    }
    return <LoadingSweepResources idPrefix={idPrefix} onSweepIteration={handleSweepIteration} />;
  }, [handleSweepIteration, idPrefix, reduceMotion]);
  const maskStyle = useMemo((): CSSProperties | undefined => {
    if (reduceMotion) {
      return undefined;
    }
    return loadingSweepMaskStyle(idPrefix);
  }, [idPrefix, reduceMotion]);
  return (
    <div data-slot="chart" style={PLACEHOLDER_ROOT_STYLE}>
      <div style={maskStyle}>
        <ChartHost
          ariaLabel="Loading chart"
          aspectRatio={LOADING_ASPECT_RATIO}
          definition={definition}
          idPrefix={idPrefix}
          initialWidth={HOST_INITIAL_WIDTH}
          renderer={renderer}
          resources={resources}
        />
      </div>
    </div>
  );
};

LineLoadingSweep.displayName = "LineLoadingSweep";

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

// Skeleton bars from the deterministic heights under the sweep mask.
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
  void durationSeconds;
  const reduceMotion = usePrefersReducedMotion();
  const idPrefix = useSanitizedId();
  const [tick, setTick] = useState(0);
  const handleSweepIteration = useCallback((): void => {
    setTick((prev) => prev + 1);
  }, []);
  const definition = useMemo(
    () =>
      buildBarLoadingDefinition({
        barCount,
        barFraction,
        baseline,
        fill,
        fillOpacity,
        seed: tick,
      }),
    [barCount, barFraction, baseline, fill, fillOpacity, tick],
  );
  const renderer = useMemo(() => chartMotionRenderer<BarPlaceholderDatum, number, number>(), []);
  const resources = useMemo((): ReactNode => {
    if (reduceMotion) {
      return undefined;
    }
    return <LoadingSweepResources idPrefix={idPrefix} onSweepIteration={handleSweepIteration} />;
  }, [handleSweepIteration, idPrefix, reduceMotion]);
  const maskStyle = useMemo((): CSSProperties | undefined => {
    if (reduceMotion) {
      return undefined;
    }
    return loadingSweepMaskStyle(idPrefix);
  }, [idPrefix, reduceMotion]);
  return (
    <div data-slot="chart" style={PLACEHOLDER_ROOT_STYLE}>
      <div style={maskStyle}>
        <ChartHost
          ariaLabel="Loading chart"
          definition={definition}
          height={Math.max(0, innerHeight)}
          idPrefix={idPrefix}
          initialWidth={HOST_INITIAL_WIDTH}
          renderer={renderer}
          resources={resources}
          width={Math.max(0, innerWidth)}
        />
      </div>
    </div>
  );
};

BarLoadingSkeleton.displayName = "BarLoadingSkeleton";

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

// Key for the single tweened rect inside the pulse clip window.
const PULSE_WINDOW_KEY = "line-loading-pulse";

// Overlay geometry: turnkey root is `position: relative`.
// Chart box plus scene-dim viewBox aligns by construction.
const PULSE_OVERLAY_STYLE: CSSProperties = {
  inset: 0,
  overflow: "visible",
  pointerEvents: "none",
  position: "absolute",
};

// Tagged SVG fragment for the reconciler (interpolations are numeric only).
const html = String.raw;

// Effect-only: `exit` needs the live clock, so this must not run in render.
const resolvePulseSegments = (
  mode: LineLoadingPulseMode,
  plotWidth: number,
  leg: { index: number; startedAt: number } | null,
): readonly PulseClipSegment[] => {
  if (mode === "enter") {
    return pulseEnterSegments(plotWidth);
  }
  if (mode !== "exit") {
    return pulseLoopSegments(plotWidth);
  }
  const progress =
    leg === null
      ? PULSE_HALF_PROGRESS
      : pulseLoopProgressAt(leg.index, performance.now() - leg.startedAt);
  return pulseExitSegments(plotWidth, progress);
};

// Traveling pulse over an explicit path (bklit stroke contract with epoch).
// N2: the fragment reconciler drives each half-cycle; React owns the boundary.
const LineLoadingPulseStroke = ({
  pathD,
  mode = "loop",
  loopEpoch = 0,
  stroke = chartCssVars.foreground,
  strokeOpacity = 0.5,
  strokeWidth = 2.5,
  onCycleComplete,
}: LineLoadingPulseStrokeProps): ReactElement | null => {
  const idPrefix = useSanitizedId();
  const { chart, height: sceneHeight, width: sceneWidth } = useChartStable();
  const clipRef = useRef<SVGClipPathElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const cancelTweenRef = useRef<(() => void) | null>(null);
  const clipId = `${idPrefix}-line-loading-pulse`;
  const plotX = chart?.x ?? 0;
  const plotY = chart?.y ?? 0;
  const plotWidth = chart?.width ?? 0;
  const plotHeight = chart?.height ?? 0;
  // The running leg and its start time; `exit` resumes the pass in flight.
  // Bklit reads the same thing as `progress.get()` (`line-loading-pulse.tsx:113`).
  const legRef = useRef<{ index: number; startedAt: number } | null>(null);
  const hasPlot = plotWidth > 0 && plotHeight > 0;
  // Only the first frame's shape; the effect owns the timed segments.
  // Resolving `exit` needs a clock reading, and render must stay pure.
  const firstWindow = useMemo((): PulseClipWindow | null => {
    if (!hasPlot) {
      return null;
    }
    return pulseClipWindow(0, plotWidth);
  }, [hasPlot, plotWidth]);
  const clipTop = plotY - PULSE_CLIP_PADDING;
  const clipHeight = plotHeight + PULSE_CLIP_PADDING * 2;
  useEffect((): (() => void) | undefined => {
    const root = clipRef.current;
    if (!root || !hasPlot) {
      return undefined;
    }
    const segments = resolvePulseSegments(mode, plotWidth, legRef.current);
    let cancelled = false;
    const runSegment = (index: number): void => {
      if (cancelled) {
        return;
      }
      if (index >= segments.length) {
        onCycleComplete?.();
        return;
      }
      const segment = segments[index];
      legRef.current = { index, startedAt: performance.now() };
      cancelTweenRef.current?.();
      cancelTweenRef.current = reconcileChartSvgFragment(
        root,
        html`<clipPath><rect data-ts-key="${PULSE_WINDOW_KEY}" x="${plotX + segment.to.x}" y="${clipTop}" width="${segment.to.width}" height="${clipHeight}" /></clipPath>`,
        { duration: segment.durationMs, easing: segment.easing },
      );
      timerRef.current = window.setTimeout(() => {
        runSegment(index + 1);
      }, segment.durationMs);
    };
    runSegment(0);
    return (): void => {
      cancelled = true;
      if (timerRef.current !== null) {
        globalThis.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      cancelTweenRef.current?.();
      cancelTweenRef.current = null;
    };
  // Epoch restarts the cycle without remounting (bklit loopEpoch dep).
  }, [clipHeight, clipTop, hasPlot, loopEpoch, mode, onCycleComplete, plotWidth, plotX]);
  if (firstWindow === null || pathD === "") {
    return null;
  }
  const first = firstWindow;
  // Bklit strokes the pulse with a viewport fade gradient (`:189-208`), in
  // Plot-local coords; this overlay is scene coords, so the span shifts by x.
  const gradientId = `${idPrefix}-line-loading-pulse-fade`;
  const fadeSpan = viewportFadeGradientAttrs(plotWidth);
  return (
    <svg
      aria-hidden="true"
      height="100%"
      style={PULSE_OVERLAY_STYLE}
      viewBox={`0 0 ${sceneWidth} ${sceneHeight}`}
      width="100%"
    >
      <defs>
        <linearGradient
          gradientUnits={fadeSpan.gradientUnits}
          id={gradientId}
          x1={plotX + fadeSpan.x1}
          x2={plotX + fadeSpan.x2}
          y1={fadeSpan.y1}
          y2={fadeSpan.y2}
        >
          {fadeGradientStops(resolveFadeSides(true)).map((stop) => (
            <stop key={stop.offset} offset={stop.offset} stopColor={stroke} stopOpacity={stop.opacity} />
          ))}
        </linearGradient>
        <clipPath id={clipId} ref={clipRef}>
          <rect
            data-ts-key={PULSE_WINDOW_KEY}
            height={clipHeight}
            width={first.width}
            x={plotX + first.x}
            y={clipTop}
          />
        </clipPath>
      </defs>
      <path
        clipPath={`url(#${clipId})`}
        d={pathD}
        fill="none"
        opacity={strokeOpacity}
        stroke={`url(#${gradientId})`}
        strokeLinecap="round"
        strokeWidth={strokeWidth}
      />
    </svg>
  );
};

LineLoadingPulseStroke.displayName = "LineLoadingPulseStroke";

interface SkeletonLoadingPulseProps {
  /** Steady skeleton values shared with the placeholder definition. */
  readonly values: readonly number[];
  /** Curve matching the definition silhouette. */
  readonly curve: CurveFactory;
  readonly stroke?: string;
  readonly strokeOpacity?: number;
  readonly strokeWidth?: number;
}

// Steady-skeleton pulse for the turnkey placeholders (owns path, epoch, gap).
// Child of `ChartHost`; the extractor ignores unknown roles.
const SkeletonLoadingPulse = ({
  values,
  curve,
  stroke = chartCssVars.foreground,
  strokeOpacity = 0.5,
  strokeWidth = 2.5,
}: SkeletonLoadingPulseProps): ReactElement | null => {
  const { chart } = useChartStable();
  const [pulseEpoch, setPulseEpoch] = useState(0);
  const handleCycleComplete = useCallback((): void => {
    window.setTimeout(() => {
      setPulseEpoch((epoch) => epoch + 1);
    }, LINE_LOADING_LOOP_PAUSE_MS);
  }, []);
  const pathD = useMemo((): string => {
    if (chart === undefined || chart.width <= 0 || chart.height <= 0 || values.length < 2) {
      return "";
    }
    return buildLoadingLinePath(projectLoadingLinePoints(values, chart), curve);
  }, [chart, curve, values]);
  if (pathD === "") {
    return null;
  }
  return (
    <LineLoadingPulseStroke
      loopEpoch={pulseEpoch}
      mode="loop"
      onCycleComplete={handleCycleComplete}
      pathD={pathD}
      stroke={stroke}
      strokeOpacity={strokeOpacity}
      strokeWidth={strokeWidth}
    />
  );
};

SkeletonLoadingPulse.displayName = "SkeletonLoadingPulse";

interface ChartLoadingLabelProps {
  /** Label shown centered over the chart. */
  text?: string;
  className?: string;
  /** Animate down, fade, and blur during loading to ready handoff. */
  exiting?: boolean;
}

const LOADING_LABEL_EXIT_S = 0.45;
const LOADING_LABEL_EXIT_Y_PX = 30;
const LOADING_LABEL_EXIT_EASE = "cubic-bezier(0.85, 0, 0.15, 1)";

const SPAN_MUTED_STYLE: CSSProperties = { color: "var(--muted-foreground)" };

const ChartLoadingLabel = ({
  text = "Loading",
  className,
  exiting = false,
}: ChartLoadingLabelProps): ReactElement | null => {
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
  return (
    <output
      aria-live="polite"
      className={cn("pointer-events-none absolute inset-0 flex items-center justify-center", className)}
      data-slot="loading-label"
      style={labelStyle}
    >
      <span className="font-medium text-sm tracking-wide" style={SPAN_MUTED_STYLE}>
        {text}
      </span>
    </output>
  );
};

export { BarLoadingSkeleton, ChartLoadingLabel, LineLoadingPulseStroke, LineLoadingSweep, SkeletonLoadingPulse };
export type {
  BarLoadingSkeletonProps,
  ChartLoadingLabelProps,
  LineLoadingPulseStrokeProps,
  LineLoadingSweepProps,
  SkeletonLoadingPulseProps,
};
