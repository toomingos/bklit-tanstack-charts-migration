// Imperative, zero-React-state, zero-framer-motion hover chrome for
// RingChart's rings — ports repos/bklit-ui/packages/ui/src/charts/ring.tsx's
// `motion.g` hover behavior (docs/LOG.md D10):
//   - hovered ring: scale 1.03; rings with index > hoveredIndex ("pushed
//     out" — bklit's `isPushedOut = hoveredIndex !== null && hoveredIndex <
//     index`, i.e. rings OUTWARD of the hovered one): scale 1.02; all
//     others (including the hovered ring's own inward neighbors): scale 1 —
//     ONE spring {stiffness:400, damping:25} on the group's `transform`
//     (bklit's single `scale` motion value, `transition={{scale:{type:
//     "spring", stiffness:400, damping:25}}}`).
//   - NO fade, NO glow (C1, states+legend): bklit's `isFaded ? 0.35 : 1`
//     opacity and `showGlow && isHovered ? drop-shadow(...) : "none"` were
//     BOTH confirmed dead at runtime — verified empirically (Playwright
//     against bklit-ring at n=4, 2026-07-30/31): every faded group's `<g>`
//     reads `opacity="0.35"` as an SVG presentation ATTRIBUTE, but framer's
//     own inline `style="...opacity: 1..."` always wins the cascade, so the
//     fade never rendered; `filter` likewise stays "none" in inline style at
//     every sampled hover state (framer snapshots animatable style keys into
//     MotionValues at mount and never re-reads later static `style` values).
//     Since neither ever painted a pixel, there is no observed behavior to
//     port forward (unlike Pie's fade, which DID render and moved to a
//     reactive `fill`-alpha channel in ring-chart.tsx's sibling, pie-chart.tsx)
//     — this file previously carried the same DOM-mutation shape as pie's
//     (unconditional `el.style.opacity`/`el.style.filter` writes in `paint()`
//     that had no visible effect) and it is deleted outright, not ported.
//
// --- Coordinator reuse ------------------------------------------------------
// `createPieHoverCoordinator`'s contract (getHovered/requestHover/
// requestUnhover/setHovered/subscribe) is fully generic — it only stores a
// `number | null` and dispatches controlled/uncontrolled the same way
// ring-context.tsx's own `setHoveredIndex` does
// (`isControlled ? onHoverChange?.(index) : setInternalHoveredIndex(index)`,
// ring-chart.tsx `RingChartCore`). Reused verbatim (re-exported under a
// Ring-specific name for call-site clarity) rather than copy-pasted.
//
// --- Two-writer hazard on `transform` (ring-specific — pie has none) -------
// Pie's slice `d` attribute is single-writer from plain JSX; its hover
// springs never touch `d` (they write `transform`/regenerate `d` for the
// "grow" effect only, and pie has no separate reveal writer of `transform`
// at all). Ring's GROUP `transform` (scale), by contrast, has TWO potential
// writers: ring-chart.tsx's WAAPI *expand* reveal animation (phase 1, scale
// 0->1) and this runtime's hover spring (phase 2, scale ~1). If the hover
// spring wrote `style.transform` from the very first render, it would race
// the WAAPI animation for control of the same CSS property for the whole
// expand-phase duration. Fixed via a `started`/`settleAtRest()` gate: this
// runtime withholds writing `transform` until `settleAtRest()` is called —
// ring-chart.tsx calls it from the expand
// WAAPI animation's `onfinish` (or synchronously, for `animate={false}` /
// once `expandComplete` is already true at mount). Until then, `transform`
// is left entirely to the WAAPI animation (which itself ends at `scale(1)`,
// matching this runtime's own resting spring value, so there is no visible
// seam at the handoff).
import { createSpring, type Spring } from "./spring";

export {
  createPieHoverCoordinator as createRingHoverCoordinator,
  type PieHoverCoordinator as RingHoverCoordinator,
} from "./pie-hover-chrome";

const HOVER_SPRING = { stiffness: 400, damping: 25 } as const;

export interface RingHoverConfig {
  index: number;
  trackGroupEl?: SVGGElement | null;
  progressGroupEl?: SVGGElement | null;
}

export interface RingHoverRuntime {
  /** Refresh the live config — call on every Ring render. Does not itself
      repaint; call `paint()` after if a repaint is needed. */
  update(config: RingHoverConfig): void;
  /** Repaint immediately for the given hovered index. The scale spring
      animates toward its new target from wherever it currently is, but only
      actually WRITES `transform` once `settleAtRest()` has been called at
      least once (see file header). */
  paint(hoveredIndex: number | null): void;
  /** Hands `transform` control to this runtime's spring — call once, from
      the expand reveal's completion (WAAPI `onfinish`, or synchronously
      when `animate` is false / already complete at mount). Idempotent. */
  settleAtRest(): void;
  stop(): void;
}

function ringHoverScale(isHovered: boolean, isPushedOut: boolean): number {
  if (isHovered) return 1.03;
  if (isPushedOut) return 1.02;
  return 1;
}

export function createRingHoverRuntime(): RingHoverRuntime {
  let config: RingHoverConfig | null = null;
  let started = false;
  let currentScale = 1;

  const applyTransform = () => {
    if (!config || !started) return;
    const value = `scale(${currentScale})`;
    if (config.trackGroupEl) config.trackGroupEl.style.transform = value;
    if (config.progressGroupEl) config.progressGroupEl.style.transform = value;
  };

  const scaleSpring: Spring = createSpring(1, HOVER_SPRING.stiffness, HOVER_SPRING.damping, (v) => {
    currentScale = v;
    applyTransform();
  });

  return {
    update(next) {
      config = next;
    },
    paint(hoveredIndex) {
      if (!config) return;
      const isHovered = hoveredIndex === config.index;
      const isPushedOut = hoveredIndex !== null && hoveredIndex < config.index;

      // Always retarget the spring, even before `started` — its `onUpdate`
      // (`applyTransform`) is a no-op DOM write until `settleAtRest()` has
      // been called, but the spring's own internal state keeps evolving so
      // there's no jump once it IS handed off (see file header).
      scaleSpring.set(ringHoverScale(isHovered, isPushedOut));
    },
    settleAtRest() {
      if (started) return;
      started = true;
      // Jump (not animate) to the CURRENT target so the handoff from the
      // WAAPI reveal (which itself ends at scale(1), the spring's own
      // initial resting value) is seamless — any hover that occurs strictly
      // AFTER this point animates normally via `paint()`'s `set()` above.
      applyTransform();
    },
    stop() {
      scaleSpring.stop();
    },
  };
}
