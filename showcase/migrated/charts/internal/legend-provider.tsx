"use client";

import { LegendContext } from "./legend-context-state";
import type { ReactElement } from "react";
import type { LegendContextValue } from "./legend-context-state";

// Thin provider wrapper kept in its own file so the barrel stays component-free.
const LegendProvider = ({
  children,
  value,
}: {
  readonly children: React.ReactNode;
  readonly value: LegendContextValue;
}): ReactElement => (
    <LegendContext.Provider value={value}>{children}</LegendContext.Provider>
  );

export { LegendProvider };
