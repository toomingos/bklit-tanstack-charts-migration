# 02 — Render Target & Method

## DOM target

| Layer | Element | File |
|-------|---------|------|
| Container | `<div class="relative w-full" ref={containerRef} style={{aspectRatio,touchAction:"none"}}>` | `line-chart.tsx:256`, `bar-chart.tsx:696`, `scatter-chart.tsx:165`, `candlestick-chart.tsx:393` |
| Measure | `ParentSize` / `useMeasure` child provides `{width,height}` | `line-chart.tsx:265`, `bar-chart.tsx:701`, `scatter-chart.tsx:154` |
| SVG | `<svg aria-hidden height width>` (no viewBox; explicit pixel size) | `time-series-chart-shell.tsx:650`, `bar-chart.tsx:625`, `candlestick-chart.tsx:336` |
| Inner group | `<g transform="translate(margin.left,margin.top)" {...interactionHandlers}>` | `time-series-chart-shell.tsx:672`, `bar-chart.tsx:637` |
| Hit rect | `<rect fill="transparent" width={innerWidth} height={innerHeight}>` | `time-series-chart-shell.tsx:677`, `bar-chart.tsx:644` |
| Axes/tooltip | `createPortal(..., container)` — absolute `div` overlays inside container | `x-axis.tsx:646`, `y-axis.tsx:132`, `tooltip/chart-tooltip.tsx:356` |

`width/height` come from measurement, not props. `innerWidth = width - margin.left - margin.right` (`time-series-chart-shell.tsx:212`, `bar-chart.tsx:208`); same for `innerHeight`. Margins default `{40,40,40,40}` (`line-chart.tsx:68`, `bar-chart.tsx:100`).

## How SVG is produced

| Primitive | Source | File |
|-----------|--------|------|
| Scales | `@visx/scale` `scaleTime` / `scaleLinear` / `scaleBand` | `time-series-chart-shell.tsx:283,386`, `bar-chart.tsx:236,283`, `y-axis-scales.ts:1` |
| Grid | `@visx/grid` `GridRows` / `GridColumns` (+ manual highlight rows) | `grid.tsx:249,299` |
| Lines/Areas | `@visx/shape` `LinePath` / `AreaClosed` with d3 `curve*` | `line.tsx:135`, `area.tsx:250` |
| Bars/candles | Raw `<rect>` JSX; scatter via `SeriesMarkers` circles | `bar.tsx:424`, `candlestick.tsx:148`, `series-markers.tsx` |
| Animation | `motion/react` `motion.rect` / `motion.g` / `motion.linearGradient` | `chart-reveal-clip.tsx:65,80`, `grid.tsx:205`, `bar.tsx:135` |

Series coverage `→ 03` for animation hooks.

### Per-datum fan-out

```
renderData (decimated)  ──►  LinePath / AreaClosed  (one path per series; xScale+yScale per datum)
data (full)             ──►  Bar                    (data.map → <rect> per row × series)
                        ──►  Candlestick           (renderData.map → 2 rects + wick per candle)
                        ──►  Scatter / SeriesMarkers (data.map → <circle> per point)
```

| Chart | Fan-out | Key |
|-------|---------|-----|
| `Line`/`Area` | Single `<path d>` via `LinePath` iterating `renderData` (`line.tsx:135`, `area.tsx:250`) | Path string, not per-element |
| `Bar` | `data.map` → `<rect>` per datum (`bar.tsx:271`); grouped: `x = bandPos + seriesIndex*(barWidth+gap)` (`bar.tsx:338`); stacked: `y = offsetY - barHeight` (`bar.tsx:323`) | `bar-${dataKey}-${categoryValue}` (`bar.tsx:389`) |
| `Candlestick` | `renderData.map` → wick `<rect>` + body `<rect>` (+ pattern overlay) (`candlestick.tsx:132`) | `geometry.time` (`candlestick.tsx:210`) |
| `Scatter` | `SeriesMarkers` → `<circle>` per point with optional `yGradient` defs (`scatter.tsx:62`, `series-markers.tsx`) | Index-based |
| `Area` fill | `AreaClosed` with `yScale` baseline; pattern fills via `fill="url(#pattern)"` (`area.tsx:215`) | `area-gradient-${dataKey}-${useId}` (`area.tsx:208`) |

Decimation keeps path cost O(innerWidth): `maxRenderPointsForWidth = max(64, ceil(innerWidth*1.5))` (`decimate-time-series.ts:89`). `CandlestickChart` uses OHLC-aware `decimateOhlcData` preserving high/low extremes (`decimate-time-series.ts:93-139`).

### Margins / tick layout

| Axis | Layout | File |
|------|--------|------|
| `XAxis` | HTML overlay `createPortal` → absolute `div` per tick `left:x` (`x-axis.tsx:67`), ticks via `selectEvenlySpacedIndices` maximizing even `xScale` spacing (`x-axis.tsx:315`). Supports `tickMode="data"` vs `"domain"` (`x-axis.tsx:17`) + projection-tail extras (`x-axis.tsx:495`). | `x-axis.tsx:384-628` |
| `YAxis` | Portal overlay, `yScale.ticks(resolveYAxisTickCount(numTicks))` (`y-axis.tsx:107`), `top: yScale(value)+margin.top` (`y-axis.tsx:109`). Transition `top` on domain tween (`y-axis.tsx:149`). | `y-axis.tsx:92-166` |
| `Grid` | `@visx/grid` scaled to `innerWidth/innerHeight`; row tick values resolved similarly to YAxis (`grid.tsx:82`), fade masks via `linearGradient`+`mask` (`grid.tsx:181,224`), shimmer via `motion.linearGradient` (`grid.tsx:205`). | `grid.tsx:82-312` |

`x-axis.tsx:559-573` wraps in `XAxisInner` gated by `mounted && container`; `y-axis.tsx:77-91` same.

### Layer order & portal layers

Classification via `chart-child-passthrough.ts`:

| Predicate | Members | Clip behavior |
|-----------|---------|---------------|
| `isClipExcludedComponent` | `Background, Grid, XAxis, YAxis, BarXAxis, LiveXAxis` (`chart-child-passthrough.ts:54`) | Outside clip reveal; always visible |
| `isUnderlayComponent` | `ReferenceArea, BarColumnTrack` (`chart-child-passthrough.ts:65`) | Behind series, outside clip |
| (default) | `Line, Area, Bar, Candlestick, Scatter, SeriesBar` | Inside `<g clipPath="url(#chart-grow-clip)">` when `useClipReveal` (`time-series-chart-shell.tsx:687-691`) |
| `isPostOverlayComponent` | `ChartMarkers, MarkerGroup, ChartBrush` (`chart-child-passthrough.ts:68`) | After interaction rect; on top |

`TimeSeriesChartShell` renders (`time-series-chart-shell.tsx:650-692`):

```
<svg>
  <defs> {defsChildren} {ChartRevealClip?} </defs>
  <rect transparent full-size />
  <g translate(margin) {...interactionHandlers}>
    <rect hit-area />
    {clipExcludedChildren}   // Grid, axes
    {underlayChildren}       // ReferenceArea
    {clip ? <g clipPath> : <>}{preOverlayChildren}</>  // series
    {postOverlayChildren}    // ChartBrush, markers
  </g>
</svg>
+ portals: XAxis / YAxis / ChartTooltip / DateTicker (absolute divs in container)
```

`BarChart` same but adds loading skeleton branch: `status==="loading" ? <BarLoadingSkeleton> : preOverlayChildren` (`bar-chart.tsx:654-662`). `ChartRevealClip` details `→ 03`.

### Viewport adornments

| Feature | Impl | File |
|---------|------|------|
| Clip reveal | `<motion.rect animate={{width:paddedWidth}}>` keyed by `revealEpoch` (`chart-reveal-clip.tsx:80`), conceal variant animates `width→0, x→rightEdge` (`chart-reveal-clip.tsx:65`). Tween-only (`clipRevealTransition` `animation.ts:18`). | `chart-reveal-clip.tsx:30` |
| Edge fade | `fadeEdges` → `linearGradient` mask or stroke gradient (`line.tsx:319`, `area.tsx:300`, `fade-edges.ts`) | `line.tsx:319`, `area.tsx:300` |
| Dash tail | `SeriesDashTailOverlay` measures `pathD` via `usePathStrokeMetrics` → clipped dashed overlay from `dashFromIndex` | `line.tsx:354`, `area.tsx:272` |
| Loading skeleton (`sweep`) | `LineLoadingSweep` / `BarLoadingSkeleton` shimmer across skeleton path | `loading-sweep.tsx`, `bar-chart.tsx:655` |
| Brush overlays | `ChartBrushTrackOverlay` (blur+fade) + `ChartBrushSelectionOverlay` + `ChartBrushHandleOverlay` | `chart-brush.tsx:212-231` |

### Client-only constraints

- All chart modules `"use client"` — no SSR SVG output.
- `ParentSize`/`useMeasure` require `ResizeObserver` (exists only in browser).
- Portals require `containerRef.current` + `mounted` flag — return `null` during SSR/hydration mismatch window.
- `motion` animations require `requestAnimationFrame` + `window.setTimeout`.
- `isLoaded` (`time-series-chart-shell.tsx:406`) gates `useChartInteraction` → no handlers until reveal completes.
