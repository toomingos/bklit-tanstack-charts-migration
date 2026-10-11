// Native left-to-right reveal (bklit ChartRevealClip): marks wrapped in keyed `wipe-` groups that `motion()` tweens.
import { areaY as areaYRaw, createMark, lineY as lineYRaw } from "@tanstack/charts";
import { REVEAL_EASING } from "../motion/easing";
import type { ChartMotionContext, ChartMotionDefinition, ChartMotionTiming, ChartValue, InitializedMark, MarkRenderContext, MarkResolvedLayoutContext, MarkScene, ResolvedMarkLayout } from "@tanstack/charts";
import { erase } from "./erased-types";
import type { AnyMark } from "./erased-types";

export interface WipeConfig {
  readonly p: number;
  readonly w: number;
  readonly h: number;
  readonly pad?: number;
  readonly ms: number;
}

/** Composed bar rects (`bar:<dataKey>`) sit under bklit's one shared reveal clip; their hover dot guides (`bar:<dataKey>:dot`) do not. */
export const isBarRect = (id: string | undefined): boolean => id !== undefined && id.startsWith("bar:") && !id.endsWith(":dot");

/** Keys of the wipe groups; `motion()` gives them the reveal tween (bklit's duration and cubic-bezier(0.85, 0, 0.15, 1)). */
export const WIPE_KEY = "wipe-";
export const wipeMotion = (ms: number) => ({ transition: { type: "tween", duration: ms, easing: REVEAL_EASING } }) as const;

const resolveMotion = (own: ChartMotionDefinition, context: ChartMotionContext): false | ChartMotionTiming | undefined =>
  typeof own === "function" ? own(context) : own;

/** Wraps a mark in two keyed groups: the outer carries a static clip (x 0 .. margin-left + plot width) and translates by -(1 - p) * W, the inner back by +(1 - p) * W.
 * Keyed groups tween `transform` (a clip rect would snap). Built with `createMark`, delegating to the wrapped mark's `initialize`. */
export function wipeWrap<M extends AnyMark>(
  mark: M,
  tag: string,
  wipe: WipeConfig,
  margin: { readonly left: number; readonly top: number; readonly bottom: number },
): M {
  const pad = wipe.pad ?? 0;
  const shift = (1 - wipe.p) * (wipe.w + 2 * pad);
  const wrapScene = <D, X extends ChartValue, Y extends ChartValue>(scene: MarkScene<D, X, Y>): MarkScene<D, X, Y> => ({
    ...scene,
    nodes: [
      {
        kind: "group",
        key: `${WIPE_KEY}o:${tag}`,
        translateX: -shift,
        clip: { x: 0, y: 0, width: margin.left + wipe.w + pad, height: wipe.h + margin.top + margin.bottom },
        children: [{ kind: "group", key: `${WIPE_KEY}i:${tag}`, translateX: shift, children: scene.nodes }],
      },
    ],
  });
  const wrapRender = (render: (c: MarkRenderContext) => MarkScene): ((c: MarkRenderContext) => MarkScene) => (c) => wrapScene(render(c));
  // A mark that carries its own `motion` (composed bars: grow + stagger; `false` when not animated) would also own its top-level
  // node, the `wipe-o` group: route the wipe keys to the reveal tween and leave everything else to the mark.
  const routeMotion = (own: ChartMotionDefinition | undefined): ChartMotionDefinition | undefined =>
    own === undefined
      ? undefined
      : (context: ChartMotionContext): false | ChartMotionTiming | undefined => (context.key.startsWith(WIPE_KEY) ? wipeMotion(wipe.ms) : resolveMotion(own, context));
  const markMotion: ChartMotionDefinition | undefined = routeMotion(mark.motion);
  // Documented custom-mark factory (reference/custom-extensions.md "Custom marks"): the inner mark's public `initialize` result is re-rendered inside the groups.
  return erase(
    createMark((ctx) => {
      const init: InitializedMark = erase(mark.initialize(ctx));
      const { resolveLayout } = init;
      const wrapped: InitializedMark = { ...init, render: wrapRender(init.render) };
      const motion = routeMotion(init.motion ?? mark.motion);
      if (motion !== undefined) {
        wrapped.motion = motion;
      }
      if (resolveLayout) {
        wrapped.resolveLayout = (lc: MarkResolvedLayoutContext): ResolvedMarkLayout => {
          const out = resolveLayout(lc);
          return { ...out, render: wrapRender(out.render) };
        };
      }
      return wrapped;
    }, markMotion),
  );
}

interface WipedFactories {
  readonly lineY: typeof lineYRaw;
  readonly areaY: typeof areaYRaw;
}

/** lineY / areaY that wrap each mark they build in the next numbered wipe group (`l0`, `a1`, ...) when the chart reveals. */
export function wipedMarkFactories(
  wipe: WipeConfig | undefined,
  margin: { readonly left: number; readonly top: number; readonly bottom: number },
): WipedFactories {
  let seq = 0;
  const nextTag = (prefix: string): string => {
    seq += 1;
    return `${prefix}${seq - 1}`;
  };
  const lineY: typeof lineYRaw = erase((rows: never, o: never) => {
    const mark = lineYRaw(rows, o);
    return wipe ? wipeWrap(erase(mark), nextTag("l"), wipe, margin) : mark;
  });
  const areaY: typeof areaYRaw = erase((rows: never, o: never) => {
    const mark = areaYRaw(rows, o);
    return wipe ? wipeWrap(erase(mark), nextTag("a"), wipe, margin) : mark;
  });
  return { lineY, areaY };
}
