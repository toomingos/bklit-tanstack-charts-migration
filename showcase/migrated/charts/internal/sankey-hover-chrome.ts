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
// cannot be reproduced through the reactive-channel mechanism and stays
// dropped (ACCEPT-WITH-LOG). D2 (D-pending): the base transition TIMING now
// matches legacy — node dim/restore and the name/value label selectors
// animate at the enter tween (1.1s cubic-bezier(0.85,0,0.15,1), styles.css
// sankey block), same as legacy's REVEAL_DURATION_MS/REVEAL_EASE_CSS; only
// the link path (`[data-ts-key="sankey:flow"] > path`) stays at the quick
// 0.18s ease-out. Stagger does not match (see above) — only the flat timing
// does. buildSankeyNodeStagger/sankeyNodeStaggerDelays/
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

// D3 (D-pending): legacy has a DOM mouseenter listener directly on the
// stroked path, so there is no slop to reproduce.
const LINK_HIT_SLOP = 0;

// D3 (D-pending): exact d3-sankey `sankeyLinkHorizontal` curve, replacing
// the earlier smoothstep approximation. d3-shape's `linkHorizontal()` (the
// generator `sankeyLinkHorizontal` wraps) renders each link as:
//   context.moveTo(x1, y1);
//   context.bezierCurveTo(cx, y1, cx, y2, x2, y2);   // cx = (x1 + x2) / 2
// i.e. a cubic bezier with P0=(x1,y1), P1=(cx,y1), P2=(cx,y2), P3=(x2,y2) —
// both control points sit on the link's horizontal midline, one at the
// source y, one at the target y. `bumpXBezier`/`bumpYBezier` evaluate that
// cubic directly; since x1 !== x2 for any real link, Bx(t) is monotonic in
// t, so `solveBumpT` bisects it for the pointer's x to recover the exact t,
// then `bumpXY` evaluates y at that t.
function bumpXBezier(t: number, x1: number, cx: number, x2: number): number {
  const mt = 1 - t;
  return mt * mt * mt * x1 + 3 * mt * mt * t * cx + 3 * mt * t * t * cx + t * t * t * x2;
}

function bumpYBezier(t: number, y1: number, y2: number): number {
  const mt = 1 - t;
  return mt * mt * mt * y1 + 3 * mt * mt * t * y1 + 3 * mt * t * t * y2 + t * t * t * y2;
}

function solveBumpT(x: number, x1: number, x2: number): number {
  if (x1 === x2) return 0;
  const cx = (x1 + x2) / 2;
  const increasing = x2 > x1;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    const bx = bumpXBezier(mid, x1, cx, x2);
    if (increasing ? bx < x : bx > x) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return (lo + hi) / 2;
}

function bumpXY(x: number, x1: number, y1: number, x2: number, y2: number): number {
  const t = solveBumpT(x, x1, x2);
  return bumpYBezier(t, y1, y2);
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

  // Links iterate LAST-drawn first: SVG paints later flows over earlier ones,
  // so at an overlap the topmost (highest index) flow owned the old
  // `mouseenter` (D478, 6.5 gate).
  for (let i = links.length - 1; i >= 0; i--) {
    const l = links[i]!;
    const minX = Math.min(l.x1, l.x2);
    const maxX = Math.max(l.x1, l.x2);
    if (point.x < minX || point.x > maxX) continue;
    const curveY = bumpXY(point.x, l.x1, l.y1, l.x2, l.y2);
    const halfWidth = Math.max(1, l.width) / 2;
    if (Math.abs(point.y - curveY) <= halfWidth + LINK_HIT_SLOP) {
      return { type: "link", index: i };
    }
  }

  return null;
}
