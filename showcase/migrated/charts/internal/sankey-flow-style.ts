import type { LaidOutNode } from "./sankey-layout";
import type { LinkRow } from "./sankey-label-nodes";

// Hover boost applied to the connected flow stroke; dimmed flows fall back to fadedLinkOpacity.
const SANKEY_HOVER_STROKE_BOOST = 1.3;

interface SankeyFlowStrokeInput {
  readonly laidOutNodes: readonly Readonly<LaidOutNode>[];
  readonly nodeColorFn: (node: Readonly<LaidOutNode>, index: number) => string;
  readonly shouldUseGradient: boolean;
  readonly strokeOverride: string | undefined;
}

const resolveSankeyFlowStroke = (input: Readonly<SankeyFlowStrokeInput>, flowRow: Readonly<LinkRow>, index: number): string => {
  if (input.shouldUseGradient) {return `url(#sankey-grad-${index})`;}
  return input.strokeOverride ?? input.nodeColorFn(input.laidOutNodes[flowRow.sourceIndex], flowRow.sourceIndex);
};

interface SankeyFlowOpacityInput {
  readonly anyHovered: boolean;
  readonly linkConnected: readonly boolean[];
  readonly strokeOpacity: number;
  readonly fadedLinkOpacity: number;
}

const resolveSankeyFlowOpacity = (input: Readonly<SankeyFlowOpacityInput>, index: number): number => {
  if (!input.anyHovered) {return input.strokeOpacity;}
  return input.linkConnected[index] ? Math.min(1, input.strokeOpacity * SANKEY_HOVER_STROKE_BOOST) : input.fadedLinkOpacity;
};

export { resolveSankeyFlowStroke, resolveSankeyFlowOpacity };
export type { SankeyFlowOpacityInput, SankeyFlowStrokeInput };
