# TanStack Charts Native Stack — TL;DR

> Scope: `repos/tanstack-charts` (`packages/charts-core`, `packages/react-charts`). All paths relative to `repos/tanstack-charts`.

| Aspect | Summary |
|--------|---------|
| **Entry** | `defineChart(spec)` (`packages/charts-core/src/scene.ts:88`) → `Chart` (`packages/react-charts/src/Chart.tsx:42`) → `RendererChart` (`packages/react-charts/src/RendererChart.tsx:54`) → `createChartRendererAdapter` (`packages/charts-core/src/adapter-renderer.ts:14`) → `mountChartRenderer` (`packages/charts-core/src/renderer.ts:34`) |
| **Sizing gate** | `initialWidth=640` fallback; live `width = width ?? container.getBoundingClientRect().width` (`packages/charts-core/src/renderer.ts:184`); `height = height ?? width/aspectRatio ?? 320` (`packages/charts-core/src/renderer.ts:353`); `ResizeObserver` on host when `width` undefined (`packages/charts-core/src/renderer.ts:190`) |
| **Lifecycle** | `prerender() → markup string` (SSR/isomorphic) then `mount(container)` then `update(nextOptions)` (`packages/charts-core/src/adapter-renderer.ts:27,42,47`); `destroy()` tears down observer+rAF+surface+runtime |
| **Render target** | `div.ts-chart-host` (`packages/react-charts/src/RendererChart.tsx:177`) → `div.ts-chart-surface dangerouslySetInnerHTML={{__html: markup}}` (`packages/react-charts/src/RendererChart.tsx:29`) → `<svg class="ts-chart" viewBox>` (`packages/charts-core/src/svg-renderer.ts:24`) |
| **SVG pipeline** | `scene → renderChartSvgWithHooks → string → reconcileChartSvg keyed diff → DOM` (`packages/charts-core/src/svg-renderer.ts:17`, `packages/charts-core/src/reconcile.ts:20`) |
| **Scene** | `createChartRuntime().render(definition,size,layout)` (`packages/charts-core/src/runtime.ts:14`) → `createChartScene` layout+scales+marks+grid+axes (`packages/charts-core/src/scene.ts:102`) |
| **Updates** | Definition/size/layout diff → `render()` → `surface.render(scene)` → reconcile (`packages/charts-core/src/renderer.ts:90,307`); resize via `ResizeObserver → requestAnimationFrame → render(true)` (`packages/charts-core/src/renderer.ts:196`) |
| **Interactivity** | Imperative: `pointermove → pointsAtPointer → resolvePointerFocus → updateFocus → paintFocus` (`svg-surface.ts:52` sets `cx/cy`) + `paintTooltip` (`textContent`/`replaceChildren`) — no React state (`packages/charts-core/src/renderer.ts:270,403`); React state only for custom `renderTooltipBody` portal |
| **Animation** | `reconcileChartSvg(..., animation)` number-interpolated attribute tweens via rAF (`packages/charts-core/src/reconcile.ts:157`), or Canvas cross-fade (`packages/charts-core/src/canvas.ts:283`) |
| **Stack** | React 19 adapter thin; core framework-neutral (`charts-core`); `d3-scale`/`d3-array`/`d3-shape`/`d3-geo`; Canvas `measureText`; no `visx`/`motion` |

## File Map

```
repos/tanstack-charts/
├── packages/charts-core/src/
│   ├── scene.ts              # defineChart, createChartScene, layout, grid/axes
│   ├── runtime.ts            # createChartRuntime — definition → scene
│   ├── types.ts              # ChartDefinition, ChartScene, ChartPoint, scale types
│   ├── renderer.ts           # mountChartRenderer — host, ResizeObserver, focus/tooltip
│   ├── adapter.ts / adapter-renderer.ts / adapter-shared.ts
│   ├── svg-renderer.ts       # renderChartSvgWithHooks — scene → SVG string
│   ├── svg-surface.ts        # createSvgChartRenderer — string → DOM, paintFocus
│   ├── reconcile.ts          # reconcileChartSvg — keyed DOM diff + animation tweens
│   ├── dom.ts / dom-text.ts  # DOM host + Canvas measureText cache
│   ├── canvas.ts             # createCanvasChartRenderer — Canvas2D alternative
│   ├── focus.ts / nearest.ts # focus presets, Euclidean nearest
│   └── marks/* (bar, line, dot, rect, area, tick, …)
└── packages/react-charts/src/
    ├── Chart.tsx             # <Chart> — memo renderer, wraps RendererChart
    └── RendererChart.tsx     # <RendererChart> — adapter lifecycle, ChartSurface, tooltip portal
```

## Index

| File | Covers | Cross-ref |
|------|--------|-----------|
| `01-load.md` | Entry, adapter, mount, prerender vs mount vs update, data injection, sizing | → 02 render pipeline, → 03 update diff |
| `02-render.md` | DOM target, SVG string production, keyed reconcile, scene→string→DOM, memo surface | → 01 load for mount, → 03 for updates |
| `03-hooks-and-updates.md` | Definition change → update → render; resize rAF; imperative focus vs React state | → 04 focus/tooltip detail |
| `04-interactivity.md` | Pointer, focus strategies, keyboard, tooltip placement, brush/zoom | → 03 for non-React path contrast |
| `05-stack.md` | Dependencies table with versions/roles/usage sites | → 01/02 for where each lib is used |
