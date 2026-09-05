# SunburstChart architecture

Design notes for `sunburst-chart.tsx`: the TanStack-native redo (D102), the C5d
angle-parity conditions verified against d3-hierarchy 3.1.2, and the deliberate
hover-chrome deviation (D450).

SunburstChart — TanStack-native redo from first principles (D102).

Architecture:
  <SunburstSegment> children are config carriers (return null, classified by
  displayName). A single <RendererChart renderer={chartMotionRenderer()}>
  renders ONE `polar()` container with ONE native `sunburst()` mark
  (`@tanstack/charts/hierarchy/sunburst`) fed FLAT rows
  (`buildSunburstFlatRows`, internal/sunburst-rows.ts) — native's own d3-
  hierarchy pipeline (stratify → sum → partition) computes every arc's
  angle/radius. The hand partition (the old buildArcs/ringOptions/geometryFor
  math driving a raw custom arc generator) is deleted from the chart path;
  its code survives only as the barrel's legacy parity exports under
  internal/parity/. Nothing the chart renders, focuses, labels, reveals or
  zooms computes a per-sector angle or radius from node values or depth:
  per-sector geometry is read from what the package publishes — the
  `ChartPoint` for key `${markId}:node:${nodeId}` (`xValue` = centroid
  angle, `yValue` = centroid radius, `x`/`y` = centroid in scene px,
  `datum` = the node with id/parentId/ancestorIds/branchId/depth/height/
  value/data) and the scene `area` node with the same key (`points` =
  sampled sector polygon, `path`). Angular extents and ring radii exist in
  the package only under an internal symbol that is not exported from its
  `package.json`, so the chart never imports them: arc length along a sector
  is measured along the polygon's outer edge, and pointer-in-sector is a
  point-in-polygon test on `points`.

--- C5d (native semantic motion, Phase 6): three angle-parity conditions,
verified against real d3-hierarchy 3.1.2 -------------------------------
  1. `value` is LEAF-ONLY (`d.hasChildren ? 0 : (d.rawValue ?? 0)`):
     native's `hierarchy.root.sum()` ADDS an internal node's own value on
     top of its children's, unlike the sector index's subtree totals (which
     ignore a node's own value whenever it has children, see
     internal/sunburst-rows.ts). Getting this wrong measurably diverges
     angles by up to ~3 rad for a tree where internal nodes carry values.
  2. NO `sort` is passed to `sunburst()` — native only sorts siblings if
     explicitly told to; omitted, it preserves `data`'s own child order,
     matching the sector index's own pre-order traversal. The reveal
     stagger relies on the same fact: pre-order filtered by depth IS the
     clockwise order, so no angle is measured for it either.
  3. The polar CONTAINER (not the mark) sets `startAngle: -Math.PI/2,
     endAngle: -Math.PI/2 + 2*Math.PI` — native's own polar default is
     0→2π starting at 3 o'clock (`dist/polar.d.ts`), not bklit's
     12-o'clock-clockwise origin.
  A 4th, self-discovered parity requirement beyond those three: native's
  automatic `visibleDepth` default is the LOCAL subtree height under the
  active `rootId`, which can silently diverge from the chart-level ring
  count `Math.max(1, maxDepth - focus.depth)` (keyed off the GLOBAL
  `maxDepth`) for a tree with irregular branch depths — so
  `visibleDepth` is passed explicitly to force exact ring-count parity.
  (`maxDepth` itself is a plain tree-height walk in internal/sunburst-rows.ts,
  alongside the center-hole and grow-padding inputs — chart-level package
  inputs, not per-sector geometry.)

  Focus/drill/hover/dim read exclusively from package scene data plus the
  pre-order sector index (ids, trails, branch colors — never angles):
  `createSunburstFocus` (internal/sunburst-focus.ts) tests the pointer
  against the painted sector polygons of the current scene (read through
  the focus injection's sceneRef), groups by node lineage
  (parentId/ancestorIds) and orders keyboard navigation by centroid angle
  (`ChartPoint.xValue`). This fixes the G12 hover regression (QA
  sunburst/27, sunburst/33, sunchrome/27 hover-30): the old hand ring
  radii could disagree with the package's ring division (legacy resolved
  `Leaf 1.1`, the hand strategy `Branch 1` at the same point); testing the
  painted polygons agrees with the paint by construction.

  Zoom morph (native "update"): `rootId: focus.id` + the explicit
  `visibleDepth` above reproduce the old focus-relative angle remap —
  d3-hierarchy's `.copy()` resets a re-rooted subtree's depth to 0, so
  `partition()` re-normalizes it to fill the full sweep. Persisting arcs
  keep their native scene key
  (`${markId}:node:${valueKey(node.id)}`, id-derived, focus-independent)
  across a `zoomTo` commit, so they hit the mark's "update" phase — a
  REAL semantic `d`-morph. The chart commits the new root and rebuilds
  the definition; no hand radius/angle morph runs alongside. Labels and
  the center overlay position from the settled scene of the target root:
  the labels overlay remounts per root and replays its reveal over the
  motion duration instead of morphing mid-zoom (deliberate, disclosed
  deviation — the legacy mid-zoom label morph has no public-scene
  equivalent), and the hub radius is the package `innerRadius` input so
  the overlay sits on the painted hole.
  Reveal (native "enter"): per-arc ring-staggered delay (unchanged
  `buildRevealTiming` math, internal/sunburst-reveal.ts) + the resolved
  sweep tween (`sweepDurationMs`/`sweepEasingCss`, SB2 below), read off
  `ctx.datum.id` — `ctx.datum` in `sunburst()`'s `motion` callback is the
  WRAPPED `SunburstNode<TDatum>` (`ChartMarkMotionOptions<SunburstNode
  <TDatum>>`, confirmed against `hierarchy-sunburst.d.ts` AND the shipped
  `docs/reference/marks/sunburst.md`), so no raw-flat-row key-decoding is
  needed here (unlike the DOM click-listener below, which has no typed
  API to lean on and must decode native's internal key scheme itself).
  `playKey` is folded into the MARK's own `id` (`sunburst-arcs-{playKey}`)
  rather than a per-datum `key` — `SunburstOptions` has no such option
  (verified against `hierarchy-sunburst.d.ts`) — so a playKey bump changes
  every child's derived scene key at once, replaying the full staggered
  reveal exactly like a fresh mount.
  Reduced motion: the arc mark's own motion (enter/update/exit) needs no
  local `prefersReducedMotion` branch — `chartMotionRenderer()`'s policy
  defaults `respectReducedMotion: true` (gauge/pie/ring precedent).
  `prefersReducedMotion` STILL gates three unrelated, non-native-scene
  concerns below: the whole-stage 350ms fade-in (SB15), the zoomT rAF
  tween-vs-snap branch (labels/hit-layer/center-circle overlays, none of
  which are TanStack scene nodes), and the phase-tracking deadline timer
  (skipped straight to "ready" — see the consolidated reveal-phase effect
  below) — none of those have a native-motion equivalent to fall back on.

  Hover chrome, DELIBERATE deviation (D450):
  native `sunburst()` has NO per-datum radius/size VisualChannel — only
  `fill`/`stroke` are per-node (`hierarchy-sunburst.d.ts`'s
  `SunburstSharedOptions`); `innerRadius`/`outerRadius`/`ringPadding` are
  whole-mark scalars or responsive `PolarLength` callbacks, never a
  per-datum channel. The radial hover pop-out is therefore not expressible
  on native `sunburst()` at 0.15.0 and is DROPPED outright; `hoverPop` is
  kept as a prop for API compatibility but is now inert (D450). Hover-DIM
  is fully preserved: non-related-arc dimming (bklit:
  0.25 alpha, 160ms ease-out, styles.css:424-427) is still computed as a
  `fill` color-mix alpha inside the mark's `fill` callback, reactive by
  construction (the callback closes over `hoveredArc`, which is React
  state — a hover change recomputes `definition` → native reconciles
  fresh `fill` colors, same "no imperative DOM opacity mutation" model as
  before).

--- C5c (native focus, Phase 6, D435): scoped correction, not a straight
port of pie/ring's pattern -------------------------------------------
  Unlike pie/ring, sunburst's ACTUAL hover mechanism is NOT a
  `querySelectorAll`+`addEventListener` DOM reach-in against
  TanStack-rendered nodes — it is `SunburstHitLayer` (internal/sunburst-
  hit.tsx), a separate, ordinary React-owned SVG overlay with plain JSX
  `onPointerEnter`/`onClick` props. `SunburstHitLayer` is rendered as a
  LATER JSX sibling of `<RendererChart>` inside the same `position:
  relative` box, absolutely positioned at 100%×100% — it therefore sits
  geometrically on top of and fully occludes `<RendererChart>`'s own
  `svg.ts-chart` (both cover the identical size×size rect). This is
  REQUIRED to stay (D384): the click half's bench-dispatched synthetic
  `.click()` needs a real DOM element to target with no `clientX`/
  `clientY`, which only a real rendered `<path>` element (not native
  pointer-coordinate resolution) can serve. Because it fully occludes the
  chart's own SVG, native pointer events NEVER reach `svg.ts-chart` in any
  region covered by an arc — so native pointer-driven `onFocusChange`
  cannot replace `SunburstHitLayer`'s hover handlers; they stay unchanged.
  `focus: focusDisabled` is still dropped (native default) and
  `<RendererChart onFocusChange>` is still wired to `setHoveredArcIndex`,
  because KEYBOARD focus (Tab into the SVG, arrow keys) is NOT blocked by
  the overlay — it targets `svg.ts-chart` directly via its own `tabIndex`,
  independent of pointer z-order — so this rung is a genuine, if narrower,
  capability add: keyboard users get arc hover-preview (dim/grow) for the
  first time. The one reach-in this rung DOES retire is SB15's
  `useLayoutEffect` querying `svg.ts-chart` for a `pointerleave` listener
  — confirmed dead in practice by the same occlusion finding
  (`svg.ts-chart` never receives a `pointerenter`, so never fires
  `pointerleave`, in any pointer-covered region); `SunburstHitLayer`'s own
  `<svg onPointerLeave={onHitLeaveAll}>` (identical footprint, rendered on
  top) already reproduces the intended "leave the stage clears hover"
  behavior and was doing the actual work all along.
  6.5 gate check (D448 → D471): the occlusion argument above covers
  pointer RESOLUTION only. The host also re-reports its still-focused
  keyboard point on every render and emits `null` on `focusout`, so the
  two paths CAN fight over the single hover cell. `pointerInsideStageRef`
  (below, at the hit handlers) makes the pointer the owner while it is
  inside the stage; keyboard focus drives hover only when it is not.
