import { createElement, Fragment } from "react";
import type { ReactElement } from "react";
import type { LabelOrientation } from "./marks";
import type { SankeyPropNode } from "./types";

export type SankeyLabelOrientation = LabelOrientation;

// Config carrier: read once by SankeyChart, never rendered.
export interface SankeyNodeProps {
  readonly fill?: string;
  readonly lineCap?: number;
  readonly fadedOpacity?: number;
  readonly showLabels?: boolean;
  readonly showValueLabels?: boolean;
  readonly labelOrientation?: SankeyLabelOrientation;
  readonly getNodeColor?: (node: SankeyPropNode, index: number) => string;
}

export const SankeyNode = (_props: Readonly<SankeyNodeProps>): ReactElement => createElement(Fragment);
SankeyNode.displayName = "SankeyNode";
