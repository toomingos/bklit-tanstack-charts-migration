"use client";

import { CHART_ROLE } from "./children";
import type { ReferenceAreaProps } from "./internal/reference-area-props";

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
export type { ReferenceAreaStrokeStyle, ReferenceAreaProps } from "./internal/reference-area-props";
export type { ReferenceAreaIfOverflow } from "./internal/reference-area-geometry";
