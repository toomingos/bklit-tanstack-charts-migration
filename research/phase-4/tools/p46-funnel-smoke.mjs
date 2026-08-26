#!/usr/bin/env node
// P4.6 scratch smoke v2: funnel/funnelvertical runtime check after the
// prefersReducedMotion conversions. A broken hook order throws a pageerror
// on first render, so pageerror-free mount + reveal start is the signal.
// n=5/100 avoid the pre-existing degenerate-geometry console-error flood at
// n=1000 (bklit-identical, see p46-funnel-diag output).
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const APP_DIR = path.join(ROOT, "bench", "app");
const PORT = 5197;
const BASE = `http://localhost:${PORT}`;

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
  let failed = false;
  for (const chart of ["funnel", "funnelvertical"]) {
    for (const n of [5, 100]) {
      const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
      const pageErrors = [];
      page.on("pageerror", (e) => pageErrors.push(String(e).split("\n")[0]));
      await page.goto(`${BASE}/?impl=migrated&chart=${chart}&n=${n}`, { waitUntil: "commit" });
      await page.waitForFunction(() => window.__benchPaintDone === true, null, { timeout: 20000 }).catch(() => {});
      // Reveal effects fire on mount; give them a window to throw if broken.
      await page.waitForTimeout(2500);
      const nodes = await page.evaluate(() => document.querySelectorAll("#chart-root *").length).catch(() => 0);
      const ok = pageErrors.length === 0 && nodes > 0;
      console.log(`${chart} n=${n}: ${ok ? "OK" : "FAIL"} (domNodes=${nodes}, pageErrors=${pageErrors.length}${pageErrors.length ? ": " + pageErrors[0] : ""})`);
      if (!ok) failed = true;
      await page.close();
    }
  }
  await browser.close();
  process.exitCode = failed ? 1 : 0;
} finally {
  server.kill("SIGTERM");
}
