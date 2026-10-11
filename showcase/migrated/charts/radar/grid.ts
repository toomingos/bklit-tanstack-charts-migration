export interface RadarGridProps {
  readonly showLabels?: boolean;
  readonly stroke?: string;
  readonly strokeOpacity?: number;
  readonly className?: string;
}

// Role marker: a declarative config carrier, read once by RadarChart and never rendered.
export const RadarGrid = (_props: Readonly<RadarGridProps>): null => null;
RadarGrid.displayName = "RadarGrid";
