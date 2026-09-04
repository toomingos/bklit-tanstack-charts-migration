// SunburstLabels — config carrier for sunburst segments.
// Extracted from sunburst-chart.tsx (R6 module split).

// ---------------------------------------------------------------------------
// Config carrier — returns null, classified by displayName in sunburst-chart
// ---------------------------------------------------------------------------

interface SunburstLabelsProps {
  fontSize?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  className?: string;
}

const SunburstLabels = (_props: SunburstLabelsProps): null => null;

SunburstLabels.displayName = "SunburstLabels";

export { SunburstLabels };
export type { SunburstLabelsProps };
