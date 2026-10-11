// Config-carrier marker. Carrier children render nothing: the chart reads their
// props with React.Children (see ../kit/read-children) via this role marker.
import type { ReactElement } from "react";

export const CHART_ROLE = Symbol.for("migrated.chartRole");

export interface CarrierComponent<Props> {
  (props: Props): ReactElement | null;
  [CHART_ROLE]?: string;
  displayName: string;
}

/** A null-rendering component tagged with a role and display name. */
export const defineCarrier = <Props extends object>(role: string, displayName: string): CarrierComponent<Props> =>
  Object.assign((_props: Props): ReactElement | null => null, { [CHART_ROLE]: role, displayName });
