# Phase 7 — Residual gaps, third pass (routes for §9 of `01-blocker-routes.md`)

Scope: the gaps listed in `01-blocker-routes.md` §9. Method: pinned dist (`bench/app/node_modules/@tanstack/charts/dist`, 0.15.0), migrated tree, and a metafile breakdown of the four worst bundle cells (scratch copy of `bench/measure-bundle.mjs`; nothing in `bench/` touched).

## 0. Corrections to §9 (facts found this pass)

| §9 claim | Finding | Effect |
|---|---|---|
| "required `styles.css`" is an API gap | Chart modules import it themselves (`candlestick-chart.tsx:60`, `funnel-chart.tsx:14`, `live-line-chart.tsx:45`, …). Consumers import nothing. | Drop from API gaps. |
| "bklit never mounts the engine in loading-only scenarios" | `repos/…/charts/area-chart-loading.tsx:79` renders `<AreaChart>`; bklit loading bundle = motion-dom 87.6 + framer-motion 31.8 + tailwind-merge 19.4 kB raw. | Loading overshoot is not structural. Cause measured in §4. |
| bar-depth 3-D faces are raw SVG | `internal/bar-depth-marks.ts:112,237` already build them with `createMark`. | Drop from nativeness gaps. |
| funnel gap = hover scale only | `funnel-chart.tsx` and `internal/funnel-*` import nothing from `@tanstack/*`. The whole chart is raw SVG + WAAPI. | Bigger gap than listed; route in §1. |
| bundle gate data current | `bench/results/bundle-sizes.json` is dated Sep 2, before the uncommitted refactor. Today bklit/arealoading = 88.7 kB gzip vs 90.8 recorded. | Every bundle number must be re-measured on the worktree (E2). |

## 1. Nativeness

Scene primitives available to `createMark` (types.d.ts:848-921): `group` (with `clip: ChartBounds`), `rule`, `polyline{points,path}`, `area{points,polygons,path}`, `dot`, `rect`, `label`. `area.path` is a free-form path string; `area.polygons` is a ring list. That is enough for everything below.

**N-a Funnel as marks.** One `createMark` per orientation emitting a `SceneArea{path, points}` per segment (path from `hSegmentPath`/`vSegmentPath`, points = the four corners). Colors via `states` (P1). Hover scale-up is geometry, not transform: controlled focus → `hoveredIndex` → the mark re-emits the scaled segment path; the update tween is the built-in path morph (motion.js:1093 morphs `area` nodes that carry `points`). Enter uses the mark's own `ChartMotionDefinition` (createMark third argument, mark.d.ts:7). Deletes `funnel-hover-chrome`, the WAAPI `scale()` keyframes, and the funnel branch of `enter-transition`.

**N-b Pattern fills as geometry.** Instead of `<pattern>` defs, emit the hatch itself: generate 6 px-pitch diagonal stripe quads in user space, clip each against the area polygon (Sutherland–Hodgman, clip = convex stripe, subject = area ring), and emit the pieces as one decorative `SceneArea.polygons` mark under the fill. Spacing and phase are pixel-identical to visx `PatternLines` because both are user-space. Heatmap cells reduce to rect-vs-stripe clipping. ~80 lines, O(stripes × vertices) per render on already-decimated points. Deletes `pattern-preset`/`pattern-area-mark` defs and the heatmap `<pattern>` phase-shift wrapper. Fallback if perf bites on huge areas: `spec.gradients` with hard stops (svg.js:19 emits `<linearGradient>` in objectBoundingBox units) — approximate, not parity.

**N-c Loading sweep.** A decorative `SceneRect` mark keyed `sweep`, animated with a CSS keyframe on `[data-ts-key="…:sweep"]` (translateX, `animation-iteration-count: infinite`, reduced-motion media query). Same mechanism as W1. No raw SVG.

**N-d Live-line edge fade.** `spec.gradients` supports per-stop `opacity` (types.d.ts `ChartGradientStop`). Reference the scoped id from the mark's `stroke`/`fill`. Verify: how a mark resolves `scopedId(idPrefix, id)` (svg.js:19) — if only the renderer knows the prefix, read it from `onRender` and pass it into the definition.

**Remaining non-native after N-a…N-d:** CSS keyframes for wipe (W1) and sweep (N-c). Both are declarative rules on renderer-keyed nodes, not DOM writes.

## 2. API

**A-a Real d3 scales on `useChart()`.** `d3-scale@4.0.2` is already a dependency of `@tanstack/charts` (package.json; `bar.js:1` imports `scaleBand`). The provider adapter builds `scaleLinear/scaleTime/scaleBand` from `ResolvedScale{type,domain,map,bandwidth}` and hands those out. Full `nice/copy/tickFormat/invert` identity, types from `@types/d3-scale` (present transitively). Cost ≈ 2–4 kB raw on charts that had no bar mark. No new dependency line.

**A-b `@visx/gradient` re-exports.** Re-implement `LinearGradient`/`RadialGradient` with visx prop names. `LinearGradient` registers `{id,x1,y1,x2,y2,stops}` into the spec's `gradients` through context, so the renderer emits it natively (`data-ts-key="gradient:<id>"`). `RadialGradient` has no native counterpart → local `<radialGradient>` in defs (decorative, documented).

**A-c framer `Transition` mapping.** `ease: [a,b,c,d]` → `bezier-easing` function (already in `internal/bezier-easing`) passed as `ChartMotionTweenTransition.easing`; keyframe arrays → last value, documented as lossy. `type: "spring"` → `ChartMotionSpringTransition` 1:1.

**A-d Inert `host` / `xDomainSlotCount`.** `host` → `cursorHost` (`createChartCursor`); `xDomainSlotCount` → x-domain padding on the spec. Both wire to package features, so they stop being inert.

**Residual after A-a…A-d:** radial gradient defs; keyframe arrays lossy. Both documented, neither changes call sites.

## 3. Evidence

**E-a Transient probe (`qa/transient-probe.mjs`).** Framework-agnostic: trigger the event (hover, legend hover, tooltip move) then sample the keyed element's computed `opacity`/`fill`/`transform`/`d` every `requestAnimationFrame` for ~60 frames in both impls; compare normalised curves (max abs error, settle frame). Works where K4's WAAPI readback is blind (framer writes attributes per frame). Replaces eyeballing for hover, tooltip fade, legend dim, funnel morph.

**E-b Hand rulings → fixture cells.** Each of the 11 rulings becomes an expectation in `qa/api-compat` with the ruled value and a `ruling:` tag. Drift fails the gate instead of re-opening a discussion.

**E-c Explained speed-ups.** Record DOM node count and active animation count per scenario in the bench summary; a faster cell with fewer nodes/animations is explained by the data, not by a note.

**E-d Freshness.** Gate artefacts carry the git tree hash of the worktree they were produced from; `summarize.mjs` refuses mismatched artefacts. Catches the stale `bundle-sizes.json` case above.

## 4. Bundle

Metafile breakdown (raw kB, esbuild min, react external):

| cell | total | biggest contributors |
|---|---|---|
| bklit/arealoading | 261 | motion-dom 87.6, framer-motion 31.8, tailwind-merge 19.4, d3-color 17.1 |
| migrated/arealoading | 340 | @tanstack/charts 156.3, area-chart.tsx 20.8, d3-color 14.2, d3-selection 12.4, d3-transition 10.7, d3-brush 8.9, reference-area-layer 5.6, pattern-preset 5.3, chart-markers 4.7 |
| bklit/barloading | 204 | motion-dom 85.3, framer-motion 26.5, tailwind-merge 19.4 |
| migrated/barloading | 249 | @tanstack/charts 144.8, bar-chart.tsx 18.1, reference-area-layer 5.6, pattern-preset 5.3, bar-pulse-mark 3.9 |
| migrated/sunburst | 268 | @tanstack/charts 131.3 (engine floor), sunburst-chart.tsx 8.7, d3-hierarchy 4.7 |

**B-3 Optional layers own their imports.** `area-chart.tsx` has 68 imports (40 from `internal/`) and, with `line-chart.tsx`, statically imports the brush subpath (`interaction-brush.js` ← area-chart.tsx, line-chart.tsx), dragging d3-brush + d3-selection + d3-transition (32 kB raw) into every area/line scenario including the loading preset. Add reference-area, pattern, markers, projection: ≈ 50 kB raw ≈ 15 kB gzip per chart that never uses them. Move each layer into its child component (`<Brush>`, `<ReferenceArea>`, `<Pattern…>`, `<Marker>`, `<Projection>`) registering through `useChartMarks()` (A1). Predicted: migrated/arealoading 114.5 → ~99 kB gzip (bklit 88.7 → ×1.12 from ×1.29); most of the 17 FAIL cells drop under 10 %.

**B-4 CSS column.** `bench/measure-css.mjs` (new file, nothing protected): migrated = gzip of the per-family slice of `styles.css` (split it per family first); bklit = `tailwindcss --content 'repos/bklit-ui/packages/ui/src/charts/**'` output gzip. Reported next to JS in the gate summary. Makes the comparison apples-to-apples instead of stubbing CSS to zero on both sides.

**B-5 Engine floor.** `@tanstack/charts` core ≈ 131 kB raw (~40 kB gzip) vs framer+motion-dom ≈ 118 kB raw. The floor is comparable; the overshoot is the migrated layer, not the package.

## 5. Maintainability

**M-a B-3 is the restructure.** Moving layers to child-owned modules is the same change that shrinks `area-chart.tsx`/`line-chart.tsx` from ~1,400 lines and 40 internal imports to a spec builder plus registered marks. Not a separate phase.

**M-b N-a deletes** `funnel-hover-chrome`, funnel branches of `enter-transition`, and the funnel `styles.css` block.

**M-c D472** (cardinality-gated renderer) should fall away once per-datum charts carry `states` (P1) and no longer need the DOM-side hover writes that motivated the gate. Verify by removing the switch and running QA.

> Residue of §6 is routed in `03-final-routes.md` (fourth pass).

## 6. Achievable scores after this pass

| aspect | 01 | now | what still deducts |
|---|---|---|---|
| Nativeness | 9.5 | 9.8 | two CSS keyframe rules (wipe, sweep) |
| API | 9.5 | 9.8 | radial gradient defs; keyframe arrays lossy |
| Evidence | 9 | 9.5 | probes still sample, not prove; 5 out-of-range bench cells |
| Bundle | 8 | 9 | engine floor makes sunburst/pie-class cells ~×1.1 regardless |
| Maintainability | 8 | 8.5 | 157 `internal/` modules remain until B-3 lands and is measured |

## 7. Verification order

1. E-d + E2: worktree gate with tree hash; re-measure bundle (bundle-sizes.json is stale).
2. B-3 on `area-chart.tsx` only → re-measure arealoading/profitloss; confirm ≥ 12 kB gzip drop before rolling to line/bar.
3. N-b prototype on `patternarea` fixture; pixel-diff against bklit at 1× and 2× DPR.
4. N-a funnel; run E-a probe on the hover morph vs bklit's framer scale.
5. A-a scales; run the type fixture (E1).
6. B-4 CSS column; publish both sides.
