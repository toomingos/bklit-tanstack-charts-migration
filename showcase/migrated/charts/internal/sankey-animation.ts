// Sankey WAAPI reveal animation + gradient/CSS injection.
//
// C5 (D3) SANCTIONED reach-in, single site (this file), excluded by name
// from the census grep guard. The native `motion()` renderer (C5, D432) —
// now driving every other entrance/hover transition on this chart via
// `chartMotionRenderer()` (sankey-chart.tsx) and per-mark `motion` cascades
// (internal/sankey-mark.ts) — cannot express this reveal for two independent
// reasons, confirmed by direct dist read this migration:
//   1. Link draw-on (stroke-dasharray/stroke-dashoffset keyframes below) is
//      not in native motion's `motionAttributes` allowlist (dist/motion.js:
//      1315-1336 lists opacity/fill-opacity/stroke-opacity/fill/stroke/
//      transform-ish geometry — no dasharray/dashoffset entry) — no native
//      `motion` timing, tween or spring, could ever animate it.
//   2. The node rect's `scaleY(0)→scaleY(1)` pop (plus the per-label slide-
//      while-fade below) is a bespoke multi-property, per-element-role,
//      staggered choreography with cross-element delay math (name label
//      waits on its own rect's delay, value label waits on its name label's)
//      — `ChartMotionTiming.delay`/`transition` are per-datum, not
//      per-role-relative-to-a-sibling-role, so this shape has no native
//      expression either. (Decision: kept unmigrated as part of this same
//      reach-in rather than half-migrating one node property and leaving the
//      rest WAAPI-driven, which would double-animate against native
//      `motion`.) `internal/sankey-mark.ts` suppresses native motion at
//      three levels (host `sankeyDiagram`, `link()` mark, custom body mark)
//      specifically so this reach-in never races the renderer.
// Every mark-role this reach-in animates (node rect, name/value label, link
// path) is suppressed at its own native-motion site for that reason. Ported
// byte-for-byte from the pre-C5 handleRender reveal block: same keyframes,
// same stagger math, same deadline/cancel contract — only the DOM-query
// surface changed (self-queries off `svg` now, via `surface.element as
// SVGSVGElement`, instead of caller-populated element-ref arrays sourced
// from the old populateNodeElements/populateLinkElements, retired with the
// D4 hover rewrite).
//
// Reveal design invariants (the reliability contract):
//  1. Every keyframe track ENDS at the element's natural resting state
//     (links: dashoffset 0, rects: no transform / opacity 1, labels:
//     opacity 1 — the value label's 0.6 dim lives in its scene fillOpacity).
//     A finished or cancelled animation therefore always settles the chart
//     correctly — no commitStyles, no persisted inline styles for the SVG
//     reconciler to strip. Link dash lives ONLY inside the WAAPI keyframes,
//     in units normalized by pathLength="1" — the resting scene markup
//     carries no stroke-dasharray, and the dash tracks the path's real
//     length on every frame, so no geometry change (resize, font reflow)
//     can ever leave a gap, mid-reveal or after. styles.css forces
//     vector-effect:none on .bkm-sankey__link (CSS beats the renderer's
//     hardcoded non-scaling-stroke attribute): with non-scaling-stroke,
//     Chromium computes dash + stroke width in device px on hiDPI — the
//     dash covers only 1/dPR of the path (the "black rectangle" tail)
//     and strokes paint thin. (D2: `.ts-sankey__link` → `.bkm-sankey__link`
//     rename in styles.css is a shared file outside this executor's scope —
//     reported separately.)
//  2. The pre-paint hide uses the shared `.ts-chart__marks--revealing`
//     class (styles.css), added synchronously in onRender before the
//     browser paints; WAAPI `fill:"backwards"` takes over in the same tick
//     the class is removed (onPostPaint), so no flash either way.
//  3. One owner: `runSankeyReveal` returns a handle whose `cancel()` tears
//     down the post-paint chain, the deadline timer, the class, and every
//     animation. The component holds exactly one handle and one epoch ref.
//
// D3: the old `injectLabelCssTransitions` (unconditional `<style>` injection
// for the hover dim/undim CSS transitions — a chart-static, per-instance-
// identical stylesheet, not per-datum data) is DELETED here, not ported —
// per the coordinator's D3 correction this is a pure MOVE into styles.css,
// not a drop. The exact post-rename block (reported to the coordinator for
// pasting into styles.css) is:
//
//   .bkm-sankey__node rect { transition: opacity 0.18s ease-out; }
//   [data-ts-key="sankey:flow"] > path { transition: stroke-opacity 0.18s ease-out; }
//   [data-ts-key^="sankey:nlabel:"] { transition: opacity 0.18s ease-out; }
//   [data-ts-key^="sankey:vlabel:"] { transition: opacity 0.18s ease-out, fill-opacity 0.18s ease-out; }
//
// (Only the first selector needed the `ts-sankey__` → `bkm-sankey__` rename
// — the other three key off `data-ts-key` attributes, untouched by D2.)
//
// `buildSankeyNodeStagger`/`sankeyNodeStaggerDelays`/`SankeyNodeStagger`
// (the hover dim/undim per-node stagger payload) are also DELETED here:
// confirmed via repo-wide grep this migration that they have no remaining
// consumer — internal/sankey-mark.ts's C1 states+legend hover dim now bakes
// straight into per-datum style/channel values (a flat CSS transition, see
// the moved block above), never reads these exports.

import { onPostPaint } from "./deferred-reveal";
import { REVEAL_EASE_CSS } from "./design-tokens";
import type { SankeyGradientDatum } from "./sankey-mark";

export interface SankeyEnterTransition {
  type?: "spring" | "tween";
  duration?: number;
  ease?: readonly [number, number, number, number];
  bounce?: number;
  stiffness?: number;
  damping?: number;
  mass?: number;
}

const REVEALING_CLASS = "ts-chart__marks--revealing";
const DEADLINE_SLACK_MS = 150;

function resolveTiming(
  transition: SankeyEnterTransition | undefined,
  animationDuration: number,
): { durationMs: number; easingCss: string } {
  const durationMs = transition?.duration != null ? transition.duration * 1000 : animationDuration;
  const easingCss =
    transition?.type !== "spring" && transition?.ease
      ? `cubic-bezier(${transition.ease.join(",")})`
      : REVEAL_EASE_CSS;
  return { durationMs, easingCss };
}

export function injectGradientDefs(svg: SVGSVGElement, gradients: SankeyGradientDatum[]): void {
  if (gradients.length === 0) return;

  let defs = svg.querySelector<SVGDefsElement>("defs.bkm-sankey__gradients");
  if (!defs) {
    defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    defs.classList.add("bkm-sankey__gradients");
    svg.insertBefore(defs, svg.firstChild);
  }

  const htmlFrag = gradients
    .map(
      (g) =>
        `<linearGradient id="${g.id}" gradientUnits="userSpaceOnUse" x1="${g.x1}" y1="0" x2="${g.x2}" y2="0">` +
        `<stop offset="0%" stop-color="${g.sourceColor}" stop-opacity="1"/>` +
        `<stop offset="100%" stop-color="${g.targetColor}" stop-opacity="1"/>` +
        `</linearGradient>`,
    )
    .join("");

  defs.innerHTML = htmlFrag;
}

// D4: sankey's node/link elements are no longer cached by the component (the
// old populateNodeElements/populateLinkElements ref-population, retired
// alongside attachSankeyHoverListeners) — this reach-in queries them itself,
// off the render context's `surface.element as SVGSVGElement`, the same
// self-query pattern `runSankeyReveal` below already used for label elements.
function queryNodeGroups(svg: SVGSVGElement): (SVGGElement | null)[] {
  return Array.from(svg.querySelectorAll<SVGGElement>(`[data-ts-key^="sankey:node:"]`));
}

// T-D13: links render through the native link() child mark (id "flow"),
// whose composited layer group has the stable key "sankey:flow". Paths
// follow in data order inside that group.
function queryLinkPaths(svg: SVGSVGElement): (SVGPathElement | null)[] {
  const flowGroup = svg.querySelector<SVGGElement>(`[data-ts-key="sankey:flow"]`);
  return flowGroup ? Array.from(flowGroup.querySelectorAll<SVGPathElement>("path")) : [];
}

// Normalizes every link path to pathLength="1" so the reveal's dash keyframes
// ("1 1", offset 1→0) are length-independent. Re-stamped on every onRender:
// the reconciler strips attributes absent from scene markup, but onRender runs
// in the same task before the next paint, so the strip is never visible.
// pathLength alone (without a dasharray) has no visual effect at rest.
export function stampSankeyLinkPathLength(svg: SVGSVGElement): void {
  for (const el of queryLinkPaths(svg)) {
    el?.setAttribute("pathLength", "1");
  }
}

export interface SankeyRevealHandle {
  cancel(): void;
}

export interface SankeyRevealConfig {
  svg: SVGSVGElement;
  animationDuration: number;
  enterTransition?: SankeyEnterTransition;
}

export function runSankeyReveal(config: SankeyRevealConfig): SankeyRevealHandle {
  const { svg, animationDuration, enterTransition } = config;
  const nodeGroups = queryNodeGroups(svg);
  const linkPaths = queryLinkPaths(svg);
  const marksGroup = svg.querySelector(".ts-chart__marks");

  const animations: Animation[] = [];
  let deadlineTimer: number | null = null;
  let cancelPostPaint: (() => void) | null = null;

  const clearDeadline = () => {
    if (deadlineTimer !== null) {
      window.clearTimeout(deadlineTimer);
      deadlineTimer = null;
    }
  };

  const cancel = () => {
    if (cancelPostPaint) {
      cancelPostPaint();
      cancelPostPaint = null;
    }
    clearDeadline();
    for (const anim of animations) {
      try {
        anim.cancel();
      } catch {
        // teardown race — already cancelled / detached DOM
      }
    }
    animations.length = 0;
    marksGroup?.classList.remove(REVEALING_CLASS);
  };

  // Synchronous with the render commit → the first painted frame is already
  // hidden; no flash of the fully-drawn chart before the reveal starts.
  marksGroup?.classList.add(REVEALING_CLASS);

  cancelPostPaint = onPostPaint(() => {
    cancelPostPaint = null;

    const totalNodes = nodeGroups.length;
    const totalLinks = linkPaths.length;
    const nodeAnimDuration = animationDuration * 0.6;
    const { durationMs, easingCss } = resolveTiming(enterTransition, animationDuration);

    const nameLabels = new Map<number, SVGElement>();
    const valueLabels = new Map<number, SVGElement>();
    for (const el of svg.querySelectorAll<SVGElement>(`[data-ts-key^="sankey:nlabel:"]`)) {
      const idx = Number(el.getAttribute("data-ts-key")?.split(":").pop());
      if (!Number.isNaN(idx)) nameLabels.set(idx, el);
    }
    for (const el of svg.querySelectorAll<SVGElement>(`[data-ts-key^="sankey:vlabel:"]`)) {
      const idx = Number(el.getAttribute("data-ts-key")?.split(":").pop());
      if (!Number.isNaN(idx)) valueLabels.set(idx, el);
    }

    // The single source of the deadline: the max delay actually issued,
    // tracked in the same loops that create the animations.
    let maxDelayMs = 0;
    const animate = (el: SVGElement, keyframes: Keyframe[], delayMs: number): void => {
      if (delayMs > maxDelayMs) maxDelayMs = delayMs;
      animations.push(
        el.animate(keyframes, {
          duration: durationMs,
          delay: delayMs,
          easing: easingCss,
          fill: "backwards",
        }),
      );
    };

    for (let i = 0; i < nodeGroups.length; i++) {
      const group = nodeGroups[i];
      if (!group) continue;
      const stagDelayMs = totalNodes > 0 ? (i / totalNodes) * nodeAnimDuration * 0.4 : 0;

      const rect = group.querySelector("rect") as SVGElement | null;
      if (rect) {
        rect.style.transformOrigin = "center";
        animate(
          rect,
          [
            { transform: "scaleY(0)", opacity: "0" },
            { transform: "scaleY(1)", opacity: "1" },
          ],
          stagDelayMs,
        );
      }

      const nameLabelDelayMs = stagDelayMs + nodeAnimDuration * 0.6 * 0.3;
      const valueLabelDelayMs = nameLabelDelayMs + 60;

      // bklit's NodeLabel enters sliding toward its final spot while fading:
      // motion.g x animates initialX (node-edge inset x±8) → labelX (x∓12),
      // a 20px outward slide. Screen-space via the individual `translate`
      // property composes OVER the renderer's rotate() attribute (a transform
      // presentation attribute), reproducing the unrotated-g offset. Final
      // keyframe is the resting state (no translate residue).
      const resolveSlidePx = (el: SVGElement): number => {
        const anchor = el.getAttribute("text-anchor");
        if (anchor === "end") return 20; // left-side: starts toward node, slides out left
        if (anchor === "start") return -20; // right-side: starts toward node, slides out right
        // Rotated labels are middle-anchored; legacy slides them by the same
        // ±20px horizontal delta (initialX vs labelX by node side).
        const halfWidth = (svg.viewBox.baseVal.width || svg.clientWidth) / 2;
        const x = parseFloat(el.getAttribute("x") ?? "0");
        return x >= halfWidth ? -20 : 20;
      };

      const nameLabel = nameLabels.get(i);
      if (nameLabel) {
        const dx = resolveSlidePx(nameLabel);
        animate(
          nameLabel,
          [
            { opacity: "0", translate: `${dx}px 0px` },
            { opacity: "1", translate: "0px 0px" },
          ],
          nameLabelDelayMs,
        );
      }

      // The value label's resting 0.6 dim is its scene fillOpacity — the
      // reveal only fades opacity 0→1 (visually 0→0.6, bklit-identical).
      const valueLabel = valueLabels.get(i);
      if (valueLabel) {
        const dx = resolveSlidePx(valueLabel);
        animate(
          valueLabel,
          [
            { opacity: "0", translate: `${dx}px 0px` },
            { opacity: "1", translate: "0px 0px" },
          ],
          valueLabelDelayMs,
        );
      }
    }

    const linkStartDelay = animationDuration * 0.2;
    const linkAnimWindow = animationDuration * 0.8;

    for (let i = 0; i < linkPaths.length; i++) {
      const el = linkPaths[i];
      if (!el) continue;
      const stagDelayMs = totalLinks > 0 ? linkStartDelay + (i / totalLinks) * linkAnimWindow * 0.4 : linkStartDelay;

      // Normalized units against pathLength="1" (stamped every render by
      // stampSankeyLinkPathLength) — the browser rescales the dash to the
      // path's real length on every frame, so the reveal stays correct even
      // when the path geometry changes mid-flight (resize, font reflow).
      animate(
        el,
        [
          { strokeDasharray: "1 1", strokeDashoffset: "1" },
          { strokeDasharray: "1 1", strokeDashoffset: "0" },
        ],
        stagDelayMs,
      );
    }

    marksGroup?.classList.remove(REVEALING_CLASS);

    if (animations.length === 0) return;

    // Safety net for throttled/hidden tabs; cleared early once every
    // animation settles so no timer lingers after a normal reveal.
    deadlineTimer = window.setTimeout(() => {
      deadlineTimer = null;
      for (const anim of animations) {
        try {
          anim.cancel();
        } catch {
          // teardown race — already cancelled / detached DOM
        }
      }
      animations.length = 0;
    }, durationMs + maxDelayMs + DEADLINE_SLACK_MS);

    void Promise.allSettled(animations.map((anim) => anim.finished)).then(clearDeadline);
  });

  return { cancel };
}
