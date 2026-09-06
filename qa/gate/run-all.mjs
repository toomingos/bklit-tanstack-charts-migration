// Whole gate in one run dir: checks -> QA sweep (parallel) -> probes (opt-in) -> bench (sequential; CPU-sensitive)
// -> bundle -> SUMMARY.md, all published to qa/gate/latest (runs under docs/phase-7/gate/runs).
//   pnpm gate:all [-- --workers 4 --repeat 1 --bench paired|all|subset|none --bench-parallel --probes --skip-checks --charts a,b --label "..."]
import path from "node:path";
import { LATEST_DIR, RUNS_DIR, acquireQaLock, ensureDir, fmtMs, log, nowStamp, parseArgs, relPath, writeJson, writeTreeHash } from "./lib.mjs";
import { runChecks } from "./run-checks.mjs";
import { runQaSweep } from "./run-qa.mjs";
import { runBenchGate } from "./run-bench.mjs";
import { runBundleGate } from "./run-bundle.mjs";
import { runProbes } from "./probes/run-probes.mjs";
import { ISSUES_FILE, summarize } from "./summarize.mjs";

const TAG = "[gate:all]";

export async function runAll(opts = {}) {
  const stamp = nowStamp();
  const runDir = ensureDir(path.join(RUNS_DIR, stamp));
  writeTreeHash(runDir); // record the tree under test, even when --skip-checks
  const label = opts.label ?? `gate:all ${stamp}`;
  const t0 = Date.now();
  const stages = [];
  const stage = async (name, fn) => {
    const t = Date.now();
    log(TAG, `stage ${name} ...`);
    try {
      const r = await fn();
      stages.push({ name, ok: true, durationMs: Date.now() - t });
      return r;
    } catch (e) {
      stages.push({ name, ok: false, durationMs: Date.now() - t, error: String(e?.message ?? e) });
      log(TAG, `stage ${name} FAILED: ${e?.message ?? e}`);
      return null;
    }
  };
  // Hold the shared QA lock from the checks build through QA + probes so no concurrent run rebuilds dist underneath.
  const releaseLock = await acquireQaLock(TAG);
  // Checks first: its build step produces bench/app/dist, so later stages skip their rebuild (built once).
  // D585: the checks stage must not report a bundle verdict inside run-all — bundle-sizes.json is a
  // working file the bundle stage rewrites later, so any checks-time read is the previous run's
  // leftovers. Skip it here; the bundle stage's bundle.json is the single authoritative verdict.
  // Standalone `pnpm gate:checks` still runs it (labelled possibly-stale by bundle-gate.mjs).
  if (!opts.skipChecks) await stage("checks", () => runChecks({ runDir, skip: "bundle-gate" }));
  const benchCells = opts.bench ?? "paired";
  const benchFn = () => runBenchGate({ cells: benchCells, runDir, noBuild: true });
  let benchPromise = null;
  if (benchCells !== "none" && opts.benchParallel) benchPromise = stage("bench", benchFn);
  await stage("qa", () => runQaSweep({ workers: opts.workers ?? 4, repeat: opts.repeat ?? 1, charts: opts.charts, runDir, label, noBuild: !!opts.noBuild }));
  if (opts.probes) await stage("probes", () => runProbes({ runDir, noBuild: true }));
  releaseLock();
  // Bench runs sequentially by default (timings are CPU-purity sensitive).
  if (benchPromise) await benchPromise;
  else if (benchCells !== "none") await stage("bench", benchFn);
  await stage("bundle", () => runBundleGate({ runDir }));
  const sum = await stage("summary", async () => summarize({ runDir, label, issuesFile: opts.issues ? ISSUES_FILE : null }));
  const out = { label, runDir: relPath(runDir), wallClockMs: Date.now() - t0, stages, issues: sum?.issues?.length ?? null };
  writeJson(path.join(runDir, "run-all.json"), out);
  log(TAG, `done in ${fmtMs(out.wallClockMs)}: ${stages.map((s) => `${s.name}=${s.ok ? "ok" : "FAIL"} ${fmtMs(s.durationMs)}`).join(", ")} -> ${relPath(runDir)} (+ ${relPath(LATEST_DIR)})`);
  return out;
}

const a = parseArgs(process.argv.slice(2), { workers: "number", repeat: "number", bench: "string", "bench-parallel": "bool", probes: "bool", "skip-checks": "bool", charts: "string", label: "string", issues: "bool", "no-build": "bool" });
runAll({ workers: a.workers, repeat: a.repeat, bench: a.bench, benchParallel: a["bench-parallel"], probes: a.probes, skipChecks: a["skip-checks"], charts: a.charts, label: a.label, issues: a.issues, noBuild: a["no-build"] })
  .then((o) => process.exit(o.stages.some((s) => !s.ok) ? 1 : 0))
  .catch((e) => {
    console.error(e);
    process.exit(2);
  });
