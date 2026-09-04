// Q2 gate: load each migrated scenario; console/page errors fail, warnings only listed.
import { chromium } from "playwright";

const BASE = `http://localhost:${Number(process.env.QA_PORT ?? 5198)}`;
const targets = [
  ...["line", "area", "bar", "scatter", "candlestick", "composed", "liveline"].map((c) => [c, 100]),
  ["heatmap", 52],
  ["sunburst", 27],
  ["profitloss", 100],
  ["legend", 4],
  ["candlelegend", 100],
  ["legendhover", 100],
  ["brush", 100],
  ["markers", 100],
  ["patternarea", 100],
  ["barsquares", 100],
  ["bardepth", 100],
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

// GUARD: allowlist only for errors bklit emits identically (per-entry evidence required); match Chrome's literal message text.
const NEGATIVE_VIEWBOX = /attribute viewBox: A negative value is not valid/;
const knownSymmetric = [
  {
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

// Page pool overlaps the 2.5s settle sleeps; error capture stays per-page.
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
  // GUARD: excused errors are still counted and printed; never swallow silently.
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
