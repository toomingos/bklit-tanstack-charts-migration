# 04 — Interactivity Flows

## Pointer pipeline

Imperative path — no React state except optional custom tooltip portal (`→ 03`).

```
pointermove on container                 // renderer.ts:431 addEventListener
  │ if pinnedKey → return (sticky lock) // renderer.ts:276
  ▼
pointsAtPointer(clientX, clientY)       // renderer.ts:270
  │ surface.clientToScene(scene,cx,cy)  // svg-surface.ts:56: bounds ratio
  │ pointerPosition = position          // renderer.ts:272
  │ maxDistance = definition.maxFocusDistance ?? 48
  ▼
resolvePointerFocus(x,y,maxDistance)    // renderer.ts:369
  │ if focus strategy → focus.resolve(points,x,y,maxDistance)
  │ else spatialIndex?.findNearest(x,y) else findNearestPoint(scene,x,y) // nearest.ts:9 (Euclidean)
  ▼
updateFocus(points, forcePaint)         // renderer.ts:253
  │ samePointIdentity? → no-op (unless forcePaint) // renderer.ts:411
  │ focusedPoint = points[0] ?? null
  │ paintFocus(point, points)           // svg-surface.ts:62 + renderer paintTooltip
  │ onFocusChange(point); onFocusGroupChange(points)
```

Other listeners on `container` (`renderer.ts:431`):

| Event | Handler | Effect |
|-------|---------|--------|
| `pointermove` | `handlePointerMove` | Above pipeline; `forcePaint` when `tooltip anchor==='pointer'` or native popover closed (`renderer.ts:284`) |
| `pointercancel` / `mouseleave` | `clearTransientFocus` | If `!pinnedKey && !relatedTarget in container` → `pointerPosition=null; updateFocus([])` (`renderer.ts:286`) |
| `click` | `handleClick` | `pointsAtPointer`; sticky toggle `pinnedKey = pinnedKey?null:point.key`; `updateFocus(points, pinChanged)`; `onSelect(point)` (`renderer.ts:295`) |
| `keydown` | `handleKeyDown` | `Escape` dismisses pin; `Enter/Space` toggles pin + `onSelect`; arrows/Home/End navigate points (`renderer.ts:318`) |
| `focusin` | `handleFocus` | If `svg` focused and `!focusedPoint` → focus first navigation point (`renderer.ts:364`) |
| `focusout` | `clearTransientFocus` | Same as mouseleave |

## Focus strategies

`resolveFocusStrategy(definition.focus)` (`renderer.ts:560`):

| `focus` value | Strategy | Resolve behavior |
|---------------|----------|------------------|
| `undefined` / `'nearest'` | Eucldiean `nearestPoint` (`packages/charts-core/src/nearest.ts:9`) | `least(points, dx²+dy²)`, gated by `maxDistance` |
| `'nearest-x'` | `focusNearestX` (`packages/charts-core/src/focus.ts:8`) | Nearest in `x` within `maxDistance`, tie-break by `y` |
| `'nearest-y'` | `focusNearestY` | Nearest in `y` |
| `'group-x'` | `focusX` | Nearest in `x`, then `groupPoints` — collects one point per `group` sharing same `xValue`, sorted by `y` (`focus.ts:85`) |
| `'group-y'` | `focusY` | Same transposed |
| Custom `{resolve,group,navigation}` | `ChartFocusStrategy` | Consumer-provided (`packages/charts-core/src/types.ts:680`) |
| `spatialIndex` factory | `definition.spatialIndex?.(scene.points)` (`renderer.ts:133`) | Pre-built index with `findNearest(x,y,maxDistance)` (`types.ts:720`); takes precedence over `nearestPoint` when no `focus` strategy (`renderer.ts:377`) |

`maxFocusDistance` default `48` scene units (`renderer.ts:272`); check `distance < maxDistance` strictly (`focus.ts:22`).

Grouped strategies (`focusX`/`focusY` with `grouped=true`) return `candidates` — all groups at the resolved x/y — so tooltip can show multi-series rows.

## `paintFocus` + `paintTooltip`

```ts
// renderer.ts:260,403
paintFocus(point, points) {
  surface.paintFocus(point, points)   // svg-surface.ts:62: cx/cy/stroke/visibility
  paintTooltip(point, points)         // renderer.ts:403
}
```

`paintSvgFocus` (`packages/charts-core/src/svg-surface.ts:60`) — sets `cx/cy/stroke` on `[data-ts-chart-focus]` circle, `visibility hidden` when `null`.

`paintTooltip` (`renderer.ts:403`) — early exit if `!definition.tooltip || !point` → hide. Otherwise:

| Step | Detail |
|------|--------|
| Create | `createTooltip(document)` — `div.ts-chart-tooltip` `role=status aria-live=polite` with inline card styles (`renderer.ts:511`) |
| Content | `tooltip.formatGroup / format / defaultTooltipContent` → `ChartTooltipContent \| string` (`renderer.ts:501`); `defaultTooltipContent` handles shared-x/y grouped cases, interval/range values (`renderer.ts:663`) |
| Body | If `onTooltipBodyChange` exists → `renderTooltipBody` mounts `div.ts-chart-tooltip__body` and calls callback with `{element,points,content,pinned,dismiss}` (`renderer.ts:484`); React portal renders into it (`RendererChart.tsx:162`) |
| Paint | `paintPlainTooltip(textContent=text)` vs `paintStructuredTooltip(replaceChildren title+rows)` (`renderer.ts:614,621`); `setTooltipContentAccessibility` sets `aria-label` from rows (`renderer.ts:680`) |
| Position | `resolveTooltipAnchor(point,points,scene,pointerPosition, tooltip.anchor)` → `placeTooltip(element, anchorX,Y, bounds, placement, offset)` (`renderer.ts:788,829`) |

Anchor options (`renderer.ts:835`): `'point'` (focused point), `'pointer'` (last `pointerPosition`), `'group-center'` (bbox center of `points`), or function `(points, {pointer,chart,width,height})`.

Sticky: `tooltip.sticky !== false` means click pins (`renderer.ts:643`); `pinned` toggles `pointerEvents auto` + `userSelect text` + `dataset.sticky` (`renderer.ts:471`).

## Tooltip placement & portal

| Mode | Bounds | Pipeline |
|------|--------|----------|
| Inline (default) | `scene` bounds `{0,0,width,height}` | `placeTooltip` clamps to `boundary+edge(8)` with `gap(10 or offset)`; tries `placement` list then falls back to min-overflow (`renderer.ts:855,868`) |
| `portal:true` | `viewportBounds(document)` via `visualViewport` (`renderer.ts:946`) | `configureTooltipParent` → if `showPopover` available → `popover=manual` + `position:fixed` (`renderer.ts:563`); else fallback `append to body, z-index 2147483647` (`renderer.ts:610`); `sceneToClient` maps scene→viewport rect (`renderer.ts:924`) |

Portal repositions on `scroll` (capture), `resize`, `visualViewport scroll/resize`, and `ResizeObserver` on container+tooltip (`renderer.ts:620`); throttled via `requestAnimationFrame` in `scheduleTooltipPosition` (`renderer.ts:245`).

Popover uses native `showPopover()/hidePopover()` + `:popover-open` check (`renderer.ts:671,693`).

## Keyboard / aria

| Feature | Impl | File |
|---------|------|------|
| Tab focus | `tabIndex = keyboard===false ? -1 : tabIndex??0` on `<svg>` (`renderer.ts:113,451`) | `svg-renderer.ts`, `renderer.ts` |
| `ariaLabel/Description` | `role=img aria-roledescription=chart aria-label` on `<svg>` | `svg-renderer.ts:24` |
| Arrow navigation | `resolveFocusStrategy(...).navigation(points)` or `pointFromSceneOrder` by `x→y` (`renderer.ts:456,577`) | `renderer.ts:326` |
| Home/End | First/last navigation point | `renderer.ts:480,584` |
| Enter/Space | `onSelect` + sticky pin toggle | `renderer.ts:333` |
| Escape | Dismiss pinned tooltip, or `hideTooltipBody` | `renderer.ts:329,394` |
| Focus ring | `[data-ts-chart-focus]` circle | `svg-renderer.ts:24`, `svg-surface.ts:60` |

## Brush / zoom

**No built-in brush/zoom.** TanStack Charts has no `chart-brush` equivalent; viewport control is via consumer-managed `definition` or `DynamicChartDefinition` reacting to external state. No `d3-brush`/`d3-zoom` imports in `charts-core` or `react-charts`. Zoom can be composed externally by swapping `definition` with filtered data or custom scales.

## Pointermove sequence sketch

```mermaid
sequenceDiagram
  participant U as User pointer
  participant C as container (host div)
  participant R as mountChartRenderer
  participant S as svg-surface
  participant F as focus strategy

  U->>C: pointermove {clientX,Y}
  C->>R: handlePointerMove
  R->>R: if pinnedKey → return
  R->>S: clientToScene(scene,cx,cy)
  S-->>R: {x,y} scene coords
  R->>F: resolvePointerFocus(x,y,48)
  alt focus preset
    F-->>R: groupX / nearestX …
  else default
    F-->>R: spatialIndex.findNearest or nearestPoint
  end
  R->>R: updateFocus(points)
  R->>S: paintFocus(point) — setAttribute cx/cy/stroke
  R->>R: paintTooltip(point,points) — textContent/replaceChildren
  R->>R: onFocusChange(point); onFocusGroupChange(points)
  U->>C: pointerleave
  C->>R: clearTransientFocus → updateFocus([])
  R->>S: paintFocus(null) — visibility hidden
  R->>R: hideTooltipElement / hideTooltipBody
```
