#!/usr/bin/env node
// Orphan modules under showcase/migrated/charts/internal: files no other module under
// showcase/migrated/charts imports. Usage: node scripts/orphans.mjs [--json]
// Exit 1 when orphans exist (V0.4 gate: 0).
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHARTS = path.join(ROOT, "showcase", "migrated", "charts");
const INTERNAL = path.join(CHARTS, "internal");
const EXT = /\.(tsx?|css)$/;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (EXT.test(name)) out.push(p);
  }
  return out;
}

const files = walk(CHARTS);
const imported = new Set();
const importRe = /(?:from|import)\s*["']([^"']+)["']/g;
for (const f of files) {
  const src = readFileSync(f, "utf8");
  for (const m of src.matchAll(importRe)) {
    const spec = m[1];
    if (!spec.startsWith(".")) continue;
    const base = path.resolve(path.dirname(f), spec);
    for (const cand of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts"), path.join(base, "index.tsx")]) {
      if (files.includes(cand)) imported.add(cand);
    }
  }
}
const orphans = files
  .filter((f) => f.startsWith(INTERNAL) && !imported.has(f) && !/\.(test|spec)\.tsx?$/.test(f))
  .map((f) => path.relative(CHARTS, f))
  .sort();
if (process.argv.includes("--json")) console.log(JSON.stringify({ total: orphans.length, orphans }, null, 2));
else {
  console.log(`[orphans] ${orphans.length} orphan module(s) under showcase/migrated/charts/internal`);
  for (const o of orphans) console.log(`  ${o}`);
}
process.exit(orphans.length ? 1 : 0);
