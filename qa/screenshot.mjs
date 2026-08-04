#!/usr/bin/env node
// qa/screenshot.mjs — research/05 Q1 (visual parity / pixel diff).
//
// For a given chart/n, loads TWO scenario "loads" (impl-a and impl-b -- or,
// in --self-test mode, the SAME impl loaded twice in two fresh pages), each
// via the same bench-app query-param scheme `bench/run.mjs` uses. For each
// load it captures:
//   (a) the settled-state screenshot (after `window.__benchSettled`)
//   (b) 3 hover-state screenshots at fixed plot-area coordinates
//       (30% / 50% / 70% of the chart SVG's width, mid-height), asserting a
//       tooltip is actually visible before shooting each one.
//
// It then pixelmatches each corresponding pair (settled-vs-settled,
// hover30-vs-hover30, ...), writes the PNGs + diff PNGs + a report.json under
// `qa/results/<chart>/<timestamp>/`, and exits non-zero if any comparison
// fails its gate or any hover state failed to show a tooltip.
//
// Usage:
//   node qa/screenshot.mjs --chart line --impl-a bklit --impl-b migrated [--n 1000]
//   node qa/screenshot.mjs --chart line --self-test [--impl-a bklit] [--n 1000]
//
// Gates (research/05 Q1):
//   - real compare (impl-a vs impl-b): <= 0.5% differing pixels per screenshot
//   - --self-test (same impl, two fresh loads): <= 0.1% -- this is the
//     determinism floor that must hold for the 0.5% real gate to mean
//     anything (see the self-test comment further down).
//
// NOTE (risk, see final report to the lead): as of this writing the bench
// app's query parser (`bench/app/src/bench/query.ts`) only accepts
// `impl=bklit|tanstack` -- there is no `migrated` scenario registered yet
// (`bench/app/src/scenarios/index.ts`). Running this script with
// `--impl-a`/`--impl-b migrated` before that lands will fail at
// `page.goto()` time with "Missing/invalid ?impl=". `--self-test` and any
// bklit/tanstack combination work today.

import { chromium } from "playwright";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const APP_DIR = path.join(ROOT, "bench", "app");
const RESULTS_DIR = path.join(ROOT, "qa", "results");
const PORT = 5198;
const BASE_URL = `http://localhost:${PORT}`;

const VIEWPORT = { width: 1200, height: 800 };
const DEVICE_SCALE_FACTOR = 1;
const HOVER_FRACTIONS = [0.3, 0.5, 0.7]; // % of plot-area width, per research/05 Q1
// Charts whose bklit implementation has NO tooltip of any kind (the entire
// polar family: hover is whole-shape CSS chrome with zero text mutation —
// docs/LOG.md D24). For these, the tooltip-visibility assertion is skipped on
// BOTH sides identically; the pixel diffs at the hover captures remain the
// full gate (they verify the dim/highlight/glow hover chrome). Gate-author
// (Fable) edit per D24 — fabricating tooltip DOM to satisfy the heuristic is
// forbidden.
const TOOLTIPLESS_CHARTS = new Set([
  "radar",
  "pie",
  "ring",
  "gauge",
  "gaugelinear",
  "sunburst",
  "funnel",
  "funnelvertical",
]);
// Funnel family: hover zones are DISCRETE equal-sized cells with dead gaps
// between them (bklit funnel-chart.tsx: per-stage `cursor-pointer` divs at
// `(seg+gap)*i`, gap uncovered). The default probe (fraction of svg width,
// y = height/2) can land exactly in a gap — for funnelvertical at even n,
// y=H/2 sits ON a row boundary — where the final hover state depends on
// which intermediate mouse-move events the browser coalesced during the
// approach: a genuinely nondeterministic capture (self-test flake found
// 2026-07-31, funnelvertical n=20 hover-70, 4.9% bklit-vs-bklit diff).
// For these charts the probes snap to the CENTER of the cell at index
// round(fraction*(count-1)) along the stage axis — same fractions, same
// treatment for both impls, resting point always inside a real hover zone.
// Gate-author (Fable) edit; precedent: bench/run.mjs's getSweepPoints
// tracks real mark geometry for the same artifact-avoidance reason.
const FUNNEL_CHARTS = new Set(["funnel", "funnelvertical"]);
const HOVER_WAIT_MS = 700; // was 150 (research/05 Q1); raised so bklit's tooltip
// spring fully settles before capture — at 150ms two identical loads catch the
// spring on different frames and the self-test false-fails (~0.34% diff).
const COMPARE_GATE = 0.005; // 0.5%, real bklit-vs-migrated parity gate
const SELF_TEST_GATE = 0.001; // 0.1%, determinism floor (research/04)
const DEFAULT_N = 1000;
const DEFAULT_IMPL_A = "bklit";
const DEFAULT_IMPL_B = "migrated";

function sceneUrl(baseUrl, { impl, chart, n }) {
  return `${baseUrl}/?impl=${impl}&chart=${chart}&n=${n}`;
}

// ---------------------------------------------------------------------- //
// Compare (exported for reuse elsewhere, e.g. a future `pnpm gate`)
// ---------------------------------------------------------------------- //

/**
 * Pixel-diffs two same-sized PNG buffers with pixelmatch (threshold 0.1,
 * includeAA: false, per research/05 Q1). Returns diff stats + the diff PNG
 * buffer (red-highlighted) for human review.
 */
export function compareBuffers(bufferA, bufferB) {
  const a = PNG.sync.read(bufferA);
  const b = PNG.sync.read(bufferB);
  if (a.width !== b.width || a.height !== b.height) {
    throw new Error(
      `screenshot size mismatch: ${a.width}x${a.height} vs ${b.width}x${b.height}`,
    );
  }
  const { width, height } = a;
  const diff = new PNG({ width, height });
  const diffPixels = pixelmatch(a.data, b.data, diff.data, width, height, {
    threshold: 0.1,
    includeAA: false,
  });
  const totalPixels = width * height;
  return {
    diffPixels,
    totalPixels,
    diffRatio: diffPixels / totalPixels,
    diffPng: PNG.sync.write(diff),
  };
}

function diffStats(bufferA, bufferB, gate) {
  const { diffPixels, totalPixels, diffRatio, diffPng } = compareBuffers(bufferA, bufferB);
  return {
    diffPixels,
    totalPixels,
    diffRatio,
    diffPercent: diffRatio * 100,
    pass: diffRatio <= gate,
    diffPng,
  };
}

// ---------------------------------------------------------------------- //
// Tooltip visibility check
// ---------------------------------------------------------------------- //

/**
 * Tries a real DOM-element visibility check first (TanStack Charts' default
 * tooltip always gets the stable `.ts-chart-tooltip` class -- see
 * `charts-core/src/renderer.ts` -- so this covers `tanstack` and, once it
 * exists, `migrated`). bklit-ui's `ChartTooltip` (repos/bklit-ui/packages/ui/
 * src/tooltip.tsx) has no stable class/id/data-attribute to hook (it's a
 * plain `motion.div` that returns `null` when not visible), so for that impl
 * this falls back to the same impl-agnostic "did #chart-root's text content
 * grow" heuristic already used and documented in bench/run.mjs's M3c
 * measurement -- proven there to reliably detect both impls' tooltip
 * appearance without false positives from bklit's always-present static
 * axis-label overlay divs.
 */
async function detectTooltip(page, textLenBefore) {
  const selectorResult = await page.evaluate(() => {
    const el = document.querySelector(".ts-chart-tooltip");
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    const visible =
      !el.hidden &&
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      rect.width > 0 &&
      rect.height > 0;
    return { visible };
  });
  if (selectorResult) return { visible: selectorResult.visible, method: "selector(.ts-chart-tooltip)" };

  const textLenAfter = await page.evaluate(() => {
    const root = document.getElementById("chart-root");
    return (root?.textContent ?? "").length;
  });
  return { visible: textLenAfter - textLenBefore >= 3, method: "text-length-heuristic" };
}

async function textLen(page) {
  return page.evaluate(() => {
    const root = document.getElementById("chart-root");
    return (root?.textContent ?? "").length;
  });
}

// ---------------------------------------------------------------------- //
// Capture: settled screenshot + 3 fixed-coordinate hover screenshots
// ---------------------------------------------------------------------- //

async function captureLoad(browser, baseUrl, { impl, chart, n }) {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: DEVICE_SCALE_FACTOR,
  });
  const page = await context.newPage();
  await page.goto(sceneUrl(baseUrl, { impl, chart, n }), { waitUntil: "commit" });
  await page.waitForFunction(() => window.__benchPaintDone === true, { timeout: 30000 });
  await page.evaluate(() => window.__benchSettled);
  // Small extra settle margin beyond promise resolution for any final
  // paint/compositing (fonts, subpixel AA) to land, mirroring the original
  // self-test capture helper's timing.
  await page.waitForTimeout(200);

  const settled = await page.screenshot({ fullPage: false });

  // Tooltip-heuristic baseline: sampled ONCE here, before ANY pointer
  // movement, and reused for every hover point. The previous per-fraction
  // baseline (re-sampled at (2,2) after a 30ms wait) was polluted by the
  // PRIOR hover's still-fading tooltip text: when consecutive tooltips have
  // near-identical text lengths (heatmap: fixed-format date + "N
  // contributions"), the delta fell under the 3-char threshold and the
  // heuristic false-negatived deterministically on hover-50/70 (found
  // 2026-07-31, heatmap self-test: tooltip visibly rendered in both loads'
  // pixel-identical captures yet reported not-visible). A pristine pre-hover
  // baseline removes the timing dependence entirely; identical for both
  // impls.
  const pristineTextLen = await textLen(page);

  const svgBox = await page.locator("#chart-root svg").first().boundingBox();
  if (!svgBox) {
    await context.close();
    throw new Error(`no <svg> found for ${impl}/${chart} n=${n} -- cannot compute hover points`);
  }

  // Discrete hover-zone probe snapping (see FUNNEL_CHARTS comment at the
  // top). Heatmap has the same dead-gap problem in svg space: cells are
  // per-cell <rect>s with 2px gaps, and the default (fraction*W, H/2)
  // probe can land in a gap — found as a DETERMINISTIC tooltip miss
  // (identical on both loads, pixels 0.0000%) at n=26 hover-50/70. The
  // heatmap probe set = centers of the modal-size rects (the cell grid,
  // discovered impl-agnostically by most-common width x height bucket) in
  // the row nearest the svg's vertical middle, picked by fraction along x
  // — same "sweep across the middle" intent, resting point always on a
  // real cell. Applied identically to both impls.
  let cellCenters = null;
  if (chart === "sankey") {
    // Sankey geometry is SPARSE: links are stroked Bezier centerlines and
    // nodes thin rects, so the default (fraction*W, H/2) probe can rest in
    // empty space (found at n=4: hover-70 deterministically missed on both
    // loads). Probe targets = the MIDPOINT of each link path (tooltip is
    // cursor-following and hover semantics are connectivity-based, so any
    // on-link point is a real, representative hover), picked by fraction
    // over the link list in document order — same getPointAtLength
    // technique as bench getSweepPoints. Applied identically to both impls.
    cellCenters = await page.evaluate(() => {
      const svg = document.querySelector("#chart-root svg");
      if (!svg) return [];
      const paths = Array.from(svg.querySelectorAll("path")).filter((p) => {
        if (typeof p.getTotalLength !== "function") return false;
        try {
          return p.getTotalLength() > 0;
        } catch {
          return false;
        }
      });
      const out = [];
      for (const p of paths) {
        const mid = p.getPointAtLength(p.getTotalLength() / 2);
        const ctm = p.getScreenCTM();
        if (!ctm) continue;
        const pt = svg.createSVGPoint();
        pt.x = mid.x;
        pt.y = mid.y;
        const client = pt.matrixTransform(ctm);
        out.push({ x: client.x, y: client.y });
      }
      return out;
    });
    const vp = page.viewportSize();
    cellCenters = cellCenters.filter(
      (c) => c.x >= 0 && c.x <= vp.width && c.y >= 0 && c.y <= vp.height,
    );
    if (cellCenters.length === 0) {
      console.warn(
        `[qa] ${impl}/${chart} n=${n}: no sankey link paths found -- using default probes`,
      );
      cellCenters = null;
    }
  } else if (chart === "heatmap") {
    cellCenters = await page.evaluate(() => {
      const svg = document.querySelector("#chart-root svg");
      if (!svg) return [];
      const rects = Array.from(svg.querySelectorAll("rect"))
        .map((r) => {
          const b = r.getBoundingClientRect();
          return { x: b.x + b.width / 2, y: b.y + b.height / 2, w: Math.round(b.width), h: Math.round(b.height) };
        })
        // Cells can be tiny at large n (n=260 weeks in a 1200px viewport
        // -> ~2px-wide cells); only drop degenerate zero-size rects and let
        // the modal-size bucket isolate the grid.
        .filter((r) => r.w >= 1 && r.h >= 1);
      if (rects.length === 0) return [];
      const buckets = new Map();
      for (const r of rects) {
        const key = `${r.w}x${r.h}`;
        buckets.set(key, (buckets.get(key) ?? 0) + 1);
      }
      const modal = [...buckets.entries()].sort((a, b) => b[1] - a[1])[0][0];
      const cells = rects.filter((r) => `${r.w}x${r.h}` === modal);
      const svgBox = svg.getBoundingClientRect();
      const midY = svgBox.y + svgBox.height / 2;
      let bestRowY = null;
      for (const c of cells) {
        if (bestRowY === null || Math.abs(c.y - midY) < Math.abs(bestRowY - midY)) bestRowY = c.y;
      }
      return cells
        .filter((c) => Math.abs(c.y - bestRowY) < 1)
        .map((c) => ({ x: c.x, y: c.y }))
        .sort((a, b) => a.x - b.x);
    });
    if (cellCenters.length === 0) {
      console.warn(
        `[qa] ${impl}/${chart} n=${n}: no heatmap cells found -- using default probes`,
      );
      cellCenters = null;
    }
  } else if (FUNNEL_CHARTS.has(chart)) {
    cellCenters = await page.evaluate(() => {
      const cells = Array.from(
        document.querySelectorAll("#chart-root .cursor-pointer"),
      );
      return cells.map((c) => {
        const b = c.getBoundingClientRect();
        return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
      });
    });
    // Only probe cells whose center is actually inside the viewport: at
    // large n the (intrinsically-sized, frozen) scenario can overflow the
    // 1200x800 capture viewport, and an offscreen probe target degenerates
    // to "whatever cell the cursor last crossed en route" — the same
    // nondeterminism this snapping exists to remove. QA pixel gates only
    // ever see the visible region, so probing the visible cells IS the
    // full observable hover surface. Applied identically to both impls.
    const vp = page.viewportSize();
    cellCenters = cellCenters.filter(
      (c) => c.x >= 0 && c.x <= vp.width && c.y >= 0 && c.y <= vp.height,
    );
    cellCenters.sort(
      chart === "funnel" ? (a, b) => a.x - b.x : (a, b) => a.y - b.y,
    );
    if (cellCenters.length === 0) {
      // Fall back to the default probe rather than fail the capture; a
      // missing cell overlay would show up in the pixel diff anyway.
      console.warn(
        `[qa] ${impl}/${chart} n=${n}: no hover cells found -- using default probes`,
      );
      cellCenters = null;
    }
  }

  const hovers = [];
  for (const fraction of HOVER_FRACTIONS) {
    let x = svgBox.x + svgBox.width * fraction;
    let y = svgBox.y + svgBox.height / 2;
    if (cellCenters) {
      const target =
        cellCenters[Math.round(fraction * (cellCenters.length - 1))];
      x = target.x;
      y = target.y;
    }

    // Move away from the chart first so each of the 3 fixed points is a
    // fresh hover-in (not a drag continuation from the previous point,
    // which could leave stale spring/transition state affecting the shot).
    await page.mouse.move(2, 2);
    await page.waitForTimeout(30);

    await page.mouse.move(x, y, { steps: 10 });
    await page.waitForTimeout(HOVER_WAIT_MS);

    const tooltip = await detectTooltip(page, pristineTextLen);
    const buffer = await page.screenshot({ fullPage: false });
    hovers.push({
      fraction,
      x,
      y,
      tooltipVisible: tooltip.visible,
      tooltipCheckMethod: tooltip.method,
      buffer,
    });
  }

  await context.close();
  return { settled, hovers };
}

// ---------------------------------------------------------------------- //
// Run one comparison (real Q1 compare, or --self-test)
// ---------------------------------------------------------------------- //

async function runComparison(browser, baseUrl, { chart, n, implA, implB, selfTest }) {
  const gate = selfTest ? SELF_TEST_GATE : COMPARE_GATE;
  const mode = selfTest ? "self-test" : "compare";

  const [capA, capB] = await Promise.all([
    captureLoad(browser, baseUrl, { impl: implA, chart, n }),
    captureLoad(browser, baseUrl, { impl: implB, chart, n }),
  ]);

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = path.join(RESULTS_DIR, chart, timestamp);
  mkdirSync(outDir, { recursive: true });

  const comparisons = [];
  const tooltipFailures = [];

  function writeComparison(label, bufA, bufB) {
    const stats = diffStats(bufA, bufB, gate);
    writeFileSync(path.join(outDir, `${label}-a.png`), bufA);
    writeFileSync(path.join(outDir, `${label}-b.png`), bufB);
    writeFileSync(path.join(outDir, `${label}-diff.png`), stats.diffPng);
    return stats;
  }

  // Settled state
  {
    const stats = writeComparison("settled", capA.settled, capB.settled);
    comparisons.push({
      name: "settled",
      diffPixels: stats.diffPixels,
      totalPixels: stats.totalPixels,
      diffRatio: stats.diffRatio,
      diffPercent: Number(stats.diffPercent.toFixed(4)),
      pass: stats.pass,
    });
  }

  // Hover states
  for (let i = 0; i < HOVER_FRACTIONS.length; i++) {
    const fraction = HOVER_FRACTIONS[i];
    const label = `hover-${Math.round(fraction * 100)}`;
    const hA = capA.hovers[i];
    const hB = capB.hovers[i];
    const stats = writeComparison(label, hA.buffer, hB.buffer);

    if (!TOOLTIPLESS_CHARTS.has(chart)) {
      if (!hA.tooltipVisible) {
        tooltipFailures.push({
          name: label,
          side: "A",
          impl: implA,
          reason: `tooltip not visible ${HOVER_WAIT_MS}ms after hover (checked via ${hA.tooltipCheckMethod})`,
        });
      }
      if (!hB.tooltipVisible) {
        tooltipFailures.push({
          name: label,
          side: "B",
          impl: implB,
          reason: `tooltip not visible ${HOVER_WAIT_MS}ms after hover (checked via ${hB.tooltipCheckMethod})`,
        });
      }
    }

    comparisons.push({
      name: label,
      fraction,
      point: { x: hA.x, y: hA.y },
      tooltipVisibleA: hA.tooltipVisible,
      tooltipVisibleB: hB.tooltipVisible,
      tooltipCheckMethodA: hA.tooltipCheckMethod,
      tooltipCheckMethodB: hB.tooltipCheckMethod,
      diffPixels: stats.diffPixels,
      totalPixels: stats.totalPixels,
      diffRatio: stats.diffRatio,
      diffPercent: Number(stats.diffPercent.toFixed(4)),
      pass: stats.pass,
    });
  }

  // A failed tooltip assertion means the corresponding screenshot pair isn't
  // measuring what it claims to (a real hover interaction) -- so it fails
  // the overall report even if the pixel diff of two tooltip-less shots
  // happens to be small. Per research/05: "record that as a failure ...
  // don't silently continue" -- it must not be masked by an otherwise-small
  // diffRatio.
  const overallPass = comparisons.every((c) => c.pass) && tooltipFailures.length === 0;

  const report = {
    chart,
    n,
    mode,
    implA,
    implB,
    timestamp,
    gate,
    viewport: { ...VIEWPORT, deviceScaleFactor: DEVICE_SCALE_FACTOR },
    comparisons,
    tooltipFailures,
    overallPass,
  };

  writeFileSync(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));
  return { report, outDir };
}

// ---------------------------------------------------------------------- //
// Server bootstrap (mirrors bench/run.mjs's ensureServer)
// ---------------------------------------------------------------------- //

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "inherit", ...opts });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(" ")} exited ${code}`))));
  });
}

async function waitForServer(url, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Server at ${url} did not become ready within ${timeoutMs}ms`);
}

async function ensureServer(baseUrl) {
  try {
    const res = await fetch(baseUrl);
    if (res.ok) {
      console.log(`[qa] reusing already-running server at ${baseUrl}`);
      return { stop: async () => {} };
    }
  } catch {
    // fall through and boot it
  }
  const distDir = path.join(APP_DIR, "dist");
  if (!existsSync(distDir) || readdirSync(distDir).length === 0) {
    console.log("[qa] building bench/app (vite build)...");
    await run("npm", ["run", "build"], { cwd: APP_DIR });
  }
  console.log(`[qa] starting vite preview on port ${PORT}...`);
  const child = spawn("npm", ["run", "preview", "--", "--port", String(PORT), "--strictPort"], {
    cwd: APP_DIR,
    stdio: "ignore",
  });
  await waitForServer(baseUrl);
  console.log(`[qa] server ready at ${baseUrl}`);
  return { stop: async () => child.kill() };
}

// ---------------------------------------------------------------------- //
// CLI
// ---------------------------------------------------------------------- //

function parseArgs(argv) {
  const args = { selfTest: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--self-test") args.selfTest = true;
    else if (a === "--chart") args.chart = argv[++i];
    else if (a === "--impl-a") args.implA = argv[++i];
    else if (a === "--impl-b") args.implB = argv[++i];
    else if (a === "--n") args.n = Number(argv[++i]);
    else {
      console.error(`[qa] unrecognized argument: ${a}`);
      process.exit(1);
    }
  }
  return args;
}

function usage() {
  console.error(
    "Usage: node qa/screenshot.mjs --chart <line|area|bar|scatter> --impl-a <bklit|tanstack|migrated> --impl-b <bklit|tanstack|migrated> [--n 1000]\n" +
      "   or: node qa/screenshot.mjs --chart <name> --self-test [--impl-a <bklit|tanstack|migrated>] [--n 1000]",
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.chart) {
    usage();
    process.exit(1);
  }

  const n = Number.isFinite(args.n) ? args.n : DEFAULT_N;
  let implA = args.implA ?? DEFAULT_IMPL_A;
  let implB = args.implB ?? DEFAULT_IMPL_B;

  if (args.selfTest) {
    if (args.implB && args.implA && args.implB !== args.implA) {
      console.warn(
        `[qa] --self-test compares a single impl against itself; ignoring --impl-b=${args.implB}, using --impl-a=${implA} for both loads`,
      );
    }
    implB = implA;
  }

  const server = await ensureServer(BASE_URL);
  const browser = await chromium.launch({ headless: true });

  let outcome;
  try {
    outcome = await runComparison(browser, BASE_URL, { chart: args.chart, n, implA, implB, selfTest: args.selfTest });
  } finally {
    await browser.close();
    await server.stop();
  }

  const { report, outDir } = outcome;
  const gatePct = (report.gate * 100).toFixed(1);
  console.log(`\n[qa] ${report.mode}: ${implA} vs ${implB} — ${args.chart} n=${n} (gate ${gatePct}%)`);
  for (const c of report.comparisons) {
    const line = `  ${c.name.padEnd(10)} ${c.pass ? "PASS" : "FAIL"}  ${c.diffPercent.toFixed(4)}% differing pixels`;
    console.log(
      c.tooltipVisibleA === undefined
        ? line
        : `${line}  tooltipA=${c.tooltipVisibleA} tooltipB=${c.tooltipVisibleB}`,
    );
  }
  if (report.tooltipFailures.length > 0) {
    console.log(`[qa] tooltip failures:`);
    for (const f of report.tooltipFailures) {
      console.log(`  - ${f.name} (${f.side}=${f.impl}): ${f.reason}`);
    }
  }
  console.log(`[qa] overall: ${report.overallPass ? "PASS" : "FAIL"}`);
  console.log(`[qa] wrote report + PNGs -> ${outDir}`);

  process.exit(report.overallPass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
