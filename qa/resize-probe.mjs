// Sankey resize probe (showcase :5200): mounts both charts, resizes the window, re-measures layout.
// Ratio (stroke-width sum / rect-height sum) is scale-invariant on recompute; drifts when a stale scene is merely viewBox-rescaled.
import { chromium } from "playwright";

const URL_ = "http://localhost:5200/charts/sankey";
const WIDTHS = [1000, 1500, 800];

const measure = (label) => {
  const wrap = [...document.querySelectorAll("div")].filter(
    (e) => (e.textContent || "").trim().startsWith(label) && e.className.includes("w-full"),
  )[0];
  if (!wrap) return null;
  const svg = wrap.querySelector("svg");
  if (!svg) return null;
  const r = svg.getBoundingClientRect();
  const paths = [...svg.querySelectorAll("path")].filter((p) => {
    const cs = getComputedStyle(p);
    return cs.fill === "none" && parseFloat(cs.strokeWidth) > 0;
  });
  const rects = [...svg.querySelectorAll("rect")];
  if (!paths.length || !rects.length) return null;
  const sw = paths.map((p) => parseFloat(getComputedStyle(p).strokeWidth));
  const rectH = rects.map((x) => parseFloat(x.getAttribute("height")));
  const swSum = sw.reduce((a, b) => a + b, 0);
  const hSum = rectH.reduce((a, b) => a + b, 0);
  return {
    vb: svg.getAttribute("viewBox"),
    cw: +r.width.toFixed(1),
    ch: +r.height.toFixed(1),
    swSum: +swSum.toFixed(1),
    swMax: +Math.max(...sw).toFixed(2),
    rectXs: [...new Set(rects.map((x) => Math.round(parseFloat(x.getAttribute("x")))))],
    rectHSum: +hSum.toFixed(1),
    ratio: +(swSum / hSum).toFixed(4),
  };
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: WIDTHS[0], height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
await page.goto(URL_, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2000);
await page.evaluate(() => window.scrollTo(0, 400));
await page.waitForTimeout(2500);

for (const w of WIDTHS) {
  await page.setViewportSize({ width: w, height: 900 });
  await page.waitForTimeout(1200);
  for (const label of ["bklit-ui original", "migrated"]) {
    const r = await page.evaluate(measure, label);
    if (!r) {
      console.log(`vpW=${w} ${label.padEnd(18)} -> not mounted`);
      continue;
    }
    console.log(
      `vpW=${String(w).padEnd(5)} ${label.padEnd(18)} svg=${String(r.cw).padStart(6)}x${String(r.ch).padEnd(6)} viewBox=${String(r.vb).padEnd(20)} nodeXs=[${r.rectXs.join(",")}] rectHsum=${String(r.rectHSum).padStart(7)} swSum=${String(r.swSum).padStart(7)} swMax=${String(r.swMax).padStart(6)} sw/h=${r.ratio}`,
    );
  }
  console.log("");
}
await browser.close();
