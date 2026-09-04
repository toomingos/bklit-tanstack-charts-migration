// Shared Playwright helpers for the gate probes. Settle = __benchSettled + __benchPaintDone + 3s more:
// bar hover stays dead until the chart's phase reaches "ready".
import { chromium } from "playwright";

export const VIEWPORT = { width: 1200, height: 800 };
export const POST_SETTLE_MS = 3000;

export function sceneUrl(baseUrl, { impl, chart, n, state, scenario }) {
  let u = `${baseUrl}/?impl=${impl}&chart=${chart}&n=${n}`;
  if (state) u += `&state=${state}`;
  if (scenario) u += `&scenario=${scenario}`;
  return u;
}

export async function launchBrowser() {
  return chromium.launch({ headless: true });
}

export async function openScene(browser, baseUrl, params, { settleMs = POST_SETTLE_MS } = {}) {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(sceneUrl(baseUrl, params), { waitUntil: "commit" });
  await page.waitForFunction(() => !!window.__benchSettled, { timeout: 30000 });
  await page.evaluate(() => window.__benchSettled);
  await page.waitForFunction(() => window.__benchPaintDone === true, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(settleMs);
  return { page, context, errors, close: () => context.close() };
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
