"use client";

// Turnkey bar loading skeleton (static hashed bars under the sweep mask).
// Standalone measured SVG: BarChart reveal, domain, and hover stay out.
import { useMemo, useRef } from "react";
import type { CSSProperties, ReactElement } from "react";
import { BarLoadingSweep } from "./internal/bar-loading-sweep";
import { parseAspectRatio } from "./internal/parse-aspect-ratio";
import { DEFAULT_CHART_MARGIN, useChartMargin } from "./internal/use-chart-margin";
import type { ChartMargin } from "./internal/use-chart-margin";
import { useContainerWidth } from "./internal/use-container-size";

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
  /** Freeze the mask at its initial phase (migrated-only QA determinism). */
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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const width = useContainerWidth(containerRef);
  const rootStyle = useMemo(
    (): CSSProperties => ({
      aspectRatio,
      position: "relative",
      width: "100%",
    }),
    [aspectRatio],
  );
  if (width <= 0) {
    return <div ref={containerRef} className={className} style={rootStyle} />;
  }
  const heightPx = width / parseAspectRatio(aspectRatio);
  const innerWidth = Math.max(0, width - margin.left - margin.right);
  const innerHeight = Math.max(0, heightPx - margin.top - margin.bottom);
  return (
    <div ref={containerRef} className={className} style={rootStyle}>
      <svg
        aria-hidden="true"
        className="overflow-visible"
        height={heightPx}
        width={width}
      >
        <g transform={`translate(${margin.left},${margin.top})`}>
          <BarLoadingSweep
            barCount={barCount}
            fill={fill}
            innerHeight={innerHeight}
            innerWidth={innerWidth}
            pulsePaused={pulsePaused}
          />
        </g>
      </svg>
    </div>
  );
};

BarChartLoading.displayName = "BarChartLoading";

export { BarChartLoading };
export type { BarChartLoadingProps };
