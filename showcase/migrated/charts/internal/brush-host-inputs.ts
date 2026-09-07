"use client";

import { createContext, createElement, useContext } from "react";
import type { ReactElement, ReactNode } from "react";
import type { ChartDatum } from "./types";

// Host inputs for the brush carrier: data, keys and the children tree.
interface BrushHostInputs {
  readonly data: readonly ChartDatum[] | undefined;
  readonly tree: ReactNode;
  readonly xDataKey: string | undefined;
  readonly xDomain: readonly [Date, Date] | undefined;
}

// Benign empty default: carriers render under the host, never against this.
const BrushHostInputsContext = createContext<BrushHostInputs>({
  data: undefined,
  tree: undefined,
  xDataKey: undefined,
  xDomain: undefined,
});

const useBrushHostInputs = (): BrushHostInputs => useContext(BrushHostInputsContext);

interface BrushHostInputsProviderProps {
  readonly children: ReactNode;
  readonly value: BrushHostInputs;
}

const BrushHostInputsProvider = (properties: Readonly<BrushHostInputsProviderProps>): ReactElement => {
  const { children, value } = properties;
  return createElement(BrushHostInputsContext.Provider, { value }, children);
};

export { BrushHostInputsProvider, useBrushHostInputs };
export type { BrushHostInputs };
