import { createElement, Fragment } from "react";
import type { ReactElement, ReactNode } from "react";
import type { SankeyPropLink, SankeyPropNode } from "./types";

// Config carrier: read once by SankeyChart, never rendered.
export interface SankeyLinkProps {
  stroke?: string;
  readonly strokeOpacity?: number;
  readonly fadedOpacity?: number;
  readonly useGradient?: boolean;
  readonly getNodeColor?: (node: SankeyPropNode, index: number) => string;
  readonly getLinkColor?: (link: SankeyPropLink, index: number) => string;
  readonly patterns?: ReactNode;
  readonly getLinkPattern?: (link: SankeyPropLink, index: number) => string | null | undefined;
}

export const SankeyLink = (_props: Readonly<SankeyLinkProps>): ReactElement => createElement(Fragment);
SankeyLink.displayName = "SankeyLink";
