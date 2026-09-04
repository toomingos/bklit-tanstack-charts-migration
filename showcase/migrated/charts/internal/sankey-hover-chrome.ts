interface SankeyHoverResult {
  readonly nodeConnected: boolean[];
  readonly linkConnected: boolean[];
  readonly anyHovered: boolean;
}

interface SankeyHoverLink {
  readonly source: number;
  readonly target: number;
}

interface SankeyLinkHit {
  readonly connected: boolean;
  readonly other?: number;
}

interface SankeyNodeHoverConnected {
  readonly linkConnected: boolean[];
  readonly nodeConnected: boolean[];
}

const emptyFlags = (length: number): boolean[] => Array.from({ length }, () => false);

const resolveNodeLinkHit = (link: SankeyHoverLink | undefined, hoveredNodeIndex: number, nodeCount: number): SankeyLinkHit => {
  if (!link) {return { connected: false };}
  if (link.source !== hoveredNodeIndex && link.target !== hoveredNodeIndex) {return { connected: false };}
  const other = link.source === hoveredNodeIndex ? link.target : link.source;
  if (other < 0 || other >= nodeCount) {return { connected: true };}
  return { connected: true, other };
};

const collectNodeHoverConnected = (hoveredNodeIndex: number, nodeCount: number, links: readonly SankeyHoverLink[]): SankeyNodeHoverConnected => {
  const nodeConnected = emptyFlags(nodeCount);
  const linkConnected = emptyFlags(links.length);
  nodeConnected[hoveredNodeIndex] = true;
  for (let li = 0; li < links.length; li += 1) {
    const hit = resolveNodeLinkHit(links[li], hoveredNodeIndex, nodeCount);
    if (hit.connected) {
      linkConnected[li] = true;
      if (hit.other !== undefined) {nodeConnected[hit.other] = true;}
    }
  }
  return { linkConnected, nodeConnected };
};

const computeNodeHoverConnected = (hoveredNodeIndex: number | null, nodeCount: number, links: readonly { readonly source: number; readonly target: number }[]): SankeyHoverResult => {
  const anyHovered = hoveredNodeIndex !== null;
  if (hoveredNodeIndex === null) {
    return { anyHovered, linkConnected: emptyFlags(links.length), nodeConnected: emptyFlags(nodeCount) };
  }
  return { anyHovered, ...collectNodeHoverConnected(hoveredNodeIndex, nodeCount, links) };
}

const resolveLinkEndpoints = (link: SankeyHoverLink | undefined, nodeCount: number): number[] => {
  if (!link) {return [];}
  const endpoints: number[] = [];
  if (link.source >= 0 && link.source < nodeCount) {endpoints.push(link.source);}
  if (link.target >= 0 && link.target < nodeCount) {endpoints.push(link.target);}
  return endpoints;
};

const computeLinkHoverConnected = (hoveredLinkIndex: number | null, nodeCount: number, links: readonly { readonly source: number; readonly target: number }[]): SankeyHoverResult => {
  const anyHovered = hoveredLinkIndex !== null;
  const nodeConnected = emptyFlags(nodeCount);
  const linkConnected = emptyFlags(links.length);
  if (hoveredLinkIndex === null || hoveredLinkIndex >= links.length) {return { anyHovered, linkConnected, nodeConnected };}
  linkConnected[hoveredLinkIndex] = true;
  const endpoints = resolveLinkEndpoints(links[hoveredLinkIndex], nodeCount);
  for (const endpoint of endpoints) {nodeConnected[endpoint] = true;}
  return { anyHovered, linkConnected, nodeConnected };
}

interface SankeyNodeHitBox {
  readonly x0?: number;
  readonly x1?: number;
  readonly y0?: number;
  readonly y1?: number;
}

interface SankeyLinkHitBox {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly width: number;
}

type SankeyHitTarget = { type: "node"; index: number } | { type: "link"; index: number };

// No hit slop: legacy listens directly on the stroked path.
const LINK_HIT_SLOP = 0;

// Exact d3-sankey linkHorizontal cubic; x-monotonic, so t is recoverable by bisection.
// Cubic Bernstein coefficient (verbatim d3-sankey formula — do not retune).
const CUBIC_BEZIER_COEFFICIENT = 3;
// Bisection steps to recover t from x on the x-monotonic link curve.
const LINK_CURVE_BISECTION_ITERATIONS = 30;
const bumpXBezier = (bezierT: number, x1: number, x2: number): number => {
  const cx = (x1 + x2) / 2;
  const mt = 1 - bezierT;
  return mt * mt * mt * x1 + CUBIC_BEZIER_COEFFICIENT * mt * mt * bezierT * cx + CUBIC_BEZIER_COEFFICIENT * mt * bezierT * bezierT * cx + bezierT * bezierT * bezierT * x2;
}

const bumpYBezier = (bezierT: number, y1: number, y2: number): number => {
  const mt = 1 - bezierT;
  return mt * mt * mt * y1 + CUBIC_BEZIER_COEFFICIENT * mt * mt * bezierT * y1 + CUBIC_BEZIER_COEFFICIENT * mt * bezierT * bezierT * y2 + bezierT * bezierT * bezierT * y2;
}

const bisectBumpT = (x: number, x1: number, x2: number): number => {
  const increasing = x2 > x1;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < LINK_CURVE_BISECTION_ITERATIONS; i += 1) {
    const mid = (lo + hi) / 2;
    const bx = bumpXBezier(mid, x1, x2);
    if (increasing ? bx < x : bx > x) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return (lo + hi) / 2;
}

const solveBumpT = (x: number, x1: number, x2: number): number => {
  if (x1 === x2) {return 0;}
  return bisectBumpT(x, x1, x2);
}

const bumpXY = (point: { readonly x: number }, linkBox: { readonly x1: number; readonly y1: number; readonly x2: number; readonly y2: number }): number => {
  const solvedT = solveBumpT(point.x, linkBox.x1, linkBox.x2);
  return bumpYBezier(solvedT, linkBox.y1, linkBox.y2);
}

const isSankeyNodeHit = (point: { readonly x: number; readonly y: number }, nodeBox: { readonly x0?: number; readonly x1?: number; readonly y0?: number; readonly y1?: number }): boolean => {
  const x0 = nodeBox.x0 ?? 0;
  const x1 = nodeBox.x1 ?? 0;
  const y0 = nodeBox.y0 ?? 0;
  const y1 = nodeBox.y1 ?? 0;
  return point.x >= x0 && point.x <= x1 && point.y >= y0 && point.y <= y1;
};

const isSankeyLinkHit = (point: { readonly x: number; readonly y: number }, linkBox: { readonly x1: number; readonly y1: number; readonly x2: number; readonly y2: number; readonly width: number }): boolean => {
  const minX = Math.min(linkBox.x1, linkBox.x2);
  const maxX = Math.max(linkBox.x1, linkBox.x2);
  if (point.x < minX || point.x > maxX) {return false;}
  const curveY = bumpXY(point, linkBox);
  const halfWidth = Math.max(1, linkBox.width) / 2;
  return Math.abs(point.y - curveY) <= halfWidth + LINK_HIT_SLOP;
};

// Nodes paint atop links, so nodes win the hit test.
const findHoveredSankeyTarget = (point: { readonly x: number; readonly y: number }, nodes: readonly SankeyNodeHitBox[], links: readonly SankeyLinkHitBox[]): SankeyHitTarget | null => {
  for (let i = 0; i < nodes.length; i += 1) {
    const nodeBox = nodes.at(i);
    if (nodeBox !== undefined && isSankeyNodeHit(point, nodeBox)) {return { index: i, type: "node" };}
  }
  for (let i = links.length - 1; i >= 0; i -= 1) {
    const linkBox = links.at(i);
    if (linkBox !== undefined && isSankeyLinkHit(point, linkBox)) {return { index: i, type: "link" };}
  }
  return null;
}

export { computeNodeHoverConnected, computeLinkHoverConnected, findHoveredSankeyTarget };
export type { SankeyHoverResult, SankeyNodeHitBox, SankeyLinkHitBox, SankeyHitTarget };
