// Probe: "no re-reveal on prop toggle". After settle, flip a prop through the
// scenario's QA hook and sample bar/mark heights + opacities at +100, +400 and
// +900 ms. A mount-style reveal replaying on a prop change shows as marks whose
// height/y or opacity still move between +100 and +900 ms (bars growing from
// the baseline, marks fading in). Toggles exercised:
//   bardepth/100   __qaSetBarDepthEnabled(true)   (depth off -> on)
//   patternarea/1000 __qaSetPatternPreset("dots")  (pattern swap)
//   brush/1000     __qaSetBrush(0.25, 0.75)        (domain change)
//   legendhover/1000 __qaSetLegendHover(0)         (legend dim)
import { diffMarks, openScene, sampleMarks } from "./lib-probe.mjs";

export const DEFAULT_TOGGLES = [
  { chart: "bardepth", n: 100, label: "__qaSetBarDepthEnabled(true)", pre: () => window.__qaSetBarDepthEnabled?.(false), toggle: () => window.__qaSetBarDepthEnabled?.(true), selector: "rect" },
  { chart: "patternarea", n: 1000, label: "__qaSetPatternPreset('dots')", pre: () => window.__qaSetPatternPreset?.("none"), toggle: () => window.__qaSetPatternPreset?.("dots"), selector: "path" },
  { chart: "brush", n: 1000, label: "__qaSetBrush(0.25,0.75)", pre: () => window.__qaSetBrush?.(null), toggle: () => window.__qaSetBrush?.(0.25, 0.75), selector: "path" },
  { chart: "legendhover", n: 1000, label: "__qaSetLegendHover(0)", pre: () => window.__qaSetLegendHover?.(null), toggle: () => window.__qaSetLegendHover?.(0), selector: "path,rect,circle" },
];
const SAMPLE_AT = [100, 400, 900];

export async function noReRevealProbe(browser, baseUrl, { toggles = DEFAULT_TOGGLES, impls = ["bklit", "migrated"] } = {}) {
  const rows = [];
  for (const t of toggles) {
    for (const impl of impls) {
      const s = await openScene(browser, baseUrl, { impl, chart: t.chart, n: t.n });
      try {
        const hook = await s.page.evaluate(`(${t.pre.toString()})()`).then(() => true).catch(() => false);
        await s.page.waitForTimeout(1200);
        const before = await sampleMarks(s.page, { selector: t.selector, limit: 30 });
        const tStart = Date.now();
        await s.page.evaluate(`(${t.toggle.toString()})()`);
        const samples = [];
        for (const at of SAMPLE_AT) {
          const wait = at - (Date.now() - tStart);
          if (wait > 0) await s.page.waitForTimeout(wait);
          samples.push({ at, marks: await sampleMarks(s.page, { selector: t.selector, limit: 30 }) });
        }
        const d100_400 = diffMarks(samples[0].marks, samples[1].marks);
        const d400_900 = diffMarks(samples[1].marks, samples[2].marks);
        const dBefore_900 = diffMarks(before, samples[2].marks);
        const lowOpacityAt100 = samples[0].marks.marks.filter((m) => m.opacity < 0.5).length;
        const lowOpacityAt900 = samples[2].marks.marks.filter((m) => m.opacity < 0.5).length;
        // Re-reveal signature: still moving after +400ms, or marks near-transparent at
        // +100 that are opaque at +900 (fade-in replay), or heights growing.
        const stillMoving = d400_900.moved > 0 || d400_900.opacityChanged > 0;
        const fadeReplay = lowOpacityAt100 > lowOpacityAt900 + 2;
        rows.push({ chart: t.chart, n: t.n, impl, toggle: t.label, hookOk: hook, before: before.count, d100_400, d400_900, dBefore_900, lowOpacityAt100, lowOpacityAt900, stillMovingAfter400: stillMoving, fadeReplay, reRevealSuspected: stillMoving || fadeReplay, samples: samples.map((x) => ({ at: x.at, count: x.marks.count, first: x.marks.marks.slice(0, 6) })), errors: [...new Set(s.errors)].slice(0, 3) });
      } finally {
        await s.close();
      }
    }
  }
  const flagged = rows.filter((r) => r.reRevealSuspected);
  return { name: "no-rereveal", sampleAtMs: SAMPLE_AT, rows, flagged };
}
