# Upstream gaps: TanStack Charts 1.0.0 limitations hit in phase 8

Re-checked against 1.1.0 (57774e14), 2026-10-09: no gap closed.

Each entry is written to be lifted into an upstream issue. Source references are
`repos/tanstack-charts/packages/*` at tag v1.0.0, all re-read while writing this file.
Measured costs come from `docs/phase-8/LOG.md` (D-numbers cited); they are from headless
Chrome runs on the showcase Live Perf panel unless noted. Anything not independently
checked in source is marked **[LOG only]**. All paths below `showcase/` are under
`showcase/migrated/charts/`.

Index: 49 group clip is rect only, 1 states per-move cost, 2 retarget focus guides, 3 tooltip body state, 4 longest state
transition wins, 5 no gradient motion, 6 gradient limits, 7 text motion, 8 tooltip delays,
9 spring rest defaults, 10 no SVG filters/patterns/masks, 11 sunburst stagger, 12 enter only
for late-joining elements, 13 no reveal/wipe entrance, 14 no number-tween text, 17 rolling presentation points static, 18 focus label opacity deferred under data motion, 19 repeated hide() restarts exit, 35 sunburst arc tweens need private geometry, 51 radialArc carries no arc geometry (ring, pie), 50 no documented mid-tween hook (`data-ts-motion-role`), 52 no HTML or foreignObject scene node (marker icons).


Posted upstream on 2026-10-09 (drafts and status in `docs/upstream-issues/README.md`):
#186 mark states (1, 4, 18, 31; 53 draft 16 pending) · #187 tooltip lifecycle (3, 8, 19, 22, 37, 44) · #188 focus guides (2, 21, 23, 32, 43) ·
#189 keyboard focus (28, 42) · #190 focus strategies (26) · #191 gradients and paint resources (5, 6, 10, 30) ·
#192 motion timing (9, 33, 38) · #193 motion coverage (7, 12, 14) · #194 arc motion (11, 16, 35) · #195 rolling windows (27) ·
#196 renderer DOM (20, 36) · #197 bar rect geometry (24, 25) · #198 brush (40).
Not posted: 13 (solved natively, M3-1), 29 (solved natively, T3-1), 41 (solved natively, D3-1), 15 (likely stale), 17 (wrong: rolling points are animated),
34 (open upstream PR #164), 39 (documented route, see its caveat).

---

## 1. Mark `states` re-render and reconcile the whole scene on every pointermove

- **Needed:** bklit dims/emphasises per-datum on hover (scatter, candlestick, bar, heatmap, choropleth, composed). Natural 1.0 expression is mark `states`.
- **1.0 behaviour:**
  - `applyStateFocus` (`charts-core/src/motion.ts:889`) runs `resolveMarkStateScene`, `resolveFocusScene` (:898), then `renderSvg(presented.scene, ...)` (:918) and `motion.animateSvg(...)` (:921) on every state-focus change.
  - `resolveMarkStateScene` (`charts-core/src/mark-state.ts:28`) always maps the node tree and builds a fresh `transitions` record. Only the early-out at :33-34 (no focus, or `sceneHasMarkStates` false) returns the same scene object. When a mark declares states but none match the focused point, the result is still a new scene, so the `presented.scene !== scene` identity check (motion.ts:~901) is true and a full re-render + reconcile happens.
  - Pointer-driven calls are also queued through `queuePendingStateFocus` (:866-886).
- **Workaround:** focus-keyed scoped CSS emitted by the `FocusLayer` leaf (`kit/cartesian/focus-layer.tsx`, `css` prop :53, `<style>` :64; bar targets in `charts/bar/hover.ts`). Native `states` kept only where geometry changes (radar, pie/ring pop, funnel).
- **Cost (D721/D722):** choropleth hover render 888 ms to 12 ms after moving hover out of the definition; heatmap dim/pop script time on an identical 125-sample path 8-10x the no-effect cost to parity (~290 ms vs bklit ~2900 ms).
- **Proposal:**
  1. Make `resolveMarkStateScene` return the input scene (same identity) and no transition when no node resolved a state, and structurally share unchanged subtrees.
  2. In `applyStateFocus`, skip `renderSvg`/`animateSvg` when `presented.scene === scene` (or compare state-keys per mark).
  3. Better: patch only the affected elements' presentation attributes (opacity/fill/transform) with the existing track machinery instead of re-rendering markup.

## 2. Retargeting focus guides mint a new scene per pointermove

- **Needed:** crosshair/focus guide + guide dots following the pointer without rebuilding the chart.
- **1.0 behaviour:**
  - `focusGuideX` sets `retarget: true` (`charts-core/src/focus-guide.ts:338`).
  - `resolveFocusScene` (`charts-core/src/focus-layer.ts:72`) rebuilds a group with new `children`/`focus.activePoints` for each retarget layer on each focus (:~83-103) and returns `{ ...scene, nodes }` (:~112), a new scene identity every move whenever a retargeting layer matches.
  - `applyStateFocus` calls it at `motion.ts:898`; `presented.scene !== scene` then triggers the full `renderSvg` + `animateSvg` reconcile (see 1). A separate, cheaper retarget path exists for DOM-only painting (`paintMotionSvgFocus` motion.ts:~1141, `retargetFocusContext` :3116) but the scene path is still taken.
  - Downstream, `tooltip.ts:289` (`bodyScene !== paintContext?.scene`) marks the tooltip body `changed` on every scene identity change and re-invokes `bodyChange`, so item 3's cost compounds.
- **Workaround:** none for the chart-internal guide; mitigated indirectly by keeping hover React state out of the chart (D720, `kit/cartesian/focus-layer.tsx`) and by item 3's leaf. **[LOG only for the magnitude: line hover p95 ~25-27 ms vs bklit ~17-18 ms, no cheaper update path than definition re-resolve, D715/D716.]**
- **Proposal:** cache `resolveFocusScene` output per (scene, activePoints) and reuse the previous scene object when `selected` nodes are `===` the previous ones; or have retarget layers be DOM-patch only (no scene substitution). In `tooltip.ts`, compare the paint context's `point`/`points`, not `scene` identity, for `changed`.

## 3. react-charts tooltip body keeps its target in `useState` inside the chart wrapper

- **Needed:** tooltip body React content that does not re-render the chart on every hover change.
- **1.0 behaviour:**
  - `react-charts/src/tooltip.tsx:150` holds `const [target, setTarget] = React.useState(...)` in the hook used by the wrapper; `onChange` (:155-160) sets it, re-rendering the wrapper that renders `RendererChart`.
  - `react-charts/src/RendererChart.tsx:160-163` builds a new `hostOptions` object literal each render, and the layout effect at :176-185 depends on it, so every target change runs `adapter.update(hostOptions)` (:180).
- **Workaround:** `kit/tooltip/tooltip-leaf.tsx` renders the core `Chart` from `@tanstack/react-charts/core` with a stable `onTooltipBodyChange` writing into a deduped ref store; only `TooltipBodyLeaf` (useSyncExternalStore, :78) subscribes and portals the body.
- **Cost (commit 4ba5a05):** pointermove p95 2-6x lower after the change; removes a forced style recalc and a second guide reconcile per move (as stated in the file header).
- **Proposal:** memoize `hostOptions` (or have the adapter diff and skip `update` when nothing but callbacks changed), and either keep the target in a ref/store consumed by a leaf component, or expose `useChartTooltipBody` so the portal subscribes independently of the chart wrapper.

## 4. The longest state transition on a mark governs all of that mark's states

- **Needed:** a long cosmetic fade (450 ms pop) alongside a short dim (160 ms) on the same mark (sunburst).
- **1.0 behaviour:** `mergeTransition` (`charts-core/src/mark-state.ts:311-324`) merges tween states for a mark taking `Math.max(duration)` (:320); results are stored per `markId` (:77-79), so every state change on that mark runs at the maximum duration.
- **Workaround:** long fades moved to CSS; native state transition set to 1 ms (commit 5a99802, D721).
- **Cost:** sunburst 160 ms dim stretched to 450 ms **[LOG only]**.
- **Proposal:** resolve the transition per state (or per animated property) rather than merging by max; e.g. `ChartMarkState.transition` keyed by the entering state, or `transitions: { opacity, transform }`.

## 5. No gradient motion (stop offsets/opacity patch instantly)

- **Needed:** liveline area fade whose end moves smoothly as the y domain rolls.
- **1.0 behaviour:** `charts-core/src/motion.ts` has no gradient handling. `motionAttributes` (:2071-2085) lists only geometry/opacity attributes (cx, cy, d, fill-opacity, font-size, ..., opacity, r, stroke-opacity, stroke-width, transform, width, x, ...); no `offset`, `stop-opacity`, `stop-color`. `grep -i gradient` in motion.ts and svg-renderer.ts finds nothing, and the gradient types (`types.ts:636-673`) carry `stops` as static data.
- **Workaround:** fixed 41-stop ramp where only stop opacity changes, eased with a scoped CSS `transition: stop-opacity` (`charts/live-line/definition.ts:~95`, `charts/live-line/liveline.css:25-28`).
- **Cost:** without it the fade end snapped ~18 px in one frame (D722).
- **Proposal:** treat `<stop offset|stop-opacity|stop-color>` as motion attributes when a gradient with the same `id` exists in previous and next scene, interpolated with the mark's update transition.

## 6. Gradient limits: objectBoundingBox only, no masks, none on zero-extent marks

- **Needed:** bklit's grid/crosshair fade-edges, area horizontal edge fade, heatmap separators with viewport-pinned stops.
- **1.0 behaviour:** `ChartLinearGradient` (`types.ts:647-658`) exposes only `x1/y1/x2/y2` with no `gradientUnits`; `grep gradientUnits|userSpaceOnUse|objectBoundingBox` over `charts-core/src` returns no matches, so the SVG default (objectBoundingBox) applies. Zero-width/zero-height rules have a degenerate bounding box and cannot take a bounding-box gradient (SVG spec; D715). No mask/clipPath resource in the scene model.
- **Workaround:** CSS `mask-image` on the grid group and area path (`styles.css:53, 69, 117, 129`); heatmap separators through a hand-built `<defs>` host (`kit/resource-host.tsx`, used in `charts/heatmap/chart.tsx`).
- **Cost:** D715 first dropped these effects (solid), D718/D719 re-added via CSS.
- **Proposal:** add `units?: 'objectBoundingBox' | 'userSpaceOnUse'` to `ChartGradient`; add a first-class `mask`/`clipPath` resource (or at least `<defs>` passthrough on the scene).

## 7. Scene text has no enter/opacity motion

- **Needed:** bklit fades labels in after the sweep (sankey, sunburst, funnel labels).
- **1.0 behaviour:** `ChartMotionRole` includes `'text'` (`types.ts:822`) but scene `label` nodes in custom marks are painted outside the motion tracks. The generic enter track (`motion.ts:2475` `addEnterMotionTrack`) only applies when `elementTimingContext` yields a context. **[LOG only (D719: "scene text bypasses motion"); not traced through every scene-label path in source.]**
- **Workaround:** CSS late fades for sankey/sunburst/funnel labels (D719; `charts/sankey/sankey.css`, `charts/sunburst/*`).
- **Proposal:** run scene `label` nodes through `addEnterMotionTrack` with role `'text'` so `motion.delay`/transition apply.

## 8. Tooltip has no show/hide delay

- **Needed:** bklit heatmap tooltip: 120 ms `hideDelay` and spring entrance.
- **1.0 behaviour:** tooltip motion is a presence/position controller (`motion.ts:343` `createTooltipMotionController`); `ChartMotionTiming.delay` (`types.ts:871`) applies to marks, and `grep showDelay|hideDelay|openDelay|closeDelay` over `packages/**/*.ts(x)` returns nothing.
- **Workaround:** none needed for hide: the heatmap passes a hold tween as `tooltip.motion` (`HEATMAP_HOLD_MOTION`, `charts/heatmap/definition.ts:47,365`, duration = `tooltipHideDelay`), which delays the hide natively. Show delay is still not expressible (native-research, D743).
- **Proposal:** `tooltip: { showDelay, hideDelay }` (ms) honouring pointer re-entry.

## 9. Native spring default rest thresholds run long

- **Needed:** bklit/motion springs settle when visually still.
- **1.0 behaviour:** `defaultSpringOptions` (`charts-core/src/spring.ts:32-33`): `restSpeed: 0.01`, `restDelta: 0.005`; rest test at :67-68 and :114-115. motion's defaults are `restSpeed: 2`, `restDelta: 0.5` (per D720).
- **Workaround:** pass `restSpeed: 2, restDelta: 0.5` on every mapped spring (`kit/cartesian/definition.ts:124`, `kit/theme.ts:76`, `kit/cartesian/date-pill.ts:78`, `charts/live-line/definition.ts:227`, `charts/gauge/transition.ts:29`; commit 3a75e96).
- **Cost:** candlestick settle inflated by ~950 ms; springs ran ~1 s after visual rest (D720).
- **Proposal:** scale defaults to the animated unit (pixel-space: ~0.5 px / 2 px/s), or document pixel-scaled thresholds; keep 0.01/0.005 only for normalised 0..1 tracks.

## 10. No SVG filter, `<pattern>`, or mask resources

- **Needed:** glow/drop-shadow (radar, area), blur on dimmed dots/markers (scatter, line markers), hatch PatternArea and brush.
- **1.0 behaviour:** `charts-core/src/svg-renderer.ts` emits no `filter`, `mask`, or `pattern` elements (grep `filter|mask|pattern` finds nothing relevant; no `feGaussianBlur`/`feDropShadow` anywhere in `charts-core/src`).
- **Note (D743):** bklit's own glow and blur are CSS filters, so CSS `filter` on the scene is parity, not a workaround. Only mask and pattern resources are a real gap.
- **Workaround:** translucent underlay stroke for glow (radar, `charts/radar/*`, D713/D722); CSS `filter: blur()` scoped by class/`data-ts-key` (`styles.css:797`); PatternArea hatch via CSS mask on the area path (D716, `kit/pattern/`); brush hatch tile mask (D719).
- **Proposal:** a generic `resources` slot on the scene (`<defs>` children: filter, pattern, mask, clipPath) referenced by `fill: url(#id)` / `filter` style props, shared with item 6.

## 11. Sunburst has no per-arc enter stagger

- **Needed:** bklit staggers sectors on entrance.
- **1.0 behaviour (verified):** the sunburst mark renders one `g.ts-chart__arc ts-chart__sunburst` group (`charts-core/src/hierarchy-sunburst.ts:325`). `createArcTracks` (`motion.ts:1618-1640`) creates one `enter` track per `g.ts-chart__arc` group with `datumIndex: 0`, `datumCount: 1` (:1630-1640), so `ChartMotionTiming.delay(context)` (`types.ts:871`) can never differ per sector. The per-datum delay function that now exists does not cover this.
- **Workaround:** accepted as a gap, group clip sweep (D714); labels faded via CSS (item 7).
- **Proposal:** emit one arc track per sector path with real `datumIndex`/`datumCount`, matching how bars get per-datum contexts.

## 12. Enter motion only runs for elements joining an already-painted mark group

- **Needed:** entrance on first paint (heatmap, candlestick, bar/composed cascades).
- **1.0 behaviour (as observed, D714) [LOG only; renderer path not traced in this pass]:** marks present in the first paint render at rest; a post-mount size change (host measuring) cancels an in-flight enter.
- **Workaround:** measure host in `useLayoutEffect` before mounting, first paint with empty data for animated marks, flip `entered` in `useEffect` (`charts/heatmap/chart.tsx`, `charts/bar/marks.ts`, `charts/candlestick/definition.ts`, `charts/composed/bars.ts`); `plotHeight` derived from width/aspect so the definition is never re-resolved during entrance (D718).
- **Proposal:** `motion.enter: 'mount'` (animate initial paint), and do not cancel tracks on size-only re-resolution.
- **Addendum (1.1.0, v1.1.0 tag, re-read 2026-10-09): a whole mark group that joins later only fades.** On an update, `reconcileMotionElement` clones an unmatched child and calls `addEnterMotionTrack` on that one element (`motion.ts:2146-2160`); the clone's descendants are never visited. The bar grow branch of `addEnterMotionTrack` (`motion.ts:2505-2565`) only runs when the joining element is itself a `rect` or `path` (`isBarShapeElement`, `motion.ts:1418-1420`), i.e. a bar joining an existing `g.ts-chart__bar-y` group. A new `g.ts-chart__bar-y` group takes the final opacity branch (`motion.ts:2610-2634`), so its bars never play their enter grow; `createBarTracks` (`motion.ts:1238`) is reached only from the first-paint path (`motion.ts:273-286`). Same for any mark whose per-datum enter lives in a first-paint track (lines, areas, arcs).
- **Addendum workaround (bar):** `showcase/migrated/charts/bar/definition.ts` keeps the bar marks present with zero-value datums while `loading`, so the flip to ready is a keyed value update of existing bars (grows), not a group join. Heatmap (`showcase/migrated/charts/heatmap/chart.tsx`, `cellsEntered`) works around the same family: a cell-less seed paint, then a second commit so the cells join as elements of an already painted chart and take the generic per-datum fade; it also depends on the first-paint limit above.
- **Addendum proposal:** when a mark group joins on an update, run the same per-datum enter tracks as first paint for its descendants (or recurse `addEnterMotionTrack` into the clone's keyed children).

## 13. No native reveal/wipe entrance for lines and areas

- **Needed:** bklit 1100 ms left-to-right clip wipe.
- **1.0 behaviour:** `clip` is a boolean plot clip; enter grows paths from the baseline; rolling paths are for streaming only (D711).
- **Workaround:** accepted grow-from-baseline over 1100 ms tween (D711), no custom clip animation.
- **Proposal:** `motion.path.enter: 'reveal'` (x-clip sweep) for line/area.

## 14. No number-tween text

- **Needed:** gauge centre value counts like NumberFlow.
- **1.0 behaviour:** no text-content tween in `motion.ts` (`font-size`/`font-weight` only animate, :2071-2085). **[LOG only: D713.]**
- **Workaround:** NumberFlow HTML overlay (`charts/pie/center.tsx` / gauge).
- **Proposal:** `text` mark option `format` + numeric tween on update.

---

## 15. No per-datum pixel adjust on native bar marks

- **Needed:** bklit trims each depth bar's front face by the perspective rise (top moves down by a few px).
- **1.0 behaviour:** `barY` exposes no pixel hook, and its scene returns no `points`, so a wrapper cannot map rects back to datums except by the encoded key.
- **Workaround (current):** the trimmed front face is drawn by a custom mark (`depthBarMark`, `charts/bar/depth.ts`, used from `charts/bar/definition.ts:166`) built with `createMark`; the old `trimBarTopsForDepth` key-suffix wrapper (665cb33) is gone (D743). The proposal still stands, so `barY` could be used directly.
- **Proposal:** a `layout(rect, datum)` adjust option on bar marks, or `datum` on emitted rect nodes.

---

## 16. No public enter-seed geometry or geometry state style for partition (sunburst) arcs

- **Needed:** bklit sweeps each sector from its leading edge while scaling it about its own centre, and on hover grows the
  hovered path and shifts every descendant ring outward.
- **1.0 behaviour:** arc geometry `[startAngle, endAngle, innerRadius, outerRadius]` tweens only between scenes; the
  values live under the private `scene-motion-node` symbol. `ChartMarkStateStyle` has no angle/radius key, so focus can
  change paint but not arc geometry without a definition rebuild.
- **Workaround:** `seedSector` (`charts/sunburst/sunburst-mark.ts`) rewrites the first-paint motion values to a sliver at
  the leading edge (falls back to the plain sector if the symbol is absent). Hover keeps a translucent pop overlay; an
  ~8px darker band remains where the parent's overlay rim covers unshifted dimmed siblings.
- **Proposal:** an `enter.from` geometry option on partition marks, and radius/angle keys in arc state styles.

---

## 17. Rolling-path presentation points are static during the roll (no per-frame focus value)

- **Needed:** bklit's live tooltip and pill value is interpolated at the pointer every frame while the line scrolls under it.
- **1.0 behaviour:** for `path: { update: "rolling" }` a point with a `transform` outcome is published once as
  `{ x: point.x + transform.x, ... }` and gets no motion track (`motion.ts` ~3318-3325, `continue` before any track), so
  `subscribePresentationPoints` never fires per frame for it. The renderer re-resolves focus on presentation callbacks
  (`renderer.ts` `handlePresentationPoints`), which here only happen at roll start/end. There is no public hook to re-resolve
  or re-paint the tooltip on a frame.
- **Workaround:** a custom `focus` strategy interpolates the value at the exact pointer x on every resolve (so it is
  continuous across rolls, exact on pointer moves) in `charts/live-line/definition.ts`. Measured: 6 distinct tooltip texts per 3s
  at a still pointer vs 26-29 for bklit. No overlay or rebuild added.
- **Proposal:** publish presentation points per frame for rolling transforms (x + the live transform value), or expose a
  `renderer.refocus()`/tooltip `refresh` hook.

---

## 18. Focus-state label opacity (`tickLabels.opacity` function) is deferred while data motion is active

- **Needed:** hide x tick labels near the pointer (bklit labelFadeOpacity) on a chart that is always rolling.
- **1.0 behaviour:** `paintFocus` stores `pendingStateFocus` while `dataMotionActive` and only applies the mark-state scene
  after the motion completes (`motion.ts` ~1083-1100). A continuously rolling chart never leaves data motion for long, so
  `focusOpacity` results (`mark-state.ts:84`) are computed but never painted; the label keeps opacity 1.
- **Workaround:** one static CSS rule against a pointer var, `TICK_FADE_CSS` in `live-line-chart.tsx` (typed `attr(x)`
  against `--bkm-fx`, written by a pointermove handler on the host). Must be an inline `<style>`: the CSS pipeline rewrites
  `type(<number>)` into invalid syntax.
- **Proposal:** apply label `focusOpacity` in the data-motion branch of `paintFocus` as well (it only changes style).

---

## 19. Repeated `hide()` restarts the tooltip exit animation

- **Needed:** hide the tooltip when the pointer rests outside bklit's hover area on a rolling chart.
- **1.0 behaviour:** an empty focus makes `handlePresentationPoints` call `updateFocus([], true)`, i.e. `tooltipInstance.hide()`,
  on every presentation frame; each `hide()` bumps `hideGeneration` and restarts the exit from full opacity (`motion.ts`
  `hide`), so the exit never completes.
- **Workaround:** `bklitTooltip` in `kit/tooltip/bklit-tooltip.ts` (moved from liveline's `liveTooltip`; every route whose bklit tooltip is a TooltipBox uses it, since an in-surface leave held the box visible through the exit and a re-entry inside it resumed without replaying the enter): a typed, documented `ChartTooltipExtension` (public contract, `reference/types.md:352-355`) composing the stock `tooltip.create` with an idempotent `hide()`. Public API only (no private state, no casts). bklit's live tooltip has no exit presence at all (`tooltip-box.tsx:64` returns null when not visible; `handleMouseLeave` clears it, `live-line-chart.tsx:521-525`), but 1.0's tooltip `motion` drives both the position glide and the exit, so `hide()` passes the options with `motion: false` through the public `update()` for that one call and restores them (instant hide, glide keeps its spring).
- **Proposal:** make `hide()` a no-op while already hiding; allow a separate exit transition (or `exit: false`) on tooltip `motion`.

---

## 20. Reconcile strips attributes and inline style that the scene does not carry

- **Needed:** per-element hover state (CSS vars, marker attributes) that lives between scene builds, e.g. the focused
  column's dots, the label set related to a hovered arc, the date-pill x on the tick group.
- **1.0 behaviour:** `syncAttributes` (`charts-core/src/reconcile.ts:159`) removes every attribute of the live element
  that the next scene element lacks, `style` included. Focus runs a retarget reconcile on every pointermove
  (`resolveFocusScene`, `focus-layer.ts:72`), so imperative writes on renderer-owned nodes vanish within a frame or two.
- **Workaround:** all hover state lives on the host we own (attributes + vars) and fixed, index-capped CSS rules select
  from it (6516d66, 15993c7, sunburst `LABEL_HIDE_CSS`). Cost: a host var re-matches every descendant that reads it.
- **Proposal:** a documented "foreign attribute" allowance (e.g. leave `data-x-*` / `--x-*` alone, or a per-mark
  `preserveAttributes` list), or a supported per-element state hook that does not rebuild the scene.

---

## 21. Every pointermove re-reconciles the focus layer and forces a layout read for the tooltip

- **Needed:** hover cost on par with a hand-written d3 chart (bklit runs ~0.5-1.4ms cheaper per move on the cartesian routes).
- **1.0 behaviour:** `resolveFocusScene` (`focus-layer.ts:72`) maps the scene into fresh node objects whenever focus is
  set, so the focus reconcile walks the whole focus tree even when the focused datum is unchanged; `positionTooltip`
  reads `tooltip.offsetWidth/offsetHeight` (`tooltip-position.ts:25-26`) on each placement, forcing style + layout after
  the reconcile's writes.
- **Workaround:** the layout read is avoided through the documented `tooltip.portal` extension point: every migrated tooltip
  places through a portal that keeps the panel size from a ResizeObserver (`kit/tooltip/bklit-tooltip-portal.ts` for bklit's
  TooltipBox rules; `kit/tooltip/sized-tooltip-placement.ts` for the native resolver, public `resolveChartTooltipPlacement`). The
  focus-layer reconcile per move is accepted as library-side.
- **Proposal:** return the previous resolved scene when the focus key is unchanged; cache the tooltip size from a
  ResizeObserver (or measure only when the body content changes).

---

## 22. Finished tooltip presence animations stay attached (`fill: 'both'`)

- **Needed:** pixel-exact tooltip text against a plain absolutely positioned div.
- **1.0 behaviour:** tooltip presence/movement animations use `fill: 'both'` (`motion.ts:471`, `motion.ts:517`) and are
  never released, so the root keeps an animated opacity/scale/translate. Chrome then snaps the root's paint offset and the
  text lands ~0.25px from where a static element paints it (heatmap tooltip at 390px; cancelling the animation gives 0.00%).
- **Workaround:** none (cancelling from the portal would reach into the motion controller); accepted as sub-pixel.
- **Proposal:** on finish, `commitStyles()` then `cancel()` (or use `fill: 'none'` with final inline values).

---

## 23. Guide labels cannot paint above the HTML tooltip

- **Needed:** bklit's date pill (an in-container `z-50` div after the tooltip) paints over the tooltip where they meet (composed at 390px, pointer near the left edge).
- **1.0 behaviour:** the pill is a native guide label inside `svg.ts-chart > g.ts-chart__marks > g.ts-chart__focus-layer`; the tooltip is an HTML sibling after the svg, so it is either above every mark or below all of them.
- **Workaround:** none; accepted (2.24% at that one pointer position, all of it the pill region).
- **Proposal:** an HTML guide-label layer (or a tooltip layer option placing it between marks and the focus overlay).

---

## 24. Bar width on a continuous scale with one datum is capped at 48px

- **Needed:** bklit's lone candle is `columnWidth * 0.8` (~486px in a 640px box).
- **1.0 behaviour:** `bar.ts` (~266) uses `scales.x.bandwidth || inferBandwidth(...)`; on a time scale bandwidth is 0 and `inferBandwidth` (~880) returns `min(48, ...)` for a single datum. `resolveBarThickness` (~787) can only shrink (`inset`, `maxThickness`); scale options have no interval/step.
- **Workaround:** none (a fake `bandwidth()` scale or a dummy datum would break the rules); 16.8% on the single-candle edge case, accepted.
- **Proposal:** a `thickness` / `interval` option on bar marks over continuous scales, or a configurable single-datum fallback.

---

## 25. A scalar rect radius is emitted as `rx` only

- **Needed:** bklit's bar is `rx = ry = min(barWidth / 2, 8)`.
- **1.0 behaviour:** a scalar bar `radius` (bar.ts `resolveSceneRectRadius`) renders a rect with `rx` and no `ry`; browsers clamp each radius on its own axis, so a bar narrower than 16px gets corners 8px tall but only w/2 wide. A `radius` function only sees the datum, not the resolved bar width.
- **Workaround:** fixed scoped CSS `rect[rx]{rx:min(attr(rx), attr(width)/2); ry: same}` (`attr(height)` for horizontal bars; bar-chart.tsx staticCss): both radii are clamped to half the band thickness only, so the browser's per-axis clamp still turns a growing bar shorter than 2 × radius into an oval, as bklit's does. Where bklit's radius is a plain number (composed `SeriesBar` rx = ry = radius, bar-squares rx = ry = size × squareRadius) the native scalar `radius` is used as is: `ry` is `auto`, which takes rx's value and is clamped to height / 2 on its own, the same used geometry as bklit's explicit `ry`. A corner-radii tuple is not a substitute: it renders a path whose circular arcs shrink both radii together (`renderer-rect.ts` `rectCornerRadiiPath`), so short bars keep square-ish corners.
- **Proposal:** emit `ry` equal to `rx` and clamp both to half the thin side, or pass the resolved geometry to the radius function.

## 26. Focus resolution is stateless per pointer event

- **Needed:** bklit's ring arcs scale about the centre on hover (1.03 hovered, 1.02 pushed), and their SVG paths are their own hit areas. Entering a ring just inside its inner edge grows it past the pointer, so it leaves and re-enters: the resting state in that ~1.7px band depends on spring timing and how the pointer arrived.
- **1.0 behaviour:** `ChartFocusStrategy.resolve` sees only the current pointer and static geometry, with no prior focus or animated geometry, so the hit area cannot track the growing arc.
- **Workaround:** none; migrated hit-tests the static ring (geometrically correct, no flapping). Accepted.
- **Proposal:** pass the previous focus to `resolve` (enables hysteresis), or allow hit-testing against the rendered mark geometry.

## 27. Axis tick labels are keyed by value; label text changes replace the text node

- **Needed:** bklit's live x axis keeps fixed label slots whose text re-derives as the window rolls (stable nodes, `characterData` updates only).
- **1.0 behaviour:** the axis keys each tick label by its tick value, so a rolling time window replaces every label node per tick and the reconciler re-appends the following siblings; a label's text change is written via `textContent` (one text-node remove + add).
- **Workaround:** liveline draws its x labels with a small `createMark` keyed by slot index (`charts/live-line/live-xlabels.ts`); churn over 10s dropped from ~500 element adds to 1. The text-node replacement remains (288 childList adds vs bklit's 243 characterData changes).
- **Proposal:** an axis option to key tick labels by slot index, and update existing text nodes via `nodeValue`.

## 28. Escape does not clear keyboard focus

- **Needed:** a keyboard user expects Escape to dismiss the focused point's tooltip and highlight (bklit has no keyboard focus, so there is no parity target; this is the accessibility expectation).
- **1.0 behaviour:** charts-core `renderer.ts` only handles Escape to dismiss a pinned tooltip (`pinnedKey`) or an active cursor session; with a non-sticky tooltip the focused point stays shown until Tab out.
- **Workaround:** none (no custom key handlers).
- **Proposal:** Escape clears the active focus (keeping DOM focus on the svg), and the next arrow resumes from the last index.

## 29. Containment hit testing is empty while marks are entering

- **Needed:** bklit's heatmap cells accept hover from their first commit, so the tooltip works during the ~2s reveal.
- **1.0 behaviour:** with `maxFocusDistance: 0` (containment only), `resolvePointer()` returns nothing until the entering marks finish their motion, because their presentation points are published only at the end (`handlePresentationPoints`). Keyboard focus is unaffected.
- **Workaround:** resolved natively (T3-1, no longer a gap): `charts/heatmap/focus.ts` is a `ChartFocusStrategy` whose `resolve` calls `findNearestPoint(scene, x, y, 0)` on the last rendered scene (stored in `onRender`) without the presented `points` argument, so containment tests the final cell geometry from the first commit (renderer `interactionPoints()` hands strategies only the presented points; `nearest.ts` filters by that list). `maxFocusDistance: 0` was removed.
- **Proposal:** none required; optionally make the default strategy hit-test the final scene geometry while marks enter.

## 30. Focus-guide nodes are not paint-resolved against the chart's idPrefix

- **Needed:** bklit's tooltip indicator is a 1px-wide rect filled with a vertical fade gradient, scoped per chart instance.
- **1.0 behaviour:** a native crosshair rule is a zero-width line, which an objectBoundingBox gradient cannot paint. Paint references on scene nodes returned from a focus guide's `resolve` are written verbatim: they are not mapped to the `idPrefix`-scoped defs the way mark paints are.
- **Workaround:** `crosshairRuleMark` (`kit/cartesian/date-pill.ts`) draws a rect guide and passes `url(#${uid}-crosshair)` already prefixed; the charts pass `idPrefix={uid}` to `RendererChart`. This replaced the CSS mask fade (which snapped the line to one pixel column).
- **Proposal:** resolve focus-guide paints through the same idPrefix mapping as marks, or allow a gradient-painted rule.

## 31. Mark `states` force a full scene repaint on every focus change

- **Needed:** hover emphasis (dim the rest, lift the hovered shape) at the cost of a focus-layer toggle, the way bklit swaps one layer.
- **1.0 behaviour:** in `motion.ts` `applyStateFocus`, any scene with a group that has `states` gets a new scene from `resolveMarkStateScene`, even when the definitions are empty (`sceneHasMarkStates` checks only that the field is present). Every focus change then runs a full re-render and reconcile. A function tooltip anchor makes `tooltipTracksPointer()` true, so focus repaints (and with it the states repaint) on every pointermove, even when the focused datum has not changed.
- **Workaround:** choropleth writes `data-hover="<datumIndex>"` on the host and uses scoped CSS. The per-feature rules are generated only when the scene changes. Sunburst dropped its empty `states` and pop `states` for the host's `data-bk-path` CSS. Chrome move latency p50 went from 15.5 to 8.2 ms on choropleth and from 10.7 to 8.9 ms on sunburst.
- **Proposal:** diff only the affected nodes' style for focus states, treat empty definitions as no states, and add a declarative projected (geo) tooltip anchor or a non-tracking function anchor.

## 32. Per-pointermove core work even when focus is unchanged; the tooltip positions before its body commits

- **Needed:** hover cost close to bklit's (one React render per changed datum).
- **1.0 behaviour:** about 1.2 ms of synchronous work per pointermove runs in charts-core before any adapter code (the `pointsAtPointer` resolve plus a `renderFocusGuideLayer` reconcile per guide layer), even when the focused point is unchanged. The tooltip's `paint()` positions before the React body leaf commits (useSyncExternalStore, microtask), so a portal sees the previous body's size.
- **Workaround:** `bklit-tooltip-portal.ts` keeps the panel size from a ResizeObserver (no forced layout in `position()`); the native ResizeObserver re-position retargets after the body lays out.
- **Proposal:** skip the guide-layer reconcile when focus identity and guide inputs are unchanged; add a post-body-commit position hook.

## 33. Motion tracks start at the next frame timestamp, with no start-time option

- **Needed:** bklit's `useMountProgress` (motion) starts its clock at the mount effect's `performance.now()`.
- **1.0 behaviour:** `runTracks` starts at the first rAF timestamp after scheduling (`start ??= time`), with no way to pass a start time. Migrated entries trail bklit by 2–33 ms (polar family, funnel). bklit's steep [0.85,0,0.15,1] ease makes that visible mid-reveal.
- **Measured lead, not just trail (choropleth, headless Chrome):** the rAF callback timestamp `runTracks` takes is the vsync queued behind a long task, so an update made at the end of the mount's long task starts a track at a time *before* that update (choropleth fade started at about 35 ms from Re-run, while the update that shows the layer ran at about 110-140 ms). The fade then led bklit by 40-145 ms and was cut early. motion's clock is `performance.now()` at `animate()` (motion-dom AsyncMotionValueAnimation.mjs:34, :81-86) and at each frame (frameloop/batcher.mjs:22-24).
- **Workaround:** none for marks generally (a negative delay or a rAF driver is banned); accepted within the ±50 ms band. **Choropleth (in place, pending lead ruling):** the fade tween's `easing` function ignores the renderer's progress and samples bklit's curve on `performance.now()` since the passive effect after the commit that shows the layer (`choropleth-chart.tsx` layerMotion). The track is bounded by the isLoaded window plus the curve and cut by the `loaded` update (`false` motion = snap), as bklit swaps in its static layer (choropleth-feature.tsx:381-385). No timer, no tuned delay.
- **Proposal:** an `startAt`/`now` option on motion transitions (or start the clock at schedule time, `performance.now()`, not the frame timestamp).

## 34. Keyboard navigation is one-dimensional (no 2-D grid navigation)

- **Needed:** the heatmap is a week-column grid. ArrowLeft/Right should move by week column (±7 days) and ArrowUp/Down by day within the column. bklit has no keyboard, so this is the accessibility expectation rather than parity.
- **1.0 behaviour:** `chartPointFromNavigationOrder` / `chartPointFromSceneOrder` (charts-core `interaction.ts`) map ArrowRight and ArrowDown to +1 and ArrowLeft and ArrowUp to −1 over one list. A focus strategy can only reorder that list, so one axis always moves the wrong way.
- **Workaround (in place):** `heatmap/chart.tsx` handles the four arrows in a capture-phase `onKeyDownCapture` on the chart host it owns (an ancestor of the renderer's container, so it runs before the renderer's own `keydown` listener). It reads the current cell from `onFocusChange` (pointer or keyboard, so hover→arrow continues from the hovered cell), finds the target in the `onRender` scene's points by (column, row) — ±1 week column on the same weekday, ±1 day in the column, skipping missing/ghost bins, clamping at the edges — and calls the public `interaction.setControlledFocus(point)`, then `preventDefault` + `stopPropagation` so the renderer's 1-D step never runs. Tab-in, Home/End and Enter stay on the native `focus.navigation` order. Controlled focus is not keyboard-owned, so the renderer's focusout clear skips it; the host's `onBlur` clears it with `setControlledFocus(null)` (released on the next pointer move, where hover takes over). Visuals at the focused cell are the native focus paint (tooltip, `data-hm-active` highlight), identical to hover.
- **Proposal (cleaner native API):** an optional `navigate(points, current, key)` on `ChartFocusStrategy`, or a 2-D `navigation` result (rows × columns), so grid charts get 2-D arrows on the renderer's own keyboard owner (focusout clear, `'keyboard'` focus source) without a host keydown.

## 35. Sunburst arc tweens need private geometry metadata; no public enter-from or exit-to geometry

- **Needed:** bklit animates sunburst sectors along their arcs toward geometry the chart chooses. On entrance each sector
  sweeps clockwise from its own leading edge at full radii (bklit `sunburst.ts:423-432`). On zoom, a sector that leaves
  collapses to a point at full opacity (`pointGeometry` `sunburst.ts:259-264`, `transitionGeometry` `:284-285`).
- **1.0 behaviour (verified):** the arc tween (`addSemanticPathUpdateTrack`, `charts-core/src/motion.ts:2386-2399`) runs only
  when both scenes carry `[startAngle, endAngle, innerRadius, outerRadius]` plus a projector under the `scene-motion-node`
  symbol. Only the native sunburst sets path geometry there (`hierarchy-sunburst.ts:301-311`; bar sets a baseline only, `bar.ts:385-387`). The symbol is
  declared in `scene-motion-internal.ts:3` and exported from no package entry, so a custom mark (`guides/custom-marks-and-renderers.md:13`,
  "private scene compiler state") cannot set it. `motion()` and mark `motion` choose only timing (`reference/motion.md`,
  `ChartMotionTiming`), and `path: 'morph'` interpolates path commands numerically, which moves vertices along chords, not
  arcs. A leaving sector with no painted ancestor in the next scene only fades (`hierarchyMotionRelation`, `motion.ts:2770-2800`;
  exit track `:2698-2735`). On drill-in, the siblings of the zoom target have no painted ancestor, so they fade instead of collapsing.
- **Workaround:** `reshape` (`charts/sunburst/sunburst-mark.ts`) is the only reader of the symbol. It finds it by description,
  copies the area with new geometry values and a re-projected path, and leaves the sector unchanged if the symbol is absent.
  `seedSector` uses it for the first-paint sliver (item 16) and `collapsedSector` for the zoom-exit ghost.
- **Public-path re-check (phase 8, status: still open, violation stays):** tried every documented route. (a) Custom mark / `decorative()` wrapping: scene nodes are plain `SceneArea` with a `path` string; the arc tween exists only for nodes carrying the private `sceneMotionNode` metadata (`motion.ts:2386-2399`, `:2593-2625` for enter-from-ancestor, `:2698-2720` exit). (b) Without it, an area morphs by `path: 'morph'` (`motion.ts:3773`), i.e. numeric interpolation of a fixed command skeleton: vertices travel straight chords, so a sector sweeping from a sliver to a wide span (or collapsing to a point on a different angle) cuts through the centre instead of following its arc; the native sunburst path also uses arc commands whose flags do not interpolate. Emitting our own fixed polylines (as the pop overlay does) for all sectors would drop the native arc tween for ordinary zoom retargets too. (c) Seeding via a collapsed first definition (`polar` start/end angles) makes all sectors sweep from one angle, not each from its own leading edge. (d) `motion()`/mark `motion` select only timing and `path` mode (`reference/motion.md`). (e) Native initial entrance is a group radial-sweep clip (`motion.ts:1640-1700`), not per-sector. No public mechanism reproduces bklit's per-sector sweep or exit collapse with arc fidelity.
- **Proposal:** public `enter: { from }` and `exit: { to }` geometry callbacks on partition marks, returning
  `[startAngle, endAngle, innerRadius, outerRadius]`, or export the path-geometry metadata as a documented scene-node field.

---

Unverified or LOG-only: items 7, 12, 14 and the perf numbers in 2 and 4. No code was changed and nothing was committed.

## 36. Cartesian marks have no class hook; CSS can only reach their nodes through the undocumented `data-ts-key` encoding

- **Needed:** bklit styles chart parts with stylesheet rules (hover dim of a series, tick-label fades, pill parts, marker groups, reference areas). The migration keeps those visuals in CSS where mark `states` would cost a whole-scene reconcile per pointermove (gap #1, #31).
- **1.0 behaviour:** only polar, sunburst and geo marks document a `className` option (`reference/marks/polar.md:42`, `sunburst.md:102`, `geo.md:52`). Line, area, dot, rule, text, bar and axis/focus-guide nodes get a fixed `ts-chart__*` class from core (e.g. `bar.ts:399`, `area.ts:271`) plus a `data-ts-key` built from the mark `id`. The key format is not documented (`guides/custom-marks-and-renderers.md:410` only promises it is stable for reconciliation).
- **Workaround (in place):** selectors on `data-ts-key` prefixes/suffixes built from our own mark ids, each block commented `gap #36`. Where a documented `className` exists (polar/sunburst/geo) it is used instead.
- **Also reached (B3 audit, 1.1.0):** the group containers `.ts-chart__marks`, `.ts-chart__grid`, `.ts-chart__axes`, `.ts-chart__focus-layer`, `.ts-chart__focus-guide-layer` and the crosshair parts (`.ts-chart__crosshair*`); `reference/` documents only `ts-chart-host`, `ts-chart-surface`, `svg.ts-chart`, `ts-chart-tooltip`, and the polar/geo marker classes.
- **Proposal:** a `className` option on every mark (and on axis/focus-guide parts), or a documented key format.

## 37. No documented per-show tooltip state: the first-anchor settle glide needs a hand-set attribute and a forced style read

- **Needed:** bklit's TooltipBox mounts each show at a default 180x80 placement and, from its layout effect, retargets the position spring to the measured placement, so the first panel glides into place (`tooltip-box.tsx:94-95` initial size refs, `:96-115` default-size target and springs, `:117-135` layout-effect measure and retarget, `:221` entrance scale/offset). Later anchors use the native tooltip motion.
- **1.0 behaviour:** the tooltip options (`focus-and-interaction.md:812-825`) are static: `className` is appended once, `placement`/`offset`/`content` are not per-show, and the `portal` extension (`ChartTooltipPortalExtension`, `create`/`position`/`hide`) is position-only. It exposes the tooltip `element` but documents no show/hide state class, no transition control, and no way to commit an intermediate placement before the final one in the same frame.
- **Workaround (in place):** `kit/tooltip/bklit-tooltip-portal.ts` places the element at the default-size position, forces one style read (`getComputedStyle(element).left`), sets `data-bkm-settle`, then places at the measured size; `styles.css` (`.ts-chart-tooltip[data-bkm-settle]`) carries the sampled 900ms spring transition. `hide()` removes the attribute.
- **Proposal:** a documented `data-state`/`data-first` marker (or class) on the tooltip element for the first position of a show, or a `motion` option on `tooltip` for position transitions.

## 38. No documented motion-finished signal

- **Needed:** a way to know when a chart's entrance (or any scene motion) has finished, for state that follows the motion
  rather than a fixed duration.
- **1.0 behaviour:** the motion loop sets `data-ts-motion-state="running|finished"` and `data-ts-motion-progress` on the
  root (`charts-core/src/motion.ts:3985-4010`) and calls an internal `lifecycle.finish`, but neither the attributes nor a
  callback appear in `docs/` (grep `motion-state` / `motion-progress`: no hits), so reading them is private state (rule 3).
- **Current code:** not blocking parity. bklit's own `isLoaded` / ready flags are `setTimeout(animationDuration)` (e.g.
  `use-chart-phase-orchestrator.ts:164-169`), so the migrated ready flags (`kit/entrance/reveal-arm.tsx` `useReadyGate`,
  `bar-chart.tsx`, `scatter-chart.tsx`, `candlestick-chart.tsx`) are rule-4 timers that cite that source, not motion workarounds.
- **Proposal:** document the root `data-ts-motion-state` attribute, or add an `onMotionEnd` / `motion.finished` promise
  to the chart instance.

## 39. No touch focus lifecycle (touch-start focus, lift clear, two-finger clear)

- **Needed:** bklit's touch handling (`use-chart-interaction`): one finger focuses the nearest point on touch start and
  follows it, two fingers clear the tooltip, lifting any finger clears, and the tap's compat `click` must not re-focus.
- **1.0 behaviour (verified):** the renderer listens to `pointermove` / `pointerdown` / `pointercancel` / `click` on its
  container (`charts-core/src/renderer.ts:916-920`). `pointermove` follows a touch pointer like a mouse, but `pointerdown`
  only updates the free cursor (`:711-716`) and focuses nothing; there is no multi-touch or lift handling, and the click
  handler re-focuses after a tap. `continuousCursor` (`reference/focus-and-interaction.md:553-585`) handles touch preview
  and tap commit, but it tracks an unsnapped value pair "without creating a focus", so it cannot drive the datum tooltip.
- **Workaround (in place):** `kit/cartesian/touch-focus.ts` adds host listeners and drives the public controller
  (`resolvePointer` + `setControlledFocus`, clear with `setControlledFocus(null, { source: "pointer" })`), swallowing the
  touch-originated click. No renderer DOM is touched.
- **Caveat (checked on main 57774e14):** the documented route for app-owned touch is `pointer: false` plus
  `resolvePointer` / `setControlledFocus` (`docs/guides/tooltips-and-focus.md:320-332`), but `pointer: false` also turns
  off native mouse hover: `handlePointerMove`, `handlePointerDown` and `handleClick` return early (`charts-core/src/renderer.ts:747`,
  `:758`, `:825`). So that route means re-implementing mouse hover too; ours keeps native pointer handling and adds touch
  listeners alongside. Not filed: the route is documented, so this is a trade-off, not a missing capability.
- **Proposal:** a `pointer: { touch: 'scrub' }` option (focus on down, clear on up/second finger), or a documented
  `pointerType` hook on the renderer's pointer handlers.

## 40. brushX owns the whole plot and cannot coexist with hover focus; no transient drag-range gesture

- **Needed:** bklit's main-plot drag selection (`use-chart-interaction.ts:176-185, 207-230`): press-drag over the plot reports an
  unsnapped x range while the hover tooltip, crosshair and focus stay at the last hovered x; the range lives only while the
  button is held (cleared on release, leave, touch end); two fingers also set it (`:233-270`). It drives a plain fading rect
  (`segment.tsx:25-43`), not a brush with handles.
- **1.0 behaviour (verified in source):** `brushX` (`charts-core/src/interaction-brush.ts`) mounts a full-host SVG overlay with
  `pointerEvents:auto` (`:252-259`). The renderer treats every event inside a control as control-owned: `pointermove` clears
  hover focus (`renderer.ts:694-700`); click, keydown and focus-in are ignored (`:778`, `:834`, `:888-894`). Over the plot it
  would disable native hover, tooltip and crosshair everywhere. The brush is also persistent and controlled (keeps a range
  after release, a blank click commits a zero-width range `:398-405`, handles and selection-move `:647-667`), single-pointer
  (`touchable(true)`, `:273`), and its `.selection`/`.handle` rects are renderer-owned, so restyling them breaks rule 2.
- **Workaround (in place):** `kit/cartesian/drag-select.ts` host capture listeners (pointer drag, two-finger touch via
  `touch-focus.ts`) publish raw plot-space px as host attributes and CSS vars. No renderer DOM is touched.
- **Proposal:** a `brushX` mode `{ overlay: 'drag', persistent: false, handles: false }` whose control claims the pointer only
  while a gesture is active, with two-pointer touch; or a documented opt-out from `controlContains` for non-gesture moves.

## 41. Pointer leave clears only pointer-owned focus; a controller-set hover focus outlives the pointer

- **Needed:** bklit's sunburst keeps hover on the sector under a still pointer after a zoom, and drops it when the pointer leaves.
- **1.0 behaviour (verified):** the container's `mouseleave` handler `clearPointerFocus` (`charts-core/src/renderer.ts:718-728`,
  bound at `:919`) acts only when `focusOwner === 'pointer'`. A focus re-resolved for a still pointer after a definition change
  has to be set through the controller (no pointer event fires), so it is not pointer-owned and survives the leave, keeping the
  tooltip and dim.
- **Workaround (in place):** `sunburst-chart.tsx` host leave listener clears a non-keyboard focus through the public controller
  (`controller.setState(null)`). No renderer DOM is touched.
- **Proposal:** a documented "re-resolve focus at the last pointer" call that keeps pointer ownership, or a `source: 'pointer'`
  option on `setControlledFocus` that hands ownership to the pointer.

## 42. A pointer pass drops a keyboard focus; the controller cannot hand focus back to the keyboard

- **Needed:** a keyboard-held focus survives the pointer crossing the chart, and the next arrow continues from it.
- **1.0 behaviour (verified):** `handlePointerMove` makes the pointer the focus owner and replaces `focusedPoint`; `clearPointerFocus`
  (`charts-core/src/renderer.ts:718-733`) then empties it on leave, and the next arrow steps from `focusedPoint`
  (`interaction.ts` `chartPointFromNavigationOrder`: no current point -> index 0). `ChartControlledFocusOptions.source` is typed
  `'pointer' | 'programmatic'` (`dom-types.ts`), and a controller-set focus is `focusOwner = 'controlled'`, which the blur clear
  (`renderer.ts:738`, keyboard-owned only) skips.
- **Workaround (in place):** `kit/cartesian/keyboard-hold.ts` remembers the last navigation-key point, keeps empty-plot pointer moves from
  the renderer, and restores the held point through `setControlledFocus` (runtime `source: 'keyboard'`, cast past the narrower type)
  when the pointer leaves; it clears its own restore on blur. The leave restore runs in a capture listener on the host for the
  `.ts-chart-surface` pointerleave/mouseleave, i.e. before the renderer's own `mouseleave` clear on that container: the controller
  then owns the focus, the clear skips it, and no empty focus (or `onFocusChange(null)`) is ever committed. Public controller only;
  no renderer DOM.
- **Proposal:** the renderer remembers the keyboard focus across a pointer pass (restore on leave), or `setControlledFocus` accepts
  `source: 'keyboard'` and hands keyboard ownership (so blur clears it and Escape applies).

## 43. Focus-guide motion restarts every presentation frame while data motion runs

- **Needed:** the pointer crosshair (rule, its pill and the marker) glides to the pointer on a spring, as bklit's liveline crosshair
  does (`crosshairSpringConfig` {stiffness 300, damping 30}, live-x-axis.tsx:12), while the series keeps rolling.
- **1.0 behaviour (verified):** with data motion in flight, focus guides are repainted on every presentation frame
  (`charts-core/src/motion.ts:1088-1104`). Each repaint re-runs the guide tracks, and `runTracks` anchors at the first frame it sees
  (`start ??= time`, motion.ts:3990), so a guide spring restarts at elapsed 0 every frame and never advances (measured rule x
  256, 267, 293, 293, … for a 300px step).
- **Workaround (in place):** live-line-chart.tsx runs a host-side spring built from the public `createChartSpring`
  (`@tanstack/charts/spring`), carrying velocity across retargets, and writes its remaining lag to `--bkm-pgx`/`--bkm-pgy` in the same
  event. liveline.css translates the rule, pill and marker by that lag under `data-bkm-pglide`, which is never set during keyboard
  focus. Public API and CSS variables only; no renderer DOM.
- **Proposal:** a guide repaint caused by data motion keeps the guide tracks' start time and velocity (retarget rather than restart),
  or focus guides accept a motion option that is independent of the presentation-frame repaint.

## 44. The default tooltip content is built on every paint even when a custom body renders the panel

- **Needed:** a custom-body tooltip (`renderTooltipBody`, every migrated chart) costs only its own body per pointermove.
- **1.0 behaviour (verified):** `tooltip.ts` `paint` calls `createChartTooltipContent` (tooltip.ts:116-122) before
  `renderTooltipBody`, with no option to skip it. With no `content`/`format`/`formatGroup`, that runs `defaultTooltipContent`
  (tooltip-model.ts:171) and `formatChartTooltipValue` per row: ~6 ms per 100 moves on liveline (CDP profile, 300 moves). The
  result is not discarded: `renderTooltipBody` passes it to `setTooltipContentAccessibility` (tooltip.ts:285, 724-740), which
  writes it as the tooltip's `aria-label`, and to the body context.
- **Workaround:** none. The public `content`/`format`/`formatGroup` options (focus-and-interaction.md:822-828) only replace the
  model; a cheaper stand-in would change the tooltip's accessible label, so the default stays.
- **Proposal:** build the content lazily (on first read of the body context's `content`, and for the accessible label only when
  the body reports changed), or let a custom body supply the accessible label.

## 45. Focus callbacks are deduped by datum identity, so a continuous pointer x between points is never reported

- **Needed:** live-line's crosshair and pill follow the pointer between samples (bklit live-line tracks raw pointer x).
- **1.1.0 behaviour:** `notifyFocus` in `renderer.ts` fires `onFocusChange` only when the focused point identity (key, markId,
  datumIndex) or the `datum` object changes; pointer moves inside one point's hit region produce no callback and no x.
- **Workaround:** live-line keeps a pointermove listener on the host (`live-line/live-focus.ts`) for the raw x; focus identity
  still comes from the controller.
- **Proposal:** expose the pointer position (plot-space x/y) on the focus event, or an opt-in `onPointerMove` with scene coordinates.

## 46. The focus strategy cannot tell a pointer move from a click

- **Needed:** bklit's sunburst keeps hover on the last sector over the hub and the gaps, but a click on the hub must still zoom out, and a click on a leaf or the gaps must do nothing.
- **1.1.0 behaviour:** `ChartFocusStrategy.resolve` receives `{ x, y, maxDistance }` only (`types.ts:2095-2117`). `handlePointerMove` (`renderer.ts:739-753`) and `handleClick` (`renderer.ts:823-870`) both reach it through `pointsAtPointer` (`renderer.ts:644-648`) and `resolvePointerFocus` (`renderer.ts:1169`), so a hold-off inside the strategy would also hold the hub click.
- **Workaround:** capture-phase `pointermove` and `click` listeners on the host in `showcase/migrated/charts/sunburst/focus.ts` (click-only zoom guard and hold-off-sector rule).
- **Proposal:** add the event kind (`'move' | 'click' | 'keyboard'`) to `ChartFocusResolveContext`, or pass the previous focus (see #26).

## 47. area-x and rect marks have no scale-about-centre enter

- **Needed:** bklit's gauge notches enter from scale 0 and opacity 0 to 1 about each notch's own centre, with a per-notch delay.
- **1.1.0 behaviour:** the generic enter track for an element is an opacity-attribute tween only (`motion.ts:2597-2635`); no scale or transform enter exists for area-x or rect marks, and `ChartMotionTiming` carries only `delay`, `transition` and `path` (`types.ts:872-877`). The bar, line and area sweeps (`motion.ts:1505-1560`) do not apply to these marks.
- **Workaround:** fixed scoped CSS keyframes keyed on `data-ts-key` (`showcase/migrated/charts/gauge/enter-css.ts`, gap #36), with `:nth-child` delays and entrance origins aligned on motion's clock.
- **Proposal:** an `enter` option on `motion()` marks (`from: { scale, opacity }`, `origin: 'center'`, per-datum delay), or a documented per-element enter transform.

## 48. No documented way to change a custom circle's radius on hover

- **Needed:** bklit's actionable marker disc lifts its shadow circles on hover (radius from rest to hot), springing alongside the disc's scale.
- **1.1.0 behaviour:** `SceneStyle` (`types.ts:1394-1404`) has no `r` key or custom-property channel, and mark `states` (`ChartMarkStateStyle`) carry no geometry either (see #16). The circle's `r` is a renderer-set attribute.
- **Workaround:** `showcase/migrated/charts/kit/motion/marker-springs.ts` (`springAct`) reads the attribute back, holds the hot radius as inline `style.r` on the renderer-owned node and springs it with the Web Animations API.
- **Proposal:** a radius (or generic geometry) key in `SceneStyle` and mark state styles, or a documented per-mark CSS custom property for the radius.

## 49. A scene group's `clip` is a rectangle only

- **Needed:** bklit clips the bar-depth pulse wave to the bar's 3D silhouette (front face, side face and lid), via a `<clipPath>` holding a path (bklit `bar-depth.tsx:964-966`, applied at :1045, relied on at :1062).
- **1.1.0 behaviour:** `SceneGroup.clip` is `ChartBounds` (`types.ts:1500`, `x/y/width/height`). The SVG renderer always emits `<clipPath><rect .../></clipPath>` (`svg-renderer.ts:169-176`), the canvas renderer `context.rect(...)` plus `clip()` (`canvas.ts:1243-1251`), and hit testing intersects bounds (`nearest.ts:200-203`). The only `<clipPath>` with a path is private to the arc enter sweep (`motion.ts:1653-1663`). No scene node carries a path clip, mask or `clip-path` style (see also #10).
- **Workaround:** `showcase/migrated/charts/bar/depth.ts` clips the pulse group to the front-face rect only, so the wave does not light the side face or lid (accepted divergence).
- **Proposal:** allow `clip` to be a rect or a path (`{ path: string, fillRule? }`), rendered as the `<clipPath>` child and `Path2D` clip on canvas, with bounds derived for hit testing; or the generic `resources` slot from #10.

## 50. No documented signal that a node is mid-tween (`data-ts-motion-role`)

- **Needed:** CSS transitions and hover springs for bklit's hover dims (bar, candlestick, composed, radar, ring, pie, funnel, heatmap, sankey, liveline tick fade, markers) must not fight a native motion track on the same node: a CSS `transition` on `opacity` chases the renderer's per-frame writes.
- **1.1.0 behaviour:** the renderer tags a node that has a live motion track with `data-ts-motion-role` and removes it when the track ends (`charts-core/src/motion.ts`); the attribute is absent from `docs/` (grep `motion-role`: no hits). CSS reads it as `:not([data-ts-motion-role])`, and a few TS sites read it with `hasAttribute` (`kit/motion/marker-springs.ts`, `kit/polar/polar-dim.ts`, `ring/ring-springs.ts`, `radar/hover-springs.ts`, `sunburst/zoom.ts`).
- **Workaround:** keep the guard, each site commented `gap #50`. There is no class or event alternative: a fixed delay would be a rule-4 timer with no bklit source.
- **Proposal:** document the attribute as public, or expose a per-node state (`data-ts-motion="running"`) plus a transition-friendly way to opt a mark out of tweening a property. Related: #38 (no motion-finished signal on the root).

## 51. radialArc carries no arc geometry for the motion tween (ring progress arcs, pie)

- **Needed:** bklit sweeps each ring progress arc by drawing a fresh d3 arc per frame (`cornerRadius = thickness / 2`) from the start angle to `start + range * progress`, so the leading cap stays round (bklit `ring.tsx:104`; nothing is drawn until the sweep passes 0.01 rad). Pie wedges tween the same way.
- **1.1.0 behaviour:** the same mechanism as #35. The arc tween runs only for nodes carrying the private `scene-motion-node` geometry (`motion.ts:2386-2399`), and `radialArc` sets none (`polar.js`: it emits a plain `SceneArea` with `path`). `motion()` selects timing only, `path: 'morph'` moves vertices along chords, and the radialArc enter is a group wedge clip (`motion.ts:1640-1700`) that cuts the round cap flat.
- **Workaround:** `ring/progress-layer.ts` renders the progress marks through a documented custom layer renderer (`renderer` on a radial mark, `reference/marks/polar.md:139`; `ChartLayerRenderer`, `reference/rendering-and-export.md:537-570`). The layer paints its own SVG and animates `d` on nodes it owns. Composition borrows the Canvas compositor (`canvasChartRenderer.compose`), the only exported one. Costs: the Canvas module is bundled, and all tracks paint under all progress arcs (layers split by mark order).
- **Proposal:** the same as #35 (public enter-from geometry, or a documented arc-geometry scene field), plus an exported layer compositor so a custom layer need not borrow the Canvas one.

## 52. No HTML or foreignObject scene node (marker `icon` ReactNodes, `iconFill`)

- **Needed:** bklit renders each marker's `icon` ReactNode (an SVG or HTML element) inside the marker disc through `foreignObject`, and `iconFill` makes the icon fill the disc instead of the 4 px inset (bklit `markers/marker-group.tsx:254`, `:358`, `:423`, `:474`).
- **1.1.0 behaviour:** `SceneNode` is `group | rule | polyline | area | dot | rect | label` (`types.ts:1599-1606`); none embeds HTML or foreign content, and a `label` is plain text. The tooltip body is the only per-datum HTML slot.
- **Workaround:** `kit/cartesian/overlays.ts` draws icons as label text; ReactNode icons are not supported (only strings and numbers render), and `iconFill` is accepted but inert.
- **Proposal:** an HTML/`foreignObject` scene node (position, size, a React or DOM child), or a documented custom-renderer slot for per-datum HTML that follows the scene's layout and motion.

## 53. A state-only focus change runs a full motion update and re-render

- **Needed:** hover emphasis from mark `states` without re-tweening unchanged geometry.
- **1.1.0 behaviour:** `resolveMarkStateScene` returns a fresh scene for any chart whose scene has a group with `states` (`mark-state.ts:34`, `:107`), so `applyStateFocus` takes the `presented.scene !== scene` branch and re-renders and reconciles (`motion.ts:903-932`). With animation on, that is the `'update'` phase over every node (sunburst hub `states`: about 4,400 `d` writes per hover, D775).
- **Audit (fx-st, Chrome, :5265):** the only `states` left in `migrated/charts` is the radar interactive-label mark. Radar hover costs 1 to 4 attribute writes per move (label `fill` plus `data-ts-motion-*` markers; one motion cycle only when the hovered label changes), 0 on leave and on keyboard arrows. Radar's update motion is already `false`. Kept. Every other chart uses host-attribute CSS (gaps 1, 31) or no states.
- **Proposal:** return the same scene when no state matches, or restyle only matching nodes outside the update tween. Draft: `docs/upstream-issues/16-state-scene-update-cycle.md`.

## 54. Grid and guide lines have no `shape-rendering` channel

- **Needed:** bklit's grid rows render with `shapeRendering="crispEdges"` (the visx GridRows default), so each hairline paints one crisp device row.
- **1.1.0 behaviour:** `ChartGuideLineStyle` is `stroke | strokeOpacity | strokeWidth | strokeDasharray | lineCap` (`charts-core/src/types.ts:419-425`), with no rendering hint. Native grid lines anti-alias across two device rows at half intensity.
- **Workaround:** `styles.css` sets `shape-rendering: crispEdges` on `.ts-chart__grid line`, a class-keyed rule on renderer-owned DOM.
- **Proposal:** a `shapeRendering` field on `ChartGuideLineStyle` (or a generic SVG presentation passthrough on guide lines).
