# Harness parallelization audit (Phase 4.4 input)

Read-only audit of `qa/` + `bench/` batching/concurrency headroom, commissioned per D246.
All numbers measured on this machine (Apple M1, 8 cores, 16 GB) on 2026-08-22 unless cited
otherwise. Evidence uses `file:line` references to the current working tree.

**Methods / probes run (nothing under qa/, bench/, repos/, or source was modified):**
- `node qa/console-errors.mjs` against a pre-warmed :5198 preview — full sweep timed at **68.1 s** (19 page loads).
- Standalone Playwright probe mirroring `captureLoad` (line n=1000, bklit + migrated): per-load cost, serial vs concurrent A/B.
- `npm run build` in bench/app: **4.6 s** wall (vite, 1.57 MB bundle).
- `rebuildIfStale` 4-root mtime scan re-implemented verbatim: **11 ms**.
- `chromium.launch()` headless: **141 ms**; fresh context+page: **47 ms**; `pixelmatch` 1200×800: **~10 ms**.
- Port-binding probe: `npm run preview -- --port 5290 --strictPort` from bench/app → vite binds **5290** (last `--port` flag wins; the script's own 5199 is overridden). Verified live, probe server killed after.
- Found an **orphaned `vite preview` still listening on :5199** during the audit (leftover from a crashed/killed harness run) — live evidence of the server-reuse hazard in §3.

---

## 1. Per-invocation batching

**`qa/screenshot.mjs` is strictly one chart per invocation.** `parseArgs` accepts a single
`--chart` (qa/screenshot.mjs:1071-1087), `main` runs exactly one `runComparison`
(qa/screenshot.mjs:1125), and `process.exit` terminates on the first chart's verdict
(qa/screenshot.mjs:1151). There is no `--all` / chart-list mode. Adding one is mechanical:
loop `runComparison` over a chart array and aggregate verdicts.

**Fixed per-invocation overhead (measured, warm — dist fresh, server already up):**

| Component | Cost | Evidence |
|---|---|---|
| node startup + imports | ~100–150 ms | observed |
| `rebuildIfStale` mtime scan | **11 ms** | re-implemented scan, 4 roots |
| rebuild (only when stale) | **4.6 s** | timed `npm run build` in bench/app |
| `ensureServer` reuse check | ~5 ms (fetch to localhost) | qa/screenshot.mjs:1046-1053 |
| server boot (only when cold) | ~1–2 s | vite preview cold start |
| `chromium.launch` | **141 ms** | measured |
| **Total warm fixed** | **~0.3–0.5 s** | |
| **Total cold fixed** | **~6–8 s** (rebuild + boot) | |

**Per-chart marginal cost (measured, line n=1000):**

| Phase | Cost | Evidence |
|---|---|---|
| nav → `__benchPaintDone` | ~200 ms | probe |
| `__benchSettled` + 200 ms margin + settled shot | ~1.3 s | probe (bklit reveal ≈1.15 s + margin) |
| 3 hover states (30 ms + 10-step move + **700 ms `HOVER_WAIT_MS`** + shot each) | ~2.9 s | probe; qa/screenshot.mjs:89 |
| A+B pair, **already concurrent** via `Promise.all` | **~4.6 s wall** | probe: serial 9.3 s → concurrent 4.6 s; qa/screenshot.mjs:853-856 |
| pixelmatch ×4 + report writes | ~50 ms | measured 9.9 ms/compare |

So the pair wall is **~4.6–5 s per chart** (chart-family branches add fixed waits: legend-hover
+700 ms×3 at qa/screenshot.mjs:327, brush +900 ms×3 at :366/:419, patternarea +300 ms×8 at
:720, marker-fan +900 ms at :680 — e.g. patternarea ≈ 7 s, brush ≈ 7.5 s).

**Verdict:** batching k charts into one invocation saves only ~0.4 s/chart of fixed overhead
(warm) — the real value of a `--charts a,b,c` flag is **orchestration** for the Phase 4.4
gate-runner: one invocation, one summary, one exit code per wave, and it unlocks in-process
multi-chart parallelism (§4), which is where the actual wall-clock win is.

**`qa/console-errors.mjs` is already fully batched** — one invocation sweeps all 19 targets
(qa/console-errors.mjs:6-32) in one browser, serially. Measured **68.1 s total**; of that,
19 × 2.5 s fixed `waitForTimeout` (qa/console-errors.mjs:50) = **47.5 s (70%) is pure sleep**.
Per-load marginal cost is therefore ~1.1 s (nav + error drain). This is the single largest
cheap win in the QA harness: parallel pages (cap ~4) would cut the sweep to ~20–25 s.

**`qa/reveal-probe.mjs`** probes bklit then migrated serially, each in its own browser launch
with a fixed 3.0 s sample window (qa/reveal-probe.mjs:21,97,155-159): ~9–10 s total. The two
impl probes are fully independent → `Promise.all` halves it to ~5 s. Note: its `OUT` path is a
hardcoded stale session-scratchpad path (qa/reveal-probe.mjs:19, a `…claude-501…deaec1e1…/
scratchpad/probe-out/` directory from an old session) — harmless (mkdir recursive) but worth
fixing if the probe is used again.

**`qa/resize-probe.mjs`** is inherently serial: one page, three sequential viewport resizes
with fixed waits (qa/resize-probe.mjs:15,51-57), against the **showcase app :5200**, not the
bench app. ~9–10 s total. Nothing to batch (single chart: sankey), but it is independent of
:5198/:5199 traffic and can run alongside a QA wave for free.

---

## 2. `rebuildIfStale` semantics

Both scripts implement the identical guard (qa/screenshot.mjs:1020-1044, bench/run.mjs:153-177;
D214 rationale at qa/screenshot.mjs:992-996):

1. `distMtime` = mtime of `bench/app/dist/index.html` (0 if missing).
2. `srcMtime` = max recursive mtime over 4 roots: `bench/app/src`, `bench/app/index.html`,
   `showcase/migrated`, `repos/bklit-ui/packages/ui/src` (node_modules/dist/dotfiles skipped).
3. If `distMtime === 0 || srcMtime > distMtime` → `npm run build` in bench/app (**4.6 s** measured).
4. Only **after** the rebuild does `ensureServer` fetch-check the port and reuse a running
   server — correct, because `vite preview` serves dist from disk, so a rebuild propagates to
   a reused server without a restart.

**Measured scan cost: 11 ms** (4 roots, warm FS cache). The scan itself is never the problem;
the 4.6 s build is, and it currently runs **unconditionally-sequentially per invocation** when
stale.

**Race: two concurrent QA processes.** There is no lock anywhere (grep for lockfile /
proper-lockfile / process.env across qa/ and bench/: zero hits). If two processes start
while stale:

- Both run the 11 ms scan, both see stale, both spawn `npm run build` **into the same dist/**.
  Vite empties `outDir` at build start, so the two builds race: one can fail on transient
  ENOENT, or worse, both "succeed" while a third process's already-loaded pages hold references
  to now-deleted hashed assets → 404s mid-capture. Probability is low (the stale window is
  usually closed by the first invocation of the day) but the failure mode is silent corruption
  of the other process's run, which is exactly what a QA gate must never be.
- A rebuild landing **while another process is mid-captures** (not just mid-startup) has the
  same stale-asset 404 hazard. Today nothing prevents a wave's gate-runner from rebuilding
  while a teammate's ad-hoc `pnpm qa` is capturing.

**Proposed patch (PROPOSAL ONLY — not applied):** a mkdir-lock serializing builds + a
`QA_SKIP_REBUILD` escape hatch for callers that know dist is fresh (e.g. the second of two
concurrent processes, or after an explicit `pnpm build:app`):

```diff
--- a/qa/screenshot.mjs
+++ b/qa/screenshot.mjs
@@ async function rebuildIfStale(tag) {
 async function rebuildIfStale(tag) {
+  if (process.env.QA_SKIP_REBUILD === "1") {
+    console.log(`${tag} QA_SKIP_REBUILD=1 -- skipping stale-build check`);
+    return;
+  }
+  const lockDir = path.join(APP_DIR, ".build-lock");
+  for (;;) {
+    try {
+      mkdirSync(lockDir); // atomic create: winner builds
+      break;
+    } catch (e) {
+      if (e.code !== "EEXIST") throw e;
+      const age = Date.now() - statSync(lockDir).mtimeMs;
+      if (age > 120_000) {
+        // stale lock (crashed builder): take over
+        try { rmdirSync(lockDir); continue; } catch {}
+      }
+      console.log(`${tag} waiting for concurrent bench/app build...`);
+      await new Promise((r) => setTimeout(r, 500));
+    }
+  }
+  try {
   const distIndex = path.join(APP_DIR, "dist", "index.html");
   const distMtime = existsSync(distIndex) ? statSync(distIndex).mtimeMs : 0;
   const sourceRoots = [ /* unchanged */ ];
   const srcMtime = Math.max( /* unchanged */ );
   if (distMtime === 0 || srcMtime > distMtime) {
     console.log(/* unchanged */);
     await run("npm", ["run", "build"], { cwd: APP_DIR });
   }
+  } finally {
+    try { rmdirSync(lockDir); } catch {}
+  }
 }
```

(`rmdirSync` must be added to the `node:fs` import at qa/screenshot.mjs:40; mirror identically
in bench/run.mjs:153. Risk: a SIGKILLed builder leaves the lock — the 120 s stale-age takeover
bounds the damage. Saving: eliminates double 4.6 s builds and, more importantly, the
cross-process dist-corruption failure mode. `QA_SKIP_REBUILD=1` also lets the gate-runner
pre-build once and launch N parallel QA processes with zero repeated scans/builds.)

---

## 3. Multi-server concurrency

**Port is NOT overridable today — but the fix is nearly zero.** Both scripts hardcode
`const PORT = 5198` (qa/screenshot.mjs:48) / `const PORT = 5199` (bench/run.mjs:36) and build
`BASE_URL` from it. However:

- `bench/run.mjs` **already has `--base-url`** (bench/run.mjs:73, consumed at :803) — an
  external server is fully supported there today.
- `qa/screenshot.mjs` has no equivalent flag, and neither script reads an env var. But the
  spawned command appends `--port <PORT> --strictPort` **after** the npm script's own
  `--port 5199` (qa/screenshot.mjs:1058, bench/run.mjs:192), and I verified live that vite
  preview's **last `--port` flag wins** (bound :5290 with `--port 5199 --port 5290` on the
  same command line). So the spawn-side override already works; only the const is in the way.

**Proposed patch (PROPOSAL ONLY):**

```diff
--- a/qa/screenshot.mjs
+++ b/qa/screenshot.mjs
@@
-const PORT = 5198;
+const PORT = Number(process.env.QA_PORT ?? 5198);
 const BASE_URL = `http://localhost:${PORT}`;
```

```diff
--- a/bench/run.mjs
+++ b/bench/run.mjs
@@
-const PORT = 5199;
+const PORT = Number(process.env.BENCH_PORT ?? 5199);
 const BASE_URL = `http://localhost:${PORT}`;
```

(One line each; `--base-url` on bench/run.mjs keeps working since it overrides `BASE_URL` at
bench/run.mjs:803. Optionally add `--base-url` to qa/screenshot.mjs for symmetry.)

**Would two QA processes on two ports produce identical pixels? Yes** — with two hygiene
fixes:

- *Capture determinism:* each load gets a fresh `browser.newContext` with hardcoded
  `VIEWPORT 1200×800` + `DEVICE_SCALE_FACTOR 1` (qa/screenshot.mjs:51-52, 214-220) and the
  settled gate waits on the event-driven `window.__benchSettled` plus fixed margins
  (`HOVER_WAIT_MS` 700 ms, :89) — no wall-clock or global-state dependence. My probe ran two
  concurrent loads in one browser with no diff-relevant interference, and `runComparison`'s
  existing `Promise.all` (qa/screenshot.mjs:853-856) already relies on this. Two *processes*,
  each with its own browser, share even less state. The only CPU-load caveat: heavy parallel
  load could in principle stretch a spring-based settle past its fixed margins — see §4.
- *Hazard 1 — shared `qa/results` dir:* output dir is
  `qa/results/<chart>/<ISO-timestamp>/` (qa/screenshot.mjs:858-860). Timestamps have ms
  resolution and dirs are chart-namespaced, so a collision needs two runs of the SAME chart
  started within the same millisecond — effectively impossible across processes. **No
  collision risk in practice**; the only cosmetic quirk is that sibling runs of the same chart
  interleave in `ls` ordering.
- *Hazard 2 — same dist dir:* covered by the §2 lock + `QA_SKIP_REBUILD`. With those in
  place, two QA processes against two preview servers of the same dist are safe.
- *Hazard 3 — orphaned servers:* `server.stop()` kills the spawned child only if THIS process
  booted it; a reused server is left running by design (qa/screenshot.mjs:1050-1052), and a
  crashed run leaves its spawned server orphaned (an orphan on :5199 was live during this
  audit). With per-process ports this becomes benign (each process owns its port), but a
  periodic `lsof -ti :5198,:5199 | xargs kill` hygiene step (or a `--kill-server` flag) is
  worth adding to the wave-runner's teardown.

**Net effect:** with the one-line port patches + §2 lock, Phase 4.4 can run e.g. 2–3 QA
shards (`QA_PORT=5301..5303`) plus an exclusive bench run (`:5199`) simultaneously on this
8-core machine with no interference.

---

## 4. In-process parallelism

**Current state:** within one invocation, only the A/B pair is parallel
(`Promise.all` at qa/screenshot.mjs:853-856). Multiple charts would be serial today (moot —
only one chart per invocation, §1).

**Feasibility:** high. `captureLoad` is already context-scoped and takes `browser` as a
parameter; a `--charts a,b,c` mode could `Promise.all` N `runComparison` calls over one shared
`chromium.launch()` (141 ms amortized to zero). Each chart uses its own context/page; the
chart-specific branches (legend/brush/markers/etc.) are all page-local `page.evaluate` calls —
no cross-chart globals.

**Measured scaling evidence (line n=1000 pair):** serial 9.3 s → concurrent 4.6 s (1.0×
speedup for 2 loads, i.e. near-perfect overlap at 2-way concurrency on 8 cores). Extrapolating
conservatively (headless Chromium ≈ 0.5–1 core per idle-ish page; captures are mostly
sleeping): 4 charts in parallel ≈ 3–3.5× throughput vs serial.

**Settle-detection flake risk — checked, low:** "settled" is NOT a fixed sleep. It is
event-driven per chart family (bench/app/src/bench/settle.ts):
- bklit cartesian: `onPhaseChange` non-ready→ready transition (`armBklitSettle`, :38-58);
- tanstack: first `onRender` + double-rAF (`armTanstackSettle`, :69-89);
- candlestick: replicates bklit's internal `setTimeout(animationDuration)` + double-rAF
  (`armBklitTimerSettle`, :115-123);
- manual scenario-driven resolve (liveline, legend, sunburst: `armManualSettle`, :150-161);
- all arms carry only a 2500 ms **fallback** timeout (:25) that is not expected to fire.

The QA capture adds fixed margins on top (`__benchSettled` + 200 ms, hover +700 ms). CPU
contention would have to stretch a reveal by >200 ms past its natural end (or delay rAFs by
>500 ms past `HOVER_WAIT_MS`) to flip a gate — possible in principle at 6+ concurrent pages,
not plausible at 2–4 on 8 cores. The 0.1% self-test gate remains the tripwire: any
contention-induced nondeterminism shows up there first, exactly as designed.

**Recommended shape:** parallelize **charts** (each already an independent pair), cap
concurrency at 3–4 (≈ half the cores), keep A/B of one chart on the same worker so a failure
is attributable to one chart. Expected gain on a 12-chart wave: ~12×4.7 s ≈ 56 s serial →
~16–20 s at 3–4-way.

---

## 5. Bench decomposition

**Timing sensitivity by metric (from bench/run.mjs's measurement code):**

| Metric | Sensitive to concurrent load? | Why |
|---|---|---|
| M1a mount-to-paint | **Yes** | in-page `performance.measure` duration (bench/run.mjs:358-362) — CPU contention inflates it |
| M1b settle | Mostly robust | event-driven settle (settle.ts), but the 2500 ms fallback (:25) can clip under extreme load; treat as timing |
| M1c script/task deltas | **Yes** | CDP ScriptDuration/TaskDuration deltas (:372-374) — contention inflates directly |
| M2a idle CPU | **Yes** | 5 s idle ScriptDuration/TaskDuration window (:411-416) — any concurrent JS inflates it |
| M2b heap after GC | Mostly robust | forced GC then read (:419-420); other processes' pages don't share this heap. Mild risk: GC timing under load |
| **M2c bundle cost** | **Not at all** | read from static `bench/results/bundle-sizes.json` (:40-43, :784) — zero runtime cost |
| M3a update latency | **Yes** | 30 × `__benchUpdate()` durations (:423-427) |
| M3b live FPS | **Yes, most** | rAF-timestamp FPS over 5 s (:659-675) — contention directly lowers FPS |
| M3c hover frames | **Yes** | rAF frame times + per-move script (:480-524) |
| M3d brush drag | **Yes** | same collection model as M3c (:539-602) |

**Sharding mechanics — already supported:** `--chart X --impl Y --n N` selects one combo
(bench/run.mjs:814-821) and `--base-url` attaches to an external server (:73, :803). Each
invocation writes its own `bench/results/<timestamp>/results.json` (:845-864), and
`bench/report.mjs` merges ALL run dirs keeping the newest value per combo (bench/report.mjs:2-20,
:240) — so a sharded sweep produces exactly the same BENCHMARKS.md as one `--all`, and the
`latest.json` clobber hazard becomes irrelevant to reporting.

**Derived `--all` cost model (from `bench/results/2026-07-30T21-29-14-979Z/results.json`,
the newest complete 24-combo run):**

- Sum of M1b medians over the 24 combos: **29.4 s** of mandatory settle per measured pass.
- Per combo: 8 page loads (1 warmup + 7 measured) × [nav ~0.5 s + M1b + 5 s idle (IDLE_MS,
  bench/run.mjs:47) + M3a ~0.4 s + M3c sweep ~1.3 s + misc ~0.5 s] ≈ **7.2 s fixed + 8 × M1b**.
- Analytic total: **≈ 28.6 min exclusive** for the 24-combo matrix (excl. startup/build);
  per-combo average ≈ 71 s; the 5 s idle alone is 40 s/combo = **~56% of the whole matrix**.
- liveline adds M3b: 4 passes × 5 s + overhead ≈ +30 s per (impl, n) — not in the July pilot
  matrix but relevant to Phase 4 waves that bench liveline.
- Fixed startup: server boot ~1–2 s + browser launch 0.14 s + (if stale) 4.6 s build ≈
  **≤ 15 s per invocation** — this is what per-chart sharding pays k times.

**Empirical warning from the artifacts:** two "complete" 24-combo runs exist with output
timestamps only **41 s apart** (2026-07-30T21-28-33 and 21-29-14) — impossible for a serial
`--all` (≥16 min of idle time alone). Their M1b medians agree within ~1–3 ms on 20/24 combos
but diverge up to ~17% on heavy ones (bklit/bar n=10000: 10201 vs 11040 ms; scatter n=10000
up to ~60%). The only consistent explanation is two bench processes running concurrently
against the shared :5199 (both reusing one server, both clobbering `latest.json`, mtimes later
clobbered by a checkout). Treat both July 30 runs as **tainted for timing** — and treat this
as the concrete demonstration that bench MUST stay exclusive per port (D16/D246 doctrine),
while also showing that "reuse an already-running server" silently merges concurrent runs.

**Decomposition recipe:** (a) exclusive timing pass = everything except M2c — i.e. all of
bench/run.mjs as-is, run alone; (b) the only parallelizable piece, M2c, is already a static
JSON read — there is nothing to move. The real split is therefore **per-chart sharding of the
exclusive pass across sequential slots** (not parallel), which converts one 29 min invocation
into k resumable ~2.5 min invocations — same total, but schedulable, restartable, and
per-chart attributable. Parallel bench shards are possible only across *ports* (2 × `BENCH_PORT`
+ 2 × `--base-url`) at the cost of M1/M2/M3 inflation risk — not recommended for gate numbers;
if ever used, restrict to M2b-only comparisons.

---

## 6. Gate-runner design input (concrete recipe)

Given D246's "single gate-runner sweeps affected-chart QA + console errors serially; bench
compare once per wave in an exclusive slot", the fastest safe shape on this 8-core machine:

**Setup (once per wave, before any parallel work):**
```bash
pnpm --dir bench/app build          # 4.6 s; closes the staleness window for everyone
# start 3 preview servers (or let the first QA on each port boot them):
QA_PORT=5301 node qa/screenshot.mjs ... &  # etc. — after the §3 patch
```

**Lane A — QA gates, parallel across charts (after the §1+§3+§4 patches):**
```bash
node qa/screenshot.mjs --charts line,area,bar,scatter,candlestick,composed \
  --impl-a bklit --impl-b migrated --n 100 --concurrency 3 --base-url http://localhost:5301
```
- 6 charts × ~4.7–5 s ÷ 3-way ≈ **~12–15 s** (vs ~30 s serial, vs ~6 × 6.5 s = 39 s as six
  separate process invocations today).
- With NO harness patches, the same lane today = 6 sequential invocations sharing :5198 ≈
  39 s + 6 × 0.4 s fixed ≈ **41 s** — the patches buy ~2.5–3× on this lane.

**Lane B — console sweep (independent, runs alongside Lane A on a different port):**
```bash
QA_PORT=5302 node qa/console-errors.mjs
```
- 68 s today; ~20–25 s after the §1 parallel-pages patch. Safe concurrently with Lane A
  (different port, error-only assertions, no pixel timing).

**Lane C — bench compare (exclusive, after A+B go quiet):**
```bash
node bench/run.mjs --chart <chart> --impl bklit --n 100   # per affected chart, sequential
# or, for a full matrix: node bench/run.mjs --all          # ≈ 29 min exclusive
```
- Per-combo sharding keeps every invocation ≤ ~2.5 min and resumable; report.mjs merges shards
  automatically.

**Ordering:** build → [Lane A ∥ Lane B] → Lane C. Expected wave wall-clock for a 6-chart
wave with one bench combo: ~4.6 s build + ~15 s QA + ~25 s console (overlapped) + ~75 s bench
≈ **~2 min**, vs ~5.5 min fully serial today. The dominant remaining cost is bench idle time
(56% of bench wall is the M2a sleep) — irreducible without changing the metric contract.

---

## Proposed patches

**P1 — `--charts` list + `--concurrency` in qa/screenshot.mjs** (enables §1 batching + §4
parallelism). Sketch:

```diff
--- a/qa/screenshot.mjs
+++ b/qa/screenshot.mjs
@@ function parseArgs(argv) {
   const args = { selfTest: false };
   for (let i = 0; i < argv.length; i++) {
     const a = argv[i];
     if (a === "--self-test") args.selfTest = true;
     else if (a === "--chart") args.chart = argv[++i];
+    else if (a === "--charts") args.charts = argv[++i].split(",");
+    else if (a === "--concurrency") args.concurrency = Number(argv[++i]);
```
```diff
@@ async function main() {
-  outcome = await runComparison(browser, BASE_URL, { chart: args.chart, ... });
+  const charts = args.charts ?? [args.chart];
+  const limit = args.concurrency ?? 1;
+  const outcomes = [];
+  let failed = false;
+  for (let i = 0; i < charts.length; i += limit) {
+    const batch = charts.slice(i, i + limit);
+    const results = await Promise.all(batch.map((chart) =>
+      runComparison(browser, BASE_URL, { chart, n, implA, implB, selfTest: args.selfTest, state: args.state })
+        .then((o) => { printReport(o); return o.report.overallPass; })
+        .catch((e) => { console.error(`[qa] ${chart}: ${e.message}`); return false; })
+    ));
+    if (results.some((r) => !r)) failed = true;
+  }
+  process.exit(failed ? 1 : 0);
```
Risk: low — per-chart state is context-scoped; failure isolation added per chart. Saving:
~2.5–3× on multi-chart QA lanes (39 s → ~14 s for 6 charts) plus one summary/exit code.

**P2 — `QA_PORT`/`BENCH_PORT` env overrides** (§3). One line each (diffs in §3). Risk:
near-zero (defaults unchanged). Saving: enables safe QA∥QA∥console and QA∥(non-gate) work.

**P3 — build mkdir-lock + `QA_SKIP_REBUILD`** (§2). Diff in §2, mirror in bench/run.mjs.
Risk: low (120 s stale-lock takeover). Saving: removes the concurrent-rebuild corruption
mode; saves 4.6 s per redundant rebuild; prerequisite for confident multi-process waves.

**P4 — parallel pages in qa/console-errors.mjs.** Sketch: replace the serial
`for (const [chart, n] of targets)` (qa/console-errors.mjs:37) with a worker pool of 4
`browser.newPage()` lanes; keep per-page logic identical. Risk: low — errors/warnings are
per-page listeners; the 2.5 s settle sleep is per-page and unaffected by other idle pages.
Saving: 68 s → ~20–25 s per full sweep.

**P5 — `--base-url` for qa/screenshot.mjs** (symmetry with bench/run.mjs:73). Two lines in
parseArgs + `const BASE_URL = args.baseUrl ?? \`http://localhost:${PORT}\``. Risk: zero.
Saving: lets the wave-runner pre-boot one server and amortize boot across all lanes.

**P6 (skip) — parallel bench shards.** Rejected for gate numbers: M1a/M1c/M2a/M3a/M3b/M3c/M3d
are all load-sensitive (§5 table); July 30 artifacts show what concurrent bench does to data.
Only M2c (static JSON) is load-free and needs no runtime at all.

## Recommendations (ranked)

| # | Gain | Cost | Risk | Verdict |
|---|---|---|---|---|
| 1 | P2 port env overrides | 2 lines | ~zero | **Adopt** — prerequisite for all multi-process lanes |
| 2 | P3 build lock + `QA_SKIP_REBUILD` | ~25 lines ×2 scripts | low | **Adopt** — removes the only data-corruption mode; enables pre-built parallel waves |
| 3 | P4 parallel console sweep | ~20 lines | low | **Adopt** — biggest single win: 68 s → ~22 s, runs in every wave |
| 4 | P1 `--charts` + `--concurrency` | ~30 lines | low | **Adopt** for Phase 4.4 gate-runner (2.5–3× QA lane) |
| 5 | P5 `--base-url` in QA | 2 lines | zero | **Adopt** (with P1) |
| 6 | P6 parallel bench | — | **high** | **Skip** — keep bench exclusive; shard sequentially instead |

**Combined effect on a Phase 4.4 wave** (6-chart QA + console + 1 bench combo): ~5.5 min
serial → ~2 min, with the bench slot untouched and every gate number as trustworthy as today.
All patches are additive; defaults preserve current behavior bit-for-bit.

---

## Implementation notes (adopted 2026-08-22, D246a)

P1–P5 applied by the lead (qa/ and bench/ are lead-only; the executor-dispatch route was
blocked by the permission layer, correctly). P6 rejected as recommended. Deltas vs the sketches:

- **P2**: applied to all three scripts — qa/screenshot.mjs (`QA_PORT`), bench/run.mjs
  (`BENCH_PORT`), and additionally qa/console-errors.mjs (`QA_PORT`), which §6 Lane B assumed
  but the sketch omitted.
- **P3**: mirrored identically in qa/screenshot.mjs and bench/run.mjs. Both honor the SAME
  env var `QA_SKIP_REBUILD` (deliberate: one pre-build serves a whole wave regardless of
  lane). Lock dir `bench/app/.build-lock` added to .gitignore. Waiter announces once instead
  of every 500 ms poll; lock released in `finally`; vanished-lock stat race retries
  immediately.
- **P1**: batch loop with per-chart failure isolation (`.catch` per chart, others continue),
  per-chart reports printed in input order after all batches, `[qa] batch: k/N charts PASS`
  summary line (batch mode only), aggregate exit code. `--chart` and `--charts` are mutually
  exclusive (explicit error). Single-chart output is line-for-line identical to before.
- **P4**: worker pool (default 4, `QA_CONSOLE_CONCURRENCY` override) over one browser;
  results collected per job and printed in original target order after the pool drains, so
  output stays deterministic and diffable against old runs.
- **P5**: `--base-url` mirrors bench/run.mjs exactly (still runs the stale-build guard;
  a rebuild propagates to the external server since vite preview serves dist from disk).

Default-path smoke (lead-run): `node qa/screenshot.mjs --chart line --impl-a bklit
--impl-b migrated --n 1000` → settled 0.0000%, hover-30/50 0.0000%, hover-70 0.1494%,
overall PASS (`qa/results/line/2026-08-22T11-44-52-609Z`). The run found dist stale (the
concurrent sankey executor had touched showcase/migrated) and exercised the new lock's
winner-builds branch cleanly.

---

## Verification (patches applied by lead, 2026-08-22)

Run-only verification by a second executor after the lead applied patches P1–P5 and ran
the default-path smoke (`qa/results/line/2026-08-22T11-44-52-609Z`, overall PASS — also
exercised the lock's winner-builds branch). Evidence below is appended per check as it
completes.

**Check 1 — syntax:** `node --check qa/screenshot.mjs && node --check qa/console-errors.mjs && node --check bench/run.mjs` → exit 0, no output ("ALL_SYNTAX_OK" sentinel echoed). **PASS.**

**Check 2 — batch-mode smoke (P1 + QA_PORT + QA_SKIP_REBUILD):**
`QA_PORT=5301 QA_SKIP_REBUILD=1 node qa/screenshot.mjs --charts line,area --concurrency 2
--impl-a bklit --impl-b migrated --n 1000`
- Banner `QA_SKIP_REBUILD=1 — skipping stale-build check` printed; server booted on :5301
  ("server ready at http://localhost:5301").
- line n=1000: settled/hover-30/hover-50 0.0000%, hover-70 0.1494% → overall PASS;
  `qa/results/line/2026-08-22T11-50-25-133Z`.
- area n=1000: settled 0.0003%, hover-30/50 0.0001%, hover-70 0.1580% → overall PASS;
  `qa/results/area/2026-08-22T11-50-24-750Z`.
- Final line `[qa] batch: 2/2 charts PASS`; **exit 0**; **wall 6 s** (both result dirs
  stamped within ~0.4 s of each other, confirming the concurrency-2 start overlap).
- **PASS.**

**Check 3 — single-chart flag parity + self-test on env port:**
`QA_PORT=5301 node qa/screenshot.mjs --chart line --self-test --impl-a migrated --n 1000`
- `--chart`/`--self-test` still work alongside the env port; self-test gate correctly
  reported as 0.1%.
- settled/hover-30/hover-50/hover-70 all **0.0000%** → overall PASS;
  `qa/results/line/2026-08-22T11-53-22-787Z`; exit 0; wall 9 s.
- Side observation: dist was stale again (concurrent sankey executor had touched
  showcase/migrated since check 2), so this run took the lock's winner-builds path a second
  time (vite build 2.62 s) and rebuilt cleanly before booting :5301. No lock contention or
  stale artifacts observed. **PASS.**

**Check 4 — console sweep with new worker pool (P4):**
Pre-warmed :5198 first (curl probe DOWN → booted vite preview on :5198 --strictPort,
ready after 1 s; left running per normal harness practice). Then
`node qa/console-errors.mjs` (default QA_PORT 5198, default concurrency 4):
- **exit 0, wall 20 s** vs 68.1 s serial baseline (~3.4x faster).
- All 21 lines **PASS**, zero FAILs, order exactly matches the in-file job list:
  line, line (loading), area, area (loading), bar, scatter, candlestick, composed,
  liveline, heatmap, heatmap (loading), sunburst, profitloss, legend, candlelegend,
  legendhover, brush, markers, patternarea, barsquares, bardepth.
- **Count anomaly (spec-side):** tasking expected "22 lines (19 targets + 3 loading
  variants)", but the patched file's targets array holds **18 targets**
  (qa/console-errors.mjs:6-32) + 3 loading variants = **21 jobs**, and the run printed
  exactly those 21 lines in input order. Output is fully determined by the in-file array,
  so this is a mismatch between the tasking's expected count and the actual list, not a
  dropped line at runtime. (Pre-patch file content unavailable to this executor: git
  history extraction is hook-blocked per D221.) Needs a Fable ruling on which side
  miscounted; pool behavior itself is correct and deterministic. **PASS with noted count
  discrepancy (21 actual vs 22 expected).**

**Check 5 — orphan server cleanup (:5301):**
`lsof -ti :5301` immediately after check 3 → empty (lsof exit 1, no PIDs). The script
killed the vite preview it booted on :5301 in both the batch and self-test runs.
**PASS — no orphan, nothing to kill.**

**Check 6 — build-lock released:** `ls -d bench/app/.build-lock` → exit 1,
"No such file or directory" — lock correctly removed by its `finally` cleanup after all
runs (checks 2–4 included two winner-builds acquisitions). No stale lock older than 2 min;
nothing to report or delete. **PASS.**

**Lead ruling on the check-4 count discrepancy (2026-08-22):** the verification tasking's
"22 lines (19 targets + 3 loading)" was the lead's miscount. `git diff HEAD -- qa/console-errors.mjs`
touches zero target lines; the `targets` array has always held **18 charts** (+3 loading variants
= 21 jobs), and exactly 21 printed, all PASS. Nothing was dropped by the P4 worker pool.
The serial contract is 21 lines. Verification closes fully green: checks 1–6 all PASS.
