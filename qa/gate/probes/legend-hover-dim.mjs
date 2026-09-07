// Legend-hover dim probe (window.__qaSetLegendHover, same driver as the pixel gate): per-frame dimmed count to
// time-to-dim, final count, and time-to-undim. Flags fire on dim-presence mismatch or count differing >25%.
// B4 verdict: same MIXED drivers as hover-lag (motion-on-SVG JS + CSS transitions), virtual via clock + lockstep.
// Reported dimMs/undimMs are VIRTUAL ms; the >300ms settle-diff band is unchanged (both sides same unit).
// The 16ms poll loop was already condition-based — kept, with waitForTimeout(16) swapped for stepVirtual(16)
// and Date.now() deltas swapped for accumulated virtual ms (wall Date would mix timebases under a fake clock).
// Parallel: cells x impls as runPool jobs (PROBE_WIDTH); per-item dim/undim stays serial on its own page.
import { runPool } from "../lib.mjs";
import { dimmedCount, openScene, PROBE_WIDTH, stepVirtual } from "./lib-probe.mjs";

export const DEFAULT_CELLS = [["legendhover", 1000], ["candlelegend", 1000], ["markers", 100], ["barsquares", 100], ["profitloss", 1000]];

async function settleDimmed(page, { maxMs = 1500, stableMs = 250, base = null } = {}) {
  let t = 0;
  let last = await dimmedCount(page);
  let firstChangeMs = null;
  let lastChangeMs = 0;
  // Explicit pre-hover baseline when the caller passes one; otherwise derive
  // from the first read as before (keeps other callers working unchanged).
  const resolvedBase = base ?? last.dimmed;
  for (;;) {
    await stepVirtual(page, 16);
    t += 16;
    const cur = await dimmedCount(page);
    if (cur.dimmed !== last.dimmed) {
      if (firstChangeMs == null) firstChangeMs = t;
      lastChangeMs = t;
      last = cur;
    }
    if (t - lastChangeMs > stableMs || t > maxMs) break;
  }
  return { base: resolvedBase, final: last.dimmed, total: last.total, firstChangeMs, lastChangeMs: firstChangeMs == null ? null : lastChangeMs };
}

export async function legendHoverDimProbe(browser, baseUrl, { cells = DEFAULT_CELLS, impls = ["bklit", "migrated"], items = [0, 1] } = {}) {
  const jobs = [];
  for (const [chart, n] of cells) for (const impl of impls) jobs.push({ chart, n, impl });
  const rows = await runPool(jobs, PROBE_WIDTH, async (job) => {
    const { chart, n, impl } = job;
    const s = await openScene(browser, baseUrl, { impl, chart, n });
    try {
      const hasHook = await s.page.evaluate(() => typeof window.__qaSetLegendHover === "function");
      const perItem = [];
      for (const i of items) {
        // Baseline BEFORE issuing the hover: migrated applies legend dim with
        // no queued tween, so a post-command first read would already equal
        // the dimmed state and report +0. bklit's in-flight 150ms fade is what
        // let the old ordering work for it.
        const pre = await dimmedCount(s.page);
        await s.page.evaluate((i) => window.__qaSetLegendHover?.(i), i);
        const dim = await settleDimmed(s.page, { base: pre.dimmed });
        await s.page.evaluate(() => window.__qaSetLegendHover?.(null));
        const undim = await settleDimmed(s.page);
        perItem.push({ item: i, dimmedBefore: dim.base, dimmedAfter: dim.final, dimMs: dim.lastChangeMs, undimmedTo: undim.final, undimMs: undim.lastChangeMs, elements: dim.total });
      }
      return { chart, n, impl, hasHook, perItem, errors: [...new Set(s.errors)].slice(0, 3) };
    } finally {
      await s.close();
    }
  });
  const pairs = [];
  for (const [chart, n] of cells) {
    const a = rows.find((r) => r.chart === chart && r.n === n && r.impl === "bklit");
    const b = rows.find((r) => r.chart === chart && r.n === n && r.impl === "migrated");
    if (!a || !b) continue;
    const flags = [];
    for (let k = 0; k < Math.min(a.perItem.length, b.perItem.length); k++) {
      const x = a.perItem[k];
      const y = b.perItem[k];
      const xd = x.dimmedAfter - x.dimmedBefore;
      const yd = y.dimmedAfter - y.dimmedBefore;
      if ((xd > 0) !== (yd > 0)) flags.push(`item-${x.item}: dim presence mismatch (bklit +${xd}, migrated +${yd})`);
      else if (xd > 0 && Math.abs(xd - yd) / Math.max(xd, yd) > 0.25) flags.push(`item-${x.item}: dimmed count differs >25% (bklit +${xd}, migrated +${yd})`);
      if (x.undimmedTo !== x.dimmedBefore) flags.push(`item-${x.item}: bklit does not fully undim (${x.dimmedBefore} -> ${x.undimmedTo})`);
      if (y.undimmedTo !== y.dimmedBefore) flags.push(`item-${x.item}: migrated does not fully undim (${y.dimmedBefore} -> ${y.undimmedTo})`);
      if (x.dimMs != null && y.dimMs != null && Math.abs(x.dimMs - y.dimMs) > 300) flags.push(`item-${x.item}: dim settle time differs >300ms (bklit ${x.dimMs}, migrated ${y.dimMs})`);
    }
    if (!a.hasHook || !b.hasHook) flags.push(`hook missing (bklit ${a.hasHook}, migrated ${b.hasHook})`);
    pairs.push({ chart, n, bklit: a.perItem, migrated: b.perItem, flags });
  }
  return { name: "legend-hover-dim", rows, pairs, flagged: pairs.filter((p) => p.flags.length) };
}
