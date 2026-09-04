// K4 gate: pixel diff can't see the tween (capture lands post-reveal; mid-reveal diffs measure scheduler skew, not curve fidelity).
// Direct WAAPI readback vs the analytic curve instead; default spring reveal is gated separately via --chart candlestick.
// PASS: ~200 anims, dur 1800, cubic-bezier(0.85,0,0.15,1), 64 frames, 10.8ms delay steps; bklit reads 0 (framer-motion invisible to WAAPI).
// Usage: node qa/k4-tween-probe.mjs (bench preview serving on :5198 or QA_PORT).
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
