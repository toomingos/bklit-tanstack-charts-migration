// Config carrier for SankeyChart link styling; read via displayName, never rendered.
interface SankeyLinkProps {
  stroke?: string;
  readonly strokeOpacity?: number;
  readonly fadedOpacity?: number;
  readonly useGradient?: boolean;
}

const SankeyLink = (_props: Readonly<SankeyLinkProps>): null => null;

SankeyLink.displayName = "SankeyLink";

export { SankeyLink };
export type { SankeyLinkProps };
