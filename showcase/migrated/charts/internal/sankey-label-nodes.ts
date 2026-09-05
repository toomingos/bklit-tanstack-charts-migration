import type { SankeyLink as NativeSankeyLink, SankeyNode as NativeSankeyNode } from "@tanstack/charts/network/sankey";
import type { LaidOutNode } from "./sankey-layout";
import { intFmt } from "./formatters";

// Sankey label geometry (name + value labels per node).
// Scene keys sankey:nlabel/vlabel:i feed the WAAPI reveal's DOM contract.
const SANKEY_LABEL_ROTATE_CW = 90;
const SANKEY_DIMMED_VALUE_OPACITY_SCALE = 0.8;
const SANKEY_VALUE_LABEL_FILL_OPACITY = 0.6;
const SANKEY_NAME_FONT_SIZE = 13;
const SANKEY_VALUE_FONT_SIZE = 11;
const SANKEY_LABEL_FILL = "var(--foreground)";

type SankeyNodeData = {
  readonly name: string;
  readonly category?: string;
} & Partial<Record<string, unknown>>;

type SankeyLinkData = {
  readonly source: number;
  readonly target: number;
  readonly value: number;
} & Partial<Record<string, unknown>>;

type NodeRow = NativeSankeyNode<SankeyNodeData, SankeyLinkData>;
type LinkRow = NativeSankeyLink<SankeyNodeData, SankeyLinkData>;

const toLaidOutNode = (row: Readonly<NodeRow>): LaidOutNode => (
  {
    ...(row.data),
    index: row.index,
    value: row.value,
    x0: row.x0,
    x1: row.x1,
    y0: row.y0,
    y1: row.y1,
  }
);

const sankeyDisplayValue = (category: string | undefined, nodeIndex: number, links: readonly { readonly sourceIndex: number; readonly targetIndex: number; readonly value?: number }[]): number => {
  let total = 0;
  for (const linkRow of links) {
    const isSourceMatch = category === "source" && linkRow.sourceIndex === nodeIndex;
    const isTargetMatch = category !== "source" && linkRow.targetIndex === nodeIndex;
    if (isSourceMatch || isTargetMatch) {total += linkRow.value ?? 0;}
  }
  return total;
}

interface SankeyNodeFrame {
  readonly nodeX: number;
  readonly nodeW: number;
  readonly centerY: number;
  readonly isLeftSide: boolean;
  readonly nodeName: string;
}

interface SankeyNodeFrameParams {
  readonly node: Omit<Readonly<LaidOutNode>, "name"> & { readonly name?: string };
  readonly index: number;
  readonly chartX: number;
  readonly chartWidth: number;
}

const resolveSankeyNodeFrame = (params: Readonly<SankeyNodeFrameParams>): SankeyNodeFrame => {
  const { node, index, chartX, chartWidth } = params;
  const nodeX = node.x0 ?? 0;
  const nodeY = node.y0 ?? 0;
  const nodeW = Math.max(0, (node.x1 ?? 0) - nodeX);
  const nodeH = Math.max(0, (node.y1 ?? 0) - nodeY);
  // LaidOutNode already carries name/category from the node datum generic.
  // No assertion is needed to read them.
  return {
    centerY: nodeY + nodeH / 2,
    isLeftSide: nodeX - chartX < chartWidth / 2,
    nodeName: node.name ?? `Node ${index}`,
    nodeW,
    nodeX,
  };
};

const formatSankeyValueLabel = (displayVal: number): string => `${intFmt(displayVal)} sessions`;

export {
  formatSankeyValueLabel,
  resolveSankeyNodeFrame,
  sankeyDisplayValue,
  toLaidOutNode,
  SANKEY_DIMMED_VALUE_OPACITY_SCALE,
  SANKEY_LABEL_FILL,
  SANKEY_LABEL_ROTATE_CW,
  SANKEY_NAME_FONT_SIZE,
  SANKEY_VALUE_FONT_SIZE,
  SANKEY_VALUE_LABEL_FILL_OPACITY,
};
export type { LinkRow, NodeRow, SankeyLinkData, SankeyNodeData };
export type { LaidOutLink } from "./sankey-layout";
