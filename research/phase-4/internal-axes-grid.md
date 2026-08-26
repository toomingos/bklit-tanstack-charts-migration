# internal-axes-grid — Phase 4 Research Report

**Files:** `showcase/migrated/charts/internal/grid.ts`, `x-ticks.ts`, `x-axis-overlay.tsx`, `y-axis-overlay.tsx`, `y-axis-ticks.ts`, `y-domain.ts`, `use-chart-margin.ts`, `background.tsx` (orphan — no importers), `reference-area-config.ts`, `reference-area-geometry.ts`, `reference-area-layer.tsx`
**Legacy source(s):** `repos/bklit-ui/packages/ui/src/charts/x-axis.tsx`, `y-axis.tsx`, `y-axis-ticks.ts`, `grid.tsx`, `use-grid-shimmer.ts`, `y-domain-utils.ts` + `time-series-chart-shell.tsx` (`resolveTimeSeriesYDomain`, `niceYDomain` semantics), `background.tsx`, `reference-area-config.ts`, `reference-area-geometry.ts`, `reference-area.tsx`

## Feature summary

Shared cartesian axes/grid machinery: grid-guides config resolution feeding TanStack's native `grid`/`ticks` axis options plus bklit-parity resolvers for highlight rows and shimmer tokens; bklit's data-aligned x-tick selection (exhaustive gap-layout scoring over rendered data); HTML overlay x/y axis labels (no SVG text, no portals); time-series y-domain rules + d3 nicing with change detection; margin-object identity stabilization; the patterned plot-area `Background` (orphan); and the reference-area pipeline — config extraction from CHART_ROLE-marked children, ifOverflow geometry, and layered SVG bands (patterns, edge-fade masks, bracket markers, phase-gated 420ms fade-in).

## Public API

Shared internal group — no public chart API; table covers the group's exported surface, parity vs the legacy modules listed above.

| Prop/Export | Type | Legacy parity | Notes |
|---|---|---|---|
| `DEFAULT_GRID_STROKE_DASHARRAY` | constant | same | `"4,4"` = legacy grid.tsx inline `strokeDasharray` default |
| `ResolvedGridGuide` | interface | extra | `{horizontal, vertical, ticks}` resolution shape (TanStack guide options) |
| `resolveGridGuide` | fn | renamed | Consolidates the per-chart inline triples `grid?.horizontal ?? false` / `numTicks ?? 5` / `vertical ?? false` into one source |
| `ResolvedGridHighlightRow` | interface | extra | `{value, y}` row descriptor |
| `resolveGridHighlightRows` | fn | renamed | Ports grid.tsx highlightRowValues render-loop guard (non-finite y dropped) as pure resolver |
| `resolveGridShimmer` | fn | renamed | Resolves bklit `useGridShimmer` inputs with design-token defaults; zero consumers today (see Deviations) |
| `selectEvenlySpacedIndices` | fn | same | Verbatim port of x-axis.tsx `tickMode="data"` selection; options simplified to `{labelForIndex, resolveXPx}` |
| `XAxisOverlayProps` | interface | extra | Props bag replacing legacy chart-context reads (`data`, `rangeStart/End`, `domainMaxTime`, `xDomain`) |
| `XAxisOverlay` | component | renamed | Ports XAxis/XAxisInner + `buildDataAlignedTicks` + `buildDomainTicks` + `appendProjectionTailTicks` + `domainExtendsPastData`; props: `data`, `xDataKey`, `rangeStart`, `rangeEnd`, `numTicks`, `formatValue?`, `domainMaxTime?`, `xDomain?` |
| `YAxisOverlayProps` | interface | extra | Dual-mode bag: precomputed `ticks`+`marginLeft` (candlestick) or `yDomain`+chart bounds (line path) |
| `YAxisOverlay` | component | renamed | Ports YAxis/YAxisInner + `formatLabel`; props: `ticks?`, `marginLeft?`, `yDomain?`, `chartTop/Bottom/Left/Right`, `orientation`, `numTicks=5`, `formatLargeNumbers=true`, `formatValue?`, `tickColorForValue?` |
| `Y_AXIS_DEFAULT_TICK_COUNT` / `Y_AXIS_MIN_TICK_COUNT` / `Y_AXIS_MAX_TICK_COUNT` | constant | same | 5 / 1 / 10, byte-for-byte port |
| `resolveYAxisTickCount` | fn | same | Verbatim clamp+round to valid d3 tick-count hint |
| `resolveTimeSeriesYDomain` | fn | same | Empty→[0,100]; all≥0→[0,max·1.1]; mixed→±5% padding (min 1). Drops legacy `yScaleDomainMax` override param (see Deviations) |
| `useNicedYDomainChanged` | hook | renamed | Returns `.nice()`d domain + ref-based value-compare `changed` flag (bklit chart-phase domain-change-detection semantics) |
| `createNicedYScale` | fn | renamed | = legacy `scaleLinear({domain, range, nice: true})` construction |
| `ChartMargin` | interface | same | `{top,right,bottom,left}` ≈ legacy shell Margin types |
| `useChartMargin` | hook | extra | Field-level defaults + stable-identity memo (TanStack definition-identity boundary; no legacy equivalent — shells merged margins inline) |
| `BackgroundPatternPreset` | type | same | Alias of `PatternPresetId` |
| `BackgroundProps` | interface | same | Adds `width`/`height`/`isLoaded` as props (legacy read them from chart-context) |
| `Background` (+ default) | component | same | Plot-area pattern fill with h/v/combined edge masks; orphan — no importers |
| `ReferenceAreaConfig` | interface | same | `{yAxisId, y1?, y2?, axisLabelColor?}` |
| `extractReferenceAreaConfigs` | fn | renamed | Same walk; adds CHART_ROLE symbol detection + Fragment recursion, `Children.toArray` |
| `extractReferenceAreaProps` | fn | extra | Full-props variant feeding `ReferenceAreaLayers` (migrated-only compile step) |
| `ReferenceAreaIfOverflow` | type | same | `"hidden" \| "visible" \| "discard"` |
| `ReferenceAreaRect` | interface | same | Identical |
| `ComputeReferenceAreaRectOptions` | interface | same | Identical |
| `clampRectToPlot` | fn | renamed | Legacy private helper, now exported |
| `isFullyInsidePlot` | fn | renamed | Legacy private helper, now exported |
| `computeReferenceAreaRect` | fn | same | Verbatim port |
| `resolveReferenceDataRange` | fn | same | Verbatim port (inclusive band for label highlighting) |
| `createTickColorResolver` | fn | extra | Packages legacy y-axis.tsx `resolveTickLabelColor` loop into a reusable closure; no per-axis-id filter |
| `ReferenceAreaLayerProps` | interface | extra | Mirrors legacy `ReferenceAreaProps` minus `className`/`axisLabelColor`, plus geometry plumbing (`width`, `height`, `margin`, `yDomain`, `xDomain`, `isTimeScale`, `barScale`, `isBarChart`, `bandWidth`, `xRangePadding`, `isCandlestickXScale`, `phase`, `isLoaded`) |
| `ReferenceAreaLayer` | component | renamed | Ports ReferenceArea declarative `motion.g` as self-contained absolutely-positioned SVG at margin origin (`zIndex:-1`) |
| `ReferenceAreaLayersGeom` | interface | extra | Shared geometry bag for multi-renderer |
| `ReferenceAreaLayers` | component | extra | Maps extracted config records → `ReferenceAreaLayer` list |

## Inventory

| Item | Kind | Origin | Impl | TanStack-native candidate? | Notes |
|---|---|---|---|---|---|
| `DEFAULT_GRID_STROKE_DASHARRAY "4,4"` | constant | BKLIT | CUSTOM | no | dashed grid lines; TS-check: none — native grid has no dash option |
| resolveGridGuide defaults: horizontal/vertical `false`, ticks `5` | constant | BKLIT (inline `?? false`/`?? 5` triples) | CUSTOM | maybe | NOTE: legacy `<Grid>` component default was `horizontal=true` — resolver follows the chart-file inline defaults instead; TS-check: native — axis.grid + axis.ticks.count options |
| Highlight-row non-finite-y drop guard | util fn | BKLIT (grid.tsx render guard) | TS-NATIVE | yes | pure; TS-check: native — ruleY mark drops non-finite positions (@tanstack/charts) |
| Shimmer tokens: length 140px, speed ×1, stroke `color-mix(in oklch, var(--foreground) 68%, transparent)` | constant | BKLIT (use-grid-shimmer defaults) | CUSTOM | no | imported from design-tokens, not re-inlined; TS-check: none |
| `resolveGridShimmer` resolver | util fn | BKLIT (shimmer option resolution) | TS-NATIVE | maybe | currently unconsumed; TS-check: none — no loading/shimmer concept |
| TanStack native guides wiring: `.ts-chart__grid line { stroke: var(--chart-grid) }` | CSS class | TANSTACK + BKLIT color parity | TS-NATIVE | yes | styles.css:21-24 restyles native grid lines to bklit token; TS-check: native — g.ts-chart__grid group + theme.grid (scene.ts) |
| `selectEvenlySpacedIndices` exhaustive gap-layout search | util fn | BKLIT (verbatim) | TS-NATIVE | maybe | enumerates positive-gap compositions; `MAX_GAP_LAYOUTS 400` binomial guard falls back to rounded indices; TS-check: partial — axis.tickLabels.thin minGap thins, no layout search |
| Layout score weights: spreadRatio + 0.1·countDistance + 0.08 interiorPenalty + 0.02·symmetryPenalty; tie-break ε=1e-6, then count, symmetry, edgePreference | constant | BKLIT (identical weights) | CUSTOM | no | scoring heuristic core; TS-check: none |
| targetCount ± 1 search window; smallest-gap edge preference 0=end/1=start/2=middle | constant | BKLIT | CUSTOM | no | TS-check: none |
| `XAxisOverlay` HTML label overlay (absolute div, pointerEvents none) | component | BKLIT (portal) | CUSTOM-ON-TS | no | sibling div convention, no React portal; TS-check: none — native axis labels are SVG scene text |
| Tick placement: `left: tick.x, bottom: 12`, zero-width flex centering | constant | BKLIT | CUSTOM | no | TS-check: none — native ticks are scene nodes, no HTML placement |
| Label style: fontSize 12, lineHeight 1rem, `var(--color-chart-label, var(--chart-label))`, nowrap | constant | BKLIT (`text-chart-label text-xs`) | CUSTOM | no | TS-check: partial — tickLabels.fontSize only, no CSS var/nowrap styling |
| `data-bkm-xlabel` + `data-bkm-x` attributes | side effect (DOM contract) | BKLIT (hover-fade contract) | CUSTOM | no | consumed by tooltip-chrome `applyLabelFade`/`resetLabelFade` (internal-interaction); TS-check: none — no DOM-attribute contract |
| Label opacity transition 0.4s ease-in-out | constant | BKLIT | CUSTOM | no | fade itself driven by tooltip-chrome; TS-check: partial — tickLabels.motion exists, not CSS opacity fade |
| Un-brushed projection branch: evenly interpolated DOMAIN timestamps when horizon extends past last datum | util fn | BKLIT (buildDomainTicks path, x-axis.tsx:596-603) | TS-NATIVE | maybe | `tickCount = max(2, numTicks)`, dedupe by formatted label; TS-check: partial — ticks.values supplies candidates, no interpolation |
| Brushed projection tail: ≤3 interpolated extras + exact domain-end tick, deduped, sorted by x | util fn | BKLIT (appendProjectionTailTicks, x-axis.tsx:494-557) | TS-NATIVE | maybe | `maxExtraTicks = max(1, numTicks − dataTicks + 1)`, capped at 3; TS-check: none — no projection-tail tick concept |
| Per-index Date cache (`Map<number, Date\|null>`) | util | CUSTOM (perf) | CUSTOM | no | avoids repeated `toDate` on hot path; TS-check: none — app-level memoization |
| `shortDateFmt` default formatter | util | BKLIT (chart-formatters) | TS-NATIVE | yes | imported from ./formatters; TS-check: partial — axis.ticks.format hook, no exported formatters |
| `YAxisOverlay` dual mode: precomputed ticks vs auto-compute | component | BKLIT (candlestick stashed-scale workaround + y-axis.tsx) | CUSTOM-ON-TS | no | precomputed branch keeps candlestick parity; TS-check: none — single axis per side, no HTML overlay axis |
| Auto tick path: `scaleLinear().domain(yDomain).range([chartBottom, chartTop]).nice()` + `scale.ticks(resolveYAxisTickCount(numTicks))` | util fn | BKLIT (y-axis.tsx:106-107) | TS-NATIVE | yes | standard d3; TS-check: native — axis.nice + ticks.count (@tanstack/charts) |
| `formatTick`: formatValue override, else ≥1000 → `` `${(v/1000).toFixed(0)}k` `` | util fn | BKLIT (formatLabel verbatim) | TS-NATIVE | yes | migrated "M"-branch/decimal variant removed for parity (in-file note); TS-check: native — axis.ticks.format callback |
| Gutter layout: container width = chartLeft/chartRight, padding 8px toward plot, `translateY(-50%)` | constant | BKLIT | CUSTOM | no | right-alignment flips justify/padding per orientation; TS-check: none — native margins are measured, not styled |
| `tickColorForValue` per-tick color callback | util | BKLIT (resolveTickLabelColor via registered referenceAreas) | CUSTOM-ON-TS | maybe | color decision pushed to callers (via createTickColorResolver); TS-check: none — tickLabels has no color option |
| `Y_AXIS_*_TICK_COUNT` 5/1/10 + `resolveYAxisTickCount` | constant | BKLIT (byte-for-byte) | CUSTOM | no | shared by y-axis-overlay + candlestick (dedupes candlestick's former inline copy); TS-check: native — axis.ticks.count hint (no 1–10 clamp) |
| `resolveTimeSeriesYDomain` sign-case rules ([0,100] empty · [0, max·1.1] all≥0 · ±5% pad `\|\| 1`) | util fn | BKLIT (time-series-chart-shell:102-120) | TS-NATIVE | yes | pure; shared by Line/Area/Composed; scatter intentionally excluded (LOG D14); TS-check: partial — native inference lacks 1.1×/±5% rules |
| `useNicedYDomainChanged` prev-value ref compare | hook | BKLIT (chart-phase y-domain change detection) | CUSTOM-ON-TS | maybe | value compare, not reference compare; drives "tween domain only" repaint rule; TS-check: none — no domain-change detection hook |
| d3 `.nice()` nicing via `scaleLinear().domain().nice().domain()` | util | BKLIT (visx `nice: true`) | TS-NATIVE | yes | d3-scale == visx-scale primitive; TS-check: native — axis.nice + LinearScale.nice (charts-scales) |
| `useChartMargin` stable-identity memo keyed on individual fields | hook | CUSTOM (TanStack definition-identity requirement) | CUSTOM-ON-TS | maybe | fresh prop object with same values must not invalidate definitions (live-line rationale); TS-check: partial — spec margin accepts Partial<ChartMargin>, no identity hook |
| `Background` pattern rect + h/v/combined edge-fade masks | mark | BKLIT (identical defs tree) | CUSTOM-ON-TS | no | orphan — no importers; TS-check: none — no <mask>/<pattern> in SVG renderer |
| `BACKGROUND_ENTER_FADE_MS 420` ease-out opacity reveal | constant | BKLIT (framer `motion.rect` 420ms) | CUSTOM | no | CSS transition replaces framer animation; TS-check: partial — motion/enter transitions exist, not fixed 420ms reveal |
| Fade stops 0/edge/(100−edge)/100 with clamp 0–45% | constant | BKLIT (fadeMaskStops + clampFadeLength) | TS-NATIVE | yes | shared impl via fade-mask `edgeFadeMaskStops`; TS-check: CONTRADICTS yes — no <mask> support, gradients only |
| Background defaults: pattern "diagonal", color `var(--chart-grid)`, fade lengths 10, showFill/opacity/fades true | constant | BKLIT (same defaults) | CUSTOM | no | TS-check: none — no plot-area background concept |
| `isLoaded` prop gates initial opacity 0→1 | prop | BKLIT (`isLoaded` from chart-context) | CUSTOM-ON-TS | no | now caller-supplied; TS-check: none — no loading-phase concept (motion phases only) |
| CHART_ROLE detection: `Symbol.for("migrated.chartRole") === "referenceArea"` + displayName/name fallback `"ReferenceArea"` | util fn | CUSTOM (children compile contract; legacy sniffed names only) | CUSTOM | no | config extractor accepts either marker; TS-check: none — no declarative-children API |
| Recursive children walk incl. Fragments | util | BKLIT (extractReferenceAreaConfigs) | TS-NATIVE | maybe | `Children.toArray` vs legacy `forEach` — order-equivalent; TS-check: none — marks are fn calls, no children |
| `normalizeYAxisId` (null/"" → "left") | util fn | BKLIT (y-axis-scales, inlined copy) | TS-NATIVE | yes | TS-check: CONTRADICTS yes — no yAxisId concept, one axis per side |
| `computeReferenceAreaRect` ifOverflow hidden/visible/discard semantics | util fn | BKLIT (verbatim) | TS-NATIVE | yes | pure geometry; TS-check: CONTRADICTS yes — no reference-area/clip-overflow API |
| `clampRectToPlot` / `isFullyInsidePlot` exports | util fn | BKLIT (private fns promoted to exports) | TS-NATIVE | yes | pure; TS-check: CONTRADICTS yes — no rect-clamping native helper |
| `resolveReferenceDataRange` fold-to-domain | util fn | BKLIT (verbatim) | TS-NATIVE | yes | pure; TS-check: CONTRADICTS yes — reference-data banding is not a TanStack concept |
| `createTickColorResolver` first-matching-band color lookup | util fn | CUSTOM (packaging of legacy y-axis loop) | TS-NATIVE | maybe | no per-axis-id filter (see Deviations); TS-check: none — no band-color lookup API |
| `ReferenceAreaLayer` SVG overlay at `(margin.left, margin.top)`, `overflow: visible`, `pointerEvents: none`, `zIndex: -1` | mark | BKLIT (ReferenceArea inside chart svg) | CUSTOM-ON-TS | no | standalone absolutely-positioned svg; TS-check: none — no reference-area mark |
| Area defaults: fill `color-mix(in oklch, var(--chart-foreground-muted) 12%, transparent)`, fillOpacity 1, stroke muted, strokeWidth 1, dashed `"4,4"`, fadeEdges true len 10, markers off, markerSize 6, markerColor `var(--chart-1)`, pattern "none" | constant | BKLIT (identical defaults) | CUSTOM | no | TS-check: none |
| `REFERENCE_AREA_ENTER_MS 420` ease-out opacity ramp | side effect (useLayoutEffect + direct style + requestAnimationFrame) | BKLIT (motion.g 420ms fade) | CUSTOM | no | sets `g.style.transition` + rAF-deferred opacity write; TS-check: none — overlay SVG outside TanStack scene/motion |
| prefers-reduced-motion matchMedia branch (skip transition, hard toggle) | side effect | CUSTOM | CUSTOM-ON-TS | no | legacy always tweens (see Deviations); TS-check: native — motion respectReducedMotion option (@tanstack/charts) |
| Phase gate `ready`/`revealing`/`gridTweenReady` (undefined phase = visible) | util fn | BKLIT (isReferenceAreaVisiblePhase verbatim) | TS-NATIVE | yes | TS-check: CONTRADICTS yes — bklit app phases, TanStack motion phases differ |
| Bar band-center xScale adapter: `band(String(v)) + bandwidth()/2`, ISO-string coercion for Dates | util fn | BKLIT (barScale usage in shells) | CUSTOM-ON-TS | no | bar-category x mapping; TS-check: native — band scale centers values natively (@tanstack/charts/scales/band) |
| `xRangePadding` inset scaleUtc / candlestick plain scaleUtc branches | util fn | BKLIT (per-chart xScale variants) | CUSTOM-ON-TS | no | replicates each host chart's x-scale flavor; TS-check: none — scale instances passed through unmodified |
| Edge-fade mask: linearGradient white stops + mask rect over fill+edges | mark | BKLIT (identical) | TS-NATIVE | maybe | stops via fade-mask `edgeFadeMaskStops(fadeEdgesLength)`; TS-check: none — no <mask> support, spec gradients only |
| Bracket markers: down/up triangle paths at band center edges | mark | BKLIT (bracketMarkerPath verbatim) | TS-NATIVE | maybe | TS-check: partial — text/arrow marks exist, not edge triangles |
| Pattern defs via `renderPatternPreset`, ids `bkm-ref-pattern-*` / `bkm-ref-fade-*` from sanitized `useId` | side effect | BKLIT (pattern-preset) | CUSTOM-ON-TS | no | TS-check: none — no <pattern> defs, gradients only |
| `ReferenceAreaLayers` keyed `ref-${i}` multi-renderer | component | extra | CUSTOM | no | consumes `extractReferenceAreaProps` output; TS-check: none |

## Imports

Internal modules consumed from other groups:

- `./types` (GridConfig, ChartDatum) — internal-foundation
- `./design-tokens` (DEFAULT_SHIMMER_LENGTH_PX, DEFAULT_SHIMMER_SPEED, DEFAULT_SHIMMER_STROKE — grid.ts; BACKGROUND_ENTER_FADE_MS — background.tsx) — internal-foundation
- `./formatters` (shortDateFmt — x-axis-overlay.tsx) — internal-foundation
- `./coerce-date` (toDate — x-axis-overlay.tsx) — internal-foundation
- `./fade-mask` (edgeFadeMaskStops — reference-area-layer.tsx, background.tsx) — internal-animation
- `./pattern-preset` (renderPatternPreset, PatternPresetId, PatternPresetOptions — reference-area-layer.tsx, background.tsx) — internal-foundation
- External: `react`, `d3-scale` (y-domain.ts, y-axis-overlay.tsx, reference-area-layer.tsx)

## Deviations

- Stale comment (grid.ts:7-9): claims highlight-row rendering lives in `internal/grid-chrome.tsx` ("GridHighlightRows") — no such file exists; the actual consumer is `internal/grid-highlight-mark.ts` (imports `resolveGridHighlightRows`). Comment-only drift.
- `resolveGridShimmer` is exported with zero consumers — no migrated chart renders the loading shimmer band (legacy rendered it via `useGridShimmer` + `motion.linearGradient` during loading chrome phases). Config fields (`shimmer*` on GridConfig) are carried but inert.
- Grid default mismatch: legacy `Grid` component defaulted `horizontal=true`; `resolveGridGuide` defaults `false` (follows the inline `?? false` triples previously duplicated in the six chart files, not the component default).
- `resolveTimeSeriesYDomain` drops legacy's third parameter `yScaleDomainMax` (time-series-chart-shell.tsx:105-109 short-circuited to `[0, yScaleDomainMax * 1.1]` when provided) — skeleton-domain-driven scaling must be reproduced by callers or is lost.
- X-axis labels do not tween `left` positions: legacy applied `left ${X_AXIS_POSITION_TWEEN_MS}ms cubic-bezier(...)` when un-brushed (x-axis.tsx:74-77); migrated labels are statically positioned.
- Y-axis labels do not tween `top` positions: legacy applied `top ${Y_AXIS_POSITION_TWEEN_MS}` transition per tick (y-axis.tsx:149); migrated ticks jump.
- `XAxisOverlay` does not surface legacy `tickMode="domain"` or `tickerHalfWidth` props — only the reachable projection branches are ported; ticker-half-width fade math lives in tooltip-chrome (internal-interaction part).
- Axis-label color filtering lost per-axis granularity: legacy YAxis filtered candidate areas by normalized `yAxisId`; `createTickColorResolver` matches the first band containing the value regardless of axis.
- `ReferenceAreaLayer` drops legacy `className` and `axisLabelColor` props (label coloring handled via the config/tick-color path); it also declares `bandWidth` and accepts `xDataKey` but uses neither (dead props — `xDataKey` destructured as `_xDataKey`, `bandWidth` never destructured).
- `ReferenceAreaLayer` adds a prefers-reduced-motion early-out absent from legacy (which always ran the 420ms tween); same pattern as SegmentOverlay in internal-interaction.
- `background.tsx` confirmed orphan: no importer anywhere under `showcase/migrated/charts/` (import graph scan); inventoried per taxonomy.
- Legacy reference-area registration (`reference-area-registration-context.tsx` register/unregister for axis-label styling) is not ported in this group — replaced by extract-config-at-compile-time + `createTickColorResolver`.
