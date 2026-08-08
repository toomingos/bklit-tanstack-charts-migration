# ComposedChart — Phase 2 Refactor Plan (1.1 synthesis)

> Inputs: `research/phase-2/audits/composed-audit.md`, `research/phase-2/inventory/04-migrated-inventory.md` §1+§4, `research/phase-2/tanstack-native/*.md`, live `migrated/charts/composed-chart.tsx` (875), `internal/series-bar-mark.ts`, `internal/area-fill-mark.ts`, plus prior per-chart plans (line-plan C1/C4, live-line-plan C2-C3 patterns for lifecycle).

## Goal
Move Composed — the mixed-mark cartesian (bar+area+line) — closer to TanStack-native without losing bklit byte-identical bar-width/gradient/layer parity. Keep heavy justified custom marks, harden broken lifecycle/hover seams only.

## Distilled overhead (audit non-redundant)

- ~25% TanStack-native today: one `defineChart({ marks:[seriesBarMark, areaFill+lineY, lineY] })` + `ChartScale` hatch. ~75% custom: bar geometry, decimation dual-paths, `ChartScale` stashing, `XAxisOverlay`, native bisector hover, double WAAPI clip+stagger.
- Justified: `seriesBarMark` `slot*0.88` (stock `barY inferBandwidth` mis-sizes ~9%, ME-16), `areaFill` heap G4 (19%), `extractComposed` upsert merge, decimation asymmetry `data` vs `renderData`.
- Replaceable hosts: `ResizeObserver` debounce, `XAxisOverlay` → guides, `ChartScale` shims → `ctx` builder, `attachHoverChrome` bypass → `focus/group-x`, gradient sibling SVG → `defineChart gradients`. Large D-track, not single-slice.
- Broken flows §4: stale `xScaleD3Ref` between width commit and definition rebuild, `getAttribute(y/height)` mid-tween snapshot race for bar stagger, `barRowIndex` second-arg fragility, selector escape on `:` keys, missing skeleton phase, `revealAnimationsRef` + deadline `setTimeout` leak on unmount (the tight C this slice).

## Synthesis — Keep / Defer / Change

### Keep (justified GAPs)
- `K1` `seriesBarMark` + `series-bar-layout.ts` `slot*0.88` / `slot*0.92` clamp + grouping — stock `barY` not byte-identical; keep per audit H JUSTIFIED and header ME-16 note.
- `K2` `areaFill` sibling (G4) — same rationale as `area-chart.tsx` K1.
- `K3` Decimation dual-paths (`data` for bars, `renderData` for area/line) + `composedSeries` merged list — bklit quirk ported verbatim (`composed-chart.tsx:21-26`); keep.
- `K4` `extractComposed` + `upsertComposedSeries` DOCUMENT-order overwrite — canonical `extractComposedSeries` port; keep.
- `K5` `XAxisOverlay` parity / `ChartScale` hatch / hover chrome as imperative overlay — all deferred to cross-cartesian sweep; keep.
- `K6` `stacked/stackGap` WONTFIX stub — documented pilot scope; keep.

### Defer (cross-chart sweeps)
- `D1` Collapse `ChartScale` resolve hatch into responsive `defineChart((ctx)=>spec)` builder + `onRender scene.scales` (audit #2, line-plan D1 precedent) — defer until sizing family swallows `innerWidth`-dependent decimation.
- `D2` Host `focus:'group-x'` wiring with custom `ChartFocusStrategy` collapsing dual-index (audit #3) — requires `barRowIndex` contract hardening across chrome; defer.
- `D3` `gradients:[]` host scoping via `renderChartSvgWithResources` (audit #4) — defer; sibling `useId` suffix mitigates collision today.
- `D4` TanStack `y.guide` adoption — defer with `XAxisOverlay`.
- `D5` `stackId` stacked baselines — out of bench; defer.

### Change — tight C this slice (no design drift)

**C1 — Reveal lifecycle hardening (audit §4 row 6).** The double WAAPI path nests `rAF×2+setTimeout(0)` bar setup and parks the `barsDeadlineMs = animationDuration+staggerSpread` `setTimeout(cancel)` without storing the ID; unmount during ~1.5s window leaks `Animation.cancel()` on detached `rect`s. Stash deadline `setTimeout` ID + outer `setTimeout(0)` ID + rAF IDs in refs, `clearTimeout/cancelAnimationFrame/cancel` on unmount effect, and guard `marks`/`group` queries with `isMounted` flag. Fixes §4 leak with zero visual change. Preserves the double-reveal algebra (clip wipe + independent bar stagger).

**C2 — ResizeObserver debounce 10ms (audit §2 row M + line-plan C4 parity).** Wrap `setWidth` commit in 10ms `setTimeout` + pendingRef (same `ParentSize debounceTime` seam as `line-chart.tsx:94-130`). Prevents width-drag thrash rebuilding `definition`/`renderData`/scales each frame.

**C3 — Bar stagger snapshot hardening (audit §4 row 2).** Narrow fix: `getAttribute("y"/"height")` snapshot inside the deferred rAF chain already runs post-paint via `onPostPaint`, but document the guard and add a `rect.isConnected` check before `rect.animate` so a reconciling definition that replaced the bar group mid-defer doesn't animate a stale `rect` measured off mid-tween state. Closes the `runTweens` vs `getAttribute` race without changing the per-bar `height:0→targetHeight` semantics.

> Scope note: No `definition`/`mark` contract change, no scale-shim rewrite, no host focus migration this slice — all are correctly deferred. Slice is lifecycle+perf hardening only, tuned so the settle/hover QA that already leans near `0.00%` stays PASS.

## Execution (1.2)
- Patch `migrated/charts/composed-chart.tsx` (single file, ~875→~885 lines): add `revealDeadlineRef/revealSetupRafRef/revealSetupTimerRef/widthTimerRef+pendingWidthRef`, debounce RO, store+clear deadline timer, cancel animations on unmount, guard bar `getAttribute` with `isConnected`.
- `npm run build --prefix bench/app` green; `node qa/screenshot.mjs --chart composed --impl-a bklit --impl-b migrated --n 100/1000` + `liveline` regression spot (shares bisector pattern).

## Risks
- Minimal: all C are effect-cleanup/RO paths. Reveal double-animation stays identical; gate regression judged nil.

## Questions open
- None blocking — settle/hover QA at `n=100` is the gatekeeper; `n=1000` expected within 0.5% given clip+stagger scale invariance.
