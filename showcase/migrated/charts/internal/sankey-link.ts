// Config carrier for SankeyChart link styling; read via displayName, never rendered.
interface SankeyLinkProps {
  stroke?: string;
  strokeOpacity?: number;
  fadedOpacity?: number;
  useGradient?: boolean;
}

const SankeyLink = (_props: Readonly<SankeyLinkProps>): null => null;

SankeyLink.displayName = "SankeyLink";

export { SankeyLink };
export type { SankeyLinkProps };
