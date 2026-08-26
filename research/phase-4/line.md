# line — Phase 4 Research Report

**Files:** `showcase/migrated/charts/line-chart.tsx`, `showcase/migrated/charts/internal/profit-loss-config.ts`, `showcase/migrated/charts/internal/profit-loss-legend.tsx` (orphan), `showcase/migrated/charts/internal/profit-loss-legend-hover.tsx` (orphan), `showcase/migrated/charts/internal/profit-loss-line-mark.ts`, `showcase/migrated/charts/internal/profit-loss-segments.ts`, `showcase/migrated/charts/internal/grid-highlight-mark.ts`

**Legacy source(s):** `repos/bklit-ui/packages/ui/src/charts/line-chart.tsx`, `line.tsx`, `time-series-chart-shell.tsx` (shell), `profit-loss-line.tsx`, `profit-loss-legend.tsx`, `profit-loss-legend-hover.tsx`, `profit-loss-segments.ts`, `grid.tsx` (highlight-row block)

## Feature summary

Time-series line chart: multi-series `<Line>` strokes (natural curve default, edge-fade gradients, optional scatter markers, dashed tails), mount clip-path reveal (1100ms), y-domain tween on data/status change, brush viewport (`xDomain`), projection lines + terminal/end markers, ProfitLossLine sign-colored segments, grid highlight rows, HTML hover chrome (crosshair/dots/date pill/tooltip), x/y axis overlays, reference areas, segments, chart markers, loading label + pulse. Children are config carriers compiled into one TanStack `defineChart` spec; overlays are imperative DOM driven by TanStack focus callbacks.

## Public API

### `LineChart` props (vs legacy `line-chart.tsx` LineChartProps)

| Prop/Export | Type | Legacy parity | Notes |
|---|---|---|---|
| `data` | `ChartDatum[]` | same | |
| `xDataKey` | `string` | same | default `"date"` both sides |
| `status` | `ChartStatus` | same | drives phase orchestrator |
| `animationDuration` | `number` | same | default 1100 both sides |
| `margin` | `Partial<Margin>` | same | default {40,40,40,40} both sides |
| `aspectRatio` | `string` | same | default `"2 / 1"` |
| `className` | `string` | same | |
| `onPhaseChange` | `(phase) => void` | same | |
| `children` | `ReactNode` | same | config-carrier children |
| `loadingLabel` | `string` | same | |
| `style` | `CSSProperties` | same | |
| `animationEasing` | `string` | same | default `cubic-bezier(0.85,0,0.15,1)` (legacy default undefined → shell constant) |
| `yDomainTween` | `boolean` | same | default true |
| `yDomainTweenDuration` | `number` | same | default 500; accepted, folded into effective duration |
| `xDomain` | `[Date, Date]` | same | brush viewport; narrows scale + visibleData |
| `xDomainSlotCount` | `number` | same | accepted for parity; **unused** in migrated body |
| `tweenYDomainOnXDomainChange` | `boolean` | same | default false; shell:373-395 logic ported |
| `enterTransition` | `Transition` | missing | legacy prop (motion/react), dropped |
| `revealSignature` | `string` | missing | legacy prop; migrated hardcodes `revealSignature: ""` |

### Module exports (vs legacy `line-chart.tsx` / package index)

| Prop/Export | Type | Legacy parity | Notes |
|---|---|---|---|
| `LineChart` | component | same | |
| `LineChartProps` | type | same | |
| default export | component | missing | legacy `export default LineChart`; migrated named-only |
| `Line` / `LineProps` re-export | component/type | renamed | legacy re-exports from `./line`; migrated `Line` is a null-render config carrier in `children.tsx`, props type renamed `LineConfig` |

### `<Line>` child props (vs legacy `line.tsx` LineProps)

| Prop/Export | Type | Legacy parity | Notes |
|---|---|---|---|
| `dataKey` | `string` | same | |
| `yAxisId` | `string \| number` | same | accepted; see Deviations (single y-axis render) |
| `stroke` | `string` | same | default `var(--chart-line-primary)` |
| `strokeWidth` | `number` | same | default 2.5 |
| `curve` | `CurveFactory` | same | default curveNatural (d3 vs @visx/curve) |
| `animate` | `boolean` | same | accepted; per-line data-transition path replaced by spec-level `svgAnimation` |
| `fadeEdges` | `boolean \| "left" \| "right"` | same | default true; container mask via styles.css |
| `showHighlight` | `boolean` | same | default true; feeds hover chrome series state |
| `showMarkers` | `boolean` | same | default false; dot marks above strokes |
| `markers` | `SeriesPointMarkerStyle` | same | fill/stroke/strokeWidth/ringGap/radius/outline*/showActiveHighlight |
| `dashFromIndex` | `number` | same | hides base stroke, DashTailOverlay draws tail |
| `dashArray` | `string` | same | default `"6,4"` |
| `loadingStroke` | `string` | same | accepted in config but **not consumed** by line-chart (pulse uses default) |
| `loadingStrokeOpacity` | `number` | same | accepted but **not consumed** |
| `loading` | `boolean` | missing | legacy per-line pulse disable; migrated pulse is chart-level only |
| `loadingPulseMode` | `LineLoadingPulseMode` | missing | |
| `onLoadingPulseCycleComplete` | `() => void` | missing | |
| `loadingStyle` | `"pulse" \| "sweep"` | missing | sweep unreachable from line-chart |

### `<ProfitLossLine>` child props (vs legacy `profit-loss-line.tsx` ProfitLossLineProps)

| Prop/Export | Type | Legacy parity | Notes |
|---|---|---|---|
| `dataKey` | `string` | same | |
| `xDataKey` | `string` | same | default `"date"` |
| `strokeWidth` | `number` | same | default 2.5 |
| `positiveColor` | `string` | same | default emerald-500 var |
| `negativeColor` | `string` | same | default red-500 var |
| `curve` | `CurveFactory` | same | default curveLinear |
| `fadeEdges` | `boolean \| "left" \| "right"` | same | default false |

### Profit-loss module surface (vs legacy `profit-loss-line.tsx` / `-segments.ts` / `-legend*.tsx`)

| Prop/Export | Type | Legacy parity | Notes |
|---|---|---|---|
| `PROFIT_LOSS_POSITIVE_COLOR` | const | same | moved to `profit-loss-config.ts` |
| `PROFIT_LOSS_NEGATIVE_COLOR` | const | same | |
| `profitLossColor()` | fn | same | |
| `PROFIT_LOSS_TOOLTIP_LABEL_FALLBACK` | const | same | `"Profit/Loss"` |
| `resolveProfitLossTooltipLabel()` | fn | same | |
| `splitProfitLossSegments()` | fn | same | verbatim port incl. zero-crossing interpolation |
| `ProfitLossSegment` | type | same | |
| `normalizeProfitLossConfig()` | fn | extra | internal props→config normalizer |
| `ProfitLossLineConfig` | type | extra | normalized config shape |
| `extractProfitLossHoveredIndex()` | fn | extra | reads `hoveredIndex` off CHART_CHILD_PASSTHROUGH wrappers (replaces legacy context read inside ProfitLossLine) |
| `ProfitLossLegend` + `PROFIT_LOSS_LEGEND_ITEMS` + `ProfitLossLegendProps` | component | same | orphan (no importers); imports internal `legend` |
| `ProfitLossLegendHoverProvider` / `useProfitLossLegendHover` | context | same | orphan; Provider additionally tagged CHART_CHILD_PASSTHROUGH (extra) |

### Grid highlight rows (via `grid-highlight-mark.ts`; legacy `grid.tsx:273-296`)

| Prop/Export | Type | Legacy parity | Notes |
|---|---|---|---|
| `gridHighlightRowMarks()` | fn | extra | internal mark builder replacing legacy inline `<line>`s |
| `DEFAULT_HIGHLIGHT_ROW_STROKE` | const | extra | `var(--chart-foreground-muted)` |
| `Grid.highlightRowValues` | `number[]` | same | gate: `horizontal` + non-empty |
| `Grid.highlightRowStroke` | `string` | same | |
| `Grid.highlightRowStrokeOpacity` | `number` | same | default 1 |
| `Grid.highlightRowStrokeWidth` | `number` | same | default 1 |
| `Grid.highlightRowStrokeDasharray` | `string` | same | default `"0"` (solid) |

## Inventory

| Item | Kind | Origin | Impl | TanStack-native candidate? | Notes |
|---|---|---|---|---|---|
| `DEFAULT_ANIMATION_DURATION_MS = 1100` | constant | BKLIT | CUSTOM | no | bklit animation.ts reveal; TS-check: none |
| `REVEAL_EASING cubic-bezier(0.85,0,0.15,1)` | constant | BKLIT | CUSTOM | no | TS-check: none — native easing is enum/fn, no bezier helper |
| `DATA_TWEEN_MS = 500` | constant | BKLIT | CUSTOM | no | bklit DEFAULT_Y_DOMAIN_TWEEN_MS; TS-check: none — app constant |
| `DEFAULT_MARGIN {40,40,40,40}`; aspectRatio `"2 / 1"` | constant | BKLIT | CUSTOM | no | TS-check: none — app defaults; spec.margin/aspectRatio slots only |
| `lineY` + `d3Curve(curveNatural)` series marks, `z: dataKey` for group-x | mark | BKLIT | TS-NATIVE | yes | z fixes multi-series hover dedupe; TS-check: native — lineY/d3Curve/z option (charts-core) |
| Custom `ChartScale.resolve` (d3 `scaleUtc`, ticks, NaN map) | util fn | BKLIT | TS-NATIVE | yes | stashes ranged scale in `xScaleD3Ref` (D110); TS-check: native — ChartScale.resolve contract (charts-core) |
| y `scaleLinear` on niced `resolveTimeSeriesYDomain` | util fn | BKLIT | TS-NATIVE | yes | [0,max*1.1] / 5%-padded / [0,100] rules; TS-check: partial — ChartAxisOptions.nice covers d3 nice, not bklit domain rules |
| `svgAnimation {duration, easing: bezierEasing}` y-domain tween | spec field | BKLIT | TS-NATIVE | yes | gated on phase+`yDomainChangedForTween`; TS-check: native — svgAnimation ChartAnimationOptions, easing fn (charts-core) |
| `focus:"group-x"`, `focusRing:false`, `maxFocusDistance:Infinity` | spec field | BKLIT | TS-NATIVE | yes | bklit has no focus ring; TS-check: native — ChartFocusPreset 'group-x'/focusRing/maxFocusDistance (charts-core) |
| `onRender` → WAAPI clip-path reveal on `.ts-chart__marks` (`inset(0 100% 0 0)`→`inset(0)`) | side-effect | BKLIT | CUSTOM-ON-TS | maybe | zero per-frame JS; `dataset.bkmRevealed` once-guard; TS-check: none — motion clip is arc-sweep only, no inset reveal (charts-core) |
| WAAPI marker-dot stagger reveal (opacity+`blur(2px)`, 500ms, delay = leadingEdge/innerW·duration) | side-effect | BKLIT | CUSTOM-ON-TS | no | per-circle `animate()`; visualExtent = radius+ring+outline+radius·0.35+2; TS-check: partial — motion delay-fn staggers, but no blur/leading-edge WAAPI reveal |
| rAF×2 + setTimeout(0) scheduler + cancel refs | side-effect | CUSTOM | CUSTOM | no | waits for TanStack dot commit; TS-check: none |
| Direct DOM mutation: `marks.style.clipPath`, `dataset.bkmRevealed` | side-effect | CUSTOM | CUSTOM | no | TS-check: none |
| `matchMedia("(prefers-reduced-motion: reduce)")` sync checks | side-effect | BKLIT | CUSTOM | maybe | shared `use-prefers-reduced-motion` hook exists; TS-check: native — respectReducedMotion in ChartAnimationOptions/mark-state transition + renderer check (charts-core) |
| Selectors `.ts-chart__marks`, `.ts-chart__dot[data-ts-key…__marker]` | CSS class | TANSTACK | CUSTOM | no | couples to TanStack renderer DOM; TS-check: native — classes emitted by scene.ts/svg-renderer.ts (charts-core) |
| `decimateTimeSeries` / `maxRenderPointsForWidth` | util fn | BKLIT | CUSTOM | no | LTTB strategy parity; TS-check: none — no decimation/downsampling in charts-core |
| `useChartPhaseOrchestrator` + `notifyYDomainTweenComplete` | hook | BKLIT | CUSTOM | maybe | shared internal-animation member; TS-check: none — no phase orchestration API |
| `useHoverChrome` (refs, pill labels, reanchor, focus-clamp) | hook | BKLIT | CUSTOM | no | imperative chrome, no React work per move; TS-check: partial — crosshair/focus guides exist, HTML pill chrome custom |
| `handleProfitLossFocus` sign flip (≥0→legend idx 0) | util fn | BKLIT | CUSTOM | no | Line-specific onFocusPoints; TS-check: none |
| `chromeStateRef.resolvePoints` manual y mapping | util fn | CUSTOM | CUSTOM | no | mirrors rendered scale math; TS-check: none |
| `ChartSelectionContext.Provider` + `useChartSelection` | context | BKLIT | CUSTOM | no | drag selection; clears hover chrome; TS-check: CONTRADICTS no — partial: brushX covers range drag, lacks index-range/hover-clear wiring |
| `BrushHostContext.Provider` + brush clipPath rect + `style.clipPath:url(#…)` | context | BKLIT | CUSTOM | no | clips full-data paths when xDomain set; TS-check: CONTRADICTS no — native spec.clip clips marks to plot rect (charts-core) |
| `useChartLegendHover` consumption | context | BKLIT | CUSTOM | no | replaces legacy profit-loss-legend-hover context in live path; TS-check: none — interactiveColorLegend is toggle-visibility only |
| `useChartMargin`, `useDebouncedContainerSize` | hook | BKLIT | TS-NATIVE | yes | foundation shared; TS-check: CONTRADICTS yes — partial: renderer ResizeObserver auto-sizes, no debounce/margin hooks |
| `useNicedYDomainChanged` | hook | BKLIT | CUSTOM | maybe | change-signal for tween; TS-check: none |
| `XAxisOverlay` / `YAxisOverlay` (+`createTickColorResolver`) | overlay | BKLIT | CUSTOM | maybe | HTML overlays over final domains; TS-check: CONTRADICTS maybe — native axis:true + tickLabels.color fn covers it (charts-core) |
| `ReferenceAreaLayers` | overlay | BKLIT | CUSTOM | maybe | own part (internal-axes-grid); TS-check: partial — rect mark + states cover visuals, no x1/x2 value-range API |
| `SegmentOverlay` | overlay | BKLIT | CUSTOM | no | add-on visuals; TS-check: none |
| `ProjectionMarkerOverlay` + imperative `phasePort.setPhase` | overlay | BKLIT | CUSTOM | no | ref-port avoids re-render; TS-check: none |
| `DashTailOverlay` (`resolveDashTailBounds`) | overlay | BKLIT | CUSTOM | no | TS-check: none — strokeDasharray is static, no split-at-index tail |
| `ChartMarkersOverlay` + xScale `-margin.left` correction | overlay | BKLIT | CUSTOM | no | radial-gradient defs; offset bug fixed live; TS-check: none |
| `LoadingLabel` / `LineLoadingPulse` + skeleton wave `110+sin(i·1.15)·36+i·9`, n=7 | component | BKLIT | CUSTOM | no | magic waveform invented (see Deviations); TS-check: none — no loading/skeleton API |
| `React.useId` sanitized `[^\w-]` gradient-id bases | util fn | CUSTOM | CUSTOM | no | 3 id namespaces: proj, PL, markers; TS-check: none — svg.ts sanitizes its own ids internally |
| PL colors `var(--color-emerald-500)` / `var(--color-red-500)` | constant | BKLIT | CUSTOM | no | TS-check: none — app theme tokens |
| PL dim opacity 0.25 via mark `style.opacity` | constant | BKLIT | CUSTOM-ON-TS | no | renderer drops node-level opacity field → style only; TS-check: CONTRADICTS no — partial: mark states `unmatched` opacity + ChartMarkStateTransition (charts-core) |
| `.chart-profit-loss-segment { transition: opacity 0.2s ease-in-out }` | CSS class | BKLIT | CUSTOM | no | styles.css carries transition (renderer emits none); TS-check: CONTRADICTS no — ChartMarkStateTransition tweens state opacity natively |
| `splitProfitLossSegments` zero-crossing interpolation | util fn | BKLIT | CUSTOM | no | verbatim port; TS-check: none — no sign-split transform in charts-core |
| `createMark` PL segment groups (polyline child, round caps/joins) | mark | BKLIT | CUSTOM-ON-TS | yes | segmentKey `-seg-{i}-{pos|neg}-{d0}-{d1}`; TS-check: native — createMark + polyline SceneNode w/ lineCap/lineJoin (charts-core) |
| PL fade gradients `linearGradient userSpaceOnUse x1=0 x2=innerWidth` | mark | BKLIT | CUSTOM-ON-TS | yes | pos+neg pair per config; stops from shared fade-mask; TS-check: CONTRADICTS yes — spec.gradients renders % coords only, no userSpaceOnUse |
| `fadeGradientStops` / `resolveFadeSides` reuse | util fn | BKLIT | CUSTOM | maybe | shared fade-mask module; TS-check: none — bklit-specific mask math |
| Container attrs `data-bkm-chart="line"`, `data-bkm-fade-edges(-left/-right)` | CSS class | CUSTOM | CUSTOM | no | keys styles.css masks/scoping; TS-check: none |
| styles.css: `.ts-chart__grid line`, `[data-bkm-fade-edges] .ts-chart__marks`, `.ts-bkm-loading-label*`, `.chart-projection-line path{vector-effect:none}` | CSS class | BKLIT | CUSTOM | no | hiDPI dash fix rides default className; TS-check: none — app stylesheet targeting TS DOM hooks |
| Tailwind legend classes `px-1 py-2`, `justify-*`, `gap-4`, `h-2.5 w-2.5`, `text-xs` | constant | BKLIT | CUSTOM | no | orphan legend file; TS-check: none — app styling |
| `gridHighlightRowMarks` solid rows beneath series (defaults muted/1/1/"0") | mark | BKLIT | CUSTOM-ON-TS | yes | unmasked `<line>` parity, no horizontal fade; TS-check: native — ruleY replaces custom mark entirely (charts-core) |
| `resolveGridGuide` → spec `y.grid`/`ticks` | util fn | BKLIT | TS-NATIVE | yes | shared grid module; TS-check: native — ChartAxisOptions.grid + ticks.count (charts-core) |

## Imports

Internal modules imported by this part's files:

- `line-chart.tsx`: `decimate`, `use-hover-chrome`, `reference-area-layer`, `reference-area-config`, `reference-area-geometry`, `chart-selection`, `segment-visuals`, `projection-config`, `projection-line-mark`, `terminal-marker`, `profit-loss-config`, `profit-loss-line-mark`, `coerce-date`, `x-axis-overlay`, `y-axis-overlay`, `types`, `chart-phase`, `parse-aspect-ratio`, `bezier-easing`, `fade-mask`, `grid`, `grid-highlight-mark`, `loading-chrome`, `y-domain`, `chart-legend-hover`, `use-chart-margin` + `use-debounced-container-size` (via `internal/index.ts` barrel), `use-chart-phase-orchestrator`, `brush-selection`, `brush-drag`, `dash-tail`, `series-marker-mark`, `chart-markers`, `styles.css`; sibling `children.tsx` (non-internal)
- `profit-loss-config.ts`: `../children` (CHART_CHILD_PASSTHROUGH symbol)
- `profit-loss-line-mark.ts`: `types`, `fade-mask`, `profit-loss-segments`, `profit-loss-config`
- `profit-loss-segments.ts`: none
- `grid-highlight-mark.ts`: `types`, `grid`
- `profit-loss-legend.tsx` (orphan): `legend`, `profit-loss-config`, `@/lib/utils` (cn)
- `profit-loss-legend-hover.tsx` (orphan): `../children`

## Deviations

- `enterTransition` and `revealSignature` props dropped; orchestrator called with hardcoded `revealSignature: ""`.
- No default export (legacy `export default LineChart`).
- Per-line loading controls gone: `loading`, `loadingPulseMode`, `onLoadingPulseCycleComplete`, `loadingStyle` missing; `loadingStroke`/`loadingStrokeOpacity` accepted in `LineConfig` but never passed to `LineLoadingPulse`. Sweep mode exists in `loading-chrome.tsx` but is unreachable from line-chart.
- Single y-axis: per-`Line` `yAxisId` accepted but all series share one niced domain (legacy shell builds per-axis scales via `buildYScalesFromDomains`).
- Dead code: `earlyRenderData` computed then `void`ed (lines 144-148); `xDomainSlotCount` accepted but unused.
- Orphans confirmed: `profit-loss-legend.tsx` and `profit-loss-legend-hover.tsx` have no importers; live hover-index flow uses `extractProfitLossHoveredIndex` (child-prop scan) + shared `chart-legend-hover` context instead of the legacy provider.
- Renderer workarounds: PL dim must ride `style.opacity` (node opacity field dropped) and its 0.2s transition lives in `.chart-profit-loss-segment` CSS; projection polyline needs `.chart-projection-line path { vector-effect:none }` for hiDPI dash correctness.
- `ChartMarkersOverlay` xScale subtracts `margin.left` to undo the absolute-coordinate host scale (live-verified offset bug, documented in comment).
- Loading skeleton waveform (`110 + sin(i*1.15)*36 + i*9`, 7 pts) is invented, not derived from bklit skeleton generator.
- `prefers-reduced-motion` read synchronously at render-callback time rather than via reactive hook.
