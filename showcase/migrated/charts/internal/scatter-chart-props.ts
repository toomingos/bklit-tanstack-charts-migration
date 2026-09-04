import type { ReactNode } from "react";
import type { ChartDatum, ChartPhase } from "./types";
import type { ChartMargin } from "./use-chart-margin";
import type { EnterTransition } from "./enter-transition";

interface ScatterChartProps {
  readonly data: ChartDatum[];
  readonly xDataKey?: string;
  readonly animationDuration?: number;
  readonly margin?: Partial<ChartMargin>;
  readonly aspectRatio?: string;
  readonly className?: string;
  readonly onPhaseChange?: (phase: ChartPhase) => void;
  /** Easing for the per-point enter (spring coerced to tween). */
  readonly animationEasing?: string;
  /** Overrides the reveal timing. */
  readonly enterTransition?: EnterTransition;
  /** Replay epoch input: bumping it replays the enter reveal. */
  readonly revealSignature?: string;
  readonly children?: ReactNode;
}

export type { ScatterChartProps };
