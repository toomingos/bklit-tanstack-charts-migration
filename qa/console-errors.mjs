// Q2 gate: load each migrated scenario in the bench app and report console
// errors + uncaught page errors. WARNINGs are listed but only errors fail.
import { chromium } from "playwright";

const BASE = `http://localhost:${Number(process.env.QA_PORT ?? 5198)}`;
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
  // Lead-added 2026-08-24 (D257 §5 action item, widened): the sweep was
  // entirely cartesian — the whole polar/flow family had never been console-
  // swept at any density. funnel@1000 specifically is the one D257 caught
  // emitting ~1000 `viewBox: 0 0 -2.944` errors; bklit emits 1017 of the
  // identical errors on the same scenario, so it is a symmetric upstream
  // artifact, not a migration defect — see knownSymmetric below.
  ["pie", 1000],
  ["ring", 1000],
  ["radar", 1000],
  ["gauge", 1000],
  ["gaugelinear", 1000],
  ["funnel", 1000],
  ["funnelvertical", 1000],
  ["sankey", 33],
  ["choropleth", 100],
];

// Errors that are reproduced IDENTICALLY by legacy bklit on the same scenario
// and are therefore not migration defects. Keep this list tiny and always
// record the bklit-side evidence — an entry here blinds the gate to a real
// class of error, so it must be justified per-entry, never used to quiet a
// failure that has not been checked against bklit.
// The pattern must match the message BROWSERS ACTUALLY EMIT. The first version
// of this entry used /viewBox:\s*0 0 -/, assuming the coordinates followed the
// attribute name; Chrome writes `viewBox: A negative value is not valid. ("0 0
// -2.944 ...")`. It never matched, so the entry excused nothing (D261). It
// surfaced immediately only because excused errors are still printed -- had the
// gate silently swallowed matches, a dead pattern would have looked like a pass.
const NEGATIVE_VIEWBOX = /attribute viewBox: A negative value is not valid/;
const knownSymmetric = [
  {
    // D261, measured both impls x both charts x n=100/1000 on 2026-08-24:
    //   funnel         n=1000  bklit 1017 / migrated 1000  ("0 0 -2.944 478.171875")
    //   funnelvertical n=1000  bklit 1017 / migrated 1000  ("0 0 1052 -2.10240625")
    //   both charts    n=100   bklit 0    / migrated 0
    // The emitted strings are BYTE-IDENTICAL across impls -- same degenerate
    // geometry, so this is an upstream density artifact, not migration drift.
    // The 1017-vs-1000 gap is bklit's extra render pass, not extra breakage.
    chart: "funnel",
    n: 1000,
    pattern: NEGATIVE_VIEWBOX,
    why: "symmetric with bklit (D261) — degenerate negative viewBox width at n=1000",
  },
  {
    chart: "funnelvertical",
    n: 1000,
    pattern: NEGATIVE_VIEWBOX,
    why: "symmetric with bklit (D261) — degenerate negative viewBox height at n=1000",
  },
];
const loadingCharts = new Set(["line", "area", "heatmap"]);

// Each target is an isolated page with its own listeners; the 2.5s settle
// window is pure sleep, so a small page pool overlaps the waits without
// affecting what each page logs (error/warning capture is per-page).
const jobs = [];
for (const [chart, n] of targets) {
  const states = loadingCharts.has(chart) ? ["", "&state=loading"] : [""];
  for (const extra of states) jobs.push({ chart, n, extra });
}

const CONCURRENCY = Math.max(1, Number(process.env.QA_CONSOLE_CONCURRENCY ?? 4));
const browser = await chromium.launch();
const results = new Array(jobs.length);
let nextJob = 0;

async function worker() {
  for (;;) {
    const idx = nextJob++;
    if (idx >= jobs.length) return;
    const { chart, n, extra } = jobs[idx];
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
    await page.close();
    results[idx] = { chart, n, extra, errors, warnings };
  }
}

await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, worker));
await browser.close();

let failed = false;
for (const { chart, n, extra, errors, warnings } of results) {
  const label = `${chart}${extra ? " (loading)" : ""}`;
  // Partition errors against the symmetric allowlist. Excused errors are still
  // COUNTED AND PRINTED — a silent allowlist is how a real regression hides
  // behind an accepted one.
  const excuses = knownSymmetric.filter((k) => k.chart === chart && k.n === n);
  const excused = [];
  const real = [];
  for (const e of errors) (excuses.some((k) => k.pattern.test(e)) ? excused : real).push(e);
  if (real.length) {
    failed = true;
    console.log(`FAIL ${label}: ${real.length} error(s)`);
    for (const e of real.slice(0, 5)) console.log(`   ERROR: ${e.slice(0, 300)}`);
    if (excused.length) console.log(`   (+${excused.length} excused: ${excuses.map((k) => k.why).join("; ")})`);
  } else if (excused.length) {
    console.log(`PASS ${label} — ${excused.length} error(s) EXCUSED: ${excuses.map((k) => k.why).join("; ")}`);
    console.log(`   sample: ${excused[0].slice(0, 200)}`);
  } else {
    console.log(`PASS ${label}${warnings.length ? ` (${warnings.length} warning(s))` : ""}`);
  }
  for (const w of warnings.slice(0, 2)) console.log(`   warn: ${w.slice(0, 160)}`);
}
process.exit(failed ? 1 : 0);
