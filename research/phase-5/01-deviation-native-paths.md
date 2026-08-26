# Phase 5 / 01 — Native Paths & Upstream Verdicts (per deviation)

> For each audit deviation: the native-migration solution + verification of every "no TanStack equivalent" claim against **latest upstream** (`TanStack/charts@main` @ `a285ce7`, npm `@tanstack/charts@0.14.0`, 2026-08-15). Verified via web docs, `gh` CLI, tarball unpacks. Local clone (~Jul 30 snapshot) is NOT ground truth.

**Cross-cutting blocker:** version skew. Vendored source predates motion system, interaction package, `ticks.values`, tooltip tokens, binning marks, `states`. Re-vendor ≥0.14 first — several audit negatives are refuted on latest.

## #1 Heatmap → migrate fully (feasible; biggest win: 0%→~90%)

| Claim | Verdict | Evidence |
|---|---|---|
| No binning transforms upstream | REFUTED | `binTimeX/Y`, `binXY`, `binX/Y` since 0.3.0; case 118 uses `binTimeX(events,{interval:utcDay})`. Calendar *placement* stays app-authored |
| No per-mark color channel | REFUTED | `RectOptions.color?: Channel` → chart color scale; recipe `cell(scores,{x,y,color:'score'})` |
| No cell stagger | REFUTED | `stagger()` generic since 0.13 (PR #96): `by:'datum'\|'series'`, `roles:'rect'`; all marks accept `ChartMarkMotionOptions`; needs motion() renderer |
| No declarative focus styling | REFUTED | Inline mark `states` (`when:{focus:'unmatched'}`), `whenFocused()`, `keyedSelection`+`whenSelected` |
| No loading/skeleton | CONFIRMED (app-owned) | SSR `prerender()` = hydration shell, not loading state |

Path: keep our binning math only if targeting old clone (obsolete after re-vendor); emit flat cells `{id,x1,x2,y,count}` → `cell(...)` + dual band scales + chart-level color scale → `<Chart>`.
Prior art in-repo: `repos/tanstack-charts/examples/sandbox/src/plots.ts` (`createHeatmapChart`, `createTriageChart`). Official: catalog `heatmap-labeled`, `24-quantitative-binned-heatmap`, `25-calendar-heatmap`, `118-token-usage-calendar`.
Bonus upstream marks: `hexbin`, `contour`, `densityContour`, `mosaicX/Y`, `waffle`, `colorGradientLegend`.

## #2 Funnel → do NOT migrate (upstream retroactively ratifies D30/D54)

- No funnel mark/series on latest main (catalog `llms.txt` enumerates every family; zero funnel hits under `packages/*/src`; 0 of repo's 17 issues request one; Discussions disabled).
- PR #81 (merged 2026-08-11, commit `38ad7e5749d5…`, shipped v0.11.0) added conformance case `125-sales-funnel` — composition-only: `areaX` trapezoids over synthetic linear domain + `text` labels, axes off; layout math case-local (`funnelLayout`: centered endpoints, inset 0.035, width ratio 0.72), unexported. Canonical URL: `/charts/catalog/charts/125-sales-funnel`.
- Correction: no explicit "refusal" statement anywhere — refusal was structural via coverage-audit class ("Definition now"; sunburst = "Optional primitive").
- Migration would LOSE bklit spring reveal + div-hover affordances (scene nodes limited to `group|rule|polyline|area|dot|rect|label`, "deterministic and DOM-free"; springs need motion renderer).
- Action: log case 125 + golden preview SVG as post-freeze corroboration / cross-check reference.

## #3 Animation → replace with `motion()` on ≥0.14; WAAPI shell sanctioned residue

| Claim | Verdict | Evidence |
|---|---|---|
| motion() browser-SVG-only | CONFIRMED | Static SVG/Canvas ignore definition motion ("not a Web Animations... adapter"). Canvas nuance: host-driven rAF whole-scene interp exists (canvas.ts L208–271) but never definition-driven |
| Springs + solver | CONFIRMED | `spring.ts`: defaults `{stiffness:170, damping:26, mass:1}` (**26, not 18**); velocity-preserving retarget; updates ignore delays; 10s cap; `./spring`→`createChartSpring` |
| Defaults = bklit M1b curve | CONFIRMED | motion.ts L207–210: `1100ms`, `cubicBezier(0.85,0,.15,1)`; entrance = baseline growth (bars/paths/arcs), opacity only as topology fallback |
| Tooltip tweening uncovered | REFUTED | Built-in HTML tooltip controller tweens movement/presence (WAAPI + rAF springs). Don't rebuild it |
| Coverage gaps | CONFIRMED | Legends/app controls excluded; dataset crossfade primitive absent (falls back to enter/exit opacity); lightweight `svgAnimation` path has no springs/cascade/velocity |

Also confirmed: zero per-frame React renders; SSR adopts silently unless `initial:'always'`; no built-in decimation (LTTB stays ours).
Residue rule: WAAPI stays ONLY for app-owned hover chrome (upstream precedent: chart-internal chrome rides renderer clock; external controls use plain CSS).

## #4 Geo zoom (@visx/zoom) → remove; hand-roll matrix

- Interaction package = exactly 5 gestures (`controlledSignal`, `brushX`, `continuousCursor`, `handleX`, `zoomX`). No zoomY/zoomXY/2D/geo anywhere (roadmap registers one capability: `zoom-x`). `zoomX` = 1D `[start,end]` window hardcoded to x scale; `geoShape` omits Cartesian axes entirely.
- Docs: "Zoom and pan state belongs to the application" + "Import d3-zoom directly only when the application needs a different gesture policy." All six geo catalog cases static.
- Correction: case 90 uses first-party `zoomX` (which internally wraps `d3-zoom@3.0.0`), not raw d3-zoom.
- Replacement: ~150-line `internal/zoom-matrix.ts` (see `02-visx-removal.md` for full spec). Bench unaffected (D34 excludes choropleth zoom).

## #5 Pattern fills (@visx/pattern) → remove; port presets

- Resource registry is linearGradient-ONLY (not even radialGradient; zero `<pattern>` hits repo-wide). Upstream's own case 84 fakes a hatch as a 14-stop linearGradient while its recharts reference uses a real `<pattern>`.
- `url(#id)` passthrough on SVG verified verbatim (svg-resources.ts:16–22) — undocumented; Canvas resolvePaint nulls unknown ids (silent invisible fills off SVG hosts). See `02-visx-removal.md` § stability for risk ruling.
- Zero issues/PRs ever requested patterns. Port ≈130 lines → `internal/pattern-preset.tsx`; delete bridge.

## #6 Overlay chrome → mixed verdicts

| Fragment | Verdict | Notes |
|---|---|---|
| Tick format/values/rotation/hiding | native-config | `ticks.values`, `tickLabels.*` on 0.14; XAxisOverlay's data-aligned policy maps onto `ticks.values` |
| Per-value colored tick text + pills | custom-mark-in-scene | No fill/background accessor (scene.ts hardcodes `theme.muted` + fillOpacity .68 ~L1494); `muted` globally overridable only; pills = paired rect+text mark |
| Reference rules / flat bands | native-config / in-scene | `ruleX/ruleY` (null-skipping legal); `rect({x1,x2,y1,y2})` or ranged areaY — domain materialization caveat holds; escape hatches: fixed-domain scale instance or empty-channel custom mark |
| Patterned/faded areas, edge fades, ifOverflow clamping, corner markers | stays-as-overlay | Zero repo hits for ifOverflow/fadeMask; gradients-only resources |
| Z-ordering | native-config | Declaration order = paint order; fixed groups grid→marks→axes→legend; focus-guide `placement:'under'|'over'` exists (declaration-derived) — phrase as "no *arbitrary* z-index" |
| Marker/hover bands & pill labels | custom-mark-in-scene (0.14) | `crosshair` (rules, categorical bands, halo labels, intersection marker) + `focusGuideX/Y` (rule+marker+pill w/ boxStyle/radius/padding). DON'T: dim multi-series, band continuous axes, rich content (formatted strings only), participate in hit-testing |
| Tooltip content | native-config | Extension token `@tanstack/charts/tooltip` (items/sort/anchor/placement/content/format/sticky/visibility:'pinned'); React body via `renderTooltipBody`; chrome = CSS variables only |
| Tooltip chrome beyond body; positioning override; leader lines; multi-chart sync | stays-as-overlay | Host retains anchoring/placement/portals/pinning; app-level via onFocusChange/getScene (= today's hover-chrome) |
| Loading states | stays-as-overlay | Application-owned per upstream responsibility table |
| Label-position tweens | needs motion renderer | Definition motion is "inert policy" otherwise |

Open adjacent upstream issues: #93 axis title styling · #94 focus ring · #95 legend items · #28 rounded corners. No open requests for any exact gap above.

## Corrections log (vs earlier statements)

1. PR #81 refusal was structural, not explicit
2. Case 90 uses first-party zoomX; d3-zoom is its internal dep
3. Spring default damping 26; M1b defaults confirmed at motion.ts L207–210
4. Tooltip motion already handled upstream — don't duplicate
5. Canvas has host-driven rAF but not definition-driven motion
6. url(#id) passthrough = SVG-hosts only; Canvas nulls
7. "No z-index" → "no arbitrary z-index"
8. Heatmap rationale ("upstream lacks binning/color/focus") invalid ≥0.14 → heatmap re-scope mandatory post-revendor
