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
// D640: virtual ms allowed for `window.__benchSettled` to EXIST at all. Separate
// from settleCapMs above, which now starts counting once it does. This one is
// bounded by bundle load and first render; it is not sized from any animation.
export const ARM_CAP_MS = 20000;
export const QUIESCE_STEP_MS = 50;
// D617-a: was 10 (500 virtual ms total). Both bklit's shared enter transition
// (charts/animation.ts:6 DEFAULT_ANIMATION_DURATION_MS = 1100) and migrated's
// mirror (internal/animation-defaults.ts:3, same 1100) are tweens — bounded,
// deterministic completion times, not springs with an asymptotic tail — but
// 500 virtual ms cannot span even the shorter of the two (choropleth's own
// 800ms default, choropleth-chart.tsx:464). A scene whose reveal rides
// opacity (useTransform(mountProgress, ...), choropleth-feature.tsx:168) sits
// in the SAME dimmedCount() bucket (<0.99) for nearly the whole tween, so the
// old budget let quiescence exit on iteration 0-1, mid-mount. 100 iterations
// gives ~5x margin over the known 1100ms constant while staying wall-cheap
// (a scene that already found its stable count/signature on step 1 still
// exits on step 1 -- this only raises the ceiling for scenes that need it).
export const QUIESCE_MAX_ITERS = 100;

// Dim threshold: an element counts as dimmed when its dimmest channel drops below this.
export const DIM_THRESHOLD = 0.99;

const numOrOne = (v) => {
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 1;
};

// Alpha channel of a computed fill/stroke colour string. getComputedStyle
// resolves colours to rgb()/rgba() (comma or space-separated `rgb(r g b / a)`
// form, incl. color-mix() results which serialize with a `/ a` suffix); `none`,
// `transparent` and gradient url(...) refs carry no dim signal -> 1. `raw` is
// the element's attribute/inline hint: computed `transparent` resolves to
// rgba(0,0,0,0), so a transparent hint vetoes that resolved zero.
// Pure + exported for unit tests; the in-page copies in installSampler /
// dimmedCount mirror this exactly.
export function probeColorAlpha(color, raw = "") {
  const t = String(color ?? "").trim().toLowerCase();
  const hint = String(raw ?? "").toLowerCase();
  if (t === "" || t === "none" || t === "transparent" || t.startsWith("url(")) return 1;
  // Veto only a hint that IS the keyword. A substring test also matches
  // color-mix(in srgb, var(--chart-1) 40%, transparent), which is how a dim is
  // written -- vetoing the very thing this predicate exists to detect (D616).
  if (hint.trim() === "transparent") return 1;
  const slash = t.match(/\/\s*([\d.]+%?)\s*\)?\s*$/);
  if (slash) {
    const v = slash[1].endsWith("%") ? parseFloat(slash[1]) / 100 : parseFloat(slash[1]);
    return Number.isFinite(v) ? v : 1;
  }
  const m = t.match(/^rgba?\(([^)]*)\)$/);
  if (m) {
    const parts = m[1].split(",").map((s) => s.trim());
    if (parts.length === 4) {
      const a = parts[3].endsWith("%") ? parseFloat(parts[3]) / 100 : parseFloat(parts[3]);
      return Number.isFinite(a) ? a : 1;
    }
    return 1;
  }
  return 1;
}

// Dimmed when ANY channel (opacity, fill-opacity, stroke-opacity, fill alpha,
// stroke alpha) drops below threshold — combined by MIN, not product.
// Only `opacity` composes down the ancestor chain (multiplicatively); the
// fill/stroke channels stay per-element. Ancestor opacities ride on
// `ancestorOpacities` (outermost order irrelevant — it is a product); the
// default [] preserves the legacy own-value-only behaviour.
export function probeEffectiveOpacity(ownOpacity, ancestorOpacities = []) {
  let eff = numOrOne(ownOpacity);
  for (const a of ancestorOpacities ?? []) eff *= numOrOne(a);
  return eff;
}
export function probeIsDimmed({ opacity, fillOpacity, strokeOpacity, fill, stroke, rawFill, rawStroke, ancestorOpacities = [] } = {}) {
  const chans = [probeEffectiveOpacity(opacity, ancestorOpacities), numOrOne(fillOpacity), numOrOne(strokeOpacity), probeColorAlpha(fill, rawFill), probeColorAlpha(stroke, rawStroke)];
  return Math.min(...chans) < DIM_THRESHOLD;
}

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
  // from the first timer. D617-a follow-up: this ordering itself is not the
  // defect -- Playwright's own docs (playwright.dev/docs/clock, "Initialize
  // Clock and Pause at Specific Time") show `install()` then `goto()` as the
  // recommended pattern, and `install()` fakes `requestAnimationFrame`
  // (playwright.dev/docs/api/class-clock), which is exactly what motion's
  // `animate()` frameloop needs to advance under `runFor`. What was actually
  // sampling scenes mid-mount was the post-settle quiescence check below,
  // not this install/goto order -- see the D617-a note there.
  // B5: __benchSettled IS the "phase reached ready"
  // signal the old 3s sleep was waiting for — armBklitSettle resolves on the
  // non-ready->ready transition, and the orchestrator flips isLoaded +
  // plotData=target in that same setTimeout tick — so settled + paintDone +
  // stable frames is a strictly stronger condition than settled + blind 3s.
  await page.clock.install();
  await page.goto(sceneUrl(baseUrl, params), { waitUntil: "commit" });
  // Pump virtual time until the scenario's own settle signal fires. Poll via
  // evaluate (real time) — never waitForFunction's default rAF poll or
  // waitForTimeout here: page rAF/timers only advance via runFor below.
  // D640: the cap bounds the SCENE's settle, so it must be spent from the moment
  // the scene arms -- not from `goto`. `waitUntil: "commit"` returns before the
  // bundle has loaded, and every iteration before React mounts advances the page
  // clock by 100 virtual ms, so pre-arm load time came out of the same budget the
  // reveal needs. pie/1000 arms `armManualSettle(84370)` (bklit-pie.tsx:16-33)
  // against a 90000 cap: 5630 ms of slack, 56 iterations. Under `--repeats 5` the
  // load takes more than 56 evaluate round-trips and the scene is aborted for
  // being slow to load, reported as `never settled`. Splitting the two budgets
  // makes "the page never armed" and "the scene never settled" different
  // failures with different messages, which is D636's lesson in a second place.
  let waited = 0;
  let armedAtMs = null;
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
    if (last?.armed && armedAtMs === null) armedAtMs = waited;
    if (last && last.armed && last.settled && last.paint) break;
    waited += 100;
    if (armedAtMs === null && waited > ARM_CAP_MS) {
      await context.close().catch(() => {});
      throw new Error(`openScene ${sceneUrl(baseUrl, params)} never armed after ${ARM_CAP_MS} virtual ms (window.__benchSettled absent -- the scene module never ran, not a settle failure)`);
    }
    if (armedAtMs !== null && waited - armedAtMs > settleCapMs) {
      await context.close().catch(() => {});
      throw new Error(`openScene ${sceneUrl(baseUrl, params)} never settled after ${settleCapMs} virtual ms post-arm (armed at ${armedAtMs} ms, settled=${last?.settled} paint=${last?.paint})`);
    }
    await stepVirtual(page, 100);
  }
  // Post-settle quiescence: two stable reads across a virtual step.
  // Replaces the old POST_SETTLE_MS=3000 blind sleep (~98 scenes, ~5 min).
  // D617-a: stability on `dimmed` (a count of elements past the 0.99
  // threshold) alone is blind to a continuous sub-threshold ramp -- a
  // group opacity tweening 0 -> 0.85 keeps every element in the SAME
  // "dimmed" bucket for the whole transition, so `dimmed` never changes and
  // the loop broke on iteration 0 while the mount was still running
  // (choropleth composed opacity read 0.0046, reported settled). `sig`
  // sums each scoped element's own min(channel) -- the exact continuous
  // quantity `dimmed` was thresholding -- so it moves on every frame an
  // opacity/alpha channel is still animating, dimmed or not, and can only
  // read equal across a step when nothing tracked actually changed.
  // D636: quiesceIters is returned so callers can RECORD how much virtual time
  // a scene actually needed. Requiring `sig` stability strictly increases the
  // steps taken, and QUIESCE_MAX_ITERS is that requirement's consequence, not an
  // independent knob -- the loop still breaks on the first stable pair. Without
  // this number, "the scene settled" and "the loop ran to the cap" are
  // indistinguishable in every artefact the probes produce.
  let prev = await dimmedCount(page);
  let quiesceIters = 0;
  for (let i = 0; i < QUIESCE_MAX_ITERS; i++) {
    await stepVirtual(page, QUIESCE_STEP_MS);
    quiesceIters = i + 1;
    const cur = await dimmedCount(page);
    if (cur.dimmed === prev.dimmed && cur.sig === prev.sig) break;
    prev = cur;
    if (i === QUIESCE_MAX_ITERS - 1) {
      await context.close().catch(() => {});
      throw new Error(`openScene ${sceneUrl(baseUrl, params)} never quiesced (dimmed ${prev.dimmed} -> ${cur.dimmed}, sig ${prev.sig} -> ${cur.sig})`);
    }
  }
  return { page, context, errors, quiesceIters, armedAtMs, close: () => context.close() };
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
    const root = document.getElementById("chart-root") ?? document.body;
    const baseText = (root.textContent ?? "").length;
    // In-page mirror of probeColorAlpha/probeIsDimmed (module scope is not
    // visible inside evaluate); keep the threshold and channel logic in sync.
    const colorAlpha = (color, raw) => {
      const t = String(color ?? "").trim().toLowerCase();
      if (t === "" || t === "none" || t === "transparent" || t.startsWith("url(")) return 1;
      // Exact keyword only; see probeColorAlpha (D616).
      if (String(raw ?? "").trim().toLowerCase() === "transparent") return 1;
      const slash = t.match(/\/\s*([\d.]+%?)\s*\)?\s*$/);
      if (slash) {
        const v = slash[1].endsWith("%") ? parseFloat(slash[1]) / 100 : parseFloat(slash[1]);
        return Number.isFinite(v) ? v : 1;
      }
      const m = t.match(/^rgba?\(([^)]*)\)$/);
      if (m) {
        const parts = m[1].split(",").map((s) => s.trim());
        if (parts.length === 4) {
          const a = parts[3].endsWith("%") ? parseFloat(parts[3]) / 100 : parseFloat(parts[3]);
          return Number.isFinite(a) ? a : 1;
        }
        return 1;
      }
      return 1;
    };
    const isDimmedEl = (el) => {
      const st = getComputedStyle(el);
      const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 1; };
      // Ancestor-composed opacity: walk up multiplying each ancestor's OWN
      // opacity (computed opacity is the specified value, not the visual
      // product), stopping at the svg / chart root. Robust to "" (num->1).
      let eff = 1;
      for (let node = el; node && node !== document.documentElement; node = node.parentElement) {
        try { eff *= num(getComputedStyle(node).opacity); } catch { /* treat as 1 */ }
        const tag = node.tagName ? node.tagName.toLowerCase() : "";
        if (tag === "svg" || node.id === "chart-root") break;
      }
      const chans = [eff, num(st.getPropertyValue("fill-opacity")), num(st.getPropertyValue("stroke-opacity"))];
      // Per-channel hints: a combined string let stroke's keyword veto fill's
      // alpha, which probeIsDimmed never did (it takes rawFill/rawStroke).
      const rawFill = (el.getAttribute("fill") ?? "").toLowerCase();
      const rawStroke = (el.getAttribute("stroke") ?? "").toLowerCase();
      chans.push(colorAlpha(st.fill, rawFill), colorAlpha(st.stroke, rawStroke));
      return Math.min(...chans) < 0.99;
    };
    const dimCount = () => {
      // Union scope: every svg >100px in EITHER dimension plus the chart root's
      // own descendants (overlay svgs, HTML div chrome), each element once.
      const root = document.getElementById("chart-root") ?? document.body;
      const scopes = [...document.querySelectorAll("svg")].filter((s) => {
        const r = s.getBoundingClientRect();
        return r.width > 100 || r.height > 100;
      });
      scopes.push(root);
      const seen = new Set();
      const els = [];
      for (const scope of scopes) for (const el of scope.querySelectorAll("rect,path,circle,g,li,div,span")) if (!seen.has(el)) { seen.add(el); els.push(el); }
      let n = 0;
      for (const el of els) if (isDimmedEl(el)) n++;
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
    // Union scope (mirror of installSampler above): every svg >100px in either
    // dimension plus the chart root's descendants, each element counted once.
    const root = document.getElementById("chart-root") ?? document.body;
    const scopes = [...document.querySelectorAll("svg")].filter((s) => {
      const r = s.getBoundingClientRect();
      return r.width > 100 || r.height > 100;
    });
    scopes.push(root);
    const seen = new Set();
    const els = [];
    for (const scope of scopes) for (const el of scope.querySelectorAll("rect,path,circle,g,li,div,span")) if (!seen.has(el)) { seen.add(el); els.push(el); }
    // In-page mirror of probeColorAlpha/probeIsDimmed; keep in sync.
    const colorAlpha = (color, raw) => {
      const t = String(color ?? "").trim().toLowerCase();
      if (t === "" || t === "none" || t === "transparent" || t.startsWith("url(")) return 1;
      // Exact keyword only; see probeColorAlpha (D616).
      if (String(raw ?? "").trim().toLowerCase() === "transparent") return 1;
      const slash = t.match(/\/\s*([\d.]+%?)\s*\)?\s*$/);
      if (slash) {
        const v = slash[1].endsWith("%") ? parseFloat(slash[1]) / 100 : parseFloat(slash[1]);
        return Number.isFinite(v) ? v : 1;
      }
      const m = t.match(/^rgba?\(([^)]*)\)$/);
      if (m) {
        const parts = m[1].split(",").map((s) => s.trim());
        if (parts.length === 4) {
          const a = parts[3].endsWith("%") ? parseFloat(parts[3]) / 100 : parseFloat(parts[3]);
          return Number.isFinite(a) ? a : 1;
        }
        return 1;
      }
      return 1;
    };
    let n = 0;
    // D617-a: `dimmed` alone is a bucketed count (each element is either
    // above or below DIM_THRESHOLD) and cannot see a continuous ramp that
    // stays on one side of 0.99 for its whole duration -- exactly what a
    // framer-motion mount opacity tween does almost everywhere except its
    // final moment. `sig` sums the same per-element min(channel) the
    // threshold is applied to, so it is a continuous quantity: equal across
    // a virtual step only when nothing tracked (opacity/fill-opacity/
    // stroke-opacity/fill+stroke alpha, any ancestor) actually changed.
    // openScene's quiescence loop requires both to be stable.
    let sig = 0;
    for (const el of els) {
      const st = getComputedStyle(el);
      const num = (v) => { const n2 = parseFloat(v); return Number.isFinite(n2) ? n2 : 1; };
      // Ancestor-composed opacity (mirror of installSampler above): only the
      // opacity channel composes; fill/stroke channels stay per-element.
      let eff = 1;
      for (let node = el; node && node !== document.documentElement; node = node.parentElement) {
        try { eff *= num(getComputedStyle(node).opacity); } catch { /* treat as 1 */ }
        const tag = node.tagName ? node.tagName.toLowerCase() : "";
        if (tag === "svg" || node.id === "chart-root") break;
      }
      // Per-channel hints; a combined string let one channel's keyword veto the other (D616).
      const rawFill = (el.getAttribute("fill") ?? "").toLowerCase();
      const rawStroke = (el.getAttribute("stroke") ?? "").toLowerCase();
      const chans = [eff, num(st.getPropertyValue("fill-opacity")), num(st.getPropertyValue("stroke-opacity")), colorAlpha(st.fill, rawFill), colorAlpha(st.stroke, rawStroke)];
      const dimmest = Math.min(...chans);
      sig += dimmest;
      if (dimmest < 0.99) n++;
    }
    return { dimmed: n, total: els.length, sig };
  });
}

export const median = (xs) => {
  const a = xs.filter((x) => x != null).sort((x, y) => x - y);
  if (!a.length) return null;
  return a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2;
};
