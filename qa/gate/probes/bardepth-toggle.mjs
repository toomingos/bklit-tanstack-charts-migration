// Probe: bardepth depth toggle. Mirrors the gate's depth-off / depth-on cells
// via window.__qaSetBarDepthEnabled(bool) and records, per impl: element
// counts and bar geometry in each state, the time the DOM takes to stop
// changing after each toggle, and whether toggling back restores the exact
// pre-toggle geometry (a leak or re-layout shows up as moved marks).
import { diffMarks, openScene, sampleMarks } from "./lib-probe.mjs";

async function settleMarks(page, { maxMs = 1500, stableMs = 250 } = {}) {
  const t0 = Date.now();
  let last = await sampleMarks(page, { limit: 40 });
  let lastChange = 0;
  let firstChange = null;
  for (;;) {
    await page.waitForTimeout(33);
    const cur = await sampleMarks(page, { limit: 40 });
    const d = diffMarks(last, cur);
    const t = Date.now() - t0;
    if (d.moved || d.opacityChanged || d.countA !== d.countB) {
      lastChange = t;
      if (firstChange == null) firstChange = t;
      last = cur;
    }
    if (t - lastChange > stableMs || t > maxMs) break;
  }
  return { marks: last, settleMs: firstChange == null ? 0 : lastChange };
}

export async function barDepthToggleProbe(browser, baseUrl, { chart = "bardepth", n = 100, impls = ["bklit", "migrated"] } = {}) {
  const rows = [];
  for (const impl of impls) {
    const s = await openScene(browser, baseUrl, { impl, chart, n });
    try {
      const hooks = await s.page.evaluate(() => ({ depth: typeof window.__qaSetBarDepthEnabled === "function", pulsePaused: typeof window.__qaSetBarPulsePaused === "function", pulsePhase: typeof window.__qaSetBarPulsePhase === "function" }));
      const initial = await sampleMarks(s.page, { limit: 40 });
      await s.page.evaluate(() => window.__qaSetBarDepthEnabled?.(false));
      const off = await settleMarks(s.page);
      await s.page.evaluate(() => window.__qaSetBarDepthEnabled?.(true));
      const on = await settleMarks(s.page);
      await s.page.evaluate(() => window.__qaSetBarDepthEnabled?.(false));
      const off2 = await settleMarks(s.page);
      rows.push({
        impl,
        hooks,
        initialCount: initial.count,
        offCount: off.marks.count,
        onCount: on.marks.count,
        offSettleMs: off.settleMs,
        onSettleMs: on.settleMs,
        offAgainSettleMs: off2.settleMs,
        offVsOn: diffMarks(off.marks, on.marks),
        offVsOffAgain: diffMarks(off.marks, off2.marks),
        errors: [...new Set(s.errors)].slice(0, 3),
      });
    } finally {
      await s.close();
    }
  }
  const a = rows.find((r) => r.impl === "bklit");
  const b = rows.find((r) => r.impl === "migrated");
  const flags = [];
  if (a && b) {
    if (!a.hooks.depth || !b.hooks.depth) flags.push("depth hook missing");
    if ((a.onCount - a.offCount) * (b.onCount - b.offCount) <= 0 && a.onCount !== a.offCount) flags.push(`element delta on toggle differs in sign (bklit ${a.offCount}->${a.onCount}, migrated ${b.offCount}->${b.onCount})`);
    if (a.offVsOffAgain.moved || b.offVsOffAgain.moved) flags.push(`toggle round-trip does not restore geometry (bklit moved ${a.offVsOffAgain.moved}, migrated moved ${b.offVsOffAgain.moved})`);
    if (Math.abs(a.onSettleMs - b.onSettleMs) > 400) flags.push(`depth-on settle differs >400ms (bklit ${a.onSettleMs}, migrated ${b.onSettleMs})`);
    if (a.onSettleMs > 700 || b.onSettleMs > 700) flags.push("depth-on still changing after the gate's 700ms capture window");
  }
  return { name: "bardepth-toggle", chart, n, rows, flags };
}
