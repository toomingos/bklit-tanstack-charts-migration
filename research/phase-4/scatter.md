# scatter — Phase 4 Research Report

**Files:** `showcase/migrated/charts/scatter-chart.tsx`, `showcase/migrated/charts/internal/scatter-focus-strategy.ts`, `showcase/migrated/charts/internal/scatter-hover-chrome.ts`
**Legacy source(s):** `repos/bklit-ui/packages/ui/src/charts/scatter-chart.tsx`, `scatter-chart-shell.tsx`, `scatter.tsx`, `series-markers.tsx`, `series-point-marker.tsx`, `use-scatter-chart-interaction.ts`, `scatter-svg.ts`

## Feature summary

XY scatter of per-series point markers (fill disc + transparent gap + stroke ring) over a time x-axis. Migration renders ONE TanStack `dot()` mark per series whose fill is a per-series radial gradient (halves per-point node count vs bklit's two-circles-per-point), keeps bklit's 1100ms clip-style mount reveal as a per-circle imperative WAAPI tween fed by `onRender`, and ports bklit's scatter tooltip chrome (crosshair, dimmed markers + enlarged undimmed hovered copies, dots, box, date pill) as imperative DOM (`attachScatterHoverChrome`) driven by a custom `ChartFocusStrategy`.

## Public API

Legacy surface = `charts/index.ts` exports: `ScatterChart`/`ScatterChartProps`, `Scatter`/`ScatterProps` (re-exported from `scatter-chart.tsx`). Migrated `Scatter` child is the config-carrier in `children.tsx`; its prop type is `ScatterConfig` in `internal/types.ts`.

| Prop/Export | Type | Legacy parity | Notes |
|---|---|---|---|
| `ScatterChart` | component | same | Named export both sides; no default export in migrated barrel |
| `ScatterChartProps.data` | prop | same | `ChartDatum[]` vs `Record<string, unknown>[]` |
| `ScatterChartProps.xDataKey` | prop | same | Default `"date"` |
| `ScatterChartProps.margin` | prop | same | Default `{40,40,40,40}` via `useChartMargin` |
| `ScatterChartProps.animationDuration` | prop | same | Default 1100 |
| `ScatterChartProps.animationEasing` | prop | missing | Hardcoded `cubic-bezier(0.85, 0, 0.15, 1)` (bklit default) |
| `ScatterChartProps.enterTransition` | prop | missing | Framer `Transition`; migrated uses fixed WAAPI tween |
| `ScatterChartProps.revealSignature` | prop | missing | Legacy re-triggers reveal epoch on change |
| `ScatterChartProps.aspectRatio` | prop | same | Default `"2 / 1"` |
| `ScatterChartProps.className` | prop | same | |
| `ScatterChartProps.children` | prop | same | Compositional children |
| `ScatterChartProps.onPhaseChange` | prop | same | Incl. bklit's unconditional first `"revealing"` call |
| default export (`export default ScatterChart`) | export | missing | Migrated module has named export only |
| `Scatter` | child component | same | Config-carrier (renders nothing); defined in `children.tsx` |
| `ScatterProps` (type) | type | renamed | → `ScatterConfig` (`internal/types.ts`), exported from migrated barrel |
| `Scatter.dataKey` | prop | same | Required |
| `Scatter.fill` | prop | same | Resolution order fill ?? stroke ?? palette color preserved |
| `Scatter.stroke` | prop | same | |
| `Scatter.strokeWidth` | prop | same | Default 2 (ring width) |
| `Scatter.ringGap` | prop | same | Default 2 |
| `Scatter.radius` | prop | same | Default 5 |
| `Scatter.yAxisId` | prop | missing | Per-series y-scale groups unsupported |
| `Scatter.animate` | prop | missing | Reveal always on (gated by `animationDuration > 0`) |
| `Scatter.yGradient` | prop | missing | Vertical red→green per-point gradient not ported |
| `Scatter.fadeOnHover` | prop | missing | Dim behavior always on (fixed 0.5/2px, = bklit defaults) |
| `Scatter.inactiveOpacity` | prop | missing | Fixed `DIM_OPACITY` 0.5 |
| `Scatter.inactiveBlur` | prop | missing | Fixed `DIM_BLUR_PX` 2 |
| `Scatter.enterBlur` | prop | missing | Fixed blur(2px) in reveal keyframes |
| `Scatter.showActiveHighlight` | prop | missing | Always true (pilot precedent: `getSeriesMarkerVisualExtent` outlineWidth 0, highlight on) |
| `Scatter.outlineWidth` | prop | missing | Pilot always 0 |
| `Scatter.outlineColor` | prop | missing | Pilot always 0 |

Internal-only legacy exports (`ScatterChartInner`, `ScatterChartInnerProps` from `scatter-chart-shell.tsx`) are not part of the package barrel and have no migrated counterpart (folded into `scatter-chart.tsx`).

## Inventory

| Item | Kind | Origin | Impl | TanStack-native candidate? | Notes |
|---|---|---|---|---|---|
| `DEFAULT_ANIMATION_DURATION_MS = 1100` | constant | BKLIT | CUSTOM | no | bklit animation.ts reveal duration; TS-check: none |
| `REVEAL_EASING` cubic-bezier(0.85, 0, 0.15, 1) | constant | BKLIT | CUSTOM | no | WAAPI easing string; TS-check: none |
| `ENTER_TWEEN_MS = 500` | constant | BKLIT | CUSTOM | no | bklit SeriesPointMarker fixed enter tween; TS-check: none |
| `DEFAULT_SCATTER_COLORS` `var(--chart-1..5)` | constant | BKLIT | CUSTOM | maybe | Cycle-by-index palette; TS-check: partial — defaultChartTheme.palette cycles by index but uses `--ts-chart-N` vars |
| `DEFAULT_MARGIN {top:40,right:40,bottom:40,left:40}` | constant | BKLIT | CUSTOM | no | TS-check: none — spec `margin` option native, 40px defaults are bklit's |
| xRangePadding rule `max(radius)+10`, flat `12` | constant | BKLIT | CUSTOM-ON-TS | no | Drives custom x-scale inset; TS-check: none |
| yDomain rule: max≥0 across series, `×1.1`, fallback 100, `.nice()` | constant | BKLIT | CUSTOM-ON-TS | maybe | Negatives silently ignored (ported verbatim); TS-check: partial — axis `nice` option covers `.nice()`, ×1.1/fallback rule custom |
| Gradient boundary band `halfPx = (0.5/outerRadius)*100` | constant | CUSTOM | CUSTOM | no | ~1px anti-alias band instead of true hard stop (Chromium tessellation fix); TS-check: none |
| `visualExtent = radius + ringGap+strokeWidth + 0.35·radius + 2` | constant | BKLIT | CUSTOM | no | bklit `getSeriesMarkerVisualExtent`, drives reveal delay; TS-check: none |
| `DIM_OPACITY "0.5"` / `DIM_BLUR_PX 2` / `DIM_TRANSITION 0.15s ease-in-out` | constant | BKLIT | CUSTOM | no | scatter-hover-chrome dim styling; TS-check: none |
| `ACTIVE_SCALE 1.35` | constant | BKLIT | CUSTOM | no | Enlarged hovered marker copy; TS-check: none |
| `SVG_NS` | constant | CUSTOM | CUSTOM | no | For createElementNS layers; TS-check: none |
| Design tokens: `DISCRETE_INTERACTION_THRESHOLD`, `BOX_OFFSET`, `TOOLTIP_SPRING`, `TICKER_HALF_WIDTH`, `FADE_BUFFER` | constant | BKLIT | CUSTOM | maybe | Imported from internal/design-tokens; TS-check: partial — `ChartMotionSpringTransition` + `@tanstack/charts/spring` cover springs, offsets/thresholds custom |
| One `dot()` mark per series, gradient fill disc+gap+ring | mark | BKLIT | CUSTOM-ON-TS | no | Halves node count vs bklit two circles/point (D14 rev.); TS-check: CONTRADICTS no — partial; `dot()` mark native, radial disc+gap+ring fill custom |
| `radialGradient` defs in 0×0 sibling `<svg>` after `<Chart>` | mark | CUSTOM | CUSTOM-ON-TS | no | Document-wide `url(#id)` refs; DOM-order constraint for QA harness; TS-check: CONTRADICTS no — partial; spec `gradients` emits linearGradient defs only, radial unsupported |
| Custom x `ChartScale` resolver (scaleUtc, inset range, ISO tick labels) | util fn | BKLIT | CUSTOM-ON-TS | no | Escape hatch: TanStack overwrites plain scale `.range()` (D110); TS-check: CONTRADICTS no — partial; `ChartScale.resolve` escape-hatch interface is native |
| Custom y `ChartScale` resolver (scaleLinear + `.nice()`) | util fn | BKLIT | CUSTOM-ON-TS | maybe | Consumes TanStack `context.range/tickCount`; TS-check: partial — plain scale instance + axis `nice` native, ×1.1 domain rule needs resolver |
| `svgAnimation: false` spec flag | constant | BKLIT | TS-NATIVE | yes | Data updates snap (bklit scatter has no update tween); TS-check: native — `svgAnimation` defineChart option (@tanstack/charts) |
| `focusRing: false` + `maxFocusDistance: Infinity` | constant | CUSTOM | TS-NATIVE | yes | defineChart overrides; distance filtering delegated to strategy; TS-check: native — `focusRing`/`maxFocusDistance` defineChart options (@tanstack/charts) |
| `createScatterFocusStrategy` (resolve/group/navigation) | util fn | BKLIT | CUSTOM-ON-TS | maybe | bklit bisect left-semantics (strict `>=` tie-break) over ChartPoints; TS-check: partial — `ChartFocusStrategy` interface + nearest/group-x presets native, phase gate custom |
| Interaction gate via `isChartInteractionPhase(phaseRef)` | util fn | BKLIT | CUSTOM-ON-TS | maybe | Returns `[]` unless phase `"ready"` (canInteract parity); TS-check: none |
| `resolveDotColor` precedence rows→dotColor(fn)→static→seriesFill | util fn | BKLIT | CUSTOM | no | In scatter-hover-chrome; TS-check: CONTRADICTS no — partial; native tooltip rows carry color (`ChartTooltipRow.color`) |
| Date labels for pill: `toLocaleDateString("en-US", {month:"short", day:"numeric"})` | util fn | BKLIT | CUSTOM | no | Precomputed per datum in chart body; TS-check: none |
| `useChartConfig` (tooltip springs) | context/hook | CUSTOM | TS-NATIVE | yes | Consumed; provided by chart-config-context (shared); TS-check: CONTRADICTS yes — custom React context (internal/chart-config-context), native analog `tooltip.motion` |
| `useChartMargin`, `useContainerWidth` | hook | CUSTOM | TS-NATIVE | yes | Via internal barrel; replaces react-use-measure debounce 10; TS-check: CONTRADICTS yes — custom internal hooks, native sizing = width/height props + renderer ResizeObserver |
| `extractChildren` role extraction (`scatters`, `grid`, `xAxis`, `tooltip`) | util fn | CUSTOM | CUSTOM | no | From `./children` (non-internal); TS-check: none |
| `extractReferenceAreaProps` + `ReferenceAreaLayers` | component | BKLIT | CUSTOM-ON-TS | maybe | Shared internal modules, mounted underlay; TS-check: partial — `rect()` mark x1/x2/y1/y2 draws reference bands natively, overlay custom |
| `XAxisOverlay` (range inset by margin+xRangePadding) | component | BKLIT | CUSTOM-ON-TS | maybe | Shared internal module; TS-check: partial — axis `ticks.format`/tickLabels native, bklit overlay styling custom |
| Tooltip overlay host `<div>` (absolute, pointer-events none) | overlay | CUSTOM | CUSTOM | no | Host for imperative chrome layers; TS-check: none |
| Active-highlight enlarged copy per series (`<g>` fill circle + ring circle `r=radius+ringGap+strokeWidth/2`, scaled 1.35) | overlay | BKLIT | CUSTOM | no | Reproduces bklit SeriesMarkersActiveHighlight geometrically (vs gradient mark); TS-check: CONTRADICTS no — partial; dot states `r`/opacity approximate enlarge+dim, no copy overlay |
| Crosshair indicator via `buildIndicator` (spring x, dashed variant aware) | overlay | BKLIT | CUSTOM | no | From shared tooltip-chrome; TS-check: CONTRADICTS no — native `crosshair()` mark (rule, strokeDasharray, motion) |
| Hover dot layer via `ensureDot`/`updateDotPosition`/`hideDot` | overlay | BKLIT | CUSTOM | no | Per-series spring-positioned dots; TS-check: CONTRADICTS no — partial; crosshair `marker` option covers primary dot only |
| Tooltip box via `buildBox`/`applyBoxContent`/`positionBox` (flip) | overlay | BKLIT | CUSTOM | no | Weekday title + per-series rows; React-root content support; TS-check: CONTRADICTS no — native `tooltip` option (placement auto flip, offset, content, className) |
| Date pill via `buildPill` (ticker vs `shortDateFmt`) | overlay | BKLIT | CUSTOM | no | Ticker path when dateLabels present; TS-check: CONTRADICTS no — partial; crosshair `x.label` format covers label, pill chrome custom |
| Label fade via `applyLabelFade`/`resetLabelFade` | overlay | BKLIT | CUSTOM | no | Axis label fade near cursor; TS-check: none — tickLabels `thin` is static collision thinning, not hover fade |
| WAAPI per-circle reveal: `circle.animate(opacity+blur(2px))`, leading-edge-x delay, `fill:"backwards"` | side-effect channel | BKLIT | CUSTOM | no | Zero React in animation path (D10); "backwards" avoids lingering-animation M3a regression; TS-check: CONTRADICTS no — partial; motion stagger/tween/easing-fn native, blur + x-delay custom |
| Deferred reveal setup: `onPostPaint` (2×rAF + macrotask) + `setRevealDeadline` timer | side-effect channel | CUSTOM | CUSTOM | no | Keeps setup off mount→paint critical path; deadline force-cancels animations; TS-check: none |
| Direct DOM dim: `marksGroup.style.{transition,opacity,filter}` on `.ts-chart__marks` | side-effect channel | BKLIT | CUSTOM | no | Whole-group dim/blur on hover; TS-check: CONTRADICTS no — partial; dot states opacity+transition native, filter blur unsupported |
| Direct DOM: `dataset.bkmRevealed="1"` guard + `classList` toggle `.ts-chart__marks--revealing` | side-effect channel | CUSTOM | CUSTOM | no | Hide-at-commit before deferred tween setup; TS-check: none |
| DOM queries: `.ts-chart__marks`, `.ts-chart__dot[data-ts-key="<escaped>"]` | side-effect channel | CUSTOM | CUSTOM | no | TanStack-generated structure coupling; TS-check: none — selectors target native-emitted `ts-chart__marks`/`ts-chart__dot[data-ts-key]` |
| Springs (rAF) via tooltip-chrome builders; `jump` vs `set` by discrete threshold | side-effect channel | BKLIT | CUSTOM | no | Shared internal-interaction machinery; TS-check: CONTRADICTS no — partial; `createChartSpring` (@tanstack/charts/spring) native, rAF loop custom |
| React root unmount on detach (`customRoot`, `childrenRoot`) | side-effect channel | CUSTOM | CUSTOM | no | In `detach()` cleanup; TS-check: none |
| Teardown effects: clearTimeout deadline, cancel post-paint, cancel reveal Animations | side-effect channel | CUSTOM | CUSTOM | no | D205 canonical wording; TS-check: none |
| Event listeners | side-effect channel | — | — | — | None added directly; pointer handling delegated to TanStack focus (`onFocusGroupChange` prop); TS-check: native — `onFocusGroupChange` Chart prop (@tanstack/react-charts) |
| `ScatterHoverChromeState.hoveredIndex` field | type | CUSTOM | CUSTOM | no | Declared but never populated by chart (see Deviations); TS-check: none |
| `.ts-chart__marks--revealing` | CSS class | CUSTOM | CUSTOM | no | From `styles.css`; hide-at-commit; TS-check: none |
| `.bkm-hover-layer` | CSS class | CUSTOM | CUSTOM | maybe | Set on created active-highlight `<svg>`; TS-check: none |
| `.ts-chart__marks`, `.ts-chart__dot` (queried) | CSS class | TANSTACK | TS-NATIVE | yes | TanStack-generated classes styled/queried; TS-check: native — `g.ts-chart__marks` (scene.ts) + `ts-chart__dot` group class (dot.ts) |

## Imports

From `scatter-chart.tsx`: `./children` (`extractChildren` — charts-root module, not `internal/`), `internal/reference-area-layer`, `internal/reference-area-config`, `internal/chart-config-context`, `internal/x-axis-overlay`, `internal/types`, `internal/parse-aspect-ratio`, `internal/scatter-focus-strategy`, `internal/deferred-reveal`, `internal/styles.css`, `internal` barrel (`use-chart-margin`, `use-container-size`)
From `scatter-focus-strategy.ts`: `internal/chart-phase`, `internal/types`
From `scatter-hover-chrome.ts`: `internal/formatters`, `internal/design-tokens`, `internal/tooltip-chrome`, `internal/types`

External: `@tanstack/react-charts` (`Chart`), `@tanstack/charts` (`defineChart`, `dot`, types), `d3-scale` (`scaleLinear`, `scaleUtc`).

## Deviations

- Missing legacy props: `animationEasing`, `enterTransition`, `revealSignature`, `ScatterProps.yAxisId/animate/yGradient/fadeOnHover/inactiveOpacity/inactiveBlur/enterBlur/showActiveHighlight/outlineWidth/outlineColor`, and the module default export. Most collapse to fixed bklit-default behavior (dim 0.5/2px, blur-enter 2px, highlight on, outline 0).
- Legacy drag-select / two-finger-touch range selection (`useScatterChartInteraction` selection state, `clearSelection`, crosshair cursor style, touch preventDefault) has no migrated counterpart — interaction is TanStack focus-only.
- `_tooltipBoxSpring` option accepted then discarded (`void _tooltipBoxSpring`) — dead parameter in `attachScatterHoverChrome`.
- `ScatterHoverChromeState.hoveredIndex` is declared and read (`state.hoveredIndex ?? primary.datumIndex`) but never set by `scatter-chart.tsx`, so the pill ticker always consumes `datumIndex`.
- Module-level mutable `let gradientCounter` for chrome element ids (shared mutable state across instances).
- Duplicated computation: `yDomain` and `yDomainScatter` memos are identical logic in the same file; `timeExtentScatter` recomputes min/max dates already computed inside the x-scale memo.
- No TODO/FIXME comments found in the three scoped files.
