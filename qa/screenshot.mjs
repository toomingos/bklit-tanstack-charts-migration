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
// WHICH IMPLS THIS COMPARES -- read this before writing any ad-hoc probe.
// The gate's default pair is `bklit` vs `migrated` (DEFAULT_IMPL_A /
// DEFAULT_IMPL_B below). All three impls are registered in
// `bench/app/src/scenarios/index.ts`:
//   bklit    -- the legacy component; the parity target.
//   migrated -- the ported component; what the gate actually measures.
//   tanstack -- the PERFORMANCE-CEILING reference (native/idiomatic TanStack
//               styling). It deliberately ports NONE of bklit's chrome, so
//               diffing it against bklit measures nothing meaningful about
//               the migration.
// An earlier version of this note claimed no `migrated` scenario existed and
// that only `bklit|tanstack` were accepted. That was already stale and it
// caused a full ad-hoc hover investigation to be run against the wrong impl
// (D258). Probe `migrated`, not `tanstack`, unless you specifically want the
// performance ceiling.

import { chromium } from "playwright";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import { spawn } from "node:child_process";
import { mkdirSync, rmdirSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const APP_DIR = path.join(ROOT, "bench", "app");
const RESULTS_DIR = path.join(ROOT, "qa", "results");
const PORT = Number(process.env.QA_PORT ?? 5198);
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
  // P5.5 Strand 3: same chart as `sunburst`, plus a breadcrumb and a
  // render-prop hint. Still tooltipless for the same D24 reason.
  "sunchrome",
  "funnel",
  "funnelvertical",
  // legend is a chart-less HTML scenario (initiative 8, D223 ruling 4):
  // no tooltip contract at all — hover state is a CSS dim driven via
  // window.__qaSetLegendHover, asserted by the pixel diffs alone.
  "legend",
  // P6.4: the two loading-PRESET fixtures (D341). A skeleton has no data
  // behind it, so neither impl renders a tooltip — the assertion failed
  // SYMMETRICALLY on A and B in every run, which is the signature of a
  // harness gap rather than a chart defect. Confirmed by --self-test:
  // bklit-vs-bklit scores 0.0000% on all four captures and still reports
  // `overall: FAIL` purely on this assertion. The pixel gate is unchanged
  // and remains the real check for both.
  "arealoading",
  "barloading",
]);
// Loading-PRESET phase pin (D588): `arealoading` and `barloading` render
// permanently-animated skeleton chrome in the READY state (the Area/Bar...
// Loading preset components, not `?state=loading`), so they never take the
// reduced-motion loading path below. Their pulse/sweep loops are infinite
// (`repeat: Infinity` WAAPI tweens on the bklit side,
// `ts-bkm-loading-pulse 1.6s` / `ts-bkm-loading-sweep 2s` CSS keyframes on
// the migrated side), and an unpinned capture lands at a random phase --
// the D588 flake (arealoading/1000 hover-50: 427px isolated vs 24,407px
// in-gate, same code, same build). Settled/hover captures for these charts
// pin to phase 0 via pinAnimationPhase; the pulse-phase sweep below then
// samples chosen phases on purpose (bardepth precedent).
const LOADING_PRESET_CHARTS = new Set(["arealoading", "barloading"]);
// Fixed fractions through the pulse cycle, mirroring bardepth's
// `pulse-phase-<t>` labels.
const LOADING_PIN_PHASES = [0, 0.25, 0.5, 0.75];
// D591: this whole loading-phase vector is OFF by default because neither
// half does what it was written to do, proven by runtime self-test:
//   - the virtual-time budget wedges (budget expires before paint, rAF then
//     halts for good, __benchPaintDone never set, 30s timeout every run);
//   - pinAnimationPhase finds ZERO infinite animations on BOTH impls for
//     arealoading ("pinned 0/0"), because bklit drives its loading loop
//     through motion's JS rAF and migrated through the TanStack reconciler's
//     -- neither is a WAAPI/CSS player, so getAnimations() cannot see them.
// The 4 pulse-phase cells would therefore be 4 more PHASE-RANDOM captures on
// the very chart D588 flaked on, so they stay off rather than feeding the
// gate new flake surface. D588 remains unfixed; see LOG.md D591.
const LOADING_PHASE_VECTOR = process.env.QA_LOADING_PHASE_VECTOR === "1";
// D588 follow-up (V-c): virtual-time budget for the two loading presets,
// in VIRTUAL milliseconds from navigation. The budget always expires at the
// same virtual instant on both loads, so the expiry IS the deterministic
// anchor: JS rAF loops (bklit pulse/shimmer/label), CSS keyframes (migrated
// sweep band) and the per-pass re-roll ticks on both sides all freeze with
// identical phases. Sized so paint always lands first (paint is ~2-5s of
// virtual time even on loaded CI; a pre-paint expiry would wedge the paint
// wait below into its 30s timeout -- loud, not silent). Wall cost: the
// renderer burns the budget as-fast-as-possible, roughly tens of seconds
// per preset load; acceptable for two charts.
const PRESET_VIRTUAL_BUDGET_MS = 30000;
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
// Loading-state capture (D211/D212 gate): the two impls animate loading
// chrome with DIFFERENT engines (bklit: motion/react rAF springs; migrated:
// CSS keyframes per the Phase 3 stack contract), so no single mechanism can
// phase-pin both to the same animation instant. The gate therefore captures
// the STATIC loading frame both impls render under `prefers-reduced-motion:
// reduce` (bklit's loading chrome branches on `useReducedMotion`; migrated
// modules must honor the same media query for parity). Animation DYNAMICS
// are out of pixel-gate scope — covered by manual Chrome verification with
// a lead ruling in docs/phase-3/LOG.md (D211 fallback clause).
// `__benchSettled` never resolves in the loading phase (the chart never
// reaches "ready"), so the loading path waits a fixed post-paint delay
// instead — long enough for enter fades (BACKGROUND_ENTER_FADE_MS 420,
// label fade) to complete even if an impl runs them despite reduced motion.
const LOADING_SETTLE_MS = 1500;

function sceneUrl(baseUrl, { impl, chart, n, state }) {
  const base = `${baseUrl}/?impl=${impl}&chart=${chart}&n=${n}`;
  return state === "loading" ? `${base}&state=loading` : base;
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
// Animation phase pin (D588)
// ---------------------------------------------------------------------- //

/**
 * Seeks every INFINITE animation on the page (CSS Animations, CSS
 * Transitions and Web Animations alike via `document.getAnimations()`) to
 * `fraction` through its own cycle and pauses it, so a screenshot taken
 * immediately after sees a deterministic phase on both impls with no
 * per-chart hook. Bardepth's doctrine generalised: pin the phase for parity
 * captures, then sample chosen phases on purpose (see LOADING_PIN_PHASES).
 *
 * Only infinite-iteration animations are touched
 * (`effect.getTiming().iterations === Infinity` -- the migrated CSS pulse /
 * sweep keyframes and bklit's `repeat: Infinity` motion sweeps): one-shot
 * entrance/tooltip/hover transitions are finite and already covered by the
 * existing fixed waits (HOVER_WAIT_MS et al.); seeking those to phase 0
 * would rewind them mid-flight and change what the capture means.
 *
 * Late arrivals (a hover starts new transitions) are handled by calling
 * this again immediately before EACH capture, not once per load. An idle
 * animation whose `currentTime` setter throws is left alone. The evaluate
 * resolves only after two animation frames have run, so the seek has
 * painted before the caller shoots -- and it carries a post-condition
 * recount proving the pinned state committed rather than assuming it. A
 * short warn (never silent) fires when there was nothing to pin or the
 * recount falls short: for a loading preset that means the flake source is
 * NOT in getAnimations' reach (e.g. a JS-rAF-driven MotionValue loop) and
 * the capture below is still phase-random.
 */
async function pinAnimationPhase(page, fraction, tag) {
  const stats = await page.evaluate((phase) => {
    const infiniteTiming = (animation) => {
      let timing = null;
      try {
        timing = animation.effect?.getTiming?.();
      } catch {
        timing = null;
      }
      return timing && timing.iterations === Infinity ? timing : null;
    };
    for (const animation of document.getAnimations()) {
      const timing = infiniteTiming(animation);
      if (!timing) continue;
      try {
        const duration = timing.duration;
        if (Number.isFinite(duration) && duration > 0) {
          animation.currentTime = phase * duration;
        }
        animation.pause();
      } catch {
        // Idle/pending animations can reject the seek -- leave them; they
        // hold no visible phase.
      }
    }
    return new Promise((resolve) => {
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          let total = 0;
          let verified = 0;
          for (const animation of document.getAnimations()) {
            if (!infiniteTiming(animation)) continue;
            total++;
            if (animation.playState === "paused") verified++;
          }
          resolve({ total, verified });
        }),
      );
    });
  }, fraction);
  if (stats.total === 0 || stats.verified < stats.total) {
    console.warn(
      `[qa] ${tag}: phase pin incomplete (pinned ${stats.verified}/${stats.total}) -- capture may still be phase-random`,
    );
  }
  return stats;
}

// ---------------------------------------------------------------------- //
// Virtual-time anchor (D588 follow-up, V-c)
// ---------------------------------------------------------------------- //

/**
 * Promise that resolves when the renderer's virtual-time budget expires
 * (`Emulation.virtualTimeBudgetExpired`). Attach BEFORE sending the policy
 * -- an expiry that fires before the listener exists is missed, and the
 * capture below would hang on a settled promise instead of failing loudly.
 * CDP-session pattern mirrors bench/run.mjs's `newCDPSession` precedent;
 * first virtual-time use in qa/ (the markers fan capture uses
 * addInitScript instead), scoped to the two loading presets only.
 */
function awaitVirtualBudgetExpired(cdp) {
  return new Promise((resolve) => {
    cdp.on("Emulation.virtualTimeBudgetExpired", () => resolve());
  });
}

// ---------------------------------------------------------------------- //
// Capture: settled screenshot + 3 fixed-coordinate hover screenshots
// ---------------------------------------------------------------------- //

async function captureLoad(browser, baseUrl, { impl, chart, n, state }) {
  const loading = state === "loading";
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: DEVICE_SCALE_FACTOR,
    // Loading captures pin both impls' animated loading chrome to its
    // static reduced-motion frame (see LOADING_SETTLE_MS comment).
    ...(loading ? { reducedMotion: "reduce" } : {}),
  });
  const page = await context.newPage();
  // D588 follow-up (V-c): freeze the loading presets on a SHARED virtual
  // timeline. Installed BEFORE goto so both engines run on virtual time
  // from navigation: motion's JS driver (bklit's pulse/shimmer/label loops)
  // and the compositor (migrated's CSS sweep + both sides' per-pass re-roll
  // ticks) all advance with the same budget and expire at the same virtual
  // instant. `pauseIfNetworkFetchesPending` keeps virtual time from outrun-
  // ning the (self-hosted Geist) font fetch, so the label glyphs land at the
  // same virtual instant too. Every other chart keeps real time -- the blast
  // radius is these two charts' loads only.
  // D591: the virtual-time budget half of this vector wedges — see LOG.md.
  // Once the budget expires rAF halts for good, so a pre-paint expiry means
  // __benchPaintDone is never set and the wait below burns its full 30s.
  // arealoading/1000 reproduces it every run. Off by default; the phase pin
  // (pinAnimationPhase) is the half that works and stays on.
  const presetVirtual = LOADING_PHASE_VECTOR && !loading && LOADING_PRESET_CHARTS.has(chart);
  let presetBudgetExpired = null;
  if (presetVirtual) {
    const cdp = await context.newCDPSession(page);
    presetBudgetExpired = awaitVirtualBudgetExpired(cdp);
    await cdp.send("Emulation.setVirtualTimePolicy", {
      policy: "pauseIfNetworkFetchesPending",
      budget: PRESET_VIRTUAL_BUDGET_MS,
    });
  }
  await page.goto(sceneUrl(baseUrl, { impl, chart, n, state }), { waitUntil: "commit" });
  if (chart === "legend") {
    // __benchPaintDone is set by markMountPaint AFTER an <svg> commits
    // (bench/app/src/bench/paint.ts) — the chart-less legend scenario never
    // renders one, so wait on the scenario's own __benchSettled (a promise
    // resolved on double-rAF after mount) instead.
    await page.waitForFunction(() => !!window.__benchSettled, { timeout: 30000 });
  } else if (presetVirtual) {
    // Under an exhausted virtual-time budget rAF stops, which would hang
    // waitForFunction's default rAF polling -- poll from Node instead. (The
    // budget is sized to expire AFTER paint, so this normally resolves while
    // virtual time is still flowing; the interval polling only matters on
    // the slow-CI tail where expiry wins the race.)
    await page.waitForFunction(() => window.__benchPaintDone === true, { timeout: 30000, polling: 100 });
  } else {
    await page.waitForFunction(() => window.__benchPaintDone === true, { timeout: 30000 });
  }
  if (loading) {
    // The loading phase never resolves __benchSettled (the chart never
    // reaches "ready"); use a fixed post-paint delay, then capture the one
    // loading frame. No hover captures: loading chrome has no tooltip
    // contract, and the pixel gate on this frame IS the loading gate.
    await page.waitForTimeout(LOADING_SETTLE_MS);
    const settled = await page.screenshot({ fullPage: false });
    await context.close();
    return { settled, hovers: [] };
  }
  await page.evaluate(() => window.__benchSettled);
  // Small extra settle margin beyond promise resolution for any final
  // paint/compositing (fonts, subpixel AA) to land, mirroring the original
  // self-test capture helper's timing.
  await page.waitForTimeout(200);
  if (presetVirtual) {
    // Deterministic anchor: the budget expires at the same virtual instant
    // from navigation on both loads, so everything below captures a frozen
    // page with identical loop phases. The wall-clock waits above stay
    // harmless -- virtual time no longer advances, so they settle nothing,
    // and the pin calls below degrade to exact seeks on already-paused CSS
    // (kept, not reverted: they remain the CSS-phase mechanism if virtual
    // time is ever unavailable).
    await presetBudgetExpired;
  }

  if (LOADING_PRESET_CHARTS.has(chart)) {
    // D588: the skeleton pulse/sweep loops never settle -- pin to phase 0
    // so the settled capture compares a deterministic frame on both impls.
    await pinAnimationPhase(page, 0, `${impl}/${chart} n=${n} settled`);
  }
  const settled = await page.screenshot({ fullPage: false });

  // Initiative-10 (D229 ruling 9) evidence probe: the migrated dash-tail
  // overlay renders the BASE line stroke transparent (line-chart.tsx:273,
  // `stroke: hasDashTail ? "transparent" : line.stroke`) and draws the
  // VISIBLE dash-tail as a separate overlay path (internal/dash-tail.ts)
  // kept in sync with the base path's geometry -- this only works if the
  // (invisible) base path still carries real path data. One-off DOM probe
  // for the "markers" scenario's dash-tail series (seriesA), logged (not
  // gated -- this is evidence for the lead, not a pixel comparison) as a
  // JSON line per impl.
  if (chart === "markers") {
    const probe = await page.evaluate(() => {
      const group = document.querySelector('.ts-chart__line[data-ts-key^="seriesA:"]');
      const path = group ? group.querySelector("path") : null;
      if (!path) return { found: false, totalLength: null, hasD: false };
      let totalLength = null;
      try {
        totalLength = path.getTotalLength();
      } catch {
        totalLength = null;
      }
      const d = path.getAttribute("d");
      return { found: true, totalLength, hasD: Boolean(d && d.length > 0) };
    });
    console.log(
      JSON.stringify({
        probe: "dash-tail-transparent-stroke",
        impl,
        found: probe.found,
        totalLength: probe.totalLength,
        hasD: probe.hasD,
      }),
    );
  }

  // Legend scenario (initiative 8, D223 ruling 4): a chart-less HTML page —
  // no <svg>, no tooltip, no pointer-coordinate probes. Hover states are set
  // deterministically through window.__qaSetLegendHover(i) (both scenario
  // impls expose it), one capture per hovered item index; the wait covers
  // the 150ms .legend-container opacity transition with margin. The pixel
  // diffs of these captures ARE the hover gate (legend is in
  // TOOLTIPLESS_CHARTS, so no tooltip assertion applies).
  if (chart === "legend") {
    const hovers = [];
    for (const idx of [0, 1, 2]) {
      await page.evaluate((i) => window.__qaSetLegendHover(i), idx);
      await page.waitForTimeout(300);
      const buffer = await page.screenshot({ fullPage: false });
      hovers.push({
        fraction: idx,
        x: 0,
        y: 0,
        tooltipVisible: true,
        tooltipCheckMethod: "legend-hover-skip",
        buffer,
        label: `hover-item-${idx}`,
      });
    }
    await context.close();
    return { settled, hovers };
  }

  // Legend→chart dim pairs (initiative 8 loop-2, D225): candlelegend +
  // legendhover render real charts (svg present, __benchPaintDone works)
  // but the NEW surface under test is the legend-driven series/sign dim,
  // not pointer hover (pointer parity for candle/composed/bar is already
  // gated by their own base pairs). Hover states are therefore set
  // deterministically via window.__qaSetLegendHover — index 0, index 1,
  // then null (the restore path: dim must clear) — and the pixel diffs of
  // these captures ARE the gate; pointer probes + the tooltip assertion
  // are skipped identically for both impls. The 700ms wait covers the
  // slowest dim transition in play (hover-chrome DIM_TRANSITION 0.4s;
  // candle .chart-candle-cell 0.15s) with margin. Gate-author (Fable)
  // edit per D225.
  if (chart === "candlelegend" || chart === "legendhover") {
    const hovers = [];
    for (const idx of [0, 1, null]) {
      await page.evaluate((i) => window.__qaSetLegendHover(i), idx);
      await page.waitForTimeout(700);
      const buffer = await page.screenshot({ fullPage: false });
      hovers.push({
        fraction: idx === null ? "clear" : idx,
        x: 0,
        y: 0,
        tooltipVisible: true,
        tooltipCheckMethod: "legend-hover-skip",
        buffer,
        label: idx === null ? "hover-clear" : `hover-item-${idx}`,
      });
    }
    await context.close();
    return { settled, hovers };
  }

  // Brush pair (initiative 9, D227 ruling 6): the settled capture above IS
  // the full-extent state (useBrushSelection initializes to the full track
  // extent). Domain states are then committed deterministically via
  // window.__qaSetBrush(startFrac, endFrac) — both scenarios route it
  // through the layout's own onBrushSelectionChange, the same handler a
  // pointer drag commits through — capturing left-half, right-half, one
  // pointer-hover over the zoomed main chart (real tooltip assertion), and
  // the null clear (must restore the full extent, chart-brush-layout.tsx
  // clear-resets-to-full behavior). The 900ms waits cover the 500ms
  // y-domain tween (tweenYDomainOnXDomainChange, both demos/scenarios pass
  // it) plus label fades with margin. Pixel diffs of these captures ARE the
  // brush gate. Gate-author (lead) edit per D213/D227.
  if (chart === "brush") {
    const hovers = [];
    const brushStates = [
      { label: "brush-left-half", args: [0, 0.5] },
      { label: "brush-right-half", args: [0.5, 1] },
    ];
    for (const st of brushStates) {
      await page.evaluate(
        ([a, b]) => window.__qaSetBrush(a, b),
        st.args,
      );
      await page.waitForTimeout(900);
      const buffer = await page.screenshot({ fullPage: false });
      hovers.push({
        fraction: st.label,
        x: 0,
        y: 0,
        tooltipVisible: true,
        tooltipCheckMethod: "brush-domain-skip",
        buffer,
        label: st.label,
      });
    }
    // Composed brush+hover capture: with the right-half domain still
    // committed, hover the MAIN chart's center — the LARGEST-area svg
    // (BrushLayout renders main before strip in both impls, but "first
    // svg" is impl-fragile: migrated hosts a 0x0 clipPath-defs svg before
    // the chart svg) — and assert the tooltip via the text-length
    // heuristic against a baseline sampled AFTER the domain change.
    const mainBox = await page.evaluate(() => {
      let best = null;
      for (const s of document.querySelectorAll("#chart-root svg")) {
        const r = s.getBoundingClientRect();
        if (!best || r.width * r.height > best.width * best.height) {
          best = { x: r.x, y: r.y, width: r.width, height: r.height };
        }
      }
      return best && best.width > 0 && best.height > 0 ? best : null;
    });
    if (!mainBox) {
      await context.close();
      throw new Error(`no main-chart <svg> found for ${impl}/${chart} n=${n} (brush hover capture)`);
    }
    const preHoverLen = await textLen(page);
    const hx = mainBox.x + mainBox.width * 0.5;
    const hy = mainBox.y + mainBox.height * 0.5;
    await page.mouse.move(hx - 20, hy);
    await page.mouse.move(hx, hy);
    await page.waitForTimeout(HOVER_WAIT_MS);
    const hoverBuffer = await page.screenshot({ fullPage: false });
    const postHoverLen = await textLen(page);
    hovers.push({
      fraction: "brush-hover-50",
      x: hx,
      y: hy,
      tooltipVisible: postHoverLen - preHoverLen >= 3,
      tooltipCheckMethod: "text-length-heuristic",
      buffer: hoverBuffer,
      label: "brush-hover-50",
    });
    // Park the pointer off-plot, then clear: null must reset to the full
    // extent (visually identical to the settled capture up to the tween).
    await page.mouse.move(2, 2);
    await page.evaluate(() => window.__qaSetBrush(null));
    await page.waitForTimeout(900);
    const clearBuffer = await page.screenshot({ fullPage: false });
    hovers.push({
      fraction: "brush-clear",
      x: 0,
      y: 0,
      tooltipVisible: true,
      tooltipCheckMethod: "brush-domain-skip",
      buffer: clearBuffer,
      label: "brush-clear",
    });
    await context.close();
    return { settled, hovers };
  }

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

  // LARGEST svg, not `.first()` — the brush capture path below already does
  // this and its comment names the hazard: migrated hosts a 0x0 clipPath-defs
  // <svg> BEFORE the chart <svg> whenever `xDomain` is set
  // (line-chart.tsx:1045, `needsBrushClip`). `.first()` therefore returned a
  // 0x0 box for migrated-with-xDomain and every hover landed at the container
  // origin, off the plot — reported as "tooltip not visible" for B only, on a
  // chart that hovers correctly (D348). bklit puts its real svg first, so the
  // A side hovered normally and the pixel gates still passed; only the
  // tooltip assertion caught it, and it blamed the chart. Impl-agnostic.
  const svgBox = await page.evaluate(() => {
    let best = null;
    for (const s of document.querySelectorAll("#chart-root svg")) {
      const r = s.getBoundingClientRect();
      if (!best || r.width * r.height > best.width * best.height) {
        best = { x: r.x, y: r.y, width: r.width, height: r.height };
      }
    }
    return best && best.width > 0 && best.height > 0 ? best : null;
  });
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
    if (LOADING_PRESET_CHARTS.has(chart)) {
      // Re-pin before EACH capture: the hover approach may have started new
      // animations since the settled pin, and an unpinned hover capture is
      // the exact D588 flake (arealoading/1000 hover-50).
      await pinAnimationPhase(page, 0, `${impl}/${chart} n=${n} hover-${Math.round(fraction * 100)}`);
    }
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

  // Loading-preset pulse-phase sweep (D588): the bardepth-precedent half of
  // the doctrine -- having pinned parity captures to phase 0 above, sample
  // fixed fractions through the pulse cycle on purpose so animation coverage
  // goes UP, not down. Each phase seeks every infinite animation to that
  // fraction of its OWN cycle (1.6s pulse vs 2s sweep vs bklit's WAAPI loop
  // periods) and pauses it; no per-chart hook, no `animations: "disabled"`.
  // The pointer stays where the hover sweep left it (same for both impls);
  // the pin's own double-rAF is the only settle these captures need.
  if (LOADING_PHASE_VECTOR && LOADING_PRESET_CHARTS.has(chart)) {
    for (const t of LOADING_PIN_PHASES) {
      await pinAnimationPhase(page, t, `${impl}/${chart} n=${n} pulse-phase-${t}`);
      const buffer = await page.screenshot({ fullPage: false });
      hovers.push({
        fraction: `pulse-phase-${t}`,
        x: 0,
        y: 0,
        tooltipVisible: true,
        tooltipCheckMethod: "loading-pulse-phase-skip",
        buffer,
        label: `pulse-phase-${t}`,
      });
    }
  }

  // Markers-specific probes (initiative 10, D229 ruling 10), appended AFTER
  // the standard settled + 3-fraction hover sweep above -- the "markers"
  // scenario is a plain Line host (a ChartMarkers overlay sits on top), so
  // that generic path-based sweep already covers dim + active-point-
  // highlight the same way "line"/"area" do; nothing chart-specific was
  // needed for captures (1)/(2).
  if (chart === "markers") {
    // (3) Legend-hover probe: dims the OTHER series' line + THIS series'
    // marker grid + dash-tail together in one shot (internal/hover-chrome.ts
    // ORs legendHoveredIndex into all three dim terms -- single-writer
    // D225/D226 doctrine). Mirrors the candlelegend/legendhover branch
    // above: index 0, index 1, then null (the restore path must clear).
    for (const idx of [0, 1, null]) {
      await page.evaluate((i) => window.__qaSetLegendHover(i), idx);
      await page.waitForTimeout(700);
      const buffer = await page.screenshot({ fullPage: false });
      hovers.push({
        fraction: idx === null ? "legend-clear" : `legend-${idx}`,
        x: 0,
        y: 0,
        tooltipVisible: true,
        tooltipCheckMethod: "legend-hover-skip",
        buffer,
        label: idx === null ? "legend-hover-clear" : `legend-hover-${idx}`,
      });
    }
    await page.evaluate(() => window.__qaSetLegendHover(null));

    // (4) Fan-open probe: forces the ChartMarkers same-date cluster fanned
    // open WITHOUT a real pointer hover (plan research/phase-3/plans/
    // 10-markers-chrome/plan-loop-1.md §7: "real pointer-hover fan-out is
    // not reliably capturable via a settled-state screenshot"). Migrated
    // exposes window.__qaSetMarkerFan (internal/chart-markers.tsx,
    // MarkerGroupView) checked at EVERY render; to guarantee it's already
    // `true` on React's very first render we use Playwright's
    // addInitScript on a FRESH context/page -- this harness had no earlier
    // pre-mount flag-injection precedent (checked: no addInitScript /
    // evaluateOnNewDocument usage anywhere in qa/ or bench/ before this),
    // so this is a new, deliberately narrow mechanism introduced only here.
    //
    // KNOWN, DISCLOSED ASYMMETRY (see final report): bklit's frozen
    // MarkerGroup (repos/bklit-ui, off-limits) has NO equivalent hook --
    // Task 2 scoped __qaSetMarkerFan to showcase/migrated ONLY, by design,
    // and bklit-ui's public ChartMarkers/MarkerGroup wrapper doesn't expose
    // a forceOpen pass-through despite the underlying component supporting
    // it. bklit's load therefore ignores this flag and stays collapsed,
    // identical to its own settled capture. A REAL bklit-vs-migrated
    // compare on this ONE state is therefore EXPECTED to diff -- that is
    // not a defect in either impl, it documents a real capability gap in
    // the QA harness, not the charts. Only a migrated-vs-migrated
    // --self-test run validates this capture's determinism (SELF_TEST_GATE
    // applies to it exactly like every other comparison -- no special-case
    // code needed, `runComparison` already applies gate uniformly).
    const fanContext = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: DEVICE_SCALE_FACTOR,
    });
    const fanPage = await fanContext.newPage();
    await fanPage.addInitScript(() => {
      window.__qaSetMarkerFan = true;
    });
    await fanPage.goto(sceneUrl(baseUrl, { impl, chart, n, state }), { waitUntil: "commit" });
    await fanPage.waitForFunction(() => window.__benchPaintDone === true, { timeout: 30000 });
    await fanPage.evaluate(() => window.__benchSettled);
    // Fan open/close transition is 220ms (chart-markers.tsx
    // MarkerGroupView); extra margin covers the per-marker fan-entrance
    // stagger (i*40ms) and the bucket entrance-reveal stagger (idx*100ms)
    // plus general settle-timing jitter, mirroring the brush branch's
    // 900ms domain-tween margin above.
    await fanPage.waitForTimeout(900);
    const fanBuffer = await fanPage.screenshot({ fullPage: false });
    await fanContext.close();
    hovers.push({
      fraction: "marker-fan-open",
      x: 0,
      y: 0,
      tooltipVisible: true,
      tooltipCheckMethod: "marker-fan-skip",
      buffer: fanBuffer,
      label: "marker-fan-open",
    });
  }

  // PatternArea (initiative 11, plan-loop-1 ruling 7): appended AFTER the
  // standard settled + 3-fraction hover sweep above -- "patternarea" is a
  // plain Area host (PatternArea's own fill mark + a zero-opacity <Area>
  // stroke sibling, see the scenario files), so that generic path-based
  // sweep already covers the base dim/hover/tooltip parity the same way
  // "line"/"area" do. The NEW surface under test here is the 8-preset
  // cycling: window.__qaSetPatternPreset(id) (both bklit-patternarea.tsx
  // and migrated-patternarea.tsx expose it) swaps which pattern's <defs>
  // the fill references -- one capture per PATTERN_PRESET_IDS entry
  // (pattern-preset.tsx / repos/bklit-ui's own copy, order verbatim). No
  // CSS transition to wait out (the fill's url(#id) changes immediately),
  // so a short margin suffices. Pixel diffs of these 8 captures ARE the
  // cycling gate.
  if (chart === "patternarea") {
    const PATTERN_PRESET_IDS = [
      "none",
      "diagonal",
      "horizontal",
      "vertical",
      "cross",
      "dots",
      "circles",
      "accent",
    ];
    for (const id of PATTERN_PRESET_IDS) {
      await page.evaluate((p) => window.__qaSetPatternPreset(p), id);
      await page.waitForTimeout(300);
      const buffer = await page.screenshot({ fullPage: false });
      hovers.push({
        fraction: `pattern-${id}`,
        x: 0,
        y: 0,
        tooltipVisible: true,
        tooltipCheckMethod: "pattern-preset-skip",
        buffer,
        label: `pattern-${id}`,
      });
    }
  }

  // BarSquares + BarColumnTrack (initiative 11): appended AFTER the
  // standard settled + 3-fraction hover sweep above -- that generic sweep
  // already covers the "bar-hover probe" (per-bar dim visible, both
  // BarSquares' per-index dim and BarColumnTrack's binary all-or-nothing
  // fade react to the same real pointer hover, §3.5). The NEW surface is
  // the legend-hover probe (BarSquares/BarColumnTrack both read
  // useChartLegendHover): index 0, index 1, then null (the restore path
  // must clear) -- mirrors the candlelegend/legendhover/markers
  // legend-hover sub-branches exactly.
  if (chart === "barsquares") {
    for (const idx of [0, 1, null]) {
      await page.evaluate((i) => window.__qaSetLegendHover(i), idx);
      await page.waitForTimeout(700);
      const buffer = await page.screenshot({ fullPage: false });
      hovers.push({
        fraction: idx === null ? "legend-clear" : `legend-${idx}`,
        x: 0,
        y: 0,
        tooltipVisible: true,
        tooltipCheckMethod: "legend-hover-skip",
        buffer,
        label: idx === null ? "legend-hover-clear" : `legend-hover-${idx}`,
      });
    }
    await page.evaluate(() => window.__qaSetLegendHover(null));
  }

  // BarDepth + BarPulse (initiative 11): appended AFTER the standard
  // settled + 3-fraction hover sweep above. BOTH scenario files
  // (bklit-bardepth.tsx, migrated-bardepth.tsx) mount with BarPulse
  // PAUSED by default specifically so the settled/hover-sweep captures
  // above stay deterministic (an unpaused continuous WAAPI/spring loop
  // would make them flake self-test) -- the settled capture already IS
  // the "pulse frozen at rest" state, no extra work needed for that half
  // of task deliverable 2c.
  if (chart === "bardepth") {
    // Explicit + defensive: keep the pulse paused for the deterministic
    // depth-toggle captures below regardless of scenario default.
    await page.evaluate(() => window.__qaSetBarPulsePaused(true));

    // (d) Depth on/off capture: window.__qaSetBarDepthEnabled conditionally
    // renders BarDepthBack/BarDepthFront/BarPulse (+ the base <Bar>'s
    // perspective/trim opt-in) together. On migrated-bardepth.tsx this is
    // currently a no-op against its TODO(reconcile-dispatch-C) fallback
    // tree (plain <Bar>, unaffected either way) until dispatch C lands.
    await page.evaluate(() => window.__qaSetBarDepthEnabled(false));
    await page.waitForTimeout(300);
    const depthOffBuffer = await page.screenshot({ fullPage: false });
    hovers.push({
      fraction: "depth-off",
      x: 0,
      y: 0,
      tooltipVisible: true,
      tooltipCheckMethod: "bar-depth-toggle-skip",
      buffer: depthOffBuffer,
      label: "depth-off",
    });
    await page.evaluate(() => window.__qaSetBarDepthEnabled(true));
    await page.waitForTimeout(300);
    const depthOnBuffer = await page.screenshot({ fullPage: false });
    hovers.push({
      fraction: "depth-on",
      x: 0,
      y: 0,
      tooltipVisible: true,
      tooltipCheckMethod: "bar-depth-toggle-skip",
      buffer: depthOnBuffer,
      label: "depth-on",
    });

    // (c) BarPulse phase-freeze: the requested contract
    // (window.__qaSetBarPulsePhase(t), t a fraction through the 2.4s
    // sweep) is NOT implemented on EITHER scenario side as of this
    // dispatch -- bklit's real BarPulse animates via a motion.rect
    // spring/WAAPI loop with no phase-seek entry point in its public
    // props (BarPulseProps only has dataKey/activeIndex/pulsePaused), and
    // dispatch C's internal/bar-pulse-mark.ts currently builds one static
    // silhouette frame with no time/phase parameter at all (no animation
    // loop yet). Called defensively -- if/when either side adds the hook,
    // this capture activates automatically with no qa/ edit required. See
    // final report: REQUIRED HOOK, not yet wired on either side.
    const hasPulsePhaseHook = await page.evaluate(
      () => typeof window.__qaSetBarPulsePhase === "function",
    );
    if (hasPulsePhaseHook) {
      for (const t of [0, 0.25, 0.5, 0.75]) {
        await page.evaluate((p) => window.__qaSetBarPulsePhase(p), t);
        await page.waitForTimeout(300);
        const buffer = await page.screenshot({ fullPage: false });
        hovers.push({
          fraction: `pulse-phase-${t}`,
          x: 0,
          y: 0,
          tooltipVisible: true,
          tooltipCheckMethod: "bar-pulse-phase-skip",
          buffer,
          label: `pulse-phase-${t}`,
        });
      }
    } else {
      console.log(
        `[qa] ${impl}/bardepth n=${n}: window.__qaSetBarPulsePhase not present -- skipping phase-freeze capture (required hook not yet wired, see final report)`,
      );
    }
  }

  await context.close();
  return { settled, hovers };
}

// ---------------------------------------------------------------------- //
// Run one comparison (real Q1 compare, or --self-test)
// ---------------------------------------------------------------------- //

async function runComparison(browser, baseUrl, { chart, n, implA, implB, selfTest, state }) {
  const gate = selfTest ? SELF_TEST_GATE : COMPARE_GATE;
  const loading = state === "loading";
  const mode = (selfTest ? "self-test" : "compare") + (loading ? "-loading" : "");

  const [capA, capB] = await Promise.all([
    captureLoad(browser, baseUrl, { impl: implA, chart, n, state }),
    captureLoad(browser, baseUrl, { impl: implB, chart, n, state }),
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

  // Settled state (or the single static loading frame in --state loading)
  {
    const stats = writeComparison(loading ? "loading" : "settled", capA.settled, capB.settled);
    comparisons.push({
      name: loading ? "loading" : "settled",
      diffPixels: stats.diffPixels,
      totalPixels: stats.totalPixels,
      diffRatio: stats.diffRatio,
      diffPercent: Number(stats.diffPercent.toFixed(4)),
      pass: stats.pass,
    });
  }

  // Hover states (none in loading mode: capA/capB.hovers are empty —
  // loading chrome has no tooltip contract)
  for (let i = 0; i < capA.hovers.length; i++) {
    const hA = capA.hovers[i];
    const hB = capB.hovers[i];
    const fraction = hA.fraction ?? HOVER_FRACTIONS[i];
    // Legend hovers carry their own label (hover-item-<idx>, an item index
    // set via __qaSetLegendHover rather than a width fraction).
    const label = hA.label ?? `hover-${Math.round(fraction * 100)}`;
    const stats = writeComparison(label, hA.buffer, hB.buffer);
    // marker-fan-open is self-test-gated only: bklit's frozen MarkerGroup has
    // no fan-forcing hook (see the disclosed asymmetry at the capture site),
    // so a cross-impl diff on this state measures a harness capability gap,
    // not chart fidelity. Record stats informationally, don't gate on them.
    const informational = !selfTest && label === "marker-fan-open";

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
      pass: informational ? true : stats.pass,
      ...(informational
        ? { informational: true, informationalReason: "cross-impl fan-open compare exempted (bklit lacks __qaSetMarkerFan; self-test gates this capture)" }
        : {}),
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
    state: loading ? "loading" : "ready",
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

// Stale-build guard (D214): the D5 gate run captured screenshots of a dist
// built BEFORE the source edits under test — a silently vacuous gate. Any
// source newer than dist/index.html forces a rebuild; runs before the
// already-running-server check because vite preview serves dist from disk,
// so a rebuild propagates to a reused server too.
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
  // QA_SKIP_REBUILD=1: the caller guarantees dist is fresh (e.g. one explicit
  // pre-build before launching a parallel wave) — skip the scan and the lock.
  if (process.env.QA_SKIP_REBUILD === "1") {
    console.log(`${tag} QA_SKIP_REBUILD=1 — skipping stale-build check`);
    return;
  }
  // Build lock: two concurrent stale-seeing processes would race `npm run
  // build` into the same dist/ (vite empties outDir at build start — silent
  // corruption of the other process's captures). mkdir is atomic: the winner
  // builds while others wait; a crashed builder's lock is taken over after
  // 120s. Mirrored in bench/run.mjs.
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
  await rebuildIfStale("[qa]");
  try {
    const res = await fetch(baseUrl);
    if (res.ok) {
      console.log(`[qa] reusing already-running server at ${baseUrl}`);
      return { stop: async () => {} };
    }
  } catch {
    // fall through and boot it
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
    else if (a === "--charts") args.charts = argv[++i].split(",").map((s) => s.trim()).filter(Boolean);
    else if (a === "--concurrency") args.concurrency = Number(argv[++i]);
    else if (a === "--base-url") args.baseUrl = argv[++i];
    else if (a === "--impl-a") args.implA = argv[++i];
    else if (a === "--impl-b") args.implB = argv[++i];
    else if (a === "--n") args.n = Number(argv[++i]);
    else if (a === "--state") args.state = argv[++i];
    else {
      console.error(`[qa] unrecognized argument: ${a}`);
      process.exit(1);
    }
  }
  return args;
}

function usage() {
  console.error(
    "Usage: node qa/screenshot.mjs --chart <line|area|bar|scatter> --impl-a <bklit|tanstack|migrated> --impl-b <bklit|tanstack|migrated> [--n 1000] [--state loading]\n" +
      "   or: node qa/screenshot.mjs --chart <name> --self-test [--impl-a <bklit|tanstack|migrated>] [--n 1000] [--state loading]\n" +
      "   or: node qa/screenshot.mjs --charts <a,b,c> [--concurrency 3] ...   (batch mode: shared n/impls, aggregate exit code)\n" +
      "Env/flags: QA_PORT=<port> overrides :5198; QA_SKIP_REBUILD=1 skips the stale-build check; --base-url <url> uses an external server",
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.chart && !args.charts) {
    usage();
    process.exit(1);
  }
  if (args.chart && args.charts) {
    console.error("[qa] pass either --chart or --charts, not both");
    process.exit(1);
  }

  const n = Number.isFinite(args.n) ? args.n : DEFAULT_N;
  let implA = args.implA ?? DEFAULT_IMPL_A;
  let implB = args.implB ?? DEFAULT_IMPL_B;
  if (args.state !== undefined && args.state !== "loading") {
    console.error(`[qa] --state only accepts "loading" (got ${JSON.stringify(args.state)}); omit it for the default ready-state compare`);
    process.exit(1);
  }

  if (args.selfTest) {
    if (args.implB && args.implA && args.implB !== args.implA) {
      console.warn(
        `[qa] --self-test compares a single impl against itself; ignoring --impl-b=${args.implB}, using --impl-a=${implA} for both loads`,
      );
    }
    implB = implA;
  }

  // --base-url mirrors bench/run.mjs: an explicit external server, still
  // subject to the stale-build guard inside ensureServer (vite preview
  // serves dist from disk, so a rebuild propagates to the reused server).
  const baseUrl = args.baseUrl || BASE_URL;
  const charts = args.charts ?? [args.chart];
  const limit = Math.max(1, Math.min(Number.isFinite(args.concurrency) ? args.concurrency : 1, charts.length));

  const server = await ensureServer(baseUrl);
  const browser = await chromium.launch({ headless: true });

  // Batch mode: each chart is an independent A/B pair with its own contexts;
  // failures are isolated per chart and aggregated into one exit code.
  const outcomes = [];
  try {
    for (let i = 0; i < charts.length; i += limit) {
      const batch = charts.slice(i, i + limit);
      const settled = await Promise.all(
        batch.map((chart) =>
          runComparison(browser, baseUrl, { chart, n, implA, implB, selfTest: args.selfTest, state: args.state })
            .then((outcome) => ({ chart, outcome }))
            .catch((error) => ({ chart, error })),
        ),
      );
      outcomes.push(...settled);
    }
  } finally {
    await browser.close();
    await server.stop();
  }

  let anyFail = false;
  for (const { chart, outcome, error } of outcomes) {
    if (error) {
      anyFail = true;
      console.error(`\n[qa] ${chart}: ERROR`, error);
      continue;
    }
    const { report, outDir } = outcome;
    const gatePct = (report.gate * 100).toFixed(1);
    console.log(`\n[qa] ${report.mode}: ${implA} vs ${implB} — ${chart} n=${n} (gate ${gatePct}%)`);
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
    if (!report.overallPass) anyFail = true;
  }

  if (charts.length > 1) {
    const passCount = outcomes.filter((o) => o.outcome?.report.overallPass).length;
    console.log(`\n[qa] batch: ${passCount}/${charts.length} charts PASS`);
  }
  process.exit(anyFail ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
