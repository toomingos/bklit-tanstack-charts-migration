// SunburstLabels — config carrier for sunburst segments.
// Extracted from sunburst-chart.tsx (R6 module split).
import { memo } from "react";
import type { NamedExoticComponent, ReactElement } from "react";

interface SunburstLabelsProps {
  readonly fontSize?: number;
  readonly fill?: string;
  stroke?: string;
  strokeWidth?: number;
  readonly className?: string;
}

const RenderSunburstLabels = (_props: SunburstLabelsProps): ReactElement | null => null;

const SunburstLabels: NamedExoticComponent<SunburstLabelsProps> = memo(RenderSunburstLabels);

SunburstLabels.displayName = "SunburstLabels";

export { SunburstLabels };
export type { SunburstLabelsProps };
