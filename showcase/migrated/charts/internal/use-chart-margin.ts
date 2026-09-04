import * as React from "react";

interface ChartMargin {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

const DEFAULT_CHART_MARGIN: ChartMargin = { bottom: 40, left: 40, right: 40, top: 40 };

const useChartMargin = (marginProp: Partial<ChartMargin> | undefined, defaultMargin: Readonly<ChartMargin>): ChartMargin => {
  const top = marginProp?.top ?? defaultMargin.top;
  const right = marginProp?.right ?? defaultMargin.right;
  const bottom = marginProp?.bottom ?? defaultMargin.bottom;
  const left = marginProp?.left ?? defaultMargin.left;
  // Memo is keyed on fields, not the prop object: a fresh object would bust the update boundary.
  return React.useMemo<ChartMargin>(
    () => ({ bottom, left, right, top }),
    [top, right, bottom, left],
  );
}

export { DEFAULT_CHART_MARGIN, useChartMargin };
export type { ChartMargin };
