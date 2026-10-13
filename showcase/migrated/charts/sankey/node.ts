import { createElement, Fragment } from "react";
import type { ReactElement } from "react";
import type { LabelOrientation } from "./marks";
import type { SankeyPropNode } from "./types";

/** Label direction: `"horizontal"` places labels left or right of the nodes, `"vertical"` rotates them 90 degrees along the node edge. */
export type SankeyLabelOrientation = LabelOrientation;

// Config carrier: read once by SankeyChart, never rendered.
/** Props of `SankeyNode`. */
export interface SankeyNodeProps {
  /**
   * Fill color of the nodes.
   * @default the theme chart colors, by node
   */
  readonly fill?: string;
  /**
   * Corner radius of the nodes in pixels.
   * @default 4
   */
  readonly lineCap?: number;
  /**
   * Opacity of nodes not connected to the hovered node or link.
   * @default 0.4
   */
  readonly fadedOpacity?: number;
  /**
   * Show node names.
   * @default true
   */
  readonly showLabels?: boolean;
  /**
   * Show node values under the names.
   * @default true
   */
  readonly showValueLabels?: boolean;
  /**
   * Reading direction of the labels outside the nodes.
   * @default "horizontal"
   */
  readonly labelOrientation?: SankeyLabelOrientation;
  /** Returns the color of a node. Overrides `fill`. */
  readonly getNodeColor?: (node: SankeyPropNode, index: number) => string;
}

/** Configures how nodes and their labels are drawn. Renders nothing itself; `SankeyChart` reads its props. */
export const SankeyNode = (_props: Readonly<SankeyNodeProps>): ReactElement => createElement(Fragment);
SankeyNode.displayName = "SankeyNode";
