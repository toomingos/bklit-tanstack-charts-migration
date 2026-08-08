# 04 — Interactivity Flows

## Pointer pipeline (time-series)

Core path is `useChartInteraction` (`use-chart-interaction.ts:54`) + `useScheduledTooltip` (`use-scheduled-tooltip.ts:29`) → `ChartHoverContext` (`chart-context.tsx:339`).

```
pointermove on <g translate(margin)>        // time-series-chart-shell.tsx:672
  │ localPoint(event).x - margin.left       // use-chart-interaction.ts:158,164
  ▼
xScale.invert(pixelX) → Date                // use-chart-interaction.ts:80
  │ bisector(xAccessor).left(data, date, 1) // use-chart-interaction.ts:81
  ▼
nearest d0/d1 comparison (time distance)    // use-chart-interaction.ts:91-97
  │ yPositions per lines[] via yScales[id]  // use-chart-interaction.ts:100-107
  ▼
TooltipData {point, index, x, yPositions, xPositions?}  // chart-context.tsx:70
  │ scheduleTooltip(tooltip)                // use-chart-interaction.ts:192
  ▼ (rAF deduped, key = `${index}:${round(x)}`) // use-scheduled-tooltip.ts:54-71
ChartHoverContext.setTooltipData            // chart-context.tsx:99,341
  ▼
hover consumers re-render                   // ChartTooltip, SeriesHighlightLayer, SeriesHoverDim
```

| Step | File | Detail |
|------|------|--------|
| Hit rect | `time-series-chart-shell.tsx:677` transparent `innerWidth×innerHeight` | Ensures events even over empty gaps |
| Coords | `localPoint(event)` from `@visx/event` minus `margin.left` | Scatter variant uses `localPointFromSvg(svg, clientX, clientY)` (`scatter-svg.ts`, `use-scatter-chart-interaction.ts:153`) for transformed containers |
| Scale invert | `xScale.invert(pixelX)` (`use-chart-interaction.ts:80`) where `xScale` is `scaleTime` (`time-series-chart-shell.tsx:297`) | Bar/candle invert differently (see below) |
| Bisect | `bisector((d)=>xAccessor(d)).left` (`time-series-chart-shell.tsx:268`) | Finds insertion index; tie-break by nearest time |
| yPositions | Loop `lines[]` → `yScales[normalizeYAxisId(yAxisId)] ?? yScale` → `axisScale(value)` (`use-chart-interaction.ts:104`) | Multi-axis aware (`y-axis-scales.ts:9`) |
| rAF gate | `useScheduledTooltip.scheduleTooltip` coalesces to one `requestAnimationFrame`; dedupes by `${index}:${round(x)}` (`use-scheduled-tooltip.ts:20,45,54`) | Second move in same frame ignored if raf pending (`use-scheduled-tooltip.ts:60`) |
| Clear | `onMouseLeave` → `clearTooltip()` cancels rAF + nulls state (`use-scheduled-tooltip.ts:75`, `use-chart-interaction.ts:198`) | Also clears `selection` + resets drag flag |

Touch: `handleTouchStart/Move` branch on `touches.length` (`use-chart-interaction.ts:228-308`); single finger → tooltip, two fingers → pinch `selection` (calls `resetTooltipDedupe` `233` then `setSelection` `252`). `preventDefault` + `touchAction:"none"` (`use-chart-interaction.ts:342`).

Re-anchor on zoom: `useEffect` watching `canInteract` + `resolveTooltipFromX` re-resolves `lastHoveredXRef` after `xScale` or `visiblePlotData` changes (`use-chart-interaction.ts:315-325`) — keeps crosshair pinned to same time after brush commit.

## Per-chart hit-testing variants

| Chart | Handler location | Pixel → index | yPositions source | Hover state key |
|-------|------------------|---------------|-------------------|-----------------|
| **Line/Area/Composed** | `useChartInteraction` (`time-series-chart-shell.tsx:408`) | `xScale.invert` + `bisector` (`use-chart-interaction.ts:80-97`) | `yScale(value)` per line | `tooltipData.index` → `SeriesHighlightLayer` highlight |
| **Bar** | Inline `handleMouseMove` (`bar-chart.tsx:393`) | `Math.floor((point.x-margin.left)/columnWidth)` clamped (`bar-chart.tsx:403-405`) | `valueScale`/`primaryYScale` + `squareSnap` via `topSquareCenterY` for shape variant (`bar-chart.tsx:486-493`) | `hoveredBarIndex = tooltipData.index` (`bar-chart.tsx:201`); opacity `isFaded = hoveredBarIndex!==i` (`bar.tsx:385`) |
| **Scatter** | `useScatterChartInteraction` (`use-scatter-chart-interaction.ts:47`) | Same `invert+bisector` but `localPointFromSvg` (`use-scatter-chart-interaction.ts:153`) | Same multi-axis lookup (`use-scatter-chart-interaction.ts:92-99`) | `tooltipData.index` |
| **Candlestick** | `useChartInteraction` w/ OHLC `lines=[{close}]` (`candlestick-chart.tsx:216`) | Same time-series path | Single `yScale` from low/high scan (`candlestick-chart.tsx:154`) | `hoveredCandleIndex = tooltipData.index` (`candlestick-chart.tsx:228`); dim via `geometryDimOpacity` comparing `time` (`candlestick.tsx:110`) |
| **Horizontal bar** | `bar-chart.tsx:416` branch | `point.y - margin.top` over `columnWidth` | `chartYScale` value + `barPos + index*(h+gap)+h/2` (`bar-chart.tsx:440-452`); tooltip `x = max(xPositions)` (`bar-chart.tsx:509`) | Same |

Bar/candle layouts expose `bandWidth`/`columnWidth` for downstream dot/indicator placement (`bar-chart.tsx:249,345`, `candlestick-chart.tsx:181`).

## Crosshair / highlight / dim

| Layer | Component | Trigger | File |
|-------|-----------|---------|------|
| Crosshair | `TooltipIndicator` (`tooltip/tooltip-indicator.tsx`) — vertical line at `x` with optional fade gradient + dash | `showCrosshair` + `visible` (`tooltip/chart-tooltip.tsx:258`) — spring `xSpring` (`use-highlight-segment` style) | `tooltip/chart-tooltip.tsx:258-283` |
| Highlight band | `SeriesHighlightLayer` → `HighlightSegment` re-strokes path clipped to `[x,width]` via `useHighlightSegment` springs | `enabled && isActive && isLoaded` (`series-highlight-layer.tsx:40`); bounds from `computeSegmentBounds` (`highlight-segment-bounds.ts`) | `series-highlight-layer.tsx:25`, `use-highlight-segment.ts:28` |
| Dim others | `SeriesHoverDim` wraps series in `<motion.g animate={{opacity}}>` | `tooltipData!==null \|\| selection.active` or `legendHoveredIndex!==seriesIndex` → `dimOpacity` (`series-hover-dim.tsx:39-50`) | `series-hover-dim.tsx:31`, used in `line.tsx:336`, `area.tsx:316`, `bar.tsx:385` |
| Tooltip dots | `TooltipDot` per `lines[]` at `(xPositions[key]??x, yPositions[key])` (`tooltip/chart-tooltip.tsx:296-311`) | `showDots && visible && !isHorizontal` | `tooltip/tooltip-dot.tsx` |
| Date ticker | `DateTicker` pill at `xWithMargin` with spring (`tooltip/chart-tooltip.tsx:344`) | `showDatePill && !isHorizontal` | `tooltip/date-ticker.tsx` |

`ChartTooltip` renders all overlay layers via `createPortal` into container (`tooltip/chart-tooltip.tsx:356`, `tooltip/tooltip-indicator.tsx`). `discreteInteraction = dateLabels.length>60` disables springs for dense charts (`tooltip/chart-tooltip.tsx:143`).

## Brush / zoom

`ChartBrush` wraps `@visx/brush` `Brush` (`chart-brush.tsx:233`):

```
user drag on brush strip (mini chart)
  │ @visx/brush onChange / onBrushEnd  // chart-brush.tsx:244
  ▼
Bounds {x0,x1} → boundsToSelection → {start:Date,end:Date}  // chart-brush.tsx:101,271
  │ onSelectionChange(domain)         // chart-brush.tsx:293
  ▼ (parent state)
LineChart xDomain prop                // line-chart.tsx:55
  │ TimeSeriesChartInner xScale domain = [xDomain0,xDomain1] // time-series-chart-shell.tsx:284
  │ visiblePlotData = filterDataByXDomain(plotData, xDomain) // time-series-chart-shell.tsx:272, filter-data-by-x-domain.ts
  │ yDomainTarget recomputed on visible slice // time-series-chart-shell.tsx:337
  └─► re-anchor tooltip via useEffect // use-chart-interaction.ts:315
```

| Prop | File |
|------|------|
| `ChartBrush` props | `chart-brush.tsx:55` (`onSelectionChange`, `brushDirection`, `initialSelection`, `selection`, `selectionPattern`) |
| Overlays | `ChartBrushTrackOverlay` (blur+fade outside selection), `ChartBrushSelectionOverlay` (pattern), `ChartBrushHandleOverlay` (`chart-brush.tsx:212-231`) |
| Guard | `if !isLoaded \|\| innerWidth<=0` return null (`chart-brush.tsx:317`) | 
| No internal zoom state | Brush is stateless — parent owns `xDomain`; `@visx/zoom` (`package.json:68`) is a dependency but not wired in these shells (available for consumer composition) |

Single-axis charts (bar/candle) use same `xDomain`/`xDomainSlotCount` pattern for slot padding (`bar-chart.tsx:??` via `columnWidth`, `candlestick-chart.tsx:137-152`).

## Pointermove sequence sketch

```mermaid
sequenceDiagram
  participant U as User (pointer)
  participant G as <g> hit rect
  participant I as useChartInteraction
  participant S as useScheduledTooltip
  participant C as ChartHoverContext
  participant T as ChartTooltip
  participant H as Highlight/Dim

  U->>G: pointermove
  G->>I: handleMouseMove(event)
  I->>I: localPoint - margin → chartX
  I->>I: xScale.invert → bisector → TooltipData
  I->>S: scheduleTooltip(data, key)
  S->>S: if key===last or raf pending → drop
  S-->>S: rAF commit → setTooltipData
  S->>C: setTooltipData(data)
  C->>T: tooltipData change → portal re-render
  C->>H: tooltipData change → highlight springs + dim opacity
  U->>G: pointerleave
  G->>I: handleMouseLeave → clearTooltip()
  I->>S: cancelAnimationFrame + null
  S->>C: setTooltipData(null)
  C->>T: visible=false; H: opacity→1
```

## Keyboard / focus

No keyboard navigation, focus traps, or `tabIndex` on chart SVG (`line.tsx`, `bar.tsx`, `candlestick.tsx` all render `<g>`/`<rect>` without `role`, `aria-*`, or key handlers). `aria-hidden="true"` on `<svg>` (`time-series-chart-shell.tsx:650`, `bar-chart.tsx:625`). Grep for `onKeyDown`/`onFocus`/`tabIndex` in `packages/ui/src/charts` returns no handlers — interactivity is pointer/touch only. Legend hover (`chart-legend-hover.tsx`, `bar.tsx:223`) is also pointer-only. Accessibility of data is via tooltip portal content, not chart chrome.

→ Load/lifecycle `01`, render layers `02`, hook update costs `03`, stack `05`.
