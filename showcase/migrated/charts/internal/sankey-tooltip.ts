// Config carrier for SankeyChart tooltip formatting; read via displayName, never rendered.
import type { ReactElement, ReactNode } from "react";
import type { SankeyPropLink, SankeyPropNode } from "./sankey-layout";

interface SankeyTooltipProps {
  readonly nodeContent?: (props: { node: SankeyPropNode; index: number }) => ReactNode;
  readonly linkContent?: (props: { link: SankeyPropLink; index: number }) => ReactNode;
  readonly formatValue?: (value: number) => string;
  readonly className?: string;
}

const SankeyTooltip = (_props: Readonly<SankeyTooltipProps>): ReactElement | null => null;

SankeyTooltip.displayName = "SankeyTooltip";

export { SankeyTooltip };
export type { SankeyTooltipProps };
