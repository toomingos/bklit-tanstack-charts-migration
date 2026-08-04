#!/usr/bin/env node

/**
 * Sync script: reads docs/BENCHMARKS.md, parses structured benchmark data,
 * and writes showcase/lib/benchmark-data.ts.
 *
 * Usage: node scripts/sync-data.mjs   (from showcase/ or repo root)
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// Resolve paths relative to this script
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../..");
const BENCH_PATH = resolve(ROOT, "docs/BENCHMARKS.md");
const OUT_PATH = resolve(__dirname, "../lib/benchmark-data.ts");

// Headings to skip (variant tables; their data maps to the parent chart)
const SKIP_HEADINGS = new Set(["funnelvertical", "gaugelinear"]);

// Parse a markdown table cell value to a number, handling "(not run)" and "n/a"
function parseCell(raw) {
  const s = raw.trim();
  if (!s || s === "(not run)" || s === "n/a" || s === "—") return null;
  return parseFloat(s);
}

// Parse M3a/M3c cells: "31.7 / 33.5" → first number (31.7)
function parsePair(raw) {
  const s = raw.trim();
  if (!s || s === "(not run)" || s === "n/a" || s === "—") return null;
  const first = s.split("/")[0].trim();
  if (!first) return null;
  return parseFloat(first);
}

// Read the benchmarks file
const content = readFileSync(BENCH_PATH, "utf-8");
const lines = content.split("\n");

/** @type {Map<string, { sizes: Set<number>, rows: { n: number, impl: string, m1a: number|null, m1c: number|null, m2a: number|null, m2b: number|null, m3a: number|null, m3c: number|null }[] }>} */
const charts = new Map();
let currentChart = null;
let inSkippedCombinations = false;
let pastGeneratedMarker = false;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  // Only start parsing after the generated tables marker
  if (!pastGeneratedMarker) {
    if (line.includes("<!-- BEGIN GENERATED BENCHMARK TABLES -->")) {
      pastGeneratedMarker = true;
    }
    continue;
  }

  // Detect headings
  const headingMatch = line.match(/^### (.+)$/);
  if (headingMatch) {
    const name = headingMatch[1].trim();
    const lower = name.toLowerCase();
    if (lower === "skipped combinations") {
      inSkippedCombinations = true;
      currentChart = null;
      continue;
    }
    // Skip non-chart headings (metric definitions etc.)
    if (lower.startsWith("m1") || lower.startsWith("m2") || lower.startsWith("m3") ||
        lower === "results" || lower === "benchmark gates") {
      currentChart = null;
      continue;
    }
    inSkippedCombinations = false;
    if (SKIP_HEADINGS.has(lower)) {
      currentChart = null;
      continue;
    }
    // Map heading to route: lowercase the heading name
    const route = lower;
    if (!charts.has(route)) {
      charts.set(route, { sizes: new Set(), rows: [] });
    }
    currentChart = route;
    continue;
  }

  if (inSkippedCombinations) continue;
  if (!currentChart) continue;

  // Parse table rows: | n | impl | M1a | M1b | M1c | M2a | M2b | M3a | M3c | tooltip | M2c | console errors | source run |
  // Skip separator rows (contain only |---|---|---...)
  if (line.startsWith("|") && !/^\|[\s-]+\|/.test(line)) {
    const cells = line.split("|");
    // Expect 14 cells (first empty): index 0=empty, 1=n, 2=impl, 3=M1a, 4=M1b, 5=M1c, 6=M2a, 7=M2b, 8=M3a, 9=M3c
    if (cells.length < 10) continue;

    const nRaw = cells[1].trim();
    const impl = cells[2].trim();
    const m1aRaw = cells[3].trim();
    const m1cRaw = cells[5].trim();
    const m2aRaw = cells[6].trim();
    const m2bRaw = cells[7].trim();
    const m3aRaw = cells[8].trim();
    const m3cRaw = cells[9].trim();

    // Skip if n doesn't look like a number (separator rows, delta rows, etc.)
    const n = parseInt(nRaw, 10);
    if (isNaN(n)) continue;

    // Skip if impl is not a known impl
    if (!["bklit", "tanstack", "migrated"].includes(impl)) continue;

    // Skip if the row is "(not run)"
    if (m1aRaw === "(not run)") continue;

    const m1a = parseCell(m1aRaw);
    const m1c = parseCell(m1cRaw);
    const m2a = parseCell(m2aRaw);
    const m2b = parseCell(m2bRaw);
    const m3a = parsePair(m3aRaw);
    const m3c = parsePair(m3cRaw);

    const chart = charts.get(currentChart);
    chart.sizes.add(n);
    chart.rows.push({ n, impl, m1a, m1c, m2a, m2b, m3a, m3c });
  }
}

// Build the output structure
/** @type {Record<string, { sizes: number[], bySize: Record<number, { bklit?: object, tanstack?: object, migrated?: object }> }>} */
const output = {};

let totalRows = 0;
for (const [route, chart] of charts) {
  const sizes = [...chart.sizes].sort((a, b) => a - b);
  /** @type {Record<number, any>} */
  const bySize = {};

  for (const n of sizes) {
    /** @type {any} */
    const entry = {};
    const rowsForSize = chart.rows.filter((r) => r.n === n);
    for (const row of rowsForSize) {
      totalRows++;
      entry[row.impl] = {
        m1a: row.m1a,
        m1c: row.m1c,
        m2a: row.m2a,
        m2b: row.m2b,
        m3a: row.m3a,
        m3c: row.m3c,
      };
    }
    bySize[n] = entry;
  }

  output[route] = { sizes, bySize };
}

// Generate the TypeScript file
const outLines = [];
outLines.push(`// GENERATED by scripts/sync-data.mjs — do not hand-edit
// Source: docs/BENCHMARKS.md

export interface ImplMetrics {
  m1a: number | null;
  m1c: number | null;
  m2a: number | null;
  m2b: number | null;
  m3a: number | null;
  m3c: number | null;
}

export interface SizeBench {
  bklit?: ImplMetrics;
  tanstack?: ImplMetrics;
  migrated?: ImplMetrics;
}

export interface ChartBench {
  sizes: number[];
  bySize: Record<number, SizeBench>;
}

export const benchmarkData: Record<string, ChartBench> = {
`);

const entries = Object.entries(output).sort(([a], [b]) => a.localeCompare(b));
for (const [route, chart] of entries) {
  outLines.push(`  ${JSON.stringify(route)}: {`);
  outLines.push(`    sizes: ${JSON.stringify(chart.sizes)},`);
  outLines.push(`    bySize: {`);
  for (const n of chart.sizes) {
    const entry = chart.bySize[n];
    const compact = {};
    for (const impl of ["bklit", "tanstack", "migrated"]) {
      if (entry[impl]) {
        const m = entry[impl];
        compact[impl] = {
          m1a: m.m1a,
          m1c: m.m1c,
          m2a: m.m2a,
          m2b: m.m2b,
          m3a: m.m3a,
          m3c: m.m3c,
        };
      }
    }
    outLines.push(`      ${JSON.stringify(n)}: ${JSON.stringify(compact).replace(/"([^"]+)":/g, "$1:")},`);
  }
  outLines.push(`    },`);
  outLines.push(`  },`);
}

outLines.push(`};`);
outLines.push("");

const outputStr = outLines.join("\n");
writeFileSync(OUT_PATH, outputStr, "utf-8");

console.log(`✅ Synced ${charts.size} charts, ${totalRows} total rows → ${OUT_PATH}`);
console.log(`   Charts: ${[...charts.keys()].sort().join(", ")}`);

// Sanity print per-chart row counts
for (const [route, chart] of [...charts].sort(([a], [b]) => a.localeCompare(b))) {
  const rowCount = chart.rows.length;
  const sizesSorted = [...chart.sizes].sort((a, b) => a - b);
  const sizes = sizesSorted.join(", ");
  const hasMigrated = chart.rows.some((r) => r.impl === "migrated");
  console.log(`   ${route}: ${rowCount} rows, sizes=[${sizes}], migrated=${hasMigrated}`);
}
