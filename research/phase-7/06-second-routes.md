# Phase 7 — routes for the second-audit gaps (sixth pass)

Routes for every gap in `05-second-audit.md`, using only the pinned `@tanstack/charts@0.15.0` dist and the existing harness. Facts cited are from `bench/app/node_modules/@tanstack/charts/dist/*.d.ts`.

## 0. Corrections to `05`

| Item | Correction |
|---|---|
| N-1 "44 parallel scale call sites" | 22 of the 44 are **factories handed to the package** (`() => scaleBand().domain(..).padding(..)`, `bar-chart.tsx:2316`). `ChartScaleInput` accepts `ConfiguredScaleLike \| ChartScaleFactory` (`types.d.ts:38-42,230`), so those are the sanctioned input form, not a gap. The real parallel set is the 22 sites that call `.range(` locally, in 10 files. |
| A-3 "standalone `<Area>` paints in legacy" | Legacy `useChartStable()` throws outside a chart provider (`chart-context.tsx:376-383`). Standalone render is not legacy behaviour. The remaining difference is *loud* failure (legacy) vs *silent* (migrated). |
| M-1 "350 vs 156" | 156 was the reachable set for the arealoading cell; 350 is the tree. Both are true; routes below target the tree. |

## 1. Nativeness

### N-1 Parallel scales → read the package's resolved scales
Every parallel scale exists to compute a pixel position outside the mark pipeline (markers, projections, reference areas, overlay geometry, tooltip anchors). Two package surfaces already hold the same numbers:
1. **Inside marks**: `MarkRenderContext.scales: Record<string, ResolvedScale>` (`types.d.ts:643`) with `map`, `invert`, `bandwidth`, `ticks`, and `viewport.map` for zoomed/shifted state. Any geometry that ends up as a `createMark` scene (`bar-trimmed-mark`, `line-marker-anchors`, `composed-overlay-geometry`, `reference-area-scale`) reads `context.scales[id].map(v)` and drops its d3 import.
2. **Outside marks**: `Chart.onRender(context)` gives `context.scene.scales` (`dom-types.d.ts:167-173`; `types.d.ts:939`). A tiny `useResolvedScales()` hook stores that record in state; tooltips, brush overlays, and any React-side overlay use it. The scale objects the *consumer* sees in callbacks (`02` §2 A-a) come from the same record, so this also closes the "d3 scale objects exposed to callbacks" route with one source of truth.
Expected: 22 `.range(` sites → 0; 26 `d3-scale` imports → the 22 factory sites only. `y-domain.ts` and `heatmap-cell-motion.ts` keep d3 for domain nice-ing, which is data prep.

### N-2 Heatmap coordinate system and axes → band scales + package axes
`ResolvedScale.bandwidth` (`types.d.ts:610`) and the `'band'` motion role mean band scales are first-class. Route:
1. Declare x and y as band scale factories (`scaleBand().domain(columns)` / `.domain(rows)`) in the heatmap `defineChart` spec; the package resolves range and bandwidth.
2. Cells become the existing rect marks placed by `scales.x.map(col)` / `scales.y.map(row)` with `bandwidth`; delete the arithmetic closures in `heatmap-chart-inner-layout.ts:124-135`.
3. Axes become package axes with `ticks.values` = the category list and `ticks.format` for labels (`ChartAxisTickOptions`, `types.d.ts:165-178`); delete `heatmap-x-axis.tsx` / `heatmap-y-axis.tsx` and their 2 portals. Label thinning comes free from `ChartAxisTickLabelThinOptions`.
4. The hover cell/crosshair uses `findContainingScenePoint` (below).
Expected: heatmap module count 30+ → ~12; `createPortal` 17 → ~13 (remaining portals are tooltips).

### N-3 Own polar hit-testing → `findContainingScenePoint`
`nearest.d.ts:6` exports containment hit-testing against the scene (`findContainingScenePoint(scene, x, y)` → `{point}`), and `ChartInteractionController.resolvePointer(clientX, clientY)` (`dom-types.d.ts:35`) already runs the definition's focus strategy in scene space. Route:
1. Pie/ring/sunburst arcs are package `radialArc` marks, so each arc is a `ChartPoint` in `scene.points`. Replace `hitTestPolarBands` / `pointerToCenterOffset` with `interaction.resolvePointer` (obtained from `onRender`), falling back to `findContainingScenePoint(scene, ...)` when a definition-level focus strategy is not wanted.
2. `setControlledFocus(point)` replaces the `pie-hover-chrome.ts` broadcast store; legend hover and keyboard focus call the same function, so hover state has one owner.
3. Sunburst's hand-built hit-path `<svg>` overlay (`internal/sunburst-hit.tsx`) is deleted; containment is computed, not painted.
Expected: `polar-hit.ts`, `pie-hover-chrome.ts`, `sunburst-hit.tsx` removed (3 files, ~2 kB gzip).

### N-4 Layout outside the package → package layouts already exist
| Chart | Current | Package primitive |
|---|---|---|
| choropleth | d3-geo projection + own path → raw marks | `geoShape(source, {projection})` mark (`geo.d.ts:43`); projection can be a d3 `GeoProjection` or a descriptor (`geo.d.ts:16`). The `'geo'` motion role handles enter/update. |
| sankey | `d3-sankey` in `internal/sankey-layout.ts` | `sankeyDiagram(nodes, links, options)` (`network-sankey.d.ts:113`) with alignment, insets, comparators; produces node/link marks with the `'link'` motion role. Animated flow gradient (N-5) becomes `spec.gradients` + `ChartRollingPathMotion` on links. |
| sunburst | package `sunburst()` **and** `internal/sunburst-geometry.ts` | keep `sunburst()` only (already routed in `04` §2). |
Expected: `d3-geo`, `d3-sankey` imports → 0 (they remain transitive deps of the package). `choropleth-chart.tsx` 1 036 lines → ~400.

### N-5 Imperative DOM writes → state-driven scene updates
- Tooltip indicator springs (`setAttribute("cx"|"x"|"x1")` in 3 files): the package tooltip anchor accepts a function `(points, context) => ChartTooltipPosition` (`types.d.ts:1143`), and `createChartSpring` (`spring.d.ts:28`) is the package's own spring. Route: the indicator is a decorative `SceneDot`/`SceneRule` in a `createMark` with `ChartMotionDefinition` `spring` timing on `x`/`cx`; the package tweens it. Zero `setAttribute`.
- Sankey gradient/`pathLength` writes (`sankey-animation.ts:58-101`): covered by N-4 (`spec.gradients` + rolling path motion).
Expected: `setAttribute` 27 → ≤4 (aria only), `createElementNS` 6 → 0.

### N-6 Bespoke-mark footprint
Not a defect. Record the 18 `createMark` files in the census as the sanctioned extension surface and gate the count so it does not grow silently.

**Nativeness after N-1..N-5: 9.5.** Residue: funnel (`02` N-a), d3 domain prep.

## 2. API parity

### A-1/A-2 Config-carrier children → registration components (multi-step)
Goal: keep the parent-owned `defineChart` spec (that is what makes rendering native) while restoring the legacy contract that a child is a real component detected by *presence*, not by element type.
1. **Registration**: each carrier becomes a real component that, when rendered under a chart, calls `useChartChild(role, props)` → registers `{role, props}` into a parent-provided registry (`useSyncExternalStore`), returns `null`. Wrapped/HOC'd children register because they *render*, not because the parent recognised their type. Detection by symbol stays as the fast path; the registry catches everything the scan missed.
2. **Two-phase spec**: parent renders children first (they are `null`, cheap), reads the registry in a layout effect, and builds the spec from `scan ∪ registry`. One extra commit on mount; none on updates (registry updates are keyed and compared).
3. **Loud failure**: a carrier rendered with no chart context throws the same message legacy throws (`chart-context.tsx:379-382`). Silent no-op → loud error, matching legacy exactly.
4. **Name fallback**: `roleOf(type)` additionally checks `type.displayName ?? type.name` against the role table (`children-extract.ts:72-77`), mirroring `area-chart.tsx:84-89`.
Verification: a fixture that wraps `<Area>` in a `withDefaults(Area)` HOC and asserts the scene has an area mark; a fixture that renders `<Grid>` alone and asserts the throw.

### A-4 Named callback type
Export `ChartBrushSelection` from `index.ts` and use it in `ChartBrushProps.onSelectionChange`. One line.

### A-5 Legend exports
Re-export `ChartLegend`, `ChartLegendProps`, `ProfitLossLegend`, `ProfitLossLegendProps` from `index.ts`; their signatures already match legacy.

**API after A-1..A-5: 9.5.** Residue: framer keyframe arrays (`03` §3).

## 3. Evidence

| Gap | Route |
|---|---|
| E-1 artefacts gitignored | Split outputs: `qa/gate/latest/{SUMMARY.md,cells.json,tree-hash}` is **tracked** (small, text); screenshots/runs stay under `archive/`. `summarize.mjs` writes to the tracked path; `run-all.mjs` refuses to publish if `git rev-parse HEAD` + working-tree hash differ from the hash recorded in `cells.json`. |
| E-2 tree does not typecheck | `run-checks.mjs` already exists; add `tsc --noEmit` and `oxlint --deny-warnings` as the first gate step so the gate cannot go green on a broken tree. Fix the 3 `TS2322` in `reference-area-layer.tsx:150-162` by narrowing the `Value` type at the carrier boundary. |
| E-3 zero tests | The package is headless-renderable (`renderChartSvg`, `03` §6). A `node --test` suite under `qa/unit/` renders each fixture's spec and asserts scene invariants (mark count, point count, scale domains, gradient ids). No browser, ~1 s. This is also where A-1's HOC/throw fixtures live. |
| E-4 1055 lint errors | Gate on the count (`≤ current`) today, `0` after the N-routes delete the worst files (heatmap, sankey, tooltip springs account for a large share). |
| E-5 fixture coverage | Generate fixtures from the bench roster: `qa/gate/roster.txt` lists 43 cells; a script emits a typecheck fixture per cell that lacks one, so the fixture set and the bench set cannot drift. |

**Evidence: 9.5.** Residue: per-frame transient assertions (`03` §6).

## 4. Bundle

- Pins measure drift, not parity: add a second column to `bundle-gate.mjs` comparing `migrated/<cell>` gzip against `bklit/<cell>` with the ratio policy from `04` (≤ 1.10, no allowances).
- CSS blind spot: `bench/measure-bundle.mjs` is protected; `bench/measure-css.mjs` (`02` B-4) emits the CSS column. With N-2/N-3/N-5 deleting heatmap axis, sunburst hit, and tooltip indicator styles, `styles.css` 49.9 kB drops by an estimated 30 %; measure, do not predict.
- N-4 removes `d3-geo`/`d3-sankey` from migrated bundles only if the package's own copies are the same modules; both are already package deps, so esbuild dedupes.

**Bundle: 9.5** (given `04` executed).

## 5. Maintainability

| Gap | Route | Expected |
|---|---|---|
| M-1 350 modules | N-2 (−18), N-3 (−3), N-4 (−6), N-5 (−4), `04` §3 (−17), M-3 (−9), M-4 (−1) | ≈ 290 before family grouping; grouping does not change count, so also merge the `*-child.ts` carriers (32 files, ~10 lines each) into one `children.ts` table → ≈ 260 |
| M-2 ×1.57 LOC | Same deletions; `bar-chart.tsx` 2 854 lines is dominated by 5 scale builds and overlay geometry that N-1 removes | target ≤ ×1.2 |
| M-3 orphans | delete the 9 files; gate with the scratch `orphans.mjs` moved to `scripts/orphans.mjs` | 0 |
| M-4 `__tm` | `git rm`; add `__*` to `.gitignore` | — |
| M-5 fan-in | `types` (126) is fine; `chart-child-carrier` (59) collapses with the carrier merge | — |

**Maintainability: 9.**

## 6. Scores after this pass

| Aspect | `05` | Routed |
|---|---|---|
| Nativeness | 5.5 | 9.5 |
| API | 6 | 9.5 |
| Evidence | 5 | 9.5 |
| Bundle | 7 | 9.5 |
| Maintainability | 4 | 9 |

## 7. Verification order
1. `onRender` → `useResolvedScales()`; replace the 22 `.range(` sites; assert `grep -c ".range(" == 0` outside factories.
2. Heatmap band scales + package axes; screenshot cell must stay in-range.
3. `resolvePointer` on pie; delete `polar-hit.ts`; K-hover probe on the pie cell.
4. `geoShape` on choropleth, `sankeyDiagram` on sankey; screenshot cells.
5. Registration children + HOC/throw fixtures under `qa/unit/`.
6. Tracked gate summary + typecheck/lint gate step.
