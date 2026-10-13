// bklit bar-chart-loading.tsx: a thin shortcut for `<BarChart status="loading" />`; the chart owns the shimmer skeleton.
"use client";

import type { ReactElement } from "react";
import { BarChart } from "./bar-chart";
import type { ChartMargin } from "./kit/theme";

const EMPTY_DATA: Record<string, unknown>[] = [];

interface BarChartLoadingProps {
  /**
   * Space around the plot area in pixels. Missing sides use the default.
   * @default { top: 40, right: 40, bottom: 40, left: 40 }
   */
  readonly margin?: Partial<Readonly<ChartMargin>>;
  /**
   * CSS aspect ratio of the placeholder, as `"width / height"`.
   * @default "2 / 1"
   */
  readonly aspectRatio?: string;
  /**
   * Extra CSS class name for the placeholder container.
   * @default ""
   */
  readonly className?: string;
}

/** Ready-made loading placeholder for a bar chart: shorthand for `<BarChart status="loading" />` with no data, drawing the shimmering skeleton bars. */
const BarChartLoading = ({ margin, aspectRatio = "2 / 1", className = "" }: Readonly<BarChartLoadingProps>): ReactElement => (
  <BarChart aspectRatio={aspectRatio} className={className} data={EMPTY_DATA} margin={margin} status="loading" />
);

export { BarChartLoading };
export type { BarChartLoadingProps };
