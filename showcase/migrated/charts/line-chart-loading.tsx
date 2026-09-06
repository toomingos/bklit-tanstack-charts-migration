// Turnkey line loading placeholder (V3.9, definition-based).
// Grid shimmer props stay accepted while the grid is gone with the axes.

"use client";

import { useCallback, useMemo, useState } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { curveNatural } from "d3-shape";
import "./styles.css";
import { ChartHost, HOST_INITIAL_WIDTH } from "./internal/chart-host";
import { chartMotionRenderer } from "./internal/motion-renderer";
import { LoadingSweepResources, loadingSweepMaskStyle } from "./internal/resource-host";
import { usePrefersReducedMotion } from "./internal/use-prefers-reduced-motion";
import { useSanitizedId } from "./internal/use-sanitized-id";
import { SkeletonLoadingPulse } from "./internal/loading-entries";
import { buildLineLoadingDefinition } from "./internal/loading-definitions";
import type { LinePlaceholderDatum } from "./internal/loading-definitions";
import { getSkeletonHeights } from "./internal/skeleton-data";
import { LoadingLabel } from "./internal/loading-label";
import type { LoadingStyle } from "./internal/chart-phase";
import type { Margin } from "./internal/chart-context";
import { parseAspectRatio } from "./internal/parse-aspect-ratio";

const DEFAULT_LOADING_STROKE = "var(--foreground)";
const DEFAULT_LOADING_STROKE_OPACITY = 0.5;
const SKELETON_POINT_COUNT = 7;

interface LineChartLoadingProps {
  /** Chart margins */
  margin?: Partial<Margin>;
  /** Stroke color for the animated loading segment. */
  stroke?: string;
  /** Stroke opacity for the animated loading segment. Default: 0.5 */
  strokeOpacity?: number;
  /** Accepted-but-inert: the grid is gone with the axes (V3.9). */
  gridStroke?: string;
  /** Accepted-but-inert: see `gridStroke`. */
  gridShimmerStroke?: string;
  /** Accepted-but-inert: see `gridStroke`. Default: true */
  gridShimmer?: boolean;
  /** Accepted-but-inert: see `gridStroke`. */
  gridShimmerLength?: number;
  /** Accepted-but-inert: see `gridStroke`. */
  gridShimmerSpeed?: number;
  /** Accepted-but-inert: see `gridStroke`. */
  gridShimmerSync?: boolean;
  /** Loading animation: `"pulse"` (default traveling pulse) or `"sweep"` (a
   * diagonal shimmer across the skeleton line). Default: `"pulse"`. */
  loadingStyle?: LoadingStyle;
  /** Centered label text. Default: "Loading" */
  label?: string;
  /** Aspect ratio as "width / height". Default: "2 / 1" */
  aspectRatio?: string;
  /** Additional class name for the container */
  className?: string;
}

const LineChartLoading = ({
  margin,
  stroke = DEFAULT_LOADING_STROKE,
  strokeOpacity = DEFAULT_LOADING_STROKE_OPACITY,
  gridStroke,
  gridShimmerStroke,
  gridShimmer = true,
  gridShimmerLength,
  gridShimmerSpeed,
  gridShimmerSync = false,
  loadingStyle = "pulse",
  label = "Loading",
  aspectRatio = "2 / 1",
  className = "",
}: LineChartLoadingProps): ReactElement => {
  void gridStroke;
  void gridShimmerStroke;
  void gridShimmer;
  void gridShimmerLength;
  void gridShimmerSpeed;
  void gridShimmerSync;
  // Bklit routing on `loadingStyle` (pulse default, sweep shimmer).
  const isSweep = loadingStyle === "sweep";
  const reduceMotion = usePrefersReducedMotion();
  const idPrefix = useSanitizedId();
  const [tick, setTick] = useState(0);
  const handleSweepIteration = useCallback((): void => {
    setTick((prev) => prev + 1);
  }, []);
  // Sweep re-rolls its silhouette per pass; pulse holds one steady path.
  const sweepValues = useMemo(() => getSkeletonHeights(SKELETON_POINT_COUNT, tick), [tick]);
  const pulseValues = useMemo(() => getSkeletonHeights(SKELETON_POINT_COUNT, 0), []);
  const definition = useMemo(
    () =>
      buildLineLoadingDefinition(
        isSweep
          ? {
              curve: curveNatural,
              margin,
              stroke,
              strokeOpacity,
              strokeWidth: 2.5,
              values: sweepValues,
            }
          : {
              curve: curveNatural,
              margin,
              // Invisible anchor for the overlay line (bklit transparent series).
              stroke: "transparent",
              strokeOpacity,
              strokeWidth: 2.5,
              values: pulseValues,
            },
      ),
    [isSweep, margin, pulseValues, stroke, strokeOpacity, sweepValues],
  );
  const renderer = useMemo(
    () => chartMotionRenderer<LinePlaceholderDatum, number, number>(),
    [],
  );
  const resources = useMemo((): ReactNode => {
    if (!isSweep || reduceMotion) {
      return undefined;
    }
    return <LoadingSweepResources idPrefix={idPrefix} onSweepIteration={handleSweepIteration} />;
  }, [handleSweepIteration, idPrefix, isSweep, reduceMotion]);
  const maskStyle = useMemo((): CSSProperties | undefined => {
    if (!isSweep || reduceMotion) {
      return undefined;
    }
    return loadingSweepMaskStyle(idPrefix);
  }, [idPrefix, isSweep, reduceMotion]);
  const rootStyle = useMemo(
    (): CSSProperties => ({ aspectRatio, position: "relative", width: "100%" }),
    [aspectRatio],
  );
  return (
    <div
      className={className}
      data-bkm-chart="line"
      data-slot="chart"
      style={rootStyle}
    >
      <div style={maskStyle}>
        <ChartHost
          ariaLabel="Line chart"
          aspectRatio={parseAspectRatio(aspectRatio)}
          definition={definition}
          idPrefix={idPrefix}
          initialWidth={HOST_INITIAL_WIDTH}
          renderer={renderer}
          resources={resources}
        >
          {isSweep ? undefined : (
            <SkeletonLoadingPulse
              curve={curveNatural}
              stroke={stroke}
              strokeOpacity={strokeOpacity}
              strokeWidth={2.5}
              values={pulseValues}
            />
          )}
        </ChartHost>
      </div>
      <LoadingLabel text={label} />
    </div>
  );
};

export { LineChartLoading };
export type { LineChartLoadingProps };
