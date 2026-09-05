// Static checks + census for the gate: tsc, bench/app build, oxlint (ultracite), reach-in guard, bundle-gate pin check.
//   pnpm gate:checks [-- --run-dir <dir> --skip build,lint]
// Output: checks.json + census.json.
import path from "node:path";
import { APP_DIR, ROOT, RUNS_DIR, ensureDir, fmtMs, log, nowStamp, parseArgs, publishLatest, relPath, runCmd, sleep, writeJson, writeTreeHash } from "./lib.mjs";

const TAG = "[gate:checks]";
const LINT_FLOOR = 4; // pinned pre-existing oxlint errors (D518 baseline 7, lowered to 4 by V2.2 polar, D535); fail only above it.

function summarizeOxlint(stdout) {
  // The lint check runs with `--format=json`: oxlint's default (graphical) reporter emits
  // multi-line snippets, and its trailing "Found N warnings and M errors." line is not
  // reliable under js-plugins. The JSON reporter gives one object per diagnostic.
  //
  // The payload is an OBJECT — `{ "diagnostics": [...], "number_of_files": N, ... }` — so
  // slicing from the first "[" lands inside the array and leaves the object's trailing
  // fields as garbage after the close bracket. Always slice from the first "{".
  let diagnostics;
  try {
    const parsed = JSON.parse(stdout.slice(stdout.indexOf("{")));
    diagnostics = Array.isArray(parsed) ? parsed : (parsed.diagnostics ?? []);
  } catch {
    return { parseError: true };
  }
  const errors = diagnostics.filter((d) => d.severity === "error").length;
  const warnings = diagnostics.filter((d) => d.severity === "warning").length;
  // Rule counts make a regression legible without reopening the log.
  const byRule = {};
  for (const d of diagnostics) byRule[d.code] = (byRule[d.code] ?? 0) + 1;
  const topRules = Object.entries(byRule).sort((a, b) => b[1] - a[1]).slice(0, 10);
  return { problems: diagnostics.length, errors, warnings, topRules };
}

export async function runChecks(opts = {}) {
  const runDir = ensureDir(opts.runDir ?? path.join(RUNS_DIR, nowStamp()));
  const logDir = ensureDir(path.join(runDir, "logs", "checks"));
  const skip = new Set(opts.skip ? String(opts.skip).split(",") : []);
  writeTreeHash(runDir); // record the tree under test before any stage reads it
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
  const finish = () => {
    const out = { generatedAt: new Date().toISOString(), runDir: relPath(runDir), checks, summary: { failed: checks.filter((c) => !c.skipped && c.exit !== 0 && !/attempt 1/.test(c.name)).map((c) => c.name) } };
    writeJson(path.join(runDir, "checks.json"), out);
    publishLatest([path.join(runDir, "checks.json"), path.join(runDir, "census.json")]);
    log(TAG, `failed: ${out.summary.failed.join(", ") || "none"} -> ${relPath(runDir)}/checks.json`);
    return out;
  };
  // Static checks first: tsc, then lint. A red typecheck stops the pipeline here.
  const tsc = await add("tsc", "npx", ["tsc", "--noEmit"], path.join(ROOT, "showcase"), (s) => ({ errors: (s.match(/error TS\d+/g) ?? []).length }));
  if (tsc && tsc.code !== 0) {
    log(TAG, "tsc failed — stopping the checks pipeline here");
    return finish();
  }
  const lint = await add("lint", "npx", ["oxlint", "--type-aware", "--deny-warnings", "--format=json", "migrated", "packages/migrated-charts"], path.join(ROOT, "showcase"), summarizeOxlint);
  if (lint) {
    const rec = checks[checks.length - 1];
    const errs = rec.summary && !rec.summary.parseError ? rec.summary.errors : null;
    const warns = rec.summary && !rec.summary.parseError ? rec.summary.warnings : null;
    rec.floor = LINT_FLOOR;
    if (errs !== null && warns !== null && errs <= LINT_FLOOR && warns === 0) {
      rec.exit = 0; // at/below the pinned floor: report the count, pass
      rec.floored = true;
    }
    log(TAG, `lint: ${errs ?? "?"} error(s), ${warns ?? "?"} warning(s) vs floor ${LINT_FLOOR} -> ${rec.exit === 0 ? "ok" : "FAIL"}`);
  }
  await add("bench-tsc", "npx", ["tsc", "--noEmit", "-p", "tsconfig.json"], APP_DIR, (s) => ({ errors: (s.match(/error TS\d+/g) ?? []).length }));
  const build = await add("build", "npm", ["run", "build"], APP_DIR, (s) => ({ ok: /built in/.test(s) }));
  if (build && build.code !== 0 && !opts.noRetry) {
    // GUARD: showcase/migrated is edited concurrently; a build failure may be transient, so retry once after 60s.
    log(TAG, "build failed — retrying once in 60 s (concurrent edits may be mid-flight)");
    await sleep(60_000);
    checks[checks.length - 1].name = "build (attempt 1)";
    await add("build", "npm", ["run", "build"], APP_DIR, (s) => ({ ok: /built in/.test(s), retried: true }));
  }
  await add("unit", "pnpm", ["test"], ROOT, (s) => {
    const m = {};
    for (const mm of s.matchAll(/ℹ (pass|fail) (\d+)/g)) m[mm[1]] = Number(mm[2]);
    return Object.keys(m).length ? m : null;
  });
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
  return finish();
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
