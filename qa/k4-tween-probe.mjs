// P5.5 K4 gate — candlestick `enterTransition: { type: "tween" }`.
//
// WHY THIS EXISTS INSTEAD OF A PIXEL DIFF
// --------------------------------------
// P5-05's gate section asks for a *visual* confirmation that the tween
// "samples visibly match legacy's framer-driven keyframe tween, not just that
// it typechecks". `qa/screenshot.mjs` structurally cannot deliver that here,
// for two stacked reasons found by trying it:
//
//   1. The only capture point is ~1300ms after mount (`__benchSettled` +
//      200ms). bklit's `candlestick.tsx` swaps from the animated branch to the
//      fully-resolved static branch the instant `isLoaded` flips, and that
//      flip is driven by `animationDuration` (default 1100ms) — NOT by the
//      transition's own duration. So at the default the reveal is always over
//      before the shutter: a 3s tween under a 1100ms `animationDuration` gave
//      a diff byte-identical to the plain `candlestick` scenario (all four
//      metrics equal to 4dp — the instrument was measuring nothing).
//
//   2. Stretching `animationDuration` to 1800ms DOES land the capture
//      mid-reveal (settled moved 0.0354% -> 1.2996%), but that comparison is
//      confounded: bklit drives the reveal through framer-motion's own rAF
//      scheduler and migrated through WAAPI, and the two do not share a start
//      instant relative to `__benchSettled`. The diff then measures scheduler
//      skew, not curve fidelity. The harness itself is NOT the noise source —
//      self-test controls on the same scenario read 0.0004% (bklit vs bklit)
//      and 0.0000% (migrated vs migrated).
//
// So the K4 evidence is a direct readback of the animation actually running,
// checked against the analytic curve. Parity of the DEFAULT (spring) reveal is
// gated separately and normally, by `--chart candlestick --n 100`.
//
// Usage (bench preview must be serving; `vite preview --port 5198` from
// `bench/app`, or set QA_PORT):
//   node qa/k4-tween-probe.mjs
//
// Expected on `migrated`: ~200 running animations, each duration 1800, easing
// `cubic-bezier(0.85, 0, 0.15, 1)`, 64 keyframes (the shared engine's
// TWEEN_SAMPLES), delays stepping by animationDuration*0.6/n = 10.8ms. Before
// K4 the same call produced a 60-sample spring at `easing: "linear"` — the
// coercion the charter calls a real regression. Expected on `bklit`: zero
// animations, because framer-motion is not WAAPI and getAnimations() cannot
// see it; that asymmetry is exactly why a pixel diff was attempted first.
import { chromium } from "playwright";

const PORT = process.env.QA_PORT ?? 5198;
const base = `http://localhost:${PORT}`;
const n = 100;

const probe = async (browser, impl) => {
  const ctx = await browser.newContext({
    viewport: { width: 1200, height: 800 },
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  await page.goto(`${base}/?impl=${impl}&chart=candletween&n=${n}`, {
    waitUntil: "commit",
  });
  await page.waitForFunction(() => window.__benchPaintDone === true, { timeout: 30000 });
  await page.evaluate(() => window.__benchSettled);
  await page.waitForTimeout(200);
  const out = await page.evaluate(() => {
    const rects = Array.from(document.querySelectorAll("svg rect"));
    const pick = (r) => ({
      key: r.getAttribute("data-ts-key"),
      x: r.getAttribute("x"),
      y: r.getAttribute("y"),
      w: r.getAttribute("width"),
      h: r.getAttribute("height"),
      transform: getComputedStyle(r).transform,
      opacity: getComputedStyle(r).opacity,
    });
    const all = document.getAnimations?.() ?? [];
    const anims = all.slice(0, 3).map((a) => ({
      duration: a.effect?.getTiming?.().duration,
      easing: a.effect?.getTiming?.().easing,
      delay: a.effect?.getTiming?.().delay,
      frames: a.effect?.getKeyframes?.().length,
      state: a.playState,
    }));
    return {
      rectCount: rects.length,
      first: rects.length ? pick(rects[0]) : null,
      mid: rects.length ? pick(rects[Math.floor(rects.length / 2)]) : null,
      anims,
      animCount: all.length,
    };
  });
  await ctx.close();
  return out;
};

const browser = await chromium.launch();
for (const impl of ["bklit", "migrated"]) {
  const r = await probe(browser, impl);
  console.log(impl, JSON.stringify(r, null, 1));
}
await browser.close();
