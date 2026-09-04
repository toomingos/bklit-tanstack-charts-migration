/*
 * Enter is opacity-only with per-datum delay; bklit had no scale/r enter, only hover pops r.
 */
import type {
  ChartMotionContext,
  ChartMotionDefinition,
} from "@tanstack/charts";
import type { MotionEasing } from "./reveal-easing";
import type { ChartDatum } from "./types";

// Seconds<->milliseconds conversion for enter-motion delay math.
const MS_PER_SECOND = 1000;

interface ResolvedSeries {
  readonly dataKey: string;
  /** Undefined means the default ("left") axis. */
  readonly yAxisId?: string | number;
  /** Animate && !isLoaded gate (bklit series-markers.tsx:104). */
  readonly animate: boolean;
  readonly fill: string;
  readonly stroke: string;
  readonly strokeWidth: number;
  readonly ringGap: number;
  readonly radius: number;
  readonly fadeOnHover: boolean;
  readonly inactiveOpacity: number;
  readonly inactiveBlur: number;
  readonly enterBlur: number;
  readonly showActiveHighlight: boolean;
  /** Hovered-marker outline ring has no native states channel; omitted. */
  readonly outlineWidth: number;
  readonly outlineColor?: string;
  readonly useYGradient: boolean;
  readonly yGradFrom: string;
  readonly yGradTo: string;
  readonly yGradId: string | undefined;
}

interface ScatterEnterMotionParams {
  readonly easing: MotionEasing;
  readonly fadeDurationMs: number;
  readonly innerWidth: number;
  readonly staggerDurationSec: number;
  readonly visualExtent: number;
}

const createScatterEnterMotion = ({
  easing,
  fadeDurationMs,
  innerWidth,
  staggerDurationSec,
  visualExtent,
}: Readonly<ScatterEnterMotionParams>): ChartMotionDefinition<ChartDatum> => (
  ctx: Readonly<ChartMotionContext<ChartDatum>>,
) => {
  if (ctx.phase !== "enter") {return false;}
  const cx = ctx.point?.x ?? 0;
  const leadingEdge = Math.max(0, cx - visualExtent);
  const delayMs =
    innerWidth > 0 ? (leadingEdge / innerWidth) * staggerDurationSec * MS_PER_SECOND : 0;
  return {
    delay: delayMs,
    transition: { duration: fadeDurationMs, easing, type: "tween" },
  };
};

export { createScatterEnterMotion };
export type { ResolvedSeries, ScatterEnterMotionParams };
export {
  buildYGradientChannels,
  createYGradientScatterMark,
  renderYGradientScene,
  resolveProjectedDatum,
  resolveYGradientDatum,
} from "./scatter-y-gradient-mark";
export { buildYGradientNodes, buildYGradientPoint } from "./scatter-y-gradient-nodes";
export type {
  BuildYGradientChannelsParams,
  CreateYGradientScatterMarkParams,
  ProjectedDatum,
  ProjectedDatumChannels,
  RenderYGradientSceneParams,
  ResolveProjectedDatumParams,
  ResolveYGradientDatumParams,
  YGradientChannels,
  YGradientDatum,
} from "./scatter-y-gradient-mark";
export type {
  BuildYGradientNodesParams,
  BuildYGradientPointParams,
} from "./scatter-y-gradient-nodes";
