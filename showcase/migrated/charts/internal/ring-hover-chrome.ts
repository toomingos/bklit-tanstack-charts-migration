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
//   - NO fade: bklit's `isFaded ? 0.35 : 1` opacity is dead at runtime, like
//     the glow — see `paint()` below for the live-DOM evidence.
//   - NO glow: bklit's `showGlow && isHovered ? drop-shadow(...) : "none"`
//     is dead code at runtime — see `paint()` below for fresh empirical
//     evidence (independently re-verified for Ring; same mechanism as
//     PieSlice's D49 finding).
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
// runtime always writes opacity + filter unconditionally on every `paint()`
// call (matching bklit's own unconditional `layerOpacity`/`groupStyle.filter`
// regardless of reveal phase), but withholds writing `transform` until
// `settleAtRest()` is called — ring-chart.tsx calls it from the expand
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
export const FADE_OPACITY = 0.35;
const FULL_OPACITY = "1";
const OPACITY_TRANSITION = "opacity 0.15s ease-in-out";

export interface RingHoverConfig {
  index: number;
  trackGroupEl?: SVGGElement | null;
  progressGroupEl?: SVGGElement | null;
  showGlow: boolean;
  color: string;
  /** @deprecated legacy single-group caller — kept for backwards compat with HEAD. */
  groupEl?: SVGGElement;
}

export interface RingHoverRuntime {
  /** Refresh the live config — call on every Ring render. Does not itself
      repaint; call `paint()` after if a repaint is needed. */
  update(config: RingHoverConfig): void;
  /** Repaint immediately for the given hovered index. Opacity/filter are set
      synchronously (plain CSS transitions, not rAF-driven); the scale
      spring animates toward its new target from wherever it currently is,
      but only actually WRITES `transform` once `settleAtRest()` has been
      called at least once (see file header). */
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

function resolveEls(config: RingHoverConfig): SVGGElement[] {
  const els: SVGGElement[] = [];
  const anyCfg = config as unknown as Record<string, unknown>;
  if (config.trackGroupEl) els.push(config.trackGroupEl);
  else if (anyCfg["groupEl"]) els.push(anyCfg["groupEl"] as SVGGElement);
  if (config.progressGroupEl) els.push(config.progressGroupEl);
  return els.filter(Boolean) as SVGGElement[];
}

export function createRingHoverRuntime(): RingHoverRuntime {
  let config: RingHoverConfig | null = null;
  let started = false;
  let currentScale = 1;

  const applyTransform = () => {
    if (!config || !started) return;
    const value = `scale(${currentScale})`;
    const anyCfg = config as unknown as Record<string, unknown>;
    if (config.trackGroupEl) config.trackGroupEl.style.transform = value;
    else if (anyCfg["groupEl"]) (anyCfg["groupEl"] as SVGGElement).style.transform = value;
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
      const isFaded = hoveredIndex !== null && !isHovered;
      const isPushedOut = hoveredIndex !== null && hoveredIndex < config.index;
      const els = resolveEls(config);

      // bklit's fade is ALSO dead code at runtime: ring.tsx animates
      // `opacity: isFaded ? 0.35 : 1`, and framer DOES write it — but as the
      // SVG presentation ATTRIBUTE `opacity="0.35"`, while the same `<g>`
      // keeps framer's initial `opacity: 1` in its inline STYLE, which
      // always wins the cascade. Live-DOM dump of bklit-ring at n=4 with the
      // pointer resting on ring0's band (2026-08-01): every faded group reads
      // `opacity="0.35"` (attribute) + `style="...opacity: 1..."`, and NO
      // element inside the svg computes opacity != 1 — the fade never
      // renders, in normal hovers or otherwise. Port the OBSERVED pixels
      // (D19/D49 precedent): hold full opacity; `isFaded`/`FADE_OPACITY`
      // stay so the fade can be restored verbatim if bklit ever fixes it:
      //   `el.style.opacity = isFaded ? String(FADE_OPACITY) : FULL_OPACITY;`
      void isFaded;
      for (const el of els) {
        el.style.transition = OPACITY_TRANSITION;
        el.style.opacity = FULL_OPACITY;
      }
      // bklit's glow is DEAD CODE at runtime: ring.tsx computes `showGlow &&
      // isHovered ? drop-shadow(0 0 12px ${color}) : "none"` into the framer
      // `style` prop, but framer-motion snapshots animatable style keys
      // (filter) into MotionValues at mount and never re-reads later static
      // `style` values — verified empirically 2026-07-30/31 (Playwright
      // against bklit-ring at n=4: inline `filter` reads "none" on every
      // ring `<g>`, before hover AND during hover at 7 different pointer
      // radii and across 3 repeated hover cycles, while `transform` clearly
      // changes to the 1.03/1.02 hover-scale pop in the same samples — the
      // spring-driven `scale` motion value IS live, only `filter` is frozen)
      // — same mechanism as PieSlice's D49 finding. Port the OBSERVED
      // pixels, not the dead source intent (D19 dead-code precedent).
      // `showGlow`/`color` stay in the config so the drop-shadow can be
      // restored verbatim if bklit ever fixes it:
      //   `config.showGlow && isHovered ? drop-shadow(0 0 12px ${config.color}) : "none"`
      for (const el of els) {
        el.style.filter = "none";
      }

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
