# RadarChart — Phase 2 Refactor Plan (1.1 synthesis)

> Inputs: `research/phase-2/audits/radar-audit.md`, `research/phase-2/inventory/04-migrated-inventory.md` §1+§4, `research/phase-2/tanstack-native/*.md`, live `migrated/charts/radar-chart.tsx` (549), `internal/radar-reveal.ts` + `internal/radar-spring.ts`.

## Goal
Move Radar — the lightest-overhead chart — closer to TanStack-native without losing bklit's half-step-offset grid, hover glow/scale, or `focus:"nearest"` parity. Radar is already ~55% native (`polar→radialArea/radialDot/angleGrid + defineChart→<Chart focus/animate>`); the slice is small and surgical.

## Distilled overhead (audit non-redundant)

- Native core: `polar` + `radialArea/radialDot` + `angleGrid` + host focus/animation lifecycle + `ChartSurface` sizing.
- Custom layers: own `ResizeObserver` + `chartSize=min(w,h)`, custom `bklitRadarGrid PolarGuide` (half-step + flat `100/levels`), `z`-string padded grouping + `parseInt` recovery, imperative `areaPathsRef/dotCirclesRef → style.opacity/filter/transform + setAttribute(r)` hover walk via `querySelectorAll(".ts-chart__radial-area")`.
- Justified: `bklitRadarGrid` (stock `radialGrid polygon` has no phase offset and uses d3 nice-ticks — audit §2 M JUSTIFIED), `allRows` flatten+z-group (one `radialArea/radialDot` pair cheaper than per-series polar), `DefaultLevels=5/defaultMargin=60` domain/margin.
- Broken flows §4: `ts-chart__*` class coupling, padded `z` ordering fragility, controlled↔internal hover race, `chartSize<10 → null` reveal-replay flash, stale-hover after series-count growth (`useLayoutEffect` only on `hoveredIndex`), orphan `dotCircles` reset churn.

## Synthesis — Keep / Defer / Change

### Keep (justified GAPs)
- `K1` `bklitRadarGrid` + `angleGrid` + `scalePoint/scaleLinear [0,100]` — only custom `PolarGuide` that is deliberately non-stock; keep verbatim.
- `K2` `allRows` flatten + `z:"series"` zero-padded grouping + `colorForIndex` closures — single pair more efficient than per-series polar; keep.
- `K3` TanStack `animate duration: enterDurationMs easing ease-in-out resize:false` — close enough to bklit `useMountProgress`; `motionReplayKey/enterTransition/staggerScale` widening out of scope (D).
- `K4` `extractRadarChildren` + margin/config defaults — parity surface; keep.

### Defer (cross-chart / wider scope)
- `D1` Drop manual `ResizeObserver` → host sizing (`<Chart width/height>` + `onRender scene.width`) — audit #1; defer until polar square-sizing sweep can verify `scene.chart.width` vs container `min(w,h)` equivalence.
- `D2` Eliminate `querySelectorAll` class coupling → `SceneNode`/element map — audit #2; defer until polar scene node contract stable (largest remaining custom walk; wants broader scrub).
- `D3` Collapse imperative walk into host CSS `data-hovered/data-dim` attributes — audit #3; defer because per-hover definition rebuild loses rAF-only win.
- `D4` Wire `enterTransition→animate.easing` / `motionReplayKey→playKey` — audit #4; defer (stub parity, bench never drives those props).
- `D5` Remove `radar-spring.ts` dead file — audit #5; out of slice (file not imported by Radar; harmless this phase).
- `D6` Host smoothing for `controlledHoveredIndex ↔ internal` dedup — audit §4 row 3; defer (rare controlled path, no bench harness exercises it).

### Change — tight C this slice (TanStack-native, no parity drift)

**C1 — Fix stale-hover after series-count change (audit §4 row 5 + §6 #6).** `useLayoutEffect` only on `[hoveredIndex]` — if `resolvedAreas.length` grows after mount (`handleRender` refreshes `areaPathsRef` to longer array but effect doesn't re-run), the new polygon stays at rest until next pointer move. Fix: also depend on `resolvedAreas.length` (or add a second effect that repaints on length change when a hovered index is active). No visual change for the common static-series bench path.

**C2 — Make hover walk resilient to length drift + guard nulls (audit §3 L + §4 rows 5/6).** Keep the lightweight walk but: (a) handle the `expectedCircles` orphan reset correctly (already present — keep but tighten), and (b) null-guard `areaPathsRef.current[i]` / `dotCirclesRef.current[dotStart+j]` reads (missing elements when series added/removed should not throw). Prevents the one-frame empty-polygon flash from becoming a runtime error when toggling `areas`.

> Scope note: No `ResizeObserver` removal, no class-query replacement, no spring-file deletion this slice — all correctly deferred as D. Slice is strictly bug-hardening + parity-preserving for the only flow that is actually broken (§4 row 5) and has a failing repro signal (new series appearing at wrong opacity).

## Execution (1.2)
- Patch single file `migrated/charts/radar-chart.tsx` (plus symlink `showcase/migrated/charts`): add `resolvedAreas.length` to the hover `useLayoutEffect` dep array (or second effect), tighten null guards around `areaPathsRef/dotCirclesRef` reads. Keep `bklitRadarGrid` + `handleRender` + z-padding unchanged.
- `npm run build --prefix bench/app` green; `node qa/screenshot.mjs` focused compare (see PROGRESS QA convention; e.g. `--chart radar --impl-a bklit --impl-b migrated` or the repo's `qa/screenshot.mjs` helper). Expect ≤0.5% settled parity and zero hover regressions (hover path unchanged for existing series).

## Risks
- Minimal: only narrows effect deps / adds null checks. No definition/marks contract change, no sizing change, no `defineChart` rewrite. Gate regression judged nil.

## Questions open
- None blocking — stale-hover fix is the only broken flow with a concrete repro; the rest stays deferred per audit prioritization.
