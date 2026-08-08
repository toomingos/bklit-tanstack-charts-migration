// Imperative, zero-React-state, zero-framer-motion hover chrome for
// FunnelChart's segments — ports repos/bklit-ui/packages/ui/src/charts/
// funnel-chart.tsx's `HRing`/`VRing`/`HSegment`/`VSegment`/label-overlay
// hover behavior (docs/LOG.md D10, D30):
//   - per-ring hover pop: hovered segment's own rings scale up
//     (`funnelRingExtraScale`, +12% max at the innermost ring), one
//     INDEPENDENT spring per ring layer, `{stiffness: 300-ringIndex*60,
//     damping: 24-ringIndex*3}` (softer as rings go inward) — verbatim
//     `HRing`/`VRing` transition. The pop is AXIS-SPECIFIC, matching bklit
//     exactly: `HRing` animates `scaleY` ONLY (horizontal funnel — heights
//     pop, the along-funnel axis stays at 1) and `VRing` animates `scaleX`
//     ONLY (vertical funnel) — NOT a uniform `scale()`, which would also
//     stretch the ring 12% along the funnel axis into the segment gaps.
//     Non-hovered segments' rings stay at scale 1 (bklit never scales a
//     non-hovered segment's rings up OR down for "pushed out" — funnel has
//     no ring/pie-style push effect).
//   - whole-segment-graphic dim: non-hovered segments (while ANY segment is
//     hovered) fade their ring graphic to opacity 0.4, plain CSS transition
//     0.15s (bklit's `HSegment`/`VSegment` `transition={{opacity:{duration:
//     0.15}}}` — a TWEEN, not a spring, unlike the ring pops above).
//   - label-overlay dim: the SAME dimmed/hovered boolean also drives the
//     label-overlay div's own opacity, but through bklit's OTHER transition
//     kind — a spring, `{type:"spring", stiffness:300, damping:24}` (fixed,
//     NOT per-ring-index scaled) — ported as its own independent spring
//     instance per segment, separate from the ring-graphic's plain tween.
//
// --- Coordinator reuse -------------------------------------------------
// `createPieHoverCoordinator`'s contract (getHovered/requestHover/
// requestUnhover/setHovered/subscribe) is fully generic (docs/LOG.md D43 —
// ring-hover-chrome.ts already reuses it under a Ring-specific name rather
// than copy-pasting the coordinator itself, only the per-item geometry/paint
// runtime is family-specific duplication). Reused verbatim here too.
import { createSpring, type Spring } from "./spring";
import { funnelRingExtraScale, funnelRingSpringParams } from "./funnel-geometry";

export {
  createPieHoverCoordinator as createFunnelHoverCoordinator,
  type PieHoverCoordinator as FunnelHoverCoordinator,
} from "./pie-hover-chrome";

const LABEL_DIM_SPRING = { stiffness: 300, damping: 24 } as const;
export const FUNNEL_FADE_OPACITY = 0.4;
const FULL_OPACITY = "1";
const GRAPHIC_DIM_TRANSITION = "opacity 0.15s linear";

export interface FunnelSegmentHoverConfig {
  index: number;
  /** Chart orientation — selects the ring-pop axis (`scaleY` for horizontal
      funnels / `scaleX` for vertical), bklit's `HRing`/`VRing` split. */
  isHorizontal: boolean;
  /** Ring `<path>` elements for this segment, ordered outermost (0) to
      innermost (`layers-1`) — matches `computeFunnelRings`'s `ringIndex`. */
  ringEls: readonly SVGPathElement[];
  /** The div wrapping this segment's ring `<svg>` — receives the 0.15s
      opacity tween dim (bklit's `HSegment`/`VSegment` wrapper). */
  graphicEl: HTMLElement | null;
  /** The label-overlay hitbox div for this segment — receives the
      spring-driven opacity dim (bklit's per-stage `motion.div`, the hover
      trigger itself). */
  labelEl: HTMLElement | null;
}

export interface FunnelSegmentHoverRuntime {
  /** Refresh live config — call on every segment render. Does not itself
      repaint; call `paint()` after if a repaint is needed (e.g. ring count
      changed while at rest). */
  update(config: FunnelSegmentHoverConfig): void;
  /** Repaint immediately for the given hovered index. Ring/label springs
      animate toward their new targets from wherever they currently are; the
      graphic dim is a synchronous CSS-transition opacity write. */
  paint(hoveredIndex: number | null): void;
  stop(): void;
}

export function createFunnelSegmentHoverRuntime(): FunnelSegmentHoverRuntime {
  let config: FunnelSegmentHoverConfig | null = null;
  const ringSprings = new Map<number, Spring>();

  const labelSpring: Spring = createSpring(1, LABEL_DIM_SPRING.stiffness, LABEL_DIM_SPRING.damping, (v) => {
    if (config?.labelEl) config.labelEl.style.opacity = String(v);
  });

  const ensureRingSpring = (ringIndex: number, el: SVGPathElement): Spring => {
    let spring = ringSprings.get(ringIndex);
    if (!spring) {
      const { stiffness, damping } = funnelRingSpringParams(ringIndex);
      spring = createSpring(1, stiffness, damping, (v) => {
        // Axis read from live config at write time (orientation can change
        // across renders while the spring instance persists).
        el.style.transform = config?.isHorizontal ? `scaleY(${v})` : `scaleX(${v})`;
      });
      ringSprings.set(ringIndex, spring);
    }
    return spring;
  };

  return {
    update(next) {
      config = next;
      // Prune springs for ring indices that no longer exist (layers shrank).
      for (const [ringIndex, spring] of ringSprings) {
        if (ringIndex >= next.ringEls.length) {
          spring.stop();
          ringSprings.delete(ringIndex);
        }
      }
    },
    paint(hoveredIndex) {
      if (!config) return;
      const isHovered = hoveredIndex === config.index;
      const isDimmed = hoveredIndex !== null && !isHovered;

      if (config.graphicEl) {
        config.graphicEl.style.transition = GRAPHIC_DIM_TRANSITION;
        config.graphicEl.style.opacity = isDimmed ? String(FUNNEL_FADE_OPACITY) : FULL_OPACITY;
        config.graphicEl.style.zIndex = isHovered ? "10" : "1";
      }

      config.ringEls.forEach((el, ringIndex) => {
        el.style.transformOrigin = "50% 50%";
        const spring = ensureRingSpring(ringIndex, el);
        spring.set(isHovered ? funnelRingExtraScale(ringIndex, config!.ringEls.length) : 1);
      });

      labelSpring.set(isDimmed ? FUNNEL_FADE_OPACITY : 1);
    },
    stop() {
      for (const spring of ringSprings.values()) spring.stop();
      ringSprings.clear();
      labelSpring.stop();
    },
  };
}
