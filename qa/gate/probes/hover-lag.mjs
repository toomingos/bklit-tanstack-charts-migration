// Post-settle hover lag: after quiescent settle, move to the 0.5 fraction of the largest svg; per impl, time from
// first pointermove to first dim, first tooltip, and last DOM change (1.5s virtual frame sample, medians of repeats).
// GUARD: the pixel gate captures 700ms after the move, so lastChangeMs > 700 means a mid-transition capture.
// B4 verdict: MIXED drivers -> virtual via clock + getAnimations lockstep. SeriesHoverDim motion.g (SVG -> motion
// JS frameloop, virtual) + SeriesMarkersDimWrapper CSS transition 0.15s (lockstep) + tooltip motion springs (JS,
// virtual) + tooltip-content CSS transition-opacity 200ms (lockstep) + HTML tooltip WAAPI players (lockstep).
// All reported ms are now VIRTUAL (animation-design time); thresholds below keep their numeric values because
// virtual ms are the same unit the durations (400/150/200/160ms) and the gate's +700ms capture are written in.
// B5: the 150ms pre-move pause is dropped (fresh scene has no prior hover state; one 32ms virtual pump flushes
// initial styles) and the 1700ms observation wait is replaced by exact virtual stepping (30x50ms = sampler maxMs).
// Parallel: cells x impls x reps as runPool jobs (PROBE_WIDTH); separate contexts, seeded data -> no shared state.
import { runPool } from "../lib.mjs";
import { installSampler, largestSvgBox, median, openScene, PROBE_WIDTH, readSampler, stepVirtual } from "./lib-probe.mjs";

export const DEFAULT_CELLS = [
  ["line", 1000], ["area", 1000], ["bar", 100], ["scatter", 1000], ["composed", 1000], ["candlestick", 1000],
  ["heatmap", 52], ["pie", 1000], ["sankey", 33], ["choropleth", 100], ["liveline", 100], ["composedstacked", 100], ["areamultiaxis", 1000],
];
const HOVER_WAIT_MS = 700;

export async function hoverLagProbe(browser, baseUrl, { cells = DEFAULT_CELLS, repeats = 3, impls = ["bklit", "migrated"] } = {}) {
  const jobs = [];
  for (const [chart, n] of cells) for (const impl of impls) for (let i = 0; i < repeats; i++) jobs.push({ chart, n, impl });
  const repResults = await runPool(jobs, PROBE_WIDTH, async (job) => {
    const s = await openScene(browser, baseUrl, { impl: job.impl, chart: job.chart, n: job.n });
    try {
      const box = await largestSvgBox(s.page);
      if (!box) return { rep: { error: "no svg" }, errors: [] };
      await s.page.mouse.move(2, 2);
      await stepVirtual(s.page, 32);
      await installSampler(s.page, { maxMs: 1500 });
      await s.page.mouse.move(box.x + box.w * 0.5, box.y + box.h * 0.5, { steps: 10 });
      for (let v = 0; v < 1500; v += 50) await stepVirtual(s.page, 50);
      return { rep: await readSampler(s.page), errors: [...new Set(s.errors)].slice(0, 3) };
    } finally {
      await s.close();
    }
  });
  const rows = [];
  for (const [chart, n] of cells) {
    for (const impl of impls) {
      const reps = [];
      let errors = [];
      jobs.forEach((j, k) => {
        if (j.chart === chart && j.n === n && j.impl === impl) {
          reps.push(repResults[k].rep);
          errors = errors.concat(repResults[k].errors);
        }
      });
      const ok = reps.filter((r) => r && !r.error && r.started);
      rows.push({
        chart,
        n,
        impl,
        repeats: ok.length,
        firstDimMs: median(ok.map((r) => r.firstDimMs)),
        firstTooltipMs: median(ok.map((r) => r.firstTooltipMs)),
        lastChangeMs: median(ok.map((r) => r.lastChangeMs)),
        finalDim: median(ok.map((r) => r.finalDim)),
        baseDim: median(ok.map((r) => r.baseDim)),
        finalTooltip: ok.length ? ok.every((r) => r.finalTooltip) : null,
        dimNever: ok.length ? ok.every((r) => r.firstDimMs == null) : null,
        tooltipNever: ok.length ? ok.every((r) => r.firstTooltipMs == null) : null,
        settlesAfterGateCapture: ok.some((r) => r.lastChangeMs != null && r.lastChangeMs > HOVER_WAIT_MS),
        raw: reps,
        errors: [...new Set(errors)].slice(0, 3),
      });
    }
  }
  const pairs = [];
  for (const [chart, n] of cells) {
    const a = rows.find((r) => r.chart === chart && r.n === n && r.impl === "bklit");
    const b = rows.find((r) => r.chart === chart && r.n === n && r.impl === "migrated");
    if (!a || !b) continue;
    const flags = [];
    if (a.tooltipNever !== b.tooltipNever) flags.push("tooltip-presence-mismatch");
    if (a.dimNever !== b.dimNever) flags.push("dim-presence-mismatch");
    if (a.firstTooltipMs != null && b.firstTooltipMs != null && Math.abs(a.firstTooltipMs - b.firstTooltipMs) > 200) flags.push("tooltip-lag>200ms");
    if (a.firstDimMs != null && b.firstDimMs != null && Math.abs(a.firstDimMs - b.firstDimMs) > 200) flags.push("dim-lag>200ms");
    if (a.settlesAfterGateCapture || b.settlesAfterGateCapture) flags.push("settles-after-700ms-capture");
    pairs.push({ chart, n, bklit: { dim: a.firstDimMs, tip: a.firstTooltipMs, last: a.lastChangeMs, finalDim: a.finalDim }, migrated: { dim: b.firstDimMs, tip: b.firstTooltipMs, last: b.lastChangeMs, finalDim: b.finalDim }, flags });
  }
  return { name: "hover-lag", hoverWaitMs: HOVER_WAIT_MS, rows, pairs, flagged: pairs.filter((p) => p.flags.length) };
}
