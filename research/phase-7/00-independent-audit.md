# 00 — Phase 7 seed: independent audit of the migration claims

> Superseded in part by `01-blocker-routes.md` (second pass against the pinned 0.15.0 dist): every blocker in §1 now has an in-package route, and the bundle baseline in §4 is corrected there.

Date: 2026-09-03. Auditor: Fable (lead), with one Sonnet pass on the API surface.
Scope: the two claims made for the migrated package — **(1) TanStack Charts native** and
**(2) same component API as legacy bklit (seamless swap)** — checked against code and gate
output, not prose. Everything below cites the working tree at HEAD `fa6057e` plus the
uncommitted lint refactor (see §5).

Pinned upstream: `@tanstack/charts@0.15.0` + `@tanstack/react-charts@0.15.0` (exact).

---

## 1. Scores

| Aspect | Now | Achievable natively | Blocker |
|---|---|---|---|
| TanStack nativeness | 6.5 | 9 | Wipe reveal and polar/geo `states` need `onRender` workarounds or upstream |
| API compatibility | 7 | 9.5 | Shared provider layer is the only large item |
| Parity evidence | 6 | 8 | Missing Q2 fixtures; 11 hand-ruled QA issues |
| Performance claims | 7 | 8 | M1a void on the bench machine; bar only at n=100 |
| Bundle claim | 3 | 5 | Gate compares to its own pin, not to bklit |
| Maintainability | 5 | 7.5 | Motion, hover-geometry, and defs helpers can be deleted |
| **Overall** | **6** | **8.5** | |

---

## 2. Claim 1 — "TanStack native"

### 2.1 Measured

| Metric | Value |
|---|---|
| Charts on `defineChart` / `RendererChart` | 15 / 17 |
| Charts with zero TanStack imports | Funnel (pure React SVG + d3 geometry). Heatmap delegates to `internal/heatmap-components.tsx` which uses `rect` + tooltip, so it counts as native. |
| Bespoke marks via `createMark` | Candlestick ×3 (`candlestick-chart.tsx:608,687`, `internal/candlestick-marks.ts:351,450`), Gauge ×2 (`gauge.tsx:435,847`) |
| Files importing `@tanstack/charts/scene` | 15 (all take only `defineChart`) |
| Raw SVG element sites in chart files | 152 (live-line 10, funnel 8, line 7, area 5, ring 5) |
| Internal helpers rendering raw SVG / using d3 directly | 22 / 14 of 157 |
| Reach-in census | 79 sites, 0 outside ledger (`scripts/reach-in-guard.mjs`) |
| Framework features re-implemented in `internal/` | `motion-renderer.ts`, `enter-transition.ts`, `deferred-reveal.ts`, `native-tooltip.tsx`, `hover-geometry.ts` |

Net: TanStack owns scales, layout, and most geometry. Animation timing, hover chrome,
legends, loading states, and two whole charts are bespoke.

### 2.2 Native route per issue

Cross-checked against the 0.15.0 exports map, `dist/*.d.ts`, `repos/tanstack-charts/docs`,
and `archive/phase-6/research/00-native-map.md`.

| # | Issue | Native route | Moving parts | Confidence |
|---|---|---|---|---|
| N1 | `@tanstack/charts/scene` imports | Root entry exports `defineChart`. Change the import path. | none | certain |
| N2 | Funnel is hand-rolled | Upstream catalog case `125-sales-funnel` (PR #81) composes `areaX` trapezoids (`x1`/`x2` on band `y`) + `text`. One `areaX` or `compositeMark` per stage; reveal via `motion()` + `stagger({each, by})`. | D364 rejected this over div-hover affordances. Resolve with `pointer:false` + `host.interaction.setControlledFocus` (sanctioned per `interactions-and-selections.md`). Labels via `tooltip/portal` or `focusGuideY`. | high |
| N3 | Candlestick custom marks | Docs (`examples/intervals-and-financial.md`): wick = `link` (`x, y1, y2`), body = ranged `rect` (`y1: open, y2: close`). Dim via `states: [{when:{focus:'unmatched'}}]` (rect supports `states`). | Legend polarity dim → `focus:'group'` with a polarity `groupBy` key. Deletes 3 custom marks. | high |
| N4 | Linear gauge custom mark | `examples/polar-and-radar.md` §"Partial-circle gauge": gauge = `polar` + `radialArc` over a restricted pie interval (already used by the radial variant). Linear = `rect` (`x1`/`x2` linear) + `rule` notches, `rx` corner rounding. | Notch stagger via `stagger({by: index})`. | high |
| N5 | Live-line raw SVG (white fade rects, live dot, value label) | Rolling path is native: `motion.path {update:'rolling', x:'shift', y:'reproject', fallback:'snap'}`. Live dot = `dot` on last datum with `states` pulse. Label = `text` or `focusGuideY`. Edge fade = gradient **stroke paint** via `svg/resources` (`renderChartSvgWithResources` emits `<defs>` gradients and rewrites `url(#…)`), replacing mask rects. | Move the RAF y-domain lerp into `axis.viewport {domain}` (committed semantic window). Deletes the React commit loop. | medium-high |
| N6 | Zero-size `<svg><defs>` for brush clip and patterns (line/area/composed) | Group `clip: ChartBounds` (`types.d.ts:853`) is emitted as a clip path by the resource renderer. Patterns are **not** covered by `svg/resources` (gradients + clips only). | One `decorative` mark emits the pattern tile once; marks reference it by `url(#…)`. Presets stay app data. | medium |
| N7 | Custom motion engine | `motion()` renderer: interruptible springs, velocity carry-over, `stagger({each, roles, by})`, per-datum `enter/update/exit` callbacks, `createChartSpring`. Native default = 1,100 ms tween with bklit's easing (byte-level parity per native map). Bounce→spring becomes a pure options mapping. | Left-to-right wipe has no primitive. Route: spring the scene group's `clip` bounds inside `onRender` so the wipe is motion on a native node. | medium |
| N8 | HTML date pill + `hover-geometry.ts` | `crosshair({x:{label:true}, band})` paints per-axis labels with halo. `whenFocused(mark, {match:'x'})`. Tooltip ext: `anchor`, `placement`, `portal`, `sticky:false`, `motion`. | Pill typography via `className` on the crosshair label. Delete `hover-geometry.ts`. | high |
| N9 | Legend hover-dim outside TanStack | No legend-hover primitive (`interactiveColorLegend` is toggle-only). Keep legend HTML; on hover call `setControlledFocus(point, {source:'programmatic'})` so marks dim through `states`. | Needs `onRender` controller (already verified in native map). | high |
| N10 | Polar/geo marks have no `states` (D424) | Accepted upstream gap in 0.15.0. Split radar/sankey/choropleth into per-series/per-feature marks and dim through reactive per-datum `fill`. | File upstream ask: `states` on `radialArea`/`radialDot`/`radialArc`/`geoShape`. | medium |
| N11 | Loading / skeleton states | No native skeleton. `decorative` mark draws placeholder geometry; `motion()` drives the pulse; `initial:"always"` + `motion:false` for reduced motion. | Small. Keeps loading in the scene graph. | high |

Two structural moves unlock most of the table:

1. **Own the pointer, not the paint.** `pointer:false` + `setControlledFocus`. Every bklit
   hover affordance survives; dimming, tooltips, crosshairs render natively.
2. **Route defs through the resource renderer.** `renderChartSvgWithResources` with a
   stable `idPrefix` removes the zero-size `<svg>` hacks in line, area, composed, live-line.

---

## 3. Claim 2 — "Same component API"

### 3.1 Measured

| Surface | bklit | migrated | shared |
|---|---|---|---|
| Value exports (`index.ts`) | 292 | 255 | 190 |
| Type exports | 211 | 212 | — |
| Top-level chart props (name-level diff, 7 charts diffable) | Area 19/19, Composed 16/16, Choropleth 15/15, Funnel 22/22, Gauge 33/34 (+`style`), Bar 18/17 (−`status`), Candlestick 14/12 (−`xDomain`, −`xDomainSlotCount`) | | |
| Q2 check | Typecheck-only fixtures in `qa/api-compat/*.tsx`. Cannot detect props accepted but ignored. No sunburst fixture. | | |

### 3.2 Export gaps

| Bucket | Items | Fix | Effort |
|---|---|---|---|
| Renamed, exists | `ChartBrushLayout`→`BrushLayout`, `ChartBrushSelection`→`BrushSelection`, `ChartBrushSelectionPattern`→`BrushChromePattern`, `LineProps/AreaProps/BarProps/ScatterProps/XAxisProps/GridProps`→`*Config` (`internal/types.ts`), `ChartTooltipProps`→`ChartTooltipConfig` (not exported at all) | alias re-exports | S |
| Present internally, not exported | `computeYDomainsByAxis`, `niceYDomain`, `mergeYDomainRecords` (`internal/y-domain.ts`), sunburst reveal helpers (`internal/sunburst-geometry.ts`), `ChartMargin` | re-export | S |
| Dropped dependency | 9 `Gradient*` + `LinearGradient` + `RadialGradient` (`@visx/gradient`) | add dep, re-export | S |
| Genuinely absent | `ChartProvider` + `useChart/useChartHover/useChartStable` + context value types; `Pie/Radar/Ring/Sankey/Heatmap/StaticChartPreview` providers and `use*Hover/use*Stable`; `BarYAxis` (type exported, component missing); `MarkerGroup`, `SeriesMarkers`, `SeriesPointMarker`; `ChartLoadingLabel`, `LineChartLoading`, `LineLoadingPulseStroke`, `LineLoadingSweep`, `BarLoadingSkeleton`, `getSkeletonHeights` | implement shared context layer, or document as internalized | M–L |
| Not actually missing | `defaultScatterColors` (aliased), `ChoroplethFeatureComponent` | — | — |

Migrated also leaks 26 values + 59 types not in bklit (`AreaConfig`, `BrushHost`,
`HeatmapInteractionRoot`, `LegendProvider`, …). Harmless for drop-in, but widens the surface.

### 3.3 Prop gaps

| Prop | Detail | Priority |
|---|---|---|
| `enterTransition` (every chart) | bklit: full framer `Transition`. Migrated: 7-field `EnterTransition` (`internal/enter-transition.ts`). Widen and ignore unknown fields, or document. | P1 |
| `LineConfig` / `AreaConfig` | missing `loading`, `loadingPulseMode`, `onLoadingPulseCycleComplete`, `loadingStyle`; Area also `animate`, `loadingStroke`, `loadingStrokeOpacity` | P1 |
| `BarConfig` | missing `animate`, `animationType`, `staggerDelay`, `stackGap`, `groupGap`, `perspective`, `minBarHeight` | P1 |
| `BarChartProps.status` | missing | P1 |
| `CandlestickChartProps.xDomain`, `xDomainSlotCount` | missing | P1 |
| `ChartBrushProps` | missing `brushDirection`, `selection`, `useWindowMoveEvents`; types renamed | P1 |
| `margin: Partial<ChartMargin>` | structurally equal to bklit `Margin` but `ChartMargin` unexported | P2 |
| Inert props | `ChartBrushProps.host` (`internal/chart-brush.tsx:12`, "vestigial"), `LineChartProps.xDomainSlotCount` (`line-chart.tsx:223`, "accepted but inert") | P2 |

### 3.4 Runtime contract

- Migrated requires importing `showcase/migrated/charts/styles.css` (1,139 lines, scoped by
  `[data-bkm-chart]`). bklit ships no CSS. **Silent visual breakage for a drop-in consumer.**
- Two new peer deps: `@tanstack/charts`, `@tanstack/react-charts`.
- Neither package needs a provider wrap for top-level charts. Providers matter only for
  custom composition, which migrated does not currently support.

### 3.5 Fix plan

- **P0** — document or auto-inject `styles.css`; restore `@visx/gradient` exports.
- **P1** — alias renames; restore loading/animation config fields; `status`, `xDomain`;
  brush fields; widen `enterTransition`; implement `BarYAxis`.
- **P2** — shared provider/hook layer; marker and loading components; export `ChartMargin`;
  add Q2 fixtures for sunburst, `Legend`, `ChartBrush`, `ReferenceArea`, `Background`,
  `ProjectionLine`, `ProfitLossLine`, `Segment*`, `BarSquares`, `BarDepth*`.

---

## 4. Evidence quality of the README claims

Final gate run `docs/phase-6/gate/runs/2026-09-02T20-09-29-038Z` (archived under
`archive/phase-6/docs/gate/latest/`):

| Gate | Output | README says |
|---|---|---|
| QA | 190 cells. Raw: 13 gate FAIL, 13 harness FAIL, 5 out-of-range. 11 issues, all hand-ruled non-regressions (D493–D502). Tooltip checks presence-only; legend toggle not gated for any chart. | "All PASS" |
| Bench | 29 cells, 2 flagged (both speed-ups). M1a declared void on the bench machine. Bar measured only at n=100. | "~2.2× faster, ~25% less heap" |
| Bundle | +1.2% vs the migration's **own pin** (43 scenarios, Σgzip ≈ 5.4 MB). Phase 5 recorded a "5–6× gzip gap vs legacy". | "G4 ≤10% over bklit" |
| Checks | tsc, build, lint, census all ok. | — |

The README's Q1 and G4 lines are not supported by what the gate measures.

---

## 5. Precondition

The working tree at audit time had **303 modified files, 152 under `showcase/migrated/charts`
(+12,307 / −21,053 lines)** from an uncommitted lint-driven refactor, plus lint scratch files
untracked under `showcase/`. All gate results above apply to HEAD, not to disk. Land or revert
that refactor and re-run `gate:all` before starting any Phase 7 work item, so the baseline
matches the code.

---

## 6. Proposed Phase 7 work order

1. Settle the working tree; re-baseline the gate.
2. API P0 + P1 (§3.5) — small, unblocks "seamless swap" honestly.
3. N1, N8, N9, N11 — cheap nativeness wins that delete helpers.
4. N3, N4 — replace custom marks with documented compositions.
5. N5, N6, N7 — resource renderer + motion consolidation.
6. N2 — funnel on `areaX`, reopening D364 with the pointer-ownership pattern.
7. N10 — file the upstream `states` ask; split polar/geo marks meanwhile.
8. Fix the bundle gate to compare against bklit; correct the README.
