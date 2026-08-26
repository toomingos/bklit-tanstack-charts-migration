// Layout types + shared constants for the migrated SankeyChart.
//
// T-D13: layout itself is now computed by TanStack-native sankeyDiagram()
// (see internal/sankey-mark.ts) — the hand-rolled d3-sankey wrapper
// (computeSankeyLayout) and its defensive input clone are retired. The
// native layout never mutates input rows (fresh working records per pass;
// frozen output rows), so no caller-side clone is needed. These d3-sankey
// shaped type aliases stay because the public getNodeColor contract and
// laidOutNodesRef consumers were written against them.

import type {
  SankeyLink as D3SankeyLink,
  SankeyNode as D3SankeyNode,
} from "d3-sankey";

// d3-sankey generic types — L (link extra) must satisfy `{ [key: string]: unknown }`
// to be compatible with our link data shape.
interface SankeyLinkExtra {
  [key: string]: unknown;
}

export type LaidOutNode = D3SankeyNode<
  { name: string; category?: string; [key: string]: unknown },
  SankeyLinkExtra
>;

export type LaidOutLink = D3SankeyLink<
  { name: string; category?: string; [key: string]: unknown },
  SankeyLinkExtra
>;

export const SANKEY_LABEL_OFFSET = 12;
export const SANKEY_VALUE_LABEL_GAP = 16;
