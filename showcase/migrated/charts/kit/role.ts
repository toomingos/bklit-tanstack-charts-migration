// Config-carrier marker. A carrier draws nothing: the chart reads direct carriers' props with React.Children (read-children.ts) via this role marker,
// and a carrier rendered inside a user component registers its props instead (carrier-registry.tsx).
import type { ReactElement } from "react";
import { useCarrierRegistration } from "./carrier-registry";

export const CHART_ROLE = Symbol.for("migrated.chartRole");

export interface CarrierComponent<Props> {
  (props: Props): ReactElement | null;
  [CHART_ROLE]?: string;
  displayName: string;
}

/** A null-rendering component tagged with a role and display name. */
export const defineCarrier = <Props extends object>(role: string, displayName: string): CarrierComponent<Props> =>
  Object.assign(
    (props: Props): ReactElement | null => {
      // SAFETY: React hands a component its props object; carrier props are plain records.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- see SAFETY above
      useCarrierRegistration(role, displayName, props as Readonly<Record<string, unknown>>);
      return null;
    },
    { [CHART_ROLE]: role, displayName },
  );
