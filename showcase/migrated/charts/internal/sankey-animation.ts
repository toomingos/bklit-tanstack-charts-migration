// Sankey reveal sentinel: node/link enter runs through the renderer.
// The WAAPI dash draw-on and stagger need a ruling (reported).
import type { Transition } from "motion/react";
import { REVEAL_EASE_CSS } from "./design-tokens";
import { buildSankeyLinkAnimationSpecs, buildSankeyNodeAnimationSpecs, collectSankeyLabels, playSankeyAnimationSpecs, queryLinkPaths, queryNodeRects } from "./sankey-reveal-specs";

type SankeyEnterTransition = Transition;

const MS_PER_SECOND = 1000;
const SANKEY_NODE_ANIM_FRACTION = 0.6;

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

const settleSankeyDeadline = (params: Readonly<SankeySettleParams>): void => {
  const { durationMs, maxDelayMs, runtime } = params;
  runtime.deadlineTimer = globalThis.setTimeout(() => {
    runtime.deadlineTimer = undefined;
  }, durationMs + maxDelayMs);
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
  const runtime = createSankeyRevealRuntime();

  const cancel = (): void => {
    if (runtime.cancelPostPaint) {
      runtime.cancelPostPaint();
      runtime.cancelPostPaint = undefined;
    }
    clearSankeyDeadline(runtime);
    abortSankeyAnimations(runtime);
  };

  // Renderer paints the entrance; the frame keeps the stagger window.
  // Deadline still matches the legacy span.
  const { durationMs, maxDelayMs } = playSankeyRevealFrame({ animationDuration, enterTransition, linkPaths, nodeRects, runtime, svg });
  settleSankeyDeadline({ durationMs, maxDelayMs, runtime });

  return { cancel };
}

export { stampSankeyLinkPathLength } from "./sankey-reveal-specs";
export { runSankeyReveal };
export type { SankeyEnterTransition, SankeyRevealConfig, SankeyRevealHandle };
