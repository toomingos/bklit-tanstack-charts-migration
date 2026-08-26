# P4.6 executor notes (running log)

## Before-numbers (standalone runs, 2026-08-25, gate 0.5%)

Command shape used (and to be reused after): `node qa/screenshot.mjs --chart <c> --impl-a bklit --impl-b migrated --n <n>`

| chart | n | settled | hover-30 | hover-50 | hover-70 | result dir |
|---|---|---|---|---|---|---|
| scatter | 1000 | 0.4509% PASS | 0.0000% PASS | 0.0779% PASS | 0.2617% PASS | qa/results/scatter/2026-08-25T12-38-17-221Z |
| bar | 100 | 0.0000% PASS | 0.0000% PASS | 0.0757% PASS | 0.1243% PASS | qa/results/bar/2026-08-25T12-38-23-486Z |
| candlestick | 1000 | 0.3025% PASS | 0.4962% PASS | 0.3671% PASS | 0.3627% PASS | qa/results/candlestick/2026-08-25T12-38-29-476Z |
| composed | 1000 | 0.0845% PASS | 0.0000% PASS | 0.1178% PASS | 0.1810% PASS | qa/results/composed/2026-08-25T12-38-36-478Z |
| liveline | 100 | 0.0176% PASS | 0.0546% PASS | 0.0882% PASS | 0.1109% PASS | qa/results/liveline/2026-08-25T12-38-49-266Z |

Notes:
- scatter settled 0.4509% is the pre-existing parity residual (marker AA band), NOT zero. Proof standard for item 1 = after-number equals this before-number, not absolute 0.0000%.

## Item 2 premise check — VERIFIED STABLE

`bench/data.ts:169-189` `generateScatterUpdate`: fixed `start = Date.UTC(2020,0,1)`, `date = new Date(start + i*DAY_MS)` for i<n — identical date range every tick; only `sessions`/`conversions` are reseeded per tick (`:update:${tick}` seed suffix). So the extent VALUES are stable across ticks; only object identity churns because `timeExtentScatter` (scatter-chart.tsx:342-351) keys its useMemo on `renderData`.

Caveat found during reading: stabilizing the extent alone CANNOT stop the `definition` rebuild while marks must close over per-tick data — `definition`'s dep list (:554) includes `renderData` directly (marks consume it) and `yDomain` (:328-337, data-derived max, also changes identity/value every tick since y-values are reseeded). So the cascade chain extent→xScale→definition is only part of the story; measurement will attribute shares.

## Item 1 site inventory (re-grepped, drifted from brief by ~7 lines)

- scatter-chart.tsx:563 (brief said 570)
- bar-chart.tsx:744 (751)
- candlestick-chart.tsx:659 (666)
- composed-chart.tsx:1108 (1114)
- internal/use-hover-chrome.ts:70 (unchanged)
All five: `dateLabelsForPill` useMemo mapping `toLocaleDateString("en-US", { month: "short", day: "numeric" })` per row.

## Item 1 swaps DONE + after-QA (2026-08-25 13:04)

Swaps applied (all five sites now `shortDateFmt.format(v)`; imports added per file, direct `./internal/formatters` module import — barrel untouched, P5.1 fence respected):

| chart | settled before → after |
|---|---|
| scatter 1000 | 0.4509% → 0.4509% (byte-identical) |
| bar 100 | 0.0000% → 0.0000% |
| candlestick 1000 | 0.3025% → 0.3025% |
| composed 1000 | 0.0845% → 0.0845% |
| liveline 100 | 0.0176% → 0.0189% (own noise band) |

Result dirs after: qa/results/{scatter/2026-08-25T13-04-13-162Z, bar/2026-08-25T13-04-19-445Z, candlestick/2026-08-25T13-04-25-402Z, composed/2026-08-25T13-04-31-901Z, liveline/2026-08-25T13-04-44-673Z}. All PASS. Hover phases wiggled within band (composed h50 0.1178→0.0000; scatter h70 0.2617→0.2965).

Sibling sweep result: `toLocaleDateString|toLocaleString|new Intl\.` across showcase/migrated now returns ONLY: heatmap-utils.ts:222-224 module-level singletons (correct), center-stat.tsx:107 caller-supplied formatOptions per call (leave per brief), formatters.ts definitions themselves. NOTE: brief said chart-legend.tsx had an intFmt duplicate owned by P4.4 — current tree shows chart-legend.tsx:5 IMPORTS intFmt from formatters (P4.4 evidently resolved it). No sixth site found.

## Item 3 DONE (funnel prefersReducedMotion conversions)

Re-grepped lines: :451 and :483 (had NOT drifted). Converted both to `usePrefersReducedMotion()` hook (canonical, reactive via useSyncExternalStore). Hook placed at FunnelSegment top (:404) — NO early return above it, no hoist needed. Dep arrays extended with prefersReducedMotion per line-chart.tsx precedent (:707,:717): reveal effect [index, staggerDelay, isHorizontal, prefersReducedMotion] (:476), label effect [index, staggerDelay, prefersReducedMotion] (:502). Behaviour-preserving: same snapshot value on mount (useSyncExternalStore getSnapshot reads the same media query), plus reactivity gain on OS-level toggle mid-session.

Funnel pixel gate REQUESTED: funnel n=1000 and funnelvertical n=1000 (lead runs).

## Item 2 — ROOT CAUSE FOUND AND FIXED: mount reveal replayed on every update tick

Premise check: PASSED (date extent stable across ticks — bench/data.ts:169-189). But measurement (research/phase-4/tools/p46-m3a-attribution.mjs, CDP CPU profile over 30 M3a-style ticks) showed the definition-rebuild share is small, and the dominant cost was something else entirely:

**~2000 `Element.animate()` calls fired on EVERY update tick** (probe p46-animate-count.mjs: perTick=[2000,2000,...]). Mechanism: each tick rebuilds the TanStack scene → the `.ts-chart__marks` group is a NEW DOM node → the `dataset.bkmRevealed="1"` guard died with the old node → `handleRender` (onRender fires after every commit) re-ran the FULL mount reveal per tick: 2000 circle.animate() with blur(2px) keyframes + deadline re-arm + the deferred getAttribute sweep. CPU profile evidence (30 ticks): native `animate` 304ms, `cancel` 15ms, `getAttribute` 26.7ms; 26 Long-Animation-Frames ≥20ms. Scatter was the only host exposed: bar (:185) and candlestick (:169) already have "reveal replay guard by DATA identity"; line/area/composed gate on `chartPhase === "revealing"`; scatter's onRender-driven reveal had no lifetime guard. It also means updated scatter charts visibly replayed their entrance (contradicting the file's own :538-541 comment claiming updates snap per D14 — the comment was aspirational, the code replayed).

**Fix (scatter-chart.tsx only):** three-state guard in handleRender keyed on `hasRevealedRef` + pending deadline: first call → reveal + arm deadline (mount behavior byte-identical); revealed while deadline still pending → group was replaced mid-window, restart reveal (pre-existing self-heal, now bounded to the mount window — needed because the group is genuinely replaced once shortly after mount); revealed after deadline fired → snap (bklit D14 semantics).

**Measured effect (same probe, same session):** per-tick median 42.2 → 32.1ms (−24%), animate-per-tick 2000 → 0, LoAF long frames 26 → 0, animate/cancel gone from profile. QA scatter settled 0.4509% → 0.4509% (byte-identical), all hovers PASS. Two intermediate failures during development, both mine, both caught by gates: (1) first guard version left a replaced group stuck with `--revealing` (opacity 0) → settled FAIL 15.39% — fixed by the bounded-restart branch; (2) second version referenced hasRevealedRef without declaring it (vite build doesn't typecheck) → page crash → QA waitForFunction timeout — fixed by restoring the declaration. Final state green.

**Item 2 memo-cascade verdict: documented NO.** Post-fix profile: total sampled CPU 1023ms/30 ticks ≈ 34ms/tick, of which native paint/raster+idle ≈ 555ms, GC 42ms; ALL JS (React + TanStack + migrated, including the definition rebuild, dot() channel extraction, dateLabelsForPill's 1000 formats) sums to ~380ms ≈ 12.7ms/tick. The extent→xScale→definition cascade is a fraction of that. Stabilizing extent identity would chase single-digit ms and risk parity for no visible win. The remaining bklit-gap (if any persists in the lead's exclusive run) lives in TanStack's DOM reconciliation + native paint of 2000 circles — structural, out of scope.

## Item 3 verification + pre-existing funnel n=1000 degeneracy

Funnel runtime smoke (p46-funnel-smoke.mjs): funnel + funnelvertical at n=5/100 mount, paint, run reveal effects with ZERO pageerrors (a broken hook order would throw on first render). PASS.

IMPORTANT context for the lead: funnel n=1000 throws 1000 `<svg> attribute viewBox: A negative value is not valid ("0 0 -2.944 478.171875")` console errors — **identical on bklit** (control probe p46-funnel-diag.mjs: bklit n=1000 = 1000 errors, same message; n=5/100 clean both impls). Pre-existing degenerate geometry (1000 stages × 3 layers in ~478px → negative segment width), same class as bklit bar n≥1000. NOT caused by P4.6. The lead's requested funnel n=1000 pixel gates will run against this pre-existing noise on both sides.

## Final state

- TSC_EXIT=0 (showcase/, no pipes, real npx).
- Files touched (showcase/migrated): scatter-chart.tsx (item 1 swap + item 2 guard), bar-chart.tsx, candlestick-chart.tsx, composed-chart.tsx, internal/use-hover-chrome.ts (item 1), funnel-chart.tsx (item 3).
- Probes written: research/phase-4/tools/p46-m3a-attribution.mjs, p46-animate-count.mjs, p46-funnel-smoke.mjs, p46-funnel-diag.mjs (+ tools/out/p46-scatter-m3a-cpu.json output).
- ORPHAN FOR LEAD DELETION: stray sibling directory `/Users/tomasdomingos/bklit-tanstack-chars-migration/` (typo'd repo name; contains only a duplicate of p46-animate-count.mjs). My cleanup attempt was blocked by the D216 deletion hook — lead should remove that directory tree.
- No files deleted, no commits, no bench runs, no manual `npm run build` (all dist rebuilds were qa/screenshot.mjs's own D214 stale-build guard).
- P5.1 fence respected: charts/index.ts, live-line-chart.tsx, internal/sunburst-geometry.ts untouched.
