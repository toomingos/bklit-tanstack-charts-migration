# PieChart — Phase 2 Refactor Plan (1.1 synthesis)

> Inputs: `research/phase-2/audits/pie-audit.md`, `research/phase-2/inventory/04-migrated-inventory.md` §1+§4, `research/phase-2/tanstack-native/*.md`, live `migrated/charts/pie-chart.tsx` (725) + `internal/pie-hover-chrome.ts` + `internal/pie-reveal.ts` + `internal/pie-geometry.ts` + `internal/pie-center.tsx`.

## Goal
Tighten Pie's imperative layer to be more TanStack-native without enlarging its 35% custom surface. Pie is 65% native (`polar→radialArc` + `defineChart→<Chart focusDisabled>`) — WAAPI reveal + hover spring are justified GAPs (discrete `d` interpolation, slice translate/grow). Slice is bug-hardening + fragility removal, not a rewrite.

## Distilled overhead (audit non-redundant)
- Native: `polar + radialArc` scene, `focusDisabled`, `Chart` host sizing (via custom `useMeasuredSize` square `min(w,h)`).
- Custom justified: WAAPI 64-sample `d` keyframes (CSS `d:none→path` discrete), hover runtime `translate/grow`, hidden-SVG `<defs>`, `PieCenter` display toggle.
- Extra wrappers (§3): `sliceConfigMap` Map, `hoverInputsRef` + `enterTransitionRef` refs, global `pieCleanupMap` WeakMap, index-based `pathEls[i]↔arcs[i]` mapping, `bkmRevealed` DOM attribute guard.
- Broken flows (§4): one-shot reveal blocks data growth, scrub bypass leaves stale maps, `geometryScrubbing` race with `bkmRevealed`, sub-pixel `d:none` threshold, index mapping drifts if TanStack reorders.

## Synthesis — Keep / Defer / Change

### Keep (justified GAPs)
- `K1` WAAPI per-slice sweep via `buildProgressKeyframes` + `pieArcPath` (discrete `d` GAP).
- `K2` Hover coordinator + runtime `translate/grow/none` + fade.
- `K3` Hidden SVG `<defs>` for gradients/patterns (`url(#id)` cross-tree).
- `K4` `PieCenter` overlay + scrub plain-SVG bypass.
- `K5` `useMeasuredSize` square gate (needs `min(w,h)` not rect).

### Defer (cross-chart / heavier scope)
- `D1` Fold `hoverInputsRef/enterTransitionRef` into deps (audit §6 #3 — medium risk surface destroy `renderSvg` identity).
- `D2` Re-introduce NumberFlow roll (audit §6 #5 — needs island re-render, snapshot gate already allows static).
- `D3` Remove `sliceConfigMap` Map (tiny perf, keep for clarity).
- `D4` Full resize animation double-writer alignment (audit §4 last row — needs `animate.resize` audit across polar charts).

### Change — tight C this slice (bug-hardening, no perf drift)

**C1 — Fix one-shot `bkmRevealed` into per-slice Set diff (audit §4 row 1 + §6 #2, same pattern as `gauge-reveal.ts`).** Replace `if marksGroup.dataset.bkmRevealed==="1" return` with a `Set<number>` (or `Set<string>` key) of seen `sliceIndex` values stored at module level or in ref, checked per-arc in `handleRender`. Only `arcs[i]` not in `seen` animate; `seen` grows on first animate. New slices after `data 2→6` now sweep without requiring surface remount. Mirrors bklit `revealEpoch`.

**C2 — Replace index-based `pathEls[i]` mapping with `data-ts-key` lookup (audit §3 index mapping + §6 #1).** Instead of `pathEls = querySelectorAll("path")` + order mapping, query per slice `container.querySelector('[data-ts-key="pie-slices:${sliceIndex}"]')` (or `[data-ts-key^="pie-slices:"]` parse). Removes fragile order assumption surviving TanStack `reconcileChartSvg` reorder. N≤12, per-slice query negligible. Keep `sliceElementMapRef` as cache keyed by `sliceIndex`.

**C3 — Scope cleanup off the global `pieCleanupMap` WeakMap (audit §3 + §6 #4).** Keep local `Map` closured inside the hover `useLayoutEffect` plus its return cleanup; retain the existing unmount safety net `useEffect` but drop the outer `WeakMap` indirection so there is a single cleanup path. No functional change, reduces cross-instance leak surface.

> Scope note: No `hoverInputsRef` folding, no NumberFlow, no sizing host change this slice — all D. Slice fixes the only flows with failing repro (growth doesn't animate, order drift).

## Execution (1.2)
- Patch `migrated/charts/pie-chart.tsx` only (symlink covers `showcase/`): add `seenPieRevealedRef` Set, rewrite `handleRender` mapping to `data-ts-key` queries, move `pieCleanupMap` to local scope. Keep `bench/app` build green. QA: bootstrap still 0.00% settled; manual grow probe `data 2→6` asserts 4 new WAAPI anims.

## Risks
- Low — `data-ts-key` format `pie-slices` is hardcoded `id: "pie-slices"` grep-stable; Set diff is gauge-proven minimal; cleanup scope change is mechanical. Bench hover chrome unchanged for static data.

## Questions open
- None blocking — stale-hover/queue depth not needed for this slice.
