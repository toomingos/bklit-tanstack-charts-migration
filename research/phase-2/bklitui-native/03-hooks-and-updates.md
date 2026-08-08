# 03 — Hook & Update Flows

## Context hooks

| Hook | File | Reads | Re-renders on hover? |
|------|------|-------|----------------------|
| `useChartStable()` | `chart-context.tsx:376` | `ChartStableContext` — data, scales, dims, `chartPhase`, `xAccessor` | No — stable slice memoized (`chart-context.tsx:246-337`) |
| `useChartHover()` | `chart-context.tsx:402` | `ChartHoverContext` — `tooltipData`, `selection`, `hoveredBarIndex` | Yes — volatile slice (`chart-context.tsx:339-360`) |
| `useChart()` | `chart-context.tsx:419` | Merges both | Yes (`{...stable,...hover}`) |
| `useYScale(id)` | `chart-context.tsx:388` | `yScales[id] ?? yScale` | Stable only |
| `useStaticChartPreview()` | `static-chart-preview-context.tsx` | Docs flag `skipEnterReveal` | — |

Pattern: series components (`Line` `line.tsx:232`, `Area` `area.tsx:160`) read via `useChartStable` so they don't re-render on mouse move; hover leaves (`SeriesHighlightLayer`, `SeriesHoverDim`, `useHighlightSegment`) subscribe to `useChartHover` internally.

## Interaction hook

`useChartInteraction` (`use-chart-interaction.ts:54`) owns `tooltipData` + `selection` and returns `interactionHandlers` + `interactionStyle` spread onto the inner `<g>` (`time-series-chart-shell.tsx:673`).

| Concern | Detail | Line |
|---------|--------|------|
| State | `useState<ChartSelection\|null>` + rAF tooltip via `useScheduledTooltip` (`use-chart-interaction.ts:65`) | `65` |
| Coords | `localPoint(event)` (`@visx/event`) minus `margin.left` → `chartX` (`use-chart-interaction.ts:140-167`) | `145,164` |
| Index lookup | `xScale.invert(pixelX)` → `bisector.left` → nearest `d0/d1` comparison (`use-chart-interaction.ts:78-117`) | `81,94` |
| yPositions | Per `lines[]`, `yScales[normalizeYAxisId(yAxisId)] ?? yScale` → `axisScale(value)` (`use-chart-interaction.ts:100-107`) | `104` |
| Re-anchor | `useEffect` on `[canInteract, resolveTooltipFromX, scheduleTooltip]` — re-resolves `lastHoveredXRef` after brush/scale change (`use-chart-interaction.ts:315-325`) | `315` |
| Guard | `canInteract = isLoaded && isChartInteractionPhase(chartPhase)` (`time-series-chart-shell.tsx:406`); handlers empty object when false (`use-chart-interaction.ts:327`) | — |
| Drag | `isDraggingRef` + `dragStartXRef` (`use-chart-interaction.ts:74`) — `onMouseDown` clears tooltip, `onMouseMove` while dragging updates `selection` (`176-186`) | `74,177` |

Scatter variant `useScatterChartInteraction` (`use-scatter-chart-interaction.ts:47`) is identical except `localPointFromSvg(svg, clientX, clientY)` (`use-scatter-chart-interaction.ts:153`) to handle transformed SVG containers.

## rAF deduped tooltip

`useScheduledTooltip<T>()` (`use-scheduled-tooltip.ts:29`):

```
scheduleTooltip(tooltip, dedupeKey?) ──► pendingRef = tooltip
         │                               if key===lastKey → return (no-op)
         │                               if raf pending → return (coalesce)
         └─► requestAnimationFrame ──► commitTooltip → setTooltipData
clearTooltip() ──► cancel rAF, null refs, setTooltipData(null)
```

| Field | Purpose |
|-------|---------|
| `lastKeyRef` (`32,45`) | Dedupe: default key = `${index}:${round(x)}` (`use-scheduled-tooltip.ts:13-24`); skip `setState` if unchanged |
| `pendingRef` / `pendingKeyRef` (`32,34`) | Latest hover coalesced into one rAF |
| `rafRef` (`33`) | At most one frame queued; cancelled on unmount (`37-41`) or `clearTooltip` (`76`) |
| `resetTooltipDedupe()` (`86`) | Called on two-finger touch to force next tooltip through |

Custom key caller: `scheduleTooltip(tooltip, \`${tooltip.index}:${Math.round(tooltip.x)}\`)` in re-anchor effect (`use-chart-interaction.ts:321`).

## Data-change propagation

```
props.data change
  ├─ TimeSeriesChartCore: visiblePlotData = filterDataByXDomain(plotData, xDomain) if xDomain else plotData (time-series-chart-shell.tsx:272)
  ├─ skeletonData regenerated (time-series-chart-shell.tsx:228)
  ├─ yDomainTargetByAxis recomputed via computeYDomainsByAxis (time-series-chart-shell.tsx:337-371)
  ├─ animatedYDomainsByAxis may tween if tweenOnTargetChange && phase==="ready" (use-animated-y-domains.ts:204-238)
  ├─ xScale domain = extent(plotData)+projection merge (time-series-chart-shell.tsx:284-301)
  ├─ renderData re-decimated (time-series-chart-shell.tsx:308-315)
  ├─ columnWidth = innerWidth/(slotCount-1) (time-series-chart-shell.tsx:317-326)
  └─ contextValue useMemo deps include visiblePlotData+renderData+xScale+yScales (time-series-chart-shell.tsx:553-596)
        └─ ChartProvider stable slice update → Grid/YAxis/series re-render (hover slice untouched)
```

`useChartPhaseOrchestrator` watches `chartStatus` transition (`use-chart-phase-orchestrator.ts:45`): `ready↔loading` flips `chartPhase` through tween/reveal, swapping `plotData` between `skeletonData`/`targetData` (`use-chart-phase-orchestrator.ts:106-125`).

`BarChart` data flow is simpler: no orchestrator — `data` feeds `categoryScale` domain + `valueScale` + `stackOffsets` directly (`bar-chart.tsx:212-341`); `revealEpoch` bump on `animationDuration`/`revealSignature` change (`bar-chart.tsx:373`).

`CandlestickChart` computes `yScale` from `low/high` scan (`candlestick-chart.tsx:154-179`), `slotWidth` from `xDomainSlotCount` (`candlestick-chart.tsx:137`).

## Resize handling

| Source | Effect | File |
|--------|--------|------|
| `ParentSize` width/height change | `innerWidth/Height` recompute → `xScale` range, `yScales` range, `columnWidth`, `renderData` maxPoints | `time-series-chart-shell.tsx:212,284,386,317,308` |
| `xScale` range change | `selectEvenlySpacedIndices` tick layout re-scores (`x-axis.tsx:315`); `Grid` column/row scales update (`grid.tsx:148`) | — |
| Decimation | `maxRenderPointsForWidth(innerWidth)` changes → `renderData` length changes | `decimate-time-series.ts:88` |
| Bar chart | `categoryScale` range `[0, innerWidth/innerHeight]` rebuilds; `bandWidth`/`barWidth` recalc | `bar-chart.tsx:236,249` |
| Scatter | `useMeasure bounds` update propagates same as above | `scatter-chart.tsx:161` |

No window listener — all via ResizeObserver owned by `ParentSize`/`useMeasure`.

## Animation hooks (per-frame cost)

| Hook | Trigger | Mechanism | setState frequency |
|------|---------|-----------|-------------------|
| `useAnimatedYDomains` | `chartPhase ∈ gridTween*` or `tweenOnTargetChange` target shift | `motion.animate(0,1, {duration: yDomainTweenDuration/1000})` `onUpdate` lerps each axis domain (`use-animated-y-domains.ts:88-103`) → `setAnimatedByAxis` per frame | Every rAF during tween (~60fps × 500 ms default) |
| `useAnimatedSeriesPath` | `chartPhase==="ready"` + `enabled` + `transitionSignature` change | `motion.animate` interpolates `SeriesPathPoint[]` → `setAnimatedPoints` (`use-animated-series-path.ts:111-128`); reads `renderData` per frame to track moving target | Every rAF during `durationMs` |
| `useHighlightSegment` | `tooltipData`/`selection` change | `useSpring` (`highlightSpring` from `ChartConfig`) set/jump on bounds (`use-highlight-segment.ts:45-58`) → drives `HighlightSegment` clip+stroke | Spring physics ticks (rAF) until settled |
| `useGridShimmer` | `shimmer && isLoadingChromePhase` | `motion` gradientTransform animation | Continuous while loading |
| `SeriesHoverDim` | `tooltipData` or `legendHoveredIndex` change | `motion.g animate={{opacity}}` (`series-hover-dim.tsx:47`) — `durationSec=0.4` | One transition per hover enter/leave |

### Cost notes

- `useAnimatedYDomains.onUpdate` allocates a new `Record<string,YDomain>` + nested arrays per frame (`use-animated-y-domains.ts:92-104`) and calls `setAnimatedByAxis` — triggers `TimeSeriesChartCore` re-render each frame (yScales + context update). Bounded by tween duration (default 500 ms).
- `useAnimatedSeriesPath.onUpdate` recomputes `computeSeriesPathPoints(renderData,…)` per frame (`use-animated-series-path.ts:115-122`) — O(decimated length) per tick; only active when `Line` enables `useDataTransitionPath` (`line.tsx:245`).
- Stable consumers (`Grid`, `YAxis`) are `useChartStable` — they do receive y-domain animation updates (yScales change) but skip hover-only updates. Hover leaves (`SeriesHighlightLayer` etc.) are intentionally small subtrees to bound re-render scope.

## Dependency sketch

```
ParentSize width/height ─┬─► innerWidth/Height ─┬─► xScale, yScales, columnWidth, renderData
                         │                      └─► Grid, Axes (via useChartStable)
                         └─► chartPhase (via orchestrator) ──► ChartRevealClip, y-domain tween

tooltipData (useChartInteraction + rAF) ──► ChartHoverContext ──► ChartTooltip, HighlightSegment,
                                                                  SeriesHoverDim, SeriesMarkers
```
