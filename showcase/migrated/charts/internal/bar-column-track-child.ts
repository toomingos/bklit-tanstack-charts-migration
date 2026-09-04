// BarColumnTrack config-carrier child: never rendered, compiled once into a TanStack defineChart spec.
import { CHART_ROLE } from "./chart-child-carrier";
import type { ChartChildComponent } from "./chart-child-carrier";
import type { BarColumnTrackConfig } from "./types";

const BarColumnTrack: ChartChildComponent<BarColumnTrackConfig> = (_props: Readonly<BarColumnTrackConfig>): null => null;

BarColumnTrack[CHART_ROLE] = "barColumnTrack";
BarColumnTrack.displayName = "BarColumnTrack";

export { BarColumnTrack };
