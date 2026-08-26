# B4 — exclusive `bench --all` + sankey visual refs (Wave-0 baseline close-out)

Run-only executor notes. Incremental — updated after every step.

## Checklist

1. [ ] Preflight: `git status --short` recorded; ports 5198/5199 checked.
2. [x] Sankey visual refs: verify PNGs in the three post-fix QA result dirs.
   - n=4:    `qa/results/sankey/2026-08-22T12-37-02-035Z`
   - n=33:   `qa/results/sankey/2026-08-22T12-39-35-219Z`
   - n=1000: `qa/results/sankey/2026-08-22T12-37-42-696Z`
3. [ ] Exclusive `node bench/run.mjs --all` run; record results dir(s) + M1/M2/M3 summary per chart/impl.
4. [ ] BENCHMARKS.md surgical updates (sankey refs note, P0.2/P0.1b bench cells, bench baseline section).
5. [ ] Final report: PASS/FAIL per step, fence check (`git status --short` diff vs preflight).

## Results log

### Step 1 — Preflight — DONE

`git status --short`: matches expected Phase-4 dirty set exactly (sankey-mark.ts, sankey-chart.tsx, bench/run.mjs, qa/console-errors.mjs, qa/screenshot.mjs, .gitignore modified; PLAN-phase-4.md, docs/phase-4/, research/phase-4/ untracked). Nothing unexpected flagged.

Ports (lsof):
- **:5199** held by PID 8791 — `node .../bench/app/node_modules/.bin/vite --port 5199` (dev server), elapsed ~2h50m, started Sat Aug 22 10:57:12 2026. Stale/foreign — NOT killed.
- **:5198** held by PID 34949 — `node .../bench/app/node_modules/.bin/vite preview --port 5199 --port 5198 --strictPort`, elapsed ~49m, started 12:58:18 2026 (after the sankey QA runs at ~12:37–12:39). NOT killed.

Decision per brief: **use `BENCH_PORT=5301`** for the exclusive bench run; if QA re-capture were needed it would get `QA_PORT=5301 QA_SKIP_REBUILD=1`. No process killed.

### Step 2 — Sankey visual refs — DONE (verified, no re-capture)

All three dirs complete: 12 PNGs each (settled-a/b/diff, hover-30/50/70 a/b/diff) + report.json. report.json verdicts match the brief exactly:

| dir | n | settled | hover-30 | hover-50 | hover-70 | overallPass |
|---|---|---|---|---|---|---|
| 2026-08-22T12-37-02-035Z | 4 | 0.0008% PASS | 0.1819% PASS | 0.1917% PASS | 0.0924% PASS | **true** |
| 2026-08-22T12-39-35-219Z | 33 | 0.1092% PASS | 1.054% FAIL (pre-existing) | 0.2889% PASS | 0.1732% PASS | false |
| 2026-08-22T12-37-42-696Z | 1000 | 0.3041% PASS | 2.8392% FAIL (pre-existing) | 1.9387% FAIL (pre-existing) | 1.4271% FAIL (pre-existing) | false |

Hover FAILs at n=33/n=1000 are the pre-existing ones deferred to Wave 1 P1.2 per D239 — out of scope here. These three dirs ARE the sankey baseline visual refs.

### Step 3 — Exclusive bench --all

## B4b — harness fix + full rerun (new executor, same dispatch)

Fix the tanstack-cell warmup timeout (`'create' in true` crash), then rerun `bench --all` exclusively.

1. [x] Preflight: git status recorded (matches expected dirty set); stale vite preview pid 34949 on :5198/:5199 left alive; **BENCH_PORT=5302** for all runs.
2. [x] Reproduce: probe `?impl=tanstack&chart=line&n=100` on :5198 → expect `'create' in true` pageerror.
3. [x] Finish diagnosis: name file/line that passes `tooltip: true` into the TanStack definition/host under v0.14.
4. [x] Fix minimally (bench/app or showcase/migrated wiring; NEVER the clone per D232); rebuild with build lock respected.
5. [x] Verify single cells: line + area × {bklit,tanstack} × {n=100,n=1000}, sequential, BENCH_PORT=5302; zero skips, sane magnitudes.
6. [x] Full exclusive `BENCH_PORT=5302 node bench/run.mjs --all`; ps check first; record results dir + M1/M2/M3 summary; zero skipped cells is the gate.
7. [x] BENCHMARKS.md surgical edits: sankey refs note, P0.2/P0.1b bench cells → ✅, bench baseline section with new numbers; mark 2026-08-22T13-14-51-974Z as superseded diagnostic run. NO LOG.md edits.
8. [x] Final report: root cause, fix diff summary, single-cell numbers, full-run dir + headline numbers, anomalies, temp scripts left, fence confirmation.

### Results log

#### Step 2 — Reproduce

CONFIRMED via `scripts/b4b-probe.mjs` against stale :5198 preview:
- `?impl=tanstack&chart=line&n=100` → `paintDone:false, svgs:0, hostHtml:""` + `pageerror: TypeError: Cannot use 'in' operator to search for 'create' in true`
- `?impl=bklit&chart=line&n=100` → `paintDone:true`, 2 svgs, no errors.
- Extra probes (same session): `?impl=migrated&chart=line&n=100` → renders fine (5 svgs); `?impl=tanstack&chart=area&n=100` → same `'create' in true` crash; `?impl=tanstack&chart=gauge&n=100` → renders fine (1 svg). Consistent with tooltip-input-only blast radius.

#### Step 3 — Diagnosis (complete, pre-fix)

**Root cause — exact mechanism:**
- **Who passes `tooltip: true`:** 10 tanstack bench scenarios inject a bare boolean `tooltip: true` into their `defineChart` spec: `bench/app/src/scenarios/tanstack-{line:52, area:51, bar:75, composed:90, scatter:58, candlestick:120, heatmap:143, liveline:172, funnel:99, funnelvertical:79}.tsx`. Control: `tanstack-gaugelinear.tsx:94` uses `tooltip: false` → renders fine (matches radar/gauge probe evidence).
- **Why it throws:** v0.14 `resolveTooltipInput()` (`showcase/repos/tanstack-charts/packages/charts-core/src/renderer.ts:1131–1158`) accepts only `false | undefined | ChartTooltipExtension (has 'create') | { use: extension, ...options }`. On bare `true`, line 1142 executes `'create' in true` → `TypeError: Cannot use 'in' operator to search for 'create' in true`, thrown during definition resolution → no svg → `__benchPaintDone` never set → 30s warmup timeout, every cell skipped.
- **Sanctioned enablement:** the DOM tooltip extension is exported as `tooltip` at subpath `@tanstack/charts/tooltip` (charts-core `src/tooltip.ts:28–33`: `{ id:'tooltip', __chartExtensionType:'tooltip', __chartTooltipHost:'dom', create }`; pkg exports `"./tooltip": "./src/tooltip.ts"`). Canonical usage from the clone's own `scene.test.ts`: `tooltip: { use: tooltipExtension, ...options }` or the bare extension object. Renderer's own error text names this entrypoint.
- **Why it regressed at `7d60a7f`:** that commit changed `bench/app/vite.config.ts` aliases from the vendored v0.7.2 fixture → pinned v0.14.0 clone (a285ce7) and did NOT touch scenario files. Pre-harmonization TanStack tolerated `tooltip: true`; v0.14 ("Harmonize public API contracts", upstream 35832f7) rejects it. Scenario code was silently stale, not wrong-before.
- **migrated impl NOT affected (verified live):** `showcase/migrated/charts/children.tsx:317` emits `out.tooltip = { enabled: true, ...props }`, consumed by migrated's own internal host — it never reaches TanStack's resolver. Probe of `impl=migrated&chart=line&n=100` on current dist: `paintDone:true`, 5 svgs, no errors. So the fix is confined to the 10 scenario files; zero showcase/migrated changes needed. (`syncPortal` at charts-core `tooltip.ts:218–245` shares the pattern but only reads `options.portal`, which nothing in bench sets — not a second instance.)
- **Why QA missed it:** QA runs used `QA_SKIP_REBUILD=1` against a pre-bump dist; any fresh rebuild reproduces this. Fix is real, not bench-specific.

**Fix plan:** in each of the 10 scenario files, add `import { tooltip } from "@tanstack/charts/tooltip";` and change `tooltip: true,` → `tooltip,` (extension-object form, default options — same semantics as legacy `true`). No harness timing/data changes (integrity rule respected). Rebuild bench app under build lock, then single-cell verify.

#### Step 4 — Fix

Applied to 10 scenario files under `bench/app/src/scenarios/` (two-line change each):
1. Added `import { tooltip } from "@tanstack/charts/tooltip";`
2. `tooltip: true,` → `tooltip,` (extension-object form, default options)

Files: tanstack-{line, area, bar, composed, scatter, candlestick, heatmap, liveline, funnel, funnelvertical}.tsx. No other files touched; no harness timing/data changes. Vite config needed no edit (aliases are generated from the package's own exports map, so `@tanstack/charts/tooltip` resolves automatically).

Rebuild: `npm run build` in bench/app → clean in 2.65s (1638 modules), no lock contention (`.build-lock` absent).

Post-fix probe against :5198 preview: tanstack line + area both `paintDone:true`, svg present, **no pageerrors**; gauge control still renders. Fix confirmed live.

#### Step 5 — Single-cell verification

8/8 cells completed un-skipped (`BENCH_PORT=5302`, sequential). Headline medians:

| impl | chart | n | M1a mount→paint ms | M1b settle ms | M2b heap MB | M3a update ms | tooltip appeared |
|---|---|---|---|---|---|---|---|
| tanstack | line | 100 | 24.1 | 35.2 | 4.0 | 32.2 | true |
| tanstack | line | 1000 | 47.0 | 69.6 | 5.0 | 32.5 | true |
| tanstack | area | 100 | 25.2 | 38.9 | 4.1 | 32.1 | true |
| tanstack | area | 1000 | 52.5 | 76.5 | 5.4 | 32.5 | true |
| bklit | line | 100 | 63.2 | 1155.0 | 4.5 | 31.8 | true |
| bklit | line | 1000 | 62.8 | 1163.0 | 5.0 | 32.0 | **false** ⚠ |
| bklit | area | 100 | 62.1 | 1144.1 | 4.5 | 31.9 | true |
| bklit | area | 1000 | 58.7 | 1157.9 | 4.9 | 30.3 | true |

Verdict: magnitudes sane — tanstack M3a within noise of bklit's (~32 vs ~31 ms), no 100× divergence. M1b parity preserved (bklit ~1100ms reveal intentional). Result dirs: `2026-08-22T14-41-24-082Z` … `14-50-04-177Z` (8 dirs).

Anomaly (named, NOT fixed): `bklit/line n=1000` reports `tooltipAppeared=false` — bklit-side hover observation, pre-existing/unrelated to the tooltip-input fix (fix touches only tanstack scenario files). Flagging for lead.

#### Step 6 — Full exclusive rerun

Pre-run ps check: only idle IDE helpers + stale :5198 preview (pid 34949, 0% CPU, untouched) + this session's own node processes. Nothing heavy concurrent.

Command: `BENCH_PORT=5302 node bench/run.mjs --all`, foreground-equivalent background task, ran alone (~30 min wall). **Result: 24/24 cells written, 0 skipped** — gate met.

Results dir: **`bench/results/2026-08-22T15-46-19-823Z`** (+ latest.json). Headline medians (ms):

| chart | n | bklit M1a / M1b / M3a | tanstack M1a / M1b / M3a |
|---|---|---|---|
| line | 100 | 64.7 / 1156.5 / 31.9 | 24.1 / 33.6 / 32.2 |
| line | 1000 | 53.7 / 1154.3 / 32.1 | 47.0 / 66.3 / 32.5 |
| line | 10000 | 65.2 / 1170.7 / 31.9 | 259.8 / 412.5 / 73.8 |
| area | 100 | 66.2 / 1148.5 / 32.0 | 25.1 / 32.8 / 32.1 |
| area | 1000 | 61.9 / 1160.9 / 4.9 heap | 52.8 / 83.1 / 32.5 |
| area | 10000 | 62.9 / 1166.9 / 29.7 | 305.6 / 461.8 / 124.5 |
| bar | 100 | 71.4 / 1599.3 / 32.4 | 33.6 / 52.7 / 32.6 |
| bar | 1000 | 261.9 / 1997.1 / 32.6 | 126.1 / 193.6 / 47.4 |
| bar | 10000 | 2195.1 / 7120.9 / 156.5 | 1052.0 / 1607.6 / 496.3 |
| scatter | 100 | 56.8 / 1155.5 / 32.4 | 28.8 / 42.7 / 32.4 |
| scatter | 1000 | 119.1 / 1264.4 / 32.6 | 91.6 / 138.7 / 34.3 |
| scatter | 10000 | 879.0 / 3140.5 / 70.8 | 728.6 / 1139.8 / 222.1 |

Notes: tanstack M1b stays sub-second everywhere (no reveal animation by design); bklit M1b ~1100ms floor preserved per D-series precedent. Both impls degrade together on bar n=10000 (known degenerate class). `tooltipAppeared=true` on all tanstack cells; only anomaly remains `bklit/line n=1000` false (pre-existing, see Step 5).

#### Step 7 — BENCHMARKS.md close-out

DONE — surgical edits only, structure/voice preserved:
1. B2 sankey row: "visual refs (PNGs) pending B4" → verified-refs statement citing the three sankey QA dirs (n=4/33/1000).
2. Wave-0 table: P0.1b bench cell ⏳ B4 → ✅ (run id + note that sankey isn't in the bench matrix); P0.2 bench cell ⏳ pending B4 → ✅ 24/24 cells, 0 skipped + run dir.
3. §4.4.1 baseline: bench/app run id bullet filled with `2026-08-22T15-46-19-823Z`, explicit supersession note for diagnostic `2026-08-22T13-14-51-974Z` (tanstack cells skipped, `'create' in true`), full 24-row headline median table + notes.
4. `docs/phase-4/LOG.md` NOT touched (lead writes D-entry).

#### Step 8 — Fence confirmation

`git status --short` diff vs preflight — new paths only:
- Modified: 10 × `bench/app/src/scenarios/tanstack-*.tsx` (the fix). No changes to `.gitignore`, `bench/run.mjs`, `qa/*`, `showcase/*` vs preflight (all were already dirty before this dispatch).
- Untracked new: 8 single-cell result dirs + full-run `2026-08-22T15-46-19-823Z` under `bench/results/`; nothing outside `bench/` + pre-existing entries.

Temp scripts left behind (lead cleans up): `scripts/b4b-probe.mjs` (pre-existing from lead's diagnosis, reused), `scripts/sankey-console-check.mjs` (pre-existing, untouched). No new temp scripts created by B4b.

Post-run port check: :5302 free (harness stopped its own preview); stale :5198/:5199 preview pid 34949 still alive, untouched per brief.
