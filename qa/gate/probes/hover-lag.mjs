// Post-settle hover lag: after quiescent settle, move to the 0.5 fraction of the largest svg; per impl, time from
// first pointermove to first dim, first tooltip, and last DOM change (1.5s virtual frame sample, medians of repeats).
// D622: the line this comment used to have here claimed the pixel gate's +700ms wall-clock capture and this
// probe's lastChangeMs were the same unit -- they are not, and that was never measured. lib-probe.mjs installs
// `page.clock.install()` before goto (lib-probe.mjs:129) and every ms this probe reports is virtual (animation-
// design) time advanced by stepVirtual(); `qa/screenshot.mjs` installs no clock at all (`clock` appears zero
// times in that file outside two comments) and its hover capture is `mouse.move` then a REAL
// `waitForTimeout(HOVER_WAIT_MS)` (screenshot.mjs:821-822). There is no fixed conversion between the two regimes
// -- a scene's virtual ms are what its own declared animation durations say it takes; the gate's wall ms are
// what the browser actually measures, including paint/compositing/scheduler overhead the fake clock does not
// run. So `virtualTailExceedsThreshold` below (flag `virtual-settle-tail>700ms`) is NOT a prediction of the gate's
// capture instant. It stays because 700 virtual ms is still a useful anomaly threshold in this probe's OWN
// regime: every genuine per-impl hover transition in play is 150-400ms virtual (SeriesHoverDim motion.g, virtual;
// SeriesMarkersDimWrapper CSS 0.15s; tooltip-content CSS transition-opacity 200ms; bar-chart-series-marks.ts:29
// 150ms; bar.tsx:164 0.15s; sankey-link.tsx:167 0.18s), so 700 leaves >2x margin. Investigation (LOG.md D622)
// found the flagged cells (bar/100 1115, sankey/33 1386) sit on the 1100ms shared enter-reveal constant
// (charts/animation.ts:6, internal/animation-defaults.ts:3) both impls share, not on hover-transition scale, and
// do not repeat run-to-run (sankey's three repeats: 1386/157/1399) -- a reveal tail leaking into the hover
// window, most likely via the same premature-quiescence gap D617-a fixed in openScene. This flag is therefore
// read as "settle took far longer than any declared hover transition, in this probe's own virtual-ms terms" --
// a falsifiable, in-regime observation -- and NOT as "the pixel gate would have captured mid-transition."
// B4 verdict: MIXED drivers -> virtual via clock + getAnimations lockstep. SeriesHoverDim motion.g (SVG -> motion
// JS frameloop, virtual) + SeriesMarkersDimWrapper CSS transition 0.15s (lockstep) + tooltip motion springs (JS,
// virtual) + tooltip-content CSS transition-opacity 200ms (lockstep) + HTML tooltip WAAPI players (lockstep).
// All reported ms are VIRTUAL (animation-design time); thresholds below keep their numeric values as virtual-ms
// anomaly bands, not as wall-clock equivalents (see D622 above).
// B5: the 150ms pre-move pause is dropped (fresh scene has no prior hover state; one 32ms virtual pump flushes
// initial styles) and the 1700ms observation wait is replaced by exact virtual stepping (30x50ms = sampler maxMs).
// Parallel: cells x impls x reps as runPool jobs (PROBE_WIDTH); separate contexts, seeded data -> no shared state.
import { runPool } from "../lib.mjs";
import { installSampler, largestSvgBox, median, openScene, PROBE_WIDTH, readSampler, stepVirtual } from "./lib-probe.mjs";

export const DEFAULT_CELLS = [
  ["line", 1000], ["area", 1000], ["bar", 100], ["scatter", 1000], ["composed", 1000], ["candlestick", 1000],
  ["heatmap", 52], ["pie", 1000], ["sankey", 33], ["choropleth", 100], ["liveline", 100], ["composedstacked", 100], ["areamultiaxis", 1000],
];
// D622: this used to be named/framed as the gate's HOVER_WAIT_MS mirrored
// into virtual ms ("same unit" per the header comment). It is not the same
// unit -- see the D622 note above. Kept as VIRTUAL_TAIL_THRESHOLD_MS: a
// virtual-ms anomaly band (>2x every declared hover-transition duration in
// source), not a claim about the gate's wall-clock capture instant.
const VIRTUAL_TAIL_THRESHOLD_MS = 700;

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
      return { rep: await readSampler(s.page), quiesceIters: s.quiesceIters, armedAtMs: s.armedAtMs, errors: [...new Set(s.errors)].slice(0, 3) };
    } finally {
      await s.close();
    }
  });
  const rows = [];
  for (const [chart, n] of cells) {
    for (const impl of impls) {
      const reps = [];
      const iters = [];
      const armedAt = [];
      let errors = [];
      jobs.forEach((j, k) => {
        if (j.chart === chart && j.n === n && j.impl === impl) {
          reps.push(repResults[k].rep);
          iters.push(repResults[k].quiesceIters);
          armedAt.push(repResults[k].armedAtMs);
          errors = errors.concat(repResults[k].errors);
        }
      });
      const ok = reps.filter((r) => r && !r.error && r.started);
      rows.push({
        chart,
        n,
        impl,
        repeats: ok.length,
        // D636: how many 50ms quiescence steps openScene actually needed, per repeat.
        // A cell whose settle cost varies run-to-run is measuring a moving scene,
        // and that has to be visible in the artefact, not inferred from an outcome.
        quiesceIters: iters.filter((v) => v != null),
        // D640: virtual ms spent before window.__benchSettled existed. The settle
        // cap is now spent from this point, so a cell whose value creeps toward
        // the cap is a page getting slower to load, not a chart getting slower to
        // settle -- two failures that produced one message until pie/1000 hit it.
        armedAtMs: armedAt.filter((v) => v != null),
        firstDimMs: median(ok.map((r) => r.firstDimMs)),
        firstTooltipMs: median(ok.map((r) => r.firstTooltipMs)),
        lastChangeMs: median(ok.map((r) => r.lastChangeMs)),
        finalDim: median(ok.map((r) => r.finalDim)),
        baseDim: median(ok.map((r) => r.baseDim)),
        finalTooltip: ok.length ? ok.every((r) => r.finalTooltip) : null,
        dimNever: ok.length ? ok.every((r) => r.firstDimMs == null) : null,
        tooltipNever: ok.length ? ok.every((r) => r.firstTooltipMs == null) : null,
        // D622: renamed from settlesAfterGateCapture -- this compares a
        // virtual-ms measurement against a virtual-ms anomaly band, not
        // against the gate's wall-clock capture (see the D622 note above).
        // D643: median, not `some`. Every other statistic on this row is a
        // median; this one was an any-repeat maximum, so its false-alarm rate
        // grew with --repeats while the cell's behaviour did not. liveline/100
        // bklit read [118,561,1267,1056,134] and flagged at 5 repeats having
        // never flagged at 3 -- a scene whose own spread is 10x, not a tail.
        // The real finding survives unchanged: migrated bar/100 is
        // [1102,1095,1100,1105,1089], median 1100 (D641).
        virtualTailExceedsThreshold: median(ok.map((r) => r.lastChangeMs)) > VIRTUAL_TAIL_THRESHOLD_MS,
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
    // D622: flag renamed from "settles-after-700ms-capture" -- the old name
    // asserted this predicts the pixel gate's +700ms wall-clock capture,
    // which lib-probe.mjs's virtual clock (installed before goto) makes
    // false: this is a virtual-ms (animation-design-time) measurement, the
    // gate's capture is real wall time, and there is no fixed conversion
    // between the two (see the file header). The new name states only what
    // is actually measured, in the regime it is measured in.
    if (a.virtualTailExceedsThreshold || b.virtualTailExceedsThreshold) flags.push("virtual-settle-tail>700ms");
    pairs.push({ chart, n, bklit: { dim: a.firstDimMs, tip: a.firstTooltipMs, last: a.lastChangeMs, finalDim: a.finalDim }, migrated: { dim: b.firstDimMs, tip: b.firstTooltipMs, last: b.lastChangeMs, finalDim: b.finalDim }, flags });
  }
  // D622: emitted as virtualTailThresholdMs, not hoverWaitMs. The old name
  // reached run-probes.mjs, which printed "Gate captures at +700 ms" into
  // every probes.md -- the false claim restated one level out, in the
  // artefact rather than the source.
  return { name: "hover-lag", virtualTailThresholdMs: VIRTUAL_TAIL_THRESHOLD_MS, rows, pairs, flagged: pairs.filter((p) => p.flags.length) };
}
