// Compare step for the QA pixel gate: every cell is judged against the MODE DISTRIBUTION of its own history
// in qa/results/<chart>/*/report.json, never a single baseline sample. Writes <out>/qa-matrix.json + qa-matrix.md.
//   node qa/gate/compare-qa.mjs --runs <qa-runs.json> --out <dir>
//   node qa/gate/compare-qa.mjs --logs <dir of harness stdout logs> --out <dir> [--label sequential]
//   node qa/gate/compare-qa.mjs --diff <a/qa-matrix.json> <b/qa-matrix.json>
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  GATE_PX,
  TOTAL_PX,
  QA_RESULTS_DIR,
  ROOT,
  applyRulings,
  assertTreeHash,
  ensureDir,
  mdTable,
  parseArgs,
  readJson,
  relPath,
  writeJson,
} from "./lib.mjs";

/** Harness timestamps come as ISO or filesystem-safe; normalise to ISO for comparisons. */
export function normTs(ts) {
  if (!ts) return "";
  return String(ts).replace(/T(\d\d)-(\d\d)-(\d\d)-(\d\d\d)Z$/, "T$1:$2:$3.$4Z");
}

const BOARD_FILE = path.join(ROOT, "docs", "phase-5", "captures", "5-3-5-final-matrix.md");

/** Phase-5 close board: chart/n/cell -> {basePct, closePct, px, verdict, rule}. */
export function loadPhase5Board() {
  const out = new Map();
  if (!existsSync(BOARD_FILE)) return out;
  const text = readFileSync(BOARD_FILE, "utf8");
  const re = /^(\w+)\s+(\d+)\s+(settled|hover-\d+|loading)\s+([\d.]+)\s+([\d.]+)\s+(\d+)\s+(PASS|FAIL)\s+(.*?)\s{2,}(\S.*?)\s+(\d+)\s*$/gm;
  let m;
  while ((m = re.exec(text))) {
    const [, chart, n, cell, basePct, closePct, px, verdict, rule] = m;
    out.set(`${chart}/${n}/${cell}`, { basePct: Number(basePct), closePct: Number(closePct), px: Number(px), verdict, rule: rule.trim() });
  }
  return out;
}

// GUARD: history only from bklit-vs-migrated reports with timestamp < `before`, so a run never judges itself.
export function loadHistory({ before, minTimestamp = "2026-08-20" } = {}) {
  const hist = new Map(); // key -> { values: number[], runs: number }
  if (!existsSync(QA_RESULTS_DIR)) return hist;
  for (const chart of readdirSync(QA_RESULTS_DIR)) {
    const cdir = path.join(QA_RESULTS_DIR, chart);
    let runs = [];
    try {
      runs = readdirSync(cdir);
    } catch {
      continue;
    }
    for (const run of runs) {
      const rp = path.join(cdir, run, "report.json");
      if (!existsSync(rp)) continue;
      let rep;
      try {
        rep = JSON.parse(readFileSync(rp, "utf8"));
      } catch {
        continue;
      }
      if (rep.implB !== "migrated" || rep.implA !== "bklit") continue;
      const ts = normTs(rep.timestamp ?? run);
      if (ts < minTimestamp) continue;
      if (before && ts >= normTs(before)) continue;
      for (const c of rep.comparisons ?? []) {
        const key = `${rep.chart}/${rep.n}/${rep.state === "loading" ? "loading/" : ""}${c.name}`;
        let h = hist.get(key);
        if (!h) hist.set(key, (h = { values: [], runs: 0 }));
        h.values.push(c.diffPixels);
        h.runs++;
      }
    }
  }
  return hist;
}

function summarizeHist(values) {
  if (!values || values.length === 0) return null;
  const counts = new Map();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  return {
    count: values.length,
    min: Math.min(...values),
    max: Math.max(...values),
    mode: sorted[0][0],
    modeCount: sorted[0][1],
    distinct: sorted.length,
    top: sorted.slice(0, 6).map(([v, c]) => `${c}x${v}`).join(", "),
    seen: counts,
  };
}

export function judgeCell(px, hist) {
  if (!hist) return { status: "no-history", newValue: true };
  const seen = hist.seen.has(px);
  if (px === hist.mode) return { status: "mode", newValue: false };
  if (seen) return { status: "seen", newValue: false };
  if (px >= hist.min && px <= hist.max) return { status: "in-range", newValue: true };
  return { status: "out-of-range", newValue: true };
}

export function parseHarnessLog(text) {
  const head = text.match(/^\[qa\] (\w+) n=(\d+)/m);
  const cells = [];
  const re = /^\[qa\] (\w+) (\d+)\s+(\S+)\s+(PASS|FAIL)\s+([\d.]+)% differing pixels(.*)$/gm;
  let m;
  let chart, n;
  while ((m = re.exec(text))) {
    chart = m[1];
    n = Number(m[2]);
    const tail = m[6];
    const tipA = /tooltipA=(\w+)/.exec(tail)?.[1];
    const tipB = /tooltipB=(\w+)/.exec(tail)?.[1];
    const pctv = Number(m[5]);
    cells.push({
      name: m[3],
      diffPercent: pctv,
      diffPixels: Math.round((pctv / 100) * TOTAL_PX),
      pass: m[4] === "PASS",
      tooltipVisibleA: tipA === undefined ? null : tipA === "true",
      tooltipVisibleB: tipB === undefined ? null : tipB === "true",
      informational: /informational/.test(tail),
    });
  }
  if (!chart && head) {
    chart = head[1];
    n = Number(head[2]);
  }
  const outDir = /wrote report \+ PNGs -> (\S+)/.exec(text)?.[1] ?? null;
  const state = /state=loading/.test(text) ? "loading" : "ready";
  return { chart, n, state, comparisons: cells, outDir, tooltipFailures: [] };
}

export function buildMatrix(reports, { before, label } = {}) {
  const board = loadPhase5Board();
  const hist = loadHistory({ before });
  const rows = [];
  for (const r of reports) {
    const rep = r.report;
    if (!rep) {
      rows.push({ chart: r.chart, n: r.n, cell: "(no report)", exit: r.exit, error: r.error ?? "harness produced no report", gate: "ERROR", log: r.log ? relPath(r.log) : null });
      continue;
    }
    const statePrefix = rep.state === "loading" ? "loading/" : "";
    for (const c of rep.comparisons ?? []) {
      const key = `${rep.chart}/${rep.n}/${statePrefix}${c.name}`;
      const h = summarizeHist(hist.get(key)?.values);
      const px = c.diffPixels;
      const j = judgeCell(px, h);
      const b = board.get(key);
      const informational = !!c.informational;
      // A13: a non-zero harness exit means the capture crashed partway, so the PNGs are
      // whatever it managed before dying — no cell from that run earns a pixel verdict.
      // ERROR (never INFO/PASS/FAIL, never ruled) keeps the partial output loud.
      const crashed = r.exit !== null && r.exit !== undefined && r.exit !== 0;
      const gate = crashed ? "ERROR" : informational ? "INFO" : px <= GATE_PX ? "PASS" : "FAIL";
      const outDir = r.outDir ?? rep.outDir ?? null;
      const shot = (suffix) => (outDir ? relPath(path.join(outDir, `${c.name}${suffix}.png`)) : null);
      rows.push({
        chart: rep.chart,
        n: rep.n,
        state: rep.state ?? "ready",
        cell: c.name,
        px,
        pct: Number((c.diffPercent ?? (100 * px) / TOTAL_PX).toFixed(4)),
        gate,
        harness: c.pass ? "PASS" : "FAIL",
        informational,
        baselinePx: b ? b.px : null,
        baselineVerdict: b ? b.verdict : null,
        histRange: h ? [h.min, h.max] : null,
        histMode: h ? h.mode : null,
        histModeCount: h ? h.modeCount : null,
        histCount: h ? h.count : 0,
        histTop: h ? h.top : null,
        status: j.status,
        newValue: j.newValue,
        tooltipA: c.tooltipVisibleA ?? null,
        tooltipB: c.tooltipVisibleB ?? null,
        tooltipMethodA: c.tooltipCheckMethodA ?? null,
        tooltipMethodB: c.tooltipCheckMethodB ?? null,
        screenshots: outDir ? { a: shot("-a"), b: shot("-b"), diff: shot("-diff") } : null,
        reportDir: outDir ? relPath(outDir) : null,
        log: r.log ? relPath(r.log) : null,
        durationMs: r.durationMs ?? null,
        exit: r.exit ?? null,
        error: crashed ? (r.error ?? `harness exit ${r.exit}`) : undefined,
      });
    }
    for (const tf of rep.tooltipFailures ?? []) {
      rows.push({ chart: rep.chart, n: rep.n, state: rep.state ?? "ready", cell: `${tf.name}:tooltip`, gate: "FAIL", harness: "FAIL", tooltipFailure: tf, reportDir: r.outDir ? relPath(r.outDir) : null, log: r.log ? relPath(r.log) : null });
    }
  }
  const gated = rows.filter((r) => r.px !== undefined && !r.informational);
  applyRulings(rows); // hand-ruled cells (qa/gate/rulings.json) read ruled (<D>) instead of FAIL
  const summary = {
    label: label ?? null,
    runs: reports.length,
    cells: rows.filter((r) => r.px !== undefined).length,
    gatedCells: gated.length,
    gateFail: gated.filter((r) => r.gate === "FAIL" && !r.ruled).length,
    ruled: rows.filter((r) => r.ruled).length,
    harnessFail: rows.filter((r) => r.harness === "FAIL" && !r.informational).length,
    outOfRange: gated.filter((r) => r.status === "out-of-range").length,
    newValues: gated.filter((r) => r.newValue).length,
    noHistory: gated.filter((r) => r.status === "no-history").length,
    tooltipFailures: rows.filter((r) => r.tooltipFailure).length,
    errors: rows.filter((r) => r.gate === "ERROR").length,
    runsNonZeroExit: reports.filter((r) => r.exit && r.exit !== 0).length,
    wallClockMs: reports.reduce((a, r) => a + (r.durationMs ?? 0), 0),
  };
  return { generatedAt: new Date().toISOString(), gatePx: GATE_PX, totalPx: TOTAL_PX, historyCutoff: before ?? null, summary, rows };
}

export function matrixToMd(matrix) {
  const s = matrix.summary;
  const head = [
    `# QA pixel-gate matrix${s.label ? ` — ${s.label}` : ""}`,
    "",
    `Generated ${matrix.generatedAt}. Gate = ${matrix.gatePx} px of ${matrix.totalPx} (0.5%). History = qa/results/<chart>/*/report.json` +
      ` (bklit vs migrated${matrix.historyCutoff ? `, before ${matrix.historyCutoff}` : ""}); status per D402/D403: mode / seen / in-range (new value inside [min,max]) / out-of-range / no-history.`,
    "",
    `**${s.runs} runs, ${s.cells} cells (${s.gatedCells} gated): gate FAIL ${s.gateFail}${s.ruled ? `, ruled ${s.ruled}` : ""}, harness FAIL ${s.harnessFail}, out-of-range ${s.outOfRange}, new values ${s.newValues}, no-history ${s.noHistory}, tooltip failures ${s.tooltipFailures}, errors ${s.errors}, runs with non-zero exit ${s.runsNonZeroExit}.**`,
    "",
  ];
  const rows = matrix.rows.map((r) =>
    r.px === undefined
      ? [r.chart, r.n, r.cell, "", "", r.gate, r.harness ?? "", "", "", "", r.error ?? (r.tooltipFailure ? `${r.tooltipFailure.impl}: ${r.tooltipFailure.reason}` : ""), "", "", r.log ?? ""]
      : [
          r.chart,
          r.n,
          `${r.state === "loading" ? "loading/" : ""}${r.cell}`,
          r.px,
          r.pct.toFixed(4),
          r.ruled ? `ruled (${r.ruled})` : r.gate,
          r.harness,
          r.baselinePx ?? "—",
          r.histRange ? `[${r.histRange[0]},${r.histRange[1]}] n=${r.histCount}` : "—",
          r.histMode ?? "—",
          r.status + (r.newValue && r.status !== "no-history" ? " (new)" : ""),
          `${r.tooltipA ?? "-"}/${r.tooltipB ?? "-"}`,
          r.screenshots ? r.screenshots.diff : "",
          r.durationMs != null ? (r.durationMs / 1000).toFixed(0) + "s" : "",
        ],
  );
  return (
    head.join("\n") +
    mdTable(["chart", "n", "cell", "px", "pct", "gate", "harness", "base px (5.3.5)", "hist range", "mode", "status", "tipA/B", "diff png", "run"], rows) +
    "\n"
  );
}

/** Per-cell diff between two matrices (e.g. parallel vs sequential). */
export function diffMatrices(a, b) {
  const idx = (m) => new Map(m.rows.filter((r) => r.px !== undefined).map((r) => [`${r.chart}/${r.n}/${r.state}/${r.cell}`, r]));
  const A = idx(a);
  const B = idx(b);
  const out = [];
  for (const [k, ra] of A) {
    const rb = B.get(k);
    if (!rb) {
      out.push({ key: k, a: ra.px, b: null, note: "missing in B" });
      continue;
    }
    if (ra.px !== rb.px) {
      const inRange = rb.histRange ? rb.px >= rb.histRange[0] && rb.px <= rb.histRange[1] : null;
      out.push({ key: k, a: ra.px, b: rb.px, deltaPx: rb.px - ra.px, bStatus: rb.status, aStatus: ra.status, histRange: rb.histRange, bInHistRange: inRange, gateFlip: ra.gate !== rb.gate });
    }
  }
  for (const k of B.keys()) if (!A.has(k)) out.push({ key: k, a: null, b: B.get(k).px, note: "missing in A" });
  return out;
}

export function reportsFromRunsFile(runsFile) {
  const runs = readJson(runsFile);
  return (runs.jobs ?? runs).map((j) => {
    const reportPath = j.reportDir ? path.join(ROOT, j.reportDir, "report.json") : null;
    const report = reportPath && existsSync(reportPath) ? readJson(reportPath) : null;
    return { chart: j.chart, n: j.n, exit: j.exit, durationMs: j.durationMs, log: j.log ? path.join(ROOT, j.log) : null, outDir: j.reportDir ? path.join(ROOT, j.reportDir) : null, report, error: j.error };
  });
}

// Rebuilds the matrix of a sweep run outside the driver: first report per (chart, n) in [start, end).
export function reportsFromResultsWindow(roster, start, end) {
  return roster.map((j) => {
    const cdir = path.join(QA_RESULTS_DIR, j.chart);
    let best = null;
    for (const run of existsSync(cdir) ? readdirSync(cdir).sort() : []) {
      const rp = path.join(cdir, run, "report.json");
      if (!existsSync(rp)) continue;
      const rep = readJson(rp);
      if (rep.n !== j.n || (rep.state ?? "ready") !== (j.state ?? "ready")) continue;
      const ts = normTs(rep.timestamp ?? run);
      if (ts < normTs(start) || ts >= normTs(end)) continue;
      best = { chart: j.chart, n: j.n, outDir: path.join(cdir, run), report: rep, exit: rep.overallPass ? 0 : 1 };
      break;
    }
    return best ?? { chart: j.chart, n: j.n, report: null, error: `no report in window ${start}..${end}` };
  });
}

export function reportsFromLogDir(dir) {
  return readdirSync(dir)
    .filter((f) => /^\w+-\d+\.log$/.test(f))
    .sort()
    .map((f) => {
      const text = readFileSync(path.join(dir, f), "utf8");
      const rep = parseHarnessLog(text);
      const outDir = rep.outDir ? path.resolve(ROOT, rep.outDir) : null;
      const real = outDir && existsSync(path.join(outDir, "report.json")) ? readJson(path.join(outDir, "report.json")) : null;
      return { chart: rep.chart, n: rep.n, log: path.join(dir, f), outDir, report: real ?? (rep.comparisons.length ? rep : null), exit: /QA_DONE|overall/.test(text) ? 0 : null };
    });
}

async function main() {
  const args = parseArgs(process.argv.slice(2), { runs: "string", logs: "string", window: "string", roster: "string", out: "string", label: "string", before: "string", diff: "bool", "allow-hash-mismatch": "bool" });
  if (args.diff) {
    const [fa, fb] = args._;
    const d = diffMatrices(readJson(fa), readJson(fb));
    console.log(JSON.stringify(d, null, 2));
    console.log(`${d.length} differing cells`);
    return;
  }
  let reports;
  if (args.runs) {
    // The runs file is an earlier stage's artefact: refuse a tree-hash mismatch.
    assertTreeHash(path.dirname(path.resolve(args.runs)), { allow: !!args["allow-hash-mismatch"], tag: "[gate:qa]" });
    reports = reportsFromRunsFile(args.runs);
  }
  else if (args.logs) reports = reportsFromLogDir(args.logs);
  else if (args.window) {
    const [start, end] = args.window.split(",");
    const { readRoster } = await import("./lib.mjs");
    reports = reportsFromResultsWindow(readRoster(args.roster ?? path.join(ROOT, "qa", "gate", "roster.txt")), start, end);
  } else throw new Error("pass --runs <qa-runs.json>, --logs <dir> or --window <startISO,endISO>");
  const matrix = buildMatrix(reports, { before: args.before, label: args.label });
  const out = ensureDir(args.out ?? path.dirname(args.runs ?? args.logs ?? "."));
  writeJson(path.join(out, "qa-matrix.json"), matrix);
  writeFileSync(path.join(out, "qa-matrix.md"), matrixToMd(matrix));
  console.log(JSON.stringify(matrix.summary));
  console.log(`-> ${path.join(out, "qa-matrix.{json,md}")}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
