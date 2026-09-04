import type { ReactElement, ReactNode } from "react";
import { MarkerActiveContext } from "./active-markers-store";
import type { ActiveMarkersStore } from "./active-markers-store";

interface MarkerActiveTooltipProviderProps {
  readonly store: ActiveMarkersStore;
  readonly children: ReactNode;
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
