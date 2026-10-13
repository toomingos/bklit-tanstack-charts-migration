// The host of a cartesian chart with `status="loading"` (bklit line-chart.tsx / area-chart.tsx): inert to the pointer, and a travelling grid
// shimmer when the Grid child asks for it. The pulse itself is per series (loading-css.ts); the grid look is grid-guides.ts `loadingGridProps`.
import type { CSSProperties } from "react";
import type { LoadingStyle } from "../motion/phase";
import type { ChartMargin } from "../theme";

/** Props of `LineChartLoading` and `AreaChartLoading`. */
export interface CartesianLoadingProps {
  /**
   * Space around the plot area in pixels. Missing sides use the default.
   * @default { top: 40, right: 40, bottom: 40, left: 40 }
   */
  readonly margin?: Partial<ChartMargin>;
  /**
   * Color of the traveling loading segment.
   * @default "var(--bkm-foreground)"
   */
  readonly stroke?: string;
  /**
   * Opacity of the traveling loading segment.
   * @default 0.5
   */
  readonly strokeOpacity?: number;
  /**
   * Color of the grid lines while loading. Use `color-mix` or an oklch alpha to set the opacity.
   * @default "color-mix(in oklch, var(--chart-grid) 50%, transparent)"
   */
  readonly gridStroke?: string;
  /**
   * Color of the shimmer band that travels across the grid. Use `color-mix` or an oklch alpha to set the opacity.
   * @default "color-mix(in oklch, var(--bkm-foreground) 68%, transparent)"
   */
  readonly gridShimmerStroke?: string;
  /**
   * Animate a shimmer band across the grid lines. Always off when `loadingStyle` is `"sweep"`.
   * @default true
   */
  readonly gridShimmer?: boolean;
  /** Accepted for bklit-ui compatibility. It has no effect: the shimmer band has a fixed width. */
  readonly gridShimmerLength?: number;
  /**
   * Shimmer speed multiplier; higher is faster.
   * @default 1
   */
  readonly gridShimmerSpeed?: number;
  /** Accepted for bklit-ui compatibility. It has no effect: the shimmer always loops on the same period as the line pulse. */
  readonly gridShimmerSync?: boolean;
  /**
   * Loading animation: `"pulse"` sends a bright segment along the line, `"sweep"` sweeps a soft diagonal shimmer across it.
   * @default "pulse"
   */
  readonly loadingStyle?: LoadingStyle;
  /**
   * Text shown centered over the placeholder, with a shimmer. An empty string hides it.
   * @default "Loading"
   */
  readonly label?: string;
  /**
   * CSS aspect ratio of the placeholder, as `"width / height"`.
   * @default "2 / 1"
   */
  readonly aspectRatio?: string;
  /**
   * Extra CSS class name for the placeholder container.
   * @default ""
   */
  readonly className?: string;
}

export const DEFAULT_LOADING_STROKE = "var(--bkm-foreground)";
export const DEFAULT_LOADING_GRID_STROKE = "color-mix(in oklch, var(--chart-grid) 50%, transparent)";
export const DEFAULT_LOADING_GRID_SHIMMER_STROKE = "color-mix(in oklch, var(--bkm-foreground) 68%, transparent)";
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
