// D641: attributes migrated bar/100's post-hover mutation tail to the elements
// producing it. `hover-lag.mjs` reports a `lastChangeMs` per cell but never WHAT
// changed, so a ~1100 ms tail stayed readable as "something replays the reveal"
// for as long as nobody asked which node moved. This records every attribute
// mutation under documentElement, stamps each with virtual ms since the pointer
// moved, and groups by the owning `data-ts-key` -- the answer is a node name,
// not an inference.
//
// Read-only. It serves bench/app/dist via startPreview, which does NOT build:
// REBUILD bench/app before running it after touching showcase/migrated. A
// measurement against a stale bundle is exactly D636's error.
import { launchBrowser, openScene, stepVirtual, largestSvgBox } from "./lib-probe.mjs";
import { QA_PORT, acquireQaLock, startPreview } from "../lib.mjs";

const release = await acquireQaLock("bar-mut");
const preview = await startPreview("bar-mut", QA_PORT, {});
try {
  const browser = await launchBrowser();
  for (const impl of ["migrated"]) {
    const s = await openScene(browser, preview.url, { impl, chart: "bar", n: 100 });
    const box = await largestSvgBox(s.page);
    await s.page.mouse.move(2, 2);
    await stepVirtual(s.page, 32);
    await s.page.evaluate(() => {
      window.__t0 = performance.now();
      window.__mut = [];
      new MutationObserver((recs) => {
        const t = Math.round(performance.now() - window.__t0);
        for (const r of recs) {
          const el = r.target;
          const owner = el.closest?.("[data-ts-key]");
          window.__mut.push({
            t, type: r.type, attr: r.attributeName,
            tag: el.localName,
            key: owner?.getAttribute("data-ts-key") ?? null,
          });
        }
      }).observe(document.documentElement, { subtree: true, childList: true, attributes: true });
    });
    await s.page.mouse.move(box.x + box.w * 0.5, box.y + box.h * 0.5, { steps: 10 });
    for (let v = 0; v < 1500; v += 25) await stepVirtual(s.page, 25);
    const out = await s.page.evaluate(() => {
      const m = window.__mut;
      const last = new Map();
      const count = new Map();
      for (const r of m) {
        const id = `${r.key ?? "(unkeyed)"} <${r.tag}> ${r.type === "attributes" ? r.attr : "childList"}`;
        last.set(id, Math.max(last.get(id) ?? 0, r.t));
        count.set(id, (count.get(id) ?? 0) + 1);
      }
      return {
        total: m.length,
        overall: Math.max(...m.map((r) => r.t)),
        tail: [...last.entries()].filter(([, t]) => t > 700).sort((a, b) => b[1] - a[1])
          .map(([id, t]) => ({ id, t, n: count.get(id) })),
      };
    });
    console.log(`\n=== ${impl} bar/100 — ${out.total} mutations, last at ${out.overall} ms`);
    console.log(`mutation streams still running after 700 ms: ${out.tail.length}`);
    for (const r of out.tail.slice(0, 25)) console.log(`  last +${String(r.t).padStart(5)}ms  n=${String(r.n).padStart(4)}  ${r.id}`);
    await s.close();
  }
  await browser.close();
} finally {
  await preview.stop?.();
  await release?.();
}
