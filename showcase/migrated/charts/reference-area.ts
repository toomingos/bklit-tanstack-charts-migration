"use client";

import type { ReactElement } from "react";
import { CHART_ROLE } from "./children";
import type { ReferenceAreaProps } from "./internal/reference-area-props";

// Config-carrier marker declared on the component type (children.tsx
// ChartChildComponent pattern), so attaching the role needs no assertion.
interface ReferenceAreaCarrier {
  (props: Readonly<ReferenceAreaProps>): ReactElement | null;
  [CHART_ROLE]?: string;
  displayName: string;
}

const ReferenceArea: ReferenceAreaCarrier = Object.assign(
  (_props: Readonly<ReferenceAreaProps>): ReactElement | null => null,
  { [CHART_ROLE]: "referenceArea", displayName: "ReferenceArea" },
);

export { ReferenceArea };
export type { ReferenceAreaStrokeStyle, ReferenceAreaProps } from "./internal/reference-area-props";
export type { ReferenceAreaIfOverflow } from "./internal/reference-area-geometry";
