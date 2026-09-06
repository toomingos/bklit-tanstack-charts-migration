// Bar skeleton as a placeholder definition (V3.9).
// Geometry mirrors legacy counts; the traveling band is deleted.

"use client";

import { useMemo } from "react";
import type { ReactElement, ReactNode } from "react";
import { ChartHost, HOST_INITIAL_WIDTH } from "./chart-host";
import { chartMotionRenderer } from "./motion-renderer";
import { LoadingSweepGradient, loadingSweepPaint } from "./resource-host";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";
import { useSanitizedId } from "./use-sanitized-id";
import { buildBarLoadingDefinition } from "./loading-definitions";
import type { BarPlaceholderDatum, LoadingDefinitionMargin } from "./loading-definitions";

// Default skeleton bar count (legacy DEFAULT_BAR_COUNT).
const DEFAULT_BAR_SKELETON_COUNT = 12;
// Default bar fill (legacy DEFAULT_FILL).
const DEFAULT_BAR_SKELETON_FILL = "var(--foreground)";
// Default bar fill opacity (legacy DEFAULT_BAR_FILL_OPACITY).
const DEFAULT_BAR_SKELETON_FILL_OPACITY = 0.45;
// Default bar width as a fraction of its band (legacy DEFAULT_BAR_FRACTION).
const DEFAULT_BAR_SKELETON_FRACTION = 0.7;
// Fallback aspect while responsive (turnkey default "2 / 1").
const BAR_SKELETON_ASPECT_RATIO = 2;

interface BarLoadingSweepProps {
  readonly innerWidth: number;
  readonly innerHeight: number;
  /** Number of skeleton bars. Default: 12 */
  readonly barCount?: number;
  /** Bar fill color. Default: `var(--foreground)` */
  readonly fill?: string;
  /** Bar fill opacity. Default: 0.45 */
  readonly fillOpacity?: number;
  /** Freeze the sweep: solid fill, no pulse (QA determinism). */
  readonly pulsePaused?: boolean;
  /** Definition margin; the plot rect insets the skeleton. */
  readonly margin?: number | LoadingDefinitionMargin;
}

const BarLoadingSweep = ({
  innerWidth,
  innerHeight,
  barCount = DEFAULT_BAR_SKELETON_COUNT,
  fill = DEFAULT_BAR_SKELETON_FILL,
  fillOpacity = DEFAULT_BAR_SKELETON_FILL_OPACITY,
  pulsePaused = false,
  margin,
}: Readonly<BarLoadingSweepProps>): ReactElement => {
  const reduceMotion = usePrefersReducedMotion();
  const idPrefix = useSanitizedId();
  // Frozen frame covers reduced motion and the pause input.
  const staticFrame = reduceMotion || pulsePaused;
  const paint = staticFrame ? fill : loadingSweepPaint(idPrefix);
  const definition = useMemo(
    () =>
      buildBarLoadingDefinition({
        barCount,
        barFraction: DEFAULT_BAR_SKELETON_FRACTION,
        fill: paint,
        fillOpacity,
        margin,
      }),
    [barCount, fillOpacity, margin, paint],
  );
  const renderer = useMemo(() => chartMotionRenderer<BarPlaceholderDatum, number, number>(), []);
  const resources = useMemo((): ReactNode => {
    if (staticFrame) {
      return undefined;
    }
    return <LoadingSweepGradient color={fill} idPrefix={idPrefix} />;
  }, [fill, idPrefix, staticFrame]);
  const fixedWidth = innerWidth > 0 ? innerWidth : undefined;
  const fixedHeight = innerHeight > 0 ? innerHeight : undefined;
  return (
    <ChartHost
      ariaLabel="Loading chart"
      aspectRatio={fixedWidth === undefined ? BAR_SKELETON_ASPECT_RATIO : undefined}
      definition={definition}
      height={fixedHeight}
      idPrefix={idPrefix}
      initialWidth={HOST_INITIAL_WIDTH}
      renderer={renderer}
      resources={resources}
      width={fixedWidth}
    />
  );
};

export { BarLoadingSweep };
export type { BarLoadingSweepProps };
