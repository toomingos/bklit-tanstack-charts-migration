// BarSquares config-carrier child: never rendered, compiled once into a TanStack defineChart spec.
import { CHART_ROLE } from "./chart-child-carrier";
import type { ChartChildComponent, ReadonlyBarSquaresConfig } from "./chart-child-carrier";
import type { BarSquaresConfig } from "./types";

const BarSquares: ChartChildComponent<BarSquaresConfig> = (_props: ReadonlyBarSquaresConfig): null => null;

BarSquares[CHART_ROLE] = "barSquares";
BarSquares.displayName = "BarSquares";

export { BarSquares };
