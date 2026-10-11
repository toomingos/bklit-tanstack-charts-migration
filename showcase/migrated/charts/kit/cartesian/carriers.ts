// Config-carrier children for the native cartesian charts: a carrier renders nothing, the chart reads its props with React.Children (`readChildren`) and compiles them into one TanStack definition,
// so the declarative bklit API (`<LineChart><Line/><Grid/>...`) survives with no store.
import { defineCarrier } from "../role";
import type {
  AreaConfig,
  ChartTooltipProps,
  GridProps,
  LineConfig,
  PatternAreaConfig,
  ProfitLossLineProps,
  ScatterConfig,
  SeriesMarkersProps,
  XAxisConfig,
  YAxisConfig,
} from "../types";

export const Line = defineCarrier<Readonly<LineConfig>>("line", "Line");
export const Area = defineCarrier<Readonly<AreaConfig>>("area", "Area");
export const PatternArea = defineCarrier<Readonly<PatternAreaConfig>>("patternArea", "PatternArea");
export const Grid = defineCarrier<GridProps>("grid", "Grid");
export const XAxis = defineCarrier<Readonly<XAxisConfig>>("xAxis", "XAxis");
export const YAxis = defineCarrier<Readonly<YAxisConfig>>("yAxis", "YAxis");
export const ChartTooltip = defineCarrier<ChartTooltipProps>("tooltip", "ChartTooltip");
export const ProfitLossLine = defineCarrier<ProfitLossLineProps>("profitLossLine", "ProfitLossLine");
export const Scatter = defineCarrier<Readonly<ScatterConfig>>("scatter", "Scatter");
export const SeriesMarkers = defineCarrier<SeriesMarkersProps>("seriesMarkers", "SeriesMarkers");
