"use client";

import { createContext, useContext } from "react";
import type { ReactElement, ReactNode } from "react";

const StaticChartPreviewContext = createContext(false);

/**
 * Disables cartesian reveal clip-path for static docs previews.
 * @param {{ children: ReactNode }} properties - Provider props.
 * @returns {ReactElement} The preview provider.
 */
const StaticChartPreviewProvider = ({
  children,
}: {
  children: ReactNode;
}): ReactElement => (
  <StaticChartPreviewContext.Provider value>
    {children}
  </StaticChartPreviewContext.Provider>
);

/**
 * Reads the static docs preview flag (idiom 9).
 * @returns {boolean} True inside a static preview provider.
 */
const useStaticChartPreview = (): boolean =>
  useContext(StaticChartPreviewContext);

export { StaticChartPreviewProvider, useStaticChartPreview };
