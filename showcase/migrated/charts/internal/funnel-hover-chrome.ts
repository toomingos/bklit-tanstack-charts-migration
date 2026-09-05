// Per-segment hover: axis-specific ring pop (HRing scaleY / VRing scaleX, per-ring springs),
// 0.4 graphic dim (0.15s tween) + spring-driven label dim; coordinator reused from pie.
import { createSpring } from './spring';
import type { Spring } from './spring';
import { funnelRingExtraScale, funnelRingSpringParams } from "./funnel-geometry";

const LABEL_DIM_SPRING = { damping: 24, stiffness: 300 } as const;
const FUNNEL_FADE_OPACITY = 0.4;
const FULL_OPACITY = "1";
const GRAPHIC_DIM_TRANSITION = "opacity 0.15s linear";

interface FunnelSegmentHoverConfig {
  readonly index: number;
/** Selects the ring-pop axis (HRing scaleY / VRing scaleX). */
  readonly isHorizontal: boolean;
/** Ring paths outermost-first, matching computeFunnelRings ringIndex. */
  readonly ringEls: readonly SVGPathElement[];
/** Wrapping div receiving the 0.15s opacity dim. */
  readonly graphicEl: HTMLElement | null;
/** Hitbox div receiving the spring-driven opacity dim. */
  readonly labelEl: HTMLElement | null;
}

interface FunnelSegmentHoverRuntime {
/** Refresh config; repaint via paint() if needed. */
  readonly update: (config: Readonly<FunnelSegmentHoverConfig>) => void
/** Springs animate toward new targets; graphic dim is a synchronous write. */
  readonly paint: (hoveredIndex: number | null) => void
  readonly stop: () => void
}

interface PaintFunnelGraphicParams {
  readonly graphicEl: HTMLElement | null;
  readonly isHovered: boolean;
  readonly isDimmed: boolean;
}

const paintFunnelGraphic = (params: Readonly<PaintFunnelGraphicParams>): void => {
  const { graphicEl, isHovered, isDimmed } = params;
  if (!graphicEl) {return;}
  graphicEl.style.transition = GRAPHIC_DIM_TRANSITION;
  graphicEl.style.opacity = isDimmed ? String(FUNNEL_FADE_OPACITY) : FULL_OPACITY;
  graphicEl.style.zIndex = isHovered ? "10" : "1";
};

interface PaintFunnelRingParams {
  readonly el: SVGPathElement;
  readonly ringIndex: number;
  readonly ringCount: number;
  readonly isHovered: boolean;
  readonly ensureSpring: (ringIndex: number, el: SVGPathElement) => Spring;
}

const paintFunnelRing = (params: Readonly<PaintFunnelRingParams>): void => {
  const { el, ringIndex, ringCount, isHovered, ensureSpring } = params;
  el.style.transformOrigin = "50% 50%";
  const spring = ensureSpring(ringIndex, el);
  spring.set(isHovered ? funnelRingExtraScale(ringIndex, ringCount) : 1);
};

const pruneFunnelRingSprings = (ringSprings: Map<number, Spring>, ringCount: number): void => {
  for (const [ringIndex, spring] of ringSprings) {
    if (ringIndex >= ringCount) {
      spring.stop();
      ringSprings.delete(ringIndex);
    }
  }
};

const createFunnelSegmentHoverRuntime = (): FunnelSegmentHoverRuntime => {
  let config: FunnelSegmentHoverConfig | undefined = undefined;
  const ringSprings = new Map<number, Spring>();

  const labelSpring: Spring = createSpring({ damping: LABEL_DIM_SPRING.damping, initial: 1, onUpdate: (opacity) => { if (config?.labelEl) {config.labelEl.style.opacity = String(opacity);} }, stiffness: LABEL_DIM_SPRING.stiffness });

  const ensureRingSpring = (ringIndex: number, el: SVGPathElement): Spring => {
    let spring = ringSprings.get(ringIndex);
    if (!spring) {
      const { stiffness, damping } = funnelRingSpringParams(ringIndex);
      // Orientation can change across renders; read axis at write time.
      spring = createSpring({ damping, initial: 1, onUpdate: (scaleValue) => { el.style.transform = config?.isHorizontal === true ? `scaleY(${scaleValue})` : `scaleX(${scaleValue})`; }, stiffness });
      ringSprings.set(ringIndex, spring);
    }
    return spring;
  };

  return {
    paint(hoveredIndex) {
      if (!config) {return;}
      const isHovered = hoveredIndex === config.index;
      const isDimmed = hoveredIndex !== null && !isHovered;

      paintFunnelGraphic({ graphicEl: config.graphicEl, isDimmed, isHovered });

      const ringCount = config.ringEls.length;
      for (const [ringIndex, el] of config.ringEls.entries()) {
        paintFunnelRing({ el, ensureSpring: ensureRingSpring, isHovered, ringCount, ringIndex });
      }

      labelSpring.set(isDimmed ? FUNNEL_FADE_OPACITY : 1);
    },
    stop() {
      for (const spring of ringSprings.values()) {spring.stop();}
      ringSprings.clear();
      labelSpring.stop();
    },
    update(next: Readonly<FunnelSegmentHoverConfig>) {
      config = next;
      // Prune springs for ring indices that no longer exist (layers shrank).
      pruneFunnelRingSprings(ringSprings, next.ringEls.length);
    },
  };
}

export { createPieHoverCoordinator as createFunnelHoverCoordinator } from "./hover-motion";
export type { PieHoverCoordinator as FunnelHoverCoordinator } from "./hover-motion";
export { FUNNEL_FADE_OPACITY, createFunnelSegmentHoverRuntime };
export type { FunnelSegmentHoverConfig, FunnelSegmentHoverRuntime };
