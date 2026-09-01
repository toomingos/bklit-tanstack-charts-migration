# 10 — Refactor triage (Phase 6.4)

Post-C6 exploration of `showcase/migrated/**` (four read-only scans: dead code, duplication,
scaffolding, import hygiene), triaged here into refactor tasks. **No behavior changes in the
`refactor` commit**; every item that turned out behavioral is either logged (D-entry) or split
into its own fix commit ahead of the refactor commit. Line numbers are pre-refactor.

Verification standard for every item: `cd showcase && npx tsc --noEmit` exit 0 ·
`cd bench/app && npx tsc --noEmit -p tsconfig.json` exit 0 (includes `qa/api-compat`, the
public-API parity guard) · `showcase` eslint no new warnings · 6.5 QA/bench gate.

## A. Dead code

| # | Finding | Disposition | Ref |
|---|---|---|---|
| R1 | 35 unreferenced symbols across `internal/*` (unused exports with zero importers, orphaned helpers left behind by C1–C6 deletions) | **DELETE** — applied by the dead-code executor (list in §A.1) | — |
| R2 | `buildHoverGrowTargets` / `applyHoverGrow` / `maxHoverSegmentThickness` (sunburst hover-grow trio, `internal/index.ts:30-32`) | **DELETE** — orphaned by C5d; the hover-grow loss is accepted in D459 | D459 |
| R3 | `internal/index.ts` re-exports ~3× the set any chart consumes | **TRIM** to the consumed set (no external consumer of `internal/index.ts`; the public barrel is `charts/index.ts`) | — |
| R4 | `styles.css` `.bkm-hover-layer` rule (`:202`) — its DOM producer died with `hover-chrome.ts` (C3) | **DELETE** | — |
| R5 | `sortOthersByY` (tooltip ordering helper) — zero callers after C2 | **DELETE** | — |
| R6 | `gauge-reveal.ts` re-export forwarder — pointless indirection | **DELETE** forwarder, import the source | — |
| R7 | unused imports flagged by eslint: `TOOLTIP_SPRING` (bar-chart:57), `createElement` (tooltip-components:8), `SANKEY_MARK_ID` (sankey-chart:72), `ChartValue` (sankey-mark:44), unused `e` (sunburst-hit:64), unused eslint-disable directives (scatter-chart:1303, sunburst-chart:854) | **DELETE** | — |
| R8 | Five modules exported only from the public barrel with no chart consumer (bklit-API surfaces: `unprojectPoint` and siblings, D458) and the barrel's re-exported defaults | **KEEP** — they are bklit public API (`qa/api-compat` parity guard); with the new `sideEffects` manifest (§E) they cost consumers nothing | D458, D466 |
| R9 | `internal/y-axis-ticks.ts` flagged as "missed deletion" in 6.3 | **KEEP** — survivor with three consumers (`candlestick-chart.tsx:71`, `internal/axis-ticks.ts:13`, `index.ts:458,505`), consistent with D431 item 7 | D431 |

### A.1 R1 symbol list

Every symbol below had zero importers outside its own file at the post-C6 tree (verified by
grep + `tsc --noEmit` exit 0 after deletion). Migrated-only; the `repos/bklit-ui` originals are
untouched. `internal/index.ts` is trimmed to the 8 names that charts still import through the
barrel (`useChartMargin`, `DEFAULT_CHART_MARGIN`, `ChartMargin`, `useContainerWidth`,
`useDebouncedContainerWidth`, `useDebouncedContainerSize`, `useMeasuredRect`,
`usePositiveChartSize`); everything else is imported by file path, so the barrel re-exports were
pure indirection.

| File | Deleted |
|---|---|
| `design-tokens.ts` | `CHART_LEGEND_FADED_OPACITY_CLASS`, `LEGEND_HOVER_DIM_OPACITY`, `LEGEND_ITEM_HOVER_TRANSITION_EASING`, `LEGEND_ITEM_HOVER_TRANSITION_MS`, `LEGEND_PROGRESS_TRANSITION_MS`, `LOADING_LABEL_EXIT_S`, `LOADING_LABEL_EXIT_Y_PX`, `PROFIT_LOSS_LEGEND_DIM_DURATION_MS`, `PROFIT_LOSS_LEGEND_DIM_OPACITY`, `PROFIT_LOSS_LEGEND_DIM_TRANSITION` |
| `heatmap-utils.ts` | `getHeatmapColumnQuarterAnchor`, `getHeatmapMonthLabelColumnIndex`, `getHeatmapSeparatorGroupStartColumn`, `isHeatmapInactiveEffectEnabled`, `resolveHeatmapInactiveStyle` |
| `heatmap-hover-chrome.ts` | `computeHeatmapCellFaded`, `HeatmapCellHoverInputs` |
| `heatmap-animation.ts` | `HEATMAP_LOADING_BASE_CELL_OPACITY` |
| `grid.ts` | `DEFAULT_GRID_STROKE_DASHARRAY` |
| `chart-selection.ts` | `useSegmentVisibility`, `useChartSelectionContext` |
| `deferred-reveal.ts` | `createDeferredRevealGuard` |
| `enter-transition.ts` | `GaugeRevealTiming`, `PIE_TWEEN_FALLBACK` |
| `radar-reveal.ts` | `RadarRevealTiming` |
| `reference-area-config.ts` | `extractReferenceAreaConfigs`, `ReferenceAreaConfig`, `isReferenceAreaElement` |
| `reference-area-geometry.ts` | `createTickColorResolver`, `resolveReferenceDataRange` |
| `sankey-hover-chrome.ts` | `HoverEventHandlers` |
| `series-marker-mark.ts` | `shouldShowMarkers` |
| `tooltip-mappers.ts` | `toBoxConfig` |
| `tooltip-components.tsx` | unused `createElement` import |
| `y-domain.ts` | `createNicedYScalesByAxis` |
| `coerce-date.ts` | `numericValue` |
| `sunburst-geometry.ts` | `buildHoverGrowTargets`, `applyHoverGrow`, `maxHoverSegmentThickness`, `visibleHoverPathLength`, `ancestorGrowOffset` (dead since C5d, D450 — the inert `hoverPop` prop stays; rebuilding the pop-out is a 6.3-class change, not this pass) |
| `gauge-reveal.ts` | the `resolveEnterTransition` re-export forwarder line; `gauge.tsx` imports it from `./internal/enter-transition` directly (the file's own gauge helpers stay) |
| `chart-focus-kit.ts` | `collectFocusGroup(…, sortOthersByY)` parameter removed — every one of the 7 call sites (bar / candlestick / scatter focus strategies) passed the same value |
| `styles.css` | `.bkm-hover-layer` rule (no element carries the class after C3) |

Kept on purpose: `useProfitLossLegendHover` (public, exported from `charts/index.ts`);
`unprojectPoint` and the uncontrolled `<ChartBrush>` surface (D458/D466).

## B. Duplication (SHARED-vs-UNIQUE lens, re-run on the C6 shape)

Helpers land in `internal/` first (stage 1, one executor), then charts collapse onto them
(stage 2, three file-disjoint executors: line/area/composed/live-line · bar/candlestick/scatter ·
polar+sankey+choropleth+heatmap). Every helper must reproduce the inline code exactly (same
object shapes, defaults, memo timing).

| # | Duplicated block | Sites | Helper |
|---|---|---|---|
| H1 | inline `crosshair()` with `strokeOpacity:1` + config spring instead of `buildIndicatorMark` | bar:1096, scatter:1160, candlestick:1060 | `buildIndicatorMark({strokeOpacity, spring})` (`internal/hover-geometry.ts`) |
| H2 | two-entry series+pointer dim `states` array | line:589, area:921, composed:1143/1166 | `seriesAndPointerDimStates(opacity)` |
| H3 | `onRender` capture prologue copying `context.interaction/scene` into local refs + per-chart `clientToScene` callback | line:1180/1449, area:1379/1486, composed:1822/1981, bar:1629, candlestick:1447/1477, scatter:1581 | `useFocusInjection()` now returns `sceneRef`, `interactionRef`, `clientToScene` |
| H4 | hand-rolled `setControlledFocus(point, {source:"pointer"})` | choropleth:757, heatmap-components:685, sankey:398/545 | `focusPoint/focusSeries(…, source)` — helper landed, sites LEFT (see outcome) |
| H5 | legend-hover → `focusSeries(key)` / `clearFocus()` effect | line:305, area:311, composed:606, bar:486/1452, candlestick:509/1334 | `useLegendFocusBroadcast(lookup, api)` |
| H6 | axis option literals (fade x-axis, precomputed-opacity x-axis, y-axis, hidden axis) | candlestick:1131, scatter:1217, line:899/921/947, area:1146/1166/1191/819, composed:1444/1464, bar:1043 | `buildFadeXAxisOptions` / `buildPrecomputedXAxisOptions` / `buildYAxisOptions` / `hiddenAxisOptions` (`internal/axis-ticks.ts`) |
| H7 | native tooltip extension config (7 sites) + series tooltip body wrapper (4 sites) | line:972/1007, area:1215/1250, composed:1490/1579, live-line:762/574, bar:1052, candlestick:1109, scatter:1284 | `buildNativeTooltipExtension` / `renderSeriesTooltipBody` (`internal/native-tooltip.tsx`, new) |

**Stage-2 outcome (2026-09-01).** H1, H2, H3, H5, H6, H7 adopted at every listed site, with
these exceptions, all LEFT on purpose: H4 — none adopted; choropleth and sankey do not use
`useFocusInjection` (each hand-rolls its own render-context ref; sankey's is typed through an
`as unknown as ChartInteractionController` cast because the composite `sankeyDiagram()` datum
type is not exported) and heatmap's `scheduleFocus` forwards an already-resolved point through
show/hide debounce timers — adopting the hook there is a structural change, not a collapse. The
`source` parameter therefore lands on the hook for future callers only. H6 — area's x-axis
hidden literal (~819) reads `gridGuide.columnTicks` from a scope the helper does not see; left.
H2 — composed's bar-dim site (~1078) uses `pointerRowDimState`, a different pair; left. Only
dependency-array edits: hook-returned `sceneRef`/`interactionRef`/`captureRenderContext` added
where `react-hooks/exhaustive-deps` no longer recognises them as refs (identity is stable for the
component lifetime — behaviour-neutral); candlestick/scatter `invertSceneX*` likewise. Eslint
warnings across `migrated/` went 27 → 19 (no new ones); tsc exit 0 in both projects.

Not centralized (deliberately): bar/candlestick/scatter tooltip bodies (structurally different),
per-chart reveal `onRender` blocks (each keyed to its own mark classes — see §F), the three
polar hitbox-twin handlers (pie/ring/sunburst differ in geometry, not shape).

## C. Scaffolding / riders

| # | Item | Disposition | Ref |
|---|---|---|---|
| S1 | T1 observer consolidation — five `ResizeObserver` constructions | already inside `internal/use-container-size.ts`; consolidated to one observer factory + thin hooks (uncommitted before 6.4, lands in the refactor commit) | D460 |
| S2 | `internal/brush-drag.ts:151` "second observer" | file no longer exists (deleted in C6) | D460 |
| S3 | T6 gradient rung (D442 "~11 of ~19 sites") | survey found 75 `linearGradient` sites; only live-line's stroke/area pair (`live-line-chart.tsx:853,857`) is expressible on `spec.gradients` (objectBoundingBox, 2-stop, on a native path). Converted. The four crosshair `objectBoundingBox` gradients (line:1613, area:1693, composed:2101, live-line:892) are a **live visual regression** (a bbox gradient on a vertical `<line>` paints nothing in Chromium — verified with a pixel test) and are fixed to `userSpaceOnUse`, bar-chart's pattern. Behavioral → own commit + D464. Remaining sites are `<pattern>`/`<mask>`/radial/app-owned chrome: inexpressible at 0.15.0, version-stamped | D461, D464, D465 |
| S4 | `// TODO` / compat shims | none found that a deletion made pointless; C5's `motion-renderer.ts` is the sanctioned single motion singleton | — |
| S5 | `hoverPop` inert prop, uncontrolled `<ChartBrush>` | resolved (accepted) | D459 |

## D. Import hygiene

Value imports move from the `@tanstack/charts` root to subpaths (`/scene` defineChart, `/line`,
`/area`, `/bar`, `/group`, `/crosshair`, `/focus/mark`, `/dot`, `/rule`, `/link`, `/rect`,
`/d3/shape`). `createMark` and the core `Chart*` types have **no subpath** and stay on the root.
Honest note on payoff: `@tanstack/charts` ships `sideEffects:false`, so esbuild/webpack already
tree-shake root imports — the measured gzip effect is ~0 (D462 numbers are taken after the
change). The benefit is the dev-time module graph (Next dev resolves only the touched subpaths)
and future-proofing against a package that stops declaring `sideEffects:false`.

## E. Bundle (M2c) — measurement corrected

`bench/measure-bundle.mjs` bundled `import "./<scenario>.tsx"` — a bare side-effect import. With
`sideEffects:false` on bklit-ui every bklit scenario tree-shook to the shared TopoJSON fixture
(39,171 B gzip = the fixture alone), while the migrated barrel (no `sideEffects` declaration)
was kept whole. The recorded "5-6× gzip gap" was this artifact. Fix: entry = the scenario's
default export (`import S from …; export default S;`), plus a `showcase/migrated/package.json`
declaring `sideEffects:["**/*.css"]` so the migrated tree is shakeable for the measurer **and**
for the Next consumer. Corrected series recorded in `docs/phase-6/BENCHMARKS.md`. D462, D463.

## F. Census closure

- The D418 rename of authored marks (`className:"ts-chart__*"` → `bkm-chart__*`, 15 sites) is
  **reversed**: native motion resolves choreography roles by class substring
  (`dist/motion.js` `markMotionRole()`), so those classes are a role opt-in the marks rely on,
  and renaming them is behavioral. The guard excludes `className:` literals (D467).
- Everything that survives is the **reveal family** (D420/D433: WAAPI reveals need
  path-length/element handles the renderer does not expose), sunburst's D384 click/drill +
  SB15 fade, choropleth's raw query group (D457), bar-pulse's self-owned group readback, and
  sankey's pointer-host lookup. Each file is pinned in `scripts/reach-in-ledger.json` and
  enforced by `scripts/reach-in-guard.mjs` (ratchet: fails on any unlisted file or any pin
  exceeded; `pnpm guard:reach-in`, `.github/workflows/reach-in-guard.yml`). Final counts in D468.

## G. Lint debt left in place (behavioral risk, not refactor)

`react-hooks/exhaustive-deps` warnings (area:1366, bar:1389, choropleth:741, composed:1957,
chart-reveal-clip:100, line:992/1163, sankey:670/695) change memo/effect timing if "fixed" —
left as-is. `no-explicit-any` (choropleth:192/632, composed:415, hover-geometry:186/199,
sankey:545) — typing work, not refactor. `center-stat.tsx:320` `valueClassName` unused prop
is public API shape — left.
