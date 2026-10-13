import { createElement, Fragment } from "react";
import type { ReactElement, ReactNode } from "react";
import type { SankeyPropLink, SankeyPropNode } from "./types";

// Config carrier: read once by SankeyChart, never rendered.
/** Props of `SankeyLink`. */
export interface SankeyLinkProps {
  /** Solid color for all links. Overrides the gradient. */
  stroke?: string;
  /**
   * Opacity of the links.
   * @default 0.5
   */
  readonly strokeOpacity?: number;
  /**
   * Opacity of links not connected to the hovered node or link.
   * @default 0.1
   */
  readonly fadedOpacity?: number;
  /**
   * Paint each link with a gradient from its source color to its target color.
   * @default true
   */
  readonly useGradient?: boolean;
  /** Returns the color of a node, used for the gradient ends. */
  readonly getNodeColor?: (node: SankeyPropNode, index: number) => string;
  /** Returns a solid color per link. Overrides the gradient. */
  readonly getLinkColor?: (link: SankeyPropLink, index: number) => string;
  /** Pattern definitions (SVG `<pattern>` elements) that links can reference by id through `getLinkPattern`. */
  readonly patterns?: ReactNode;
  /** Returns the id of a pattern to fill a link with, or `null`/`undefined` to use the gradient or solid color. A pattern wins over `stroke` and `getLinkColor`. */
  readonly getLinkPattern?: (link: SankeyPropLink, index: number) => string | null | undefined;
}

/** Configures how links are painted. Renders nothing itself; `SankeyChart` reads its props. */
export const SankeyLink = (_props: Readonly<SankeyLinkProps>): ReactElement => createElement(Fragment);
SankeyLink.displayName = "SankeyLink";
