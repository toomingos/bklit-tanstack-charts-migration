export interface RadarAxisProps {
  readonly stroke?: string;
  readonly strokeOpacity?: number;
  readonly className?: string;
}

// Role marker: a declarative config carrier, read once by RadarChart and never rendered.
export const RadarAxis = (_props: Readonly<RadarAxisProps>): null => null;
RadarAxis.displayName = "RadarAxis";
