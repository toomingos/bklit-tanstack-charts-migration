// Gate SUMMARY.md from a run's artefacts (qa-matrix/bench/bundle/checks/census/probes, whichever exist): actionable
// issues with stable ids (qa:<chart>/<n>:<cat> bench:<cell>:<metric> bundle:<scenario> checks:<name> probe:<probe>:<chart>),
// a category, evidence paths, and an intentionally EMPTY hypothesis field. Optionally merges into ISSUES.md.
//   pnpm gate:summary [-- --run-dir <dir> --issues --label <run label>]
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { GATE_DOCS, GATE_PX, LATEST_DIR, ROOT, fmtMs, log, mdTable, parseArgs, publishLatest, readJson, relPath, writeJson } from "./lib.mjs";

const TAG = "[gate:summary]";
export const ISSUES_FILE = path.join(GATE_DOCS, "ISSUES.md");
export const CATEGORIES = ["hover-dim", "legend", "tooltip", "axis", "motion/reveal", "renderer-regime", "brush/zoom", "polar", "harness-race", "bench", "bundle", "census", "checks"];

const POLAR = new Set(["pie", "ring", "radar", "gauge", "gaugelinear", "sunburst", "sunchrome", "radial", "radialbar", "radialarea", "polar"]);
// GUARD: cardinality-gated renderer regime (NATIVE_MOTION_MAX_POINTS = 200).
const REGIME_BASE = ["scatter", "composed", "line", "area", "bar", "candlestick"];
const HARNESS_RACE = new Set(["choropleth/hover-30", "candlestick/hover-30"]); // known straddle cells

export function classifyQaCell(chart, n, cell, row = {}) {
  const base = chart.replace(/multiaxis$/, "");
  if (HARNESS_RACE.has(`${chart}/${cell}`) && !row.siblingsFail) return "harness-race";
  if (row.tooltipFailure) return "tooltip";
  if (/^legend-hover/.test(cell)) return "legend";
  if (/^depth-/.test(cell)) return "motion/reveal";
  if (/^brush-/.test(cell) || /^zoom/.test(cell)) return "brush/zoom";
  if (row.state === "loading" || /loading$/.test(chart)) return "motion/reveal";
  if (POLAR.has(chart)) return "polar";
  if (REGIME_BASE.includes(base) && Number(n) > 200) return "renderer-regime";
  if (cell === "settled" || /^pattern-/.test(cell)) return "axis";
  return "hover-dim";
}

function qaIssues(matrix) {
  if (!matrix) return [];
  const groups = new Map();
  const byRun = new Map();
  for (const r of matrix.rows) {
    const k = `${r.chart}/${r.n}`;
    if (!byRun.has(k)) byRun.set(k, []);
    byRun.get(k).push(r);
  }
  for (const r of matrix.rows) {
    const failing = r.gate === "FAIL" || r.gate === "ERROR" || r.status === "out-of-range" || r.tooltipA === false && r.tooltipB === true || r.tooltipA === true && r.tooltipB === false;
    if (!failing || r.informational) continue;
    const sib = byRun.get(`${r.chart}/${r.n}`).filter((x) => x !== r && /^hover-/.test(x.cell) && x.gate === "FAIL").length;
    const tooltipFailure = r.tooltipA != null && r.tooltipB != null && r.tooltipA !== r.tooltipB;
    const cat = r.gate === "ERROR" ? "harness-race" : classifyQaCell(r.chart, r.n, r.cell, { ...r, tooltipFailure, siblingsFail: sib > 0 });
    const id = `qa:${r.chart}/${r.n}:${cat}`;
    if (!groups.has(id)) groups.set(id, { id, category: cat, charts: [`${r.chart}/${r.n}`], cells: [], evidence: new Set(), detail: [] });
    const g = groups.get(id);
    const what = r.gate === "ERROR" ? "no report" : `${r.px} px (${r.status}${r.histMode != null ? `, mode ${r.histMode}` : ""}${r.histRange ? `, hist [${r.histRange.join(",")}]` : ""})`;
    g.cells.push(`${r.cell}: ${what}${tooltipFailure ? ` tooltip A/B ${r.tooltipA}/${r.tooltipB}` : ""}`);
    if (r.screenshots?.diff) g.evidence.add(r.screenshots.diff);
    else if (r.reportDir) g.evidence.add(r.reportDir);
    if (r.log) g.evidence.add(r.log);
  }
  return [...groups.values()].map((g) => ({ ...g, evidence: [...g.evidence] }));
}

function benchIssues(bench) {
  if (!bench) return [];
  const out = [];
  for (const r of bench.rows) {
    if (!r.flag) continue;
    out.push({ id: `bench:${r.cell}:${r.metric}`, category: "bench", charts: [`${r.impl}/${r.chart}/${r.n}`], cells: [`${r.metric}: ${r.value} vs baseline ${r.baseline}${r.deltaPct != null ? ` (${r.deltaPct > 0 ? "+" : ""}${r.deltaPct}%)` : ""}`], evidence: [`${bench.runDir ?? relPath(LATEST_DIR)}/bench.json`, ...(bench.runDirs ?? []).slice(0, 2)] });
  }
  for (const i of bench.invocations ?? []) if (i.exit !== 0) out.push({ id: `bench:invocation:${i.cell ?? i.args?.join(" ") ?? "?"}`, category: "bench", charts: [i.cell ?? "—"], cells: [`exit ${i.exit}`], evidence: [i.log].filter(Boolean) });
  return out;
}

function bundleIssues(bundle) {
  if (!bundle) return [];
  return bundle.rows.filter((r) => r.verdict === "FAIL" || r.verdict === "MISSING" || r.verdict === "MEASURE-FAILED").map((r) => ({ id: `bundle:${r.scenario}`, category: "bundle", charts: [r.scenario], cells: [`${r.verdict}: gzip ${r.gzip ?? "—"} vs pin ${r.pin ?? "—"} (limit ${r.limit ?? "—"}${r.deltaPct != null ? `, ${r.deltaPct > 0 ? "+" : ""}${r.deltaPct}%` : ""})`], evidence: [`${bundle.runDir ?? relPath(LATEST_DIR)}/bundle.json`, "bench/results/bundle-sizes.json"] }));
}

function checksIssues(checks, census) {
  const out = [];
  for (const c of checks?.checks ?? []) {
    if (c.skipped || c.exit === 0) continue;
    const cat = c.name === "census" ? "census" : c.name === "bundle-gate" ? "bundle" : "checks";
    out.push({ id: c.name === "census" ? "census" : `checks:${c.name}`, category: cat, charts: ["—"], cells: [`${c.cmd} exit ${c.exit}${c.summary ? " " + JSON.stringify(c.summary) : ""}`], evidence: [c.log].filter(Boolean) });
  }
  if (census && census.exit !== 0 && !out.some((o) => o.id === "census")) out.push({ id: "census", category: "census", charts: ["—"], cells: [`reach-in-guard exit ${census.exit}`], evidence: [`${checks?.runDir ?? relPath(LATEST_DIR)}/census.json`] });
  return out;
}

function probeIssues(probes) {
  if (!probes) return [];
  const out = [];
  const ev = `${probes.runDir ?? relPath(LATEST_DIR)}/probes.json`;
  const catFor = { "hover-lag": "hover-dim", "legend-hover-dim": "legend", "bardepth-toggle": "motion/reveal", "no-rereveal": "motion/reveal" };
  for (const [name, err] of Object.entries(probes.errors ?? {})) out.push({ id: `probe:${name}:error`, category: "harness-race", charts: ["—"], cells: [String(err).split("\n")[0].slice(0, 160)], evidence: [ev] });
  const h = probes.results?.["hover-lag"];
  for (const p of h?.flagged ?? []) out.push({ id: `probe:hover-lag:${p.chart}/${p.n}`, category: p.flags.some((f) => /tooltip/.test(f)) ? "tooltip" : "hover-dim", charts: [`${p.chart}/${p.n}`], cells: p.flags, evidence: [ev] });
  const l = probes.results?.["legend-hover-dim"];
  for (const p of l?.flagged ?? []) out.push({ id: `probe:legend-hover-dim:${p.chart}/${p.n}`, category: "legend", charts: [`${p.chart}/${p.n}`], cells: p.flags, evidence: [ev] });
  const b = probes.results?.["bardepth-toggle"];
  if (b?.flags?.length) out.push({ id: `probe:bardepth-toggle:${b.chart}/${b.n}`, category: catFor["bardepth-toggle"], charts: [`${b.chart}/${b.n}`], cells: b.flags, evidence: [ev] });
  const n = probes.results?.["no-rereveal"];
  for (const r of n?.flagged ?? []) out.push({ id: `probe:no-rereveal:${r.chart}/${r.n}:${r.impl}`, category: "motion/reveal", charts: [`${r.chart}/${r.n} (${r.impl})`], cells: [`${r.toggle}: moved 400→900 ${r.d400_900.moved}, opacity chg ${r.d400_900.opacityChanged}, fade replay ${r.fadeReplay}`], evidence: [ev] });
  return out;
}

export function collectIssues(runDir) {
  const rd = (f) => (existsSync(path.join(runDir, f)) ? readJson(path.join(runDir, f)) : null);
  const art = { matrix: rd("qa-matrix.json"), bench: rd("bench.json"), bundle: rd("bundle.json"), checks: rd("checks.json"), census: rd("census.json"), probes: rd("probes.json") };
  const issues = [...qaIssues(art.matrix), ...benchIssues(art.bench), ...bundleIssues(art.bundle), ...checksIssues(art.checks, art.census), ...probeIssues(art.probes)].map((i) => ({ ...i, hypothesis: "" }));
  return { art, issues };
}

const esc = (s) => String(s).replace(/\|/g, "\\|");

export function summaryMd({ runDir, label, art, issues }) {
  const m = art.matrix, b = art.bench, u = art.bundle, c = art.checks, p = art.probes;
  const out = [`# Gate summary — ${label ?? path.basename(runDir)}`, "", `Run dir: \`${relPath(runDir)}\`. Generated ${new Date().toISOString()}.`, "", "## Headline", ""];
  out.push(`- QA: ${m ? `${m.summary.runs} runs / ${m.summary.cells} cells; gate FAIL ${m.summary.gateFail}, harness FAIL ${m.summary.harnessFail}, out-of-range ${m.summary.outOfRange}, new values ${m.summary.newValues}, tooltip failures ${m.summary.tooltipFailures}, errors ${m.summary.errors}${m.run ? `; ${m.run.workers} workers, wall-clock ${fmtMs(m.run.wallClockMs)}` : ""} (gate ${GATE_PX} px)` : "not run"}`);
  out.push(`- Bench: ${b ? `${b.summary.cells} cells (${b.summary.skipped} skipped); ${b.summary.flags} flagged (±${b.flagPct}% D273), console-error cells ${b.summary.consoleErrors}, tooltip-missing ${b.summary.tooltipMissing}, failed invocations ${b.summary.failedInvocations}, wall-clock ${fmtMs(b.summary.wallClockMs)}` : "not run"}`);
  out.push(`- Bundle: ${u ? `${u.summary.pinned} pinned, FAIL ${u.summary.fail}, MISSING ${u.summary.missing}, measure-failed ${u.summary.measureFailed}, Σgzip ${u.summary.sumGzip} vs Σpin ${u.summary.sumPin} (${u.summary.sumDeltaPct > 0 ? "+" : ""}${u.summary.sumDeltaPct}%)` : "not run"}`);
  out.push(`- Checks: ${c ? c.checks.map((x) => `${x.name}=${x.skipped ? "skipped" : x.exit === 0 ? "ok" : "FAIL(" + x.exit + ")"}`).join(", ") : "not run"}`);
  out.push(`- Census: ${art.census ? `reach-in-guard exit ${art.census.exit}${art.census.total != null ? `, total ${art.census.total}` : ""}${art.census.failures ? `, failures ${art.census.failures.length}` : ""}` : "not run"}`);
  out.push(`- Probes: ${p ? `${p.ran.join(", ")} — flags ${JSON.stringify(p.summary)}, errors ${Object.keys(p.errors).length}` : "not run"}`);
  out.push("", `## Issues (${issues.length})`, "", "Classification only — the hypothesis column is intentionally empty for the fix owner.", "");
  const byCat = {};
  for (const i of issues) byCat[i.category] = (byCat[i.category] ?? 0) + 1;
  out.push(Object.entries(byCat).map(([k, v]) => `${k}: ${v}`).join(" · ") || "none", "");
  out.push(mdTable(["id", "category", "chart(s)", "cell(s) / metric", "evidence", "hypothesis"], issues.map((i) => [`\`${i.id}\``, i.category, i.charts.join(", "), esc(i.cells.join("<br>")), i.evidence.map((e) => `\`${e}\``).join("<br>"), i.hypothesis || ""])));
  if (m) {
    out.push("", "## QA cells that changed status vs history (not failing)", "");
    const moved = m.rows.filter((r) => r.gate !== "FAIL" && r.gate !== "ERROR" && r.status === "out-of-range");
    out.push(moved.length ? mdTable(["chart", "n", "cell", "px", "hist range", "mode"], moved.map((r) => [r.chart, r.n, r.cell, r.px, r.histRange ? `[${r.histRange.join(",")}]` : "—", r.histMode ?? "—"])) : "none");
  }
  return out.join("\n") + "\n";
}

const LEDGER_HEADER = ["| id | category | charts | cells / metric | first-seen run | status | owner note |", "| --- | --- | --- | --- | --- | --- | --- |"];

export function parseLedger(text) {
  const rows = new Map();
  for (const line of text.split("\n")) {
    if (!line.startsWith("| `")) continue;
    const c = line.split("|").slice(1, -1).map((s) => s.trim());
    if (c.length < 7) continue;
    rows.set(c[0].replace(/`/g, ""), { id: c[0].replace(/`/g, ""), category: c[1], charts: c[2], cells: c[3], firstSeen: c[4], status: c[5], note: c[6] });
  }
  return rows;
}

// `scope` limits ledger updates to rows this run could reproduce; out-of-scope rows keep their status.
export function mergeLedger(existingText, issues, runLabel, scope = null) {
  const rows = parseLedger(existingText);
  const seen = new Set();
  const inScope = (r) => {
    if (!scope) return true;
    const kind = r.id.split(":")[0];
    if (kind === "qa") return scope.qaKeys?.has(r.id.split(":")[1]) ?? false;
    if (kind === "probe") return !!scope.probes;
    if (kind === "census") return !!scope.checks;
    return !!scope[kind];
  };
  for (const i of issues) {
    seen.add(i.id);
    const cur = rows.get(i.id);
    if (cur) {
      cur.cells = esc(i.cells.join("<br>"));
      cur.charts = i.charts.join(", ");
      cur.status = `open (last seen ${runLabel})`;
    } else rows.set(i.id, { id: i.id, category: i.category, charts: i.charts.join(", "), cells: esc(i.cells.join("<br>")), firstSeen: runLabel, status: `open (last seen ${runLabel})`, note: "" });
  }
  for (const [id, r] of rows) if (!seen.has(id) && inScope(r) && /^open/.test(r.status)) r.status = `not reproduced in ${runLabel} (was: ${r.status.replace(/^open \(last seen |\)$/g, "")})`;
  const table = [...LEDGER_HEADER, ...[...rows.values()].map((r) => `| \`${r.id}\` | ${r.category} | ${r.charts} | ${r.cells} | ${r.firstSeen} | ${r.status} | ${r.note} |`)].join("\n");
  const marker = /<!-- ledger:start -->[\s\S]*<!-- ledger:end -->/;
  const block = `<!-- ledger:start -->\n${table}\n<!-- ledger:end -->`;
  return marker.test(existingText) ? existingText.replace(marker, block) : `${existingText.trimEnd()}\n\n${block}\n`;
}

export function summarize({ runDir = LATEST_DIR, label, issuesFile } = {}) {
  const { art, issues } = collectIssues(runDir);
  const lbl = label ?? art.matrix?.label ?? path.basename(runDir);
  const md = summaryMd({ runDir, label: lbl, art, issues });
  writeFileSync(path.join(runDir, "SUMMARY.md"), md);
  writeJson(path.join(runDir, "issues.json"), { generatedAt: new Date().toISOString(), runDir: relPath(runDir), label: lbl, issues });
  publishLatest([path.join(runDir, "SUMMARY.md"), path.join(runDir, "issues.json")]);
  if (issuesFile) {
    const existing = existsSync(issuesFile) ? readFileSync(issuesFile, "utf8") : "# Gate issue ledger\n";
    const scope = { qaKeys: new Set((art.matrix?.rows ?? []).map((r) => `${r.chart}/${r.n}`)), bench: !!art.bench, bundle: !!art.bundle, checks: !!art.checks, probes: !!art.probes };
    writeFileSync(issuesFile, mergeLedger(existing, issues, lbl, scope));
    log(TAG, `ledger merged -> ${relPath(issuesFile)}`);
  }
  log(TAG, `${issues.length} issue(s) -> ${relPath(runDir)}/SUMMARY.md`);
  return { issues, md };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(ROOT, "qa", "gate", "summarize.mjs");
if (isMain) {
  const a = parseArgs(process.argv.slice(2), { "run-dir": "string", label: "string", issues: "bool" });
  summarize({ runDir: a["run-dir"] ? path.resolve(a["run-dir"]) : LATEST_DIR, label: a.label, issuesFile: a.issues ? ISSUES_FILE : null });
}
