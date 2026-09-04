# 09 — What "perfectly TanStack-native" means, the gaps 08 missed, and the shadcn lesson

Addendum to `08-synthesis.md`. Three questions answered in this pass:
1. What is the precise definition of "TanStack-native" that we are aiming for?
2. Which gaps did the 00–06 passes and the synthesis miss?
3. What do shadcn's Radix and Base UI variants teach us about running one component API on a different engine?

Pinned dist referenced: `bench/app/node_modules/@tanstack/charts/dist` (0.15.0 until V0.2). Upstream docs referenced: `repos/tanstack-charts/docs/**`.

## 1. Definition of "perfectly TanStack-native"

Upstream states the ownership model in its own words. Native means every responsibility sits with the owner upstream assigns it, and nothing is owned twice.

| Responsibility | Owner per upstream | Source |
| --- | --- | --- |
| Data preparation, transforms, D3 scale/shape/layout algorithms | Application code, importing `d3-*` directly | `docs/concepts/scales-and-d3.md` ("Direct dependency ownership", capability map) |
| Marks, scales, guides, theme, gradients, clip, focus strategy, keyboard, tooltip, `animate`, `spatialIndex`, `maxFocusDistance` | The definition (`defineChart(spec, options)`) | `docs/reference/dom-host.md` "The definition owns these chart behaviors" |
| Measurement, ResizeObserver, relayout scheduling, keyed SVG reconciliation, enter/exit/attribute animation, pointer + keyboard interaction, native tooltip, font relayout, cleanup, `idPrefix` scoping, `ariaLabel`/`ariaDescription` | The host (`mountChart` / adapter) | `docs/reference/dom-host.md` first paragraph and option table |
| React lifecycle, SSR markup at `initialWidth`, hydration adoption, `className`/`style` on `.ts-chart-host`, `renderTooltipBody` | The adapter, and nothing else ("The adapter does not redefine …") | `docs/framework/react/adapter.md` "Core boundary" |
| Colours, typography, surrounding surface, tooltip class styling | Application CSS through `--ts-chart-*`, `ts-chart__*`, `tooltip.className` | `docs/guides/themes-and-styling.md` |
| Free cursors, brushes, zoom, linked views, rich pinned tooltips | Controlled application state fed back as semantic input, read from `onRender` | `docs/guides/interactions-and-selections.md` "Choose the owner", "Controlled interaction loop" |
| Evidence | Scene first (`createChartScene`), then `renderChartSvg`, then DOM host, then screenshots for paint only | `docs/guides/testing-and-debugging.md` |

Upstream's migration guide also lists what must **not** be preserved: generated DOM structure, private renderer hooks, broad package imports, pixel constants for clipped labels, unstable keys, and "manual tooltips that duplicate the default focus model" (`docs/guides/migrating.md` "Know what not to migrate"). Legacy bklit's children-as-painters is generated DOM structure. Parity therefore lives at the component contract, never at the DOM.

### The ten invariants (definition of done for "native")

1. Every chart is one `defineChart(spec, options)`; behaviour options live in the definition, never in wrapper code. (`dom-host.md` definition table)
2. Every chart mounts through the React adapter's default entry (`Chart` from `@tanstack/react-charts` or `/tooltip`), with no `renderer` prop, once V3.5 lands. `/core` is for a renderer that is not SVG.
3. The host measures. No `width` prop derived from our own observer; `initialWidth` and `aspectRatio`/`height` instead. (`dom-host.md` "Supplying it disables resize observation")
4. The server renders real SVG. Definitions never return `undefined` waiting for a client measurement. (`ssr-and-hydration.md` "Give the server a real size")
5. Motion is `animate` on the definition for keyed enter/exit/attribute changes, `surface.render` only for wipe/sweep, `respectReducedMotion` from the host. (`rendering-and-export.md` `ChartAnimationOptions`)
6. Focus is native for nearest-point, grouped-axis, keyboard and activation on every chart family; `focusDisabled` only where an app-owned gesture replaces it and the gesture provides its own keyboard path. (`focus-and-interaction.md`, `accessibility.md` "Keyboard focus and selection")
7. Overlays read `scene.chart`, `scene.margin` and `scene.scales` from `onRender`; no parallel plot rectangle, no parallel scale. (`responsive-charts.md` "Do not calculate a parallel plot rectangle")
8. Resource ids come from `idPrefix`; gradients, patterns and clips are declared in the spec. (`themes-and-styling.md` "Gradients and clipping")
9. `ariaLabel`/`ariaDescription` are consumer-forwarded on every chart; semantic context and exact values live outside the surface. (`accessibility.md`)
10. Tests hit the scene first. Every chart family has a `createChartScene` test before a screenshot. (`testing-and-debugging.md`)

08's V1–V3 cover invariants 1, 2, 7 (scales only), 8 (partly). Invariants 3, 4, 5, 6 (beyond polar), 7 (bounds), 9 and 10 are the new work below.

## 2. New nativeness gaps (not in 08)

Evidence is in `showcase/migrated/charts/` unless stated.

| id | Gap | Evidence | Native facility | Severity | Slots into |
| --- | --- | --- | --- | --- | --- |
| N-1 | Container measured by our own ResizeObserver, then fed back as explicit `width`, which disables the host's observer | `internal/use-container-size.ts:101`, used by 13 chart files; `pie-chart.tsx:593`, `ring-chart.tsx:775`, `radar-chart.tsx:1056`, `sunburst-chart.tsx:888`, `gauge.tsx:1152`; zero `initialWidth` | host sizing (`dom-host.md` "Responsive sizing"), adapter `initialWidth`/`aspectRatio` | blocks | **V1.7 (new)** |
| N-2 | No server output: definitions return `undefined` until a client width exists | `area-chart.tsx:1146`, `bar-chart.tsx:2526`, `choropleth-chart.tsx:616`, `gauge.tsx:1336`; 23 files use `useLayoutEffect` | SSR at `initialWidth`, hydration adoption (`ssr-and-hydration.md`) | blocks | **V1.7** |
| N-3 | Definition `animate` never used; every chart passes a custom renderer + WAAPI | zero `animate:` in specs; 16 `renderer={…}` sites; `internal/motion-renderer.ts:19` | `animate: {duration, easing, respectReducedMotion, resize}` with stable keys | blocks | **V3.5 (rescope)** |
| N-4 | Reduced motion reimplemented as a media-query hook | `internal/use-prefers-reduced-motion.ts`, 7 consumers, `styles.css:908` | `animate.respectReducedMotion` enforced by the host | weakens | V3.5 (correction: drop the `matchMedia` plan, keep hook only for non-scene chrome) |
| N-5 | `idPrefix` never supplied; hand-built gradient ids collide across instances | zero `idPrefix`; `area-chart.tsx:976,1181,1205,455`, `funnel-chart.tsx:299-304` | `idPrefix` host option, spec `gradients` | weakens | V3.4 (add) |
| N-6 | `ariaLabel` hardcoded on 13 of 14 charts, `ariaDescription` used once | `area-chart.tsx:1791` "Area chart", `pie-chart.tsx:592`, `bar-chart.tsx:2824`, `gauge.tsx:1148`; only `line-chart.tsx:497` forwards | adapter `ariaLabel`/`ariaDescription` props | weakens | **V1.8 (new)** |
| N-7 | Keyboard removed on radar/gauge via `focusDisabled`; pointer hand-attached on radar, sunburst, sankey, composed, heatmap, choropleth | `radar-chart.tsx:368`, `gauge.tsx:1028,1518`; listeners at `radar-chart.tsx:681-706`, `sunburst-chart.tsx:206`, `sankey-chart.tsx:645`, `composed-chart.tsx:1102`, `internal/heatmap-focus-bridge.ts:143`, `internal/choropleth-hover-chrome.ts:21-35`; `styles.css:193` hides focus outline | `focus` strategy + `setControlledFocus` + `onSelect` | blocks | **V2.2 (rescope to all families)** |
| N-8 | `scene.chart`/`scene.margin` never read; overlays recompute the plot rect from hand margins | zero `scene.chart`; `sankey-chart.tsx:72,531`, `live-line-chart.tsx:69,851`, `choropleth-chart.tsx:165,560`, `radar-chart.tsx:44,793`, `internal/brush-chrome.tsx:14`, `internal/dash-tail.ts:25`, `internal/terminal-marker.tsx:48` | automatic margins + `onRender` bounds | weakens | V1.2 (extend from scales to bounds) |
| N-9 | Dense-data focus is a full linear scan with `maxFocusDistance: Infinity`; this is the real cause behind the D472 gate | zero `spatialIndex`; `area-chart.tsx:1458`, `line-chart.tsx:778`, `bar-chart.tsx:1825`, `composed-chart.tsx:982` | `spatialIndex: ChartSpatialIndexFactory` (`d3-quadtree`, already in the D3 capability map) | weakens | V2.5 (resolve open item "D472 fate") |
| N-10 | `defineChart(defineChart(spec), opts)` | `bar-chart.tsx:1825,1914` | single call | cosmetic | V0.4 |
| N-11 | Package legend/export subpaths unused; 26 hand-written legend modules | zero `@tanstack/charts/legend` or `/export` | `colorGradientLegend` for the heatmap scale; `serializeChartSvg`/`renderChartImage` | cosmetic (legends are outside the surface and are bklit API) | V3.7 (heatmap gradient legend), V5 (export exposure) |

Two consequences for 08:
- **Open item "D472 gate fate" is now answerable.** N-9 shows the gate compensates for a missing spatial index, not for renderer cost. Supply `spatialIndex` and a finite `maxFocusDistance` first; bench; then retire the gate.
- **V3.5 changes shape.** Motion is not "surface.render + createChartSpring everywhere"; it is `animate` for the keyed path and `surface.render` only for wipe/sweep. Cheaper and more native.

## 3. New parity gaps (not in 00–06 or 08)

Legacy paths under `repos/bklit-ui/packages/ui/src/charts/`. Verified against the legacy barrel `index.ts`.

| id | Export / prop | Legacy | Migrated | Severity | Slots into |
| --- | --- | --- | --- | --- | --- |
| P-1 | `SankeyLinkProps.getNodeColor/getLinkColor/patterns/getLinkPattern` | `sankey/sankey-link.tsx:51-75` | `internal/sankey-link.ts:2-7` has 4 of 8 | breaks | V3.7 |
| P-2 | `SankeyTooltipProps.nodeContent/linkContent` | `sankey/sankey-tooltip.tsx:24,30` | missing | breaks | V3.7 |
| P-3 | `type OHLCDataPoint` | `index.ts:76` | missing | breaks | V1.6 |
| P-4 | `type LegendItem` vs component | legacy: `type LegendItem` (`index.ts:133`) and `LegendItem as LegendItemComponent` (`index.ts:294`) | migrated `index.ts:71` exports the **component** as `LegendItem`; `import type { LegendItem }` silently resolves to the wrong shape | breaks silently | V1.6 |
| P-5 | `DEFAULT_CHART_ENTER_TRANSITION` | `index.ts:20` | missing | breaks | V1.6 |
| P-6 | `chartCssVars` (root CSS-variable contract) | `index.ts:119`, `chart-context.tsx:32` | only per-family maps in `internal/css-var-maps.ts` | breaks | V1.6 + V3.6 |
| P-7 | `chartCenterContainerClassName/LabelClassName/ValueClassName` | `chart-center-typography.ts:7` | missing | breaks | V1.6 |
| P-8 | `useChartInteraction` and its result contract (tooltipData, selection, touch handlers, interactionStyle) | `index.ts:609`, `use-chart-interaction.ts:36-53` | missing | breaks | V1.1 (host context exposes it) |
| P-9 | `generateChartSkeletonData` + options type | `generate-chart-skeleton-data.ts:14` | heatmap-only variant | breaks | V3.7 |
| P-10 | `levelColorsFromStyles` | `heatmap/heatmap-colors.ts:115` | missing | breaks | V1.6 |
| P-11 | `type LoadingStyle` | `chart-phase.ts:6` | missing | breaks | V3.7 |
| P-12 | `type ProjectionStrokeStyle` | `projection-line.tsx:16` | prop exists, union unexported | breaks | V1.6 |
| P-13 | `isLoadingChromePhase` | `y-domain-utils.ts:34` | missing | breaks | V1.6 |
| P-14 | `ChoroplethTooltipData`, `SankeyTooltipData` | `choropleth/choropleth-context.tsx:54`, `sankey/sankey-chart.tsx:22` | missing | breaks | V1.6 |
| P-15 | `type TooltipData` | `chart-context.tsx:70` | missing | breaks | V1.6 |
| P-16 | `ChartBrushTrackOverlay`, `ChartBrushSelectionOverlay` (+ Props, `…OverlayStyle`, `ChartBrushPatternPreset`) | `chart-brush-track-overlay.tsx:12,42,131`, `chart-brush-selection-overlay.tsx:13,21` | only `BrushChrome` | breaks | V1.6 |
| P-17 | `BarDepthEntry`, `BarDepthSegment`, `useBarDepthEntries`, `BarDepthBackProps`, `BarDepthFrontProps`, `BarPulseProps`, `BarColumnTrackProps`, `BarSquaresProps` | `bar-depth.tsx:111,153`, `bar-squares.tsx` | components exported, types/hook not | breaks | V1.6 |
| P-18 | `BarAnimationType`, `BarLineCap` | `bar.tsx:21-22` | missing | breaks | V1.6 |
| P-19 | `SunburstCenterProps` | `sunburst-center.tsx:7` | missing | breaks | V1.6 |
| P-20 | `centroidAngle`, `localProgress` | sunburst barrel | missing | cosmetic | V1.6 |
| P-21 | `ChartLoadingLabel` drops `className` and `role="status"` | `chart-loading-label.tsx:36-42` | `internal/loading-label.tsx:4-13` | silent change | V3.7 |
| P-22 | `role="img"` on the surface | `sunburst-chart.tsx:461` | zero `role="img"` in migrated | silent change | V4.1 probe |
| P-23 | New tab stops legacy never had | legacy has zero `tabIndex` | `internal/sunburst-center-overlay.tsx:68`, `internal/chart-marker-circle.tsx:138` | silent change | V4.1 probe |
| P-24 | Funnel `role="presentation"` 6 → 3 sites | `funnel-chart.tsx:274…951` | `funnel-chart.tsx:604,776,810` | cosmetic | V3.1 |
| P-25 | `data-aligned` on brush-aligned axis ticks | `x-axis.tsx:494,614` | absent | silent change | V1.4 |
| P-26 | `Margin` is the sankey-local declaration | `chart-context.tsx:63` | `sankey-chart.tsx:50` | cosmetic | V1.6 |

### Fixture coverage hole

`qa/api-compat/` has 15 fixtures, all importing from the migrated barrel only, with no equality check against bklit. No fixture exists for the sunburst family, any composition child (`ChartBrush`, `ReferenceArea`, `Segment*`, `Bar*` layers, `Projection*`, `ChartMarkers`, `ProfitLossLine`, `PatternArea`), the legend/tooltip surface, or the hooks/config/utility exports. This is why P-3 to P-20 survived six audit passes.

**Consequence for V4.2:** the generated type fixture must be produced from the **legacy barrel**, one `Eq<>` per export, not hand-picked per chart (this is V4.2 in `08`; V4.4 is gate integrity). The generator is the multi-vector fix: it closes P-3 to P-20 as a class and prevents recurrence. Value exports that are missing (P-5, P-7, P-8, P-9, P-13, P-16, P-17) fail at typecheck immediately.

## 4. The shadcn lesson

shadcn runs one consumer API over two primitive libraries (Radix, Base UI). Verified from source: `bases/radix/ui/chart.tsx` and `bases/base/ui/chart.tsx` are byte-identical (369 lines, `diff` exit 0), because the Chart component never imports a primitive; only Recharts. A primitive-backed component such as Dialog differs internally (`DialogPrimitive.Overlay/Content` vs `Backdrop/Popup`, `asChild` vs `render`) yet exports the same names, the same tree, and the same `data-slot` values, so consumer JSX is unchanged.

Sources: ui.shadcn.com/docs/components/radix/chart, /docs/components/base/chart, /docs/changelog/2026-01-base-ui, /docs/changelog/2026-07-base-ui-default, github.com/shadcn-ui/ui `apps/v4/registry/bases/{radix,base}/ui/{chart,dialog}.tsx`, base-ui.com/react/handbook/composition, radix-ui.com/primitives/docs/guides/composition.

### Principles, and whether they transfer

| shadcn principle | Transfers? | How it lands in our contract |
| --- | --- | --- |
| Same exported names, same subcomponent tree, per variant | Yes, this is the parity goal itself | Legacy barrel is the contract; V4.2 generator enforces it |
| `data-slot="<part>"` on every DOM node, primitive-agnostic styling/test hook | Yes | Stamp `data-slot` on `.ts-chart-host`, tooltip body, legend items, centre stat, brush chrome. The scene's own nodes keep `ts-chart__*` classes (that is the package's slot system). Add to V3.6 |
| Config drives CSS variables (`ChartConfig` → `--color-<key>`), independent of engine | Yes, and it is our P-6 | `chartCssVars` becomes the root map; family maps derive from it; the definition's `theme.palette` reads the same variables. V3.6 |
| `className` passthrough merged last | Yes | Adapter already puts `className` on `.ts-chart-host`; keep it on every part |
| The primitive is never obscured | Partly | Radix exposes per-node props; a spec engine exposes a definition. Our escape hatch is `definition` + `onRender` + `renderTooltipBody` exposed through the host context (V1.1), documented as the "raw TanStack" path |
| Thin wrappers around the primitive's own parts, not re-implementations | Yes, and it is the nativeness invariant | Legacy children become **translators** that write spec fragments (already the carrier design); never painters. `ChartTooltip = RechartsPrimitive.Tooltip`-style aliases have no analog because tooltip is a spec field, so `ChartTooltip` stays a translator |
| `asChild` ↔ `render` mapping done per usage site, no shared abstraction | No analog | The spec's extension points (`createMark`, formatters, `renderTooltipBody`) play the `render` role; document them per part |
| Per-component migration notes, explicit "untouched" list | Yes | Per-family notes in `research/phase-7/LOG.md`: line/area/bar/scatter map 1:1; sankey, choropleth, candlestick, funnel, heatmap need translators; state which |
| Parallel copies kept in sync by tooling, not a branching abstraction | Partly | We have one engine, so no parallel copies. The equivalent discipline is the generated fixture plus the reach-in ledger |

The one-sentence version: **shadcn keeps parity by fixing the names, the tree and the slots, and lets the engine own everything behind them.** That is the same rule as upstream's "preserve meaning and behaviour, replace implementation accidents".

## 5. Corrections and additions to 08

- V1.2: extend from "scales" to "scales, `chart` bounds and `margin`" (N-8).
- V1.7 (new, M): host-owned sizing and SSR. Remove `use-container-size` from chart mounting; pass `initialWidth`, `aspectRatio`/`height`; definitions never return `undefined` on width; SSR fixture renders real SVG for every family (N-1, N-2).
- V1.8 (new, S): forward `ariaLabel`/`ariaDescription` on every chart with per-family defaults; emit `role="img"` parity probe (N-6, P-22).
- V2.2: scope is every family with hand-attached pointer or `focusDisabled`, not only pie/ring/sunburst (N-7).
- V2.5: add `spatialIndex` + finite `maxFocusDistance` before benching; the D472 gate is retired if the bench passes (N-9).
- V3.4: add `idPrefix` per instance (N-5).
- V3.5: rewrite as `animate` on the definition for keyed motion, `surface.render` for wipe/sweep only, host-enforced reduced motion (N-3, N-4).
- V3.6: add `data-slot` stamping and the root `chartCssVars` map (P-6, shadcn).
- V3.7: add P-1, P-2, P-9, P-11, P-21.
- V4.2: generator reads the legacy barrel; one `Eq<>` per export (P-3 to P-20, fixture hole).
- V4.1: add probes for tab stops and roles (P-22, P-23).
- V0.4: add N-10.
- Open item "D472 gate fate": resolved by N-9 route.
