import { DEFAULT_CHART_CONFIG } from "./chart-config-context";
import type { SpringConfig } from "./chart-config-context";

const DEFAULT_TOOLTIP_BOX_DAMPING =
  DEFAULT_CHART_CONFIG.tooltipBoxSpring.damping;

// Stiffness added when the damping slider goes fully instant (0).
const TOOLTIP_BOX_STIFFEN_RANGE = 400;
// Damping slider is a 0-100 percent scale; values above default soften the spring.
const DAMPING_PERCENT_MAX = 100;
// Stiffness removed when the damping slider goes fully loose (100).
const TOOLTIP_BOX_SOFTEN_RANGE = 85;
// Floor for the resolved tooltip-box stiffness (avoids a floppy/NaN spring).
const TOOLTIP_BOX_MIN_STIFFNESS = 12;

interface TooltipBoxMotion {
  readonly animate: boolean;
  readonly springConfig: SpringConfig;
}

// Stiffness compensation for off-default damping positions; hoisted so resolveTooltipBoxMotion stays short.
const resolveTooltipBoxStiffness = (effectiveDamping: number, baseStiffness: number): number => {
  if (effectiveDamping < DEFAULT_TOOLTIP_BOX_DAMPING) {
    const stiffenRatio = (DEFAULT_TOOLTIP_BOX_DAMPING - effectiveDamping) / DEFAULT_TOOLTIP_BOX_DAMPING;
    return baseStiffness + stiffenRatio * TOOLTIP_BOX_STIFFEN_RANGE;
  }
  if (effectiveDamping > DEFAULT_TOOLTIP_BOX_DAMPING) {
    const softenRatio = (effectiveDamping - DEFAULT_TOOLTIP_BOX_DAMPING) / (DAMPING_PERCENT_MAX - DEFAULT_TOOLTIP_BOX_DAMPING);
    return baseStiffness - softenRatio * TOOLTIP_BOX_SOFTEN_RANGE;
  }
  return baseStiffness;
};

/** Maps a damping slider to the floating tooltip panel follow spring. `0` = instant.
 * @param {number | undefined} [damping] - Slider percent in [0, 100]; absent resolves to the default spring damping.
 * @returns {TooltipBoxMotion} Follow-spring config, with animation disabled when the slider is fully instant.
 */
const resolveTooltipBoxMotion = (damping?: number): TooltipBoxMotion => {
  if (damping === 0) {
    return {
      animate: false,
      springConfig: DEFAULT_CHART_CONFIG.tooltipBoxSpring,
    };
  }

  const effectiveDamping = damping ?? DEFAULT_TOOLTIP_BOX_DAMPING;
  const stiffness = resolveTooltipBoxStiffness(effectiveDamping, DEFAULT_CHART_CONFIG.tooltipBoxSpring.stiffness);
  const springConfig: SpringConfig = {
    damping: effectiveDamping,
    stiffness: Math.max(TOOLTIP_BOX_MIN_STIFFNESS, Math.round(stiffness)),
  };
  return { animate: true, springConfig };
}

export { resolveTooltipBoxMotion };
export type { TooltipBoxMotion };
