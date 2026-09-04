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

interface SankeyGradientStopParams {
  readonly element: SVGLinearGradientElement;
  readonly gradient: Readonly<SankeyGradientDatum>;
}

const appendSankeyGradientStops = (params: Readonly<SankeyGradientStopParams>): void => {
  const { element, gradient } = params;
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
}

const buildSankeyGradientElement = (gradient: Readonly<SankeyGradientDatum>): SVGLinearGradientElement => {
  const element = document.createElementNS(SVG_NAMESPACE, "linearGradient");
  element.setAttribute("id", gradient.id);
  element.setAttribute("gradientUnits", "userSpaceOnUse");
  element.setAttribute("x1", String(gradient.x1));
  element.setAttribute("y1", GRADIENT_VERTICAL_ORIGIN);
  element.setAttribute("x2", String(gradient.x2));
  element.setAttribute("y2", GRADIENT_VERTICAL_ORIGIN);
  appendSankeyGradientStops({ element, gradient });
  return element;
}

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

interface SankeyLabelCollectionParams {
  readonly prefix: string;
  readonly svg: SVGSVGElement;
}

const collectSankeyLabels = (params: Readonly<SankeyLabelCollectionParams>): Map<number, SVGElement> => {
  const { prefix, svg } = params;
  const labels = new Map<number, SVGElement>();
  for (const label of svg.querySelectorAll<SVGElement>(`[data-ts-key^="${prefix}"]`)) {
    const index = Number(label.dataset.tsKey?.split(":").pop());
    if (!Number.isNaN(index)) {labels.set(index, label);}
  }
  return labels;
}

interface SankeySlideParams {
  readonly element: SVGElement;
  readonly svg: SVGSVGElement;
}

const resolveSankeyLabelSlidePx = (params: Readonly<SankeySlideParams>): number => {
  const { element, svg } = params;
  const anchor = element.getAttribute("text-anchor");
  if (anchor === "end") {return SANKEY_LABEL_SLIDE_PX;}
  if (anchor === "start") {return -SANKEY_LABEL_SLIDE_PX;}
  const halfWidth = (svg.viewBox.baseVal.width || svg.clientWidth) / 2;
  const positionX = Number(element.getAttribute("x") ?? "0");
  return positionX >= halfWidth ? -SANKEY_LABEL_SLIDE_PX : SANKEY_LABEL_SLIDE_PX;
}

interface SankeyAnimationSpec {
  readonly delayMs: number;
  readonly element: SVGElement;
  readonly keyframes: Keyframe[];
}

interface SankeyLabelSpecParams {
  readonly delayMs: number;
  readonly label: SVGElement;
  readonly svg: SVGSVGElement;
}

const buildSankeyLabelAnimationSpec = (params: Readonly<SankeyLabelSpecParams>): SankeyAnimationSpec => {
  const { delayMs, label, svg } = params;
  const slidePx = resolveSankeyLabelSlidePx({ element: label, svg });
  return {
    delayMs,
    element: label,
    keyframes: [
      { opacity: "0", translate: `${slidePx}px 0px` },
      { opacity: "1", translate: "0px 0px" },
    ],
  };
}

interface SankeyNodeSpecParams {
  readonly nameLabels: ReadonlyMap<number, SVGElement>;
  readonly nodeAnimDuration: number;
  readonly nodeGroups: readonly (SVGGElement | null)[];
  readonly svg: SVGSVGElement;
  readonly valueLabels: ReadonlyMap<number, SVGElement>;
}

const buildSankeyNodeAnimationSpecs = (params: Readonly<SankeyNodeSpecParams>): SankeyAnimationSpec[] => {
  const { nameLabels, nodeAnimDuration, nodeGroups, svg, valueLabels } = params;
  const specs: SankeyAnimationSpec[] = [];
  const totalNodes = nodeGroups.length;
  for (let index = 0; index < nodeGroups.length; index += 1) {
    const group = nodeGroups[index];
    if (group) {
      const staggerDelayMs =
        totalNodes > 0 ? (index / totalNodes) * nodeAnimDuration * SANKEY_NODE_STAGGER_FRACTION : 0;

      const rect = group.querySelector<SVGRectElement>("rect");
      if (rect) {
        rect.style.transformOrigin = "center";
        specs.push({
          delayMs: staggerDelayMs,
          element: rect,
          keyframes: [
            { opacity: "0", transform: "scaleY(0)" },
            { opacity: "1", transform: "scaleY(1)" },
          ],
        });
      }

      const nameLabelDelayMs = staggerDelayMs + nodeAnimDuration * SANKEY_NAME_LABEL_WINDOW_FRACTION * SANKEY_NAME_LABEL_OFFSET_FRACTION;
      const valueLabelDelayMs = nameLabelDelayMs + SANKEY_VALUE_LABEL_DELAY_MS;

      const nameLabel = nameLabels.get(index);
      if (nameLabel) {
        specs.push(buildSankeyLabelAnimationSpec({ delayMs: nameLabelDelayMs, label: nameLabel, svg }));
      }

      const valueLabel = valueLabels.get(index);
      if (valueLabel) {
        specs.push(buildSankeyLabelAnimationSpec({ delayMs: valueLabelDelayMs, label: valueLabel, svg }));
      }
    }
  }
  return specs;
}

interface SankeyLinkSpecParams {
  readonly animationDuration: number;
  readonly linkPaths: readonly (SVGPathElement | null)[];
}

const buildSankeyLinkAnimationSpecs = (params: Readonly<SankeyLinkSpecParams>): SankeyAnimationSpec[] => {
  const { animationDuration, linkPaths } = params;
  const specs: SankeyAnimationSpec[] = [];
  const linkStartDelay = animationDuration * SANKEY_LINK_START_FRACTION;
  const linkAnimWindow = animationDuration * SANKEY_LINK_WINDOW_FRACTION;
  const totalLinks = linkPaths.length;
  for (let index = 0; index < linkPaths.length; index += 1) {
    const link = linkPaths[index];
    if (link) {
      const staggerDelayMs = totalLinks > 0 ? linkStartDelay + (index / totalLinks) * linkAnimWindow * SANKEY_LINK_STAGGER_FRACTION : linkStartDelay;
      specs.push({
        delayMs: staggerDelayMs,
        element: link,
        keyframes: [
          { strokeDasharray: "1 1", strokeDashoffset: "1" },
          { strokeDasharray: "1 1", strokeDashoffset: "0" },
        ],
      });
    }
  }
  return specs;
}

interface SankeyPlayParams {
  readonly animations: Animation[];
  readonly durationMs: number;
  readonly easingCss: string;
  readonly specs: readonly SankeyAnimationSpec[];
}

const playSankeyAnimationSpecs = (params: Readonly<SankeyPlayParams>): number => {
  const { animations, durationMs, easingCss, specs } = params;
  let maxDelayMs = 0;
  for (const spec of specs) {
    if (spec.delayMs > maxDelayMs) {maxDelayMs = spec.delayMs;}
    animations.push(
      spec.element.animate(spec.keyframes, {
        delay: spec.delayMs,
        duration: durationMs,
        easing: easingCss,
        fill: "backwards",
      }),
    );
  }
  return maxDelayMs;
}

interface SankeyRevealRuntime {
  animations: Animation[];
  cancelPostPaint: (() => void) | undefined;
  deadlineTimer: ReturnType<typeof globalThis.setTimeout> | undefined;
}

const createSankeyRevealRuntime = (): SankeyRevealRuntime => ({
  animations: [],
  cancelPostPaint: undefined,
  deadlineTimer: undefined,
})

const clearSankeyDeadline = (runtime: SankeyRevealRuntime): void => {
  if (runtime.deadlineTimer !== undefined) {
    globalThis.clearTimeout(runtime.deadlineTimer);
    runtime.deadlineTimer = undefined;
  }
}

const abortSankeyAnimations = (runtime: SankeyRevealRuntime): void => {
  for (const animation of runtime.animations) {
    try {
      animation.cancel();
    } catch {
      // Teardown race: already cancelled or detached.
    }
  }
  runtime.animations.length = 0;
}

interface SankeySettleParams {
  readonly durationMs: number;
  readonly maxDelayMs: number;
  readonly runtime: SankeyRevealRuntime;
}

const settleSankeyAnimations = async (params: Readonly<SankeySettleParams>): Promise<void> => {
  const { durationMs, maxDelayMs, runtime } = params;
  runtime.deadlineTimer = globalThis.setTimeout(() => {
    runtime.deadlineTimer = undefined;
    abortSankeyAnimations(runtime);
  }, durationMs + maxDelayMs + DEADLINE_SLACK_MS);

  // Collected imperatively rather than with `.map()`.
  // A callback returning `animation.finished` trips promise-function-async with no clean async spelling.
  const pending: Promise<Animation>[] = [];
  for (const animation of runtime.animations) {
    pending.push(animation.finished);
  }
  await Promise.allSettled(pending);
  clearSankeyDeadline(runtime);
}

const runSankeyReveal = (config: SankeyRevealConfig): SankeyRevealHandle => {
  const { svg, animationDuration, enterTransition } = config;
  const nodeGroups = queryNodeGroups(svg);
  const linkPaths = queryLinkPaths(svg);
  const marksGroup = svg.querySelector(".ts-chart__marks");
  const runtime = createSankeyRevealRuntime();

  const cancel = (): void => {
    if (runtime.cancelPostPaint) {
      runtime.cancelPostPaint();
      runtime.cancelPostPaint = undefined;
    }
    clearSankeyDeadline(runtime);
    abortSankeyAnimations(runtime);
    marksGroup?.classList.remove(REVEALING_CLASS);
  };

  marksGroup?.classList.add(REVEALING_CLASS);

  runtime.cancelPostPaint = onPostPaint(async () => {
    runtime.cancelPostPaint = undefined;

    const { durationMs, easingCss } = resolveTiming(enterTransition, animationDuration);
    const nodeAnimDuration = animationDuration * SANKEY_NODE_ANIM_FRACTION;
    const nameLabels = collectSankeyLabels({ prefix: "sankey:nlabel:", svg });
    const valueLabels = collectSankeyLabels({ prefix: "sankey:vlabel:", svg });
    const specs = [
      ...buildSankeyNodeAnimationSpecs({ nameLabels, nodeAnimDuration, nodeGroups, svg, valueLabels }),
      ...buildSankeyLinkAnimationSpecs({ animationDuration, linkPaths }),
    ];
    const maxDelayMs = playSankeyAnimationSpecs({ animations: runtime.animations, durationMs, easingCss, specs });

    marksGroup?.classList.remove(REVEALING_CLASS);

    if (runtime.animations.length === 0) {return;}

    await settleSankeyAnimations({ durationMs, maxDelayMs, runtime });
  });

  return { cancel };
}

export { injectGradientDefs, stampSankeyLinkPathLength, runSankeyReveal };
export type { SankeyEnterTransition, SankeyRevealHandle, SankeyRevealConfig };
