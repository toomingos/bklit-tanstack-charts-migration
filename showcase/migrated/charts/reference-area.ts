"use client";

import { CHART_ROLE } from "./children";
import type { PatternPresetId } from "./internal/pattern-preset";
import type { ReferenceAreaIfOverflow } from "./internal/reference-area-geometry";

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

// Config-carrier marker declared on the component type (children.tsx
// ChartChildComponent pattern), so attaching the role needs no assertion.
interface ReferenceAreaCarrier {
  (props: Readonly<ReferenceAreaProps>): undefined;
  [CHART_ROLE]?: string;
  displayName?: string;
}

const ReferenceArea: ReferenceAreaCarrier = (_props: Readonly<ReferenceAreaProps>): undefined => undefined;
ReferenceArea[CHART_ROLE] = "referenceArea";
ReferenceArea.displayName = "ReferenceArea";

export { ReferenceArea };
export type { ReferenceAreaStrokeStyle, ReferenceAreaProps };
export type { ReferenceAreaIfOverflow } from "./internal/reference-area-geometry";
export default ReferenceArea;
