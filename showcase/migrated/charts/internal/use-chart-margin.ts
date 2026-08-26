// Margin normalization shared by every margin-ed chart (line/area/bar/
// scatter/candlestick/composed/live-line). Field-level defaults plus a
// stable object identity: the memo is keyed on the individual fields, so a
// fresh `marginProp` object with the same values does NOT change the
// returned margin's identity. TanStack treats definition identity as its
// update boundary, and a per-render margin object would otherwise
// invalidate the definition even on renders caused by unrelated parent
// work (see live-line-chart.tsx). Each chart passes its own bklit-parity
// default (values differ per chart family); the time-series family
// (line/area/bar/scatter/candlestick/composed) shares DEFAULT_CHART_MARGIN.
import * as React from "react";

export interface ChartMargin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

// bklit parity default shared by the six time-series charts (40px on all
// sides). Named DEFAULT_CHART_MARGIN because internal/index.ts already
// re-exports heatmap-context's per-family DEFAULT_MARGIN ({28,16,0,40}).
export const DEFAULT_CHART_MARGIN: ChartMargin = { top: 40, right: 40, bottom: 40, left: 40 };

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