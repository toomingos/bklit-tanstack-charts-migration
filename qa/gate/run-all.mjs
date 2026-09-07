// Whole gate in one run dir: checks -> QA sweep (parallel) -> probes (opt-in) -> bundle -> bench
// (sequential; CPU-sensitive) -> SUMMARY.md, all published to qa/gate/latest (runs under docs/phase-7/gate/runs).
// A1: bundle precedes bench because bench reads bundle-sizes.json for M2c and the bundle stage writes it.
//   pnpm gate:all [-- --workers 4 --repeat 1 --bench paired|all|subset|none --bench-parallel --probes --skip-checks --charts a,b --label "..."]
import path from "node:path";
import { LATEST_DIR, RUNS_DIR, ensureDir, fmtMs, log, nowStamp, parseArgs, relPath, writeJson, writeTreeHash } from "./lib.mjs";
import { runChecks } from "./run-checks.mjs";
import { runQaSweep } from "./run-qa.mjs";
import { runBenchGate } from "./run-bench.mjs";
import { runBundleGate } from "./run-bundle.mjs";
import { runProbes } from "./probes/run-probes.mjs";
import { ISSUES_FILE, summarize } from "./summarize.mjs";

const TAG = "[gate:all]";

export async function runAll(opts = {}) {
  // A5: --bench-parallel is refused, not run. Bench timings are the product; beside QA they
  // corrupt by construction (D588). The flag stays accepted so old invocations fail loudly here
  // instead of silently running a parallel gate or erroring on an unknown argument.
  if (opts.benchParallel) throw new Error(`${TAG} --bench-parallel refused: bench must run sequentially for CPU purity (D588) — drop the flag`);
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
  // A5: run-all holds no umbrella lock. Each stage (qa, probes, bench) takes the shared QA
  // lock itself in turn, so the lock actually excludes; a nested second acquisition throws.
  // Checks first: its build step produces bench/app/dist, so later stages skip their rebuild (built once).
  // D585: the checks stage must not report a bundle verdict inside run-all — bundle-sizes.json is a
  // working file the bundle stage rewrites later, so any checks-time read is the previous run's
  // leftovers. Skip it here; the bundle stage's bundle.json is the single authoritative verdict.
  // Standalone `pnpm gate:checks` still runs it (labelled possibly-stale by bundle-gate.mjs).
  if (!opts.skipChecks) await stage("checks", () => runChecks({ runDir, skip: "bundle-gate" }));
  const benchCells = opts.bench ?? "paired";
  // A4: `noBuild: true` asserts "checks already built dist". With --skip-checks nothing
  // built it, and the assertion silently skips the freshness check too, so bench and
  // probes would run against an unknown dist. Let them check when checks did not run.
  const distBuiltByChecks = !opts.skipChecks;
  const benchFn = () => runBenchGate({ cells: benchCells, runDir, noBuild: distBuiltByChecks });
  await stage("qa", () => runQaSweep({ workers: opts.workers ?? 4, repeat: opts.repeat ?? 1, charts: opts.charts, runDir, label, noBuild: !!opts.noBuild }));
  if (opts.probes) await stage("probes", () => runProbes({ runDir, noBuild: distBuiltByChecks }));
  // A1: bundle before bench. bench reads bench/results/bundle-sizes.json at module load
  // for its M2c column and the bundle stage is what rewrites that file, so measuring
  // after bench judged every M2c cell against the previous run's bytes, silently.
  // Bench always runs sequentially (timings are CPU-purity sensitive; see the A5 refusal above).
  await stage("bundle", () => runBundleGate({ runDir }));
  if (benchCells !== "none") await stage("bench", benchFn);
  // A12: interim run-all.json so the summary stage renders failed stages as failed, not "not run".
  writeJson(path.join(runDir, "run-all.json"), { label, runDir: relPath(runDir), wallClockMs: Date.now() - t0, stages, issues: null });
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
