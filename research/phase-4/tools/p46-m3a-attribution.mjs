#!/usr/bin/env node
// P4.6 item-2 scratch probe (NOT part of the protected harness).
//
// Attributes migrated/scatter n=1000 M3a update cost:
//   - per-tick wall times (same loop shape as bench/run.mjs M3a)
//   - CDP CPU profile aggregated by function/file bucket (script-side share)
//   - Long Animation Frames entries (script vs style/layout/paint share)
//
// Usage: node research/phase-4/tools/p46-m3a-attribution.mjs
// Requires bench/app/dist to exist (served via vite preview; never rebuilt here).

import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const APP_DIR = path.join(ROOT, "bench", "app");
const PORT = 5197;
const BASE = `http://localhost:${PORT}`;
const TICKS = 30;

const server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], {
  cwd: APP_DIR,
  stdio: ["ignore", "pipe", "pipe"],
});
async function waitForServer() {
  for (let i = 0; i < 120; i++) {
    try {
      const res = await fetch(BASE);
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("preview server never came up");
}

function aggProfile(profile) {
  const nodes = new Map(profile.nodes.map((n) => [n.id, n]));
  const selfMicros = new Map();
  const deltas = profile.timeDeltas ?? [];
  (profile.samples ?? []).forEach((id, i) => {
    const dt = deltas[i] ?? 0;
    if (dt <= 0) return;
    selfMicros.set(id, (selfMicros.get(id) ?? 0) + dt);
  });
  const rows = [];
  let total = 0;
  for (const [id, us] of selfMicros) {
    const n = nodes.get(id);
    if (!n) continue;
    const f = n.callFrame;
    const url = f.url || "(native)";
    total += us;
    rows.push({ name: f.functionName || "(anonymous)", url, us });
  }
  // Buckets by meaningful file segment.
  const buckets = new Map();
  const bucketOf = (url) => {
    if (url.includes("react-dom")) return "react-dom";
    if (url.includes("react")) return "react(other)";
    if (url.includes("charts-core/src")) {
      const m = url.match(/charts-core\/src\/([a-z-]+)\./);
      return `tanstack:${m ? m[1] : "other"}`;
    }
    if (url.includes("migrated/charts")) {
      const m = url.match(/migrated\/charts\/(.+?\.[jt]sx?)/);
      return `migrated:${m ? m[1].replace(/\.tsx?$/, "") : "other"}`;
    }
    if (url.includes("d3-")) return "d3-scale/shape";
    return "other(bundled)";
  };
  const byBucket = new Map();
  for (const r of rows) {
    const b = bucketOf(r.url);
    byBucket.set(b, (byBucket.get(b) ?? 0) + r.us);
  }
  rows.sort((a, b) => b.us - a.us);
  const top = rows.slice(0, 40).map((r) => ({
    ms: +(r.us / 1000).toFixed(2),
    fn: r.name,
    file: r.url.split("/").slice(-1)[0],
  }));
  const bucketsObj = Object.fromEntries(
    [...byBucket.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, +(v / 1000).toFixed(2)])
  );
  return { totalMs: +(total / 1000).toFixed(1), bucketsObj, top };
}

try {
  await waitForServer();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  await page.goto(`${BASE}/?impl=migrated&chart=scatter&n=1000`);
  await page.waitForFunction(() => window.__benchPaintDone === true, null, { timeout: 30000 });
  await page.evaluate(() => window.__benchSettled);

  // LoAF recorder (covers the update window only).
  await page.evaluate(() => {
    window.__loaf = [];
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) {
        window.__loaf.push({
          dur: e.duration,
          style: e.styleDuration,
          layout: e.layoutDuration,
          paint: e.paintDuration,
          script: e.scriptDuration,
        });
      }
    }).observe({ type: "long-animation-frame", buffered: false });
  });

  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Profiler.enable");
  await cdp.send("Profiler.setSamplingInterval", { interval: 100 }); // µs
  await cdp.send("Profiler.start");

  const ticks = [];
  for (let i = 0; i < TICKS; i++) {
    ticks.push(await page.evaluate(() => window.__benchUpdate()));
  }

  const { profile } = await cdp.send("Profiler.stop");

  const sorted = [...ticks].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  console.log("per-tick ms:", ticks.map((t) => t.toFixed(1)).join(", "));
  console.log(`median ${median.toFixed(2)} ms  min ${sorted[0].toFixed(2)}  max ${sorted.at(-1).toFixed(2)}`);

  const loaf = await page.evaluate(() => window.__loaf.splice(0));
  const loafLong = loaf.filter((e) => e.dur >= 20);
  const sum = (arr, k) => arr.reduce((a, e) => a + (e[k] ?? 0), 0);
  console.log(`\nLoAF >=20ms frames: ${loafLong.length}`);
  if (loafLong.length) {
    console.log(
      `mean per long frame: total ${(sum(loafLong, "dur") / loafLong.length).toFixed(1)}ms | script ${(sum(loafLong, "script") / loafLong.length).toFixed(1)} | style ${(sum(loafLong, "style") / loafLong.length).toFixed(2)} | layout ${(sum(loafLong, "layout") / loafLong.length).toFixed(2)} | paint ${(sum(loafLong, "paint") / loafLong.length).toFixed(2)}`
    );
  }
  const agg = aggProfile(profile);
  console.log(`\nCPU profile total (sampled): ${agg.totalMs} ms`);
  console.log("\nSelf-time by bucket (ms):");
  for (const [k, v] of Object.entries(agg.bucketsObj)) console.log(`  ${k}: ${v}`);
  console.log("\nTop self-time functions:");
  for (const t of agg.top) console.log(`  ${String(t.ms).padStart(8)} ms  ${t.fn}  (${t.file})`);

  mkdirSync(path.join(ROOT, "research/phase-4/tools/out"), { recursive: true });
  writeFileSync(
    path.join(ROOT, "research/phase-4/tools/out/p46-scatter-m3a-cpu.json"),
    JSON.stringify({ ticks, median, loaf, agg }, null, 2)
  );

  await browser.close();
} finally {
  server.kill("SIGTERM");
}
