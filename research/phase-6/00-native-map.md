# 00 — Native map (seed evidence)

Session-verified (2026-08-27) against the installed pin `@tanstack/charts@0.15.0`
(`showcase/node_modules/@tanstack/charts/`). Docs paths below are relative to that package.
0.16.0 tarball diffed: `dist/` file list and the key guides are identical — no capability drift.
Phase 5's own pin-check corroborates row 1 (`research/phase-5/07-pin-check.md` row 4, CONFIRMED).

## Verified native mechanisms

| # | Mechanism | Evidence (file:line) | Replaces |
|---|---|---|---|
| 1 | Mark `states: [{when, style, transition}]`; `when: {focus: 'primary'\|'group'\|…\|'unmatched'}` or predicate; style callbacks get `{datum, point, focus, pointer, matches()}`; per-state `transition` + `respectReducedMotion`; per-mark style subsets incl. `opacity`, `r`, `radius` | `dist/types.d.ts:63-107` (`ChartMarkStateContext`, `ChartMarkStateValue`, `ChartMarkStateStyle`, `ChartMarkStateSelector`, `ChartMarkState`); shipped example `docs/examples/interactive-charts.md:42-48` (`when:{focus:'primary'}, style:{r:7}, transition`) | hover-dim + focused-point styling in `hover-chrome.ts` (querySelector opacity/filter mutation), scatter/bar/candle focus strategies |
| 2 | Native tooltip: `tooltip` ext, `tooltip:{use, items, content, format, formatGroup, anchor, placement, portal, className, motion}`; pinning (click/Enter/Space, Escape); `visibility:'pinned'`; React `renderTooltipBody` — host owns focus/ordering/anchoring/placement/portal/dismissal, app owns body JSX | `docs/guides/tooltips-and-focus.md` (items/format: ~154-255; portal: ~426-455; `renderTooltipBody` via `@tanstack/charts/react/tooltip`: ~500-535) | `tooltip-chrome.ts` (689 LOC), `marker-tooltip.tsx`, `tooltip-components.tsx` |
| 3 | Typed focus callbacks on React `<Chart>`: `onFocusChange`, `onFocusGroupChange`, `onSelect`; `ChartPoint` carries datum, keys, semantic values, pixel x/y, resolved color | `docs/guides/tooltips-and-focus.md` "Typed callbacks" section | broadcast-store hover sync, app-side focus mirroring |
| 4 | Hover geometry: `crosshair({x:{label:true}, band})` data-less guide; `whenFocused(mark, {match:'x'\|'y'})` presentation filter; `focusGroupAngle` (polar); `focusGuideX/Y` (`@tanstack/charts/focus/guide`) keyed, motion-animated | `docs/guides/tooltips-and-focus.md:93-150`; `docs/reference/focus-and-interaction.md:34-56,140-175`; `dist/focus-mark.d.ts:2` | crosshair/date-pill/hover-band/grid-highlight painting in hover-chrome + `grid-highlight-mark.ts` |
| 5 | Axes: `axis.ticks{count,spacing,values,format,size,motion}` + `tickLabels{rotate, thin:{minGap,priority,keep}, motion}` + `axis.label{text,offset}`; measured-bounds collision thinning incl. rotated labels | `docs/concepts/layout-axes-and-coordinates.md:68-195` | `x-axis-overlay.tsx` (302 LOC), `y-axis-overlay.tsx`, `bar-x-axis-overlay.tsx`, `y-axis-ticks.ts`, ~5x duplicate d3 scale instantiations per chart (`line-chart.tsx:275` comment) |
| 6 | Motion: `motion()` renderer — interruptible springs w/ velocity carry-over, `stagger({each, roles, by})`, phase callbacks (`enter/update/exit`, per-datum), radial growth from polar center, arc angle sweeps, reduced-motion default; cascade renderer->chart->mark->axis->guide->**focus-state transition**; custom `createMark` marks accept motion + states | `docs/guides/dynamic-data-and-animation.md`; `docs/reference/motion.md:120-175`; custom marks: `docs/guides/custom-marks-and-renderers.md:143-159` | `spring.ts`, `candle-spring.ts`, `bezier-easing.ts`, `radar-spring.ts`, rAF loops, `native-stagger.ts`, per-frame `d` rewriting in `pie-chart.tsx:455-598` |
| 7 | Live streaming: rolling path contract `motion.path {update:'rolling', x:'shift', y:'reproject', fallback:'snap'}`; interrupt composition; viewport-translate invariants documented | `docs/guides/dynamic-data-and-animation.md` "Streaming" | `live-line-mark.ts` scroll machinery, `decimate.ts` interplay reviewed in-phase |
| 8 | Brush: `controls: [brushX({range: controlledSignal(...), values, format, ariaLabel…})]` — **in-definition**, semantic snapping, keyboard handles, selection preserved across updates | `docs/guides/interactions-and-selections.md:455-575` | `brush-drag.ts`, `brush-chrome.tsx`, `brush-layout.tsx`, `brush-selection.ts`, `chart-brush.tsx`. **Obsoletes the `brush-drag.ts:1-20` NON-VIABLE ruling (v0.14-era)** |
| 9 | Zoom (1-D): `zoomX` control — controlled semantic window, wheel/drag/touch/keyboard, clamping | `docs/guides/interactions-and-selections.md:633-682` | 1-D zoom paths of `zoom-engine.tsx` |
| 10 | App-owned pointer (sanctioned): `pointer:false` keeps chart focus/marks/tooltips; resolve + paint app-owned focus via `host.interaction` or the `onRender` controller | `docs/reference/focus-and-interaction.md:46-56` | legend-hover -> DOM pokes (inject focus instead); choropleth gesture input stays, pan/zoom applied via projection params in the definition, not DOM transforms |

## Known gaps (candidate ACCEPT-WITH-LOG / upstream asks) — corrected during 6.1

| Gap | Evidence | Fallback |
|---|---|---|
| 2-D geo pan/zoom | `zoomX` is 1-D only; no 2-D control in dist/docs | Gesture input stays app-owned (sanctioned per `interactions-and-selections.md` "Import d3-zoom directly only when…"); apply via projection params in the definition, not DOM transforms; upstream ask |
| **Left-to-right wipe reveal** (line/area/composed entrance — corrected: the tree's reveal is a clip-path `inset()` wipe, not dash-sweep; dash draw-on exists only in sankey links) | Native line/path enter grows from semantic baseline (`docs/reference/motion.md:55-58` "Initial choreography follows geometry"); no wipe mode | ACCEPT-WITH-LOG one-shot clip animation confined to the documented `onRender` context; upstream ask (`motion.enter:'wipe'`) |
| `states` not exposed on polar mark options | `states?:` present in `dist/{line,area,bar,dot,rect,text,waffle,violin,ridgeline,rect,difference,area-x,hierarchy-treemap}.d.ts` only — absent from `dist/polar.d.ts` / `dist/hierarchy-sunburst.d.ts` | Custom marks carry `states` in mark initialization (`dist/types.d.ts:672` `InitializedMarkBase.states`); or reactive definition + `onFocusChange` |
| No `filter` (blur) channel in `ChartMarkStateStyle` | `dist/types.d.ts:73-89` — opacity/r/radius/inset/font only | Scatter inactive-marker 2px blur: authored mark `className` + container data-attribute CSS (sanctioned SVG styling surface, `docs/guides/themes-and-styling.md:103-106` caveats Canvas only); upstream ask |
| No per-tick label color in `ChartAxisTickLabelOptions` | `dist/types.d.ts:196-205` — fontSize/fontWeight/opacity/anchor/dx/dy only | No current-tree consumer (legacy `resolveTickLabelColor` was never ported); no action needed |
| Series-dim via legend hover | No legend-hover primitive; `interactive-legend` is toggle-only | `host.interaction.setControlledFocus(point, {source:'programmatic'})` (`dist/dom-types.d.ts:37`); `states` `when:{focus:'unmatched'}` does the dimming |
| Axis typography parity | Native tick labels are SVG (default fontSize 11, container-inherited font per `layout-axes-and-coordinates.md:130-133`), current overlays are HTML 12px | `tickLabels.fontSize: 12` + container font inheritance + CSS fill on axes text; risk stays flagged for the 6.5 pixel gate |

## Additional verified capabilities (6.1 pass)

| Mechanism | Evidence |
|---|---|
| `tickLabels` per-tick callables: `fontSize/fontWeight/opacity/anchor/dx/dy` with `{value,index,position,bandwidth}` context | `dist/types.d.ts:184-205` |
| `axis.viewport {domain, translate}` — committed semantic window per axis (native domain narrowing for brush/zoom/streaming) | `dist/types.d.ts:218-227` |
| Tooltip `sticky:false` disables pinning (bklit has no pinning); `motion: false \| ChartMotionTransition` overrides tooltip spring | `dist/types.d.ts:961-976`; `docs/guides/tooltips-and-focus.md:257` |
| `crosshair` per-axis label paint incl. halo (`ts-chart__crosshair-label-halo`), band mode, marker; stroke accepts any paint incl. `url(#…)` gradient refs | `dist/crosshair.d.ts:1-62`; `dist/crosshair-resolver.js:264-280` |
| `ChartControlledFocusOptions {source:'pointer'\|'programmatic', pinned}`; controller = `clientToScene/resolvePointer/setControlledFocus`, exposed via `onRender` context on React `<Chart>` | `dist/dom-types.d.ts:25-38,167-172`; `dist/react/Chart.d.ts:19` |
| `ScenePolyline.path` / `SceneArea.path` accept raw SVG path data — custom marks can emit arbitrary arc/curve geometry | `dist/types.d.ts:886-901` |
| Native default transition = 1,100 ms tween + default entrance ease = exactly bklit's `DEFAULT_ANIMATION_DURATION_MS`/easing (byte-level parity of defaults) | `docs/reference/motion.md:41-44` vs `internal/animation-defaults.ts` |
| Two-host overview+detail is the library's own pattern for an independent full-extent brush track (conformance case 83, cited by `brush-drag.ts` ruling itself) | `docs/guides/interactions-and-selections.md:455-575`; brushX `values` gives snapping + keyboard |

## Current-tree zero-usage confirmation (2026-08-27)

Greps over `showcase/migrated/**`: `tickX(`/`tickY(`/`crosshair(`/`cursor(`/`whenFocused`/
`focusGuide`/`states:`/`use: tooltip`/`brushX`/`zoomX` — **all zero matches**. `tooltip: false` +
`focusDisabled` set in `pie-chart.tsx:361`. `hover-chrome.ts` has 18 `querySelector` calls;
`tooltip-chrome.ts` has 2. Partial native adoption exists only for `axis.ticks.count`
(grid tick counts, e.g. `area-chart.tsx:656-660`).
