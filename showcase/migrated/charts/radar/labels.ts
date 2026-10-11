export interface RadarLabelsProps {
  readonly offset?: number;
  readonly fontSize?: number;
  readonly interactive?: boolean;
  readonly className?: string;
}

// Role marker: a declarative config carrier, read once by RadarChart and never rendered.
export const RadarLabels = (_props: Readonly<RadarLabelsProps>): null => null;
RadarLabels.displayName = "RadarLabels";
