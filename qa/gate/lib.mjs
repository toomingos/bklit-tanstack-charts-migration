// Shared helpers for the gate drivers (qa/gate/*.mjs). They wrap the protected harnesses without modifying
// them: build bench/app/dist once, boot one vite preview per port, fan out with --base-url + QA_SKIP_REBUILD=1.
import { spawn, execSync, execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  rmdirSync,
  rmSync,
  writeFileSync,
  cpSync,
  createWriteStream,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const APP_DIR = path.join(ROOT, "bench", "app");
export const GATE_DOCS = path.join(ROOT, "docs", "phase-7", "gate");
export const LATEST_DIR = path.join(ROOT, "qa", "gate", "latest");
export const RUNS_DIR = path.join(GATE_DOCS, "runs");
export const QA_RESULTS_DIR = path.join(ROOT, "qa", "results");
export const BENCH_RESULTS_DIR = path.join(ROOT, "bench", "results");
export const QA_PORT = 5198;
export const BENCH_PORT = 5199;
// GUARD: qa/screenshot.mjs gate is 0.5% of a 1200x800 viewport.
export const GATE_PX = 4800;
export const TOTAL_PX = 960000;

export function nowStamp() {
  return new Date().toISOString().replace(/[:.]/g, "-"); // filesystem-safe ISO stamp, same convention as the harnesses
}

export function parseArgs(argv, spec = {}) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) {
      out._.push(a);
      continue;
    }
    const key = a.slice(2);
    const kind = spec[key];
    if (kind === "bool" || kind === undefined) {
      if (kind === undefined && argv[i + 1] !== undefined && !argv[i + 1].startsWith("--")) {
        out[key] = argv[++i];
      } else out[key] = true;
    } else if (kind === "number") out[key] = Number(argv[++i]);
    else out[key] = argv[++i];
  }
  return out;
}

export function ensureDir(p) {
  mkdirSync(p, { recursive: true });
  return p;
}

export function writeJson(p, obj) {
  ensureDir(path.dirname(p));
  writeFileSync(p, JSON.stringify(obj, null, 2) + "\n");
}

export function readJson(p, fallback = undefined) {
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    if (fallback !== undefined) return fallback;
    throw new Error(`cannot read JSON ${p}`);
  }
}

/** Copy a file into qa/gate/latest/ (overwrite). */
export function publishLatest(files) {
  ensureDir(LATEST_DIR);
  for (const f of files) {
    if (existsSync(f)) cpSync(f, path.join(LATEST_DIR, path.basename(f)));
  }
}

export function log(tag, msg) {
  const t = new Date().toISOString().slice(11, 19);
  console.log(`${t} ${tag} ${msg}`);
}

export function fmtMs(ms) {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const s = ms / 1000;
  if (s < 90) return `${s.toFixed(1)}s`;
  return `${Math.floor(s / 60)}m${String(Math.round(s % 60)).padStart(2, "0")}s`;
}

// GUARD: harnesses bind fixed ports and the QA gate is CPU-sensitive; refuse to start unless the table is quiet.
export function foreignHarnessProcesses(ignorePids = []) {
  let out = "";
  try {
    out = execSync('pgrep -fl "screenshot.mjs|bench/run.mjs|vite preview|measure-bundle.mjs"', {
      encoding: "utf8",
    });
  } catch {
    return [];
  }
  const self = new Set([process.pid, ...ignorePids].map(String));
  return out
    .split("\n")
    .filter(Boolean)
    .filter((line) => !self.has(line.split(/\s+/)[0]));
}

export async function waitForQuietProcessTable(tag, { maxWaitMs = 20 * 60_000, abort = false } = {}) {
  const t0 = Date.now();
  let announced = false;
  for (;;) {
    const busy = foreignHarnessProcesses();
    if (busy.length === 0) return;
    if (abort) throw new Error(`${tag} refusing to start — harness processes running:\n${busy.join("\n")}`);
    if (!announced) {
      announced = true;
      log(tag, `waiting for another harness run to finish (${busy.length} process(es)):\n  ${busy.join("\n  ")}`);
    }
    if (Date.now() - t0 > maxWaitMs) throw new Error(`${tag} gave up waiting for a quiet process table after ${fmtMs(maxWaitMs)}`);
    await sleep(5000);
  }
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function runCmd(cmd, args, { cwd = ROOT, env = {}, logFile, capture = true, tag } = {}) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const child = spawn(cmd, args, { cwd, env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
    const stream = logFile ? createWriteStream(logFile, { flags: "a" }) : null;
    let stdout = "";
    const onData = (buf) => {
      const s = buf.toString();
      if (capture) stdout += s;
      if (stream) stream.write(s);
      if (tag) process.stdout.write(s.replace(/^/gm, `${tag} `));
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("close", (code, signal) => {
      if (stream) stream.end();
      resolve({ code: code ?? (signal ? 128 : 1), signal, durationMs: Date.now() - t0, stdout });
    });
    child.on("error", (err) => {
      if (stream) stream.end(`spawn error: ${err.message}\n`);
      resolve({ code: 127, durationMs: Date.now() - t0, stdout: stdout + err.message });
    });
  });
}

// Build-once staleness rule (same as the harnesses): dist/index.html older than any source under the four roots.
function newestMtime(dir) {
  let newest = 0;
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop();
    let entries = [];
    try {
      entries = readdirSync(d, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (e.name === "node_modules" || e.name === "dist" || e.name.startsWith(".")) continue;
      const p = path.join(d, e.name);
      try {
        if (e.isDirectory()) stack.push(p);
        else newest = Math.max(newest, statSync(p).mtimeMs);
      } catch {
        /* ignore */
      }
    }
  }
  return newest;
}

export function distIsStale() {
  const distIndex = path.join(APP_DIR, "dist", "index.html");
  if (!existsSync(distIndex)) return { stale: true, reason: "dist missing" };
  const distMtime = statSync(distIndex).mtimeMs;
  const roots = [
    path.join(APP_DIR, "src"),
    path.join(APP_DIR, "index.html"),
    path.join(ROOT, "showcase", "migrated"),
    path.join(ROOT, "repos", "bklit-ui", "packages", "ui", "src"),
  ];
  let srcMtime = 0;
  for (const r of roots) {
    try {
      srcMtime = Math.max(srcMtime, statSync(r).isDirectory() ? newestMtime(r) : statSync(r).mtimeMs);
    } catch {
      /* ignore */
    }
  }
  return srcMtime > distMtime
    ? { stale: true, reason: `sources newer than dist (${new Date(srcMtime).toISOString()} > ${new Date(distMtime).toISOString()})` }
    : { stale: false, reason: "dist fresh" };
}

/** Build bench/app exactly once per gate run. Returns {built, reason, code, durationMs}. */
export async function buildDistOnce(tag, { force = false, skip = false, logFile } = {}) {
  if (skip) return { built: false, reason: "--no-build", code: 0, durationMs: 0 };
  const st = distIsStale();
  if (!force && !st.stale) {
    log(tag, `bench/app dist is fresh — no rebuild`);
    return { built: false, reason: st.reason, code: 0, durationMs: 0 };
  }
  log(tag, `building bench/app (${force ? "--force-build" : st.reason})...`);
  const r = await runCmd("npm", ["run", "build"], { cwd: APP_DIR, logFile });
  if (r.code !== 0) throw new Error(`${tag} bench/app build failed (exit ${r.code}); see ${logFile ?? "stdout"}`);
  log(tag, `build done in ${fmtMs(r.durationMs)}`);
  return { built: true, reason: st.reason, code: r.code, durationMs: r.durationMs };
}

// One vite preview per port, same command line as the harnesses.
async function serverUp(url) {
  try {
    const res = await fetch(url);
    return res.ok;
  } catch {
    return false;
  }
}

export async function startPreview(tag, port, { logFile, reuse = false } = {}) {
  const url = `http://localhost:${port}`;
  if (await serverUp(url)) {
    if (reuse) {
      log(tag, `reusing server already listening on ${url}`);
      return { url, pid: null, stop: async () => {} };
    }
    throw new Error(`${tag} port ${port} is already serving (${url}); stop it or pass --reuse-server`);
  }
  log(tag, `starting vite preview on ${url} ...`);
  const stream = logFile ? createWriteStream(logFile, { flags: "a" }) : null;
  const child = spawn("npm", ["run", "preview", "--", "--port", String(port), "--strictPort"], {
    cwd: APP_DIR,
    stdio: ["ignore", "pipe", "pipe"],
    detached: true, // own process group so we can kill vite + its npm wrapper together
  });
  child.stdout.on("data", (b) => stream && stream.write(b));
  child.stderr.on("data", (b) => stream && stream.write(b));
  const t0 = Date.now();
  while (!(await serverUp(url))) {
    if (Date.now() - t0 > 60_000) {
      try { process.kill(-child.pid, "SIGTERM"); } catch { /* ignore */ }
      throw new Error(`${tag} preview on ${url} did not come up in 60s`);
    }
    await sleep(250);
  }
  log(tag, `preview ready at ${url} (pid ${child.pid})`);
  return {
    url,
    pid: child.pid,
    stop: async () => {
      try { process.kill(-child.pid, "SIGTERM"); } catch { /* ignore */ }
      await sleep(300);
      try { process.kill(-child.pid, "SIGKILL"); } catch { /* ignore */ }
      if (stream) stream.end();
    },
  };
}

// ---------------------------------------------------------------------------
export function readRoster(file) {
  return readFileSync(file, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const [chart, n, state] = l.split(/\s+/);
      return { chart, n: Number(n), state: state === "loading" ? "loading" : undefined };
    });
}

export function jobKey(j) {
  return `${j.chart}/${j.n}${j.state ? `/${j.state}` : ""}`;
}

export async function runPool(jobs, workers, fn, onDone) {
  const results = new Array(jobs.length);
  let next = 0;
  async function worker(id) {
    for (;;) {
      const i = next++;
      if (i >= jobs.length) return;
      results[i] = await fn(jobs[i], id, i);
      if (onDone) onDone(results[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, workers) }, (_, id) => worker(id)));
  return results;
}

export function mdTable(headers, rows) {
  const esc = (v) => String(v ?? "").replace(/\|/g, "\\|");
  return [
    `| ${headers.map(esc).join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((r) => `| ${r.map(esc).join(" | ")} |`),
  ].join("\n");
}

export function pct(n, d) {
  return d ? (100 * n) / d : 0;
}

export function relPath(p) {
  return path.relative(ROOT, p);
}

// GUARD: shared QA lock for port 5198 + bench/app/dist, same mkdir lock other agents use; held for the whole batch.
export const QA_LOCK_DIR =
  process.env.QA_LOCK_DIR ??
  "/private/tmp/claude-501/-Users-tomasdomingos-bklit-tanstack-charts-migration/18004630-5cf2-458a-8984-0bb5f70c912c/scratchpad/qa.lock";

let qaLockDepth = 0; // re-entrant within one process

function lockOwnerAlive() {
  try {
    const pid = Number(readFileSync(path.join(QA_LOCK_DIR, "pid"), "utf8").trim());
    if (!pid) return false;
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function portListening(port) {
  try {
    execFileSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN"], { stdio: ["ignore", "pipe", "ignore"] });
    return true;
  } catch {
    return false;
  }
}

// GUARD: mkdir lock + pid file; a lock whose owner is gone with nothing on 5198 is stale and gets broken.
export async function acquireQaLock(tag, { maxWaitMs = 25 * 60_000 } = {}) {
  if (qaLockDepth > 0) {
    qaLockDepth++;
    return () => { qaLockDepth--; };
  }
  const t0 = Date.now();
  let announced = false;
  for (;;) {
    try {
      mkdirSync(QA_LOCK_DIR);
      writeFileSync(path.join(QA_LOCK_DIR, "pid"), `${process.pid}\n`);
      qaLockDepth = 1;
      break;
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
      if (!lockOwnerAlive() && !portListening(QA_PORT)) {
        log(tag, `breaking stale QA lock ${QA_LOCK_DIR} (owner gone, nothing on ${QA_PORT})`);
        rmSync(QA_LOCK_DIR, { recursive: true, force: true });
        continue;
      }
      if (!announced) {
        announced = true;
        log(tag, `waiting for QA lock ${QA_LOCK_DIR} (another harness run holds it)`);
      }
      if (Date.now() - t0 > maxWaitMs) throw new Error(`${tag} timed out waiting for ${QA_LOCK_DIR}`);
      await sleep(3000);
    }
  }
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    qaLockDepth = 0;
    try { rmSync(QA_LOCK_DIR, { recursive: true, force: true }); } catch { /* ignore */ }
  };
  const onSignal = () => { release(); process.exit(130); };
  process.on("exit", release);
  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);
  log(tag, `QA lock acquired (${QA_LOCK_DIR}) after ${fmtMs(Date.now() - t0)}`);
  return release;
}

export function distFingerprint() {
  const dist = path.join(APP_DIR, "dist");
  try {
    const assets = readdirSync(path.join(dist, "assets")).sort();
    const mtime = new Date(statSync(path.join(dist, "index.html")).mtimeMs).toISOString();
    return { indexMtime: mtime, assets };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Tree hash (V4.4): every gate run records the tree under test so a fresh clone
// re-derives the verdict. run-all/run-checks write <runDir>/tree-hash (=
// `git rev-parse HEAD`, plus a `dirty` marker when tracked files differ) and
// publish it to qa/gate/latest/. Stages that read an earlier stage's artefacts
// call assertTreeHash and refuse on a real mismatch; a missing hash is a
// pre-V4.4 artefact (warn, do not refuse) so old baselines stay readable.

export function currentHead() {
  try {
    return execSync("git rev-parse HEAD", { cwd: ROOT, encoding: "utf8" }).trim() || null;
  } catch {
    return null;
  }
}

export function treeIsDirty() {
  try {
    const s = execSync("git status --porcelain", { cwd: ROOT, encoding: "utf8" });
    return s.split("\n").some((l) => l && !l.startsWith("??"));
  } catch {
    return false;
  }
}

export function writeTreeHash(dir) {
  const head = currentHead();
  if (!head) {
    log("[tree-hash]", "no git HEAD — skipping");
    return null;
  }
  const dirty = treeIsDirty();
  const p = path.join(ensureDir(dir), "tree-hash");
  writeFileSync(p, dirty ? `${head}\ndirty\n` : `${head}\n`);
  publishLatest([p]);
  log("[tree-hash]", `${head.slice(0, 12)}${dirty ? " +dirty" : ""} -> ${relPath(p)} (+ latest)`);
  return { head, dirty };
}

export function assertTreeHash(dir, { allow = false, tag = "[tree-hash]" } = {}) {
  let lines = null;
  try {
    lines = readFileSync(path.join(dir, "tree-hash"), "utf8").trim().split("\n").filter(Boolean);
  } catch {
    lines = null;
  }
  if (!lines || !lines.length) {
    log(tag, `WARNING: no tree-hash in ${relPath(dir)} (pre-V4.4 artefact, hash unknown) — continuing`);
    return { status: "unknown" };
  }
  const head = currentHead();
  const stored = lines[0];
  const dirty = lines[1] === "dirty";
  if (head && stored !== head && !allow) {
    throw new Error(
      `${relPath(dir)} artefacts are from ${stored.slice(0, 12)}${dirty ? " (dirty worktree)" : ""} but HEAD is now ${head.slice(0, 12)} — re-run the producing stage so the verdict re-derives, or pass --allow-hash-mismatch`,
    );
  }
  return { status: stored === head ? "match" : "mismatch-allowed", stored, head, dirty };
}

// ---------------------------------------------------------------------------
// Hand rulings (V4.4): QA cells accepted by a written D-entry in the archived
// phase-6 LOG (D498, via D493/D495) live in qa/gate/rulings.json as
// cell id -> { bound, ruling }. run-qa (via buildMatrix) and summarize consult
// them: a gate-FAIL cell with px <= bound reads `ruled (<D>)` instead of FAIL.

let rulingsCache = null;

export function loadRulings() {
  if (!rulingsCache) {
    try {
      rulingsCache = JSON.parse(readFileSync(path.join(ROOT, "qa", "gate", "rulings.json"), "utf8")).cells ?? {};
    } catch {
      rulingsCache = {};
    }
  }
  return rulingsCache;
}

export function rulingFor(chart, n, state, cell) {
  const R = loadRulings();
  return R[`${chart}/${n}/${cell}`] ?? (state === "loading" ? R[`${chart}/${n}/loading/${cell}`] : undefined) ?? null;
}

/** Stamp row.ruled (the D-entry) on gate-FAIL rows a hand ruling accepts. Returns the count. */
export function applyRulings(rows) {
  let n = 0;
  for (const r of rows) {
    if (r.gate !== "FAIL" || typeof r.px !== "number" || r.ruled) continue;
    const rule = rulingFor(r.chart, r.n, r.state, r.cell);
    if (rule && r.px <= rule.bound) {
      r.ruled = rule.ruling;
      n++;
    }
  }
  return n;
}
