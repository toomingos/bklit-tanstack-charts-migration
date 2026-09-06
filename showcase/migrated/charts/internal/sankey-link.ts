// Config carrier for SankeyChart link styling; read via displayName, never rendered.
import { createElement } from "react";
import type { ReactElement, ReactNode } from "react";
import type { SankeyPropLink, SankeyPropNode } from "./sankey-layout";

interface SankeyLinkProps {
  stroke?: string;
  readonly strokeOpacity?: number;
  readonly fadedOpacity?: number;
  readonly useGradient?: boolean;
  readonly getNodeColor?: (node: SankeyPropNode, index: number) => string;
  readonly getLinkColor?: (link: SankeyPropLink, index: number) => string;
  readonly patterns?: ReactNode;
  readonly getLinkPattern?: (link: SankeyPropLink, index: number) => string | null | undefined;
}

const SankeyLink = (_props: Readonly<SankeyLinkProps>): ReactElement => createElement("g");

SankeyLink.displayName = "SankeyLink";

export { SankeyLink };
export type { SankeyLinkProps };
