# SunburstChart — Phase 2 Refactor Plan (1.1 synthesis)

> Inputs: `research/phase-2/audits/sunburst-audit.md`, live `migrated/charts/sunburst-chart.tsx` + `internal/sunburst-{geometry,hover-chrome,reveal}`.

## Goal
Harden Sunburst's two deferred-focus/queue hazards and the positional host coupling, keeping the single-mark polar pipeline and baked opacity generator. Sunburst is the only chart with a queued-click zoom path.

## Distilled overhead
- Broken (§4): `zoomTo` sets `prevFocusId` + `setZoomT(0)` but real `focusId` advances only after WAAPI settles — rapid clicks queue overlapping zooms interpolating `A→B` skipping root; `bkmRevealed` blocks re-reveal on `data` change; positional `sortedArcs[i] ↔ els[i]` via `querySelectorAll` order fragile vs TanStack reorder.
- Wrappers (§3): `displayName` child walk, unused coordinator exports, double sort.

## Synthesis — Keep / Defer / Change

### Keep
- `K1` Single `polar → radialArc(arcRows)` mark with `generator` wrapping `arcPath` + baked opacity via `applyAlphaToColor`.
- `K2` Reveal 64-sample `d` keyframes + hover grow `buildHoverGrowTargets` geometry.
- `K3` Fixed `size=520` + `maxWidth:"100%"` wrapper (matches bklit API).

### Defer
- `D1` Replace WAAPI zoom with synchronous definition swap + `animate` (audit §6 #1, H risk — `transitionGeometry` easing not captured by linear `d` tween; needs screenshot seam proof).
- `D2` Unify reveal under TanStack `animate` entirely (needs discrete `d:none` proof).
- `D3` Adopt TanStack `focus` for hover + centroid rewiring (needs `ChartPoint` per arc centroid emission).
- `D4` `displayName→CHART_ROLE` + dead coordinator export removal.
- `D5` `padAngle` 0.01→0.015 + hint spacing trim (pixel/text snapshot parity waivers).

### Change — tight C this slice

**C1 — Fix deferred focus / queued-click race (audit §4 row1, H).** Make the second click during an in-flight zoom interpolate from the *current visual* state, not from the already-mutated `prevFocusId`. Canonical fix: on `zoomTo` re-entry while `zoomT < 1`, snapshot the in-flight interpolated geometry (`lerp(prevFocus, target, zoomT)`) as the new `prevFocusId` or as a virtual focus analog, then reset `zoomGen`/`zoomT` to 0 toward the new target. Or, simpler in this architecture: cancel the in-progress rAF loop + WAAPI `d` anims, snap `prevFocusId` to the *actual* geometric midpoint rendered at the cancel moment, and restart toward the new target. Goal: two rapid drill-down clicks don't skip the root ring.

**C2 — Replace positional `[data-ts-key="sunburst-arcs"] path` order coupling with `Map<arcIndex, pathEl>` keyed by `data-ts-key` attribute (audit §4 row3, M).** Parse each path's `data-ts-key` (or `data-index`) stable key instead of assuming `querySelectorAll` order equals `sortedArcs` order. Eliminates misaligned reveal/hover when TanStack reorders nodes.

> Scope note: No WAAAPI→animate wholesale, no focus engine swap, no child-role migration this slice — all D. Slice addresses the only queue/interpolation broke flow that has two-click repro plus the positional fragility.

## Execution
- Patch `migrated/charts/sunburst-chart.tsx` (hover/reveal/zoom sections): C1 add cancel+snapshot guard in `zoomTo`, C2 build `Map` from `data-ts-key`. Keep `bench/app` build PASS. QA sunburst n=10/27 tooltipless settled still holds.

## Risks
- Medium — C1 touches zoom interpolation arithmetic; needs mid-zoom click QA. Fallback is current cancel-only guard (which already prevents double-commit, just loses the root ring frame).

## Questions open
- None blocking — zoom queue is the only two-click repro.
