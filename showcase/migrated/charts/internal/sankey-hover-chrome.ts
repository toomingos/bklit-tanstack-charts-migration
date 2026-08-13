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
// CSS transitions (0.18s ease-out) are injected via injectLabelCssTransitions
// in sankey-animation.ts so dimming changes animate smoothly.

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

    if (anyHovered && !nodeConnected[i]) {
      rect.style.opacity = String(fadedNodeOpacity);
      if (nameLabel) nameLabel.style.opacity = String(fadedNodeOpacity);
      if (valueLabel) valueLabel.style.opacity = String(fadedNodeOpacity * 0.8);
    } else {
      rect.style.opacity = "1";
      if (nameLabel) nameLabel.style.opacity = "1";
      if (valueLabel) valueLabel.style.opacity = "0.6";
    }
  }

  for (let i = 0; i < linkCount; i++) {
    const pathEl = linkElements[i];
    if (!pathEl) continue;

    if (anyHovered && !linkConnected[i]) {
      pathEl.style.opacity = String(fadedLinkOpacity);
    } else {
      pathEl.style.opacity = anyHovered
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
