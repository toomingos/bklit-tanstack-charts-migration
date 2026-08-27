# B6/T19 — post-implementation capture

`@visx/zoom` replaced by the local port `showcase/migrated/charts/internal/zoom-engine.tsx`
(663 lines). All runs below executed by the lead, not reported by the implementing agent.

## Gates

| gate | n | result | vs reference |
|---|---|---|---|
| `choropleth` | 100 | **PASS** 0.0000 / 0.0000 / 0.1470 / 0.0000 | **bit-identical to BASELINE §1**, incl. three literal-zero cells |
| `choropleth-zoom` (D395) | 1000 | **PASS** reset 0.0000 · zoomed 0.0104 · panned 0.0028 | **bit-identical to the D395 baseline** — 5th such run, 1st with the local port on impl-B |

`npx tsc --noEmit` exit 0, no output.

## Manifest state (D392 constraint)

`git diff -- showcase/package.json showcase/pnpm-lock.yaml | grep -i visx` on added/removed
lines is **empty**; `package.json` has **zero removed lines**. `@visx` declaration counts
unchanged at 14 / 14 / 8. The only manifest addition is `"@use-gesture/react": "10.3.1"`,
promoted from a transitive dep of `@visx/zoom` to a direct `showcase` dependency so the port
does not rely on pnpm hoisting.

## Source-fidelity verification (the part no gate covers)

The gate drives `setTransformMatrix`/`reset` only (see D397), so **wheel, pinch and drag are
unmeasured**. Those were verified by direct comparison against `showcase/node_modules/@visx/zoom/lib/`:

- **`util/matrix.js` — all 9 helpers line-for-line identical**, including operand order in
  `multiplyMatrices` and `inverseMatrix` (so results are bit-identical in floating point, not
  merely algebraically equal) and the `composeMatrices` recursion with its 0-arg throw.
- **The `Zoom` component body is line-for-line identical**, including: every `useCallback`
  dependency array (these govern identity churn and therefore re-render behaviour); the
  `matrixStateRef` vs `transformMatrix` split with its original comment ("wheel listener does not
  have access to latest state"); the `isDragging` re-anchoring inside `scale()`; and `dragMove`'s
  `if (options?.offsetX) translateX += options?.offsetX ?? 0` double-optional quirk.
- **The `useGesture` binding is verbatim** — `target: containerRef`, `eventOptions: {passive:false}`,
  `drag: {filterTaps:true}`, the `onDrag` `pinching → cancel(); dragEnd()` branch, the
  `event instanceof KeyboardEvent` exclusions, and the `onWheel` early return on
  `pinching || !active` with its two explanatory comments preserved.
- **`handlePinch` keeps its `UserHandlers["onPinch"]` type** and the `memo`-cached
  `getBoundingClientRect` so the surface is byte-identical, not merely compatible.
- **All 19 methods + 3 state fields are present in the same declaration order** in the returned
  object literal.

## Two disclosed deviations, both verified harmless

1. **`localPoint` inlined from `@visx/event`.** `Zoom.js` imports it; leaving it would have kept an
   `@visx/*` import and missed the DoD. The port reproduces all 7 type guards,
   `getXAndYFromEvent`'s three branches (touch / mouse / focus-fallback-to-element-centre), the
   `createSVGPoint` + `matrixTransform(screenCTM.inverse())` path and the bounding-box fallback
   with `clientLeft`/`clientTop`. It returns a plain `{x, y}` rather than the `@visx/point` `Point`
   class. **Verified safe:** all three call sites (`dragStart`, `dragMove`, `handleWheel`) read only
   `.x`/`.y`; nothing calls `.value()`/`.toArray()`.
2. **The combined type alias is named `ZoomInstance<E>`, not `Zoom<E>`,** to avoid a same-file
   collision with the `Zoom` component value. **Verified safe:** nothing under `migrated/**` or
   `bench/app/src/**` consumed visx's `Zoom<E>` alias — consumers use `ProvidedZoom`/`ZoomState`
   separately, composed locally as the exported `ChoroplethZoomInstance`
   (`choropleth-chart.tsx:134`), which is unchanged.

A third, undisclosed-but-immaterial difference: visx returns `<Fragment>{children(zoom)}</Fragment>`
where the port returns `children(zoom)` directly. A fragment around a single expression child
produces no DOM and no key semantics here.

## Residual risk

The imperative `(zoom.containerRef as {...}).current = svg` assignment in `choropleth-chart.tsx:565`
races `useGesture`'s effect-time read of `containerRef.current`. That behaviour is **unchanged** by
this port — it is identical in both implementations — so it is not a T19 regression, but it does
mean wheel/pinch/drag binding has never been proven by any gate in this project. Parked for 5.3.5.

## Batch-close T0/T1 capture

| chart | tier | n | settled | hover-30 | hover-50 | hover-70 | vs pre/BASELINE |
|---|---|---|---|---|---|---|---|
| `candlestick` | **T0** | 1000 | 0.3025 | 0.4953 | 0.3661 | 0.3618 | **bit-identical, all 4** |
| `heatmap` | **T1** | 52 | 0.4277 | 0.3466 | 0.3533 | 0.4256 | **bit-identical, all 4** |

Unmoved through the whole of B6 — `b6-pre.md`, `b6-post-t18.md` and this capture agree to the
last digit on all eight cells. T0's full 0.0047 headroom is intact.
