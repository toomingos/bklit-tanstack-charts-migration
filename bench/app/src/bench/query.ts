// Scenario routing via query params, per research/04-metrics-and-baselines.md
// harness design:
//   /?impl=<bklit|tanstack>&chart=<line|area|bar|scatter>&n=<int>&scenario=<mount|update|live|hover>

export type Impl = "bklit" | "tanstack" | "migrated";
export type ChartKind =
  | "line"
  | "area"
  | "bar"
  | "scatter"
  | "candlestick"
  | "composed"
  | "radar"
  | "pie"
  | "ring"
  | "gauge"
  | "gaugelinear"
  | "funnel"
  | "funnelvertical"
  | "heatmap"
  | "sunburst"
  | "choropleth"
  | "sankey"
  | "liveline"
  | "refarea"
  | "segment"
  | "projection"
  | "profitloss"
  | "legend"
  | "candlelegend"
  | "legendhover"
  | "brush"
  | "markers"
  | "patternarea"
  | "barsquares"
  | "bardepth";
export type Scenario = "mount" | "update" | "live" | "hover";
/** Chart data state: "ready" (default) renders with data; "loading" mounts
 * the chart in its loading phase (`status="loading"` on charts that support
 * it) so qa/screenshot.mjs can capture loading chrome (D211 loading gate). */
export type ChartState = "ready" | "loading";

export interface BenchParams {
  impl: Impl;
  chart: ChartKind;
  n: number;
  scenario: Scenario;
  state: ChartState;
}

export function parseBenchParams(): BenchParams {
  const url = new URL(window.location.href);
  const sp = url.searchParams;

  const impl = sp.get("impl");
  const chart = sp.get("chart");
  const nRaw = sp.get("n");
  const scenario = sp.get("scenario");

  if (impl !== "bklit" && impl !== "tanstack" && impl !== "migrated") {
    throw new Error(`Missing/invalid ?impl= (got ${JSON.stringify(impl)})`);
  }
  if (
    chart !== "line" &&
    chart !== "area" &&
    chart !== "bar" &&
    chart !== "scatter" &&
    chart !== "candlestick" &&
    chart !== "composed" &&
    chart !== "radar" &&
    chart !== "pie" &&
    chart !== "ring" &&
    chart !== "gauge" &&
    chart !== "gaugelinear" &&
    chart !== "funnel" &&
    chart !== "funnelvertical" &&
    chart !== "heatmap" &&
    chart !== "sunburst" &&
    chart !== "choropleth" &&
    chart !== "sankey" &&
    chart !== "liveline" &&
    chart !== "refarea" &&
    chart !== "segment" &&
    chart !== "projection" &&
    chart !== "profitloss" &&
    chart !== "legend" &&
    chart !== "candlelegend" &&
    chart !== "legendhover" &&
    chart !== "brush" &&
    chart !== "markers" &&
    chart !== "patternarea" &&
    chart !== "barsquares" &&
    chart !== "bardepth"
  ) {
    throw new Error(`Missing/invalid ?chart= (got ${JSON.stringify(chart)})`);
  }
  const n = Number.parseInt(nRaw ?? "1000", 10);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`Missing/invalid ?n= (got ${JSON.stringify(nRaw)})`);
  }
  const resolvedScenario: Scenario =
    scenario === "update" || scenario === "live" || scenario === "hover"
      ? scenario
      : "mount";
  const state: ChartState = sp.get("state") === "loading" ? "loading" : "ready";

  return { impl, chart, n, scenario: resolvedScenario, state };
}
