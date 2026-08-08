# ChoroplethChart — Phase 2 Refactor Plan (1.1 synthesis)

> Inputs: `research/phase-2/audits/choropleth-audit.md`, live `migrated/charts/choropleth-chart.tsx` (950) + `internal/choropleth-hover-chrome.ts`.

## Goal
Collapse the parallel `featureByTsKey` string-reconstruction layer into the single `pathElementsRef` keyed map that already exists, keeping choropleth's GAP `geoShape` + ProvidedZoom + graticule model but removing the fragile hard-coded `data-ts-key` encoding assumption.

## Distilled overhead
- Broken (§4): hard-coded `geo-shape-0:object:null:string:${name}` assumes mark index/group `valueKey` — breaks if mark count or id changes; dim wrapper moves nodes breaking reconcile on next `definition` update; focal-point off-by-margin on wheel zoom.
- Wrappers (§3): `featureByTsKey` Map duplicates the `pathElementsRef` key set + extra centroid map.

## Synthesis — Keep / Defer / Change

### Keep
- `K1` `geoShape(features, {projection: () => geoMercator(...)})` inside `defineChart` → `<Chart aspectRatio>` mark.
- `K2` `ProvidedZoom` CSS-wrapper `transform` (GAP — TanStack has no zoom primitive).
- `K3` `geoShape` graticule overlay + `ChoroplethTooltip` portal positioning via centroid `applyMatrixToPoint` correction.
- `K4` `FEATURE_ENTER_MS 1100` reveal + `data-bkm-revealed` guard (dual-timer kept, just its lookup tightened).

### Defer
- `D1` Replace wrapper-CSS zoom with projection-scale definition swap (audit §6 #1, H — retune wheel/pinch feel, debounce definition rebuild).
- `D2` Replace imperative hover dim with TanStack `focus` strategy + `ChartPoint` at `geoCentroid` (audit §6 #2, M — needs `geoShape` `anchor` contract for centroid, wrong slice to prove).
- `D3` Unify dual reveal timers under TanStack `animate` (audit §6 #3).
- `D4` Forward host sizing to `initialWidth`/dynamic `defineChart((ctx)=>spec)` (audit §6 #4 — graticule projection must track `ctx.width`).
- `D5` Extract graticule into custom `createMark` inside `marks` array.

### Change — tight C this slice

**C1 — Replace `featureByTsKey` hard-coded string with DOM-keyed lookup (audit §4 H row1 + §6 #2 precursor).** Remove `featureByTsKey = Map<"geo-shape-0:...", feature>` that reconstructs `valueKey` encoding. Derive the feature map directly from the same live DOM `data-ts-key` attributes that `pathElementsRef` already indexes: after `handleRender` populates `pathElementsRef` from `querySelectorAll("[data-ts-key]")`, build `featureByTsKey` as `Map` from each element's actual `data-ts-key` attribute to its feature (keyed by the same attribute the hover chrome reports via `hd.key`). No string encode assumption. `getCentroidForHover`/`handleHoverChange` then use that keyed map without hard-coded `"object:null"/"string:"` prefix.

> Scope note: No zoom→definition swap, no focus strategy, no reveal unification this slice — all D. Slice fixes the only H-row encoding fragility, keeping the same `geoShape` pipeline (mark id stays `geo-shape-0` today, but is no longer load-bearing).

## Execution
- Patch `migrated/charts/choropleth-chart.tsx`: replace `featureByTsKey` memo with one derived from `pathElementsRef` keys (or infer via a lightweight parse of the actual DOM attribute rather than `valueKey` encoding assumption). Fallback to current encode only if DOM not yet available. Keep `bench/app` build PASS.

## Risks
- Low — lookup now reads the same `data-ts-key` string the hover chrome already emits, so `hd.key` round-trip is always hit. Fallback keeps first-paint before `handleRender` safe.

## Questions open
- None — encoding assumption is the only H-row repro this slice.
