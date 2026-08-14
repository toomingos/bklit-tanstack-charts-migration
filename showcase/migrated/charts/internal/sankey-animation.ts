// Sankey WAAPI reveal animation + gradient injection.
// Labels are now native SceneLabel nodes emitted by sankey-mark.ts (bklit-verbatim
// via TanStack scene) — no injected DOM labels. This file only handles the stagger reveal.

import type { SankeyGradientDatum } from "./sankey-mark";
import type { LaidOutLink } from "./sankey-layout";

export interface SankeyEnterTransition {
  type?: "spring" | "tween";
  duration?: number;
  ease?: readonly [number, number, number, number];
  bounce?: number;
  stiffness?: number;
  damping?: number;
  mass?: number;
}

const DEFAULT_EASING_CSS = "cubic-bezier(0.85, 0, 0.15, 1)";

function resolveTiming(
  transition: SankeyEnterTransition | undefined,
  animationDuration: number,
): { durationMs: number; easingCss: string } {
  if (!transition) return { durationMs: animationDuration, easingCss: DEFAULT_EASING_CSS };
  if (transition.type === "spring") {
    const durationMs = transition.duration != null ? transition.duration * 1000 : animationDuration;
    return { durationMs, easingCss: DEFAULT_EASING_CSS };
  }
  const durationMs = transition.duration != null ? transition.duration * 1000 : animationDuration;
  const easingCss = transition.ease ? `cubic-bezier(${transition.ease.join(",")})` : DEFAULT_EASING_CSS;
  return { durationMs, easingCss };
}

export function injectGradientDefs(svg: SVGSVGElement, gradients: SankeyGradientDatum[]): void {
  if (gradients.length === 0) return;

  let defs = svg.querySelector<SVGDefsElement>("defs.ts-sankey__gradients");
  if (!defs) {
    defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    defs.classList.add("ts-sankey__gradients");
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

export function injectLabelCssTransitions(svg: SVGSVGElement): void {
  if (svg.querySelector("style.ts-sankey__transitions")) return;

  const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
  style.classList.add("ts-sankey__transitions");
  style.textContent = `
    .ts-sankey__node rect { transition: opacity 0.18s ease-out; }
    .ts-sankey__links > path { transition: opacity 0.18s ease-out; }
    [data-ts-key^="sankey:nlabel:"], [data-ts-key^="sankey:vlabel:"] { transition: opacity 0.18s ease-out; }
  `;
  svg.insertBefore(style, svg.firstChild);
}

function commitAndCancel(anim: Animation): void {
  try {
    (anim as unknown as { commitStyles?: () => void }).commitStyles?.();
  } catch {}
  try {
    anim.cancel();
  } catch {}
}

export function runSankeyReveal(
  svg: SVGSVGElement,
  layout: { nodes: { x0?: number; y0?: number; x1?: number; y1?: number }[]; links: LaidOutLink[] },
  animationDuration: number,
  nodeGroups: (SVGGElement | null)[],
  linkPaths: (SVGPathElement | null)[],
  enterTransition?: SankeyEnterTransition,
): Animation[] {
  const animations: Animation[] = [];
  const totalNodes = layout.nodes.length;
  const totalLinks = layout.links.length;
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

  for (let i = 0; i < nodeGroups.length; i++) {
    const group = nodeGroups[i];
    if (!group) continue;
    const stagDelayMs = totalNodes > 0 ? (i / totalNodes) * nodeAnimDuration * 0.4 : 0;

    const rect = group.querySelector("rect");
    if (rect) {
      (rect as SVGElement).style.transformOrigin = "center";
      const anim = (rect as SVGElement).animate(
        [
          { transform: "scaleY(0)", opacity: "0" },
          { transform: "scaleY(1)", opacity: "1" },
        ],
        {
          duration: durationMs,
          delay: stagDelayMs,
          easing: easingCss,
          fill: "both",
        },
      );
      anim.onfinish = () => commitAndCancel(anim);
      animations.push(anim);
    }

    const nameLabelDelayMs = stagDelayMs + nodeAnimDuration * 0.6 * 0.3;
    const valueLabelDelayMs = nameLabelDelayMs + 60;

    const nameLabel = nameLabels.get(i) ?? null;
    if (nameLabel) {
      const anim = (nameLabel as SVGElement).animate(
        [{ opacity: "0" }, { opacity: "1" }],
        {
          duration: durationMs,
          delay: nameLabelDelayMs,
          easing: easingCss,
          fill: "both",
        },
      );
      anim.onfinish = () => commitAndCancel(anim);
      animations.push(anim);
    }

    const valueLabel = valueLabels.get(i) ?? null;
    if (valueLabel) {
      const anim = (valueLabel as SVGElement).animate(
        [{ opacity: "0" }, { opacity: "0.6" }],
        {
          duration: durationMs,
          delay: valueLabelDelayMs,
          easing: easingCss,
          fill: "both",
        },
      );
      anim.onfinish = () => commitAndCancel(anim);
      animations.push(anim);
    }
  }

  const linkStartDelay = animationDuration * 0.2;
  const linkAnimWindow = animationDuration * 0.8;

  for (let i = 0; i < linkPaths.length; i++) {
    const el = linkPaths[i];
    if (!el) continue;
    const stagDelayMs = totalLinks > 0 ? linkStartDelay + (i / totalLinks) * linkAnimWindow * 0.4 : linkStartDelay;

    let pathLen = 0;
    try {
      pathLen = el.getTotalLength();
    } catch {
      el.style.strokeDasharray = "none";
      el.style.strokeDashoffset = "0";
      continue;
    }
    if (!Number.isFinite(pathLen) || pathLen < 1) {
      el.style.strokeDasharray = "none";
      el.style.strokeDashoffset = "0";
      continue;
    }
    const dash = `${pathLen} ${pathLen}`;
    el.style.strokeDasharray = dash;
    el.style.strokeDashoffset = String(pathLen);

    const anim = el.animate(
      [{ strokeDashoffset: String(pathLen) }, { strokeDashoffset: "0" }],
      {
        duration: durationMs,
        delay: stagDelayMs,
        easing: easingCss,
        fill: "both",
      },
    );
    anim.onfinish = () => {
      el.style.strokeDashoffset = "0";
      el.style.strokeDasharray = "none";
      commitAndCancel(anim);
    };
    animations.push(anim);
  }

  return animations;
}

export function resolveSankeyRevealDurationMs(
  animationDuration: number,
  enterTransition?: SankeyEnterTransition,
): number {
  return resolveTiming(enterTransition, animationDuration).durationMs;
}
