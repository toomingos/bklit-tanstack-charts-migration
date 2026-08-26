// Connectivity-based hover dimming for SankeyChart.
//
// When a node is hovered:
//   - That node + all its connected links + connected nodes stay highlighted
//   - All other nodes dim to fadedNodeOpacity (default 0.4)
//   - All other links dim to fadedLinkOpacity (default 0.1)
//
// When a link is hovered: same logic but link is the focus (its source/target
// nodes are connected).
//
// Timing: node dim/undim carries legacy's per-index stagger wave
// (`nodeStagger`, from buildSankeyNodeStagger) because bklit re-uses its
// staggered enter transitions for hover opacity. Links have no delay in
// bklit either, so they keep the flat 0.18s ease-out. Base CSS transitions
// are injected via injectLabelCssTransitions; the inline styles here override
// per element and are cleared on the no-hover pass.

import { sankeyNodeStaggerDelays, type SankeyNodeStagger } from "./sankey-animation";

const BASE_DIM_TRANSITION = "opacity 0.18s ease-out";
const BASE_FILL_TRANSITION = "fill-opacity 0.18s ease-out";

export interface SankeyHoverResult {
  nodeConnected: boolean[];
  linkConnected: boolean[];
  anyHovered: boolean;
}

export function computeNodeHoverConnected(
  hoveredNodeIndex: number | null,
  nodeCount: number,
  links: Array<{ source: number; target: number }>,
): SankeyHoverResult {
  const anyHovered = hoveredNodeIndex !== null;
  const nodeConnected = new Array(nodeCount).fill(false);
  const linkConnected = new Array(links.length).fill(false);

  if (hoveredNodeIndex !== null) {
    nodeConnected[hoveredNodeIndex] = true;

    for (let li = 0; li < links.length; li++) {
      const link = links[li]!;
      if (link.source === hoveredNodeIndex || link.target === hoveredNodeIndex) {
        linkConnected[li] = true;
        const other = link.source === hoveredNodeIndex ? link.target : link.source;
        if (other >= 0 && other < nodeCount) {
          nodeConnected[other] = true;
        }
      }
    }
  }

  return { nodeConnected, linkConnected, anyHovered };
}

export function computeLinkHoverConnected(
  hoveredLinkIndex: number | null,
  nodeCount: number,
  links: Array<{ source: number; target: number }>,
): SankeyHoverResult {
  const anyHovered = hoveredLinkIndex !== null;
  const nodeConnected = new Array(nodeCount).fill(false);
  const linkConnected = new Array(links.length).fill(false);

  if (hoveredLinkIndex !== null && hoveredLinkIndex < links.length) {
    linkConnected[hoveredLinkIndex] = true;
    const link = links[hoveredLinkIndex]!;
    if (link.source >= 0 && link.source < nodeCount) {
      nodeConnected[link.source] = true;
    }
    if (link.target >= 0 && link.target < nodeCount) {
      nodeConnected[link.target] = true;
    }
  }

  return { nodeConnected, linkConnected, anyHovered };
}

export function applySankeyHoverStyle(
  svg: SVGSVGElement,
  nodeElements: (SVGGElement | null)[],
  linkElements: (SVGPathElement | null)[],
  nodeCount: number,
  linkCount: number,
  hoverResult: SankeyHoverResult,
  fadedNodeOpacity: number,
  fadedLinkOpacity: number,
  baseStrokeOpacity: number,
  nodeStagger?: SankeyNodeStagger,
): void {
  const { nodeConnected, linkConnected, anyHovered } = hoverResult;
  const nameLabelMap = new Map<number, SVGElement>();
  const valueLabelMap = new Map<number, SVGElement>();
  for (const el of svg.querySelectorAll<SVGElement>(`[data-ts-key^="sankey:nlabel:"]`)) {
    const idx = Number(el.getAttribute("data-ts-key")?.split(":").pop());
    if (!Number.isNaN(idx)) nameLabelMap.set(idx, el);
  }
  for (const el of svg.querySelectorAll<SVGElement>(`[data-ts-key^="sankey:vlabel:"]`)) {
    const idx = Number(el.getAttribute("data-ts-key")?.split(":").pop());
    if (!Number.isNaN(idx)) valueLabelMap.set(idx, el);
  }

  for (let i = 0; i < nodeCount; i++) {
    const group = nodeElements[i];
    if (!group) continue;
    const rect = group.querySelector("rect") as SVGElement | null;
    if (!rect) continue;

    const nameLabel = nameLabelMap.get(i) ?? null;
    const valueLabel = valueLabelMap.get(i) ?? null;

    // Per-node staggered dim AND restore timing (legacy's motion.animate
    // carries the staggered enter transition on every opacity retarget,
    // including hover-out — the QA harness chains captures 30ms apart, so
    // restore waves are in-flight during the next shot). Written on every
    // node pass; links keep the flat 0.18s base (no delay in bklit either).
    let rectTransition: string | null = null;
    let nameTransition: string | null = null;
    let valueTransition: string | null = null;
    if (nodeStagger && nodeStagger.count > 0) {
      const { rectMs, nameMs, valueMs } = sankeyNodeStaggerDelays(nodeStagger, i);
      rectTransition = `opacity ${nodeStagger.durationMs}ms ${nodeStagger.easingCss} ${rectMs}ms`;
      nameTransition = `opacity ${nodeStagger.durationMs}ms ${nodeStagger.easingCss} ${nameMs}ms`;
      valueTransition = `fill-opacity ${nodeStagger.durationMs}ms ${nodeStagger.easingCss} ${valueMs}ms`;
    }

    // Value-label dimming writes fill-opacity (the same property carrying its
    // resting 0.6 scene style) so it never multiplies with the reveal's
    // opacity track — `opacity` stays neutral (1) on value labels.
    if (anyHovered && !nodeConnected[i]) {
      rect.style.opacity = String(fadedNodeOpacity);
      if (nameLabel) nameLabel.style.opacity = String(fadedNodeOpacity);
      if (valueLabel) valueLabel.style.fillOpacity = String(fadedNodeOpacity * 0.8);
    } else {
      rect.style.opacity = "1";
      if (nameLabel) nameLabel.style.opacity = "1";
      if (valueLabel) valueLabel.style.fillOpacity = "0.6";
    }
    if (rectTransition !== null) {
      rect.style.transition = rectTransition;
      if (nameLabel) nameLabel.style.transition = nameTransition!;
      if (valueLabel) valueLabel.style.transition = valueTransition!;
    } else {
      rect.style.transition = "";
      if (nameLabel) nameLabel.style.transition = "";
      if (valueLabel) valueLabel.style.transition = "";
    }
  }

  for (let i = 0; i < linkCount; i++) {
    const pathEl = linkElements[i];
    if (!pathEl) continue;

    // T-D13: the native link() mark renders its base alpha as `stroke-opacity`
    // (LinkOptions has no plain `opacity` channel). Writing `style.opacity`
    // here would MULTIPLY with that baked attribute instead of replacing it —
    // the emphasized link came out at 0.5*0.65 ≈ 0.33 instead of 0.65. The
    // pre-swap custom mark set `opacity`, the same property the chrome wrote,
    // so it replaced. Write stroke-opacity to restore replace-not-multiply.
    // The 0.18s ease-out transition in sankey-animation.ts is keyed to the
    // same property for the same reason — change both together or hover snaps.
    if (anyHovered && !linkConnected[i]) {
      pathEl.style.strokeOpacity = String(fadedLinkOpacity);
    } else {
      pathEl.style.strokeOpacity = anyHovered
        ? String(Math.min(1, baseStrokeOpacity * 1.3))
        : String(baseStrokeOpacity);
    }
  }
}

export type HoverEventHandlers = {
  onNodeEnter: (index: number) => void;
  onNodeLeave: () => void;
  onLinkEnter: (index: number) => void;
  onLinkLeave: () => void;
};

export function attachSankeyHoverListeners(
  nodeElements: (SVGGElement | null)[],
  linkElements: (SVGPathElement | null)[],
  handlers: HoverEventHandlers,
): () => void {
  const cleanups: Array<() => void> = [];

  for (let i = 0; i < nodeElements.length; i++) {
    const group = nodeElements[i];
    if (!group) continue;

    const onEnter = () => handlers.onNodeEnter(i);
    const onLeave = () => handlers.onNodeLeave();
    group.addEventListener("mouseenter", onEnter);
    group.addEventListener("mouseleave", onLeave);
    cleanups.push(() => {
      group.removeEventListener("mouseenter", onEnter);
      group.removeEventListener("mouseleave", onLeave);
    });
  }

  for (let i = 0; i < linkElements.length; i++) {
    const el = linkElements[i];
    if (!el) continue;

    const onEnter = () => handlers.onLinkEnter(i);
    const onLeave = () => handlers.onLinkLeave();
    el.addEventListener("mouseenter", onEnter);
    el.addEventListener("mouseleave", onLeave);
    cleanups.push(() => {
      el.removeEventListener("mouseenter", onEnter);
      el.removeEventListener("mouseleave", onLeave);
    });
  }

  return () => cleanups.forEach((fn) => fn());
}
