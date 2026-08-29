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
// C1 states+legend: this module now supplies only (a) the pure connectivity
// math and (b) element-level hover-detection listeners. Dim/boost VALUES are
// applied reactively as per-datum style/channel values inside
// internal/sankey-mark.ts's render pass (rebuilt whenever hover state
// changes) — there is no DOM-mutation "apply" step here anymore. The old
// applySankeyHoverStyle wrote inline styles straight onto rect/label/path
// elements (queried via `[data-ts-key^="sankey:nlabel:"]` /
// `sankey:vlabel:"]`) and additionally carried a per-node staggered
// transition-timing override (borrowed from the enter reveal's stagger, via
// sankey-animation.ts's buildSankeyNodeStagger/sankeyNodeStaggerDelays) —
// SceneStyle has no `transition` field, so that per-node stagger nuance
// cannot be reproduced through the reactive-channel mechanism and is
// dropped; dim/restore now animates at the flat 0.18s ease-out CSS transition
// injectLabelCssTransitions already applies unconditionally to
// `.ts-sankey__node rect`, `[data-ts-key="sankey:flow"] > path`, and the
// label selectors (see that function in sankey-animation.ts). Follow-up:
// buildSankeyNodeStagger/sankeyNodeStaggerDelays/SankeyNodeStagger in
// sankey-animation.ts (outside this commit's file scope) are now dead
// exports with no remaining consumer.

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
