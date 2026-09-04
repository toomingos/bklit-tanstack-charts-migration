"use client";

import { useMemo } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { CHART_CHILD_PASSTHROUGH } from "./children-extract";
import { ProfitLossLegendHoverContext } from "./profit-loss-legend-hover-context";
import type { ProfitLossLegendHoverContextValue } from "./profit-loss-legend-hover-context";

// Marker declared on the component type. Same pattern as
// ChartChildComponent in ../children: the detector reads
// CHART_CHILD_PASSTHROUGH off the function, so declaring it keeps the
// Attachment site assertion-free.
interface ProfitLossLegendHoverProviderComponent {
  (props: { readonly hoveredIndex: number | null; readonly children: ReactNode }): ReactElement;
  [CHART_CHILD_PASSTHROUGH]?: boolean;
}

const ProfitLossLegendHoverProvider: ProfitLossLegendHoverProviderComponent = ({
  hoveredIndex,
  children,
}: {
  readonly hoveredIndex: number | null;
  readonly children: ReactNode;
}): ReactElement => {
  const value = useMemo((): ProfitLossLegendHoverContextValue => ({ hoveredIndex }), [hoveredIndex]);
  return (
    <ProfitLossLegendHoverContext.Provider value={value}>
      {children}
    </ProfitLossLegendHoverContext.Provider>
  );
};

ProfitLossLegendHoverProvider[CHART_CHILD_PASSTHROUGH] = true;

export { ProfitLossLegendHoverProvider };
