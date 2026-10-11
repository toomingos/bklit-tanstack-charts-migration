import type { ChartMotionTransition } from "@tanstack/charts";
import { DEFAULT_CHART_CONFIG } from "../cartesian/chart-config";
import { TOOLTIP_MOTION } from "../theme";
import type { SpringConfig } from "../types";

export interface TooltipBoxMotionProps {
  readonly springConfig?: SpringConfig;
  readonly matchCrosshair?: boolean;
  readonly damping?: number;
  readonly boxSpringConfig?: SpringConfig;
}

const spring = ({ stiffness, damping }: SpringConfig): ChartMotionTransition => ({ ...TOOLTIP_MOTION, stiffness, damping });

/** The panel glide in bklit's priority (chart-tooltip.tsx:161-181): `boxSpringConfig`, the crosshair spring, then `damping` (chart-config-context.tsx:59-90; 0 = instant). */
export function tooltipBoxMotion(props: TooltipBoxMotionProps | undefined): ChartMotionTransition {
  if (props?.boxSpringConfig) {
    return spring(props.boxSpringConfig);
  }
  if (props?.matchCrosshair === true) {
    return spring(props.springConfig ?? DEFAULT_CHART_CONFIG.tooltipSpring);
  }
  const base = DEFAULT_CHART_CONFIG.tooltipBoxSpring;
  const damping = props?.damping ?? base.damping;
  if (damping === 0) {
    return { type: "tween", duration: 0 };
  }
  if (damping === base.damping) {
    return TOOLTIP_MOTION;
  }
  const stiffness = damping < base.damping ? base.stiffness + ((base.damping - damping) / base.damping) * 400 : base.stiffness - ((damping - base.damping) / (100 - base.damping)) * 85;
  return spring({ stiffness: Math.max(12, Math.round(stiffness)), damping });
}
