import type { PatternPresetId } from "./pattern-preset";
import type { ReferenceAreaIfOverflow } from "./reference-area-geometry";

// Canonical <ReferenceArea> props: owned here so internal extractors import downward.
type ReferenceAreaStrokeStyle = "solid" | "dashed";

interface ReferenceAreaProps {
  readonly y1?: number;
  readonly y2?: number;
  readonly x1?: Readonly<Date> | number;
  readonly x2?: Readonly<Date> | number;
  readonly yAxisId?: string | number;
  readonly fill?: string;
  readonly fillOpacity?: number;
  readonly pattern?: PatternPresetId;
  readonly patternColor?: string;
  readonly patternScale?: number;
  readonly patternStrokeWidth?: number;
  readonly patternRadius?: number;
  readonly patternComplement?: boolean;
  readonly patternFill?: string;
  readonly patternDotFill?: boolean;
  readonly patternTileBackground?: string;
  readonly stroke?: string;
  readonly strokeWidth?: number;
  readonly strokeStyle?: ReferenceAreaStrokeStyle;
  readonly strokeDasharray?: string;
  readonly fadeEdges?: boolean;
  readonly fadeEdgesLength?: number;
  readonly axisLabelColor?: string;
  readonly showMarkers?: boolean;
  readonly markerColor?: string;
  readonly markerSize?: number;
  readonly ifOverflow?: ReferenceAreaIfOverflow;
  readonly className?: string;
}

export type { ReferenceAreaStrokeStyle, ReferenceAreaProps };
