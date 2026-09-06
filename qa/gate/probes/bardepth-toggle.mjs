// Bardepth depth-toggle probe (window.__qaSetBarDepthEnabled, mirroring the gate's depth cells): per-impl counts,
// geometry per state, settle time per toggle, and whether toggling back restores exact geometry.
// B4 verdict: JS-driven. The toggle mounts/unmounts depth layers whose enter grow is motion-on-SVG (JS frameloop,
// virtual); geometry/opacity reads are synchronous commits. Reported settleMs are VIRTUAL ms; the >400ms diff and
// >700ms capture-window flags keep their numeric values (same unit both sides).
// The 33ms poll loop was already condition-based — kept, with waitForTimeout(33) swapped for stepVirtual(33)
// and Date.now() swapped for accumulated virtual ms. Parallel: impls as runPool jobs (PROBE_WIDTH).
import { runPool } from "../lib.mjs";
import { diffMarks, openScene, PROBE_WIDTH, sampleMarks, stepVirtual } from "./lib-probe.mjs";

async function settleMarks(page, { maxMs = 1500, stableMs = 250 } = {}) {
  let t = 0;
  let last = await sampleMarks(page, { limit: 40 });
  let lastChange = 0;
  let firstChange = null;
  for (;;) {
    await stepVirtual(page, 33);
    t += 33;
    const cur = await sampleMarks(page, { limit: 40 });
    const d = diffMarks(last, cur);
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
  const rows = await runPool(impls, PROBE_WIDTH, async (impl) => {
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
      return {
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
      };
    } finally {
      await s.close();
    }
  });
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
