#!/usr/bin/env node
// P4.6 scratch: funnel settle diagnostics across sizes and impls.
// bklit funnel is untouched by P4.6 edits — it is the control.
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
  for (const impl of ["migrated", "bklit"]) {
    for (const n of [5, 100, 1000]) {
      const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
      const errors = [];
      page.on("pageerror", (e) => errors.push("PAGEERROR: " + String(e).split("\n")[0]));
      page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 90)); });
      const t0 = Date.now();
      await page.goto(`${BASE}/?impl=${impl}&chart=funnel&n=${n}`, { waitUntil: "commit" });
      let paintDone = false, settledExists = false, segCount = 0;
      try {
        await page.waitForFunction(() => window.__benchPaintDone === true, null, { timeout: 30000 });
        paintDone = true;
      } catch {}
      const mid = Date.now();
      try {
        await page.waitForFunction(() => !!window.__benchSettled, null, { timeout: 8000 });
        settledExists = true;
      } catch {}
      segCount = await page.evaluate(() => document.querySelectorAll("#chart-root *").length).catch(() => -1);
      console.log(
        `${impl} n=${String(n).padStart(4)}: paintDone=${paintDone} (${mid - t0}ms) settledExists=${settledExists} domNodes=${segCount} errors=${errors.length}${errors.length ? " first: " + errors[0] : ""}`
      );
      await page.close();
    }
  }
  await browser.close();
} finally {
  server.kill("SIGTERM");
}
