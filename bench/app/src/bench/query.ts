// Scenario routing via query params, per research/04-metrics-and-baselines.md
// harness design:
//   /?impl=<bklit|tanstack>&chart=<line|area|bar|scatter>&n=<int>&scenario=<mount|update|live|hover>

export type Impl = "bklit" | "tanstack" | "migrated";
export type ChartKind =
  | "line"
  | "linemultiaxis"
  | "area"
  | "areamultiaxis"
  | "bar"
  | "barmultiaxis"
  | "scatter"
  | "scattermultiaxis"
  | "composedmultiaxis"
  | "refareamultiaxis"
  | "candlestick"
  | "candletween"
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
  | "sunchrome"
  | "choropleth"
  | "sankey"
  | "liveline"
  | "refarea"
  | "segment"
  | "projection"
  | "projectionxdomain"
  | "profitloss"
  | "legend"
  | "candlelegend"
  | "legendhover"
  | "brush"
  | "markers"
  | "patternarea"
  | "barsquares"
  | "bardepth"
  | "griddefault"
  | "composedstacked"
  /** P5.7 A10/B14: the `*ChartLoading` PRESET components, which are a separate
      code path from the `state=loading` prop the `area`/`line` scenarios use. */
  | "arealoading"
  | "barloading";
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
    chart !== "linemultiaxis" &&
    chart !== "area" &&
    chart !== "areamultiaxis" &&
    chart !== "bar" &&
    chart !== "barmultiaxis" &&
    chart !== "scatter" &&
    chart !== "scattermultiaxis" &&
    chart !== "composedmultiaxis" &&
    chart !== "refareamultiaxis" &&
    chart !== "candlestick" &&
    chart !== "candletween" &&
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
    chart !== "sunchrome" &&
    chart !== "choropleth" &&
    chart !== "sankey" &&
    chart !== "liveline" &&
    chart !== "refarea" &&
    chart !== "segment" &&
    chart !== "projection" &&
    chart !== "projectionxdomain" &&
    chart !== "profitloss" &&
    chart !== "legend" &&
    chart !== "candlelegend" &&
    chart !== "legendhover" &&
    chart !== "brush" &&
    chart !== "markers" &&
    chart !== "patternarea" &&
    chart !== "barsquares" &&
    chart !== "bardepth" &&
    chart !== "griddefault" &&
    chart !== "composedstacked" &&
    chart !== "arealoading" &&
    chart !== "barloading"
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
