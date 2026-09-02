// Static checks + census for the gate: tsc, bench/app build, eslint (showcase),
// reach-in guard (census.json), bundle gate (pin check only, no re-measure).
//
//   pnpm gate:checks [-- --run-dir <dir> --skip build,lint]
//
// Output: checks.json (exit codes, durations, one-line summaries) + census.json
// (scripts/reach-in-guard.mjs --json).
import path from "node:path";
import { APP_DIR, ROOT, RUNS_DIR, ensureDir, fmtMs, log, nowStamp, parseArgs, publishLatest, relPath, runCmd, sleep, writeJson } from "./lib.mjs";

const TAG = "[gate:checks]";

function summarizeEslint(stdout) {
  const m = /✖ (\d+) problems? \((\d+) errors?, (\d+) warnings?\)/.exec(stdout);
  if (m) return { problems: +m[1], errors: +m[2], warnings: +m[3] };
  return { problems: 0, errors: 0, warnings: 0 };
}

export async function runChecks(opts = {}) {
  const runDir = ensureDir(opts.runDir ?? path.join(RUNS_DIR, nowStamp()));
  const logDir = ensureDir(path.join(runDir, "logs", "checks"));
  const skip = new Set(opts.skip ? String(opts.skip).split(",") : []);
  const checks = [];
  const add = async (name, cmd, args, cwd, summarize) => {
    if (skip.has(name)) {
      checks.push({ name, skipped: true });
      return null;
    }
    log(TAG, `${name}: ${cmd} ${args.join(" ")} (cwd ${relPath(cwd)})`);
    const logFile = path.join(logDir, `${name}.log`);
    const r = await runCmd(cmd, args, { cwd, logFile });
    const summary = summarize ? summarize(r.stdout) : null;
    const lastLine = r.stdout.trim().split("\n").filter(Boolean).slice(-1)[0] ?? "";
    checks.push({ name, cmd: `${cmd} ${args.join(" ")}`, cwd: relPath(cwd), exit: r.code, durationMs: r.durationMs, summary, lastLine: lastLine.slice(0, 200), log: relPath(logFile) });
    log(TAG, `${name}: exit=${r.code} ${fmtMs(r.durationMs)}${summary ? " " + JSON.stringify(summary) : ""}`);
    return r;
  };
  await add("tsc", "npx", ["tsc", "--noEmit"], path.join(ROOT, "showcase"), (s) => ({ errors: (s.match(/error TS\d+/g) ?? []).length }));
  const build = await add("build", "npm", ["run", "build"], APP_DIR, (s) => ({ ok: /built in/.test(s) }));
  if (build && build.code !== 0 && !opts.noRetry) {
    // showcase/migrated is edited concurrently by fix executors: a build failure
    // may be transient. Retry once after 60 s and keep both attempts on record.
    log(TAG, "build failed — retrying once in 60 s (concurrent edits may be mid-flight)");
    await sleep(60_000);
    checks[checks.length - 1].name = "build (attempt 1)";
    await add("build", "npm", ["run", "build"], APP_DIR, (s) => ({ ok: /built in/.test(s), retried: true }));
  }
  await add("lint", "npx", ["eslint", "migrated"], path.join(ROOT, "showcase"), summarizeEslint);
  const census = await add("census", "node", ["scripts/reach-in-guard.mjs", "--json"], ROOT, (s) => {
    try {
      const j = JSON.parse(s.slice(s.indexOf("{")));
      return { total: j.total, files: typeof j.files === "number" ? j.files : j.files ? (Array.isArray(j.files) ? j.files.length : Object.keys(j.files).length) : null, failures: j.failures?.length ?? 0 };
    } catch {
      return { parseError: true };
    }
  });
  if (census) {
    let json = null;
    try {
      json = JSON.parse(census.stdout.slice(census.stdout.indexOf("{")));
    } catch {
      json = { parseError: true, raw: census.stdout.slice(0, 2000) };
    }
    writeJson(path.join(runDir, "census.json"), { generatedAt: new Date().toISOString(), exit: census.code, ledger: "scripts/reach-in-ledger.json", ...json });
  }
  await add("bundle-gate", "node", ["scripts/bundle-gate.mjs"], ROOT, (s) => ({ ok: (s.match(/^ok /gm) ?? []).length, fail: (s.match(/^FAIL /gm) ?? []).length }));
  const out = { generatedAt: new Date().toISOString(), runDir: relPath(runDir), checks, summary: { failed: checks.filter((c) => !c.skipped && c.exit !== 0 && !/attempt 1/.test(c.name)).map((c) => c.name) } };
  writeJson(path.join(runDir, "checks.json"), out);
  publishLatest([path.join(runDir, "checks.json"), path.join(runDir, "census.json")]);
  log(TAG, `failed: ${out.summary.failed.join(", ") || "none"} -> ${relPath(runDir)}/checks.json`);
  return out;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(ROOT, "qa", "gate", "run-checks.mjs");
if (isMain) {
  const a = parseArgs(process.argv.slice(2), { "run-dir": "string", skip: "string" });
  runChecks({ runDir: a["run-dir"], skip: a.skip })
    .then((o) => process.exit(o.summary.failed.length ? 1 : 0))
    .catch((e) => {
      console.error(e);
      process.exit(2);
    });
}
