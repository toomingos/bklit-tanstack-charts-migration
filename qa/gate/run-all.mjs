// The whole gate in one run dir: checks (tsc/build/lint/census) → QA sweep
// (parallel, N workers) → probes (opt-in) → bench (paired cells, SEQUENTIAL
// after QA so the CPU is quiet — pass --bench-parallel to overlap them) →
// bundle → SUMMARY.md, all published to docs/phase-6/gate/latest.
//
//   pnpm gate:all [-- --workers 4 --repeat 1 --bench paired|all|subset|none
//                    --bench-parallel --probes --skip-checks --charts a,b --label "..."]
import path from "node:path";
import { LATEST_DIR, RUNS_DIR, acquireQaLock, ensureDir, fmtMs, log, nowStamp, parseArgs, relPath, writeJson } from "./lib.mjs";
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
  // Hold the shared QA lock (port 5198 + bench/app/dist) from the checks build
  // through the QA sweep and probes, so a concurrent executor run never has its
  // served dist rebuilt underneath it. Bench/bundle run outside the lock.
  const releaseLock = await acquireQaLock(TAG);
  // 1. checks first: its "build" step produces bench/app/dist, so the later
  //    stages' buildDistOnce sees a fresh dist and skips (rebuild once).
  if (!opts.skipChecks) await stage("checks", () => runChecks({ runDir }));
  const benchCells = opts.bench ?? "paired";
  const benchFn = () => runBenchGate({ cells: benchCells, runDir, noBuild: true });
  let benchPromise = null;
  if (benchCells !== "none" && opts.benchParallel) benchPromise = stage("bench", benchFn);
  // 2. QA (holds the shared port-5198 lock for the whole batch).
  await stage("qa", () => runQaSweep({ workers: opts.workers ?? 4, repeat: opts.repeat ?? 1, charts: opts.charts, runDir, label, noBuild: !!opts.noBuild }));
  if (opts.probes) await stage("probes", () => runProbes({ runDir, noBuild: true }));
  releaseLock();
  // 3. bench sequentially by default (timings are CPU-purity sensitive).
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
