// Legend-hover dim probe (window.__qaSetLegendHover, same driver as the pixel gate): per-frame dimmed count to
// time-to-dim, final count, and time-to-undim. Flags fire on dim-presence mismatch or count differing >25%.
import { dimmedCount, openScene } from "./lib-probe.mjs";

export const DEFAULT_CELLS = [["legendhover", 1000], ["candlelegend", 1000], ["markers", 100], ["barsquares", 100], ["profitloss", 1000]];

async function settleDimmed(page, { maxMs = 1500, stableMs = 250 } = {}) {
  const t0 = Date.now();
  let last = await dimmedCount(page);
  let firstChangeMs = null;
  let lastChangeMs = 0;
  const base = last.dimmed;
  for (;;) {
    await page.waitForTimeout(16);
    const cur = await dimmedCount(page);
    const t = Date.now() - t0;
    if (cur.dimmed !== last.dimmed) {
      if (firstChangeMs == null) firstChangeMs = t;
      lastChangeMs = t;
      last = cur;
    }
    if (t - lastChangeMs > stableMs || t > maxMs) break;
  }
  return { base, final: last.dimmed, total: last.total, firstChangeMs, lastChangeMs: firstChangeMs == null ? null : lastChangeMs };
}

export async function legendHoverDimProbe(browser, baseUrl, { cells = DEFAULT_CELLS, impls = ["bklit", "migrated"], items = [0, 1] } = {}) {
  const rows = [];
  for (const [chart, n] of cells) {
    for (const impl of impls) {
      const s = await openScene(browser, baseUrl, { impl, chart, n });
      try {
        const hasHook = await s.page.evaluate(() => typeof window.__qaSetLegendHover === "function");
        const perItem = [];
        for (const i of items) {
          await s.page.evaluate((i) => window.__qaSetLegendHover?.(i), i);
          const dim = await settleDimmed(s.page);
          await s.page.evaluate(() => window.__qaSetLegendHover?.(null));
          const undim = await settleDimmed(s.page);
          perItem.push({ item: i, dimmedBefore: dim.base, dimmedAfter: dim.final, dimMs: dim.lastChangeMs, undimmedTo: undim.final, undimMs: undim.lastChangeMs, elements: dim.total });
        }
        rows.push({ chart, n, impl, hasHook, perItem, errors: [...new Set(s.errors)].slice(0, 3) });
      } finally {
        await s.close();
      }
    }
  }
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
