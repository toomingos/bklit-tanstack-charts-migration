"use client";

import { useMemo } from "react";
import type { ReactElement, ReactNode } from "react";
import { ChartLegendHoverContext } from "./chart-legend-hover-context";

const ChartLegendHoverProvider = ({
  hoveredIndex,
  onHoverChange,
  children,
}: {
  hoveredIndex: number | null;
  onHoverChange: (index: number | null) => void;
  children: ReactNode;
}): ReactElement => {
  const value = useMemo(
    () => ({ hoveredIndex, setHoveredIndex: onHoverChange }),
    [hoveredIndex, onHoverChange]
  );

  return (
    <ChartLegendHoverContext.Provider value={value}>
      {children}
    </ChartLegendHoverContext.Provider>
  );
}

export { ChartLegendHoverProvider };
