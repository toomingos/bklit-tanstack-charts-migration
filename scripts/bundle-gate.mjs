#!/usr/bin/env node
// Bundle-size gate (Phase 6.5, M2c). Compares the latest
// bench/results/bundle-sizes.json (written by `pnpm bench:bundles`, i.e.
// bench/measure-bundle.mjs — esbuild, minified, gzip, entry = the scenario's
// default export so tree-shaking is real; see D462) against the pinned
// thresholds in bench/results/bundle-gate.json:
//   { "tolerancePct": 3, "scenarios": { "migrated/line": { "gzip": 150800 }, ... } }
// Fails when any pinned scenario's gzip exceeds pin * (1 + tolerancePct/100).
// Pins are lowered freely; raising one needs a D-entry in docs/phase-6/LOG.md.
// Usage: node scripts/bundle-gate.mjs [--sizes <path>] [--gate <path>]
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const opt = (flag, dflt) => { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] : dflt; };
const sizesPath = path.resolve(ROOT, opt("--sizes", "bench/results/bundle-sizes.json"));
const gatePath = path.resolve(ROOT, opt("--gate", "bench/results/bundle-gate.json"));

const sizes = JSON.parse(readFileSync(sizesPath, "utf8"));
const gate = JSON.parse(readFileSync(gatePath, "utf8"));
const tol = (gate.tolerancePct ?? 0) / 100;
const kb = (b) => (b / 1024).toFixed(1).padStart(7) + " kB";

let failed = 0;
const rows = [];
for (const [scenario, pin] of Object.entries(gate.scenarios ?? {})) {
  const cur = sizes[scenario];
  if (!cur) { rows.push(`  MISSING  ${scenario} (not in ${path.relative(ROOT, sizesPath)})`); failed++; continue; }
  const limit = Math.round(pin.gzip * (1 + tol));
  const delta = ((cur.gzip - pin.gzip) / pin.gzip) * 100;
  const ok = cur.gzip <= limit;
  if (!ok) failed++;
  rows.push(`  ${ok ? "ok  " : "FAIL"}  ${scenario.padEnd(24)} gzip ${kb(cur.gzip)}  pin ${kb(pin.gzip)}  limit ${kb(limit)}  ${delta >= 0 ? "+" : ""}${delta.toFixed(1)}%`);
}
console.log(`[bundle-gate] ${Object.keys(gate.scenarios ?? {}).length} pinned scenario(s), tolerance +${gate.tolerancePct ?? 0}%`);
for (const r of rows) console.log(r);
console.log(failed ? `[bundle-gate] FAILED (${failed})` : "[bundle-gate] OK");
process.exit(failed ? 1 : 0);
