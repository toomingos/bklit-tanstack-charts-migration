// K4 gate: pixel diff can't see the tween (capture lands post-reveal; mid-reveal diffs measure scheduler skew, not curve fidelity).
// V4.3 demoted this probe to smoke: presence/no-throw only (paint + settled +
// non-empty scene for both impls). Curve fidelity moved to qa/curve-parity.mjs.
// Full WAAPI readback remains behind --full for manual debugging.
// Usage: node qa/k4-tween-probe.mjs [--full] (bench preview serving on :5198 or QA_PORT).
import { chromium } from "playwright";

const PORT = process.env.QA_PORT ?? 5198;
const SMOKE = !process.argv.includes("--full");
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
  if (SMOKE) {
    const ok = r.rectCount > 0;
    console.log(impl, ok ? "smoke PASS" : "smoke FAIL", `rects=${r.rectCount}`);
    if (!ok) process.exitCode = 1;
  } else {
    console.log(impl, JSON.stringify(r, null, 1));
  }
}
await browser.close();
