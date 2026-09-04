// Bundle gate driver (wraps bench/measure-bundle.mjs + scripts/bundle-gate.mjs: 104 bundles, 43 migrated pins, 3%).
//   pnpm gate:bundle [-- --no-measure --run-dir <dir>]
// Output: bundle.json + bundle.md (gzip per scenario vs pin, delta %, verdict).
import { writeFileSync } from "node:fs";
import path from "node:path";
import { BENCH_RESULTS_DIR, ROOT, RUNS_DIR, ensureDir, fmtMs, log, mdTable, nowStamp, parseArgs, publishLatest, readJson, relPath, runCmd, writeJson } from "./lib.mjs";

const TAG = "[gate:bundle]";

export function compareBundles(sizes, gate) {
  const rows = [];
  const tol = gate.tolerancePct ?? 3;
  for (const [scenario, pin] of Object.entries(gate.scenarios ?? {})) {
    const s = sizes[scenario];
    const gzip = s ? s.gzip : null;
    const delta = gzip != null ? ((gzip - pin.gzip) / pin.gzip) * 100 : null;
    rows.push({ scenario, gzip, raw: s ? s.raw : null, pin: pin.gzip, limit: Math.round(pin.gzip * (1 + tol / 100)), deltaPct: delta != null ? Number(delta.toFixed(2)) : null, verdict: gzip == null ? "MISSING" : gzip <= pin.gzip * (1 + tol / 100) ? "ok" : "FAIL" });
  }
  // Unpinned scenarios (controls, migrated without a pin) are informational only.
  for (const [scenario, s] of Object.entries(sizes)) {
    if (gate.scenarios?.[scenario]) continue;
    rows.push({ scenario, gzip: s ? s.gzip : null, raw: s ? s.raw : null, pin: null, limit: null, deltaPct: null, verdict: s ? "info" : "MEASURE-FAILED" });
  }
  return rows;
}

export function bundleToMd(b) {
  const s = b.summary;
  const gated = b.rows.filter((r) => r.pin != null);
  const info = b.rows.filter((r) => r.pin == null);
  const sum = (rows) => rows.reduce((a, r) => a + (r.gzip ?? 0), 0);
  return [
    "# Bundle gate",
    "",
    `Generated ${b.generatedAt}. Sizes: bench/results/bundle-sizes.json (${b.measured ? `re-measured, exit ${b.measureExit}, ${fmtMs(b.measureMs)}` : "not re-measured"}); pins: bench/results/bundle-gate.json (pinned ${b.pinnedAt}, tolerance ${b.tolerancePct}%); scripts/bundle-gate.mjs exit ${b.gateExit}.`,
    "",
    `**${gated.length} pinned scenarios: ${s.fail} FAIL, ${s.missing} missing, summed gzip ${(sum(gated) / 1024).toFixed(0)} kB vs pins ${(gated.reduce((a, r) => a + r.pin, 0) / 1024).toFixed(0)} kB (${s.sumDeltaPct > 0 ? "+" : ""}${s.sumDeltaPct}%). Largest delta: ${s.maxDelta ? `${s.maxDelta.scenario} ${s.maxDelta.deltaPct > 0 ? "+" : ""}${s.maxDelta.deltaPct}%` : "—"}.**`,
    "",
    "## Pinned (migrated)",
    "",
    mdTable(["scenario", "gzip", "pin", "limit", "Δ%", "verdict"], gated.map((r) => [r.scenario, r.gzip ?? "—", r.pin, r.limit, r.deltaPct != null ? `${r.deltaPct > 0 ? "+" : ""}${r.deltaPct}` : "—", r.verdict === "FAIL" ? "**FAIL**" : r.verdict])),
    "",
    "## Unpinned (informational: bklit / tanstack controls)",
    "",
    mdTable(["scenario", "gzip", "raw", "note"], info.map((r) => [r.scenario, r.gzip ?? "—", r.raw ?? "—", r.verdict])),
    "",
  ].join("\n");
}

export async function runBundleGate(opts = {}) {
  const runDir = ensureDir(opts.runDir ?? path.join(RUNS_DIR, nowStamp()));
  const logDir = ensureDir(path.join(runDir, "logs"));
  let measureExit = null;
  let measureMs = 0;
  if (!opts.noMeasure) {
    log(TAG, "measuring 104 bundles (bench/measure-bundle.mjs) ...");
    const r = await runCmd("node", ["bench/measure-bundle.mjs"], { cwd: ROOT, logFile: path.join(logDir, "bundle-measure.log") });
    measureExit = r.code;
    measureMs = r.durationMs;
    log(TAG, `measure exit=${r.code} ${fmtMs(r.durationMs)}`);
  }
  const g = await runCmd("node", ["scripts/bundle-gate.mjs"], { cwd: ROOT, logFile: path.join(logDir, "bundle-gate.log") });
  const sizes = readJson(path.join(BENCH_RESULTS_DIR, "bundle-sizes.json"));
  const gate = readJson(path.join(BENCH_RESULTS_DIR, "bundle-gate.json"));
  const rows = compareBundles(sizes, gate);
  const gated = rows.filter((r) => r.pin != null);
  const sumG = gated.reduce((a, r) => a + (r.gzip ?? 0), 0);
  const sumP = gated.reduce((a, r) => a + r.pin, 0);
  const maxDelta = gated.filter((r) => r.deltaPct != null).sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct))[0] ?? null;
  const bundle = {
    generatedAt: new Date().toISOString(),
    runDir: relPath(runDir),
    measured: !opts.noMeasure,
    measureExit,
    measureMs,
    gateExit: g.code,
    gateStdoutTail: g.stdout.trim().split("\n").slice(-3),
    pinnedAt: gate.pinnedAt,
    tolerancePct: gate.tolerancePct,
    summary: { pinned: gated.length, fail: gated.filter((r) => r.verdict === "FAIL").length, missing: gated.filter((r) => r.verdict === "MISSING").length, measureFailed: rows.filter((r) => r.verdict === "MEASURE-FAILED").length, sumGzip: sumG, sumPin: sumP, sumDeltaPct: Number((((sumG - sumP) / sumP) * 100).toFixed(2)), maxDelta: maxDelta ? { scenario: maxDelta.scenario, deltaPct: maxDelta.deltaPct } : null },
    rows,
  };
  writeJson(path.join(runDir, "bundle.json"), bundle);
  writeFileSync(path.join(runDir, "bundle.md"), bundleToMd(bundle));
  publishLatest([path.join(runDir, "bundle.json"), path.join(runDir, "bundle.md")]);
  log(TAG, `summary ${JSON.stringify(bundle.summary)} -> ${relPath(runDir)}/bundle.{json,md}`);
  return bundle;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(ROOT, "qa", "gate", "run-bundle.mjs");
if (isMain) {
  const a = parseArgs(process.argv.slice(2), { "run-dir": "string", "no-measure": "bool" });
  runBundleGate({ runDir: a["run-dir"], noMeasure: a["no-measure"] })
    .then((b) => process.exit(b.gateExit !== 0 || b.summary.fail ? 1 : 0))
    .catch((e) => {
      console.error(e);
      process.exit(2);
    });
}
