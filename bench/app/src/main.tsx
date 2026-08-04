import ReactDOM from "react-dom/client";
import "./styles.css";
import { parseBenchParams, type BenchParams } from "./bench/query";
import { markRenderStart, markMountPaint } from "./bench/paint";
import { scenarios } from "./scenarios";

declare global {
  interface Window {
    __benchMeta?: BenchParams;
    __benchUpdate?: () => Promise<number>;
    __benchLiveTick?: () => void;
  }
}

const params = parseBenchParams();
window.__benchMeta = params;

const key = `${params.impl}-${params.chart}` as const;
const Scenario = scenarios[key];
if (!Scenario) {
  throw new Error(`No scenario registered for "${key}"`);
}

const rootEl = document.getElementById("root");
const chartRootEl = document.getElementById("chart-root");
if (!(rootEl && chartRootEl)) {
  throw new Error("index.html is missing #root / #chart-root");
}

// M1a: mark immediately before `root.render()`.
markRenderStart();
const root = ReactDOM.createRoot(rootEl);
// No React.StrictMode: this is a measurement harness, not app dev code --
// StrictMode's dev-only double-effect-invocation would double-fire
// onPhaseChange and skew the M1b settle-detection logic below.
root.render(<Scenario n={params.n} scenario={params.scenario} />);

// M1a continued: resolves once the chart's real SVG has committed and two
// animation frames have elapsed. Not awaited here on purpose -- it just
// needs to run and record the `bench:mount-to-paint` performance measure;
// the Playwright driver reads it back via `performance.getEntriesByName`.
void markMountPaint(chartRootEl);
