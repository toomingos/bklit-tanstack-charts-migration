import type { LaidOutNode } from "./sankey-layout";
import type { LinkRow } from "./sankey-label-nodes";

// Zero-height bboxes ignore objectBoundingBox gradients.
// Flat links paint a solid source-colour stroke.
const SANKEY_FLAT_LINK_Y_EPSILON = 0.5;

const sankeyFlowGradientId = (index: number): string => `sankey-flow-${index}`;

interface SankeyFlowStrokeInput {
  readonly laidOutNodes: readonly Readonly<LaidOutNode>[];
  readonly nodeColorFn: (node: Readonly<LaidOutNode>, index: number) => string;
  readonly shouldUseGradient: boolean;
  readonly strokeOverride: string | undefined;
}

const resolveSankeyFlowStroke = (input: Readonly<SankeyFlowStrokeInput>, flowRow: Readonly<LinkRow>, index: number): string => {
  const sourceColor = input.nodeColorFn(input.laidOutNodes[flowRow.sourceIndex], flowRow.sourceIndex);
  if (!input.shouldUseGradient) {return input.strokeOverride ?? sourceColor;}
  if (Math.abs(flowRow.y1 - flowRow.y2) < SANKEY_FLAT_LINK_Y_EPSILON) {return sourceColor;}
  return `url(#${sankeyFlowGradientId(index)})`;
};

export { resolveSankeyFlowStroke, sankeyFlowGradientId };
export type { SankeyFlowStrokeInput };
