// temp-resize-probe.mjs — P4.3 resize harness (executor tool).
// Verifies measurement parity for pie/ring/radar in FLUID mode across
// container resizes, through the 10ms debounce window. Loads the resize-lab
// page (showcase app), waits out reveals, then RESIZES EACH LAB CELL
// explicitly (page-level viewport resizes are absorbed by the showcase
// layout's fixed-width main + body scrollbar, so cells must be driven
// directly — this is also precisely the ResizeObserver stimulus the debounced
// hook responds to). Steps: 600 -> 380 -> 620 (shrink past debounce window,
// then grow to a THIRD distinct size so a stale-width latch cannot pass by
// luck). A measurement defect shows up as impl disagreement or svg size not
// tracking the cell width.
// Usage: node research/phase-4/tools/temp-resize-probe.mjs <port>
import { createRequire } from "node:module";
const require = createRequire(
  new URL("../../../showcase/package.json", import.meta.url),
);
const { chromium } = require("playwright");

const port = process.argv[2] ?? "5200";
const STEPS = [600, 380, 620];
const base = `http://localhost:${port}`;

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1000, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  await page.goto(`${base}/charts/resize-lab`, { waitUntil: "domcontentloaded", timeout: 30000 });

  // First mount: wait for all six lab cells (2 impls × 3 charts) to render
  // an <svg>, plus a generous settle margin (reveals ~1.4s+stagger at n=6).
  await page.waitForFunction(
    () => document.querySelectorAll("[data-resize-lab] svg").length >= 6,
    null,
    { timeout: 30000 },
  );
  // Pin every cell to the first step width before sampling.
  await page.evaluate((w0) => {
    for (const cell of document.querySelectorAll("[data-resize-lab]")) {
      cell.style.width = `${w0}px`;
    }
  }, STEPS[0]);
  await page.waitForTimeout(2500);

  const results = [];
  for (const w of STEPS) {
    if (w !== STEPS[0]) {
      await page.evaluate((width) => {
        for (const cell of document.querySelectorAll("[data-resize-lab]")) {
          cell.style.width = `${width}px`;
        }
      }, w);
      // > 10ms debounce + RO tick; generous because we prove SETTLED
      // correctness across resizes, not mid-debounce frames.
      await page.waitForTimeout(1500);
    }
    const snap = await page.evaluate((stepW) => {
      const cells = [];
      for (const cell of document.querySelectorAll("[data-resize-lab]")) {
        const [impl, chart] = (cell.getAttribute("data-resize-lab") ?? ":").split(":");
        const svg = cell.querySelector("svg");
        if (!svg) {
          cells.push({ impl, chart, error: "no-svg" });
          continue;
        }
        const r = svg.getBoundingClientRect();
        const inner = cell.querySelector("div");
        const ir = inner ? Math.round(inner.getBoundingClientRect().width) : -1;
        cells.push({ impl, chart, svgW: Math.round(r.width), svgH: Math.round(r.height), containerW: ir });
      }
      return { stepW, cells };
    }, w);
    results.push(snap);
    console.log(`\n=== cell width ${snap.stepW}px ===`);
    for (const c of snap.cells) {
      console.log(`  ${String(c.impl).padEnd(8)} ${String(c.chart).padEnd(5)} container=${c.containerW} svg=${c.svgW}x${c.svgH}`);
    }
  }

  // Parity verdict: per step, per chart — impls agree AND svg tracks the
  // commanded cell width within tolerance (padding/borders account for a
  // few px; anything beyond that means a stale measurement).
  console.log("\n=== parity ===");
  let ok = true;
  for (const { stepW, cells } of results) {
    for (const chart of ["pie", "radar", "ring"]) {
      const a = cells.find((c) => c.chart === chart && c.impl === "bklit");
      const b = cells.find((c) => c.chart === chart && c.impl === "migrated");
      if (!a || !b || a.error || b.error) {
        console.log(`  FAIL ${chart}@${stepW}: missing/error cell`);
        ok = false;
        continue;
      }
      const agree = a.svgW === b.svgW && a.svgH === b.svgH;
      const tol = 12;
      const tracks =
        Math.abs(a.svgW - stepW) <= tol && Math.abs(b.svgW - stepW) <= tol &&
        Math.abs(a.svgH - stepW) <= tol && Math.abs(b.svgH - stepW) <= tol;
      const status = agree && tracks ? "ok" : "FAIL";
      if (status === "FAIL") ok = false;
      console.log(`  ${status.toUpperCase()} ${chart}@${stepW}: bklit ${a.svgW}x${a.svgH} vs migrated ${b.svgW}x${b.svgH} (target ${stepW})`);
    }
  }
  console.log(ok ? "\nRESIZE PROBE: ALL OK" : "\nRESIZE PROBE: FAILURES PRESENT");

  await browser.close();
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error("PROBE ERROR:", err.message);
  process.exit(1);
});
