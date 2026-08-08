# GaugeChart (arc + linear) — Phase 2 Refactor Plan (1.1 synthesis)

> Inputs: `research/phase-2/audits/gauge-audit.md`, live `migrated/charts/gauge.tsx` (1000+), `internal/gauge-reveal.ts` + `internal/gauge-notch.ts`.

## Goal
Close Gauge's one broken flow and the small shared-notion duplication without enlarging either orientation's surface. Arc is 70% native (`polar → radialArc`); linear is intentional plain-SVG (no domain). Keep both paths parity.

## Distilled overhead
- Broken (§4): linear `useLayoutEffect` with no dep array re-runs every commit (value ramp re-arms `onPostPaint`), `radialArcGroups[1]` positional lookup fragile, `children` defs silent drop on arc, interpolation assumes `#rrggbb`.
- Wrappers (§3): duplicated `collectTargets`+factory 4× arc vs linear, positional `radialArcGroups[0]/1`, dead `computeArcNotches` unused by arc.

## Synthesis — Keep / Defer / Change

### Keep
- `K1` Arc `polar → radialArc(bg) + radialArc(active)` + `defineChart gradients` theme gradient.
- `K2` Linear plain-SVG strip (`i*(slotWidth+gap)` — no cartesian domain GAP).
- `K3` Unified `seen`-Set reconciler (`reconcileGaugeReveal` mount + value update).
- `K4` `FOCUS_DISABLED` + `CenterStat` NumberFlow + `usePrefersReducedMotion`.

### Defer
- `D1` Wire/remove `computeArcNotches` for arc (math single-sourcing — needs angle-vs-quadrangle equivalence proof).
- `D2` Harden positional `radialArcGroups` selector to `data-ts-key` (needs DOM dump verification first).
- `D3` Children defs warn on arc + hex interpolation CSS-var guard (rare power-user, no bench path).
- `D4` Extract `useGaugeReveal` hook for 4× collectTargets duplication (medium refactor across both orientations — second slice).

### Change — tight C this slice (bug fix)

**C1 — Fix linear `useLayoutEffect` dep array (audit §4 row1 + §6 #1, PRIORITY).** Add explicit deps `[geometry, geometryScrubbing, prefersReducedMotion, enterTransition, enterStaggerScale]` (and any stable `totalNotches` signal) so `useLayoutEffect` does not re-arm on every `value` tick. `seenBgRef/seenActiveRef` stay stable refs across ticks; `reconcileGaugeReveal` only fires when geometry or reveal timing changes or new notches appear, not on steady-state value ramps. Eliminates per-render `onPostPaint` churn and `seen` double-insert under rapid value ramp.

> Scope note: No geometry single-sourcing, no selector hardening, no warning plumbing this slice — all D. Slice is the single §4 row with failing repro (live ramp) plus its audit-prioritized remediation #1.

## Execution
- Patch `migrated/charts/gauge.tsx` single file: add deps to linear `useLayoutEffect(() => { ... }, [geometry, geometryScrubbing, enterTransition, enterStaggerScale, prefersReducedMotion])`. Verify arc path already has deps (if missing, add same). Keep `bench/app` build PASS. QA gauge/gaugelinear tooltipless settled 0.00% holds.

## Risks
- Low — deps only narrow re-run frequency; geometry identity already memoed; stale closure risk checked (refs stable).

## Questions open
- None blocking — linear path is the only GAUGEd broken flow with live repro.
