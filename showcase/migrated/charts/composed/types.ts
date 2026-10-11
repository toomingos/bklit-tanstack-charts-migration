import type { ReactNode } from "react";
import type { ChartMargin } from "../kit/theme";
import type { ChartDatum, ChartPhase, EnterTransition } from "../kit/types";

export interface ComposedChartProps {
  readonly data: ChartDatum[];
  readonly xDataKey?: string;
  readonly animationDuration?: number;
  readonly margin?: Partial<ChartMargin>;
  readonly aspectRatio?: string;
  readonly className?: string;
  readonly onPhaseChange?: (phase: ChartPhase) => void;
  /** Target bar width in px. */
  readonly barSize?: number;
  /** Maximum bar width in px. */
  readonly maxBarSize?: number;
  /** Gap between grouped SeriesBar columns in px. */
  readonly barGap?: number;
  /** Stack SeriesBar segments in child order. */
  readonly stacked?: boolean;
  /** Vertical gap in px between stacked segments. */
  readonly stackGap?: number;
  /** Accepted for API parity; the entrance uses the native tween ease. */
  readonly animationEasing?: string;
  /** Overrides the entrance duration (seconds, like bklit); springs coerce to the default. */
  readonly enterTransition?: EnterTransition;
  /** Changing it replays the entrance. */
  readonly revealSignature?: string;
  readonly children: ReactNode;
  readonly ariaLabel?: string;
  readonly ariaDescription?: string;
}
