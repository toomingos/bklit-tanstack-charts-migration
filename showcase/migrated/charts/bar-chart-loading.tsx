// bklit bar-chart-loading.tsx: a thin shortcut for `<BarChart status="loading" />`; the chart owns the shimmer skeleton.
"use client";

import type { ReactElement } from "react";
import { BarChart } from "./bar-chart";
import type { ChartMargin } from "./kit/theme";

const EMPTY_DATA: Record<string, unknown>[] = [];

interface BarChartLoadingProps {
  /** Chart margins. */
  readonly margin?: Partial<Readonly<ChartMargin>>;
  /** Aspect ratio as "width / height". Default: "2 / 1" */
  readonly aspectRatio?: string;
  /** Additional class name for the container. */
  readonly className?: string;
}

const BarChartLoading = ({ margin, aspectRatio = "2 / 1", className = "" }: Readonly<BarChartLoadingProps>): ReactElement => (
  <BarChart aspectRatio={aspectRatio} className={className} data={EMPTY_DATA} margin={margin} status="loading" />
);

export { BarChartLoading };
export type { BarChartLoadingProps };
