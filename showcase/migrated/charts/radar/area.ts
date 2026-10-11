import { CHART_PALETTE } from "../kit/palette";

export interface RadarAreaProps {
  readonly index: number;
  readonly color?: string;
  readonly showPoints?: boolean;
  readonly showStroke?: boolean;
  readonly showGlow?: boolean;
  readonly className?: string;
}

// Role marker: a declarative config carrier, read once by RadarChart and never rendered.
export const RadarArea = (_props: Readonly<RadarAreaProps>): null => null;
RadarArea.displayName = "RadarArea";

export const DEFAULT_RADAR_COLORS: string[] = [...CHART_PALETTE];

export const radarAreaColor = (a: RadarAreaProps, data: readonly { readonly color?: string }[]): string =>
  a.color ?? data.at(a.index)?.color ?? DEFAULT_RADAR_COLORS.at(a.index % DEFAULT_RADAR_COLORS.length) ?? "var(--chart-1)";
