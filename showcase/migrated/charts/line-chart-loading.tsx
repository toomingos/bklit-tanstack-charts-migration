// Turnkey line loading placeholder (V3.9, definition-based).
// Grid shimmer props stay accepted while the grid is gone with the axes.

"use client";

import { useMemo } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { curveNatural } from "d3-shape";
import "./styles.css";
import { ChartHost, HOST_INITIAL_WIDTH } from "./internal/chart-host";
import { chartMotionRenderer } from "./internal/motion-renderer";
import { LoadingSweepGradient, loadingSweepPaint } from "./internal/resource-host";
import { usePrefersReducedMotion } from "./internal/use-prefers-reduced-motion";
import { useSanitizedId } from "./internal/use-sanitized-id";
import { buildLineLoadingDefinition } from "./internal/loading-definitions";
import type { LinePlaceholderDatum } from "./internal/loading-definitions";
import { getSkeletonHeights } from "./internal/skeleton-data";
import { LoadingLabel } from "./internal/loading-label";
import type { LoadingStyle } from "./internal/chart-phase";
import type { Margin } from "./internal/chart-context";
import { parseAspectRatio } from "./internal/parse-aspect-ratio";
import { cn } from "./internal/cn";

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
  /** Accepted: `"pulse"` and `"sweep"` render the same R10 sweep paint. Default: `"pulse"`. */
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
  void loadingStyle;
  const reduceMotion = usePrefersReducedMotion();
  const idPrefix = useSanitizedId();
  const values = useMemo(() => getSkeletonHeights(SKELETON_POINT_COUNT, 0), []);
  const paint = reduceMotion ? stroke : loadingSweepPaint(idPrefix);
  const definition = useMemo(
    () =>
      buildLineLoadingDefinition({
        curve: curveNatural,
        margin,
        stroke: paint,
        strokeOpacity,
        strokeWidth: 2.5,
        values,
      }),
    [margin, paint, strokeOpacity, values],
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
  const rootStyle = useMemo(
    (): CSSProperties => ({ aspectRatio, position: "relative", width: "100%" }),
    [aspectRatio],
  );
  return (
    <div
      className={cn(className, reduceMotion ? undefined : "ts-bkm-loading-root")}
      data-bkm-chart="line"
      data-slot="chart"
      style={rootStyle}
    >
      <ChartHost
        ariaLabel="Line chart"
        aspectRatio={parseAspectRatio(aspectRatio)}
        definition={definition}
        idPrefix={idPrefix}
        initialWidth={HOST_INITIAL_WIDTH}
        renderer={renderer}
        resources={resources}
      />
      <LoadingLabel text={label} />
    </div>
  );
};

export { LineChartLoading };
export type { LineChartLoadingProps };
