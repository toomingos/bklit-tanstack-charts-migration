# Phase 7 — Fifth pass: the three deductions left in `03-final-routes.md` §7

## 1. Evidence 9.8 → 10: the bklit side is analytic too

The bklit curves were "sampled" only because framer's runtime is opaque to WAAPI. Its math is not: `motion-dom` (bench/app/node_modules/motion-dom, framer's engine) exports `spring` as a pure generator (`spring({ keyframes, stiffness, damping, mass }).next(t)`) and its keyframe/bezier interpolators. bklit's transitions are plain objects (`enterTransition`, the reveal `transition` in `chart-reveal-clip.tsx:71,85`), so:

- Extract each bklit `Transition` from the QA fixture props (the same objects the migrated adapter A-c consumes).
- Evaluate it in Node with framer's own generator at the 64 sample points K4 already uses.
- Evaluate the migrated side with the package tween/spring functions (§1/§3 of `03`).
- Assert the two tracks within tolerance. No browser, no eyeballing, both sides pure.

The browser probe (E-a) becomes a smoke check that the runtime honours the declared curve, not the evidence itself.

## 2. Bundle 9.5 → 10: no allowance needed

Recorded gzip ratios for the small-chart cells (`bundle-sizes.json`):

| cell | bklit | migrated | ratio |
|---|---|---|---|
| pie | 94.8 | 98.9 | ×1.04 |
| gauge | 98.4 | 99.3 | ×1.01 |
| sankey | 98.6 | 99.8 | ×1.01 |
| ring / radar | 101.5 / 104.4 | 98.8 / 99.9 | under |
| sunburst | 85.4 | 96.5 | ×1.13 |

The engine floor already fits under 10 % everywhere except sunburst, so the per-family allowance policy is withdrawn. Sunburst needs −2.6 kB gzip: the migrated bundle carries both the package hierarchy layout (`hierarchy-sunburst.js` + `hierarchy-flat-internal.js` + `d3-hierarchy`, ≈ 11 kB raw ≈ 3.5 kB gzip) and its own `internal/sunburst-geometry.ts`. Keep one. Own geometry through `polar`/`radialArc` marks drops the package hierarchy chain and lands at ≈ ×1.09; using the package layout and deleting the geometry file is the smaller saving (≈ 1.2 kB gzip) but the more native one. Either clears the gate; the first is the safe pick.

Funnel note: N-a makes the funnel native, which raises its cell from ×0.51 to ≈ ×0.95 (engine ≈ 40 kB gzip). Still under.

Exact B-3 drop, computed from the esbuild metafile graph by cutting the edges from `area-chart.tsx`/`line-chart.tsx` to the optional-layer modules (brush, reference-area, pattern, markers, projection) and counting what becomes unreachable:

| cell | total raw | unreachable | share | biggest |
|---|---|---|---|---|
| arealoading | 340 kB | 83.2 kB | 24 % | d3-brush 8.4, interaction-brush 8.2, d3-color 7.0, reference-area-layer 5.6, pattern-preset 5.3, chart-markers 4.7 |
| profitloss | 480 kB | 82.6 kB | 17 % | same set |
| barloading | 249 kB | 12.0 kB | 5 % | reference-area-layer 5.6, pattern-preset 5.3 |

At the observed ≈ 0.33 gzip ratio that is ≈ 27 kB gzip off every area/line cell: arealoading 114.5 → ≈ 87 against bklit 88.7. The 17 FAIL cells are all area/line-family or loading cells, so B-3 alone is expected to clear them; bar cells were already inside 10 %.

## 3. Maintainability 9 → 10: measured, not predicted

The same reachability cut is the file-count measurement: 162 modules leave the area/line graph (most of them d3 sub-files, 9 of them `internal/`). Applying the cut list from `03` §5 to the census: `internal/` 156 → 156 − 9 (moved to children) − 8 (deleted by N-a/N-b/N-c/§1) = 139 before directory grouping, ≈ 100 after grouping the heatmap (17), tooltip (10), sunburst (9), bar (8) families. That number comes from the metafile and the census script, not from a guess, so the deduction for "prediction" is gone; what remains is doing it.

## 4. Verification

1. Node script: framer `spring`/bezier vs package tween at 64 points for `candletween` and the reveal; commit as `qa/curve-parity.mjs`.
2. Sunburst: remove the package hierarchy import, re-measure the cell; expect ≤ 93.9 kB gzip.
3. B-3 on `area-chart.tsx`; re-measure arealoading; expect ≈ 87 kB gzip.
4. Census after B-3 + deletions; set the new guard baseline.
