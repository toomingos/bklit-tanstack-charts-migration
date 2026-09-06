// No-re-reveal probe: after settle, flip a prop through the scenario QA hook and sample marks at +100/+400/+900ms.
// Toggles: bardepth/100 __qaSetBarDepthEnabled(true); patternarea/1000 __qaSetPatternPreset("dots");
// brush/1000 __qaSetBrush(0.25,0.75); legendhover/1000 __qaSetLegendHover(0).
// B4 verdict: virtualisable. This probe reports NO times — only geometry/opacity diffs at instants — so the win
// is exact instants: stepVirtual lands samples on precisely +100/+400/+900 virtual ms instead of wall-jittered
// waits, removing load-driven false reRevealSuspected. Re-reveal replays (clip-path tween, motion-on-SVG JS +
// CSS transitions) advance under the same clock + lockstep. SAMPLE_AT values are unchanged (same unit, now exact).
// B5: the 1200ms post-pre() wait becomes a quiescence poll (sampleMarks stable across 100 virtual ms, same 1200
// cap) — a fresh settled scene is almost always already stable, so the sleep is usually skipped entirely.
// Parallel: toggles x impls as runPool jobs (PROBE_WIDTH); separate contexts, no shared state.
import { runPool } from "../lib.mjs";
import { diffMarks, openScene, PROBE_WIDTH, sampleMarks, stepVirtual } from "./lib-probe.mjs";

export const DEFAULT_TOGGLES = [
  { chart: "bardepth", n: 100, label: "__qaSetBarDepthEnabled(true)", pre: () => window.__qaSetBarDepthEnabled?.(false), toggle: () => window.__qaSetBarDepthEnabled?.(true), selector: "rect" },
  { chart: "patternarea", n: 1000, label: "__qaSetPatternPreset('dots')", pre: () => window.__qaSetPatternPreset?.("none"), toggle: () => window.__qaSetPatternPreset?.("dots"), selector: "path" },
  { chart: "brush", n: 1000, label: "__qaSetBrush(0.25,0.75)", pre: () => window.__qaSetBrush?.(null), toggle: () => window.__qaSetBrush?.(0.25, 0.75), selector: "path" },
  { chart: "legendhover", n: 1000, label: "__qaSetLegendHover(0)", pre: () => window.__qaSetLegendHover?.(null), toggle: () => window.__qaSetLegendHover?.(0), selector: "path,rect,circle" },
];
const SAMPLE_AT = [100, 400, 900];

export async function noReRevealProbe(browser, baseUrl, { toggles = DEFAULT_TOGGLES, impls = ["bklit", "migrated"] } = {}) {
  const jobs = [];
  for (const t of toggles) for (const impl of impls) jobs.push({ t, impl });
  const rows = await runPool(jobs, PROBE_WIDTH, async (job) => {
    const { t, impl } = job;
    const s = await openScene(browser, baseUrl, { impl, chart: t.chart, n: t.n });
    try {
      const hook = await s.page.evaluate(`(${t.pre.toString()})()`).then(() => true).catch(() => false);
      // Quiescence replaces the fixed 1200ms: baseline restore is settled once marks stop moving.
      let before = await sampleMarks(s.page, { selector: t.selector, limit: 30 });
      for (let v = 0; v < 1200; v += 100) {
        await stepVirtual(s.page, 100);
        const cur = await sampleMarks(s.page, { selector: t.selector, limit: 30 });
        const d = diffMarks(before, cur);
        before = cur;
        if (!d.moved && !d.opacityChanged && d.countA === d.countB) break;
      }
      await s.page.evaluate(`(${t.toggle.toString()})()`);
      const samples = [];
      let v = 0;
      for (const at of SAMPLE_AT) {
        await stepVirtual(s.page, at - v);
        v = at;
        samples.push({ at, marks: await sampleMarks(s.page, { selector: t.selector, limit: 30 }) });
      }
        const d100_400 = diffMarks(samples[0].marks, samples[1].marks);
        const d400_900 = diffMarks(samples[1].marks, samples[2].marks);
        const dBefore_900 = diffMarks(before, samples[2].marks);
        const lowOpacityAt100 = samples[0].marks.marks.filter((m) => m.opacity < 0.5).length;
        const lowOpacityAt900 = samples[2].marks.marks.filter((m) => m.opacity < 0.5).length;
        // Re-reveal = still moving after +400ms, or near-transparent at +100 but opaque at +900 (fade-in replay).
        const stillMoving = d400_900.moved > 0 || d400_900.opacityChanged > 0;
        const fadeReplay = lowOpacityAt100 > lowOpacityAt900 + 2;
        return { chart: t.chart, n: t.n, impl, toggle: t.label, hookOk: hook, before: before.count, d100_400, d400_900, dBefore_900, lowOpacityAt100, lowOpacityAt900, stillMovingAfter400: stillMoving, fadeReplay, reRevealSuspected: stillMoving || fadeReplay, samples: samples.map((x) => ({ at: x.at, count: x.marks.count, first: x.marks.marks.slice(0, 6) })), errors: [...new Set(s.errors)].slice(0, 3) };
    } finally {
      await s.close();
    }
  });
  const flagged = rows.filter((r) => r.reRevealSuspected);
  return { name: "no-rereveal", sampleAtMs: SAMPLE_AT, rows, flagged };
}
