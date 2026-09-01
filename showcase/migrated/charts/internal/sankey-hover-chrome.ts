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
// math and (b) the D4 pointer hit-test helper below (previously
// element-level mouseenter/mouseleave listeners). Dim/boost VALUES are
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
// the moved injectLabelCssTransitions block (now in styles.css directly —
// see sankey-animation.ts's header) still applies unconditionally to
// `.bkm-sankey__node rect`, `[data-ts-key="sankey:flow"] > path`, and the
// label selectors. buildSankeyNodeStagger/sankeyNodeStaggerDelays/
// SankeyNodeStagger (formerly in sankey-animation.ts) were confirmed dead
// (no remaining consumer) and deleted as part of that file's D3 rewrite.
//
// D4: `attachSankeyHoverListeners` (element-level mouseenter/mouseleave on
// pre-queried node/link elements) is retired along with
// populateNodeElements/populateLinkElements (sankey-chart.tsx) — the native
// motion renderer's scene DOM is no longer a stable reach-in surface to
// attach per-element listeners to ahead of time (T-D13's composite mark
// still emits the same elements, but querying/caching them up front is the
// pattern being retired chart-wide for C5). `findHoveredSankeyTarget` below
// is the replacement: a pure geometry hit-test against the mark's own
// laid-out node/link rows (laidOutNodesRef/laidOutLinksRef, populated by
// sankey-mark.ts's marks() pass), driven by sankey-chart.tsx's single
// `interaction.clientToScene`-based pointermove handler — the same pattern
// heatmap-components.tsx's `HeatmapCells` pointermove handler already uses
// (dist/dom-types.d.ts:33 clientToScene is the documented client->scene
// coordinate API).

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

/** Minimal node-geometry view the hit-test needs — matches LaidOutNode's
    x0/x1/y0/y1 fields (sankey-layout.ts), already the SAME absolute/
    margin-inclusive coordinate space `interaction.clientToScene` returns
    (dist/types.d.ts ChartBounds — confirmed no margin subtraction needed,
    unlike heatmap's plot-local scales). */
export interface SankeyNodeHitBox {
  x0?: number;
  x1?: number;
  y0?: number;
  y1?: number;
}

/** Minimal link-geometry view the hit-test needs — matches LaidOutLink
    (sankey-mark.ts), populated straight off the resolved SankeyLink rows'
    own x1/y1/x2/y2/width fields. */
export interface SankeyLinkHitBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
}

export type SankeyHitTarget = { type: "node"; index: number } | { type: "link"; index: number };

const LINK_HIT_SLOP = 4;

// d3-sankey's sankeyLinkHorizontal uses curveBumpX; a smoothstep
// (3t^2 - 2t^3) is the standard cubic-bezier-with-horizontal-tangents
// approximation of that curve's vertical profile, matching D4's summary
// note and network-sankey.d.ts's x1/y1/x2/y2 link row shape.
function bumpXY(t: number, y1: number, y2: number): number {
  const s = 3 * t * t - 2 * t * t * t;
  return y1 + (y2 - y1) * s;
}

/**
 * D4 pointer hit-test: given a scene-space point (from
 * `interaction.clientToScene`), find the topmost sankey node or link under
 * it. Nodes are checked first — they paint after (on top of) the flow links
 * in `createSankeyMark`'s render pass (sankey-mark.ts), so a point over both
 * a node rect and an underlying link should resolve to the node, matching
 * the pre-C5 DOM z-order the old mouseenter listeners implicitly relied on.
 */
export function findHoveredSankeyTarget(
  point: { x: number; y: number },
  nodes: readonly SankeyNodeHitBox[],
  links: readonly SankeyLinkHitBox[],
): SankeyHitTarget | null {
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i]!;
    const x0 = n.x0 ?? 0;
    const x1 = n.x1 ?? 0;
    const y0 = n.y0 ?? 0;
    const y1 = n.y1 ?? 0;
    if (point.x >= x0 && point.x <= x1 && point.y >= y0 && point.y <= y1) {
      return { type: "node", index: i };
    }
  }

  for (let i = 0; i < links.length; i++) {
    const l = links[i]!;
    const minX = Math.min(l.x1, l.x2);
    const maxX = Math.max(l.x1, l.x2);
    if (point.x < minX || point.x > maxX) continue;
    const t = maxX === minX ? 0 : (point.x - l.x1) / (l.x2 - l.x1);
    const curveY = bumpXY(t, l.y1, l.y2);
    const halfWidth = Math.max(1, l.width) / 2;
    if (Math.abs(point.y - curveY) <= halfWidth + LINK_HIT_SLOP) {
      return { type: "link", index: i };
    }
  }

  return null;
}
