// Hover chrome for RingChart's rings — ports repos/bklit-ui/packages/ui/src/
// charts/ring.tsx's `motion.g` hover behavior (docs/LOG.md D10):
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
// --- C3 (native motion, Phase 6, D432): scale spring is now a reactive
// geometry channel, not an imperative `style.transform` writer ------------
// A CSS `transform: scale(s)` on an arc GROUP, applied around the polar
// origin (the group carries no translate of its own — the container's
// `polar()` wrapper already places the origin at the ring center), is
// pixel-identical to redrawing the same arc with `innerRadius`/`outerRadius`/
// `cornerRadius` all multiplied by `s`: an arc's geometry is entirely a
// function of (radius, angle) about that same origin, so scaling every
// radius by `s` reproduces exactly what a uniform scale transform would
// paint, corner caps included. ring-chart.tsx's track/progress marks now
// multiply their radius channels by `ringHoverScale(...)` (below, unchanged
// pure logic) and hand the *spring* to the mark's own `motion` update-phase
// transition (`HOVER_SPRING`, pie-hover-chrome.ts) — the native motion
// engine interpolates the resulting geometry itself. `createRingHoverRuntime`
// / `RingHoverRuntime` / `RingHoverConfig` (the old spring-runtime that wrote
// `style.transform` on both group elements, gated by a `started`/
// `settleAtRest()` two-writer-hazard flag against ring-chart.tsx's WAAPI
// track-entrance pop) are DELETED outright: with hover now driving `d`
// geometry instead of a `transform` on the same group the entrance pop
// animates, the two writers target different attributes and never race, so
// the whole hazard-gate machinery has nothing left to guard. `ringHoverScale`
// survives unchanged — it's the one piece of pure hover-index arithmetic
// ring-chart.tsx still needs, now called from a `radialArc` radius channel
// instead of a spring `set()` target.
export {
  createPieHoverCoordinator as createRingHoverCoordinator,
  type PieHoverCoordinator as RingHoverCoordinator,
} from "./pie-hover-chrome";

/** bklit `ring.tsx`'s hover/pushed-out scale factors (docs/LOG.md D10,
    verbatim: hovered 1.03, pushed-out 1.02, rest 1). Pure — safe to call
    from a `radialArc` radius channel on every render. */
export function ringHoverScale(isHovered: boolean, isPushedOut: boolean): number {
  if (isHovered) return 1.03;
  if (isPushedOut) return 1.02;
  return 1;
}
