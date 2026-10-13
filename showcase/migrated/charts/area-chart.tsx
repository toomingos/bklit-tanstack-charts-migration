"use client";
// bklit AreaChart on native TanStack Charts (shares the cartesian kit with LineChart).
import { useEffect } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { CartesianChart } from "./kit/cartesian/cartesian-chart";
import type { ChartMargin } from "./kit/theme";
import type { ChartDatum, ChartPhase, ChartStatus, EnterTransition } from "./kit/types";

/** Props of {@link AreaChart}. */
interface AreaChartProps {
  /** The rows to plot. Each row is an object holding the x value under `xDataKey` and one number per series under that series' `dataKey`. */
  readonly data: ChartDatum[];
  /**
   * Key of the x value in each row. The value must be a `Date` (or something `new Date()` accepts, such as a timestamp).
   * @default "date"
   */
  readonly xDataKey?: string;
  /**
   * `"loading"` shows the loading state (skeleton area, grid shimmer, optional label) and ignores the pointer; switching to `"ready"` reveals the real data on the same chart instance.
   * @default "ready"
   */
  readonly status?: ChartStatus;
  /**
   * Duration of the entrance reveal in milliseconds. `0` skips the animation.
   * @default 1100
   */
  readonly animationDuration?: number;
  /**
   * Space around the plot area in pixels, for axis labels and the tooltip. Missing sides use the default.
   * @default { top: 40, right: 40, bottom: 40, left: 40 }
   */
  readonly margin?: Partial<ChartMargin>;
  /**
   * CSS aspect ratio of the chart (`"width / height"` or a number), applied to the container width.
   * @default "2 / 1"
   */
  readonly aspectRatio?: string;
  /** Extra CSS class name for the chart container. */
  readonly className?: string;
  /** Called with `"loading"` or `"ready"` when `status` changes (and once on mount). */
  readonly onPhaseChange?: (phase: ChartPhase) => void;
  /** The layers to draw: `Grid`, `Area`, `XAxis`, `YAxis`, `ChartTooltip` and the other chart children. */
  readonly children: ReactNode;
  /** Text shown centered over the chart, with a shimmer, while `status` is `"loading"`. Nothing is shown when it is unset or empty. */
  readonly loadingLabel?: string;
  /** Inline styles for the chart container, for example a fixed height for a brush strip. */
  readonly style?: CSSProperties;
  /** Accepted for bklit-ui compatibility. It has no effect: the entrance always uses the default reveal easing. */
  readonly animationEasing?: string;
  /**
   * Animate the y domain when the data or `status` changes instead of jumping to the new scale.
   * @default true
   */
  readonly yDomainTween?: boolean;
  /** Accepted for bklit-ui compatibility. It has no effect: the y-domain tween always lasts 500 ms. */
  readonly yDomainTweenDuration?: number;
  /** Visible x range as `[start, end]`, used for brush zoom. The chart plots only this range of `data`. */
  readonly xDomain?: [Date, Date];
  /** Length of the full dataset while `xDomain` zooms into part of it. It keeps the x spacing consistent with the unzoomed chart. */
  readonly xDomainSlotCount?: number;
  /** Accepted for bklit-ui compatibility. It has no effect. */
  readonly tweenYDomainOnXDomainChange?: boolean;
  /** Accepted for bklit-ui compatibility. It has no effect: set the entrance length with `animationDuration`. */
  readonly enterTransition?: EnterTransition;
  /** Changing this string replays the entrance animation. Do not change it when only the data changes. */
  readonly revealSignature?: string;
  /**
   * Accessible name of the chart.
   * @default "Area chart"
   */
  readonly ariaLabel?: string;
  /** Longer accessible description of the chart, exposed as `aria-description`. */
  readonly ariaDescription?: string;
}

/**
 * Time-series area chart. Compose it from children: `Grid`, one or more `Area` (or `PatternArea`), `XAxis`, `YAxis`, `ChartTooltip` and the other layers.
 * It draws the filled areas with an entrance reveal and reports hover and keyboard focus through the tooltip.
 */
const AreaChart = ({
  status = "ready",
  onPhaseChange,
  loadingLabel,
  margin,
  aspectRatio,
  className,
  ariaLabel = "Area chart",
  revealSignature = "",
  ...rest
}: Readonly<AreaChartProps>): ReactElement => {
  useEffect(() => {
    onPhaseChange?.(status === "loading" ? "loading" : "ready");
  }, [status, onPhaseChange]);
  return (
    <CartesianChart
      key={revealSignature}
      {...rest}
      status={status}
      loadingLabel={loadingLabel}
      margin={margin}
      aspectRatio={aspectRatio}
      className={className}
      ariaLabel={status === "loading" ? "Loading chart" : ariaLabel}
      defaultAriaLabel={status === "loading" ? "Loading chart" : "Area chart"}
    />
  );
};

export { AreaChart };
export type { AreaChartProps };
