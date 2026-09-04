#!/usr/bin/env node
// Choropleth zoom/pan gate: screenshot.mjs never drives zoom (identity transform only), so this drives
// window.__benchZoomTo through reset/zoomed/panned and diffs via screenshot.mjs compareBuffers (gate 0.5%).
// Usage: node qa/zoom-gate.mjs [--n 1000] [--impl-a bklit] [--impl-b migrated] [--base-url <url>]
// Env QA_PORT (default 5198; bench/app is 5199, showcase 5200); QA_SKIP_REBUILD=1 mirrors screenshot.mjs.

import { chromium } from "playwright";
import { writeFileSync, mkdirSync, rmdirSync, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

// screenshot.mjs has no entrypoint guard (import auto-runs main() + process.exit); dynamic import with
// argv/exit stubbed extracts the real compareBuffers unmodified.
async function loadCompareBuffers() {
  const originalArgv = process.argv;
  process.argv = [originalArgv[0], originalArgv[1]];
  let exitCalls = 0;
  const originalExit = process.exit.bind(process);
  process.exit = (code) => {
    exitCalls += 1;
    if (exitCalls === 1) {
      throw new Error("[qa-zoom] neutralized screenshot.mjs's auto-run main() (expected, see loadCompareBuffers)");
    }
    // Second+ call is screenshot.mjs's own main().catch() reacting to the sentinel above; swallow it.
  };
  try {
    const mod = await import("./screenshot.mjs");
    return mod.compareBuffers;
  } finally {
    process.argv = originalArgv;
    process.exit = originalExit;
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const APP_DIR = path.join(ROOT, "bench", "app");
const RESULTS_DIR = path.join(ROOT, "qa", "results");
const PORT = Number(process.env.QA_PORT ?? 5198);
const BASE_URL = `http://localhost:${PORT}`;

const VIEWPORT = { width: 1200, height: 800 };
const DEVICE_SCALE_FACTOR = 1;
const CHART = "choropleth";
// Choropleth n is nominal (fixed ~177-feature geometry; n only seeds colors), so any n works; 1000 matches screenshot.mjs.
const DEFAULT_N = 1000;
const DEFAULT_IMPL_A = "bklit";
const DEFAULT_IMPL_B = "migrated";
const COMPARE_GATE = 0.005; // 0.5%, same as qa/screenshot.mjs's COMPARE_GATE

const ZOOM_STATES = ["reset", "zoomed", "panned"];

// GUARD: zoom <g> carries a 0.18s transform transition; settle via transitionend on transform, with a
// 500ms fallback for the no-op first reset (never fires transitionend); +100ms paint margin mirrors screenshot.mjs.
const ZOOM_SETTLE_TIMEOUT_MS = 500;
// Small paint/compositing margin after settle (mirrors screenshot.mjs's 200ms margin after __benchSettled).
const ZOOM_PAINT_MARGIN_MS = 100;

function sceneUrl(baseUrl, { impl, chart, n }) {
  return `${baseUrl}/?impl=${impl}&chart=${chart}&n=${n}`;
}

async function captureZoomState(browser, baseUrl, { impl, n, state }) {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: DEVICE_SCALE_FACTOR,
  });
  const page = await context.newPage();
  await page.goto(sceneUrl(baseUrl, { impl, chart: CHART, n }), { waitUntil: "commit" });
  await page.waitForFunction(() => window.__benchPaintDone === true, { timeout: 30000 });
  await page.evaluate(() => window.__benchSettled);
  await page.waitForTimeout(200);

  const hasHook = await page.evaluate(() => typeof window.__benchZoomTo === "function");
  if (!hasHook) {
    await context.close();
    throw new Error(
      `${impl}/${CHART}: window.__benchZoomTo is not defined on this load -- bench hook missing or renamed (expected from ZoomQaBridge in bench/app/src/scenarios/${impl}-choropleth.tsx)`,
    );
  }

  const settleMethod = await page.evaluate(
    ({ state, timeoutMs }) =>
      new Promise((resolve) => {
        let done = false;
        const onEnd = (e) => {
          if (done || e.propertyName !== "transform") return;
          done = true;
          window.removeEventListener("transitionend", onEnd, true);
          resolve("transitionend");
        };
        window.addEventListener("transitionend", onEnd, true);
        window.__benchZoomTo(state);
        setTimeout(() => {
          if (done) return;
          done = true;
          window.removeEventListener("transitionend", onEnd, true);
          resolve("timeout-fallback");
        }, timeoutMs);
      }),
    { state, timeoutMs: ZOOM_SETTLE_TIMEOUT_MS },
  );
  await page.waitForTimeout(ZOOM_PAINT_MARGIN_MS);

  const buffer = await page.screenshot({ fullPage: false });
  await context.close();
  return { buffer, settleMethod };
}

async function runZoomGate(browser, baseUrl, { n, implA, implB, compareBuffers }) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = path.join(RESULTS_DIR, `${CHART}-zoom`, timestamp);
  mkdirSync(outDir, { recursive: true });

  const comparisons = [];
  for (const state of ZOOM_STATES) {
    const [capA, capB] = await Promise.all([
      captureZoomState(browser, baseUrl, { impl: implA, n, state }),
      captureZoomState(browser, baseUrl, { impl: implB, n, state }),
    ]);
    const stats = compareBuffers(capA.buffer, capB.buffer);
    writeFileSync(path.join(outDir, `${state}-a.png`), capA.buffer);
    writeFileSync(path.join(outDir, `${state}-b.png`), capB.buffer);
    writeFileSync(path.join(outDir, `${state}-diff.png`), stats.diffPng);
    comparisons.push({
      name: state,
      diffPixels: stats.diffPixels,
      totalPixels: stats.totalPixels,
      diffRatio: stats.diffRatio,
      diffPercent: Number((stats.diffRatio * 100).toFixed(4)),
      pass: stats.diffRatio <= COMPARE_GATE,
      settleMethodA: capA.settleMethod,
      settleMethodB: capB.settleMethod,
    });
  }

  const overallPass = comparisons.every((c) => c.pass);
  const report = {
    chart: CHART,
    n,
    mode: "zoom-gate",
    implA,
    implB,
    timestamp,
    gate: COMPARE_GATE,
    viewport: { ...VIEWPORT, deviceScaleFactor: DEVICE_SCALE_FACTOR },
    states: ZOOM_STATES,
    comparisons,
    overallPass,
  };
  writeFileSync(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));
  return { report, outDir };
}

// Server bootstrap mirrors screenshot.mjs (same APP_DIR/.build-lock dir so concurrent builds serialize).
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

function newestSourceMtimeMs(dir) {
  let newest = 0;
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const e of entries) {
    if (e.name === "node_modules" || e.name === "dist" || e.name.startsWith(".")) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) newest = Math.max(newest, newestSourceMtimeMs(p));
    else {
      try {
        newest = Math.max(newest, statSync(p).mtimeMs);
      } catch {
        // deleted mid-scan; ignore
      }
    }
  }
  return newest;
}

async function rebuildIfStale(tag) {
  if (process.env.QA_SKIP_REBUILD === "1") {
    console.log(`${tag} QA_SKIP_REBUILD=1 — skipping stale-build check`);
    return;
  }
  const lockDir = path.join(APP_DIR, ".build-lock");
  let announcedWait = false;
  for (;;) {
    try {
      mkdirSync(lockDir);
      break;
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
      let age = 0;
      try {
        age = Date.now() - statSync(lockDir).mtimeMs;
      } catch {
        continue; // lock released between mkdir and stat: retry immediately
      }
      if (age > 120_000) {
        try { rmdirSync(lockDir); } catch {}
        continue;
      }
      if (!announcedWait) {
        announcedWait = true;
        console.log(`${tag} waiting for concurrent bench/app build...`);
      }
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  try {
    const distIndex = path.join(APP_DIR, "dist", "index.html");
    const distMtime = existsSync(distIndex) ? statSync(distIndex).mtimeMs : 0;
    const sourceRoots = [
      path.join(APP_DIR, "src"),
      path.join(APP_DIR, "index.html"),
      path.join(ROOT, "showcase", "migrated"),
      path.join(ROOT, "repos", "bklit-ui", "packages", "ui", "src"),
    ];
    const srcMtime = Math.max(
      ...sourceRoots.map((p) => {
        try {
          return statSync(p).isDirectory() ? newestSourceMtimeMs(p) : statSync(p).mtimeMs;
        } catch {
          return 0;
        }
      }),
    );
    if (distMtime === 0 || srcMtime > distMtime) {
      console.log(
        `${tag} bench/app dist ${distMtime === 0 ? "missing" : "STALE (sources newer than build)"} — rebuilding...`,
      );
      await run("npm", ["run", "build"], { cwd: APP_DIR });
    }
  } finally {
    try { rmdirSync(lockDir); } catch {}
  }
}

async function ensureServer(baseUrl) {
  await rebuildIfStale("[qa-zoom]");
  try {
    const res = await fetch(baseUrl);
    if (res.ok) {
      console.log(`[qa-zoom] reusing already-running server at ${baseUrl}`);
      return { stop: async () => {} };
    }
  } catch {
    // fall through and boot it
  }
  console.log(`[qa-zoom] starting vite preview on port ${PORT}...`);
  const child = spawn("npm", ["run", "preview", "--", "--port", String(PORT), "--strictPort"], {
    cwd: APP_DIR,
    stdio: "ignore",
  });
  await waitForServer(baseUrl);
  console.log(`[qa-zoom] server ready at ${baseUrl}`);
  return { stop: async () => child.kill() };
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--n") args.n = Number(argv[++i]);
    else if (a === "--impl-a") args.implA = argv[++i];
    else if (a === "--impl-b") args.implB = argv[++i];
    else if (a === "--base-url") args.baseUrl = argv[++i];
    else {
      console.error(`[qa-zoom] unrecognized argument: ${a}`);
      process.exit(1);
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const n = Number.isFinite(args.n) ? args.n : DEFAULT_N;
  const implA = args.implA ?? DEFAULT_IMPL_A;
  const implB = args.implB ?? DEFAULT_IMPL_B;
  const baseUrl = args.baseUrl || BASE_URL;

  const compareBuffers = await loadCompareBuffers();
  const server = await ensureServer(baseUrl);
  const browser = await chromium.launch({ headless: true });

  let outcome;
  try {
    outcome = await runZoomGate(browser, baseUrl, { n, implA, implB, compareBuffers });
  } finally {
    await browser.close();
    await server.stop();
  }

  const { report, outDir } = outcome;
  const gatePct = (report.gate * 100).toFixed(1);
  console.log(`\n[qa-zoom] ${implA} vs ${implB} — ${CHART} zoom-gate n=${n} (gate ${gatePct}%)`);
  for (const c of report.comparisons) {
    console.log(
      `  ${c.name.padEnd(8)} ${c.pass ? "PASS" : "FAIL"}  ${c.diffPercent.toFixed(4)}% differing pixels` +
        `  settleA=${c.settleMethodA} settleB=${c.settleMethodB}`,
    );
  }
  console.log(`[qa-zoom] overall: ${report.overallPass ? "PASS" : "FAIL"}`);
  console.log(`[qa-zoom] wrote report + PNGs -> ${outDir}`);
  process.exit(report.overallPass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
