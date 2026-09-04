// Post-settle hover lag: after settle (+3s), move to the 0.5 fraction of the largest svg; per impl, time from
// first pointermove to first dim, first tooltip, and last DOM change (1.5s frame sample, medians of repeats).
// GUARD: the pixel gate captures 700ms after the move, so lastChangeMs > 700 means a mid-transition capture.
import { installSampler, largestSvgBox, median, openScene, readSampler } from "./lib-probe.mjs";

export const DEFAULT_CELLS = [
  ["line", 1000], ["area", 1000], ["bar", 100], ["scatter", 1000], ["composed", 1000], ["candlestick", 1000],
  ["heatmap", 52], ["pie", 1000], ["sankey", 33], ["choropleth", 100], ["liveline", 100], ["composedstacked", 100], ["areamultiaxis", 1000],
];
const HOVER_WAIT_MS = 700;

export async function hoverLagProbe(browser, baseUrl, { cells = DEFAULT_CELLS, repeats = 3, impls = ["bklit", "migrated"] } = {}) {
  const rows = [];
  for (const [chart, n] of cells) {
    for (const impl of impls) {
      const reps = [];
      let errors = [];
      for (let i = 0; i < repeats; i++) {
        const s = await openScene(browser, baseUrl, { impl, chart, n });
        try {
          const box = await largestSvgBox(s.page);
          if (!box) {
            reps.push({ error: "no svg" });
            continue;
          }
          await s.page.mouse.move(2, 2);
          await s.page.waitForTimeout(150);
          await installSampler(s.page, { maxMs: 1500 });
          await s.page.mouse.move(box.x + box.w * 0.5, box.y + box.h * 0.5, { steps: 10 });
          await s.page.waitForTimeout(1700);
          reps.push(await readSampler(s.page));
          errors = errors.concat(s.errors);
        } finally {
          await s.close();
        }
      }
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
