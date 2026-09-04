// Config carrier for SankeyChart node styling; read via displayName, never rendered.
import type { LaidOutNode } from "./sankey-layout";

type SankeyLabelOrientation = "horizontal" | "vertical";

interface SankeyNodeProps {
  fill?: string;
  lineCap?: number;
  fadedOpacity?: number;
  showLabels?: boolean;
  showValueLabels?: boolean;
  labelOrientation?: SankeyLabelOrientation;
  getNodeColor?: (node: LaidOutNode, index: number) => string;
}

const SankeyNode = (_props: Readonly<SankeyNodeProps>): undefined => undefined;

SankeyNode.displayName = "SankeyNode";

export { SankeyNode };
export type { SankeyLabelOrientation, SankeyNodeProps };
