import { useMemo } from "react";
import type { ReactElement } from "react";
import { ChartConfigContext, DEFAULT_CHART_CONFIG } from "./chart-config-context";
import type { ChartConfigProviderProps, ChartConfigValue } from "./chart-config-context";

// Merges a partial override over the defaults so charts share one spring tune.
const ChartConfigProvider = ({
  value,
  children,
}: Readonly<ChartConfigProviderProps>): ReactElement => {
  const merged = useMemo<ChartConfigValue>(
    () => ({
      ...DEFAULT_CHART_CONFIG,
      ...value,
    }),
    [value]
  );

  return (
    <ChartConfigContext.Provider value={merged}>
      {children}
    </ChartConfigContext.Provider>
  );
};

export { ChartConfigProvider };
