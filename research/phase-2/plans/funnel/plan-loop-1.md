# FunnelChart (both orientations) — Phase 2 Refactor Plan (1.1 synthesis)

> Inputs: `research/phase-2/audits/funnel-audit.md`, live `migrated/charts/funnel-chart.tsx` + `internal/funnel-hover-chrome.ts` + `internal/funnel-reveal.ts`.

## Goal
Close Funnel's one reliably-reproducible broken flow (WAAPI `fill:"backwards"` lingering blocks hover) plus the small indirection candidates without enlarging the GAP surface. Funnel is 0% TanStack-native by design (no funnel primitive) — entire geometry is slot arithmetic `i*(segW+gap)`. Keep plain-SVG justified GAP.

## Distilled overhead
- Broken (§4): `fill:"backwards"` WAAPI stays in `element.getAnimations()` until reveal end; hover spring writes same `transform` on rings but composite is `replace`, so hover pop stalls until WAAPI completes if `enterTransition` long. Plus `isHorizontal` context reuse across orientation flip briefly shows wrong `transformOrigin`.
- Wrappers (§3): `FunnelOrientationContext` for one bool, `computeFunnelRings` per-render recompute, `key={stage.label}` assumes uniqueness.

## Synthesis — Keep / Defer / Change

### Keep
- `K1` Plain SVG + `ResizeObserver` sized strip + `hSegmentPath/vSegmentPath` geometry verbatim.
- `K2` WAAPI `scale(p)` reveal + `buildProgressKeyframes` spring sampling.
- `K3` Per-ring axis-specific springs `scaleY`/`scaleX` with stiffness taper.
- `K4` `FunnelGrid` div bands, label layout `spread`/`grouped`, typography `.ts-bkm-funnel-*` hand CSS.

### Defer
- `D1` `isHorizontal` context → prop drill (single bool — trivial; keep until second slice needs prop plumbing).
- `D2` `key={label}` → `label-index` + duplicate warn (bench labels unique; no harness failure today).
- `D3` `computeFunnelRings` memo per segment (N layers≤3, N segs≤12 → ≤36 paths per render; negligible at bench sizes).
- `D4` Orientation-flip re-key (bench never toggles orientation).

### Change — tight C this slice

**C1 — Fix WAAPI `fill:"backwards"` vs hover spring race (audit §4 row4 + §6 #1, PRIORITY).** After each segment's reveal `el.animate(keyframes, {fill:"backwards", ...})`, attach `anim.onfinish = () => { anim.cancel(); el.style.transform = "scale(1)"; }` (or equivalent that snapshots current computed transform then cancels) so the WAAPI effect is released and hover's `style.transform` owns the rings immediately. Mirrors pie `pathEl` and ring track-expand `onfinish` release patterns. Eliminates hover-pop stall when `enterDuration` exceeds hover delay.

> Scope note: No solicitation for orientation toggle, key suffix, or context removal this slice — all D. Slice fixes the only flow whose steady-state `element.getAnimations()` leak is observable with a slow `enterTransition` and has a failing probe spec (`staggerDelay=0.3`, hover at t=200ms → expect ring `scaleY` 1.12 within next 260ms).

## Execution
- Patch `migrated/charts/funnel-chart.tsx` single file (lines around 456-484): add `anim.onfinish` cleanup per reveal `Animation` matching pie/ring pattern. Keep `bench/app` build PASS. QA funnel/funnelvertical tooltipless settled 0.00% holds.

## Risks
- Low — `onfinish` release shipped in pie/ring already; funnel `scale(p)` is linear 2-keyframe tween so cancel + snapshot is seam-free. Verify cancel path also runs on `prefers-reduced-motion` fast-path (no WAAPI scheduled).

## Questions open
- None blocking — only WAAPI lifetime × hover writer contention has live repro.
