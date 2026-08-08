# RingChart — Phase 2 Refactor Plan (1.1 synthesis)

> Inputs: `research/phase-2/audits/ring-audit.md`, live `migrated/charts/ring-chart.tsx` (≈900) + `internal/ring-hover-chrome.ts`.

## Goal
Harden Ring's two-phase reveal + hover spring against the same growth/stale-cache bugs as Pie while stripping the debug log pollution. Ring is 60% native (`polar → 2× radialArc per ring`) — expand + sweep WAAPI and pushed-out spring are justified GAPs.

## Distilled overhead
- Extra wrappers: global `ringCleanupMap` WeakMap, `hoverInputsRef` refs, `ringElementMapRef`, two-phase stagger magic 0.6s, `console.log` in `ring-hover-chrome.ts:84/100/112`, `AnyRadialArcMark` alias.
- Broken: `bkmRevealed` one-shot blocks `n 2→4` growth, cache stale after growth, `progress>0.001` guard drift, `setTimeout(0)` center defer race, resize double-driven `d`/`transform`.

## Synthesis — Keep / Defer / Change

### Keep
- `K1` Two-phase reveal (track scale + progress sweep) via WAAPI sampling.
- `K2` Ring hover runtime `scale 1.03/1.02` with `settleAtRest` gate.
- `K3` `renderScale` clamp + ring radii math + lineCap branch.
- `K4` Deferred center `setTimeout` past doubleRaf (D75).
- `K5` TanStack `focusDisabled` + custom square sizing.

### Defer
- `D1` `hoverInputsRef` ref folding into deps (same risk as pie).
- `D2` Two-phase stagger magic → `revealTiming` derivation.
- `D3` Resize double-writer `animate.resize` alignment (needs polar sweep audit).
- `D4` `AnyRadialArcMark` alias trim.

### Change — tight C this slice

**C1 — Strip debug `console.log` in `ring-hover-chrome.ts` (audit §6 #1, M).** Remove lines 84, 100, 112. Hot path on every `paint`/`settleAtRest` call; pollutes bench console at M2.

**C2 — Fix `bkmRevealed` into per-ring Set diff (audit §4 row 1 + §6 #2, same fix as pie C1).** `Set<number>` of revealed ring indices; animate only unseen `track`/`progress` groups on each `handleRender`. Mount `n=2` → grow `n=4` now expands/sweeps 2 new rings.

**C3 — Move `ringElementMapRef` cache build into `useLayoutEffect` (audit §6 #3).** Query `data-ts-key` live DOM after reconcile so hover chrome never reads stale pre-grow refs. Same lookup cost (N≤8).

**C4 — Scope `ringCleanupMap` WeakMap locally (audit §6 #4).** Local `Map` inside hover effect + return cleanup; keep unmount net but drop global.

## Execution
- Patch `migrated/charts/ring-chart.tsx` + `migrated/charts/internal/ring-hover-chrome.ts`. Keep `bench/app` build PASS 1.24MB. QA at `ring n=4/20` tooltipless 0.00% settled still holds; growth probe `2→4` asserts new reveals.

## Risks
- Minimal — Set diff copied from gauge/pie; console removal mechanical; query move adds one query pass at N≤8.

## Questions open
- None — decoupled from pie but same shape; can ship in same sub-agent sweep.
