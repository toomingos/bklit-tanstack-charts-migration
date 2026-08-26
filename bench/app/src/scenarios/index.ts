import type { ComponentType } from "react";
import BklitLine from "./bklit-line";
import BklitLineMultiAxis from "./bklit-linemultiaxis";
import BklitRefArea from "./bklit-refarea";
import BklitSegment from "./bklit-segment";
import BklitProjection from "./bklit-projection";
import BklitProjectionXDomain from "./bklit-projectionxdomain";
import BklitArea from "./bklit-area";
import BklitAreaMultiAxis from "./bklit-areamultiaxis";
import BklitBar from "./bklit-bar";
import BklitBarMultiAxis from "./bklit-barmultiaxis";
import BklitScatter from "./bklit-scatter";
import BklitScatterMultiAxis from "./bklit-scattermultiaxis";
import BklitComposedMultiAxis from "./bklit-composedmultiaxis";
import BklitRefAreaMultiAxis from "./bklit-refareamultiaxis";
import BklitCandlestick from "./bklit-candlestick";
import BklitCandleTween from "./bklit-candletween";
import BklitComposed from "./bklit-composed";
import BklitRadar from "./bklit-radar";
import BklitPie from "./bklit-pie";
import BklitRing from "./bklit-ring";
import BklitGauge from "./bklit-gauge";
import BklitGaugeLinear from "./bklit-gaugelinear";
import BklitFunnel from "./bklit-funnel";
import BklitFunnelVertical from "./bklit-funnelvertical";
import BklitHeatmap from "./bklit-heatmap";
import BklitSunburst from "./bklit-sunburst";
import BklitSunChrome from "./bklit-sunchrome";
import BklitChoropleth from "./bklit-choropleth";
import BklitSankey from "./bklit-sankey";
import BklitLiveLine from "./bklit-liveline";
import TanstackLine from "./tanstack-line";
import TanstackArea from "./tanstack-area";
import TanstackBar from "./tanstack-bar";
import TanstackScatter from "./tanstack-scatter";
import TanstackCandlestick from "./tanstack-candlestick";
import TanstackComposed from "./tanstack-composed";
import TanstackRadar from "./tanstack-radar";
import TanstackPie from "./tanstack-pie";
import TanstackRing from "./tanstack-ring";
import TanstackGauge from "./tanstack-gauge";
import TanstackGaugeLinear from "./tanstack-gaugelinear";
import TanstackFunnel from "./tanstack-funnel";
import TanstackFunnelVertical from "./tanstack-funnelvertical";
import TanstackHeatmap from "./tanstack-heatmap";
import TanstackSunburst from "./tanstack-sunburst";
import TanstackChoropleth from "./tanstack-choropleth";
import TanstackSankey from "./tanstack-sankey";
import TanstackLiveLine from "./tanstack-liveline";
import MigratedLine from "./migrated-line";
import MigratedLineMultiAxis from "./migrated-linemultiaxis";
import MigratedRefArea from "./migrated-refarea";
import MigratedSegment from "./migrated-segment";
import MigratedProjection from "./migrated-projection";
import MigratedProjectionXDomain from "./migrated-projectionxdomain";
import MigratedArea from "./migrated-area";
import MigratedAreaMultiAxis from "./migrated-areamultiaxis";
import MigratedScatter from "./migrated-scatter";
import MigratedScatterMultiAxis from "./migrated-scattermultiaxis";
import MigratedComposedMultiAxis from "./migrated-composedmultiaxis";
import MigratedRefAreaMultiAxis from "./migrated-refareamultiaxis";
import MigratedBar from "./migrated-bar";
import MigratedBarMultiAxis from "./migrated-barmultiaxis";
import MigratedCandlestick from "./migrated-candlestick";
import MigratedCandleTween from "./migrated-candletween";
import MigratedComposed from "./migrated-composed";
import MigratedRadar from "./migrated-radar";
import MigratedPie from "./migrated-pie";
import MigratedRing from "./migrated-ring";
import MigratedGauge from "./migrated-gauge";
import MigratedGaugeLinear from "./migrated-gaugelinear";
import MigratedFunnel from "./migrated-funnel";
import MigratedFunnelVertical from "./migrated-funnelvertical";
import MigratedHeatmap from "./migrated-heatmap";
import MigratedSunburst from "./migrated-sunburst";
import MigratedSunChrome from "./migrated-sunchrome";
import MigratedChoropleth from "./migrated-choropleth";
import MigratedLiveLine from "./migrated-liveline";
import MigratedSankey from "./migrated-sankey";
import BklitProfitLoss from "./bklit-profitloss";
import MigratedProfitLoss from "./migrated-profitloss";
import BklitLegend from "./bklit-legend";
import MigratedLegend from "./migrated-legend";
import BklitCandlestickLegend from "./bklit-candlestick-legend";
import MigratedCandlestickLegend from "./migrated-candlestick-legend";
import BklitLegendHover from "./bklit-legendhover";
import MigratedLegendHover from "./migrated-legendhover";
import BklitBrush from "./bklit-brush";
import MigratedBrush from "./migrated-brush";
import BklitMarkers from "./bklit-markers";
import MigratedMarkers from "./migrated-markers";
import BklitPatternArea from "./bklit-patternarea";
import MigratedPatternArea from "./migrated-patternarea";
import BklitBarSquares from "./bklit-barsquares";
import MigratedBarSquares from "./migrated-barsquares";
import BklitBarDepth from "./bklit-bardepth";
import MigratedBarDepth from "./migrated-bardepth";
import BklitGridDefault from "./bklit-griddefault";
import MigratedGridDefault from "./migrated-griddefault";
import BklitAreaLoading from "./bklit-arealoading";
import MigratedAreaLoading from "./migrated-arealoading";
import BklitBarLoading from "./bklit-barloading";
import MigratedBarLoading from "./migrated-barloading";
import BklitComposedStacked from "./bklit-composedstacked";
import MigratedComposedStacked from "./migrated-composedstacked";

export interface ScenarioProps {
  n: number;
  /**
   * Which measurement scenario this page load serves (parsed from
   * `?scenario=`, default "mount"). Most charts ignore it; LiveLine keys
   * off it (D22): "mount"/"hover" run the deterministic freeze protocol
   * (K seeded ticks -> lerp convergence -> pause -> settle) for QA/M1,
   * while "live" keeps the push loop armed so bench/run.mjs's M3b can
   * drive `window.__benchLiveTick()` continuously.
   */
  scenario?: import("../bench/query").Scenario;
  /**
   * Chart data state (parsed from `?state=`, default "ready"). "loading"
   * mounts the chart in its loading phase — scenarios whose chart supports
   * `status="loading"` pass it through so qa/screenshot.mjs `--state loading`
   * can pixel-compare loading chrome (D211/D212 loading gate). Scenarios
   * without loading support ignore it.
   */
  state?: import("../bench/query").ChartState;
}

export const scenarios: Record<string, ComponentType<ScenarioProps>> = {
  "bklit-line": BklitLine,
  "bklit-linemultiaxis": BklitLineMultiAxis,
  "bklit-refarea": BklitRefArea,
  "bklit-segment": BklitSegment,
  "bklit-projection": BklitProjection,
  "bklit-projectionxdomain": BklitProjectionXDomain,
  "bklit-area": BklitArea,
  "bklit-areamultiaxis": BklitAreaMultiAxis,
  "bklit-bar": BklitBar,
  "bklit-barmultiaxis": BklitBarMultiAxis,
  "bklit-scatter": BklitScatter,
  "bklit-scattermultiaxis": BklitScatterMultiAxis,
  "bklit-composedmultiaxis": BklitComposedMultiAxis,
  "bklit-refareamultiaxis": BklitRefAreaMultiAxis,
  "bklit-candlestick": BklitCandlestick,
  // P5.5 K4 gate: candlestick with a tween `enterTransition`, captured mid-reveal.
  "bklit-candletween": BklitCandleTween,
  "bklit-composed": BklitComposed,
  "bklit-radar": BklitRadar,
  "bklit-pie": BklitPie,
  "bklit-ring": BklitRing,
  "bklit-gauge": BklitGauge,
  "bklit-gaugelinear": BklitGaugeLinear,
  "bklit-funnel": BklitFunnel,
  "bklit-funnelvertical": BklitFunnelVertical,
  "bklit-heatmap": BklitHeatmap,
  "bklit-sunburst": BklitSunburst,
  // P5.5 Strand 3 gate: sunburst with a breadcrumb and a render-prop hint.
  "bklit-sunchrome": BklitSunChrome,
  "bklit-choropleth": BklitChoropleth,
  "bklit-sankey": BklitSankey,
  "bklit-liveline": BklitLiveLine,
  "bklit-profitloss": BklitProfitLoss,
  "bklit-legend": BklitLegend,
  "bklit-candlelegend": BklitCandlestickLegend,
  "bklit-legendhover": BklitLegendHover,
  "bklit-brush": BklitBrush,
  "bklit-markers": BklitMarkers,
  "bklit-patternarea": BklitPatternArea,
  "bklit-barsquares": BklitBarSquares,
  "bklit-bardepth": BklitBarDepth,
  "bklit-griddefault": BklitGridDefault,
  "bklit-arealoading": BklitAreaLoading,
  "bklit-barloading": BklitBarLoading,
  "bklit-composedstacked": BklitComposedStacked,
  "tanstack-line": TanstackLine,
  "tanstack-area": TanstackArea,
  "tanstack-bar": TanstackBar,
  "tanstack-scatter": TanstackScatter,
  "tanstack-candlestick": TanstackCandlestick,
  "tanstack-composed": TanstackComposed,
  "tanstack-radar": TanstackRadar,
  "tanstack-pie": TanstackPie,
  "tanstack-ring": TanstackRing,
  "tanstack-gauge": TanstackGauge,
  "tanstack-gaugelinear": TanstackGaugeLinear,
  "tanstack-funnel": TanstackFunnel,
  "tanstack-funnelvertical": TanstackFunnelVertical,
  "tanstack-heatmap": TanstackHeatmap,
  "tanstack-sunburst": TanstackSunburst,
  "tanstack-choropleth": TanstackChoropleth,
  "tanstack-sankey": TanstackSankey,
  "tanstack-liveline": TanstackLiveLine,
  "migrated-line": MigratedLine,
  "migrated-linemultiaxis": MigratedLineMultiAxis,
  "migrated-refarea": MigratedRefArea,
  "migrated-segment": MigratedSegment,
  "migrated-projection": MigratedProjection,
  "migrated-projectionxdomain": MigratedProjectionXDomain,
  "migrated-area": MigratedArea,
  "migrated-areamultiaxis": MigratedAreaMultiAxis,
  "migrated-scatter": MigratedScatter,
  "migrated-scattermultiaxis": MigratedScatterMultiAxis,
  "migrated-composedmultiaxis": MigratedComposedMultiAxis,
  "migrated-refareamultiaxis": MigratedRefAreaMultiAxis,
  "migrated-bar": MigratedBar,
  "migrated-barmultiaxis": MigratedBarMultiAxis,
  "migrated-candlestick": MigratedCandlestick,
  "migrated-candletween": MigratedCandleTween,
  "migrated-composed": MigratedComposed,
  "migrated-radar": MigratedRadar,
  "migrated-pie": MigratedPie,
  "migrated-ring": MigratedRing,
  "migrated-gauge": MigratedGauge,
  "migrated-gaugelinear": MigratedGaugeLinear,
  "migrated-funnel": MigratedFunnel,
  "migrated-funnelvertical": MigratedFunnelVertical,
  "migrated-heatmap": MigratedHeatmap,
  "migrated-sunburst": MigratedSunburst,
  "migrated-sunchrome": MigratedSunChrome,
  "migrated-choropleth": MigratedChoropleth,
  "migrated-liveline": MigratedLiveLine,
  "migrated-sankey": MigratedSankey,
  "migrated-profitloss": MigratedProfitLoss,
  "migrated-legend": MigratedLegend,
  "migrated-candlelegend": MigratedCandlestickLegend,
  "migrated-legendhover": MigratedLegendHover,
  "migrated-brush": MigratedBrush,
  "migrated-markers": MigratedMarkers,
  "migrated-patternarea": MigratedPatternArea,
  "migrated-barsquares": MigratedBarSquares,
  "migrated-bardepth": MigratedBarDepth,
  "migrated-griddefault": MigratedGridDefault,
  "migrated-arealoading": MigratedAreaLoading,
  "migrated-barloading": MigratedBarLoading,
  "migrated-composedstacked": MigratedComposedStacked,
};
