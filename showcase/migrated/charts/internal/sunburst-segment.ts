import { memo } from "react";
import type { NamedExoticComponent, ReactElement } from "react";

interface SunburstSegmentProps {
  readonly index: number;
  readonly color?: string;
  readonly fill?: string;
  readonly fillOpacity?: number;
}

const RenderSunburstSegment = (_props: SunburstSegmentProps): ReactElement | null => null;

const SunburstSegment: NamedExoticComponent<SunburstSegmentProps> = memo(RenderSunburstSegment);

SunburstSegment.displayName = "SunburstSegment";

export { SunburstSegment };
export type { SunburstSegmentProps };
