"use client";
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

export const Line = /* @__PURE__ */ defineCarrier<Readonly<LineConfig>>("line", "Line");
export const Area = /* @__PURE__ */ defineCarrier<Readonly<AreaConfig>>("area", "Area");
export const PatternArea = /* @__PURE__ */ defineCarrier<Readonly<PatternAreaConfig>>("patternArea", "PatternArea");
export const Grid = /* @__PURE__ */ defineCarrier<GridProps>("grid", "Grid");
export const XAxis = /* @__PURE__ */ defineCarrier<Readonly<XAxisConfig>>("xAxis", "XAxis");
export const YAxis = /* @__PURE__ */ defineCarrier<Readonly<YAxisConfig>>("yAxis", "YAxis");
export const ChartTooltip = /* @__PURE__ */ defineCarrier<ChartTooltipProps>("tooltip", "ChartTooltip");
export const ProfitLossLine = /* @__PURE__ */ defineCarrier<ProfitLossLineProps>("profitLossLine", "ProfitLossLine");
export const Scatter = /* @__PURE__ */ defineCarrier<Readonly<ScatterConfig>>("scatter", "Scatter");
export const SeriesMarkers = /* @__PURE__ */ defineCarrier<SeriesMarkersProps>("seriesMarkers", "SeriesMarkers");
