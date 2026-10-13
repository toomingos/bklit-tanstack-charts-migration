import type { ReactNode } from "react";
import type { ChartMargin } from "../kit/theme";
import type { ChartDatum, ChartPhase, EnterTransition } from "../kit/types";

export interface ComposedChartProps {
  /**
   * The rows to plot. Each row holds the x value under `xDataKey` and one number per series under that series' `dataKey`.
   */
  readonly data: ChartDatum[];
  /**
   * Key of the x value in each row. The value must be a `Date` (or something `new Date()` accepts).
   * @default "date"
   */
  readonly xDataKey?: string;
  /**
   * Duration of the entrance in milliseconds. `enterTransition.duration` overrides it.
   * @default 1100
   */
  readonly animationDuration?: number;
  /**
   * Space around the plot area in pixels. Missing sides use the default.
   * @default { top: 40, right: 40, bottom: 40, left: 40 }
   */
  readonly margin?: Partial<ChartMargin>;
  /**
   * CSS aspect ratio of the chart, as `"width / height"`.
   * @default "2 / 1"
   */
  readonly aspectRatio?: string;
  /** Extra CSS class name for the chart container. */
  readonly className?: string;
  /** Called with `"ready"` when the chart mounts. */
  readonly onPhaseChange?: (phase: ChartPhase) => void;
  /** Target `SeriesBar` width in px. When unset, bars size to the available space. */
  readonly barSize?: number;
  /** Maximum `SeriesBar` width in px. */
  readonly maxBarSize?: number;
  /**
   * Gap between the grouped `SeriesBar` columns in px.
   * @default 4
   */
  readonly barGap?: number;
  /**
   * Stack the `SeriesBar` segments in child order instead of grouping them.
   * @default false
   */
  readonly stacked?: boolean;
  /**
   * Vertical gap between stacked segments in px.
   * @default 0
   */
  readonly stackGap?: number;
  /**
   * Accepted for bklit-ui compatibility. It has no effect in bklit-tanstack-charts. The entrance always uses the default tween ease.
   */
  readonly animationEasing?: string;
  /**
   * Overrides the entrance duration (`duration` is in seconds, as in bklit-ui). Springs are treated as the default tween.
   */
  readonly enterTransition?: EnterTransition;
  /** Changing this string replays the entrance animation. */
  readonly revealSignature?: string;
  /**
   * The layers to draw: `SeriesBar`, `Line`, `Area`, `Grid`, `XAxis`, `YAxis`, `ChartTooltip` and the other chart children.
   */
  readonly children: ReactNode;
  /**
   * Accessible name of the chart.
   * @default "Composed chart"
   */
  readonly ariaLabel?: string;
  /** Longer accessible description of the chart, exposed as `aria-description`. */
  readonly ariaDescription?: string;
}
