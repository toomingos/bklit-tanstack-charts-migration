// D641: the decisive test for the bar/100 hover tail.
//
// `virtual-settle-tail>700ms` survives on migrated bar/100 (lastChange ~1129 ms)
// against `quiesceIters [1,1,1]` -- the scene was fully quiescent before the
// pointer moved, so "reveal tail leaking into the hover window" is refuted for
// this cell (D636). The standing hypothesis was that hover instead REPLAYS the
// 1100 ms enter motion. A source trace refuted that as stated: hover rebuilds
// every mark object, but @tanstack/charts' reconciler diffs `data-ts-key`
// STRINGS (motion.js:2483-2499), and no bar/tick builder puts hover state in a
// key -- so identity churn alone cannot reclassify a rect as entering.
//
// That leaves one thing source cannot answer: whether the RENDERED markup's
// keys actually hold across a hover render. `data-ts-motion-role="bar"` is set
// only by the bar-grow enter path (motion.js:1615) and cleared on finish(), so
// its appearance after a pointer move is a direct, low-noise observation of the
// only mechanism that produces 1100 ms here.
//
// Note on the clock: `stepVirtual` pauses animations and never resumes them, so
// a track that starts will NOT reach finish() and the attribute will not be
// cleared. That biases the test toward DETECTING the attribute, which is the
// right direction -- a null result under a detector that cannot lose the signal
// is meaningful, where a null under a lossy one would not be.
import { launchBrowser, openScene, stepVirtual, largestSvgBox } from "./lib-probe.mjs";
import { QA_PORT, acquireQaLock, startPreview } from "../lib.mjs";

async function run(impl) {
  const browser = await launchBrowser();
  try {
    const s = await openScene(browser, preview.url, { impl, chart: "bar", n: 100 });
    const box = await largestSvgBox(s.page);
    await s.page.mouse.move(2, 2);
    await stepVirtual(s.page, 32);

    // Observe the whole document: scoping to .ts-chart__marks would assume the
    // very structure under test.
    await s.page.evaluate(() => {
      window.__roleLog = [];
      window.__keyLog = [];
      const keysOf = () => [...document.querySelectorAll("[data-ts-key]")].map((e) => e.getAttribute("data-ts-key"));
      window.__keysBefore = keysOf();
      window.__keysNow = keysOf;
      new MutationObserver((recs) => {
        for (const r of recs) {
          const el = r.target;
          window.__roleLog.push({
            t: Math.round(performance.now()),
            attr: r.attributeName,
            value: el.getAttribute(r.attributeName),
            old: r.oldValue,
            tag: el.localName,
            key: el.getAttribute("data-ts-key"),
          });
        }
      }).observe(document.documentElement, {
        subtree: true, attributes: true, attributeOldValue: true,
        attributeFilter: ["data-ts-motion-role", "data-ts-key"],
      });
    });

    await s.page.mouse.move(box.x + box.w * 0.5, box.y + box.h * 0.5, { steps: 10 });
    for (let v = 0; v < 1500; v += 50) await stepVirtual(s.page, 50);

    const out = await s.page.evaluate(() => {
      const before = window.__keysBefore, after = window.__keysNow();
      const bset = new Set(before), aset = new Set(after);
      return {
        roleEvents: window.__roleLog.filter((r) => r.attr === "data-ts-motion-role"),
        keyEvents: window.__roleLog.filter((r) => r.attr === "data-ts-key").length,
        keysBefore: before.length,
        keysAfter: after.length,
        keysLost: before.filter((k) => !aset.has(k)).slice(0, 8),
        keysGained: after.filter((k) => !bset.has(k)).slice(0, 8),
      };
    });
    await s.close();
    return { impl, armedAtMs: s.armedAtMs, quiesceIters: s.quiesceIters, ...out };
  } finally {
    await browser.close();
  }
}

// Same lock and preview the probes use, so this can never run beside a gate.
const release = await acquireQaLock("bar-hover-motion-role");
const preview = await startPreview("bar-hover-motion-role", QA_PORT, {});
try {
for (const impl of ["bklit", "migrated"]) {
  const r = await run(impl);
  console.log(`\n=== ${r.impl} bar/100  (armedAt ${r.armedAtMs} ms, quiesceIters ${r.quiesceIters})`);
  console.log(`  data-ts-key elements: ${r.keysBefore} before hover -> ${r.keysAfter} after`);
  console.log(`  data-ts-key mutations during hover window: ${r.keyEvents}`);
  console.log(`  keys lost:   ${r.keysLost.length ? r.keysLost.join(", ") : "none"}`);
  console.log(`  keys gained: ${r.keysGained.length ? r.keysGained.join(", ") : "none"}`);
  console.log(`  data-ts-motion-role events: ${r.roleEvents.length}`);
  for (const e of r.roleEvents.slice(0, 10)) console.log(`    +${e.t}ms ${e.tag} key=${e.key} ${e.old} -> ${e.value}`);
}
} finally {
  await preview.stop?.();
  await release?.();
}
