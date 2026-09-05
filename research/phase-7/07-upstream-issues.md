# Phase 7 — Upstream issues to file on TanStack/charts

Date: 2026-09-04. Status: **filed 2026-09-05 (V0.5)** — I1 #126, I2 #127, I4 #128, I5 #129, I6 #130, F-260 evidence issue #131; I3 deferred (after V2.5 + V3.5). Drafted 2026-09-04. Revised the same day after the lead pass against `v0.16.0` (`repos/tanstack-charts`, 258ed39) and `API-FRICTION.md`: I4–I6 added, the pattern decision reversed, I2 demoted. Filing is V0.5 in `08`.

Search basis: all 19 issues and 106 PRs on `TanStack/charts` (open + closed), grepped title+body per topic. Discussions are disabled, so issues are the only tracker. There is no issue template and `CONTRIBUTING.md` has no issue-filing section. The accepted house style (from #93, #94, #95, #117, #119, all implemented within days): one paragraph on what the option surface exposes today, the concrete missing capability, the workaround it forces, then a single "Would it be possible to expose…" ask. Bug reports add a version line and a minimal runnable repro. Separate issues land better than an omnibus.

Ruling (user, 2026-09-04): file issues only, no PRs, and only for features other libraries commonly have and other users will share.

## Summary

| # | Topic | Prior art upstream | Decision | When |
|---|---|---|---|---|
| I1 ([#126](https://github.com/TanStack/charts/issues/126)) | `states` on polar marks and `geoShape` | none. #90 (merged 2026-08-12) added `focusGroupAngle` for radial focus *resolution*, not styling. #15 modelled focus effects as `whenFocused` marks. | **File** | now |
| I2 ([#127](https://github.com/TanStack/charts/issues/127)) | Legend hover highlight / dim | none. #95 (open) + PR #122 cover legend *presentation* only (typography, indicator, spacing). Upstream's own catalog (cases 120, 121, 127) keeps legends in app HTML and drives controlled focus, so this is a convenience ask, not a gap. | **File, low priority**, as a sibling to #95 | now |
| I3 | Motion renderer per-element point scan (D472) | none. #41 introduced `motion()`, #96 entrance/exit/stagger, #58 rolling path. No perf report. | **File as bug with repro**, only if the cost remains after V3.5 makes `motion()` the sole owner and V2.5 adds `spatialIndex` | after V2.5 + V3.5 |
| I4 ([#128](https://github.com/TanStack/charts/issues/128)) | `<pattern>` resources in `ChartSpec` (hatch, dots, animated sweep) | **F-259** (open, `API-FRICTION.md:7784`): "Chart resources cannot declare patterns"; it rejects an app-injected pattern inside the chart svg as a workaround. No issue yet. | **File**, citing F-259 with the bklit use cases | now |
| I5 ([#129](https://github.com/TanStack/charts/issues/129)) | `radialGradient` in `ChartSpec.gradients` | none. `gradients` is linear only (`objectBoundingBox` %, `types.d.ts:400-406`). | **File** | now |
| I6 ([#130](https://github.com/TanStack/charts/issues/130)) | `@tanstack/react-charts` peer `react` `^19.0.0` although only React 18 hooks are used | none | **File** | now |
| — ([#131](https://github.com/TanStack/charts/issues/131)) | F-260 static guide stroke treatment (dashed grid) | **F-260** (open, `API-FRICTION.md:7800`). | Do not open a new issue; **add an evidence comment** on the friction entry's tracking issue if one exists, else a short issue referencing F-260, with the bklit default `strokeDasharray="4,4"` grid | now |
| — | F-261 per-corner bar radius | **F-261** (open). | Drop. bklit uses uniform `rx`; not our gap. | — |
| — | Funnel mark | #81 (merged) added catalog case `125-sales-funnel` from `areaX` + `text`. | Do not file. Composition of existing marks; we migrate to it (V3.1). | — |
| — | Clip reveal / wipe entrance | none | Do not file. `motion({ initial: 'always' })` grows marks from the baseline and is how upstream reproduced the Bklit entrance (case 112, `benchmarks/motion/README.md`). | — |
| — | 0.16.0 strict mark option literals breaking wrappers | none (#34 was scale typing). | Do not file unless the 0.16.0 upgrade in V0 shows a real wrapper break. | after V0.2 |

## I1 — `states` on polar marks and `geoShape`

**Evidence (pinned 0.15.0 dist, unchanged in 0.16.0):** `states` is a field of `InitializedMarkBase` (`types.d.ts:672-675`) and `scene.js:187-197` wraps *any* mark carrying it, so the resolver already handles polar scenes. Only the Cartesian option types declare it (`line`, `area`, `areaX`, `bar`, `rect`, `dot`, `text`, `waffle`, `ridgeline`, `difference`, `violin`). `RadialArcOptions` (`polar.d.ts:98`), `RadialAreaOptions` (`:185`), `PolarOptions` (`:80`) and `GeoShapeOptions` (`geo.d.ts:54`) do not. Our LOG D424 records the fidelity dropped because of this (radar stroke pop, dot ring dim, sankey node stagger, choropleth pattern dim).

**Our interim route:** a `withStates(mark, data, definitions)` wrapper that sets `states: { data, definitions }` on `initialize`, the same shape as `whenFocused`. Works today; the issue asks for the option so the wrapper can go.

**Draft:**

> **Title:** Support `states` on polar marks (`radialArc`, `radialArea`, `radialDot`) and `geoShape`
>
> Cartesian marks accept `states` (`when: { focus }` + `style` + `transition`) so a focused or unmatched datum can change `fillOpacity`, `stroke`, `r`, etc. natively. The polar marks and `geoShape` do not declare `states` in their option types, although the scene layer already resolves `states` for any initialized mark that carries the field (a wrapper that sets it on `initialize` works in 0.15.0/0.16.0).
>
> Without it, legend hover dim and focus lift on pie, donut, gauge, radar and choropleth have to be baked into the colour channel (`color-mix` alpha per datum), which loses the transition and cannot dim `url(#…)` pattern paints at all.
>
> Would it be possible to expose `states` on `RadialArcOptions`, `RadialAreaOptions`, `RadialDotOptions`, `PolarOptions` and `GeoShapeOptions`, using the same `ChartMarkState` type the Cartesian marks take? Hover dim from a legend or focus is a standard affordance in Recharts, ECharts and Nivo for pie/radar/map series.

## I2 — Legend hover highlight

**Evidence:** `interactiveColorLegend` is toggle-only; there is no hover callback or hover-to-focus primitive on any legend. Our route keeps the legend in HTML and calls `interaction.setControlledFocus(point, { source: 'programmatic' })` on hover, which works but means the legend is not the package's.

**Draft:**

> **Title:** Legend hover to highlight or dim the matching series
>
> `colorLegend` renders categories and `interactiveColorLegend` toggles visibility on click. Neither exposes hover: there is no way to focus or dim the series under the pointer from the legend, which is the default behaviour in Recharts, ECharts, Chart.js and Nivo.
>
> The workaround today is to render the legend in app HTML and drive `interaction.setControlledFocus` from `onRender`, so the legend leaves the definition and the tooltip/focus pipeline has two owners.
>
> Would it be possible to add a hover option to the legend extensions, e.g. `hover: 'focus' | 'group' | false`, that sets controlled focus for the hovered category (and clears it on leave), reusing the existing `states` / `focus` machinery? This is a natural sibling to #95 (legend item presentation).

## I3 — Motion renderer per-element scan (conditional)

**Evidence (from LOG D472, 6.5 gate):** with `<RendererChart renderer={motion()}>`, data updates cost O(elements × points) because `elementTimingContext` in `dist/motion.js` scans `scene.points` linearly per keyed element before diffing attributes. We gate the motion renderer at `NATIVE_MOTION_MAX_POINTS = 200` for scatter, composed, line, area, bar and candlestick, so those charts have no native entrance motion above 200 datums.

**Before filing:** V3.5 makes `motion()` the only renderer and removes our DOM-side hover writes; V2.5 adds `spatialIndex` and a finite `maxFocusDistance`. Re-measure after both. File only if the bench still shows the scan cost on the pure package path, with a repro built on the `tanstack/*` control scenario (no migrated code) at n = 1000 and n = 5000.

**Draft (skeleton):**

> **Title:** `motion()` renderer update cost grows with elements × points
>
> Version: @tanstack/charts 0.16.0. Repro: <link to a bench scenario: `dot` mark with 5 000 points, `motion()` renderer, update the data every 500 ms; compare with `createSvgChartRenderer`>.
>
> Per update, the motion renderer resolves timing per keyed element by scanning `scene.points`, so a chart with N elements and N points does N² work before attribute diffing. At 5 000 points an update takes <measured> ms with `motion()` versus <measured> ms with the SVG renderer. Indexing points by key once per render (a `Map` keyed the way `resolveMarkStateScene` binds nodes) would make it linear.

## I4 — Pattern resources (`<pattern>`) in `ChartSpec`

**Evidence:** `ChartSpecBase.gradients` declares linear gradients only; there is no resource type for `<pattern>`. Upstream already records this as **F-259** "Chart resources cannot declare patterns" (`API-FRICTION.md:7784`, open) and rules out injecting an application-owned pattern inside the chart svg. bklit consumers use patterns in five places: the funnel `renderPattern(id, color)` prop, sankey `SankeyLinkProps.patterns`/`getLinkPattern`, `PatternArea` with `PatternLines`/`PatternCircles` children (candlestick, gauge, area docs), heatmap cell hatch, and the loading sweep, which is an animated `<pattern>` (`loading-sweep.tsx:147`). Our interim route is the R10 resource host beside the chart svg (`08` R10), which the PNG/SVG export path cannot see.

**Draft:**

> **Title:** Declare `<pattern>` resources on a chart (hatch, dot and animated pattern fills)
>
> `ChartSpec.gradients` lets a definition declare linear gradients that the renderer emits into `<defs>` and marks reference as `url(#id)` paint, and the export path serialises them. There is no equivalent for `<pattern>`: a definition cannot declare a hatch, dot or stripe fill, and F-259 in `API-FRICTION.md` notes that injecting an application-owned pattern into the chart svg is not an intended workaround.
>
> Without it, pattern fills (a common request for accessibility-friendly and print-friendly series encoding in Recharts, ECharts, Highcharts and Vega) have to be rendered by the host outside the chart svg and referenced by id, which breaks `renderChartImage`/`serializeChartSvg` and ties the fill to the DOM host.
>
> Would it be possible to add a `patterns` resource next to `gradients` (id, `width`/`height`, `patternUnits`, and either a small set of presets such as `lines`/`circles` with `stroke`/`fill`/`strokeWidth`/`angle`, or a list of primitive shapes), emitted by the SVG renderer and the export path alike, so marks can use `fill: 'url(#id)'` natively? An optional `svgAnimation`-aware `offset` on the pattern would also cover animated sweeps on loading placeholders.

## I5 — Radial gradients in `ChartSpec.gradients`

**Evidence:** `ChartSpec.gradients` entries are linear (`x1/y1/x2/y2` in `objectBoundingBox` percent, stops with `offset`, `color`, `opacity`; `types.d.ts:363-367, 400-406`). bklit exports a `RadialGradient` component (visx prop names) used by consumers on pie, sunburst, candlestick and gauge for centre-lit fills. Interim route: the R10 resource host (`08`), same export trade-off as I4.

**Draft:**

> **Title:** Support `radialGradient` entries in `ChartSpec.gradients`
>
> `gradients` declares linear gradients that the renderer and export path emit into `<defs>`. Radial gradients (`cx`/`cy`/`r`/`fx`/`fy` in `objectBoundingBox`, same stop shape) are the standard way to give arcs, donuts and gauges a lit centre, and are one-liners in visx (`RadialGradient`), Nivo and Highcharts.
>
> Today a radial fill has to be injected by the host outside the chart svg, so it is missing from `renderChartImage`/`serializeChartSvg` output and tied to the DOM host.
>
> Would it be possible to accept `{ type: 'radial', cx, cy, r, fx?, fy?, stops }` alongside the existing linear entries, emitted by the same resource path?

## I6 — `@tanstack/react-charts` peer range

**Evidence:** `@tanstack/react-charts` 0.15.0/0.16.0 declares `peerDependencies.react: "^19.0.0"`. Its source uses `useRef`, `useMemo`, `useLayoutEffect`, `useState`, `useId`, `useCallback`, `memo` and `forwardRef` only, all available since React 18.0. bklit's legacy package declares `react`/`react-dom` `^18 || ^19`, so the migrated package cannot match that peer range until this changes (`08` V1.9, §8).

**Draft:**

> **Title:** Widen `@tanstack/react-charts` peer dependency to React 18 and 19
>
> `@tanstack/react-charts` declares `react: ^19.0.0` as a peer. Reading the adapter, it uses only hooks available since React 18 (`useRef`, `useMemo`, `useLayoutEffect`, `useState`, `useId`, `useCallback`, `memo`, `forwardRef`) and no React 19-only APIs (`use`, `useActionState`, `useOptimistic`, ref-as-prop). Libraries that wrap the adapter and still support React 18 consumers currently fail peer resolution.
>
> Would it be possible to set the peer to `^18.0.0 || ^19.0.0` (and `react-dom` likewise), with a CI matrix entry for 18, unless there is a React 19 requirement I have missed?

## F-260 — Evidence comment (dashed grid and axis strokes)

Not a new issue. F-260 "Static guides cannot express stroke treatment" is open in `API-FRICTION.md:7800`. Add one comment where upstream tracks it (or a two-paragraph issue referencing F-260 if no tracker exists): bklit's grid default is `strokeDasharray="4,4"` on every cartesian chart, and axis line width is themed per chart; migrating to `gridX`/`gridY` loses the dash because guides expose colour and opacity only. Until it resolves this is listed as a known degradation (`08` §8).

## Bookkeeping

- Filed 2026-09-05 from `toomingos`, all against 0.16.0, no duplicates found (issue list re-checked: newest prior issue #119, 2026-08-27; no GitHub tracker for F-260 existed, so #131 is a short issue referencing it). Numbers: I1 #126, I2 #127, I4 #128, I5 #129, I6 #130, F-260 #131. LOG D511.

- File from the user's GitHub account; record issue numbers here and in the Phase 7 LOG entry.
- After filing, link I1 from the `withStates` wrapper, I2 from the legend hover hook, I4 and I5 from `internal/resource-host.tsx` (the R10 seam comment), I6 from `showcase/migrated/package.json`, and F-260 from the grid style constants, so the interim code names its upstream ask.
- Re-check this table when the pin moves (0.16.0 → next): maintainer turnaround on scoped issues has been days, so an ask may already be shipped.
