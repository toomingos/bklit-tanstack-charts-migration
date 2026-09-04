// Sanctioned WAAPI reach-in: dash draw-on + per-role stagger have no native motion expression.
import { onPostPaint } from "./deferred-reveal";
import { REVEAL_EASE_CSS } from "./design-tokens";
import type { SankeyGradientDatum } from "./sankey-mark";

interface SankeyEnterTransition {
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
const MS_PER_SECOND = 1000;
const SANKEY_NODE_ANIM_FRACTION = 0.6;
const SANKEY_NODE_STAGGER_FRACTION = 0.4;
const SANKEY_NAME_LABEL_WINDOW_FRACTION = 0.6;
const SANKEY_NAME_LABEL_OFFSET_FRACTION = 0.3;
const SANKEY_VALUE_LABEL_DELAY_MS = 60;
const SANKEY_LABEL_SLIDE_PX = 20;
const SANKEY_LINK_START_FRACTION = 0.2;
const SANKEY_LINK_WINDOW_FRACTION = 0.8;
const SANKEY_LINK_STAGGER_FRACTION = 0.4;

interface SankeyRevealTiming {
  readonly durationMs: number;
  readonly easingCss: string;
}

const resolveTiming = (transition: Readonly<SankeyEnterTransition> | undefined, animationDuration: number): SankeyRevealTiming => {
  const durationMs = transition?.duration === undefined ? animationDuration : transition.duration * MS_PER_SECOND;
  const easingCss =
    transition?.type !== "spring" && transition?.ease
      ? `cubic-bezier(${transition.ease.join(",")})`
      : REVEAL_EASE_CSS;
  return { durationMs, easingCss };
}

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const GRADIENT_VERTICAL_ORIGIN = "0";

const buildSankeyGradientElement = (gradient: Readonly<SankeyGradientDatum>): SVGLinearGradientElement => {
  const element = document.createElementNS(SVG_NAMESPACE, "linearGradient");
  element.setAttribute("id", gradient.id);
  element.setAttribute("gradientUnits", "userSpaceOnUse");
  element.setAttribute("x1", String(gradient.x1));
  element.setAttribute("y1", GRADIENT_VERTICAL_ORIGIN);
  element.setAttribute("x2", String(gradient.x2));
  element.setAttribute("y2", GRADIENT_VERTICAL_ORIGIN);
  const stops = [
    { color: gradient.sourceColor, offset: "0%" },
    { color: gradient.targetColor, offset: "100%" },
  ];
  for (const stop of stops) {
    const stopNode = document.createElementNS(SVG_NAMESPACE, "stop");
    stopNode.setAttribute("offset", stop.offset);
    stopNode.setAttribute("stop-color", stop.color);
    stopNode.setAttribute("stop-opacity", "1");
    element.append(stopNode);
  }
  return element;
};

const injectGradientDefs = (svg: SVGSVGElement, gradients: readonly Readonly<SankeyGradientDatum>[]): void => {
  if (gradients.length === 0) {return;}

  let defs = svg.querySelector<SVGDefsElement>("defs.bkm-sankey__gradients");
  if (!defs) {
    defs = document.createElementNS(SVG_NAMESPACE, "defs");
    defs.classList.add("bkm-sankey__gradients");
    svg.prepend(defs);
  }

  defs.replaceChildren(...gradients.map((gradient) => buildSankeyGradientElement(gradient)));
}

const queryNodeGroups = (svg: SVGSVGElement): (SVGGElement | null)[] => [...svg.querySelectorAll<SVGGElement>(`[data-ts-key^="sankey:node:"]`)];


const queryLinkPaths = (svg: SVGSVGElement): (SVGPathElement | null)[] => {
  const flowGroup = svg.querySelector<SVGGElement>(`[data-ts-key="sankey:flow"]`);
  return flowGroup ? [...flowGroup.querySelectorAll<SVGPathElement>('path')] : [];
}

// PathLength=1 normalizes dash units; re-stamped each render (reconciler strips it).
const stampSankeyLinkPathLength = (svg: SVGSVGElement): void => {
  for (const el of queryLinkPaths(svg)) {
    el?.setAttribute("pathLength", "1");
  }
}

interface SankeyRevealHandle {
  cancel: () => void
}

interface SankeyRevealConfig {
  svg: SVGSVGElement;
  animationDuration: number;
  enterTransition?: SankeyEnterTransition;
}

const runSankeyReveal = (config: SankeyRevealConfig): SankeyRevealHandle => {
  const { svg, animationDuration, enterTransition } = config;
  const nodeGroups = queryNodeGroups(svg);
  const linkPaths = queryLinkPaths(svg);
  const marksGroup = svg.querySelector(".ts-chart__marks");

  const animations: Animation[] = [];
  let deadlineTimer: ReturnType<typeof globalThis.setTimeout> | undefined = undefined;
  let cancelPostPaint: (() => void) | undefined = undefined;

  const clearDeadline = (): void => {
    if (deadlineTimer !== undefined) {
      globalThis.clearTimeout(deadlineTimer);
      deadlineTimer = undefined;
    }
  };

  const cancel = (): void => {
    if (cancelPostPaint) {
      cancelPostPaint();
      cancelPostPaint = undefined;
    }
    clearDeadline();
    for (const anim of animations) {
      try {
        anim.cancel();
      } catch {
        // Teardown race: already cancelled or detached.
      }
    }
    animations.length = 0;
    marksGroup?.classList.remove(REVEALING_CLASS);
  };

  marksGroup?.classList.add(REVEALING_CLASS);

  cancelPostPaint = onPostPaint(async () => {
    cancelPostPaint = undefined;

    const totalNodes = nodeGroups.length;
    const totalLinks = linkPaths.length;
    const nodeAnimDuration = animationDuration * SANKEY_NODE_ANIM_FRACTION;
    const { durationMs, easingCss } = resolveTiming(enterTransition, animationDuration);

    const nameLabels = new Map<number, SVGElement>();
    const valueLabels = new Map<number, SVGElement>();
    for (const el of svg.querySelectorAll<SVGElement>(`[data-ts-key^="sankey:nlabel:"]`)) {
      const idx = Number(el.dataset.tsKey?.split(":").pop());
      if (!Number.isNaN(idx)) {nameLabels.set(idx, el);}
    }
    for (const el of svg.querySelectorAll<SVGElement>(`[data-ts-key^="sankey:vlabel:"]`)) {
      const idx = Number(el.dataset.tsKey?.split(":").pop());
      if (!Number.isNaN(idx)) {valueLabels.set(idx, el);}
    }

    let maxDelayMs = 0;
    const animate = (el: SVGElement, keyframes: Keyframe[], delayMs: number): void => {
      if (delayMs > maxDelayMs) {maxDelayMs = delayMs;}
      animations.push(
        el.animate(keyframes, {
          delay: delayMs,
          duration: durationMs,
          easing: easingCss,
          fill: "backwards",
        }),
      );
    };

    for (let i = 0; i < nodeGroups.length; i += 1) {
      const group = nodeGroups[i];
      if (group) {
        const stagDelayMs = totalNodes > 0 ? (i / totalNodes) * nodeAnimDuration * SANKEY_NODE_STAGGER_FRACTION : 0;

        const rect = group.querySelector<SVGRectElement>("rect");
        if (rect) {
          rect.style.transformOrigin = "center";
          animate(
            rect,
            [
              { opacity: "0", transform: "scaleY(0)" },
              { opacity: "1", transform: "scaleY(1)" },
            ],
            stagDelayMs,
          );
        }

        const nameLabelDelayMs = stagDelayMs + nodeAnimDuration * SANKEY_NAME_LABEL_WINDOW_FRACTION * SANKEY_NAME_LABEL_OFFSET_FRACTION;
        const valueLabelDelayMs = nameLabelDelayMs + SANKEY_VALUE_LABEL_DELAY_MS;

        const resolveSlidePx = (el: SVGElement): number => {
          const anchor = el.getAttribute("text-anchor");
          if (anchor === "end") {return SANKEY_LABEL_SLIDE_PX;}
          if (anchor === "start") {return -SANKEY_LABEL_SLIDE_PX;}
          const halfWidth = (svg.viewBox.baseVal.width || svg.clientWidth) / 2;
          const x = Number(el.getAttribute("x") ?? "0");
          return x >= halfWidth ? -SANKEY_LABEL_SLIDE_PX : SANKEY_LABEL_SLIDE_PX;
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
    }

    const linkStartDelay = animationDuration * SANKEY_LINK_START_FRACTION;
    const linkAnimWindow = animationDuration * SANKEY_LINK_WINDOW_FRACTION;

    for (let i = 0; i < linkPaths.length; i += 1) {
      const el = linkPaths[i];
      if (el) {
        const stagDelayMs = totalLinks > 0 ? linkStartDelay + (i / totalLinks) * linkAnimWindow * SANKEY_LINK_STAGGER_FRACTION : linkStartDelay;

        animate(
          el,
          [
            { strokeDasharray: "1 1", strokeDashoffset: "1" },
            { strokeDasharray: "1 1", strokeDashoffset: "0" },
          ],
          stagDelayMs,
        );
      }
    }

    marksGroup?.classList.remove(REVEALING_CLASS);

    if (animations.length === 0) {return;}

    deadlineTimer = globalThis.setTimeout(() => {
      deadlineTimer = undefined;
      for (const anim of animations) {
        try {
          anim.cancel();
        } catch {
          // Teardown race: already cancelled or detached.
        }
      }
      animations.length = 0;
    }, durationMs + maxDelayMs + DEADLINE_SLACK_MS);

    // Collected imperatively rather than with `.map()`.
    // A callback returning `anim.finished` trips promise-function-async with no clean async spelling.
    const pending: Promise<Animation>[] = [];
    for (const anim of animations) {
      pending.push(anim.finished);
    }
    await Promise.allSettled(pending);
    clearDeadline();
  });

  return { cancel };
}

export { injectGradientDefs, stampSankeyLinkPathLength, runSankeyReveal };
export type { SankeyEnterTransition, SankeyRevealHandle, SankeyRevealConfig };
