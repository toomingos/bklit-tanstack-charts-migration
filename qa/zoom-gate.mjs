#!/usr/bin/env node
// qa/zoom-gate.mjs — choropleth zoom/pan verification gate.
//
// qa/screenshot.mjs's 4 probes (settled + hover@30/50/70%) never touch
// zoom: it never calls page.mouse.wheel, never does a drag (mouse.down /
// mouse.up), and has no choropleth-specific branch at all -- every probe
// therefore captures the map at its default (identity) transform. A
// completely broken zoom/pan engine would still report 0.0000% differing
// pixels there. This verification gap is already acknowledged in
// docs/phase-5/LOG.md D365 and research/phase-5/02-visx-removal.md:73 (the
// choropleth's zoom/pan is currently @visx/zoom and is slated to be
// replaced by a hand-rolled engine).
//
// This script closes that gap for the choropleth chart ONLY: it drives
// BOTH implementations' zoom transform deterministically via
// window.__benchZoomTo(state) -- exposed by bench/app/src/scenarios/
// bklit-choropleth.tsx:180 and migrated-choropleth.tsx:78 (ZoomQaBridge),
// NOT via real pointer wheel/drag emulation -- for three named states:
//   - "reset"  -- identity transform (zoom.reset()).
//   - "zoomed" -- 2x scale anchored at the SVG's own center point.
//   - "panned" -- 1.6x scale anchored at the (30%, 30%) point, so the
//     result is both scaled AND visibly off-center vs "zoomed", which is
//     what actually distinguishes a pure-zoom capture from a pan capture.
// See bklit-choropleth.tsx's header comment (~line 74) for the full
// transform math and the "why setTransformMatrix, not .scale()/.translate()"
// rationale; migrated-choropleth.tsx reproduces it verbatim.
//
// setTransformMatrix is an ABSOLUTE assignment (unlike .scale()/.translate(),
// which compose relative to whatever transform is already applied), so per
// bklit-choropleth.tsx's own comment, calling __benchZoomTo("zoomed") twice
// in a row -- or after "panned" -- always lands on the exact same matrix.
// This script still does exactly ONE fresh page load per (impl, state) pair
// regardless of that idempotency, mirroring qa/screenshot.mjs's per-capture
// browser-context isolation (captureLoad opens a fresh context per load).
//
// Diffing is NOT reimplemented: pixelmatch invocation, threshold (0.1,
// includeAA:false), and the diffRatio shape all come from
// qa/screenshot.mjs's exported `compareBuffers`, so this gate's numbers are
// directly comparable to the main gate's.
//
// Gate: same 0.5% differing-pixels threshold as qa/screenshot.mjs's real
// (non-self-test) compare gate.
//
// Usage:
//   node qa/zoom-gate.mjs [--n 1000] [--impl-a bklit] [--impl-b migrated] [--base-url <url>]
//
// Env: QA_PORT=<port> overrides :5198 -- the SAME port qa/screenshot.mjs
// uses (this is the same bench-app vite-preview server, just driven
// post-load rather than re-launched; bench/app itself runs on 5199 and
// showcase on 5200, neither of which this script touches).
// QA_SKIP_REBUILD=1 skips the stale-build check (mirrors qa/screenshot.mjs).

import { chromium } from "playwright";
import { writeFileSync, mkdirSync, rmdirSync, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

// ---------------------------------------------------------------------- //
// Reusing qa/screenshot.mjs's compareBuffers WITHOUT modifying it
// ---------------------------------------------------------------------- //
//
// screenshot.mjs cannot be `import`ed the normal way from another script:
// it has NO `import.meta.url === ...`-style entrypoint guard (verified --
// grepped the whole file), so its module body unconditionally calls
// `main()` at the top level, and `main()` synchronously calls
// `process.exit(1)` the instant it sees argv without --chart/--charts (its
// very first check, before any `await`). A plain
// `import { compareBuffers } from "./screenshot.mjs"` at the top of this
// file was tried first and confirmed to kill the whole process immediately
// -- `node qa/zoom-gate.mjs` just printed screenshot.mjs's own usage text
// and exited, before a single line of this script ran.
//
// `loadCompareBuffers()` below gets the REAL, unmodified `compareBuffers`
// out of screenshot.mjs via a dynamic import, while making that import
// side-effect-free: `process.argv` is temporarily pointed at an
// args-free argv (so screenshot.mjs's own parseArgs reliably takes the
// "missing --chart" branch regardless of whatever flags THIS script was
// invoked with), and `process.exit` is temporarily replaced with a stub
// that throws once (aborting main()'s synchronous execution at that very
// first exit() call, before it ever reaches ensureServer/browser/network
// work) and silently swallows the second call (screenshot.mjs's own
// `main().catch(err => { ...; process.exit(1); })` handler catching that
// thrown sentinel and calling exit again) so nothing becomes an unhandled
// rejection. Both are restored immediately after. Verified in isolation:
// after this, screenshot.mjs's main() never reaches any of its real work
// (no server, no browser, no file writes) -- only compareBuffers is
// extracted, and it is byte-for-byte the same function screenshot.mjs
// itself calls.
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
    // Second+ call is screenshot.mjs's own `main().catch()` handler
    // reacting to the thrown sentinel above -- swallow it so it doesn't
    // become an unhandled rejection.
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
// Choropleth's `n` is nominal (bklit-choropleth.tsx D34 note: the map's
// geometry is FIXED at ~177 vendored-asset features; `n` only seeds the
// per-country color/value map), so any n is equally valid for a zoom
// capture -- default matches qa/screenshot.mjs's DEFAULT_N and the value
// this chart has historically been probed with (see qa/results/choropleth).
const DEFAULT_N = 1000;
const DEFAULT_IMPL_A = "bklit";
const DEFAULT_IMPL_B = "migrated";
const COMPARE_GATE = 0.005; // 0.5%, same as qa/screenshot.mjs's COMPARE_GATE

const ZOOM_STATES = ["reset", "zoomed", "panned"];

// The <g> that receives the zoom transform carries `transition: transform
// 0.18s ease-out` on BOTH implementations whenever zoom.isDragging is false
// (repos/bklit-ui/packages/ui/src/charts/choropleth/choropleth-chart.tsx:227;
// showcase/migrated/charts/choropleth-chart.tsx:536) -- __benchZoomTo never
// sets isDragging, so that branch always applies. Settle is detected with a
// real `transitionend` event (filtered to propertyName "transform") bubbled
// up to `window`, NOT a guessed fixed wait, wherever a transition actually
// starts. The one case a transitionend can never fire is the FIRST "reset"
// call against a freshly mounted chart: it is already at the identity
// transform, so setTransformMatrix() there is a no-op and no transition is
// triggered at all. ZOOM_SETTLE_TIMEOUT_MS is the fallback for exactly that
// case -- set well above 0.18s (~2.8x) so it is never the limiting factor
// when a real transform change (and thus a real transitionend) occurs.
const ZOOM_SETTLE_TIMEOUT_MS = 500;
// Small paint/compositing margin applied after settle is detected/assumed,
// mirroring qa/screenshot.mjs's 200ms margin after __benchSettled resolves.
const ZOOM_PAINT_MARGIN_MS = 100;

function sceneUrl(baseUrl, { impl, chart, n }) {
  return `${baseUrl}/?impl=${impl}&chart=${chart}&n=${n}`;
}

// ---------------------------------------------------------------------- //
// Capture: load the scenario fresh, settle, drive to one zoom state, shoot
// ---------------------------------------------------------------------- //

async function captureZoomState(browser, baseUrl, { impl, n, state }) {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: DEVICE_SCALE_FACTOR,
  });
  const page = await context.newPage();
  await page.goto(sceneUrl(baseUrl, { impl, chart: CHART, n }), { waitUntil: "commit" });
  await page.waitForFunction(() => window.__benchPaintDone === true, { timeout: 30000 });
  await page.evaluate(() => window.__benchSettled);
  // Mirrors qa/screenshot.mjs captureLoad's post-__benchSettled margin for
  // any final paint/compositing to land before we touch zoom state.
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

// ---------------------------------------------------------------------- //
// Run all 3 states, diff each (implA, implB) pair, write report + PNGs
// ---------------------------------------------------------------------- //

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
  // Same shape as qa/screenshot.mjs's report.json (chart/n/mode/implA/implB/
  // timestamp/gate/viewport/comparisons/overallPass) plus a `states` field,
  // so tooling written against the main gate's report can read either.
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

// ---------------------------------------------------------------------- //
// Server bootstrap -- mirrors qa/screenshot.mjs's ensureServer /
// rebuildIfStale / waitForServer / newestSourceMtimeMs. screenshot.mjs only
// exports `compareBuffers`, so this bootstrap logic is duplicated here
// rather than imported (screenshot.mjs itself is not modified). Uses the
// SAME build-lock directory (APP_DIR/.build-lock) so a concurrent
// `qa/screenshot.mjs` build is serialized against this one rather than
// racing it.
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

// ---------------------------------------------------------------------- //
// CLI
// ---------------------------------------------------------------------- //

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
