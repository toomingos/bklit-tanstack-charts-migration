// The host of a cartesian chart with `status="loading"` (bklit line-chart.tsx / area-chart.tsx): inert to the pointer, and a travelling grid
// shimmer when the Grid child asks for it. The pulse itself is per series (loading-css.ts); the grid look is grid-guides.ts `loadingGridProps`.
import type { CSSProperties } from "react";
import type { LoadingStyle } from "../motion/phase";
import type { ChartMargin } from "../theme";

/** The props shared by bklit's `LineChartLoading` and `AreaChartLoading`. */
export interface CartesianLoadingProps {
  /** Chart margins */
  readonly margin?: Partial<ChartMargin>;
  /** Stroke color for the animated loading segment. */
  readonly stroke?: string;
  /** Stroke opacity for the animated loading segment. Default: 0.5 */
  readonly strokeOpacity?: number;
  /** Grid line stroke (color and opacity via color-mix or oklch alpha). */
  readonly gridStroke?: string;
  /** Shimmer band stroke (color and opacity via color-mix or oklch alpha). */
  readonly gridShimmerStroke?: string;
  /** Animate a shimmer band across grid lines. Default: true */
  readonly gridShimmer?: boolean;
  /** Shimmer band width in pixels. Default: 140 */
  readonly gridShimmerLength?: number;
  /** Shimmer speed multiplier (higher = faster). Default: 1 */
  readonly gridShimmerSpeed?: number;
  /** Match shimmer loop to the loading line pulse (cycle + inter-loop pause). */
  readonly gridShimmerSync?: boolean;
  /** Loading animation: `"pulse"` (default traveling pulse) or `"sweep"`. Default: `"pulse"`. */
  readonly loadingStyle?: LoadingStyle;
  /** Centered shimmer label text. Default: "Loading" */
  readonly label?: string;
  /** Aspect ratio as "width / height". Default: "2 / 1" */
  readonly aspectRatio?: string;
  /** Additional class name for the container */
  readonly className?: string;
}

export const DEFAULT_LOADING_STROKE = "var(--foreground)";
export const DEFAULT_LOADING_GRID_STROKE = "color-mix(in oklch, var(--chart-grid) 50%, transparent)";
export const DEFAULT_LOADING_GRID_SHIMMER_STROKE = "color-mix(in oklch, var(--foreground) 68%, transparent)";
export const DEFAULT_LOADING_STROKE_OPACITY = 0.5;

/** bklit line-loading-timing.ts: 2.2s pulse cycle + 280ms pause; the shimmer loops on the same period at `shimmerSpeed` 1. */
const SHIMMER_CYCLE_S = 2.48;

interface LoadingGrid {
  readonly shimmer?: boolean;
  readonly shimmerSpeed?: number;
}

export const loadingHostAttrs = (grid: LoadingGrid | undefined): { "data-bkm-status": string; "data-bkm-loading-shimmer": string | undefined } => ({
  "data-bkm-status": "loading",
  "data-bkm-loading-shimmer": grid?.shimmer === true ? "" : undefined,
});

export const loadingHostStyle = (style: CSSProperties | undefined, grid: LoadingGrid | undefined): CSSProperties =>
  // SAFETY: a CSS custom property is not in CSSProperties; the key is a plain custom-property name.
  ({
    ...style,
    pointerEvents: "none",
    "--bkm-loading-shimmer-duration": `${SHIMMER_CYCLE_S / Math.max(0.1, grid?.shimmerSpeed ?? 1)}s`,
  }) as CSSProperties;
