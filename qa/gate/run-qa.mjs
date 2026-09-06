// Parallel QA pixel-gate sweep: quiet-table check, build dist once, one vite preview on :5198, N workers each
// running qa/screenshot.mjs with QA_SKIP_REBUILD=1 (longest-known runs first), then the compare step.
//   pnpm gate:qa [-- --workers 4 --repeat 1 --roster qa/gate/roster.txt --charts a,b --no-build --run-dir <dir> --label x]
import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  GATE_DOCS,
  LATEST_DIR,
  QA_PORT,
  ROOT,
  RUNS_DIR,
  acquireQaLock,
  buildDistOnce,
  distFingerprint,
  ensureDir,
  fmtMs,
  isExclusiveJob,
  jobKey,
  log,
  nowStamp,
  parseArgs,
  publishLatest,
  readJson,
  readRoster,
  relPath,
  runCmd,
  runPool,
  startPreview,
  waitForQuietProcessTable,
  writeJson,
} from "./lib.mjs";
import { buildMatrix, matrixToMd, reportsFromRunsFile } from "./compare-qa.mjs";

const TAG = "[gate:qa]";
// Fallback duration hints (seconds) when no previous timings exist; only used to order the queue longest-first.
const DURATION_HINT = { funnel: 130, funnelvertical: 130, gauge: 21, gaugelinear: 21, markers: 14, patternarea: 16, brush: 14, bardepth: 12, legend: 8 };

export async function runQaSweep(opts = {}) {
  const workers = Math.max(1, opts.workers ?? 4);
  const runDir = ensureDir(opts.runDir ?? path.join(RUNS_DIR, nowStamp()));
  const logDir = ensureDir(path.join(runDir, "logs", "qa"));
  const started = new Date().toISOString();

  // Hold the QA lock for the whole batch, then require a quiet process table.
  const releaseLock = await acquireQaLock(TAG);
  await waitForQuietProcessTable(TAG, { abort: !!opts.noWait });
  const build = await buildDistOnce(TAG, { force: !!opts.forceBuild, skip: !!opts.noBuild, logFile: path.join(logDir, "build.log") });
  const dist = distFingerprint();

  let roster = readRoster(opts.roster ?? path.join(ROOT, "qa", "gate", "roster.txt"));
  if (opts.charts) {
    const want = new Set(String(opts.charts).split(","));
    roster = roster.filter((j) => want.has(j.chart));
  }
  // Order longest-first using the previous run's timings when available.
  const prevTimings = readJson(path.join(LATEST_DIR, "qa-timings.json"), {});
  const est = (j) => (prevTimings[jobKey(j)] ?? (DURATION_HINT[j.chart] ?? 8) * 1000);
  const jobs = [...roster].sort((a, b) => est(b) - est(a));
  log(TAG, `${jobs.length} runs, ${workers} workers, run dir ${relPath(runDir)}`);
  // D588: name the loading-pulse cells up front; runPool runs each alone.
  const exclusive = workers > 1 ? jobs.filter(isExclusiveJob).map(jobKey) : [];
  if (exclusive.length) log(TAG, `exclusive serial: ${exclusive.join(", ")}`);

  const preview = await startPreview(TAG, opts.port ?? QA_PORT, { logFile: path.join(logDir, "preview.log"), reuse: !!opts.reuseServer });
  const repeat = Math.max(1, opts.repeat ?? 1);
  const passes = [];
  try {
    for (let pass = 1; pass <= repeat; pass++) {
      // --repeat N re-runs the roster under the same lock/preview/dist; pass k>1 gets its own run dir.
      const passDir = pass === 1 ? runDir : ensureDir(`${runDir}-r${pass}`);
      const passLogDir = pass === 1 ? logDir : ensureDir(path.join(passDir, "logs", "qa"));
      if (repeat > 1) log(TAG, `pass ${pass}/${repeat} -> ${relPath(passDir)}`);
      passes.push(await runOnePass({ jobs, workers, preview, logDir: passLogDir, runDir: passDir, started: pass === 1 ? started : new Date().toISOString(), build, dist, label: opts.label ? `${opts.label}${repeat > 1 ? ` pass ${pass}` : ""}` : `workers=${workers}${repeat > 1 ? ` pass ${pass}` : ""}` }));
    }
  } finally {
    await preview.stop();
    releaseLock();
  }
  return passes[0];
}

async function runOnePass({ jobs, workers, preview, logDir, runDir, started, build, dist, label }) {
  const t0 = Date.now();
  let done = 0;
  let results;
  {
    results = await runPool(
      jobs,
      workers,
      async (job, workerId) => {
        const key = jobKey(job);
        const logFile = path.join(logDir, `${job.chart}-${job.n}${job.state ? "-" + job.state : ""}.log`);
        const args = ["qa/screenshot.mjs", "--chart", job.chart, "--impl-a", "bklit", "--impl-b", "migrated", "--n", String(job.n), "--base-url", preview.url];
        if (job.state) args.push("--state", job.state);
        const r = await runCmd("node", args, { cwd: ROOT, env: { QA_SKIP_REBUILD: "1" }, logFile });
        const outDir = /wrote report \+ PNGs -> (\S+)/.exec(r.stdout)?.[1] ?? null;
        const reportDir = outDir ? relPath(path.resolve(ROOT, outDir)) : null;
        const hasReport = reportDir && existsSync(path.join(ROOT, reportDir, "report.json"));
        const errLine = !hasReport ? (r.stdout.split("\n").filter((l) => /error|Error|FAIL/.test(l)).slice(-2).join(" | ") || `exit ${r.code}`) : undefined;
        return { chart: job.chart, n: job.n, state: job.state ?? "ready", key, worker: workerId, exit: r.code, durationMs: r.durationMs, reportDir: hasReport ? reportDir : null, log: relPath(logFile), error: errLine };
      },
      (res) => {
        done++;
        log(TAG, `${String(done).padStart(2)}/${jobs.length} ${res.key.padEnd(20)} exit=${res.exit} ${fmtMs(res.durationMs)}${res.reportDir ? "" : "  NO REPORT"}`);
      },
      { isExclusive: isExclusiveJob },
    );
  }
  const wallMs = Date.now() - t0;
  const timings = Object.fromEntries(results.map((r) => [r.key, r.durationMs]));
  const runsFile = path.join(runDir, "qa-runs.json");
  // GUARD: a foreign vite build mid-pass means cells straddle two dists; flag it, don't silently mix.
  const distEnd = distFingerprint();
  const distChangedDuringPass = JSON.stringify(distEnd) !== JSON.stringify(dist);
  if (distChangedDuringPass) log(TAG, `WARNING: bench/app/dist changed during the pass (${dist.indexMtime} -> ${distEnd.indexMtime}); cells straddle two builds`);
  writeJson(runsFile, {
    label,
    started,
    finished: new Date().toISOString(),
    workers,
    wallClockMs: wallMs,
    sumRunMs: results.reduce((a, r) => a + r.durationMs, 0),
    build,
    dist,
    distEnd,
    distChangedDuringPass,
    previewUrl: preview.url,
    jobs: results,
  });
  writeJson(path.join(runDir, "qa-timings.json"), timings);
  log(TAG, `sweep wall-clock ${fmtMs(wallMs)} (sum of runs ${fmtMs(results.reduce((a, r) => a + r.durationMs, 0))}); ${results.filter((r) => r.exit !== 0).length} non-zero exits`);

  // Compare cutoff = this run's start, so the run never judges itself against its own captures.
  const matrix = buildMatrix(reportsFromRunsFile(runsFile), { before: started, label });
  matrix.run = { runDir: relPath(runDir), started, workers, wallClockMs: wallMs };
  writeJson(path.join(runDir, "qa-matrix.json"), matrix);
  writeFileSync(path.join(runDir, "qa-matrix.md"), matrixToMd(matrix));
  publishLatest([runsFile, path.join(runDir, "qa-timings.json"), path.join(runDir, "qa-matrix.json"), path.join(runDir, "qa-matrix.md")]);
  log(TAG, `matrix: ${JSON.stringify(matrix.summary)}`);
  log(TAG, `-> ${relPath(runDir)}/qa-matrix.{json,md} (+ ${relPath(LATEST_DIR)})`);
  return { runDir, matrix, results, wallMs };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(ROOT, "qa", "gate", "run-qa.mjs");
if (isMain) {
  const a = parseArgs(process.argv.slice(2), { workers: "number", repeat: "number", roster: "string", charts: "string", "run-dir": "string", label: "string", "no-build": "bool", "force-build": "bool", "no-wait": "bool", "reuse-server": "bool", port: "number" });
  runQaSweep({ workers: a.workers, repeat: a.repeat, roster: a.roster, charts: a.charts, runDir: a["run-dir"], label: a.label, noBuild: a["no-build"], forceBuild: a["force-build"], noWait: a["no-wait"], reuseServer: a["reuse-server"], port: a.port })
    .then((r) => process.exit(r.matrix.summary.gateFail || r.matrix.summary.errors ? 1 : 0))
    .catch((e) => {
      console.error(e);
      process.exit(2);
    });
}
