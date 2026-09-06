// Sanctioned WAAPI reach-in: dash draw-on + per-role stagger have no native motion expression.
import type { Transition } from "motion/react";
import { onPostPaint } from "./deferred-reveal";
import { REVEAL_EASE_CSS } from "./design-tokens";
import { buildSankeyLinkAnimationSpecs, buildSankeyNodeAnimationSpecs, collectSankeyLabels, playSankeyAnimationSpecs, queryLinkPaths, queryNodeRects } from "./sankey-reveal-specs";

type SankeyEnterTransition = Transition;

const REVEALING_CLASS = "ts-chart__marks--revealing";
const DEADLINE_SLACK_MS = 150;
const MS_PER_SECOND = 1000;
const SANKEY_NODE_ANIM_FRACTION = 0.6;
const EMPTY_ANIMATION_COUNT = 0;

interface SankeyRevealTiming {
  readonly durationMs: number;
  readonly easingCss: string;
}

const resolveTiming = (transition: Readonly<SankeyEnterTransition> | undefined, animationDuration: number): SankeyRevealTiming => {
  const durationMs = transition?.duration === undefined ? animationDuration : transition.duration * MS_PER_SECOND;
  const { ease } = transition ?? {};
  const easingCss =
    transition?.type !== "spring" && Array.isArray(ease)
      ? `cubic-bezier(${ease.join(",")})`
      : REVEAL_EASE_CSS;
  return { durationMs, easingCss };
}

interface SankeyRevealHandle {
  readonly cancel: () => void
}

interface SankeyRevealConfig {
  readonly svg: SVGSVGElement;
  readonly animationDuration: number;
  readonly enterTransition?: SankeyEnterTransition;
}

interface SankeyRevealRuntime {
  readonly animations: Animation[];
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

interface SankeyRevealFrameTiming {
  readonly durationMs: number;
  readonly maxDelayMs: number;
}

interface SankeyRevealFrameParams {
  readonly animationDuration: number;
  readonly enterTransition: SankeyEnterTransition | undefined;
  readonly linkPaths: readonly (SVGPathElement | null)[];
  readonly nodeRects: readonly (SVGRectElement | null)[];
  readonly runtime: SankeyRevealRuntime;
  readonly svg: SVGSVGElement;
}

// Builds and plays the node and link specs for one post-paint reveal frame.
const playSankeyRevealFrame = (params: Readonly<SankeyRevealFrameParams>): SankeyRevealFrameTiming => {
  const { animationDuration, enterTransition, linkPaths, nodeRects, runtime, svg } = params;
  const { durationMs, easingCss } = resolveTiming(enterTransition, animationDuration);
  const nodeAnimDuration = animationDuration * SANKEY_NODE_ANIM_FRACTION;
  const nameLabels = collectSankeyLabels({ prefix: "sankey:nlabel:", svg });
  const valueLabels = collectSankeyLabels({ prefix: "sankey:vlabel:", svg });
  const specs = [
    ...buildSankeyNodeAnimationSpecs({ nameLabels, nodeAnimDuration, nodeRects, svg, valueLabels }),
    ...buildSankeyLinkAnimationSpecs({ animationDuration, linkPaths }),
  ];
  const maxDelayMs = playSankeyAnimationSpecs({ animations: runtime.animations, durationMs, easingCss, specs });
  return { durationMs, maxDelayMs };
}

const runSankeyReveal = (config: SankeyRevealConfig): SankeyRevealHandle => {
  const { svg, animationDuration, enterTransition } = config;
  const nodeRects = queryNodeRects(svg);
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

  runtime.cancelPostPaint = onPostPaint((): void => {
    runtime.cancelPostPaint = undefined;
    const { durationMs, maxDelayMs } = playSankeyRevealFrame({ animationDuration, enterTransition, linkPaths, nodeRects, runtime, svg });
    marksGroup?.classList.remove(REVEALING_CLASS);
    if (runtime.animations.length === EMPTY_ANIMATION_COUNT) {return;}
    // Detached settle: Promise.allSettled never rejects, so awaiting is unnecessary.
    void settleSankeyAnimations({ durationMs, maxDelayMs, runtime });
  });

  return { cancel };
}

export { stampSankeyLinkPathLength } from "./sankey-reveal-specs";
export { runSankeyReveal };
export type { SankeyEnterTransition, SankeyRevealConfig, SankeyRevealHandle };
