#!/usr/bin/env node
// P4.6 item-2 scratch probe #2: does the mount reveal REPLAY on data swaps?
// Counts Element.prototype.animate() invocations per __benchUpdate() tick and
// checks whether the .ts-chart__marks group node identity survives ticks.
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const APP_DIR = path.join(ROOT, "bench", "app");
const PORT = 5197;
const BASE = `http://localhost:${PORT}`;
const TICKS = 12;

const server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], {
  cwd: APP_DIR,
  stdio: ["ignore", "pipe", "pipe"],
});
async function waitForServer() {
  for (let i = 0; i < 120; i++) {
    try { const res = await fetch(BASE); if (res.ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("preview server never came up");
}

try {
  await waitForServer();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  await page.goto(`${BASE}/?impl=migrated&chart=scatter&n=1000`);
  await page.waitForFunction(() => window.__benchPaintDone === true, null, { timeout: 30000 });
  await page.evaluate(() => window.__benchSettled);

  const setup = await page.evaluate(() => {
    let count = 0;
    const perTick = [];
    const orig = Element.prototype.animate;
    Element.prototype.animate = function (...args) {
      count++;
      return orig.apply(this, args);
    };
    window.__animProbe = {
      get count() { return count; },
      reset() { perTick.push(count); count = 0; },
      perTick,
    };
    const g = document.querySelector("#chart-root svg g.ts-chart__marks");
    return { marksGroupFound: !!g, guardValue: g ? g.dataset.bkmRevealed ?? null : null };
  });
  console.log("setup:", JSON.stringify(setup));

  for (let i = 0; i < TICKS; i++) {
    const dur = await page.evaluate(() => window.__benchUpdate());
    await page.evaluate(() => window.__animProbe.reset());
    console.log(`tick ${i + 1}: ${dur.toFixed(1)} ms`);
  }
  const summary = await page.evaluate(() => ({
    perTick: window.__animProbe.perTick,
    leakedLast: window.__animProbe.count,
    marksGroupNow: !!document.querySelector("#chart-root svg g.ts-chart__marks"),
    guardNow: document.querySelector("#chart-root svg g.ts-chart__marks")?.dataset.bkmRevealed ?? null,
  }));
  console.log("summary:", JSON.stringify(summary));
  await browser.close();
} finally {
  server.kill("SIGTERM");
}
