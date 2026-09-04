interface SunburstSegmentProps {
  readonly index: number;
  readonly color?: string;
  readonly fill?: string;
  readonly fillOpacity?: number;
}

const SunburstSegment = (_props: SunburstSegmentProps): null => null;

SunburstSegment.displayName = "SunburstSegment";

export { SunburstSegment };
export type { SunburstSegmentProps };
