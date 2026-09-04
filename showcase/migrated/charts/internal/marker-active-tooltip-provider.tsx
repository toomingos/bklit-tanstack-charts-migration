import type { ReactElement, ReactNode } from "react";
import { MarkerActiveContext } from "./active-markers-store";
import type { ActiveMarkersStore } from "./active-markers-store";

// Hosts publish the focused tooltip date here; consumers read it via hooks.
// The active-marker store and its hooks live in the sibling file active-markers-store.ts
// So this module only exports its provider component (see react(only-export-components)).

interface MarkerActiveTooltipProviderProps {
  store: ActiveMarkersStore;
  children: ReactNode;
}

// Makes the host's live tooltip date available to useActiveMarkers consumers.
const MarkerActiveTooltipProvider = ({
  store,
  children,
}: Readonly<MarkerActiveTooltipProviderProps>): ReactElement => (
  <MarkerActiveContext.Provider value={store}>{children}</MarkerActiveContext.Provider>
);
MarkerActiveTooltipProvider.displayName = "MarkerActiveTooltipProvider";

export { MarkerActiveTooltipProvider };
export type { MarkerActiveTooltipProviderProps };
