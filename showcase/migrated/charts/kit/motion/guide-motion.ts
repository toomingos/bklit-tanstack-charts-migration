// Motion of the hover guides (crosshair, pill, dots), shared by every chart family that draws them.
import type { ChartMotionTransition } from "@tanstack/charts";
import { REST_PX } from "./spring-curve";
import { CROSSHAIR_SPRING } from "./springs";

/** bklit's `tooltipSpring` (300 / 30; still mid-flight at ~120ms) with motion's rest thresholds. */
export const BKLIT_GUIDE_SPRING = { type: "spring", ...CROSSHAIR_SPRING, restSpeed: REST_PX.speed, restDelta: REST_PX.delta } as const;

/** Guide motion: instant on entry (the guide appears opaque at the cursor), then `update` between points. */
export const guideMotion = (update: ChartMotionTransition) => (ctx: { phase?: string }): { transition: ChartMotionTransition } =>
  ctx.phase === "enter" ? { transition: { type: "tween", duration: 0 } } : { transition: update };
