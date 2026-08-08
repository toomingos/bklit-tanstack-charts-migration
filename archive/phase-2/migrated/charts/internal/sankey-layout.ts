// d3-sankey layout wrapper for migrated SankeyChart.
//
// Reproduces bklit's own d3-sankey call (sankey-chart.tsx):
//   sankey<SankeyNodeDatum, SankeyLinkDatum>()
//     .nodeWidth(nodeWidth)
//     .nodePadding(nodePadding)
//     .nodeAlign(sankeyCenter)
//     .extent([[0,0],[innerWidth,innerHeight]])
//
// bklit does NOT set .iterations() — uses d3-sankey default (6).
//
// The key difference: this wrapper receives pixel bounds directly (chart.x/y/
// width/height from TanStack's MarkRenderContext) instead of a [0,0]-origin
// extent — same approach as bench/app/src/scenarios/tanstack-sankey.tsx.
//
// DEFENSIVELY CLONES input data before passing to d3-sankey, which mutates
// node/link objects in place (x0/x1/y0/y1/sourceLinks/targetLinks are
// written directly onto the input objects).

import { sankey, sankeyCenter, sankeyLinkHorizontal } from "d3-sankey";
import type {
  SankeyGraph,
  SankeyLink as D3SankeyLink,
  SankeyNode as D3SankeyNode,
} from "d3-sankey";

// d3-sankey generic types — L (link extra) must satisfy `{ [key: string]: unknown }`
// to be compatible with our link data shape (bench/data.ts SeededSankeyLink).
// eslint-disable-next-line @typescript-eslint/no-empty-interface
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

export interface SankeyLayoutInput {
  nodes: { name: string; category?: string; [key: string]: unknown }[];
  links: { source: number; target: number; value: number; [key: string]: unknown }[];
}

export interface SankeyLayoutOutput {
  nodes: LaidOutNode[];
  links: LaidOutLink[];
}

export interface SankeyLayoutBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Compute d3-sankey layout from input data + pixel bounds.
 *
 * Clones input defensively — d3-sankey mutates `x0/x1/y0/y1`,
 * `sourceLinks`/`targetLinks`, and restructures `source`/`target`
 * from index to node-object in place. Always call with fresh data.
 */
export function computeSankeyLayout(
  data: SankeyLayoutInput,
  bounds: SankeyLayoutBounds,
  nodeWidth: number,
  nodePadding: number,
): SankeyLayoutOutput {
  // Defensive clone — d3-sankey mutates everything in place.
  const clonedData: SankeyGraph<
    { name: string; category?: string; [key: string]: unknown },
    SankeyLinkExtra
  > = {
    nodes: data.nodes.map((n) => ({ ...n })),
    links: data.links.map((l) => ({ ...l })),
  };

  const layout = sankey<
    { name: string; category?: string; [key: string]: unknown },
    SankeyLinkExtra
  >()
    .nodeWidth(nodeWidth)
    .nodePadding(nodePadding)
    .nodeAlign(sankeyCenter)
    .extent([
      [bounds.x, bounds.y],
      [
        bounds.x + Math.max(1, bounds.width),
        bounds.y + Math.max(1, bounds.height),
      ],
    ]);

  const result = layout(clonedData);

  return {
    nodes: result.nodes as LaidOutNode[],
    links: result.links as LaidOutLink[],
  };
}

/**
 * d3-sankey's own link path generator — produces a cubic Bézier
 * horizontal centerline (`M x0,y0 C ... x1,y1`) from the link's
 * source/target node positions + width.
 */
export const SANKEY_LINK_PATH = sankeyLinkHorizontal<
  { name: string; category?: string; [key: string]: unknown },
  SankeyLinkExtra
>();

// Note: d3-sankey's @types export SankeyNode and SankeyLink (not prefixed with D3).
// The aliases D3SankeyNode/D3SankeyLink are re-exported via the import at the top of this file.
