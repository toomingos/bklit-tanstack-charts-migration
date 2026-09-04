// Config carrier for SankeyChart node styling; read via displayName, never rendered.
import type { LaidOutNode } from "./sankey-layout";

type SankeyLabelOrientation = "horizontal" | "vertical";

interface SankeyNodeProps {
  readonly fill?: string;
  readonly lineCap?: number;
  readonly fadedOpacity?: number;
  readonly showLabels?: boolean;
  readonly showValueLabels?: boolean;
  readonly labelOrientation?: SankeyLabelOrientation;
  readonly getNodeColor?: (node: LaidOutNode, index: number) => string;
}

const SankeyNode = (_props: Readonly<SankeyNodeProps>): undefined => undefined;

SankeyNode.displayName = "SankeyNode";

export { SankeyNode };
export type { SankeyLabelOrientation, SankeyNodeProps };
