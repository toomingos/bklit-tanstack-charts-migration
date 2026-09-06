// BarSquares config-carrier child: never rendered, compiled once into a TanStack defineChart spec.
import type { ReactElement } from "react";
import { CHART_ROLE } from "./chart-child-carrier";
import { useChartChild } from "./use-chart-child";
import type { ReadonlyBarSquaresConfig } from "./chart-child-carrier";
import type { GradientStop } from "./types";

// Legacy `gradientStops` is a mutable array; the shared readonly alias stays for readers.
type MutableBarSquaresProps = Omit<ReadonlyBarSquaresConfig, "gradientStops"> & {
  readonly gradientStops?: GradientStop[];
};

const BarSquares: ((props: MutableBarSquaresProps) => ReactElement | null) & {
  [CHART_ROLE]?: string;
  displayName: string;
} = Object.assign(
  (props: MutableBarSquaresProps): ReactElement | null => {
    useChartChild("barSquares", props);
    return null;
  },
  { [CHART_ROLE]: "barSquares", displayName: "BarSquares" },
);

export { BarSquares };
