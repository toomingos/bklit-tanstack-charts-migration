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
  /** Accepted: `"pulse"` and `"sweep"` render the same R10 sweep paint. */
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
  void loadingStyle;
  const reduceMotion = usePrefersReducedMotion();
  const idPrefix = useSanitizedId();
  const [tick, setTick] = useState(0);
  const handleSweepIteration = useCallback((): void => {
    setTick((prev) => prev + 1);
  }, []);
  const values = useMemo(() => getSkeletonHeights(SKELETON_POINT_COUNT, tick), [tick]);
  const definition = useMemo(
    () =>
      buildAreaLoadingDefinition({
        curve: curveNatural,
        margin,
        stroke,
        strokeOpacity,
        strokeWidth: 2,
        values,
        washColor: stroke,
      }),
    [margin, stroke, strokeOpacity, values],
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
        />
      </div>
      <LoadingLabel text={label} />
    </div>
  );
};

export { AreaChartLoading };
export type { AreaChartLoadingProps };
