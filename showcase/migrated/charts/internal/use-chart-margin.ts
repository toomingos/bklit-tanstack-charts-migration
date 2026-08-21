// Margin normalization shared by every margin-ed chart (line/area/bar/
// scatter/candlestick/composed/live-line). Field-level defaults plus a
// stable object identity: the memo is keyed on the individual fields, so a
// fresh `marginProp` object with the same values does NOT change the
// returned margin's identity. TanStack treats definition identity as its
// update boundary, and a per-render margin object would otherwise
// invalidate the definition even on renders caused by unrelated parent
// work (see live-line-chart.tsx). Each chart passes its own bklit-parity
// `DEFAULT_MARGIN` (values differ per chart family).
import * as React from "react";

export interface ChartMargin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export function useChartMargin(
  marginProp: Partial<ChartMargin> | undefined,
  defaultMargin: ChartMargin,
): ChartMargin {
  const top = marginProp?.top ?? defaultMargin.top;
  const right = marginProp?.right ?? defaultMargin.right;
  const bottom = marginProp?.bottom ?? defaultMargin.bottom;
  const left = marginProp?.left ?? defaultMargin.left;
  return React.useMemo<ChartMargin>(
    () => ({ top, right, bottom, left }),
    [top, right, bottom, left],
  );
}