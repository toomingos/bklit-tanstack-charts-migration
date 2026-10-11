"use client";

import type { ReactElement } from "react";
import { CHART_ROLE } from "./children";
import { enableOverlays } from "./kit/cartesian/enable-overlays";
import type { PatternPresetId } from "./kit/pattern/pattern-preset-helpers";

type ReferenceAreaIfOverflow = "hidden" | "visible" | "discard";

type ReferenceAreaStrokeStyle = "solid" | "dashed";

/** Pixel rectangle of a reference area inside the plot (bklit reference-area-geometry.ts:3). */
interface ReferenceAreaRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

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
  (props: Readonly<ReferenceAreaProps>): ReactElement | null;
  [CHART_ROLE]?: string;
  displayName: string;
}

enableOverlays();

const ReferenceArea: ReferenceAreaCarrier = Object.assign(
  (_props: Readonly<ReferenceAreaProps>): ReactElement | null => null,
  { [CHART_ROLE]: "referenceArea", displayName: "ReferenceArea" },
);

export { ReferenceArea };
export type { ReferenceAreaStrokeStyle, ReferenceAreaProps, ReferenceAreaIfOverflow, ReferenceAreaRect };
