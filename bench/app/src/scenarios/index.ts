import type { ComponentType } from "react";
import BklitLine from "./bklit-line";
import BklitArea from "./bklit-area";
import BklitBar from "./bklit-bar";
import BklitScatter from "./bklit-scatter";
import BklitCandlestick from "./bklit-candlestick";
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
import MigratedArea from "./migrated-area";
import MigratedScatter from "./migrated-scatter";
import MigratedBar from "./migrated-bar";
import MigratedCandlestick from "./migrated-candlestick";
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
import MigratedChoropleth from "./migrated-choropleth";
import MigratedLiveLine from "./migrated-liveline";
import MigratedSankey from "./migrated-sankey";

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
}

export const scenarios: Record<string, ComponentType<ScenarioProps>> = {
  "bklit-line": BklitLine,
  "bklit-area": BklitArea,
  "bklit-bar": BklitBar,
  "bklit-scatter": BklitScatter,
  "bklit-candlestick": BklitCandlestick,
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
  "bklit-choropleth": BklitChoropleth,
  "bklit-sankey": BklitSankey,
  "bklit-liveline": BklitLiveLine,
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
  "migrated-area": MigratedArea,
  "migrated-scatter": MigratedScatter,
  "migrated-bar": MigratedBar,
  "migrated-candlestick": MigratedCandlestick,
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
  "migrated-choropleth": MigratedChoropleth,
  "migrated-liveline": MigratedLiveLine,
  "migrated-sankey": MigratedSankey,
};
