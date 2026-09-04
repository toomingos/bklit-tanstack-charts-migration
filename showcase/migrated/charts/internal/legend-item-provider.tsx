"use client";

import { LegendItemContext } from "./legend-context-state";
import type { ReactElement } from "react";
import type { LegendItemContextValue } from "./legend-context-state";

// Thin item-provider wrapper kept in its own file so the barrel stays component-free.
const LegendItemProvider = ({
  children,
  value,
}: {
  readonly children: React.ReactNode;
  readonly value: LegendItemContextValue;
}): ReactElement => (
    <LegendItemContext.Provider value={value}>
      {children}
    </LegendItemContext.Provider>
  );

export { LegendItemProvider };
