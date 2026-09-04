import type {
  SankeyLink as D3SankeyLink,
  SankeyNode as D3SankeyNode,
} from "d3-sankey";

type LaidOutNodeDatum = {
  readonly name: string;
  readonly category?: string;
};

type LaidOutLinkDatum = {
  readonly value: number;
};

type LaidOutNode = D3SankeyNode<LaidOutNodeDatum, LaidOutLinkDatum>;

type LaidOutLink = D3SankeyLink<LaidOutNodeDatum, LaidOutLinkDatum>;

const SANKEY_LABEL_OFFSET = 12;
const SANKEY_VALUE_LABEL_GAP = 16;

export type { LaidOutNode, LaidOutLink };
export { SANKEY_LABEL_OFFSET, SANKEY_VALUE_LABEL_GAP };
