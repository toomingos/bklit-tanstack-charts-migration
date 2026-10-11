// Sunburst sector layer (gap #35: no public enter-from or exit-to arc geometry): the sunburst mark takes this documented layer renderer, which owns its SVG
// and draws every sector, pop-out overlay and label from the chart's own geometry, tweened on bklit's curves. Shape follows ring/progress-layer.ts.
import type { ChartLayerRenderer, SceneLabel, SceneNode, SceneStyle } from "@tanstack/charts";
import { createSvgLayer, paintKeyed, setOrRemove, STYLE_PROPERTIES, SVG_NS, translateOf } from "../kit/layer/svg-layer";
import { prefersReducedMotion } from "../kit/loading/reduced-motion";
import { resolveEntranceOrigins } from "../kit/entrance/entrance-origin";
import { REVEAL_EASING } from "../kit/motion/easing";
import { ZOOM_EASING, ZOOM_MS } from "./easing";
import { labelFits, lerpArc, poseOf, sameArc, sectorPath, seedArc, unwrapArc } from "./geometry";
import type { ArcValues } from "./geometry";

/** Class the mark puts on the group that carries one label (its opacity follows the fit rule, so it steps at the threshold). */
export const LABEL_BOX_CLASS = "bk-sb-lbox";

/** The mark's `render` rewrites this feed (target geometry by node key, to tween) before the same scene reaches the layer's `render`,
 * so the layer reads it in place: keep that mark-then-layer order. */
export interface SectorFeed {
  /** `delayMs` is the intro delay of an area; labels and boxes carry none. */
  readonly geometry: Map<string, { readonly arc: ArcValues; readonly delayMs: number }>;
  /** The view's root id: a change is a zoom (tweened), the same id with other geometry is a resize or data change (snaps). */
  view: string;
  sweepMs: number;
  /** The chart's nominal size: bklit draws in a size-unit viewBox, so strokes and text scale by width over this. */
  readonly size: number;
  /** Runs after each paint: the hover push vars live on the layer's own elements (push.ts). */
  onPainted: (() => void) | null;
}

export const createSectorFeed = (size: number): SectorFeed => ({ geometry: new Map(), onPainted: null, size, sweepMs: 1100, view: "" });

interface Track {
  readonly from: ArcValues;
  to: ArcValues;
  readonly intro: boolean;
  readonly start: number;
  readonly delay: number;
  readonly duration: number;
  readonly ease: (t: number) => number;
}

interface NodeState {
  readonly element: SVGElement;
  readonly apply: (arc: ArcValues) => void;
  readonly isArea: boolean;
  /** The geometry on screen when no track runs. */
  cur: ArcValues | null;
  /** The last target the mark published (a track may run to a turn-shifted copy of it). */
  target: ArcValues | null;
  track: Track | null;
}

// Presentation attributes, not inline style: the hover CSS (push.ts) must be able to override a scene's opacity.
const applyStyle = (element: SVGElement, style: SceneStyle | undefined, scale: number): void => {
  for (const [key, property] of STYLE_PROPERTIES) {
    const value = style?.[key];
    if (value === undefined) {
      element.removeAttribute(property);
    } else {
      element.setAttribute(property, String(key === "strokeWidth" ? Number(value) * scale : value));
    }
  }
};

const noop = (): void => undefined;

const paintLabel = (element: SVGElement, node: SceneLabel, scale: number): void => {
  setOrRemove(element, "class", node.className);
  setOrRemove(element, "x", node.x);
  setOrRemove(element, "y", node.y);
  setOrRemove(element, "text-anchor", node.anchor);
  setOrRemove(element, "dominant-baseline", node.baseline);
  setOrRemove(element, "font-size", node.fontSize === undefined ? undefined : node.fontSize * scale);
  setOrRemove(element, "font-weight", node.fontWeight);
  element.setAttribute("font-family", "inherit");
  applyStyle(element, node.style, scale);
  if (element.textContent !== node.text) { element.textContent = node.text; }
};

export const createSectorLayer = (feed: SectorFeed, renderStart: { readonly current: number | null }): ChartLayerRenderer<unknown, number, number> =>
  createSvgLayer<unknown>("bkm-sunburst-sectors", (svg) => {
    const states = new Map<string, NodeState>();
    const elements = new Map<string, SVGElement>();
    const seen = new Set<string>();
    let reduced = false;
    let first = true;
    let view: string | null = null;
    let origin: number | null = null;
    let cancelOrigin = noop;
    let frame = 0;
    let scale = 1;

    const arcNow = (state: NodeState, now: number): ArcValues => {
      const { track } = state;
      if (track === null || state.cur === null) { return state.cur ?? track?.to ?? [0, 0, 0, 0]; }
      const start = track.intro ? origin : track.start;
      const progress = start === null ? 0 : Math.min(1, Math.max(0, (now - start - track.delay) / track.duration));
      return progress >= 1 ? track.to : lerpArc(track.from, track.to, track.ease(progress));
    };

    const tick = (now: number): void => {
      let running = false;
      for (const state of states.values()) {
        const { track } = state;
        if (track !== null) {
          state.apply(arcNow(state, now));
          const start = track.intro ? origin : track.start;
          if (start !== null && now - start - track.delay >= track.duration) {
            state.cur = track.to;
            state.track = null;
          } else {
            running = true;
          }
        }
      }
      // Next frame of the sector tween: bklit drives zoom and enter as motion values per frame (sunburst-chart.tsx:244, sunburst-segment.tsx:78-81).
      frame = running ? requestAnimationFrame(tick) : 0;
    };
    const wake = (): void => {
      if (frame === 0) { frame = requestAnimationFrame(tick); }
    };

    const sync = (state: NodeState, id: string, introPending: boolean, now: number): void => {
      const geometry = feed.geometry.get(id);
      if (geometry === undefined) { return; }
      const { arc } = geometry;
      if (state.cur === null || state.target === null) {
        const intro = introPending && state.isArea;
        state.cur = intro ? seedArc(arc) : arc;
        state.target = arc;
        state.track = intro ? { delay: geometry.delayMs, duration: feed.sweepMs, ease: REVEAL_EASING, from: state.cur, intro: true, start: 0, to: arc } : null;
        state.apply(state.cur);
        return;
      }
      if (sameArc(arc, state.target)) { return; }
      state.target = arc;
      if (view !== null && feed.view !== view && !reduced) {
        const from = arcNow(state, now);
        state.cur = from;
        state.track = { delay: 0, duration: ZOOM_MS, ease: ZOOM_EASING, from, intro: false, start: now, to: unwrapArc(arc, from) };
      } else if (state.track === null) {
        state.cur = arc;
        state.apply(arc);
      } else {
        state.track.to = arc;
      }
    };

    const create = (node: SceneNode): NodeState | null => {
      if (node.kind === "area") {
        const path = document.createElementNS(SVG_NS, "path");
        return { apply: (arc) => { path.setAttribute("d", sectorPath(arc)); }, cur: null, element: path, isArea: true, target: null, track: null };
      }
      if (node.kind === "label") {
        const text = document.createElementNS(SVG_NS, "text");
        return {
          apply: (arc) => {
            const { x, y, rotate } = poseOf(arc);
            text.setAttribute("transform", `translate(${x} ${y}) rotate(${rotate})`);
          },
          cur: null, element: text, isArea: false, target: null, track: null,
        };
      }
      if (node.kind === "group" && node.className?.includes(LABEL_BOX_CLASS) === true) {
        const box = document.createElementNS(SVG_NS, "g");
        return { apply: (arc) => { box.style.opacity = labelFits(arc, scale) ? "1" : "0"; }, cur: null, element: box, isArea: false, target: null, track: null };
      }
      return null;
    };

    const elementOf = (node: SceneNode, id: string): { readonly element: SVGElement; readonly state: NodeState | null } | null => {
      const existing = elements.get(id);
      if (existing !== undefined) { return { element: existing, state: states.get(id) ?? null }; }
      const state = create(node);
      const element = state?.element ?? document.createElementNS(SVG_NS, "g");
      elements.set(id, element);
      if (state !== null) { states.set(id, state); }
      return { element, state };
    };

    const paintNode = (node: SceneNode, id: string, introPending: boolean, now: number): SVGElement | null => {
      if (node.kind !== "area" && node.kind !== "label" && node.kind !== "group") { return null; }
      const { element, state } = elementOf(node, id) ?? {};
      if (element === undefined) { return null; }
      if (node.kind === "label") {
        paintLabel(element, node, scale);
      } else {
        if (node.kind === "area") { applyStyle(element, node.style, scale); }
        setOrRemove(element, "class", node.className);
        setOrRemove(element, "aria-hidden", node.ariaHidden === true ? "true" : undefined);
        if (node.kind === "group") {
          if (state === null) { setOrRemove(element, "transform", translateOf(node)); }
          // eslint-disable-next-line no-use-before-define -- mutual recursion with paintNodes
          paintNodes(node.children, element, id, introPending, now);
        }
      }
      if (state !== null && state !== undefined) { sync(state, node.key, introPending, now); }
      return element;
    };

    const paintNodes = (nodes: readonly SceneNode[], parent: SVGElement, path: string, introPending: boolean, now: number): void => {
      paintKeyed(nodes, parent, path, seen, (node, id) => paintNode(node, id, introPending, now));
    };

    return {
      destroy: (): void => {
        cancelAnimationFrame(frame);
        frame = 0;
        cancelOrigin();
      },
      render: (scene): void => {
        const now = performance.now();
        scale = scene.width / feed.size;
        reduced = prefersReducedMotion();
        const introPending = first && !reduced;
        if (introPending) {
          // bklit's per-sector enter is a JS-driven motion value: its clock starts at motion's origin (kit/entrance/entrance-origin.ts), resolved in the first rAF.
          cancelOrigin = resolveEntranceOrigins(renderStart.current ?? now, (clocks) => { origin = clocks.motion; });
        }
        paintNodes(scene.nodes, svg, "", introPending, now);
        ({ view } = feed);
        first = false;
        for (const [id, element] of elements) {
          if (!seen.has(id)) { element.remove(); elements.delete(id); states.delete(id); }
        }
        seen.clear();
        feed.onPainted?.();
        wake();
      },
    };
  });
