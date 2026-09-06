// Turnkey bar loading skeleton (V3.9, definition-based).
// The host owns sizing from the aspect ratio.

"use client";

import { useMemo } from "react";
import type { CSSProperties, ReactElement } from "react";
import "./styles.css";
import { BarLoadingSweep } from "./internal/bar-loading-sweep";
import { usePrefersReducedMotion } from "./internal/use-prefers-reduced-motion";
import { DEFAULT_CHART_MARGIN, useChartMargin } from "./internal/use-chart-margin";
import type { ChartMargin } from "./internal/use-chart-margin";
import { cn } from "./internal/cn";

interface BarChartLoadingProps {
  /** Chart margins. */
  readonly margin?: Partial<Readonly<ChartMargin>>;
  /** Aspect ratio as "width / height". Default: "2 / 1" */
  readonly aspectRatio?: string;
  /** Additional class name for the container. */
  readonly className?: string;
  /** Number of skeleton bars. Default: 12 */
  readonly barCount?: number;
  /** Bar fill color. Default: `var(--foreground)` */
  readonly fill?: string;
  /** Freeze the sweep: solid fill, no pulse (migrated-only QA determinism). */
  readonly pulsePaused?: boolean;
}

const BarChartLoading = ({
  margin: marginProp,
  aspectRatio = "2 / 1",
  className = "",
  barCount,
  fill,
  pulsePaused = false,
}: Readonly<BarChartLoadingProps>): ReactElement => {
  const margin = useChartMargin(marginProp, DEFAULT_CHART_MARGIN);
  const reduceMotion = usePrefersReducedMotion();
  const pulse = !reduceMotion && !pulsePaused;
  const rootStyle = useMemo(
    (): CSSProperties => ({
      aspectRatio,
      position: "relative",
      width: "100%",
    }),
    [aspectRatio],
  );
  return (
    <div
      className={cn(className, pulse ? "ts-bkm-loading-root" : undefined)}
      data-bkm-chart="bar"
      data-slot="chart"
      style={rootStyle}
    >
      <BarLoadingSweep
        barCount={barCount}
        fill={fill}
        innerHeight={0}
        innerWidth={0}
        margin={margin}
        pulsePaused={pulsePaused}
      />
    </div>
  );
};

export { BarChartLoading };
export type { BarChartLoadingProps };
