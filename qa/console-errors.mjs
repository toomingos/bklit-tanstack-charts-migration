// Q2 gate: load each migrated scenario in the bench app and report console
// errors + uncaught page errors. WARNINGs are listed but only errors fail.
import { chromium } from "playwright";

const BASE = "http://localhost:5198";
const targets = [
  ...["line", "area", "bar", "scatter", "candlestick", "composed", "liveline"].map((c) => [c, 100]),
  ["heatmap", 52],
  ["sunburst", 27],
  // Initiative 8 (D223): profitloss = LineChart host + ProfitLossLine mark;
  // legend = chart-less HTML scenario (n ignored by the component).
  ["profitloss", 100],
  ["legend", 4],
  // Initiative 8 loop-2 (D225): candlestick + 2-slot legend pairing.
  ["candlelegend", 100],
  ["legendhover", 100],
  // Initiative 9 (D227): BrushLayout + strip ChartBrush + xDomain main chart.
  ["brush", 100],
  // Initiative 10 (D229): SeriesMarkers point grid + dash-tail overlay +
  // ChartMarkers fan-out, paired with a 2-item legend.
  ["markers", 100],
  // Initiative 11 (pattern-bars): PatternArea (Area host, 8-preset cycling,
  // qa/screenshot.mjs "patternarea" branch); BarSquares + BarColumnTrack
  // (Bar host, legend-hover pair); BarDepth + BarPulse (Bar host --
  // migrated-bardepth.tsx TODO(reconcile-dispatch-C): renders a plain
  // <Bar> fallback until dispatch C registers BarDepthBack/BarDepthFront/
  // BarPulse, so this target exercises whichever tree is live without
  // needing an update once dispatch C lands).
  ["patternarea", 100],
  ["barsquares", 100],
  ["bardepth", 100],
];
const loadingCharts = new Set(["line", "area", "heatmap"]);

const browser = await chromium.launch();
let failed = false;
for (const [chart, n] of targets) {
  const states = loadingCharts.has(chart) ? ["", "&state=loading"] : [""];
  for (const extra of states) {
    const page = await browser.newPage();
    const errors = [];
    const warnings = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
      else if (msg.type() === "warning") warnings.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
    const url = `${BASE}/?impl=migrated&chart=${chart}&n=${n}${extra}`;
    await page.goto(url, { waitUntil: "networkidle" });
    await page.waitForTimeout(2500);
    const label = `${chart}${extra ? " (loading)" : ""}`;
    if (errors.length) {
      failed = true;
      console.log(`FAIL ${label}: ${errors.length} error(s)`);
      for (const e of errors.slice(0, 5)) console.log(`   ERROR: ${e.slice(0, 300)}`);
    } else {
      console.log(`PASS ${label}${warnings.length ? ` (${warnings.length} warning(s))` : ""}`);
    }
    for (const w of warnings.slice(0, 2)) console.log(`   warn: ${w.slice(0, 160)}`);
    await page.close();
  }
}
await browser.close();
process.exit(failed ? 1 : 0);
