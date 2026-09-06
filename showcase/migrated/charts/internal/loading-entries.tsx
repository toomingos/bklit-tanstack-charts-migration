// Legacy loading names over placeholder definitions (V3.9).
// Placeholders mount through the shared host; only the root pulse animates.

"use client";

import { useEffect, useMemo } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import type { CurveFactory } from "d3-shape";
import { ChartHost, HOST_INITIAL_WIDTH } from "./chart-host";
import { chartCssVars } from "./chart-context";
import { chartMotionRenderer } from "./motion-renderer";
import { LoadingSweepGradient, loadingSweepPaint } from "./resource-host";
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

// Placeholder line/area silhouette; the sweep rides the stroke as R10 paint.
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
  const paint = reduceMotion ? stroke : loadingSweepPaint(idPrefix);
  const definition = useMemo(
    () =>
      withArea
        ? buildAreaLoadingDefinition({
            curve,
            pointCount,
            stroke: paint,
            strokeOpacity,
            strokeWidth,
            washColor: stroke,
          })
        : buildLineLoadingDefinition({
            curve,
            pointCount,
            stroke: paint,
            strokeOpacity,
            strokeWidth,
          }),
    [curve, paint, pointCount, stroke, strokeOpacity, strokeWidth, withArea],
  );
  const renderer = useMemo(
    () => chartMotionRenderer<LinePlaceholderDatum, number, number>(),
    [],
  );
  const resources = useMemo((): ReactNode => {
    if (reduceMotion) {
      return undefined;
    }
    return <LoadingSweepGradient color={stroke} idPrefix={idPrefix} />;
  }, [idPrefix, reduceMotion, stroke]);
  return (
    <div className="ts-bkm-loading-root" data-slot="chart" style={PLACEHOLDER_ROOT_STYLE}>
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

// Skeleton bars from the deterministic heights; the sweep rides `fill`.
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
  const paint = reduceMotion ? fill : loadingSweepPaint(idPrefix);
  const definition = useMemo(
    () =>
      buildBarLoadingDefinition({
        barCount,
        barFraction,
        baseline,
        fill: paint,
        fillOpacity,
      }),
    [barCount, barFraction, baseline, fillOpacity, paint],
  );
  const renderer = useMemo(() => chartMotionRenderer<BarPlaceholderDatum, number, number>(), []);
  const resources = useMemo((): ReactNode => {
    if (reduceMotion) {
      return undefined;
    }
    return <LoadingSweepGradient color={fill} idPrefix={idPrefix} />;
  }, [fill, idPrefix, reduceMotion]);
  return (
    <div className="ts-bkm-loading-root" data-slot="chart" style={PLACEHOLDER_ROOT_STYLE}>
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

// Traveling pulse replaced by the whole-chart pulse (skeleton keeps the contract).
const LineLoadingPulseStroke = ({
  pathD,
  mode = "loop",
  loopEpoch = 0,
  stroke = chartCssVars.foreground,
  strokeOpacity = 0.5,
  strokeWidth = 2.5,
  onCycleComplete,
}: LineLoadingPulseStrokeProps): ReactElement | null => {
  void pathD;
  void loopEpoch;
  const reduceMotion = usePrefersReducedMotion();
  const idPrefix = useSanitizedId();
  useLoadingHandoff(mode === "loop", onCycleComplete);
  const paint = reduceMotion ? stroke : loadingSweepPaint(idPrefix);
  const definition = useMemo(
    () =>
      buildLineLoadingDefinition({
        stroke: paint,
        strokeOpacity,
        strokeWidth,
      }),
    [paint, strokeOpacity, strokeWidth],
  );
  const renderer = useMemo(
    () => chartMotionRenderer<LinePlaceholderDatum, number, number>(),
    [],
  );
  const resources = useMemo((): ReactNode => {
    if (reduceMotion) {
      return undefined;
    }
    return <LoadingSweepGradient color={stroke} idPrefix={idPrefix} />;
  }, [idPrefix, reduceMotion, stroke]);
  return (
    <div className="ts-bkm-loading-root" data-slot="chart" style={PLACEHOLDER_ROOT_STYLE}>
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

export { BarLoadingSkeleton, ChartLoadingLabel, LineLoadingPulseStroke, LineLoadingSweep };
export type {
  BarLoadingSkeletonProps,
  ChartLoadingLabelProps,
  LineLoadingPulseStrokeProps,
  LineLoadingSweepProps,
};
