"use client";

import { CHART_ROLE } from "./children";
import type { PatternPresetId } from "./internal/pattern-preset";
import type { ReferenceAreaIfOverflow } from "./internal/reference-area-geometry";

export type ReferenceAreaStrokeStyle = "solid" | "dashed";
export type { ReferenceAreaIfOverflow };

export interface ReferenceAreaProps {
  y1?: number;
  y2?: number;
  x1?: Date | number;
  x2?: Date | number;
  yAxisId?: string | number;
  fill?: string;
  fillOpacity?: number;
  pattern?: PatternPresetId;
  patternColor?: string;
  patternScale?: number;
  patternStrokeWidth?: number;
  patternRadius?: number;
  patternComplement?: boolean;
  patternFill?: string;
  patternDotFill?: boolean;
  patternTileBackground?: string;
  stroke?: string;
  strokeWidth?: number;
  strokeStyle?: ReferenceAreaStrokeStyle;
  strokeDasharray?: string;
  fadeEdges?: boolean;
  fadeEdgesLength?: number;
  axisLabelColor?: string;
  showMarkers?: boolean;
  markerColor?: string;
  markerSize?: number;
  ifOverflow?: ReferenceAreaIfOverflow;
  className?: string;
}

export function ReferenceArea(_props: ReferenceAreaProps): null {
  return null;
}
(ReferenceArea as unknown as Record<symbol, string>)[CHART_ROLE] = "referenceArea";
ReferenceArea.displayName = "ReferenceArea";

export default ReferenceArea;
