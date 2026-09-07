// Turnkey area loading placeholder (V3.9, definition-based).
// Shimmer props stay accepted while the grid is gone with the axes.

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
import { buildAreaLoadingDefinition } from "./internal/loading-definitions";
import type { LinePlaceholderDatum } from "./internal/loading-definitions";
import { getSkeletonHeights } from "./internal/skeleton-data";
import { LoadingLabel } from "./internal/loading-label";
import type { ChartMargin } from "./internal";
import { parseAspectRatio } from "./internal/parse-aspect-ratio";

const DEFAULT_LOADING_STROKE = "var(--foreground)";
const DEFAULT_LOADING_STROKE_OPACITY = 0.5;
const SKELETON_POINT_COUNT = 7;

interface AreaChartLoadingProps {
  readonly margin?: Partial<ChartMargin>;
  stroke?: string;
  /** Accepted-but-inert: the pulse stroke is the whole-chart pulse now. */
  readonly strokeOpacity?: number;
  /** Accepted-but-inert: the grid is gone with the axes (V3.9). */
  readonly gridStroke?: string;
  /** Accepted-but-inert: see `gridStroke`. */
  readonly gridShimmerStroke?: string;
  /** Accepted-but-inert: see `gridStroke`. Default: true */
  readonly gridShimmer?: boolean;
  /** Accepted-but-inert: see `gridStroke`. */
  readonly gridShimmerLength?: number;
  /** Accepted-but-inert: see `gridStroke`. */
  readonly gridShimmerSpeed?: number;
  /** Accepted-but-inert: see `gridStroke`. */
  readonly gridShimmerSync?: boolean;
  /** Loading animation: `"pulse"` (default traveling pulse) or `"sweep"` (a
   * diagonal shimmer across the skeleton area). Default: `"pulse"`. */
  readonly loadingStyle?: "pulse" | "sweep";
  readonly label?: string;
  readonly aspectRatio?: string;
  readonly className?: string;
}

const AreaChartLoading = ({
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
}: Readonly<AreaChartLoadingProps>): ReactElement => {
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
      buildAreaLoadingDefinition(
        isSweep
          ? {
              curve: curveNatural,
              margin,
              stroke,
              strokeOpacity,
              strokeWidth: 2,
              values: sweepValues,
              washColor: stroke,
            }
          : {
              curve: curveNatural,
              margin,
              // Bklit's pulse area sets fill="transparent" with fillOpacity 0 --
              // Both the anchor series and its wash stay invisible.
              stroke: "transparent",
              strokeOpacity,
              strokeWidth: 2,
              values: pulseValues,
              washColor: "transparent",
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
      data-bkm-chart="area"
      data-slot="chart"
      style={rootStyle}
    >
      <div style={maskStyle}>
        <ChartHost
          ariaLabel="Area chart"
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
              strokeWidth={2}
              values={pulseValues}
            />
          )}
        </ChartHost>
      </div>
      <LoadingLabel text={label} />
    </div>
  );
};

export { AreaChartLoading };
export type { AreaChartLoadingProps };
