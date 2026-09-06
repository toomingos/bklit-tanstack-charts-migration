// Config carrier for SankeyChart node styling; read via displayName, never rendered.
import { createElement } from "react";
import type { ReactElement } from "react";
import type { SankeyPropNode } from "./sankey-layout";

type SankeyLabelOrientation = "horizontal" | "vertical";

interface SankeyNodeProps {
  readonly fill?: string;
  readonly lineCap?: number;
  readonly fadedOpacity?: number;
  readonly showLabels?: boolean;
  readonly showValueLabels?: boolean;
  readonly labelOrientation?: SankeyLabelOrientation;
  readonly getNodeColor?: (node: SankeyPropNode, index: number) => string;
}

const SankeyNode = (_props: Readonly<SankeyNodeProps>): ReactElement => createElement("g");

SankeyNode.displayName = "SankeyNode";

export { SankeyNode };
export type { SankeyLabelOrientation, SankeyNodeProps };
