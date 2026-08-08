# 03 — Hook & Update Flows

## React hook surface (thin)

| Hook / state | Where | Role |
|--------------|-------|------|
| `React.useMemo(() => createSvgChartRenderer(renderSvg), [renderSvg])` | `packages/react-charts/src/Chart.tsx:47` | Renderer identity — recreating triggers `surface.renderer !== options.renderer` branch → `surface.destroy()` + `container.replaceChildren()` (`packages/charts-core/src/renderer.ts:107`) |
| `React.useRef(adapter)` | `packages/react-charts/src/RendererChart.tsx:87` | Adapter singleton (`??= createChartRendererAdapter`) survives re-renders |
| `React.useRef(initialMarkupRef)` | `packages/react-charts/src/RendererChart.tsx:147` | SSR string captured once (`??= adapter.prerender()`) |
| `React.useLayoutEffect mount` | `packages/react-charts/src/RendererChart.tsx:150` | `adapter.update(hostOptions); adapter.mount(container); return destroy` |
| `React.useLayoutEffect update` | `packages/react-charts/src/RendererChart.tsx:156` | `adapter.update(hostOptions)` on every `hostOptions` change (no deps array beyond `adapter, hostOptions`) |
| `React.useState(tooltipBodyTarget)` + `createPortal` | `packages/react-charts/src/RendererChart.tsx:96,162` | Only React state in charts — custom tooltip body; updated via `handleTooltipBodyChange` callback (`renderer.ts:379`) |
| `React.useId()` | `packages/react-charts/src/RendererChart.tsx:84` | Stable `idPrefix` for `data-ts-key` disambiguation |

No `useChart*` context split — TanStack isolates reactivity differently (imperative focus, see below).

## Definition change → update → render

`mountChartRenderer.update(nextOptions)` (`packages/charts-core/src/renderer.ts:285`) diffs then optionally renders:

| Diff | Vars compared | Triggers `render()`? |
|------|---------------|----------------------|
| `definitionChanged` | `options.definition !== nextOptions.definition` (referential) | Yes |
| `sizeChanged` | `height/aspectRatio/width/initialWidth` | Yes |
| `layoutChanged` | `idPrefix/renderer/measureText/fontChanged` | Yes (`reason='layout'`) |
| aria/class/tabIndex | `ariaLabel/description/className/tabIndex/idPrefix/renderer/measureText` | Yes |
| `fontChanged` | `domText.refresh()` when `measureText===undefined` (`renderer.ts:287`) | Yes |

`render(refreshText, reason)` (`renderer.ts:90`):

```
scene = createScene()                         // runtime.render(definition, size)
if (!surface) surface=renderer.mount(...)
else if (renderer changed) destroy+replace
surface.render(scene, {ariaLabel,…, animation: hasRendered ? resolveAnimation(animate, container, reason) : undefined})
hasRendered=true
spatialIndex = definition.spatialIndex?.(scene.points)
restoreFocusedPoint → paintFocus + callbacks
onRender?.({container, scene, surface})
```

`resolveAnimation` (`renderer.ts:566`) returns `undefined` (no animation) when:

- `animate` falsy, or `reason==='layout'`, or `reason==='resize' && !animate.resize`, or `prefers-reduced-motion` and `respectReducedMotion!==false`.

When animation present, `reconcileChartSvg` collects `AttributeTween`s and rAF-interpolates numeric substrings (`packages/charts-core/src/reconcile.ts:150`).

If `needsRender===false` but `focusedPoint` exists, still repaints focus/tooltip with new scene coords (`renderer.ts:323`).

## Resize flow

```
ResizeObserver callback (renderer.ts:194)
  │ width = currentWidth(); if width===undefined || width===scene.width → no-op
  └─► scheduleRender(false, 'resize')
        │ coalesces to one rAF (renderer.ts:214)
        └─► render(true, 'resize')   // refreshText=true → domText.refresh()
              │ createScene() with new width→new scene.width
              │ surface.render(scene, {animation: resolveAnimation(...)}) // resize anim only if animate.resize===true
              └─► reconcileChartSvg(container, markup, animation)
```

- Observer only when `options.width===undefined` (`renderer.ts:192`); `width` prop disables it.
- Sync fallback if `requestAnimationFrame` absent (`renderer.ts:215`).
- `forceScheduledRender` flag for font/theme changes (`renderer.ts:211,241`).
- `scheduledRenderReason` coalesces: `layout` wins over `resize` (`renderer.ts:212`).

## Font & theme invalidation

| Trigger | Path | Line |
|---------|------|------|
| `document.fonts loadingdone` | `handleFontLoad → domText.invalidate() → scheduleRender(true)` | `renderer.ts:237` |
| `measureText` identity change or font style diff | `domText.refresh()` returns `true` → `needsRender` | `renderer.ts:287` |
| Canvas theme (prefers-color-scheme / forced-colors / resize) | `matchMedia change → requestRender(true)` | `packages/charts-core/src/canvas.ts:70` |
| Canvas DOM mutation | `MutationObserver on [class,style,data-theme]` ancestors | `packages/charts-core/src/canvas.ts:615` |

`DomTextMeasurer` (`packages/charts-core/src/dom-text.ts:10`) caches `measureText` per `fontSignature+fontSize+weight+anchor+baseline+text`; `refresh()` recomputes signature from `getComputedStyle(container)` and clears cache only when changed (`dom-text.ts:33`).

## Focus/hover is NOT a React update

| Path | Mechanism | React involved? |
|------|-----------|-----------------|
| `pointermove → pointsAtPointer → resolvePointerFocus → updateFocus` | `setAttribute` on `[data-ts-chart-focus]` (`packages/charts-core/src/svg-surface.ts:62`) + `textContent`/`replaceChildren` on tooltip div (`renderer.ts:511`) | No |
| `paintTooltip` DOM writes | `createTooltip` div reused; `tooltip.textContent` or `tooltip.replaceChildren(...rows)` (`renderer.ts:614,677`) | No |
| Custom tooltip body | `handleTooltipBodyChange(target) → setTooltipBodyTarget` (`RendererChart.tsx:99`) → `createPortal(renderTooltipBody({...}), target.element)` (`RendererChart.tsx:162`) | **Yes** — the only React state path for interactivity |
| `onFocusChange` / `onFocusGroupChange` / `onSelect` | Callbacks invoked from `updateFocus`/`handleClick`/`handleKeyDown` (`renderer.ts:264,303`) | Consumer may setState, but chart does not |

Contrast: canvas `paintFocus` clears and redraws focus canvas (`packages/charts-core/src/canvas.ts:131`) — also imperative, `requestRender(true)` only for theme.

## `onChange` / selection flow

- `onSelect(point)` fires on `click` after `pointsAtPointer` (`renderer.ts:307`) and on `Enter`/`Space` when focused (`renderer.ts:340`).
- `onFocusChange(point)` / `onFocusGroupChange(points)` fire from `updateFocus` when identity changes (`renderer.ts:264`).
- All are optional; no internal state machine beyond `focusedPoint`/`pinnedKey`/`pointerPosition` locals.

## Dependency sketch

```
props.definition ─┬─► referential !== ──► render() ──► runtime.render → new scene → reconcile
                  └─► same ref keeps focusedPoint via restoreFocusedPoint (key+datum+markId)

container width ──► ResizeObserver ──► scheduleRender(rAF) ──► createScene(new width) ──► reconcile
                                    └─► refreshText → domText.refresh → new label bounds

font load ──► invalidate + scheduleRender(true, layout)

pointer ──► pointsAtPointer ──► updateFocus ──► paintFocus (imperative) + callbacks
          └─► NOT through React state (except custom tooltip portal)
```
