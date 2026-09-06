// Shared Playwright helpers for the gate probes.
//
// Virtual-time protocol (B4): every scene installs Playwright's fake clock
// (page.clock.install()) BEFORE goto, so Date/setTimeout/setInterval/
// requestAnimationFrame/performance all run on virtual milliseconds advanced
// only by stepVirtual(). Probe timings are therefore animation-design time,
// not machine time, which is what makes parallel workers safe: a scene on a
// slow core reports the same numbers as one on a fast core.
//
// Real limit, established from source (not assumed): the fake clock governs
// JS-driven animation but NOT CSS transitions/WAAPI players (not in the
// Clock.fakes list — verified against playwright-core@1.62.1 types). bklit's
// motion opacity tweens on SVG marks take motion's JS frameloop path
// (motion v12 supportsBrowserAnimation requires `subject instanceof
// HTMLElement`, so SVG <g>/<rect>/<path> never go WAAPI), but CSS
// `transition: opacity ...` rules (series-markers.tsx:249, tooltip-content,
// migrated marker-group-styles) and WAAPI players (HTML tooltip divs) need
// the getAnimations() lockstep in stepVirtual(): pause + advance currentTime
// by the same virtual ms. Residual wall leak is bounded by one pump step's
// evaluate latency (ms, vs 200-400ms flag bands) — see stepVirtual.
// Per-probe driver verdicts live in each probe file's header.
import { chromium } from "playwright";

export const VIEWPORT = { width: 1200, height: 800 };

// M1 has 4 performance cores; one hosts the vite preview + browser main +
// OS, leaving 3 workers whose scenes each get ~one P-core. Width sets
// throughput only — with virtual time, numbers are core-independent.
export const PROBE_WIDTH = 3;

// Virtual-ms caps (wall-cheap: caps only bind when something is genuinely
// broken, since virtual ms advance as fast as the page's JS runs).
export const VIRTUAL_SETTLE_CAP_MS = 20000;
// Per-chart override for manual-reveal scenes whose OWN settle timer exceeds
// the default cap. These charts have no onPhaseChange, so bench arms a manual
// timer sized from the source stagger: bklit-pie.tsx:16-22 gives
// pieSettleMs(1000) = 100 + 999*80 + 1100 = 81120, +250 reveal margin = 81370,
// and armManualSettle(settleMs + 3000) = 84370 (settle.ts:150-161 takes the
// caller's fallback, NOT the 2500ms FALLBACK_MS the cartesian arms use). At
// cap 20000 neither the real timer nor its fallback can fire, so the scene
// reported `armed=true settled=false paint=true` and hover-lag produced zero
// rows. Shortening the reveal instead would hover mid-stagger = dishonest.
// Virtual ms are wall-cheap, so a wide cap costs pump iterations, not seconds.
export const SETTLE_CAP_OVERRIDE = { pie: 90000, radar: 90000, sunburst: 90000 };
export const QUIESCE_STEP_MS = 50;
export const QUIESCE_MAX_ITERS = 10;

export function sceneUrl(baseUrl, { impl, chart, n, state, scenario }) {
  let u = `${baseUrl}/?impl=${impl}&chart=${chart}&n=${n}`;
  if (state) u += `&state=${state}`;
  if (scenario) u += `&scenario=${scenario}`;
  return u;
}

export async function launchBrowser() {
  return chromium.launch({ headless: true });
}

export async function openScene(browser, baseUrl, params, { settleCapMs = SETTLE_CAP_OVERRIDE[params.chart] ?? VIRTUAL_SETTLE_CAP_MS } = {}) {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  // Install BEFORE goto (documented pattern) so the mount reveal
  // (setTimeout animationDuration, double-rAF paint/settle arms) is virtual
  // from the first timer. B5: __benchSettled IS the "phase reached ready"
  // signal the old 3s sleep was waiting for — armBklitSettle resolves on the
  // non-ready->ready transition, and the orchestrator flips isLoaded +
  // plotData=target in that same setTimeout tick — so settled + paintDone +
  // stable frames is a strictly stronger condition than settled + blind 3s.
  await page.clock.install();
  await page.goto(sceneUrl(baseUrl, params), { waitUntil: "commit" });
  // Pump virtual time until the scenario's own settle signal fires. Poll via
  // evaluate (real time) — never waitForFunction's default rAF poll or
  // waitForTimeout here: page rAF/timers only advance via runFor below.
  let waited = 0;
  let last = null;
  for (;;) {
    last = await page.evaluate(() => {
      if (!window.__gateArmed && window.__benchSettled) {
        window.__gateArmed = true;
        window.__gateSettledFlag = false;
        window.__benchSettled.then(() => { window.__gateSettledFlag = true; }, () => { window.__gateSettledFlag = true; });
      }
      return { armed: !!window.__gateArmed, settled: !!window.__gateSettledFlag, paint: window.__benchPaintDone === true };
    }).catch(() => null);
    if (last && last.armed && last.settled && last.paint) break;
    waited += 100;
    if (waited > settleCapMs) {
      await context.close().catch(() => {});
      throw new Error(`openScene ${sceneUrl(baseUrl, params)} never settled after ${settleCapMs} virtual ms (armed=${last?.armed} settled=${last?.settled} paint=${last?.paint})`);
    }
    await stepVirtual(page, 100);
  }
  // Post-settle quiescence: two stable dimmed reads across a virtual step.
  // Replaces the old POST_SETTLE_MS=3000 blind sleep (~98 scenes, ~5 min).
  let prev = await dimmedCount(page);
  for (let i = 0; i < QUIESCE_MAX_ITERS; i++) {
    await stepVirtual(page, QUIESCE_STEP_MS);
    const cur = await dimmedCount(page);
    if (cur.dimmed === prev.dimmed) break;
    prev = cur;
    if (i === QUIESCE_MAX_ITERS - 1) {
      await context.close().catch(() => {});
      throw new Error(`openScene ${sceneUrl(baseUrl, params)} never quiesced (dimmed ${prev.dimmed} -> ${cur.dimmed})`);
    }
  }
  return { page, context, errors, close: () => context.close() };
}

// Advance virtual time by exactly ms for BOTH animation drivers: fake-clock
// JS (timers, rAF frameloop incl. motion-on-SVG, performance.now) via
// clock.runFor, and CSS transitions / WAAPI players via getAnimations()
// pause + currentTime step. Fresh animations are paused on first sight, so
// the only wall leak is the real ms between an animation's start and the
// next sweep (one pump step's evaluate latency) — ms-scale against
// 200-400ms flag bands, and common to both impls being compared.
export async function stepVirtual(page, ms) {
  await page.clock.runFor(ms);
  await page.evaluate((ms) => {
    for (const a of document.getAnimations()) {
      try {
        if (a.playState === "finished") continue;
        if (a.playState !== "paused") a.pause();
        const t = a.currentTime;
        if (typeof t === "number") a.currentTime = t + ms;
      } catch { /* ignore unsettable players */ }
    }
  }, ms);
}

/** Largest <svg> wider than 100px (harness convention). */
export async function largestSvgBox(page) {
  return page.evaluate(() => {
    let best = null;
    for (const svg of document.querySelectorAll("svg")) {
      const r = svg.getBoundingClientRect();
      if (r.width > 100 && (!best || r.width * r.height > best.w * best.h)) best = { x: r.left, y: r.top, w: r.width, h: r.height };
    }
    return best;
  });
}

// GUARD: in-page sampler records dimmed marks (opacity < 0.99), tooltip visibility (.ts-chart-tooltip or
// #chart-root text-length heuristic), and last-change time from the first pointermove. Read back with readSampler().
export async function installSampler(page, { maxMs = 2000 } = {}) {
  await page.evaluate((maxMs) => {
    const svgs = [...document.querySelectorAll("svg")].filter((s) => s.getBoundingClientRect().width > 100);
    const svg = svgs.sort((a, b) => b.getBoundingClientRect().width * b.getBoundingClientRect().height - a.getBoundingClientRect().width * a.getBoundingClientRect().height)[0] ?? document.body;
    const root = document.getElementById("chart-root") ?? document.body;
    const baseText = (root.textContent ?? "").length;
    const dimCount = () => {
      let n = 0;
      for (const el of svg.querySelectorAll("rect,path,circle,g")) {
        const o = parseFloat(getComputedStyle(el).opacity);
        if (o < 0.99) n++;
      }
      return n;
    };
    const tipVisible = () => {
      const el = document.querySelector(".ts-chart-tooltip");
      if (el) {
        const r = el.getBoundingClientRect();
        const st = getComputedStyle(el);
        return !el.hidden && st.display !== "none" && st.visibility !== "hidden" && r.width > 0 && r.height > 0;
      }
      return (root.textContent ?? "").length - baseText >= 3;
    };
    const S = (window.__gateSampler = { t0: null, baseDim: dimCount(), samples: [], firstDim: null, firstTip: null, lastChange: null, done: false });
    let prev = null;
    const tick = () => {
      if (S.t0 == null) {
        requestAnimationFrame(tick);
        return;
      }
      const t = performance.now() - S.t0;
      const dim = dimCount();
      const tip = tipVisible();
      if (S.firstDim == null && dim > S.baseDim) S.firstDim = t;
      if (S.firstTip == null && tip) S.firstTip = t;
      if (prev && (prev.dim !== dim || prev.tip !== tip)) S.lastChange = t;
      if (!prev) S.lastChange = 0;
      prev = { dim, tip };
      if (S.samples.length < 400) S.samples.push([Math.round(t), dim, tip ? 1 : 0]);
      if (t < maxMs) requestAnimationFrame(tick);
      else S.done = true;
    };
    window.addEventListener("pointermove", () => { if (S.t0 == null) S.t0 = performance.now(); }, { once: true, capture: true });
    requestAnimationFrame(tick);
  }, maxMs);
}

export async function readSampler(page) {
  return page.evaluate(() => {
    const S = window.__gateSampler;
    if (!S) return null;
    const last = S.samples[S.samples.length - 1];
    return { baseDim: S.baseDim, firstDimMs: S.firstDim == null ? null : Math.round(S.firstDim), firstTooltipMs: S.firstTip == null ? null : Math.round(S.firstTip), lastChangeMs: S.lastChange == null ? null : Math.round(S.lastChange), finalDim: last ? last[1] : null, finalTooltip: last ? !!last[2] : null, frames: S.samples.length, started: S.t0 != null };
  });
}

export async function sampleMarks(page, { selector = "rect,path,circle", limit = 24 } = {}) {
  return page.evaluate(({ selector, limit }) => {
    const svgs = [...document.querySelectorAll("svg")].filter((s) => s.getBoundingClientRect().width > 100);
    const svg = svgs[0] ?? document.body;
    const out = [];
    for (const el of svg.querySelectorAll(selector)) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      out.push({ tag: el.tagName, key: el.getAttribute("data-ts-key") ?? el.getAttribute("data-key") ?? null, x: Math.round(r.left * 10) / 10, y: Math.round(r.top * 10) / 10, w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10, opacity: Number(parseFloat(getComputedStyle(el).opacity).toFixed(3)) });
      if (out.length >= limit) break;
    }
    return { count: svg.querySelectorAll(selector).length, marks: out };
  }, { selector, limit });
}

export function diffMarks(a, b) {
  const n = Math.min(a.marks.length, b.marks.length);
  let moved = 0;
  let opacityChanged = 0;
  let maxDh = 0;
  for (let i = 0; i < n; i++) {
    const p = a.marks[i];
    const q = b.marks[i];
    const dh = Math.abs(p.h - q.h) + Math.abs(p.y - q.y) + Math.abs(p.w - q.w) + Math.abs(p.x - q.x);
    if (dh > 1) moved++;
    maxDh = Math.max(maxDh, dh);
    if (Math.abs(p.opacity - q.opacity) > 0.02) opacityChanged++;
  }
  return { compared: n, moved, opacityChanged, maxDelta: Number(maxDh.toFixed(1)), countA: a.count, countB: b.count };
}

export async function dimmedCount(page) {
  return page.evaluate(() => {
    const svgs = [...document.querySelectorAll("svg")].filter((s) => s.getBoundingClientRect().width > 100);
    const scope = svgs[0] ?? document.body;
    let n = 0;
    let total = 0;
    for (const el of scope.querySelectorAll("rect,path,circle,g,li,div,span")) {
      total++;
      if (parseFloat(getComputedStyle(el).opacity) < 0.99) n++;
    }
    return { dimmed: n, total };
  });
}

export const median = (xs) => {
  const a = xs.filter((x) => x != null).sort((x, y) => x - y);
  if (!a.length) return null;
  return a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2;
};
