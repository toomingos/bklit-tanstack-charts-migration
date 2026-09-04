import type { ReactNode } from "react";
import type { ChartDatum, ChartPhase } from "./types";
import type { ChartMargin } from "./use-chart-margin";
import type { EnterTransition } from "./enter-transition";

interface ScatterChartProps {
  data: ChartDatum[];
  xDataKey?: string;
  animationDuration?: number;
  margin?: Partial<ChartMargin>;
  aspectRatio?: string;
  className?: string;
  onPhaseChange?: (phase: ChartPhase) => void;
  /** Easing for the per-point enter (spring coerced to tween). */
  animationEasing?: string;
  /** Overrides the reveal timing. */
  enterTransition?: EnterTransition;
  /** Replay epoch input: bumping it replays the enter reveal. */
  revealSignature?: string;
  children?: ReactNode;
}

export type { ScatterChartProps };
