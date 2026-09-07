// D639: the measurement behind THIN_HISTORY_MIN in compare-qa.mjs. Read-only --
// no server, no build, no capture. Reads the local qa/results/ history only, so
// its numbers are reproducible on a machine that has that history and nowhere
// else; the values it produced are recorded in LOG.md D639 for everyone else.
//
// Read-only: replay the gate's own judgement chronologically over local history.
// For every cell and every prefix length k, ask what judgeCell would have said
// about reading k+1 given only readings 1..k. No gate, no server, no build.
import { readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
const ROOT = process.cwd();
const DIR = path.join(ROOT, "qa", "results");
const excluded = new Set(
  (JSON.parse(readFileSync(path.join(ROOT, "qa/gate/history-excluded.json"), "utf8")).excluded ?? [])
    .map((e) => path.resolve(ROOT, e.reportDir)));

const cells = new Map(); // key -> [{ts, px}]
for (const chart of readdirSync(DIR)) {
  const cdir = path.join(DIR, chart);
  let runs = []; try { runs = readdirSync(cdir); } catch { continue; }
  for (const run of runs) {
    if (excluded.has(path.resolve(cdir, run))) continue;
    const rp = path.join(cdir, run, "report.json");
    if (!existsSync(rp)) continue;
    let rep; try { rep = JSON.parse(readFileSync(rp, "utf8")); } catch { continue; }
    if (rep.implB !== "migrated" || rep.implA !== "bklit") continue;
    const ts = String(rep.timestamp ?? run);
    for (const c of rep.comparisons ?? []) {
      const key = `${rep.chart}/${rep.n}/${rep.state === "loading" ? "loading/" : ""}${c.name}`;
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key).push({ ts, px: c.diffPixels });
    }
  }
}

// per prefix-length k: how often is reading k+1 outside [min,max] of the first k
const byK = new Map();
const perCell = [];
for (const [key, arr] of cells) {
  arr.sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));
  const v = arr.map((a) => a.px);
  let oor = 0, trials = 0;
  for (let k = 1; k < v.length; k++) {
    const pre = v.slice(0, k);
    const mn = Math.min(...pre), mx = Math.max(...pre);
    const out = v[k] < mn || v[k] > mx;
    const b = byK.get(k) ?? { trials: 0, oor: 0 };
    b.trials++; if (out) b.oor++;
    byK.set(k, b);
    if (k >= 2) { trials++; if (out) oor++; }
  }
  const distinct = new Set(v).size;
  perCell.push({ key, n: v.length, distinct, oor, trials, min: Math.min(...v), max: Math.max(...v) });
}

console.log("prefix k | trials | out-of-range | rate  | 2/(k+1) theory");
for (const k of [...byK.keys()].sort((a, b) => a - b)) {
  const b = byK.get(k);
  if (b.trials < 20) continue;
  console.log(
    `${String(k).padStart(8)} | ${String(b.trials).padStart(6)} | ${String(b.oor).padStart(12)} | ${(100 * b.oor / b.trials).toFixed(1).padStart(5)}% | ${(200 / (k + 1)).toFixed(1)}%`);
}

const jittery = perCell.filter((c) => c.distinct > 1);
console.log(`\ncells total ${perCell.length}; deterministic (1 distinct value) ${perCell.length - jittery.length}; jittery ${jittery.length}`);
console.log("\ntop jittery cells by out-of-range rate (k>=2, n>=6):");
for (const c of jittery.filter((c) => c.n >= 6 && c.trials > 0).sort((a, b) => b.oor / b.trials - a.oor / a.trials).slice(0, 15))
  console.log(`  ${c.key.padEnd(38)} n=${String(c.n).padStart(3)} distinct=${String(c.distinct).padStart(3)} oor ${c.oor}/${c.trials} range [${c.min},${c.max}]`);
