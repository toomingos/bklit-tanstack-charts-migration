// Bench gate driver (wraps protected bench/run.mjs). Boots one vite preview on :5199, builds dist once.
//   pnpm gate:bench [-- --cells paired|all|subset|<impl/chart/n,...> --no-build --run-dir <dir>]
//   paired (default): 10 exclusive paired cells of BASELINE §3b; one harness process per cell, re-reading
//     bench/results/latest.json after each (the harness overwrites it with only the last invocation).
//   all: the harness's own --all 24-cell matrix (bklit+tanstack) PLUS the 5 migrated cells. subset: 2-cell smoke.
// Output: bench.json + bench.md vs qa/gate/bench-baseline.json (% delta, D273 ±20% flag on M1b/M1c/M3a; M1a void).
import { writeFileSync } from "node:fs";
import path from "node:path";
import {
  BENCH_PORT,
  BENCH_RESULTS_DIR,
  ROOT,
  RUNS_DIR,
  buildDistOnce,
  ensureDir,
  fmtMs,
  log,
  mdTable,
  nowStamp,
  parseArgs,
  publishLatest,
  readJson,
  relPath,
  runCmd,
  startPreview,
  waitForQuietProcessTable,
  writeJson,
} from "./lib.mjs";

const TAG = "[gate:bench]";
const BASELINE_FILE = path.join(ROOT, "qa", "gate", "bench-baseline.json");
const PAIRED = [
  "bklit/line/1000", "migrated/line/1000",
  "bklit/area/1000", "migrated/area/1000",
  "bklit/composed/1000", "migrated/composed/1000",
  "bklit/bar/100", "migrated/bar/100",
  "bklit/scatter/1000", "migrated/scatter/1000",
];
const MIGRATED = PAIRED.filter((c) => c.startsWith("migrated/"));
const SUBSET = ["migrated/line/1000", "migrated/bar/100"];

const METRICS = [
  ["m1a_mountToPaintMs", "M1a mount→paint", "median"],
  ["m1b_settleMs", "M1b settle", "median"],
  ["m1c_scriptMs", "M1c script", "median"],
  ["m1c_taskMs", "M1c task", "median"],
  ["m3a_updateMs", "M3a update", "median"],
  ["m3c_perMoveScriptMs", "M3c per-move script", "median"],
  ["m3c_frameTimeMs", "M3c frame", "median"],
  ["m2b_heapUsedBytes", "heap", "median"],
];

function medianOf(m) {
  if (m == null) return null;
  if (typeof m === "number") return m;
  return typeof m.median === "number" ? m.median : null;
}

export function compareBench(results, baseline) {
  const rows = [];
  for (const r of results) {
    const key = `${r.impl}/${r.chart}/${r.n}`;
    const base = baseline.cells[key] ?? null;
    for (const [metric, label] of METRICS) {
      const value = medianOf(r.metrics?.[metric]);
      const baseValue = base ? base[metric] : null;
      const gated = baseline.gatedMetrics.includes(metric);
      const delta = value != null && baseValue ? ((value - baseValue) / baseValue) * 100 : null;
      const flag = gated && delta != null && Math.abs(delta) > baseline.flagPct;
      rows.push({
        cell: key,
        impl: r.impl,
        chart: r.chart,
        n: r.n,
        metric,
        label,
        value: value != null ? Number(value.toFixed(2)) : null,
        baseline: baseValue,
        baselineSource: base ? base.source : null,
        deltaPct: delta != null ? Number(delta.toFixed(1)) : null,
        gated,
        flag,
        void: metric === "m1a_mountToPaintMs",
        samples: r.metrics?.[metric]?.n ?? null,
        p95: r.metrics?.[metric]?.p95 != null ? Number(r.metrics[metric].p95.toFixed(2)) : null,
      });
    }
    // GUARD: console-error baseline comes from the baseline cell (legacy bklit/bar at n>=1000 emits ~515k/1.54M
    // negative-<rect>-attribute errors since Phase-5 close); non-zero baselines flag past D273 tolerance, zero flags on any error.
    const errValue = r.consoleErrorCount ?? r.metrics?.consoleErrorCount ?? null;
    const errBase = base?.consoleErrorCount ?? 0;
    rows.push({ cell: key, impl: r.impl, chart: r.chart, n: r.n, metric: "consoleErrorCount", label: "console errors", value: errValue, baseline: errBase, baselineSource: base ? base.source : null, deltaPct: null, gated: true, flag: errBase > 0 ? (errValue ?? 0) > errBase * (1 + baseline.flagPct / 100) : (errValue ?? 0) > 0, void: false });
    // GUARD: tooltip baseline comes from the baseline cell (legacy bklit/line/1000 never satisfied the >=3-text-nodes signal); default true.
    const tipBase = base?.m3c_tooltipAppeared ?? true;
    rows.push({ cell: key, impl: r.impl, chart: r.chart, n: r.n, metric: "m3c_tooltipAppeared", label: "tooltip appeared", value: r.metrics?.m3c_tooltipAppeared ?? null, baseline: tipBase, baselineSource: base ? base.source : null, deltaPct: null, gated: true, flag: tipBase === true && r.metrics?.m3c_tooltipAppeared === false, void: false });
  }
  return rows;
}

export function benchToMd(bench) {
  const s = bench.summary;
  const head = [
    "# Bench gate",
    "",
    `Generated ${bench.generatedAt}. Cells: ${bench.cellsRequested.join(", ")}. Baseline: qa/gate/bench-baseline.json (${bench.baselineNote}).`,
    `Flag rule D273: |Δ| > ${bench.flagPct}% on M1b/M1c/M3a. M1a is a VOID channel on this machine (BASELINE §3b) — informational only.`,
    "",
    `**${s.cells} cells measured (${s.skipped} skipped), ${s.flags} flagged metric(s), ${s.consoleErrors} cell(s) with console errors, wall-clock ${fmtMs(s.wallClockMs)}.**`,
    "",
  ];
  const byCell = new Map();
  for (const r of bench.rows) {
    if (!byCell.has(r.cell)) byCell.set(r.cell, {});
    byCell.get(r.cell)[r.metric] = r;
  }
  const fmt = (r) => {
    if (!r || r.value == null) return "—";
    const v = r.metric === "m2b_heapUsedBytes" ? `${(r.value / 1048576).toFixed(1)} MB` : r.value;
    if (r.baseline == null || r.deltaPct == null) return `${v}`;
    const b = r.metric === "m2b_heapUsedBytes" ? `${(r.baseline / 1048576).toFixed(1)} MB` : r.baseline;
    return `${b} → ${v} (${r.deltaPct > 0 ? "+" : ""}${r.deltaPct}%)${r.flag ? " **‼**" : ""}`;
  };
  const rows = [...byCell.entries()].map(([cell, m]) => [
    cell,
    fmt(m.m1a_mountToPaintMs) + " (void)",
    fmt(m.m1b_settleMs),
    fmt(m.m1c_scriptMs),
    fmt(m.m3a_updateMs),
    fmt(m.m3c_perMoveScriptMs),
    fmt(m.m2b_heapUsedBytes),
    m.consoleErrorCount?.value ?? "—",
    m.m3c_tooltipAppeared?.value ?? "—",
  ]);
  return head.join("\n") + mdTable(["cell", "M1a", "M1b", "M1c", "M3a", "M3c/move", "heap", "console err", "tooltip"], rows) + "\n\nRun dirs: " + bench.runDirs.map((d) => `\`${d}\``).join(", ") + "\n";
}

export async function runBenchGate(opts = {}) {
  const runDir = ensureDir(opts.runDir ?? path.join(RUNS_DIR, nowStamp()));
  const logDir = ensureDir(path.join(runDir, "logs", "bench"));
  const baseline = readJson(BASELINE_FILE);
  const sel = opts.cells ?? "paired";
  let cells;
  let useAll = false;
  if (sel === "paired") cells = PAIRED;
  else if (sel === "subset") cells = SUBSET;
  else if (sel === "all") {
    useAll = true;
    cells = MIGRATED;
  } else cells = String(sel).split(",");

  await waitForQuietProcessTable(TAG, { abort: !!opts.noWait });
  const build = await buildDistOnce(TAG, { force: !!opts.forceBuild, skip: !!opts.noBuild, logFile: path.join(logDir, "build.log") });
  const preview = await startPreview(TAG, opts.port ?? BENCH_PORT, { logFile: path.join(logDir, "preview.log"), reuse: !!opts.reuseServer });
  const t0 = Date.now();
  const results = [];
  const skipped = [];
  const runDirs = [];
  const invocations = [];
  const collect = (label) => {
    const latest = readJson(path.join(BENCH_RESULTS_DIR, "latest.json"), null);
    if (!latest) return;
    results.push(...(latest.results ?? []));
    skipped.push(...(latest.skipped ?? []));
    const dir = path.join("bench", "results", latest.timestamp.replace(/[:.]/g, "-"));
    runDirs.push(dir);
    log(TAG, `${label}: ${latest.results?.length ?? 0} result(s), ${latest.skipped?.length ?? 0} skipped -> ${dir}`);
  };
  try {
    if (useAll) {
      log(TAG, `bench --all (24 cells) ...`);
      const r = await runCmd("node", ["bench/run.mjs", "--all", "--base-url", preview.url], { cwd: ROOT, env: { QA_SKIP_REBUILD: "1" }, logFile: path.join(logDir, "all.log") });
      invocations.push({ cell: "--all", exit: r.code, durationMs: r.durationMs, log: relPath(path.join(logDir, "all.log")) });
      log(TAG, `--all exit=${r.code} ${fmtMs(r.durationMs)}`);
      collect("--all");
    }
    for (const cell of cells) {
      const [impl, chart, n] = cell.split("/");
      const logFile = path.join(logDir, `${impl}-${chart}-${n}.log`);
      log(TAG, `bench ${cell} ...`);
      const r = await runCmd("node", ["bench/run.mjs", "--chart", chart, "--impl", impl, "--n", n, "--base-url", preview.url], { cwd: ROOT, env: { QA_SKIP_REBUILD: "1" }, logFile });
      invocations.push({ cell, exit: r.code, durationMs: r.durationMs, log: relPath(logFile) });
      log(TAG, `${cell} exit=${r.code} ${fmtMs(r.durationMs)}`);
      if (r.code === 0) collect(cell);
    }
  } finally {
    await preview.stop();
  }
  const rows = compareBench(results, baseline);
  const bench = {
    generatedAt: new Date().toISOString(),
    runDir: relPath(runDir),
    cellsRequested: useAll ? ["--all", ...cells] : cells,
    build,
    flagPct: baseline.flagPct,
    baselineNote: baseline.note,
    invocations,
    runDirs,
    skipped,
    summary: {
      cells: results.length,
      skipped: skipped.length,
      flags: rows.filter((r) => r.flag && r.metric !== "consoleErrorCount" && r.metric !== "m3c_tooltipAppeared").length,
      consoleErrors: rows.filter((r) => r.metric === "consoleErrorCount" && r.flag).length,
      tooltipMissing: rows.filter((r) => r.metric === "m3c_tooltipAppeared" && r.flag).length,
      failedInvocations: invocations.filter((i) => i.exit !== 0).length,
      wallClockMs: Date.now() - t0,
    },
    rows,
  };
  writeJson(path.join(runDir, "bench.json"), bench);
  writeFileSync(path.join(runDir, "bench.md"), benchToMd(bench));
  publishLatest([path.join(runDir, "bench.json"), path.join(runDir, "bench.md")]);
  log(TAG, `summary ${JSON.stringify(bench.summary)} -> ${relPath(runDir)}/bench.{json,md}`);
  return bench;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(ROOT, "qa", "gate", "run-bench.mjs");
if (isMain) {
  const a = parseArgs(process.argv.slice(2), { cells: "string", "run-dir": "string", "no-build": "bool", "force-build": "bool", "no-wait": "bool", "reuse-server": "bool", port: "number" });
  runBenchGate({ cells: a.cells, runDir: a["run-dir"], noBuild: a["no-build"], forceBuild: a["force-build"], noWait: a["no-wait"], reuseServer: a["reuse-server"], port: a.port })
    .then((b) => process.exit(b.summary.flags || b.summary.failedInvocations ? 1 : 0))
    .catch((e) => {
      console.error(e);
      process.exit(2);
    });
}
