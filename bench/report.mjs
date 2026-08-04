#!/usr/bin/env node
// bench/report.mjs — reads ALL run files under bench/results/<timestamp>/results.json
// (every run the harness has ever produced, not just `latest.json`), merges them
// per (impl, chart, n) combo -- newest run wins -- and renders the per-chart
// comparison tables into docs/BENCHMARKS.md, between the
// `<!-- BEGIN/END GENERATED BENCHMARK TABLES -->` markers. Everything outside
// those markers (the hand-authored header, metric/gate docs) is left untouched.
//
// Usage:
//   node bench/report.mjs                       # scan bench/results/*/results.json
//   node bench/report.mjs path/to/some/dir       # scan <dir>/*/results.json instead
//
// Why "all runs" instead of just latest.json: bench/run.mjs is typically
// invoked per (impl, chart, n) combo (see its `--chart/--impl/--n` usage), so
// a full baseline matrix is built up over MANY separate run directories, each
// overwriting `latest.json` with only that invocation's result(s). Reading
// every `bench/results/<timestamp>/results.json` and keeping the newest value
// per combo is the only way to see the full matrix in one report.

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const BEGIN = "<!-- BEGIN GENERATED BENCHMARK TABLES -->";
const END = "<!-- END GENERATED BENCHMARK TABLES -->";

const RESULTS_DIR = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(ROOT, "bench", "results");

// Row order within a chart's table. "migrated" is only ever emitted when data
// for it actually exists (research/04: "The migrated column is filled in
// during Phases 1-2").
const IMPL_ORDER = ["bklit", "tanstack", "migrated"];
const ALWAYS_SHOWN_IMPLS = ["bklit", "tanstack"];

// ---------------------------------------------------------------------- //
// Load + merge all run files (newest value wins per impl/chart/n combo)
// ---------------------------------------------------------------------- //

function loadAllRunFiles(resultsDir) {
  let entries;
  try {
    entries = readdirSync(resultsDir, { withFileTypes: true });
  } catch {
    return [];
  }
  const runDirNames = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort(); // run dirs are named from `new Date().toISOString()`, so this is
             // already chronological, but we re-sort by parsed timestamp below
             // to be robust against clock skew / manual copies.

  const runs = [];
  for (const dirName of runDirNames) {
    const filePath = path.join(resultsDir, dirName, "results.json");
    try {
      const payload = JSON.parse(readFileSync(filePath, "utf-8"));
      runs.push({ dirName, filePath, payload });
    } catch {
      // Skip unreadable/malformed run directories rather than fail the whole
      // report -- a single corrupt run shouldn't block reporting on the rest.
    }
  }

  runs.sort((a, b) => {
    const ta = Date.parse(a.payload.timestamp ?? "");
    const tb = Date.parse(b.payload.timestamp ?? "");
    const va = Number.isFinite(ta) ? ta : a.dirName;
    const vb = Number.isFinite(tb) ? tb : b.dirName;
    return va < vb ? -1 : va > vb ? 1 : 0;
  });
  return runs;
}

function comboKey(r) {
  return `${r.impl}|${r.chart}|${r.n}`;
}

/**
 * Merges every run's `results` (successes) and `skipped` (failures) into a
 * single per-combo timeline, keeping only the most recent event for each
 * (impl, chart, n) combo -- regardless of whether that latest event was a
 * success or a skip. Runs are iterated oldest -> newest so a later
 * `Map.set` for the same key always overwrites an earlier one.
 */
function mergeRuns(runs) {
  const latestByKey = new Map(); // key -> { type: "result"|"skip", data, ts, dirName }

  for (const run of runs) {
    const ts = run.payload.timestamp;
    for (const r of run.payload.results ?? []) {
      latestByKey.set(comboKey(r), { type: "result", data: r, ts, dirName: run.dirName });
    }
    for (const s of run.payload.skipped ?? []) {
      latestByKey.set(comboKey(s), { type: "skip", data: s, ts, dirName: run.dirName });
    }
  }

  const results = [];
  const skipped = [];
  for (const entry of latestByKey.values()) {
    if (entry.type === "result") results.push(entry);
    else skipped.push(entry);
  }
  return { results, skipped };
}

// ---------------------------------------------------------------------- //
// Formatting helpers
// ---------------------------------------------------------------------- //

function fmtMs(v) {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return Number(v).toFixed(1);
}

function fmtHeapMB(bytes) {
  if (bytes === null || bytes === undefined || Number.isNaN(bytes)) return "—";
  return (Number(bytes) / (1024 * 1024)).toFixed(2);
}

function fmtKb(bytes) {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) return "—";
  return (Number(bytes) / 1024).toFixed(1);
}

function fmtRatio(v) {
  if (v === null || v === undefined || !Number.isFinite(v)) return "n/a";
  return `${v.toFixed(2)}x`;
}

// ---------------------------------------------------------------------- //
// Table rendering
// ---------------------------------------------------------------------- //

function rowCells(entry) {
  const r = entry.data;
  const m = r.metrics;
  return {
    m1a: fmtMs(m.m1a_mountToPaintMs?.median),
    m1b: fmtMs(m.m1b_settleMs?.median),
    m1cScript: fmtMs(m.m1c_scriptMs?.median),
    m2aIdleScript: fmtMs(m.m2a_idleScriptMs?.median),
    m2bHeapMB: fmtHeapMB(m.m2b_heapUsedBytes?.median),
    m3aMedian: fmtMs(m.m3a_updateMs?.median),
    m3aP95: fmtMs(m.m3a_updateMs?.p95),
    m3cMedian: fmtMs(m.m3c_frameTimeMs?.median),
    m3cWorst: fmtMs(m.m3c_frameTimeMs?.worst),
    tooltip:
      m.m3c_tooltipAppeared === true ? "yes" : m.m3c_tooltipAppeared === false ? "NO" : "—",
    consoleErrors: r.consoleErrorCount ?? 0,
    m2cBundleGzipKb: fmtKb(m.m2c_bundleCost?.gzip),
    sourceRun: entry.dirName,
  };
}

function tableForChart(chart, resultEntries) {
  const ns = [...new Set(resultEntries.map((e) => e.data.n))].sort((a, b) => a - b);
  const implsPresent = new Set(resultEntries.map((e) => e.data.impl));
  const implsForTable = IMPL_ORDER.filter(
    (impl) => ALWAYS_SHOWN_IMPLS.includes(impl) || implsPresent.has(impl),
  );

  const lines = [];
  lines.push(`### ${chart[0].toUpperCase()}${chart.slice(1)}`);
  lines.push("");
  lines.push(
    "| n | impl | M1a mount→paint (ms) | M1b settle (ms) | M1c mount script (ms) | M2a idle script/5s (ms) | M2b heap (MB) | M3a update median/p95 (ms) | M3c hover median/worst frame (ms) | tooltip | M2c gzip (kB) | console errors | source run |",
  );
  lines.push("|---|---|---|---|---|---|---|---|---|---|---|---|---|---|");

  const byKey = new Map(resultEntries.map((e) => [comboKey(e.data), e]));

  for (const n of ns) {
    for (const impl of implsForTable) {
      const entry = byKey.get(`${impl}|${chart}|${n}`);
      if (!entry) {
        lines.push(`| ${n} | ${impl} | (not run) | | | | | | | | | | | |`);
        continue;
      }
      const c = rowCells(entry);
      lines.push(
        `| ${n} | ${impl} | ${c.m1a} | ${c.m1b} | ${c.m1cScript} | ${c.m2aIdleScript} | ${c.m2bHeapMB} | ${c.m3aMedian} / ${c.m3aP95} | ${c.m3cMedian} / ${c.m3cWorst} | ${c.tooltip} | ${c.m2cBundleGzipKb} | ${c.consoleErrors} | ${c.sourceRun} |`,
      );
    }

    // Delta line: tanstack vs bklit ratio for the three north-star metrics
    // (research/05 G1/G2 -- M1a, M3a, M3c). Ratio < 1 means tanstack is
    // faster/lower than bklit on that metric (the expected direction, since
    // tanstack is the performance ceiling `T` in the gate math).
    const bklit = byKey.get(`bklit|${chart}|${n}`)?.data.metrics;
    const tanstack = byKey.get(`tanstack|${chart}|${n}`)?.data.metrics;
    const ratio = (bv, tv) => (bv && tv && bv !== 0 ? tv / bv : null);
    const m1aRatio = ratio(bklit?.m1a_mountToPaintMs?.median, tanstack?.m1a_mountToPaintMs?.median);
    const m3aRatio = ratio(bklit?.m3a_updateMs?.median, tanstack?.m3a_updateMs?.median);
    const m3cRatio = ratio(bklit?.m3c_frameTimeMs?.median, tanstack?.m3c_frameTimeMs?.median);
    lines.push(
      `_n=${n} delta (tanstack / bklit): M1a ${fmtRatio(m1aRatio)} · M3a ${fmtRatio(m3aRatio)} · M3c median ${fmtRatio(m3cRatio)}_`,
    );
    lines.push("");
  }

  return lines.join("\n");
}

function skippedSection(skippedEntries) {
  if (!skippedEntries || skippedEntries.length === 0) return "";
  const lines = ["### Skipped combinations", ""];
  lines.push("| impl | chart | n | reason | source run |");
  lines.push("|---|---|---|---|---|");
  for (const entry of skippedEntries) {
    const s = entry.data;
    const reason = String(s.reason ?? "").replace(/\|/g, "\\|");
    lines.push(`| ${s.impl} | ${s.chart} | ${s.n} | ${reason} | ${entry.dirName} |`);
  }
  lines.push("");
  return lines.join("\n");
}

// ---------------------------------------------------------------------- //
// Metadata (run provenance) section
// ---------------------------------------------------------------------- //

function metadataSection(runs) {
  if (runs.length === 0) {
    return "_(no run directories found under bench/results/)_\n";
  }
  const oldest = runs[0];
  const newest = runs[runs.length - 1];
  const chromiumVersions = [...new Set(runs.map((r) => r.payload.chromium).filter(Boolean))];
  const configs = runs.map((r) => JSON.stringify(r.payload.config ?? {}));
  const uniqueConfigs = [...new Set(configs)];

  const lines = [];
  lines.push(
    `_Report generated ${new Date().toISOString()} from **${runs.length} run file(s)** under \`bench/results/\` (oldest: ${oldest.payload.timestamp ?? oldest.dirName}, newest: ${newest.payload.timestamp ?? newest.dirName}). Per (impl, chart, n) combo, the value from the newest run that measured it wins._`,
  );
  lines.push("");
  lines.push(
    `_Chromium: ${chromiumVersions.length === 1 ? chromiumVersions[0] : chromiumVersions.join(", ") || "—"}._`,
  );
  if (uniqueConfigs.length === 1) {
    const cfg = runs[0].payload.config ?? {};
    lines.push(
      `_Run config (all runs): ${cfg.warmupRuns ?? 1} warmup + ${cfg.measuredRuns ?? 7} measured runs per combo, ${cfg.idleMs ?? "—"}ms idle window (M2a), ${cfg.updateTicks ?? "—"} update ticks (M3a), ${cfg.hoverSteps ?? "—"} hover sweep steps (M3c)._`,
    );
  } else {
    lines.push(
      `_Run config varied across merged runs (${uniqueConfigs.length} distinct configs seen) -- see each row's "source run" column and cross-reference \`bench/results/<that dir>/results.json\`'s \`config\` field._`,
    );
  }
  lines.push("");
  lines.push(
    "Units: ms unless noted (1 decimal). M2b heap in MB (2 decimals). M1c/M2a report `ScriptDuration` deltas from CDP `Performance.getMetrics` (V8 execution time only -- `TaskDuration` is available in the raw JSON but omitted from this table for brevity). M2b is `Runtime.getHeapUsage().usedSize` after forced GC. M3c frame times are inter-`requestAnimationFrame` deltas measured during the hover sweep; \"worst\" is the max across all measured runs contributing to that cell.",
  );
  lines.push("");
  lines.push(
    "M2c (bundle cost) is measured separately by `bench/measure-bundle.mjs`; run `pnpm bench:bundles` to regenerate the gzip data. M3b (sustained update throughput / live-data FPS) is live-charts only (currently `liveline`); other charts show `n/a`. M3d (brush/drag) is **stubbed** in the underlying harness (not applicable to the current migrated chart set).",
  );
  lines.push("");
  return lines.join("\n");
}

// ---------------------------------------------------------------------- //
// Main
// ---------------------------------------------------------------------- //

const runs = loadAllRunFiles(RESULTS_DIR);
const { results, skipped } = mergeRuns(runs);

const out = [];
out.push(metadataSection(runs));

if (results.length === 0) {
  out.push("_(empty — no benchmark runs yet)_");
} else {
  const charts = [...new Set(results.map((e) => e.data.chart))].sort();
  for (const chart of charts) {
    const chartEntries = results.filter((e) => e.data.chart === chart);
    out.push(tableForChart(chart, chartEntries));
  }
  const skippedMd = skippedSection(skipped);
  if (skippedMd) out.push(skippedMd);
}

const generated = out.join("\n").trimEnd() + "\n";

const docPath = path.join(ROOT, "docs", "BENCHMARKS.md");
const doc = readFileSync(docPath, "utf-8");
const beginIdx = doc.indexOf(BEGIN);
const endIdx = doc.indexOf(END);
if (beginIdx === -1 || endIdx === -1 || endIdx < beginIdx) {
  throw new Error(`docs/BENCHMARKS.md is missing the ${BEGIN} / ${END} markers`);
}

const before = doc.slice(0, beginIdx + BEGIN.length);
const after = doc.slice(endIdx);
const updated = `${before}\n\n${generated}\n${after}`;

writeFileSync(docPath, updated);
console.log(
  `[report] merged ${runs.length} run file(s) -> ${results.length} result row(s), ${skipped.length} skipped row(s) -> wrote ${docPath}`,
);
