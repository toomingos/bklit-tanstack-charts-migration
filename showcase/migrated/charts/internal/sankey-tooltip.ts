// Config carrier for SankeyChart tooltip formatting; read via displayName, never rendered.
interface SankeyTooltipProps {
  formatValue?: (value: number) => string;
  className?: string;
}

const SankeyTooltip = (_props: Readonly<SankeyTooltipProps>): null => null;

SankeyTooltip.displayName = "SankeyTooltip";

export { SankeyTooltip };
export type { SankeyTooltipProps };
