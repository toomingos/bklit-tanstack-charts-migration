# choropleth — Phase 4 Research Report

**Files:** `showcase/migrated/charts/choropleth-chart.tsx`, `showcase/migrated/charts/internal/choropleth-graticule.tsx`, `showcase/migrated/charts/internal/choropleth-hover-chrome.ts`
**Legacy source(s):** `repos/bklit-ui/packages/ui/src/charts/choropleth/choropleth-chart.tsx`, `choropleth-context.tsx`, `choropleth-feature.tsx`, `choropleth-tooltip.tsx`, `choropleth-graticule.tsx`, `index.ts`

## Feature summary

GeoJSON choropleth: d3-geo Mercator projection driving TanStack `geoShape` region fills, an optional graticule overlay sharing the same projection, hover dim/highlight with centroid-anchored tooltip, and a ~1100ms WAAPI opacity reveal. Optional `@visx/zoom` pan/zoom (kept consumer-side; TanStack has no geo zoom primitive), with tooltip positions transformed through the zoom matrix.

## Public API

| Prop/Export | Type | Legacy parity | Notes |
|---|---|---|---|
| `ChoroplethChart` (+ `default`) | component | same | wrapper (useContainerWidth + aspect-ratio div) replaces `ParentSize` |
| `ChoroplethChartProps` | type | same | |
| `.data` | `FeatureCollection` | same | |
| `.margin` | `Partial<Margin>` | same | default all-zero |
| `.animationDuration` | `number` | same | default 800 both |
| `.enterTransition` | `unknown` | same | accepted but never read in migrated (see Deviations) |
| `.revealSignature` | `string` | same | accepted but inert; legacy replayed enter on change |
| `.aspectRatio` | `string` | same | default `"16 / 9"` |
| `.scale` | `number` | same | auto `(innerW/630)*100` |
| `.center` | `[number,number]` | same | default `[0, 20]` |
| `.translate` | `[number,number]` | same | auto `[innerW/2+ml, innerH/2+mt+50]` |
| `.zoomEnabled` | `boolean` | same | default false |
| `.zoomMin` | `number` | same | default 0.5 |
| `.zoomMax` | `number` | same | default 4 |
| `.initialZoom` | `TransformMatrix` | same | default identity |
| `.className` | `string` | same | migrated also sets `overflow:hidden`, `position:relative`, `data-bkm-chart="choropleth"` |
| `.children` | `ReactNode` | same | role-marker extraction replaces legacy displayName/type-set heuristic |
| `ChoroplethFeatureComponent` | component | same | config carrier (renders null, `CHART_ROLE="choroplethFeature"`) vs legacy real layer |
| `ChoroplethFeatureProps` | type | same | |
| `.fill` | `string` | same | |
| `.stroke` | `string` | same | default `var(--background)` (applied at usage site) |
| `.strokeWidth` | `number` | same | default 0.5 |
| `.fadedOpacity` | `number` | same | default 0.4 |
| `.getFeatureColor` | fn(feature,i)=string | same | |
| `.patterns` | `ReactNode` | same | declared but never mounted — no `<defs>` output (see Deviations) |
| `.getFeaturePattern` | fn=i/string? | same | resolves to `url(#id)` |
| `ChoroplethTooltip` | component | same | config carrier (`CHART_ROLE="choroplethTooltip"`) |
| `ChoroplethTooltipProps` | type | same | |
| `.content` | fn({feature,index})=Node | same | index arg is always `-1` in migrated |
| `.formatValue` | fn(number)=string | same | default differs: compact M/K vs legacy `intFmt` (see Deviations) |
| `.getFeatureName` | fn(feature,i)=string | same | fallback `"Feature"` vs legacy `` `Feature ${i}` `` |
| `.getFeatureValue` | fn=i/undefined | same | |
| `.valueLabel` | `string` | same | default `"Value"` |
| `.className` | `string` | same | |
| `.panelStyle` | `CSSProperties` | same | merged last over built-ins |
| `.backgroundColor` | `string` | same | default `var(--chart-tooltip-background, #1e1e2e)` |
| `ChoroplethGraticule` | component | same | config carrier; rendered by internal `ChoroplethGraticuleOverlay` |
| `ChoroplethGraticuleProps` | type | same | |
| `.step` | `[number,number]` | same | passthrough; default undefined (lib default) both |
| `.stroke` | `string` | same | default `rgba(255,255,255,0.1)` |
| `.strokeWidth` | `number` | same | default 0.5 |
| `ChoroplethFeatureProperties` | type | same | |
| `ChoroplethFeature` | type | same | |
| `Margin` | type | same | |
| `TransformMatrix` | type (re-export) | same | from `@visx/zoom` |
| `ChoroplethContextValue` | type | same | shape collapsed to `{width,height}` (see Deviations) |
| `useChoropleth` | hook | same | returns `{width,height}` only |
| `useChoroplethZoom` | hook | same | returns `ProvidedZoom\|null`; narrower than legacy `ZoomInstance` (no `isDragging`/`transformMatrix`) |
| `ChoroplethZoomContextValue` | type | extra | legacy kept this interface private |
| `ChoroplethZoomContext` | context | extra | module-private in legacy |
| `ChoroplethProvider` | component | missing | stable/interaction provider architecture removed |
| `ChoroplethTooltipData` | type | missing | |
| `choroplethCssVars` | const | missing | |
| `defaultChoroplethColors` | const | missing | inlined as private `DEFAULT_CHOROPLETH_COLORS` with different tokens |

## Inventory

| Item | Kind | Origin | Impl | TanStack-native candidate? | Notes |
|---|---|---|---|---|---|
| `geoShape` mark via `defineChart`/`Chart` | mark | TANSTACK | TS-NATIVE | yes | fill/stroke accessors; key=`name??id`; `guides:false`, x/y null, margin 0; TS-check: native — geoShape (@tanstack/charts/geo subpath, not root index) + Chart |
| d3-geo `geoMercator` projection | util fn | BKLIT | CUSTOM-ON-TS | maybe | shared by shapes, graticule, centroids; replaces `@visx/geo Mercator`; TS-check: partial — GeoProjectionInput accepts caller d3 projection (+fit/inset); none shipped |
| `@visx/zoom` `Zoom` pan/zoom | hook | BKLIT | CUSTOM | no | wheelDelta 0.95/1.05; TanStack interaction-zoom is 1D time-series only (gap stays consumer-owned); TS-check: none — only `zoomX` 1D x-window control; docs defer geo pan/zoom to app |
| `zoom.containerRef.current` swapped to TanStack svg in `onRender` | side-effect (DOM) | CUSTOM | CUSTOM | no | couples chrome to `svg.ts-chart`; TS-check: none — visx↔TanStack glue, no native counterpart |
| Manual `<g>` transform sync (marks + graticule groups) | side-effect (DOM) | BKLIT | CUSTOM | no | `setAttribute("transform")` + `transition: transform 0.18s ease-out` (`none` while dragging); TS-check: none — no content-group transform/zoom API |
| svg `touchAction:none`, `cursor: grab/grabbing`, `contain: layout style paint` | side-effect (style) | BKLIT | CUSTOM | maybe | expressible as CSS class; TS-check: partial — no style option on svg; app CSS over `.ts-chart` works |
| WAAPI reveal `geoGroup.animate(opacity 0→1)` | side-effect (WAAPI) | BKLIT | CUSTOM | maybe | 1100ms, `cubic-bezier(0.85,0,0.15,1)`, `fill:"backwards"`, onfinish/oncancel self-cancel; TS-check: partial — motion tween (custom easing fn) fades per-path; no group-level WAAPI/post-paint timing |
| Reveal gate: `.ts-chart__marks--revealing` + `data-bkm-revealed="1"` + `seenRevealedRef` | CSS class + state | BKLIT | CUSTOM-ON-TS | maybe | styles.css rule holds group at opacity:0 until post-paint; TS-check: partial — enter motion holds opacity 0 until animated; no class/data-attr hooks |
| `onPostPaint` + `setRevealDeadline(1100)` (deferred-reveal) | util fn | CUSTOM | CUSTOM | maybe | shared internal-animation primitive; timer cancelled on unmount; TS-check: partial — onRender hook fires post-render; no post-paint primitive or deadline API |
| Double-rAF fallback reveal (`useLayoutEffect`) | side-effect (rAF) | CUSTOM | CUSTOM | no | safety net if `onRender` missed; skipped when `getAnimations()>0`; TS-check: none |
| rAF `syncZoomTransform` in Zoom render-prop | side-effect (rAF) | CUSTOM | CUSTOM | no | scheduled every Zoom render; SSR-guarded; TS-check: none |
| `createChoroplethHoverChrome` factory | util fn | BKLIT | CUSTOM | no | imperative dim/highlight parity layer (hover-chrome.ts); TS-check: partial — whenFocused + default focus layer highlight; geoShape lacks `states` dim styling |
| Dim-wrapper `<g>` create/destroy + path reparenting | side-effect (DOM) | BKLIT | CUSTOM | no | NS-created `g[data-bkm-dim-wrapper="1"]`; forced reflow (`getBoundingClientRect`) between opacity steps; TS-check: partial — focus over-layer reorders focused nodes; no dim-others for geo |
| Path/svg/root event listeners | side-effect (listeners) | BKLIT | CUSTOM | maybe | mouseenter/leave per path; svg mousemove/mouseleave/pointerleave; root mouseleave; install-once markers `data-bkm-cp`, `data-bkm-cp-root`; TS-check: partial — pointer focus + onFocusChange cover hover; chrome markers app-side |
| `getAnimations()` gates around dim/reveal mutations | side-effect | CUSTOM | CUSTOM | no | avoids fighting in-flight animations; TS-check: none |
| Centroid + 60px viewport clamp | util fn | BKLIT | CUSTOM-ON-TS | maybe | `geoCentroid`→project→clamp `[pad, w-pad]`, try/catch; TS-check: partial — geoShape emits projected-centroid interaction points; clamp app-side |
| `domFeatureByTsKey` positional map (in `onRender`) | util fn | CUSTOM | CUSTOM-ON-TS | maybe | pairs `features[i]` with DOM order of `[data-ts-key]` paths; assumes unique stable keys; TS-check: partial — onRender context.scene carries keyed points with datum refs |
| Tooltip exit retention (200ms timeout + ref shadow + tick) | hook/state | CUSTOM | CUSTOM | maybe | 0.1s ease-out fade-out; legacy unmounted immediately; TS-check: partial — tooltip.motion hide() exit-fades before unmount; no React retention hook |
| Tooltip panel DOM | component | BKLIT | CUSTOM | maybe | `left:x+16`, `translateY(-50%)`, blur(12px), radius 8, min-width 140, z-50, 10px `var(--chart-1)` dot, tabular-nums; no edge-flip, no spring (legacy TooltipBox had both); TS-check: partial — renderTooltipBody portal + anchor/offset/placement:'auto' flip; custom chrome styling app-side |
| Compact default formatter (`≥1e6→M`, `≥1e3→K`) | util fn | CUSTOM | CUSTOM | yes | legacy default was en-US `intFmt` (deviation); TS-check: CONTRADICTS yes — only formatChartTooltipValue (toLocaleString) exists |
| `CHART_ROLE` carrier components (Feature/Tooltip/Graticule) | component | CUSTOM | CUSTOM-ON-TS | yes | shared `children.tsx` mechanism replaces displayName/type-set matching; TS-check: CONTRADICTS yes — definition-prop API only, no children composition |
| `extractChoroplethChildren` | util fn | CUSTOM | CUSTOM-ON-TS | yes | role match → configs; remainder → overlayChildren; TS-check: CONTRADICTS yes — no children-composition equivalent in any package |
| `resolveFeatureFill` precedence | util fn | BKLIT | CUSTOM-ON-TS | yes | pattern `url(#)` → fill → getFeatureColor → color cycle; TS-check: partial — fill VisualChannel accessor + scene gradients; no `<pattern>` defs support |
| `DEFAULT_CHOROPLETH_COLORS` = `var(--chart-scale-01..05)` | constant | BKLIT | CUSTOM | **RESOLVED (D260)** | ~~token deviation: legacy cycled `var(--chart-scale-01..05)`~~ **FIXED in the working tree — `choropleth-chart.tsx:135-141` now cycles `var(--chart-scale-01..05)`, matching legacy (`chart-scale.ts:3`). This is a SEQUENTIAL token family (`globals.css:134`/`:205`), separate from the categorical `--chart-N`/`--ts-chart-N` set, so T-D15's 6-vs-5 palette premise does NOT apply here. Do NOT route choropleth through `CHART_CATEGORY_PALETTE` — it would reintroduce the deviation.**; TS-check: partial — defaultChartTheme.palette is `--ts-chart-1..6` tokens |
| `DEFAULT_MARGIN` zeros; `DEFAULT_INITIAL_ZOOM` = `identityMatrix()` | constant | BKLIT | CUSTOM | yes | TS-check: none — margin defaults internal to defineChart; identity zoom is @visx/zoom not TanStack |
| Magic numbers: 800ms anim, 1100ms reveal, easing str, baseOpacity 0.85, dim 0.4, pad 60, ÷630, +50y, wheel 0.95/1.05, 0.18s transitions, 200ms exit, +16px | constant | BKLIT | CUSTOM | maybe | spread across chart file + hover-chrome (`DIM_TRANSITION`); token-extraction opportunity; TS-check: none — no theme tokens for these |
| `ChoroplethZoomContext` + `useChoroplethZoom` | context/hook | BKLIT | CUSTOM | maybe | consumer extension surface; narrowed vs legacy `ZoomInstance`; TS-check: none — no zoom context/hook exported |
| Private `ChoroplethContext` `{width,height}` + `useChoropleth` | context/hook | BKLIT | CUSTOM | yes | legacy full stable/interaction context collapsed away; TS-check: none — no chart-scoped size context exported |
| `useContainerWidth` + aspect-ratio wrapper | hook/component | BKLIT | CUSTOM-ON-TS | yes | replaces `ParentSize debounceTime=10`; TS-check: partial — Chart ResizeObserver + aspectRatio:number; width not exposed |
| `parseAspectRatio` | util fn | BKLIT | TS-NATIVE | yes | default `"16 / 9"`; TS-check: CONTRADICTS yes — aspectRatio prop is number-only; no parser |
| `ChoroplethGraticuleOverlay`: `geoGraticule().lines()` → per-line `geoPath` strings | mark | BKLIT | CUSTOM-ON-TS | maybe | replaces `@visx/geo Graticule`; same projection instance as geoShape; TS-check: partial — docs bless geoShape layer over geoGraticule geometry in-chart; separate overlay svg app-side |
| Overlay `<svg>` stacked above Chart (absolute, pointer-events none, aria-hidden) sharing `<g>` via `graticuleGRef` | component | CUSTOM | CUSTOM | maybe | joins zoom transform sync; TS-check: none — one svg surface per Chart, no overlay slot |
| TanStack DOM contract: `svg.ts-chart`, `g.ts-chart__marks`, `.ts-chart__geo`, `[data-ts-key]` | CSS class/selectors | TANSTACK | TS-NATIVE | yes | queried by `handleRender` + hover-chrome; upgrade-coupling risk; TS-check: native — emitted by svg-renderer.ts/geo.ts/reconcile.ts |
| `enterTransition` / `revealSignature` accepted-but-inert | type (API stub) | BKLIT | CUSTOM | no | typed `unknown` / never read; reveal is single-shot per mount; TS-check: none — no equivalent props in TanStack API |

## Imports

Internal modules imported by the part's files:

- `./internal/choropleth-hover-chrome` — `createChoroplethHoverChrome`, `ChoroplethHoverChrome` (chart-specific; imports nothing)
- `./internal/choropleth-graticule` — `ChoroplethGraticuleOverlay` (chart-specific; type-only import back from `../choropleth-chart`)
- `./internal/deferred-reveal` — `onPostPaint`, `setRevealDeadline` (choropleth-chart.tsx)
- `./internal/parse-aspect-ratio` — `parseAspectRatio`
- `./internal` (barrel) — `useContainerWidth`
- `./styles.css` — side-effect import
- `./children` (add-on part, not `internal/`) — `CHART_ROLE`

## Deviations

- Default palette tokens differ: legacy `defaultChoroplethColors` cycled `var(--chart-scale-01..05)` (sequential scale); migrated `DEFAULT_CHOROPLETH_COLORS` cycles `var(--chart-1..5)` (categorical).
- Default `formatValue` differs: migrated compacts to `#.#M`/`#.#K`/rounded int; legacy used `intFmt` (en-US grouped integers). Fallback name `"Feature"` vs `` `Feature ${index}` ``; `content`/`getFeatureName` receive `index = -1` (legacy passed the real feature index).
- Tooltip positioning simplified: fixed `x+16`, Y-centered, no edge flip, no spring (legacy `TooltipBox` flipped at edges and sprang between positions); migrated adds a 200ms exit fade legacy lacked.
- `enterTransition` accepted (typed `unknown`) but never read; reveal is a fixed 1100ms WAAPI tween with hard-coded `cubic-bezier(0.85, 0, 0.15, 1)`.
- `revealSignature` accepted but inert — legacy replayed the enter sequence on signature change via `revealEpoch`; migrated reveals once per mount (`seenRevealedRef` + `data-bkm-revealed`).
- `patterns` prop declared but never mounted (no `<defs>` output anywhere); `getFeaturePattern` URLs resolve only if pattern defs reach the SVG another way.
- Exports dropped: `ChoroplethProvider`, `ChoroplethTooltipData`, `choroplethCssVars`, `defaultChoroplethColors`; context collapsed to `{width,height}` — consumers of `useChoropleth().features/featurePaths/pathGenerator/projectPoint/isLoaded/…` break.
- `useChoroplethZoom` narrowed: returns `ProvidedZoom|null` without legacy `ZoomState` fields (`isDragging`, `transformMatrix`).
- `handleRender` overwrites `zoom.containerRef.current` to point at the TanStack-rendered svg and maps features→paths positionally — relies on TanStack class/`data-ts-key` contract and unique `name??id` keys (duplicate names collide in the key map).
- Suspicious duplication: `applyZoomToGroups` vs `syncZoomTransform` are near-identical; identical try/cancel blocks repeated for `anim.onfinish`/`anim.oncancel`.
- Legacy min-size gate (`width<10 || height<10 → null`) relaxed to `>0`.
