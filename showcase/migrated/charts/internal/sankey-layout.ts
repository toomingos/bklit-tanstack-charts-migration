import type {
  SankeyLink as D3SankeyLink,
  SankeyNode as D3SankeyNode,
} from "d3-sankey";

type SankeyLinkExtra = Record<string, unknown>;

type LaidOutNode = D3SankeyNode<
  { name: string; category?: string; [key: string]: unknown },
  SankeyLinkExtra
>;

type LaidOutLink = D3SankeyLink<
  { name: string; category?: string; [key: string]: unknown },
  SankeyLinkExtra
>;

const SANKEY_LABEL_OFFSET = 12;
const SANKEY_VALUE_LABEL_GAP = 16;

export type { LaidOutNode, LaidOutLink };
export { SANKEY_LABEL_OFFSET, SANKEY_VALUE_LABEL_GAP };
