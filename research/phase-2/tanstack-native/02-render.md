# 02 — Render Target & Method

## DOM target

| Layer | Element | File |
|-------|---------|------|
| Host | `<div class="ts-chart-host" style="position:relative;width:100% or width;height or aspectRatio">` | `packages/react-charts/src/RendererChart.tsx:178` |
| Surface | `<div ref={containerRef} class="ts-chart-surface" style="width:100%;height:100%" dangerouslySetInnerHTML={{__html: markup}}>` | `packages/react-charts/src/RendererChart.tsx:29,191` |
| SVG | `<svg class="ts-chart …" width="100%" height="100%" viewBox="0 0 W H" role="img" aria-label>` | `packages/charts-core/src/svg-renderer.ts:24` |
| Focus ring | `<circle data-ts-chart-focus visibility="hidden" r="5" pointer-events="none">` inside SVG | `packages/charts-core/src/svg-renderer.ts:24` (trailing) |
| Tooltip | `<div class="ts-chart-tooltip" hidden>` appended to container or portal host | `packages/charts-core/src/renderer.ts:511,572` |

Host `container` is the `ChartSurface` div; `renderer.mount` queries `svg.ts-chart` inside it (`packages/charts-core/src/svg-surface.ts:18`). Canvas variant renders `<div.ts-chart-canvas><canvas><canvas>` instead (`packages/charts-core/src/canvas.ts:178`).

## How SVG string is produced

`renderChartSvg(scene, options)` (`packages/charts-core/src/svg.ts:5`) delegates to `renderChartSvgWithHooks` (`packages/charts-core/src/svg-renderer.ts:17`):

```
scene + RenderChartSvgOptions → string
  className: "ts-chart" + options.className
  <desc> if ariaDescription
  renderDefinitions? (gradients, clipPaths via hooks)
  background rect if theme.background !== "transparent"
  scene.nodes.map(renderNode)  // group/rule/polyline/area/dot/rect/label
  trailing <circle data-ts-chart-focus>
```

| Node `kind` | SVG output | File |
|-------------|------------|------|
| `group` | `<g data-ts-key … transform="translate">…children</g>` | `svg-renderer.ts:37` |
| `rule` | `<line x1 y1 x2 y2>` | `svg-renderer.ts:47` |
| `polyline` | `<path d="M…L…" vector-effect="non-scaling-stroke">` | `svg-renderer.ts:48` |
| `area` | `<path d="M…L…Z" …>` | `svg-renderer.ts:58` |
| `dot` | `<circle cx cy r>` | `svg-renderer.ts:70` |
| `rect` | `<rect x y width height rx?>` | `svg-renderer.ts:72` |
| `label` | `<text x y text-anchor dominant-baseline rotate font-size>` | `svg-renderer.ts:74` |

Common attrs: `data-ts-key` (stable identity), `class`, `aria-hidden`, style attrs (`fill`, `stroke`, etc. via `renderStyle` → `paint` resolver) (`svg-renderer.ts:91,115`).

Scene construction: `createChartScene` (`packages/charts-core/src/scene.ts:102`) resolves scales (`resolveScale` via `resolveSuppliedScale` → `resolveConfiguredScale`), `createColorScale`, grid (`createGrid` — `y` always, `x` if `guide`), axes (`createAxes` — labels measured via `measureText`), then per-mark `mark.render({markIndex,chart,scales,theme,color,layout})` → `nodes` + `points` (`scene.ts:163`).

## Scene → string → DOM pipeline

```
runtime.render(definition,size,layout)  // scene.ts:102
  │ scales, colors, gradients, nodes, points, chart bounds
  ▼
renderChartSvg(scene, {ariaLabel,…})    // svg-renderer.ts:17
  │ string: `<svg …>…nodes…<circle focus></svg>`
  ▼
reconcileChartSvg(container, markup, animation?)  // reconcile.ts:20 + svg-surface.ts:35
  │ template.innerHTML=markup → nextRoot
  │ if no currentRoot or tag/NS mismatch → replaceChildren
  │ else reconcileElement: keyed diff by data-ts-key
  ▼
live DOM (<svg> children updated in place)
```

`mountChartRenderer.render` (`packages/charts-core/src/renderer.ts:90`) drives the pipeline:

```ts
scene = createScene()                          // runtime.render
if (!surface) surface = options.renderer.mount(container, scheduleRender)
surface.render(scene, {ariaLabel,…, animation: hasRendered ? resolveAnimation(...) : undefined})
```

`hasRendered` gates animation — first mount never animates (`renderer.ts:117`).

### `ChartSurface` (SVG) (`packages/charts-core/src/svg-surface.ts:17`)

```ts
createSvgChartRenderer(renderSvg): ChartRenderer = {
  prerender: renderSvg,                         // string only
  mount(container): ChartSurface {
    surface.render = (scene, opts) => {
      cancelAnimation = reconcileChartSvg(container, renderSvg(scene, opts), opts.animation)
    }
    surface.clientToScene = (scene, cx, cy) => bounds math
    surface.paintFocus    = (point) => setAttribute(cx/cy/stroke/visibility) on [data-ts-chart-focus]
  }
}
```

`svgElement()` queries `svg.ts-chart` (`svg-surface.ts:18`); `clientToScene` maps `clientX/Y` → scene coords via `getBoundingClientRect` ratio (`svg-surface.ts:56`).

## `reconcileChartSvg` — keyed diff (`packages/charts-core/src/reconcile.ts:20`)

| Step | Detail | Line |
|------|--------|------|
| Parse | `template.innerHTML = markup; nextRoot = template.content.firstElementChild` | `reconcile.ts:25` |
| Fast path | No `currentRoot` or NS/tag mismatch → `container.replaceChildren(nextRoot)` | `reconcile.ts:29` |
| Key index | `identities(children)` → `key:data-ts-key` else `key:chart-focus` else `tag:localName:count` (`reconcile.ts:190`) | `reconcile.ts:114` |
| Reorder | `current.insertBefore(matched, cursor)` preserves DOM nodes | `reconcile.ts:64` |
| Insert | `cloneNode(true)` for new nodes; `addEnterTween` sets `opacity 0→target` | `reconcile.ts:69,136` |
| Remove | `addExitTween` animates `opacity →0` then `remove()` else immediate `remove()` | `reconcile.ts:78,145` |
| Attr sync | `syncAttributes` — removes stale, sets new; if `animation` collects `AttributeTween` for interpolated attrs (`cx,cy,d,fill-opacity,height,opacity,r,rx,stroke-…,transform,width,x,x1,x2,y,y1,y2`) (`reconcile.ts:14`) | `reconcile.ts:84` |
| Animation | `runTweens` rAF loop `duration` (default 240ms) with `ease-out` cubic; `formatNumber` rounds `×1000` (`reconcile.ts:157,227`) | `reconcile.ts:150` |

Identity rule: `data-ts-key` is the primary key (`reconcile.ts:191`). Without it, per-tag positional count (`tag:rect:2`) — order-sensitive fallback.

## Memo-forever `ChartSurface` (React)

```tsx
// packages/react-charts/src/RendererChart.tsx:20
const ChartSurface = React.memo(React.forwardRef(..., ({markup}, ref) =>
  <div ref={ref} className="ts-chart-surface" dangerouslySetInnerHTML={{__html: markup}} />
), () => true)
```

Comparator `() => true` — never re-renders via React props. DOM mutations happen exclusively through `reconcileChartSvg` imperative path, not React reconciliation (`RendererChart.tsx:20`). `initialMarkupRef` is written once (`RendererChart.tsx:148`).

## Canvas alternative

`createCanvasChartRenderer` (`packages/charts-core/src/canvas.ts:43`) uses `<canvas>` pair (`scene` + `focus` layers) (`canvas.ts:61`). `paintCanvas` walks `scene.nodes` via `paintNodes`/`paintNode` (`canvas.ts:345`) — immediate-mode `fill`/`stroke` with `CanvasPaintResolver` probing computed CSS colors (`canvas.ts:565`). Animation is cross-fade (`animateScene` double-buffer `drawImage` with alpha) (`canvas.ts:283`).

## Client-only constraints

- `template`, `getComputedStyle`, `ResizeObserver`, `requestAnimationFrame`, `document.fonts` all require browser DOM.
- `domText.measureText` creates `<canvas>.getContext('2d')` probe (`packages/charts-core/src/dom-text.ts:12`).
- Portals/tooltips use `ownerDocument` APIs.
- No viewBox-independent rendering — `viewBox="0 0 W H"` (`svg-renderer.ts:24`) maps 1:1 to `scene.width/height`.
