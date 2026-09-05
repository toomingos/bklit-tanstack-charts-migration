# Phase 7 — Synthesis and work plan

Date: 2026-09-04. Author: Fable (lead). Single entry point for Phase 7. `00`–`06` are evidence only; `07` holds the upstream issue drafts (I1–I6); `09` holds the native definition, the eleven nativeness gaps (N-1..N-11) and the 26 parity gaps (P-1..P-26). Pinned dist: `bench/app/node_modules/@tanstack/charts/dist` (0.15.0 until V0.2). Upstream source: `repos/tanstack-charts` at tag `v0.16.0` (258ed39); every citation here was re-verified against it. 

## 1. Goals and rulings

Two claims, in this order:

1. **TanStack native.** Every chart is a `defineChart` definition rendered by the package. Nothing inside the chart `<svg>` is written by migrated code. Native has a written definition upstream: the ownership table in `docs/reference/dom-host.md` (definition owns `focus`, `keyboard`, `tooltip`, `svgAnimation`, `spatialIndex`, `maxFocusDistance`; host owns measurement, keyed reconciliation, enter/exit animation, pointer and keyboard, `idPrefix`, `ariaLabel`). Native means nothing is owned twice.
2. **Seamless swap.** Same component API as legacy bklit: same exports, props, composition contract and failure modes. Parity is a contract of names, tree and slots; nativeness is the ownership table; the two never compete (the shadcn precedent: one API over Radix and Base UI, `09` §4).

| # | Ruling |
|---|---|
| R1 | Pin the latest upstream. Upgrade 0.15.0 → **0.16.0** in V0 (breaking: `scales.x`/`scales.y` required, polar `scales.angle`/`scales.radius`, `ChartMarkX/Y` → `ChartMarkPointX/Y` from `mark/scale-values`, strict mark option literals, pinned tooltips dismiss on outside press). |
| R2 | Funnel migrates to native marks; reopen D364. Reference: catalog case `125-sales-funnel` (`areaX` + `text`, PR #81). |
| R3 | No element inside the chart surface is written by migrated code. CSS may style package output but may not animate, hide or reposition scene nodes; the one permitted CSS animation is the whole-chart opacity pulse on the loading placeholder root (V3.9). Entrance motion belongs to the package `motion()` renderer. Linear gradients and clips are spec fields. Patterns, radial gradients and the loading sweep go through the R10 seam. |
| R4 | Parity may carry a short exceptions list, but no exception may add a dependency: visx, `motion`, `@base-ui/react`, `@number-flow/react`, `react-use-measure` are replaced, never depended on. A direct d3 import is allowed only if the module is in the upstream boundary table (`docs/concepts/scales-and-d3.md:130-145`, "import directly" column) **and** is a legacy direct dependency or already in the package tree. Admitted: `d3-scale`, `d3-geo`, `d3-delaunay` (6.0.4, spatial index), `d3-zoom` (3.0.0, choropleth gesture policy). Excluded: `d3-quadtree`, `d3-sankey`, `d3-shape`. |
| R5 | Composition the TanStack way: parent-owned definition, children are real registering components, loud throw outside a chart, name fallback for detection. |
| R6 | Upstream: issues, not PRs, only for features other libraries share. File now: I1, I2 (low priority), I4, I5, I6, plus an evidence comment on F-260. Conditional: I3. See `07`. |
| R7 | Bundle size is a nice-to-have after goals 1 and 2. CSS and the package contract are part of parity: stylesheet ships with the charts, `package.json` declares deps, peers, `sideEffects` and exports (V1.9). |
| R8 | Phase 7 docs live in `research/phase-7/`. |
| R9 | One git worktree per vector, bulk work by OpenCode subagents, lead reviews and runs gates. |
| R10 | **One seam.** SVG resources the package cannot declare (`<pattern>`, `<radialGradient>`, the animated sweep pattern; upstream F-259) are rendered by exactly one module, `internal/resource-host.tsx`, mounted beside the chart `<svg>`, ids scoped by `idPrefix`, referenced from definitions only as `url(#id)`. Named in code (`// R10 seam: remove when TanStack/charts I4/I5 ship`), deleted when they do. Trade-off: `renderChartImage`/`serializeChartSvg` read the scene, so exports omit those paints (§7). |

## 2. Corrections

Claims from `00`–`06` and from the first draft of this document that did not survive verification.

| Claim | Finding |
|---|---|
| `markStates` and `findContainingScenePoint` are usable (`01` §2, `06` N-3) | Not public. `markStates` is two lines; the wrapper sets `states` directly. Polar hit-testing uses public `interaction.resolvePointer` with the exported `focusGroupAngle` strategy (`polar.d.ts:6`). |
| `renderChartSvgWithResources` is a richer renderer (`00` N5/N6) | Alias of `renderChartSvg` (`svg-resources.d.ts:1`); gradient and clip defs are emitted by the normal path. |
| Working tree does not typecheck (`05` E-2); `chart-config-provider.tsx` uncommitted | `tsc --noEmit` clean and committed on `81896b1`; the provider is a spring-tuning context, not composition. |
| bklit paints radial gradients itself (`03` §2) | bklit only hoists consumer-supplied gradient/pattern children (`chart-defs.ts:29-38`). Zero `<RadialGradient` usages in bklit apps and docs; `<PatternLines>` + `<PatternArea>` and `<LinearGradient>` are used and must keep working. |
| Polar `states` needs an upstream change (`00` N10, D424) | Scene layer resolves `states` for any initialized mark (`scene.js:187-197`, `types.d.ts:672`); only the option types omit it. Typing gap, filed as I1. |
| Definition-level motion field is `animate` | It is **`svgAnimation`** (roadmap AHR-009; `docs/reference/motion.md`); 0.16.0 strict literals would reject `animate`. |
| `types.d.ts:848-921`; `mark-state.js:6-55`; tween applies easing "unclamped" (`motion.js:2711-2718`) | `848-923`; `6-52`; progress is clamped, easing output is not (overshoot keyframes survive). |
| Wipe and sweep via `surface.render(scene, { animation })` replays | Dropped. `motion({ initial: 'always' })` grows bars, lines and areas from the baseline and sweeps arcs; that is how upstream reproduced the Bklit entrance (case `112-motion-entrance`, `benchmarks/motion/README.md` at Bklit c57f66bf). A second animation owner violates `docs/reference/motion.md`. |
| Patterns as clipped stripe polygons in a decorative mark | Dropped. F-259 rejects app-injected patterns inside the chart svg; the polygon hatch had no catalog precedent and a per-frame cost. Replaced by R10 + I4. |

## 3. Vectors

Forty-odd gaps across six passes are symptoms of a few early decisions, each with one native replacement. The table is the whole argument; the work items in §4 carry the detail. V-A..V-H are the vectors confirmed on 2026-09-04; the host row is the prerequisite they all mount on.

| Vector | What we own twice today | Native replacement (evidence) | Items |
|---|---|---|---|
| **V-A Catalog is the bar** | Nativeness judged by rulings | A chart is native when written the way the upstream catalog writes it. Twelve idioms (below) from cases 112, 122, 125 (modelled on Bklit) and 120, 121, 123, 124, 127, 129 (shadcn). | V0.6, V3.8 |
| **Host (prerequisite, V1)** | Runtime context. No module captures `onRender({ container, scene, surface, interaction })` (`RendererChart.d.ts:19`, `dom-types.d.ts:112-117`) or `onFocusGroupChange` (`:192-194`), so every chart rebuilt d3 scales (22 `.range(` sites), children could not register, `ChartProvider`/hooks were absent, optional layers were imported statically. Also sizing (own `ResizeObserver` fed back as `width`, `use-container-size.ts:101`, 13 charts) and server output (`undefined` until a client width exists). | One host module storing that context (`docs/guides/interactions-and-selections.md`, "Controlled point inspection"); `scene.scales` are `ResolvedScale`s (`types.d.ts:603-612`); `initialWidth` + `aspectRatio` for sizing and SSR. | V1.1–V1.8 |
| **V-C Chart-owned focus** | Pointer, hover, hit-testing, legend dim, tooltip placement handled outside the package; `maxFocusDistance: Infinity` with no `spatialIndex` (the real cause of the D472 gate, N-9). | Package owns pointer/keyboard/focus; app sends signals only: `setControlledFocus` (F-243), `keyedSelection`/`whenSelected`, `crosshair` band, `brushX`/`zoomX`, `onSelect`; `states` restored on polar/geo via a `whenFocused`-style wrapper (`focus-mark.js:1-11`); `focusGroupAngle`; tooltip `portal` (F-133); `spatialIndex` over `d3-delaunay`. | V2.1–V2.6, V3.3 |
| **V-B One animation owner** | A custom motion engine and a hand-gated renderer switch on 16 mounts, CSS keyframes, zero `svgAnimation` (N-3, N-4). | `svgAnimation: false` + `motion({ initial: 'always', respectReducedMotion: true })` as the only renderer; hover transitions are `states[].transition` (F-186); `stagger`. D472 gate kept only as a measured perf gate until V2.5. | V3.5, V2.4, V3.6 |
| **V-D Declared resources** | 12 hidden `<svg><defs>` islands, hand ids, funnel raw SVG, hand layouts (geo, sankey, duplicate sunburst), heatmap arithmetic scales. | `createMark` scene nodes (`types.d.ts:848-923`), `gradients`/`clip` spec fields (`types.d.ts:363-367, 400-406`), package layouts `geoShape` (`geo.d.ts:43`), `sankeyDiagram` (`network-sankey.d.ts:113`), `sunburst` (`hierarchy-sunburst.d.ts:57`); patterns, radial gradients and sweep via R10. | V3.1, V3.2, V3.4 |
| **V-E Skeleton is a chart** | Loading placeholders as hand SVG with CSS sweep. | Definitions from ported `generateChartSkeletonData`/`getSkeletonHeights`, sparkline silence (idiom 7), pulse on the root class, sweep via R10. | V3.9 |
| **V-F Package contract** | `showcase/migrated/package.json` has no deps, no peers, one export; `showcase/package.json` carries everything. | Explicit deps, peer React `^19` (react-charts peer is `^19.0.0` though it uses only React 18 hooks; I6), `sideEffects: ["**/*.css"]`, export map, stylesheet import per family. The dist ships no CSS by design; `styles.css` (52 `ts-chart__*` selectors) is the intended surface, its keyframes and pre-hide rules are not. | V1.9, V3.6 |
| **V-G Mechanical parity** | Missing, renamed or leaked exports that survived six passes because fixtures compared nothing (`09` §3). | Generated type fixture from the legacy barrel; 17 legacy test files ported as proof; headless `renderChartSvg` (`svg.d.ts:2`) and `motion-dom` `spring` make rest and transient parity Node tests. | V1.6, V3.7, V4.1–V4.6 |
| **V-H Upstream track** | Wrappers with no named ask. | Issues in `07`; interim code links its issue. | V0.5 |

**Twelve catalog idioms (V-A checklist).** (1) `svgAnimation: false` + `motion()`; (2) hover/focus styling via `states` with `when: { focus }` and `transition`; (3) non-data chrome via `decorative()`; (4) centre metric via `radialText`; (5) second decorative polar layer for an active ring, `crosshair` band for bars; (6) funnel as `areaX` + `text`; (7) sparkline silence: `focus: false`, `pointer: false`, no axes, no tooltip; (8) HTML legend buttons with `aria-pressed` driven by React state and controlled focus; (9) preview branch via `initialWidth` + `aspectRatio` with `initial` suppressed; (10) `idPrefix` per instance; (11) `tooltip.content(points)` for multi-series bodies; (12) theme via `--ts-chart-tooltip-*` and `theme.palette`.

**Order.** V0 → V1 → V2 → V3, V4 alongside from V1, V5 last. V1 changes the files V2 and V3 must edit; V2 removes the hover code V3's motion work would otherwise keep compatible; V3 deletes the helpers that dominate the bundle overshoot (`internal/{motion-renderer,enter-transition,deferred-reveal,hover-geometry,native-tooltip}` ≈ 923 lines), so V5 is measurement. Nothing waits on upstream.

## 4. Work items

Effort: S ≤ ½ day, M ≤ 2 days, L ≤ 1 week, one subagent with lead review.

### V0 Foundation (serial)

| # | Item | Effort | Done when |
|---|---|---|---|
| V0.1 | Commit the 12-file diff on `chore/oxlint-migrated-charts`; merge to main | S | clean tree |
| V0.2 | Upgrade pin to 0.16.0 in `bench/app`, `showcase`, packages; fix the R1 breaking surface across all 15 definitions | M | tsc + lint clean, QA sweep in range |
| V0.3 | Re-baseline: gate run from a worktree at the new HEAD, tree hash recorded; re-measure `bundle-sizes.json` (stale, Sep 2) | S | `qa/gate/latest` matches HEAD |
| V0.4 | Housekeeping: `git rm internal/__tm`, delete 9 orphan modules, `__*` in `.gitignore`; collapse `defineChart(defineChart(spec), opts)` at `bar-chart.tsx:1825,1914` (N-10); start `research/phase-7/LOG.md` (D364 reversal first) with per-family migration notes | S | orphan script = 0 |
| V0.5 | File I1, I2, I4, I5, I6 and the F-260 comment from `07`; link each from the interim code that works around it | S | issue numbers recorded in `07` and LOG |
| V0.6 | Copy the twelve idioms into LOG as the per-family nativeness checklist | S | checklist present before wave 1 |

### V1 One chart host

| # | Item | Effort | Done when |
|---|---|---|---|
| V1.1 | Host module: mounts `RendererChart`, captures `onRender` and `onFocusGroupChange` into a `useSyncExternalStore` store; exports `useChart`, `useChartHover`, `useChartStable`, `useYScale`, `useChartInteraction` (legacy result contract, P-8) with legacy names and the stable/hover split; exposes `definition`, `onRender`, `renderTooltipBody` as the documented raw-TanStack escape hatch | M | legacy hook fixture typechecks and renders |
| V1.2 | Real d3 scale objects on the context from `ResolvedScale`; replace the 22 local `.range(` sites, keep factory sites. Store carries `scene.chart`/`scene.margin`; overlays (`brush-chrome.tsx:14`, `dash-tail.ts:25`, `terminal-marker.tsx:48`, `heatmap-cells-hooks.tsx:119`) read bounds from it; hand margins (`sankey-chart.tsx:72`, `live-line-chart.tsx:69`, `choropleth-chart.tsx:165`, `radar-chart.tsx:44`) become automatic where parity allows (N-8) | M | `.range(` outside factories = 0; margin constants in overlays = 0 |
| V1.3 | Registering children: carriers call `useChartChild(role, props)`; parent builds spec from `scan ∪ registry` in a layout-effect pass; `roleOf` falls back to `displayName ?? name`; carrier with no chart throws the legacy message | M | HOC fixture has an area mark; standalone `<Grid>` throws |
| V1.4 | Optional layers own their imports: brush, reference area, pattern, markers, projection, profit-loss register through the host; brush re-emits `data-aligned` on aligned ticks (P-25) | L | `area-chart.tsx`/`line-chart.tsx` import no brush/pattern/marker modules |
| V1.5 | `host` → `cursorHost` + `createChartCursor`; `xDomainSlotCount` → x-domain padding | S | both observable in QA |
| V1.6 | Export parity: alias renames (`ChartBrushLayout`, `ChartBrushSelection`, `ChartBrushSelectionPattern`, `*Props`), `ChartMargin`, `computeYDomainsByAxis`/`niceYDomain`/`mergeYDomainRecords`, sunburst reveal helpers, `ChartLegend`/`ProfitLossLegend`, `BarYAxis`, named `BrushSelection`; the `09` §3 set: `type LegendItem` is the item shape and the component is `LegendItemComponent` (P-4), `OHLCDataPoint`, `DEFAULT_CHART_ENTER_TRANSITION`, root `chartCssVars`, `chartCenter*ClassName`, `levelColorsFromStyles`, `ProjectionStrokeStyle`, `isLoadingChromePhase`, `ChoroplethTooltipData`/`SankeyTooltipData`/`TooltipData`, `ChartBrushTrackOverlay`/`ChartBrushSelectionOverlay` (+ Props, `…OverlayStyle`, `ChartBrushPatternPreset`), `BarDepthEntry`/`BarDepthSegment`/`useBarDepthEntries`, `Bar*Props`, `BarAnimationType`/`BarLineCap`, `SunburstCenterProps`, `centroidAngle`/`localProgress`, `Margin` (P-3..P-7, P-10, P-12..P-20, P-26); 27 child `*Props` aliases to `*Config`, 11 brush aliases, `ChartEnterTransition` + motion helpers, 10 legacy utilities; 36 leaked internal modules un-exported | M | generated fixture (V4.2) has no red line |
| V1.7 | Host-owned sizing and SSR: remove `use-container-size` from chart mounting (13 files); pass `initialWidth` and `aspectRatio`/`height`, never a measured `width`; definitions never return `undefined` on width (`area-chart.tsx:1146`, `bar-chart.tsx:2526`, `choropleth-chart.tsx:616`, `gauge.tsx:1336`); chrome reads size from the store (N-1, N-2) | M | `initialWidth` on 15 mounts; SSR fixture emits a non-empty `<svg>` per family |
| V1.8 | `ariaLabel`/`ariaDescription` forwarded with per-family defaults (13 charts hardcode, `area-chart.tsx:1791`); `role="img"` checked by probe (N-6, P-22) | S | fixture green, probe passes |
| V1.9 | Package contract: `showcase/migrated/package.json` declares `dependencies` (`@tanstack/charts`, `@tanstack/react-charts`, `d3-scale`, `d3-geo`, `d3-delaunay`, `d3-zoom`, `topojson-client`), `peerDependencies` `react`/`react-dom` `^19` (`^18 \|\| ^19` when I6 ships), `sideEffects: ["**/*.css"]`, `exports` per family; every family entry imports the stylesheet; `showcase/package.json` drops the charts' deps | S | `pnpm pack` installs and renders in a fresh Next app |

### V2 Own the pointer, not the paint

| # | Item | Effort | Done when |
|---|---|---|---|
| V2.1 | `withStates(mark, data, definitions)` wrapper (sets `states` on `initialize`); apply to `polar(...)` containers (pie, ring, gauge, radar), `sunburst()`, `geoShape`; every alpha-baked dim becomes `states: [{ when: { focus: 'other' \| 'unmatched' }, style, transition }]`; restore the D424 drops (radar stroke pop, dot ring dim, sankey node stagger, choropleth pattern dim, hovered feature paint order) | M | resolver test returns a changed node for a focused arc; QA cells in range |
| V2.2 | `pointer: false` + `resolvePointer` + `setControlledFocus` for pie/ring/sunburst with `focus: focusGroupAngle`; delete `polar-hit.ts`, `pie-hover-chrome.ts`, `sunburst-hit.tsx`, the painted hit overlay; sunburst click via `onSelect`, sunburst labels as `text` marks. Same on every family that hand-attaches pointer or disables focus (N-7): radar and gauge drop `focusDisabled` (`radar-chart.tsx:368`, `gauge.tsx:1028,1518`); listeners at `radar-chart.tsx:681-706`, `sankey-chart.tsx:645`, `composed-chart.tsx:1102`, `heatmap-focus-bridge.ts:143`, `choropleth-hover-chrome.ts:21-35` deleted; `styles.css:193` focus-outline suppression removed | L | hover probe on pie passes; keyboard probe on all 15; `addEventListener` in chart files = 0 |
| V2.3 | Legend hover → `setControlledFocus(point, { source: 'programmatic' })`; legend click → `keyedSelection` + `whenSelected` where legacy toggles; HTML buttons with `aria-pressed` (idiom 8) | S | legend-dim probe passes |
| V2.4 | Tooltip indicator springs as decorative marks with package spring timing; zero `setAttribute` except aria | M | `setAttribute` ≤ 4 |
| V2.5 | `spatialIndex` (a `ChartSpatialIndexFactory` over `d3-delaunay`; `docs/reference/custom-extensions.md` §spatial indexes) and finite `maxFocusDistance` on line/area/bar/composed/scatter (`Infinity` at `area-chart.tsx:1458`, `line-chart.tsx:778`, `bar-chart.tsx:1825`, `composed-chart.tsx:982`); bench at n=1000/5000; remove the D472 gate unless the pure package path is still O(elements × points), then file I3 and keep a documented threshold | S | bench cells + decision logged; `POSITIVE_INFINITY` in focus options = 0 |
| V2.6 | `crosshair({ x: { label: true } })` (band form for bar/heatmap) + `focusGuideY` replace the HTML date pill and `hover-geometry.ts`; package tooltip (`anchor`, `placement`, `portal` from `@tanstack/charts/tooltip/portal`, `className`, `content(points)`) replaces `native-tooltip.tsx`. Verify first that `brushX` handles are stylable to the legacy look and heatmap axes need no portal; a failure goes to §7 | M | files deleted, tooltip QA in range |

### V3 Nothing inside the surface is ours

| # | Item | Effort | Done when |
|---|---|---|---|
| V3.1 | Funnel on marks: one `createMark` per orientation emitting `SceneArea{ path, points }` per stage (corner points for morph), hover scale-up as geometry re-emit, colours via `states`, enter via the mark's `ChartMotionDefinition`; delete `funnel-hover-chrome`, funnel WAAPI keyframes, funnel branch of `enter-transition`; log the D364 reversal | L | `funnel-chart.tsx` has a `defineChart`; probes at 0 % |
| V3.2 | Package layouts: `geoShape(source, { projection })` with the `d3-zoom` gesture policy in the projection factory; `sankeyDiagram` with `link`/`rect`/`text` marks and rolling path motion; package `sunburst()` only, delete `sunburst-geometry.ts` | L | `d3-sankey` imports = 0; `createElementNS` = 0 |
| V3.3 | Heatmap on band scale factories and package axes (`ticks.values`, `ticks.format`, label thinning); delete arithmetic closures and the two portal axes | M | heatmap modules 30+ → ~12 |
| V3.4 | Declared resources: linear gradients via `spec.gradients` (`<LinearGradient>` child registers an entry; live-line edge fade as gradient stroke with `opacity` stops; sankey flow as `gradients: links.map(...)`); clips via `clip`; delete the 12 hidden `<svg><defs>` islands. Patterns (`renderPattern`, `PatternLines`/`PatternCircles`, `PatternArea`, sankey `patterns`/`getLinkPattern`), `RadialGradient` (pie, sunburst, candlestick, gauge) and the sweep pattern (`loading-sweep.tsx:147`) move to `internal/resource-host.tsx` (R10). Every mount passes `idPrefix` (N-5; hand ids at `area-chart.tsx:976,1181,1205`, `funnel-chart.tsx:299-304`) | L | `<svg\|<defs\|<pattern\|<radialGradient` in chart files = 0 outside the seam; two instances of one family have distinct ids |
| V3.5 | One animation owner: `svgAnimation: false` on every spec; every mount renders through `motion({ initial: 'always', respectReducedMotion: true })` with stable mark ids and keys (enter, exit, attribute change, y-domain tween, resize), `stagger` for bars and dots; host enforces reduced motion, so `use-prefers-reduced-motion.ts` and `styles.css:908` stay only for non-scene chrome (N-4). `enterTransition` accepts the full framer `Transition`, mapped onto renderer `duration`/`easing`/`spring` (cubic-bezier arrays via `bezier-easing`, keyframe arrays via the easing-function mapping, spring 1:1). Delete `deferred-reveal.ts`, `enter-transition.ts`, the `chartRendererFor`/`useChartRenderer` regime switch in `motion-renderer.ts` (keep one `motion()` factory), `ts-chart__marks--revealing` rules and the wipe/sweep `@keyframes`; `NATIVE_MOTION_MAX_POINTS` stays only until V2.5 | L | K4 readback shows renderer tracks only; `renderer={` = 15 mounts, all `motion(`; `svgAnimation: false` in specs = 15 |
| V3.6 | Stylesheet audit: keep presentation rules; remove pre-hide (`opacity: 0`), animation (except the V3.9 pulse) and repositioning of package output; split per family. `data-slot="<part>"` on host, tooltip body, legend items, centre stat, brush chrome (scene nodes keep `ts-chart__*`); root `chartCssVars` restored, family maps derived from it, `theme.palette` reads the same variables (P-6) | M | `styles.css` has one `animation`, no pre-hide; every exported HTML part has `data-slot` |
| V3.7 | Config parity: `LineConfig`/`AreaConfig` loading fields, `BarConfig` animation/stack/perspective, `BarChartProps.status`, `CandlestickChartProps.xDomain`/`xDomainSlotCount`, `ChartBrushProps.brushDirection`/`selection`/`useWindowMoveEvents`; the 15 loading exports (`ChartLoadingLabel` with `className` and `role="status"`, P-21; `LineChartLoading`, `LineLoadingPulseStroke`, `LineLoadingSweep`, `BarLoadingSkeleton`, `getSkeletonHeights`, `generateChartSkeletonData` + options, P-9; `type LoadingStyle`, P-11) and marker components (`MarkerGroup`, `SeriesMarkers`, `SeriesPointMarker`) as registering children; the 13 gradient components with visx prop names (`LinearGradient` and presets emit a `gradients` entry, `RadialGradient` registers into the seam, `StaticChartPreviewProvider` maps to idiom 9); 27 provider/hook exports with legacy names; `children` required again on the 7 families where legacy requires it; scatter `onPhaseChange`; `SankeyLinkProps.getNodeColor/getLinkColor/patterns/getLinkPattern`, `SankeyTooltipProps.nodeContent/linkContent` (P-1, P-2); heatmap scale legend on `colorGradientLegend` (N-11) | M | generated fixture green |
| V3.8 | Census: reach-in ledger to zero; `createMark` count gated (18 files today); idiom checklist ticked per family in LOG | S | guard baseline updated; 15/15 families have an idiom row |
| V3.9 | Skeleton as a chart: loading placeholders are definitions (`svgAnimation: false`, `focus: false`, `pointer: false`, no axes) built from `generateChartSkeletonData`/`getSkeletonHeights`; pulse as a whole-chart opacity `@keyframes` on the root loading class; sweep as R10 `url(#id)` paint; the loading exports wrap these definitions | M | loading fixture renders headlessly; `<rect\|<path` in loading modules = 0 |

### V4 Evidence

| # | Item | Effort | Done when |
|---|---|---|---|
| V4.1 | `qa/unit` on `node --test`: headless `renderChartSvg` snapshots and scene invariants (mark count, point count, domains, gradient ids); home for the V1.3 HOC/throw fixtures, V2.1 resolver test, V1.7 SSR fixture, and DOM probes for tab stops and roles (legacy has zero `tabIndex`; migrated adds stops at `sunburst-center-overlay.tsx:68`, `chart-marker-circle.tsx:138`, P-22, P-23) | M | `pnpm test` ~1 s, runs in gate |
| V4.2 | Generated type-equality fixture `qa/api-compat/all.ts` read from the legacy barrel (`repos/bklit-ui/packages/ui/src/charts/index.ts`), one `Eq<>` per value and type export; also generated from `qa/gate/roster.txt` so bench and API sets cannot drift. Today's 15 fixtures import only our barrel and compare nothing | S | zero red lines = parity; a missing value export fails typecheck |
| V4.3 | Transient parity in Node: bklit curves from `motion-dom` `spring`/bezier generators vs package tween/spring at 64 points (`qa/curve-parity.mjs`); browser probe demoted to smoke | M | candle tween + reveal tracks within tolerance |
| V4.4 | Gate integrity: tracked `qa/gate/latest/{SUMMARY.md,cells.json,tree-hash}`, `tsc` + `oxlint --deny-warnings` first, artefacts refuse a hash mismatch, the 11 hand rulings become fixture cells | M | fresh clone re-derives the verdict |
| V4.5 | Explained bench: DOM node count and active animation count per scenario | S | two speed-ups explained by data |
| V4.6 | Port the 17 legacy test files onto the migrated barrel, imports only; rewrites against removed internals logged | M | 17 files green in `pnpm test` |

### V5 Bundle and shape (after goals 1–2 are green)

| # | Item | Effort | Done when |
|---|---|---|---|
| V5.1 | Second gate column vs `bklit/<cell>` at ≤ 1.10, no allowances; `bench/measure-css.mjs` CSS column | S | README G4 reads from the gate |
| V5.2 | Measure after V1.4/V3: predicted arealoading 114.5 → ~87 kB gzip vs bklit 88.7; sunburst −2.6 kB | S | 43/43 cells ≤ 1.10 |
| V5.3 | `internal/` shape: merge the 32 `*-child.ts` carriers into one table, family directories with barrels; ≈ 260 modules, chart files ≤ 600 lines, LOC ≤ ×1.2 legacy | M | census baseline reset |
| V5.4 | Lint to zero; D472 threshold work if kept | M | oxlint 0 |

## 5. Parallelisation (R9)

Worktrees `wt/v1-host`, `wt/v2-pointer`, `wt/v3-surface`, `wt/v4-evidence`; one subagent run per item; lead merges in dependency order. File ownership per wave is disjoint by family; the host module (V1.1) is the only shared file and lands first.

| Wave | Runs in parallel | Blocked on |
|---|---|---|
| 0 | V0.1–V0.6 (serial, lead) | — |
| 1 | V1.1+V1.2 · V1.6 · V1.8 · V1.9 · V4.2 · V4.4 · V4.1 scaffold | V0 |
| 2 | V1.3 · V1.4 · V1.5 · V1.7 · V2.1 · V3.3 · V4.3 | V1.1 |
| 3 | V2.2+V2.3 (per family) · V2.4 · V2.5 · V2.6 · V3.2 · V3.4 · V3.7 · V4.6 | V1.3, V1.4, V1.7, V2.1 |
| 4 | V3.1 · V3.5 · V3.6 · V3.8 · V3.9 | V2.5, V3.4 |
| 5 | V5.1–V5.4 | goals 1–2 green |

## 6. Definition of done

**Claim 1, native**
- Every top-level chart has a `defineChart` definition, funnel included; every family renders a non-empty `<svg>` headlessly and passes the keyboard probe.
- `<svg|<rect|<path|<circle|<g |<pattern|<radialGradient` in `showcase/migrated/charts` = 0 outside `internal/resource-host.tsx`; `createPortal` only for tooltips; `setAttribute` ≤ 4; `createElementNS` = 0.
- Direct d3 imports limited to the R4 set; no sankey/shape/layout imports.
- `styles.css`: one `animation` (loading pulse), no pre-hide, no transform rules on package nodes.
- Nothing owned twice: `renderer={` = 15 (all `motion(`), `initialWidth` = 15, `svgAnimation: false` = 15, `spatialIndex` ≥ 5, `focusDisabled` = 0, `use-container-size` in chart files = 0, `idPrefix` = 15; reach-in ledger = 0; `createMark` count gated.

**Claim 2, seamless swap**
- Generated fixture green for every legacy value and type export; exceptions ≤ 3 lines (framer keyframe arrays exact but two-transition for pulses; R10 resources absent from export; none adding a dependency).
- HOC-wrapped and memoised children render; children outside a chart throw the legacy message.
- `LinearGradient` renders natively; `PatternLines`/`PatternCircles`/`RadialGradient` render through the seam with `idPrefix`-scoped ids.
- Stylesheet imported by every family entry; package installs standalone (V1.9); 17 ported legacy tests pass.
- Every exported HTML part carries `data-slot`; root `chartCssVars` exported; a11y probe shows no new tab stops and `role="img"` on the surface.

## 7. Open items and known degradations

Open:
- D472 gate: decided by the V2.5 bench; I3 only if the pure package path is still O(elements × points).
- `brushX` handle styling and heatmap axis portals: verified in V2.6 before the wrappers go.
- Sweep silhouette: R10 sweep is paint, so it follows the placeholder marks rather than a free clip path; accept or shape with `clip` on the placeholder group at V3.9.

Known degradations, each visible to a consumer and each with a removal condition:

| Degradation | Cause | Removed when |
|---|---|---|
| Exports omit patterns, radial gradients and the sweep | R10 resources live beside the chart svg; export reads the scene | I4/I5 ship |
| Grid and axis lines cannot be dashed (legacy default `strokeDasharray="4,4"`) | Upstream F-260 | F-260 resolves |
| Package installs only on React 19 | react-charts peer `^19.0.0` | I6 ships, then V1.9 widens the peer |
| Sweep silhouette follows the marks | R10 sweep is paint | Decided at V3.9 |

## 8. Sources

- Pinned docs (`bench/app/node_modules/@tanstack/charts/docs`): `reference/{motion, rendering-and-export, focus-and-interaction, runtime-and-scene, chart-spec, view-composition, custom-extensions, dom-host}.md`; `guides/{accessibility, ssr-and-hydration, large-data, legends-and-color, tooltips-and-focus, interactions-and-selections, themes-and-styling}.md`; `concepts/scales-and-d3.md`.
- Upstream `v0.16.0`: `API-FRICTION.md` open F-259 (patterns), F-260 (guide stroke), F-261 (per-corner radius, not applicable: bklit uses uniform `rx`); resolved F-133, F-180, F-186, F-225, F-241, F-243; `API-HARMONIZATION-ROADMAP.md` AHR-009; `benchmarks/motion/README.md`; `docs/comparison.md` (Bklit row).
- Catalog cases (`benchmarks/conformance/cases`): cited 112, 120, 121, 122, 123, 124, 125, 127, 129; also read 117, 119, 126, 128.
- Legacy: `repos/bklit-ui/packages/ui/src/charts` (barrel, 17 test files, `package.json`).

## 9. Amendments

- 2026-09-04: the plan is `PLAN-phase-7.md`; progress and decisions live in `docs/phase-7/{PROGRESS,LOG}.md` (LOG continues from D502), so V0.4's "start `research/phase-7/LOG.md`" and V0.6 write to `docs/phase-7/LOG.md`. R8 now reads: research in `research/phase-7/`, tracking in `docs/phase-7/`. Executor-facing detail is in `go-to-plan.md`; the claim-2 spec is `10-parity-contract.md`.
- 2026-09-04: V4.6 count corrected to 23 legacy test files (17 top-level + 6 heatmap), D508.
- 2026-09-05: R9 amended (D509). No worktrees: one tree on `main`, parallelism by disjoint file ownership (`go-to-plan.md` §3), executors edit and report, the lead commits per item. Executor agents are `executor` (edit) and `audit` (read-only); `work` is not used. The idiom checklist (V0.6/V3.8) lives in `docs/phase-7/PROGRESS.md`, not LOG.
