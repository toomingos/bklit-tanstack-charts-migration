# Upstream gaps: TanStack Charts limitations behind the custom code

Verified against TanStack Charts **1.1.0** (tag v1.1.0, 57774e14), 2026-10-11. Every source reference below is
`repos/tanstack-charts/packages/*` at that tag. Code is cited as `UPSTREAM-GAPS #NN`; paths under `showcase/` are
`showcase/migrated/charts/`. Measured costs come from the Live Perf panel and Chrome profiles. Each entry is written to be lifted into an upstream issue.

## At a glance

43 open gaps. 29 are covered by a posted upstream issue or comment, 14 are not.
Numbers are stable: 12 retired numbers are listed at the bottom and never reused.

| Area | Gaps | Count |
|------|------|-------|
| Mark states, reconcile and per-move cost | 1, 3, 20, 21, 31 | 5 |
| Tooltip | 8, 19, 22, 23, 37 | 5 |
| Focus strategy, keyboard, touch, brush | 26, 34, 39, 40, 42, 45, 46 | 7 |
| Focus guides | 30, 43 | 2 |
| Motion coverage and timing | 5, 7, 9, 12, 18, 33, 38, 47 | 8 |
| Arc and partition geometry | 11, 35, 49, 51 | 4 |
| Rolling windows | 17, 27 | 2 |
| Bar geometry | 15, 24, 25 | 3 |
| Paint, scene nodes, rendering hints, children slot | 6, 48, 52, 54, 55 | 5 |
| Renderer DOM (undocumented classes and attributes) | 36, 50 | 2 |

Posted upstream (TanStack/charts):
#186 states (1, 18, 31; 48 as a comment) · #187 tooltip (3, 8, 19, 22, 37) · #188 focus guides (21, 23, 43) ·
#189 keyboard focus (42) · #190 focus strategies (26; 45 and 46 as a comment) · #191 gradients and paint (5, 6, 30; 49 as a comment) ·
#192 motion timing (9, 33, 38) · #193 motion coverage (7, 12; 47 as a comment) · #194 arc motion (11, 35; 51 as a comment) ·
#195 rolling windows (27) · #196 renderer DOM (20, 36; 50 as a comment) · #197 bar rect geometry (24, 25) · #198 brush (40) ·
#199 shape-rendering (54) · #200 HTML scene node (52).
Not posted: 15 and 55 (no draft yet), 17 (draft pending), 34 (open upstream PR #164), 39 (a documented route exists, see its caveat).
Drafts live in `docs/upstream-issues/` (local only).

---

## 1. Mark `states` re-render and reconcile the whole scene on every pointermove

- **Needed:** bklit dims/emphasises per-datum on hover (scatter, candlestick, bar, heatmap, choropleth, composed). The natural expression is mark `states`.
- **1.1.0 behaviour:**
  - `applyStateFocus` (`charts-core/src/motion.ts:889`) runs `resolveMarkStateScene`, `resolveFocusScene` (:898), then `renderSvg` (:918) and `animateSvg` (:921) on every state-focus change.
  - `resolveMarkStateScene` (`mark-state.ts:28`) maps the node tree and builds fresh `transitions`. Only the early-out at :33-34 (no focus, or `sceneHasMarkStates` false, :111-117) returns the same scene. When states are declared but none match, the result is still a new scene, so `presented.scene !== scene` (motion.ts:903) is true and a full re-render + reconcile runs.
- **Workaround:** fixed host-attribute CSS (`hoverStaticCss`, `kit/cartesian/hover-css.ts:159`, emitted from `host-style.ts:32`; host writes in `hover-host.tsx`; bar targets `bar/hover.ts`). Native `states` stay only on radar interactive labels (`radar/definition.ts:175`): 1 to 4 attribute writes per move, none on leave or keyboard arrows, update motion off. Pie, ring and funnel pops run as WAAPI springs.
- **Cost:** choropleth hover render 888 ms to 12 ms after moving hover out of the definition; heatmap dim/pop script time 8-10x the no-effect cost before the CSS path. A sunburst hub `states` was about 4,400 `d` writes per hover.
- **Proposal:** (1) return the input scene (same identity) when no node resolved a state, sharing unchanged subtrees; (2) in `applyStateFocus` skip `renderSvg`/`animateSvg` when `presented.scene === scene`; (3) better, patch only affected elements' presentation attributes with the existing track machinery.

## 3. react-charts tooltip body keeps its target in `useState` inside the chart wrapper; `DefaultTooltipBody` is not exported

- **Needed:** tooltip body React content that does not re-render the chart on every hover change, and the stock body markup to compose with.
- **1.1.0 behaviour:** `react-charts/src/tooltip.tsx:152` holds the target in `useState`; `onChange` (:157-162) sets it, re-rendering the wrapper. `RendererChart.tsx:162-165` builds a new `hostOptions` each render and the layout effect (:177-187) calls `adapter.update(hostOptions)` (:182). `DefaultTooltipBody` (`tooltip.tsx:182`) is not exported. `onTooltipBodyChange` (`Chart.tsx:63`) is public but undocumented.
- **Workaround:** `kit/tooltip/tooltip-leaf.tsx` renders the core `Chart` (`@tanstack/react-charts/core`) with a stable `onTooltipBodyChange` writing into a ref store; only a leaf (`useSyncExternalStore`, :131) subscribes and portals the body. Default body classes/vars are reproduced (:72).
- **Cost:** pointermove p95 2-6x lower; removes a forced style recalc and a second guide reconcile per move.
- **Proposal:** memoize `hostOptions` or skip `update` when only callbacks changed; keep the target in a store read by a leaf; export `DefaultTooltipBody`; document `onTooltipBodyChange`.

## 5. No gradient motion (stop offsets/opacity patch instantly)

- **Needed:** liveline area fade whose end moves smoothly as the y domain rolls; bklit's 0.2 s fade between profit and loss halves of a mixed-sign line gradient.
- **1.1.0 behaviour:** `motionAttributes` (`charts-core/src/motion.ts:2069-2090`) lists only geometry/opacity attributes; no stop attributes. Gradients come from static `stops` (`svg.ts:30-47`, `types.ts:636-660`).
- **Workaround:** CSS `transition: stop-opacity` on the stops (`kit/cartesian/hover-css.ts:145-152`); liveline area fade as a CSS mask ramp whose ends are host vars updated per tick (`live-line/liveline.css:108-130`, `live-host-style.ts:20`).
- **Cost:** without the per-tick var the fade end snapped in one frame.
- **Proposal:** treat `stop` `offset|stop-opacity|stop-color` as motion attributes for gradients with the same id in previous and next scene.

## 6. Paint resources: gradients are objectBoundingBox only; no mask, `<pattern>` or filter resources

- **Needed:** grid/crosshair fade-edges, area horizontal edge fade, viewport-pinned gradient stops, PatternArea/PatternLines hatch, Background pattern, SVG filter on the live pill.
- **1.1.0 behaviour:** `ChartLinearGradient` (`types.ts:649-660`) has no `gradientUnits`; `svg.ts:30-47` emits the SVG default (objectBoundingBox), so zero-width/height rules cannot take a gradient. The renderer emits no `mask`, `pattern` or `filter` (only a group `clipPath` rect, `svg-renderer.ts:170-175`). No `<defs>` passthrough. CSS `filter` (glow, drop-shadow: `radar/hover-css.ts:23`) is bklit parity, not a gap.
- **Workaround:** CSS `mask-image` on grid, area and crosshair (`styles.css:73, 92-130, 757-789, 827-832`, `live-line/liveline.css:99-130`); hand-built hidden `<defs>` host for gradients/patterns/filter (`kit/resource-host.tsx`, `background-resources.tsx`, `live-line/live-pill.tsx:9`).
- **Cost:** effects were first dropped, then re-added via CSS.
- **Proposal:** `units?: 'objectBoundingBox' | 'userSpaceOnUse'` on gradients; first-class `mask`/`pattern`/`filter` resources or a generic scene `resources` (`<defs>`) slot referenced by `url(#id)`.

## 7. Scene text has no first-paint enter motion

- **Needed:** bklit fades labels in after the sweep (sankey, sunburst, funnel).
- **1.1.0 behaviour:** first paint builds tracks only for bars, paths, radial paths, arcs and points (`motion.ts:282-287`); none for text. Text joining an already-painted scene fades via `addEnterMotionTrack` (:2155-2159, :2475).
- **Workaround:** CSS late fades (`sankey/sankey.css:46-67`, `sunburst/labels.ts:17`, `funnel/entrance-css.ts:15`).
- **Proposal:** run `text` nodes through the first-paint track builder (same fix as #12).

## 8. Tooltip has no show/hide delay

- **Needed:** heatmap tooltip `showDelay` on first hover and 120 ms `hideDelay` hold.
- **1.1.0 behaviour:** tooltip motion is presence/position with duration/easing only (`motion.ts:343`); no delay option.
- **Workaround:** hide: hold tween as `tooltip.motion` (`heatmap/definition.ts:47,411`). Show: CSS keyed on host var `--hm-show-delay` (`styles.css:265-272`).
- **Proposal:** `tooltip: { showDelay, hideDelay }`.

## 9. Native spring default rest thresholds run long

- **Needed:** springs that settle when visually still, as in motion.
- **1.1.0 behaviour:** `spring.ts:32-33` defaults `restSpeed: 0.01`, `restDelta: 0.005` (motion uses 2/0.5 in pixel space, granular only under 5 units of travel).
- **Workaround:** pixel rest thresholds on every mapped spring: `kit/motion/spring-curve.ts:11-27` plus `kit/theme.ts:69`, `kit/cartesian/date-pill.ts:85`, `kit/motion/guide-motion.ts:7`, `live-line/live-yaxis.ts:77`, `sankey/entrance.ts:10`, `radar/definition.ts:29`, `gauge/transition.ts`.
- **Cost:** candlestick settle inflated ~950 ms; springs ran ~1 s after visual rest.
- **Proposal:** scale defaults to the animated unit or document pixel-scaled thresholds.

## 11. Sunburst has no per-arc enter stagger

- **Needed:** bklit staggers sectors on entrance.
- **1.1.0 behaviour:** one arc group per sunburst (`hierarchy-sunburst.ts:322-327`); `createArcTracks` (`motion.ts:1618-1700`) makes one track with `datumIndex 0`/`datumCount 1`, so `delay(context)` cannot differ per sector.
- **Workaround:** custom sector layer with per-sector delays (`sunburst/sunburst-layer.ts:128`, `definition.ts:96`) plus CSS grow with host vars (`intro.ts:20-22`).
- **Proposal:** one arc track per sector with real `datumIndex`/`datumCount`.

## 12. Enter motion on first paint exists only for bars, paths, arcs and points; elsewhere only for elements joining a painted scene

- **Needed:** entrance for rect marks (heatmap cells, candles, composed bars) and for groups that appear after first paint.
- **1.1.0 behaviour:** `motion({ initial })` animates first paint (`motion.ts:86,225,978`) but tracks cover only bars, paths, radial paths, arcs and points (:282-287). Rects and text render at rest. On update, an unmatched child is cloned and `addEnterMotionTrack` runs on that element only (:2155-2159); the bar grow branch (:2521-2590) needs the joining element itself to be a bar shape, a new bar group gets only the opacity branch (:2621-2640). Re-renders cancel in-flight entrances; size-only updates snap unless `motion.resize`.
- **Workaround:** paint first with seeds/empty marks and flip state in an effect so they join a painted chart: `heatmap/chart.tsx:593`, `candlestick/definition.ts:49`, `composed/bars.ts:178-181`, `bar/marks.ts:134-140`, `bar/definition.ts:351`; host measured before mount so the definition is not re-resolved mid-entrance.
- **Proposal:** first-paint tracks for rect/text marks; recurse enter tracks into joined groups' keyed children; do not cancel on size-only re-resolution.

## 15. No per-datum pixel adjust on native bar marks

- **Needed:** bklit trims each depth bar's front face by the perspective rise (top moves down a few px).
- **1.1.0 behaviour:** `barY`/`barX` options (`bar.ts:59-82`) expose only `inset`, `maxThickness` and `radius` (shrink-only, `resolveBarThickness` `bar.ts:786-801`); `y1`/`y2` are value-domain channels, so a pixel-sized trim cannot be expressed. The scene returns rect nodes (`bar.ts:363-391`) and only `nodes` (`bar.ts:394-408`), no per-datum pixel hook.
- **Workaround:** the trimmed front face is a custom mark (`depthBarMark`, `bar/depth.ts:308`, used from `bar/definition.ts:166`) built with `createMark`.
- **Cost:** the depth variant re-implements bar geometry instead of using `barY`.
- **Proposal:** a per-datum pixel `adjust(rect, datum)` option on bar marks, or a documented node-transform hook.

## 17. Rolling-path presentation points are static during the roll

- **Needed:** bklit's live tooltip and pill value is interpolated at the pointer every frame while the line scrolls under it.
- **1.1.0 behaviour:** a point with a rolling `transform` outcome is published once at its end-of-roll position and gets no motion track (`motion.ts:3318-3325`). Presentation points publish at start (`motion.ts:3599`) and on track lifecycle events (:3952, :3999, :4021), so nothing fires per frame. The renderer re-resolves focus only from `handlePresentationPoints` (`renderer.ts:1217-1248`). The path element itself is animated.
- **Workaround:** a custom `focus` strategy interpolates the value at the exact pointer x on every resolve (`liveFocus`, `live-line/definition.ts:112-135`). Accepted divergence: a still pointer updates once per roll instead of per frame.
- **Cost:** no overlay or rebuild added; reduced tooltip update rate at a still pointer.
- **Proposal:** publish presentation points per frame for rolling transforms, or expose a refocus/refresh hook.

## 18. Focus-state label opacity is deferred while data motion is active

- **Needed:** hide x tick labels near the pointer on a chart that is always rolling.
- **1.1.0 behaviour:** `paintFocus` stores `pendingStateFocus` and skips `applyStateFocus` while `dataMotionActive` (`motion.ts:1010-1011`, `:1089-1090`); `focusOpacity` (`mark-state.ts:84-86`, `scene.ts:1901`) is therefore not painted during continuous rolling. Docs describe it as running on focus change (`scales-guides-and-color.md:397-405`).
- **Workaround:** one static CSS rule against a pointer var, `TICK_FADE_CSS` (`live-line/live-tick-fade.ts:13`, typed `attr()`), fed from `live-line/live-focus.ts`.
- **Cost:** Chromium-only typed `attr()` (133+).
- **Proposal:** apply `focusOpacity` in the data-motion branch of `paintFocus` as well.

## 19. Repeated `hide()` restarts the tooltip exit animation

- **Needed:** hide the tooltip when the pointer rests outside bklit's hover area on a rolling chart; bklit's TooltipBox has no exit presence.
- **1.1.0 behaviour:** an empty focus makes `handlePresentationPoints` call `hide()` on every presentation frame (`renderer.ts:1223-1248`, `:1258`). `hide()` returns early only once hidden (`tooltip.ts:332-349`); before that each call bumps `hideGeneration` and restarts a full-duration exit from the current opacity (`motion.ts:603-640`), so the exit never completes.
- **Workaround:** `bklitTooltip` (`kit/tooltip/bklit-tooltip.ts:6`): a typed tooltip extension composing stock `tooltip.create` with an idempotent `hide()` using public `update()` with `motion: false` for that call.
- **Cost:** none measured; exit is instant (matches bklit).
- **Proposal:** make `hide()` a no-op while already hiding; allow a separate exit transition.

## 20. Reconcile strips attributes and inline style that the scene does not carry

- **Needed:** per-element hover state (CSS vars, marker attributes) that lives between scene builds, e.g. the focused column's dots, the label set related to a hovered arc, the date-pill x on the tick group.
- **1.1.0 behaviour:** `syncAttributes` (`reconcile.ts:159`) removes every attribute of the live element that the next scene element lacks, `style` included. Focus runs a retarget reconcile on every pointermove (`resolveFocusScene`, `focus-layer.ts:72`), so imperative writes on renderer-owned nodes vanish within a frame or two.
- **Workaround:** all hover state lives on the host we own (attributes + vars) and fixed, index-capped CSS rules select from it (sunburst `LABEL_HIDE_CSS`, `sunburst/labels.ts:15`). Cost: a host var re-matches every descendant that reads it.
- **Proposal:** a documented "foreign attribute" allowance (leave `data-x-*` / `--x-*` alone, or a per-mark `preserveAttributes` list), or a supported per-element state hook that does not rebuild the scene.

## 21. Every pointermove re-reconciles the focus layer, builds default tooltip content and forces a layout read

- **Needed:** hover cost on par with a hand-written d3 chart (bklit runs ~0.5-1.4 ms cheaper per move on the cartesian routes).
- **1.1.0 behaviour:**
  - `resolveFocusScene` (`focus-layer.ts:72-110`) rebuilds the retarget groups whenever focus is set, so the focus reconcile runs even when the focused datum is unchanged.
  - `positionTooltip` reads `offsetWidth/offsetHeight` (`tooltip-position.ts:25-26`) on each placement, forcing style + layout after the reconcile's writes.
  - With a custom body (`renderTooltipBody`, every migrated chart) `paint` still builds the default content first (`tooltip.ts:117-123`; `tooltip-model.ts:50-73`, `defaultTooltipContent` :171), about 6 ms per 100 moves on liveline. It is not discarded: `renderTooltipBody` (`tooltip.ts:270-293`) hands it to `setTooltipContentAccessibility` (:747-760) for the `aria-label`, so a cheaper stand-in would change the accessible label.
- **Workaround:** the layout read is avoided through the documented `tooltip.portal` extension: every migrated tooltip places through a portal that keeps the panel size from a ResizeObserver (`kit/tooltip/bklit-tooltip-portal.ts`; `kit/tooltip/sized-tooltip-placement.ts`, public `resolveChartTooltipPlacement`). Portals receive `schedulePosition` (`dom-types.ts:316-320`), which the core ResizeObserver also drives (`tooltip.ts:173, :187-196`), so a post-body re-place is native. The focus-layer reconcile and default-content build per move are accepted as library-side (`kit/tooltip/tooltip-leaf.tsx:152`).
- **Proposal:** return the previous resolved scene when the focus key is unchanged; build the tooltip content lazily (first read of `content`), or let a custom body supply the accessible label.

## 22. Finished tooltip presence animations stay attached (`fill: 'both'`)

- **Needed:** pixel-exact tooltip text against a plain absolutely positioned div.
- **1.1.0 behaviour:** movement and presence animations use `fill: 'both'` (`motion.ts:471`, `:517`); `onfinish` (:475, :595) clears inline styles and the reference but never cancels the animation, so the root stays in an animated paint state and text lands ~0.25px off a static div.
- **Workaround:** none; accepted as sub-pixel (`heatmap/definition.ts:46`).
- **Cost:** ~0.25px text offset on tooltips.
- **Proposal:** on finish, `commitStyles()` then `cancel()`.

## 23. Guide labels cannot paint above the HTML tooltip

- **Needed:** bklit's date pill (an in-container `z-50` div) paints over the tooltip where they meet.
- **1.1.0 behaviour:** the pill is a native guide label inside the SVG; the tooltip is an HTML element in the container with `z-index: 1` (`tooltip.ts:256-266`, `:421`), so SVG guide labels are always below it. No layer option exists.
- **Workaround:** none; accepted (`kit/cartesian/date-pill.ts:1`).
- **Cost:** a small pixel diff where pill and tooltip overlap.
- **Proposal:** an HTML guide-label layer, or a tooltip layer option.

## 24. Bar width on a continuous scale with one datum is capped at 48px

- **Needed:** bklit's lone candle is `columnWidth * 0.8`.
- **1.1.0 behaviour:** `bar.ts:266`/`:542` use `bandwidth || inferBandwidth`; on a time scale `inferBandwidth` (`bar.ts:853-874`) caps a single datum at 48px (:873); `resolveBarThickness` (`bar.ts:786-801`) can only shrink.
- **Workaround:** none; accepted on the single-candle edge case (`candlestick/definition.ts:269`).
- **Cost:** pixel diff on that edge case only.
- **Proposal:** a `thickness`/`interval` option for bars on continuous scales.

## 25. A scalar rect radius is emitted as `rx` only

- **Needed:** bklit's bars round the corners with a per-corner radius and a matching `ry`.
- **1.1.0 behaviour:** `svg-renderer.ts:123-126`: a rect with a scalar radius emits `rx` only; `cornerRadii` emits a path via `rectCornerRadiiPath` (`renderer-rect.ts:39`). See `bar.ts:709-756` (`resolveBarRadius`), `rect-radius-state-internal.ts:17-30`.
- **Workaround:** a typed-attr rule `rect[rx]{rx:...;ry:...}` on the bar keys (`bar-chart.tsx:264-271`).
- **Proposal:** emit `ry` with `rx`, or document the behaviour.

## 26. Focus resolution is stateless per pointer event

- **Needed:** bklit's ring arcs scale about the centre on hover and their painted paths are the hit areas, so the hit region tracks the growing arc.
- **1.1.0 behaviour:** `ChartFocusStrategy.resolve` receives only pointer position and `maxDistance` (`types.ts:2095-2117`): no prior focus, no animated geometry.
- **Workaround:** the annular focus strategy reads the hovered ring and the live spring scale from outside `resolve` (`kit/polar/polar-hover.ts:103-150`, `ring-chart.tsx:96-112`, `ring/ring-springs.ts:15-21`).
- **Cost:** correctness depends on kit state outside the strategy; a module-level host map.
- **Proposal:** pass the previous focus to `resolve`, or allow hit-testing against rendered geometry.

## 27. Axis tick labels are keyed by value; rolling windows replace label nodes

- **Needed:** bklit's live x axis keeps fixed label slots whose text re-derives as the window rolls.
- **1.1.0 behaviour:** the axis keys each tick label by tick value (`scene.ts:1882`), so a rolling window replaces nodes per tick and reconcile re-inserts siblings (`reconcile.ts:100-157`); text changes replace the text node (`reconcile.ts:93-97`); a mid-roll render cancels the path animation (`motion.ts:985`).
- **Workaround:** a `ChartControl` with a pool of 3 label nodes per slot keyed `x-tick-label:slot:<i>:<n>`, stacks switched by CSS (`live-line/live-xlabels.ts`, `live-css.ts`).
- **Cost:** replaces the native axis for x labels (no collision thinning).
- **Proposal:** an axis option to key tick labels by slot index.

## 30. Focus-guide nodes are not paint-resolved against the chart's idPrefix

- **Needed:** bklit's tooltip indicator is a rect filled with a vertical fade gradient, scoped per chart instance.
- **1.1.0 behaviour:** a native crosshair rule is a zero-width line, which an objectBoundingBox gradient cannot paint. Paint references on scene nodes returned from a focus guide are written verbatim: `renderFocusGuideLayer` (`svg-renderer.ts:74-82`) uses `focusGuideRenderHooks` (:84-86), which has `renderGroup` but no `resolvePaint`, unlike the mark path (`svg.ts:15-27`).
- **Workaround:** `crosshairRuleMark` (`kit/cartesian/date-pill.ts:262-292`) draws a rect guide with `url(#${uid}-crosshair)` already prefixed; charts pass `idPrefix={uid}`. Choropleth's highlight (`choropleth/highlight.ts`) relies on the same verbatim paints.
- **Cost:** a hand-built guide node instead of the native rule.
- **Proposal:** resolve focus-guide paints through the same idPrefix mapping as marks, or allow a gradient-painted rule.

## 31. Mark `states` force a full scene repaint on every focus change

- **Needed:** hover emphasis (dim the rest, lift the hovered shape) without a whole-scene reconcile per move.
- **1.1.0 behaviour:** `resolveMarkStateScene` (`mark-state.ts:28-36`) returns a new scene for any scene containing a group with `states`, even empty definitions (`sceneHasMarkStates`, :111-118). `applyStateFocus` (`motion.ts:889-935`) then runs a full `renderSvg` + `animateSvg` since `presented.scene !== scene`. A function tooltip anchor makes `tooltipTracksPointer()` true (`renderer.ts:1326-1336`), so `updateFocus` repaints on every pointermove (:752-753). The 1.1.0 focus-callback dedupe only suppresses callbacks, not this repaint.
- **Workaround:** radar, funnel, ring, bar, choropleth write `data-hover="<index>"` on the host (`kit/host-write.ts:64-68`) with scoped static CSS (`styles.css`); sunburst uses `data-bk-path` CSS (`sunburst/push.ts:251-261`, `sunburst/hover-grow.ts:15`); marker/band springs run on WAAPI instead of `states`.
- **Cost:** hover paint lives outside the definition, keyed on renderer DOM (see #36).
- **Proposal:** diff only affected nodes' style for focus states, treat empty definitions as no states, and offer a non-tracking function anchor.

## 33. Motion tracks start at the next frame timestamp, with no start-time option

- **Needed:** bklit's mount progress starts its clock at the mount effect's `performance.now()`.
- **1.1.0 behaviour:** `runTracks` (`motion.ts:3942`) starts at the first rAF timestamp after scheduling (`start ??= time`, :3988-3990), with no way to pass a start time. Entrances trail or lead bklit by tens of ms depending on queued long tasks; on choropleth the fade led bklit by 40-145 ms.
- **Workaround:** none generally (accepted within the timing band). Choropleth only (`choropleth/enter.ts:81`): the fade tween's easing samples bklit's curve on `performance.now()` since the commit that shows the layer. No timer.
- **Cost:** one custom easing closure on choropleth.
- **Proposal:** a `startAt`/`now` option on motion transitions, or start the clock at schedule time.

## 34. Keyboard navigation is one-dimensional (no 2-D grid navigation)

- **Needed:** the heatmap is a week-column grid: ArrowLeft/Right should move by column, ArrowUp/Down by day within a column.
- **1.1.0 behaviour:** `chartPointFromNavigationOrder` (`interaction.ts:127-159`) maps ArrowRight/Down to +1 and ArrowLeft/Up to -1 over one list (`renderer.ts:918-925`). A strategy's `navigation` can only reorder that list (`reference/focus-and-interaction.md:765-773`). Open upstream PR #164.
- **Workaround:** `heatmap/chart.tsx:497-513` handles the arrows in a capture-phase host `onKeyDownCapture`, finds the target by (column, row) in the scene points and calls the public `setControlledFocus`; the host `onBlur` (:516) clears it. Tab, Home/End, Enter stay native.
- **Cost:** about 60 lines of host key handling.
- **Proposal:** an optional `navigate(points, current, key)` on `ChartFocusStrategy`, or a 2-D `navigation` result.

## 35. Sunburst arc tweens need private geometry metadata; no public enter-from or exit-to geometry

- **Needed:** bklit sweeps sectors along their arcs on entrance and collapses leaving sectors to a point on zoom.
- **1.1.0 behaviour:** the arc tween (`addSemanticPathUpdateTrack`, `motion.ts:2386-2399`) runs only when both scenes carry arc geometry under the private `sceneMotionNode` symbol (`scene-motion-internal.ts:3`), set only by the native sunburst (`hierarchy-sunburst.ts:301-311`) and not exported (`guides/custom-marks-and-renderers.md:13`). `path: 'morph'` (:3773) moves vertices along chords, not arcs. A leaving sector with no painted ancestor only fades (`hierarchyMotionRelation` :2770-2800, exit :2698-2735). Native entrance is a group radial sweep (:1640-1700). `ChartMarkStateStyle` (`types.ts:176-192`) has no angle or arc-geometry key either.
- **Workaround:** the native `sunburst` mark stays as a thin adapter for scene, hit testing and keyboard (`sunburst/sunburst-mark.ts`); the documented `ChartLayerRenderer` `createSectorLayer` (`sunburst/sunburst-layer.ts:77`) paints and tweens sectors and labels with `seedArc` (`geometry.ts:38`) and `collapsedArc` (`geometry.ts:41`). No private symbol is read.
- **Cost:** the layer owns its SVG and a rAF loop; native sector motion, states and focus paint are unused (hover via CSS, #31).
- **Proposal:** public `enter: { from }` / `exit: { to }` geometry callbacks on partition marks (and arc geometry keys in state styles), or export the path-geometry metadata as a documented scene-node field.

## 36. Cartesian marks have no class hook; CSS reaches their nodes only through undocumented core classes and the `data-ts-key` encoding

- **Needed:** bklit styles chart parts with stylesheet rules (series dim, tick-label fades, pill parts, markers, reference areas, brush selection). The migration keeps hover visuals in CSS because mark `states` cost a whole-scene reconcile per move (#31).
- **1.1.0 behaviour:** only polar, sunburst and geo marks document `className` (`marks/polar.md:42`, `sunburst.md:102`, `geo.md:52`). Other marks get a fixed core `ts-chart__*` class (`bar.ts:399`, `area.ts:271`, `line.ts:356`, `dot.ts:273`, `text.ts:224`, `rect.ts:321`, `rule.ts:156`) and a `data-ts-key` from the mark `id`. Documented: `ts-chart-host`, `ts-chart-surface`, `svg.ts-chart`, `ts-chart-tooltip` (+ variables), polar/geo classes, mark `id`, and that keys become `data-ts-key` (`rendering-and-export.md:130, :320`). Undocumented: key composition (bars `bars:<i>:<series>`, `${guide.id}-tick-label:<value>` `scene.ts:1882`, `grid-rows`/`grid-columns`) and the group, crosshair, brush and tooltip-body classes (`ts-chart__marks` scene.ts:483, `__grid` :1383, `__axes` :1476, `__focus-layer` :434, `__focus-guide-layer` svg-renderer.ts:81, `__crosshair*` crosshair-resolver.ts:200-406, `__brush-x-fallback` interaction-brush.ts:200). Core motion itself keys on `g.ts-chart__crosshair` (`motion.ts:2975-3053`), so our own guide groups must carry that class.
- **Workaround:** selectors on `data-ts-key` and core classes are built from our own mark ids, named in one TS module (`kit/renderer-dom.ts`) and repeated in the three CSS files that cannot import it (`styles.css`, `sankey/sankey.css`, `live-line/liveline.css`); own scene nodes (wipe, date pill, choropleth geo) use documented `className` (`bkm-*`) instead.
- **Cost:** CSS is coupled to core's internal key and class composition; a core refactor silently breaks hover, tick, pill and marker styling.
- **Proposal:** a `className` option on every mark and on axis/focus-guide parts, or a documented key format and class list.

## 37. No documented per-show tooltip state: the first-anchor settle glide needs a hand-set attribute and a forced style read

- **Needed:** bklit's TooltipBox mounts each show at a default placement and retargets its position spring to the measured placement, so the first panel glides into place.
- **1.1.0 behaviour:** tooltip options (`reference/focus-and-interaction.md:788-829`) are static and the `portal` extension (`dom-types.ts:309-335`) is position-only. No show/hide or first-show state is exposed; presence/movement animation is internal (`motion.ts:523-600`); core writes only `data-sticky` and `data-placement`.
- **Workaround:** `kit/tooltip/bklit-tooltip-portal.ts:57-69` places at default size, forces one style read, sets `data-bkm-settle`, then places at the measured size; `styles.css:200` carries the spring transition; `hide()` removes the attribute.
- **Cost:** one forced style read per tooltip show; a hand-set attribute on a renderer-created element.
- **Proposal:** a documented first-show marker on the tooltip element, or a `motion` option for tooltip position transitions.

## 38. No documented motion-finished signal

- **Needed:** know when an entrance or scene motion has finished, for state that follows the motion.
- **1.1.0 behaviour:** the motion loop sets `data-ts-motion-state="running|finished|cancelled"` and `data-ts-motion-progress` on the chart root (`motion.ts:3985-3986`, :4000, :4009-4010, :4022), but neither these nor a callback are documented, so reading them is private state.
- **Workaround:** only the funnel entering flag: `funnel-chart.tsx:176-184` ends it with timers at stage stagger + duration (bklit `use-enter-complete`). Low impact.
- **Cost:** none measured; timers may drift a frame or two.
- **Proposal:** document the root `data-ts-motion-state`, or add an `onMotionEnd` callback.

## 39. No touch focus lifecycle (touch-start focus, lift clear, two-finger clear)

- **Needed:** one finger focuses the nearest point on touch start and follows it; two fingers or lift clear; the tap's compat click must not re-focus.
- **1.1.0 behaviour:** `pointermove` follows touch like a mouse, `pointerdown` only updates the free cursor (`renderer.ts:757-762`), no multi-touch or lift handling, and the click handler (:823-826) re-focuses. `continuousCursor` tracks a value pair without creating a focus (`focus-and-interaction.md:584`).
- **Workaround:** `kit/cartesian/touch-focus.ts:26-83` host listeners drive the public controller (`resolvePointer` + `setControlledFocus`, clear with null), swallowing the touch click.
- **Caveat:** the documented route for app-owned touch is `pointer: false` + `resolvePointer`/`setControlledFocus` (`guides/tooltips-and-focus.md:335-353`), but it disables native mouse hover too (`renderer.ts:747, :758, :825`). Not filed upstream; a trade-off, not a missing capability.
- **Cost:** one host listener set per chart.
- **Proposal:** a touch-scrub pointer option (focus on down, clear on up or second finger).

## 40. brushX owns the whole plot and cannot coexist with hover focus; no transient drag-range gesture

- **Needed:** bklit's main-plot drag selection: press-drag reports an unsnapped x range while hover tooltip and crosshair stay at the last hovered x; range lives only while held; two fingers also set it.
- **1.1.0 behaviour:** `brushX` mounts a full-host overlay with `pointerEvents: 'auto'` (`interaction-brush.ts:257-265`). The renderer treats events inside a control as control-owned (`controlContains`, `renderer.ts:1162-1167`): pointermove clears hover focus (:740-746), click/keydown/focusin are ignored (:824, :880, :934-940). The brush is persistent (blank click commits a zero-width range, :407-417), has handles, is single-pointer (`touchable(true)` :278).
- **Workaround:** `kit/cartesian/drag-select.ts` host capture listeners publish plot-space px via host attributes and CSS vars; no renderer DOM is touched.
- **Cost:** a second gesture layer next to native hover.
- **Proposal:** a `brushX` mode that claims the pointer only during a gesture (non-persistent, no handles, two-pointer touch), or a documented opt-out from `controlContains`.

## 42. A pointer pass drops a keyboard focus; the controller cannot hand focus back to the keyboard

- **Needed:** a keyboard-held focus survives the pointer crossing the chart, and the next arrow continues from it.
- **1.1.0 behaviour:** `handlePointerMove` (`renderer.ts:739-753`) makes the pointer the focus owner and replaces `focusedPoint`; `clearPointerFocus` (:764-780, bound to `mouseleave` at :965) then empties it, and the next arrow steps from `focusedPoint` (`interaction.ts:127-157`: no current point -> index 0). `ChartControlledFocusOptions.source` is typed `'pointer' | 'programmatic'` (`dom-types.ts:72-75`), although `setControlledFocus` (`renderer.ts:665-700`) passes any value through (:688). A controller-set focus is `focusOwner = 'controlled'`, which the pointer-leave clear and the blur clear (`clearKeyboardFocus`, :782-797, keyboard-owned only) both skip.
- **Workaround:** `kit/cartesian/keyboard-hold.ts` remembers the last navigation-key point, keeps empty-plot pointer moves from the renderer, and restores the held point through `setControlledFocus` (runtime `source: 'keyboard'`, cast past the narrower type) when the pointer leaves, in a capture listener on the host before the renderer's own `mouseleave` clear; it clears its own restore on blur. Public controller only; no renderer DOM.
- **Proposal:** the renderer remembers the keyboard focus across a pointer pass (restore on leave), or `setControlledFocus` accepts `source: 'keyboard'` and hands keyboard ownership (so blur clears it and Escape applies).

## 43. Focus-guide motion restarts every presentation frame while data motion runs

- **Needed:** the pointer crosshair (rule, its pill and the marker) glides to the pointer on a spring, as bklit's liveline crosshair does (`crosshairSpringConfig` {stiffness 300, damping 30}, live-x-axis.tsx:12), while the series keeps rolling.
- **1.1.0 behaviour:** with data motion in flight, every presentation frame reaches `handlePresentationPoints` (`renderer.ts:1224-1246`), which repaints the focus; `paintFocus` in the data-motion branch (`motion.ts:1089-1104`) re-runs `paintMotionSvgFocusGuides` (:1164-1219). Each repaint starts a new guide tween, and `runTracks` anchors at the first frame it sees (`start ??= time`, :3990), so a guide spring restarts at elapsed 0 every frame and never advances (measured rule x 256, 267, 293, 293, ... for a 300px step **[LOG only]**).
- **Workaround:** `live-line/live-glide.ts` runs a host-side spring built from the public `createChartSpring` (`@tanstack/charts/spring`), carrying velocity across retargets, and writes its remaining lag to `--bkm-pgx`/`--bkm-pgy` in the same event. `live-line/liveline.css` translates the rule, pill and marker by that lag under `data-bkm-pglide`, which is never set during keyboard focus. Public API and CSS variables only.
- **Proposal:** a guide repaint caused by data motion keeps the guide tracks' start time and velocity (retarget rather than restart), or focus guides accept a motion option independent of the presentation-frame repaint.

## 45. Focus callbacks are deduped by datum identity, so a continuous pointer x between points is never reported

- **Needed:** live-line's crosshair and pill follow the pointer between samples (bklit live-line tracks raw pointer x).
- **1.1.0 behaviour:** `updateFocus` (`renderer.ts:545-559`) returns without painting or notifying while the focused point identity (key, markId, datumIndex; `interaction.ts:72-86`) is unchanged, and `notifyFocus` (:561-581, `sameFocusObservation` :1404-1416) fires `onFocusChange` only when that identity or the `datum` object changes. Pointer moves inside one point's hit region produce no callback and no x; the callback carries only the point.
- **Workaround:** live-line keeps a pointermove listener on the host (`live-line/live-focus.ts`) for the raw x; focus identity still comes from the controller.
- **Proposal:** expose the pointer position (plot-space x/y) on the focus event, or an opt-in `onPointerMove` with scene coordinates.

## 46. The focus strategy cannot tell a pointer move from a click

- **Needed:** bklit's sunburst keeps hover on the last sector over the hub and the gaps, but a click on the hub must still zoom out, and a click on a leaf or the gaps must do nothing.
- **1.1.0 behaviour:** `ChartFocusStrategy.resolve` receives `{ x, y, maxDistance }` only (`types.ts:2095-2117`). `handlePointerMove` (`renderer.ts:739-753`) and `handleClick` (:823-870) both reach it through `pointsAtPointer` (:644-648) and `resolvePointerFocus` (:1169), so a hold-off inside the strategy would also hold the hub click.
- **Workaround:** a capture `pointermove` listener on the host raises a move flag for the dispatch (never stops the event) and the strategy holds the hovered sector off every sector only while it is set; a capture `click` guard drops clicks that must do nothing (`sunburst/focus.ts`, `sunburst/definition.ts`).
- **Proposal:** add the event kind (`'move' | 'click' | 'keyboard'`) to `ChartFocusResolveContext`, or pass the previous focus (see #26).

## 47. area-x and rect marks have no scale-about-centre enter

- **Needed:** bklit's gauge notches enter from scale 0 and opacity 0 to 1 about each notch's own centre, with a per-notch delay.
- **1.1.0 behaviour:** the generic enter track for an element is an opacity-attribute tween only (`motion.ts:2475-2636`, tween :2621-2636); no scale or transform enter exists for area-x or rect marks, and `ChartMotionTiming` carries only `delay`, `transition` and `path` (`types.ts:872-877`). The scale sweeps apply to whole groups of other marks (bars about the baseline `motion.ts:1238-1330`, line/area :1505-1562, radial :1596) and do not apply to these marks.
- **Workaround:** fixed scoped CSS keyframes keyed on `data-ts-key` (`gauge/enter-css.ts`, #36), with `:nth-child` delays and entrance origins aligned on motion's clock.
- **Also:** the sankey node grow (scaleY about the node's middle, `sankey/sankey.css`) uses the same CSS route, so the first scene is laid out at full height.
- **Proposal:** an `enter` option on `motion()` marks (`from: { scale, opacity }`, `origin: 'center'`, per-datum delay), or a documented per-element enter transform.

## 48. No documented way to change a custom circle's radius on hover

- **Needed:** bklit's actionable marker disc lifts its shadow circles on hover (radius from rest to hot), springing alongside the disc's scale.
- **1.1.0 behaviour:** `SceneStyle` (`types.ts:1394-1404`) has no `r` key or custom-property channel. Mark `states` can carry `r` (`ChartMarkStateStyle`, `types.ts:184`) but run through the full-scene repaint (#1, #31), and the renderer sets the circle's `r` attribute, which #20 says a host write cannot keep.
- **Workaround:** `kit/motion/marker-springs.ts` (`springAct`, `:74`) reads the attribute back, holds the hot radius as inline `style.r` on the renderer-owned node and springs it with the Web Animations API (`styles.css:900`).
- **Proposal:** a radius (or generic geometry) key in `SceneStyle`, or a documented per-mark CSS custom property for the radius.

## 49. A scene group's `clip` is a rectangle only

- **Needed:** bklit clips the bar-depth pulse wave to the bar's 3D silhouette (front face, side face and lid), via a `<clipPath>` holding a path (bklit `bar-depth.tsx:964-966`, applied at :1045, relied on at :1062).
- **1.1.0 behaviour:** `SceneGroup.clip` is `ChartBounds` (`types.ts:1500`, `x/y/width/height`). The SVG renderer always emits `<clipPath><rect .../></clipPath>` (`svg-renderer.ts:169-177`), the canvas renderer `context.rect(...)` plus `clip()` (`canvas.ts:1243-1251`), and hit testing intersects bounds (`nearest.ts:200-203`). The only `<clipPath>` with a path is private to the arc enter sweep (`motion.ts:1648-1663`). No scene node carries a path clip, mask or `clip-path` style (see also #6).
- **Workaround:** `bar/depth.ts:270` clips the pulse group to the front-face rect only, so the wave does not light the side face or lid (accepted divergence). The wipe entrance (`kit/cartesian/wipe.ts`) is likewise rect-clipped.
- **Proposal:** allow `clip` to be a rect or a path (`{ path: string, fillRule? }`), rendered as the `<clipPath>` child and `Path2D` clip on canvas, with bounds derived for hit testing; or the generic `resources` slot from #6.

## 50. No documented signal that a node is mid-tween (`data-ts-motion-role`)

- **Needed:** CSS transitions and hover springs for bklit's hover dims (bar, candlestick, composed, radar, ring, pie, funnel, heatmap, sankey, liveline tick fade, markers) must not fight a native motion track on the same node: a CSS `transition` on `opacity` chases the renderer's per-frame writes.
- **1.1.0 behaviour:** the renderer sets `data-ts-motion-role` (the track's `ChartMotionRole`, `types.ts:805`) on a node with a live motion track and removes it in the track's finish/cancel (`motion.ts`: element tracks :2247-2560, group sweeps via `dataset.tsMotionRole` :1286-1327, :1533, :1593, :1664). The attribute is absent from `docs/` (only `motion.test.ts` asserts it). The chart root likewise carries undocumented `data-ts-motion-state` and `data-ts-motion-progress` (`motion.ts:3985-4022`, see #38).
- **Workaround:** keep the guard, each site commented `gap #50`: CSS reads `:not([data-ts-motion-role])`, TS reads it in one helper (`kit/renderer-dom.ts` `isMotionNode`, used by `kit/motion/marker-springs.ts`, `kit/polar/polar-dim.ts`, `ring/ring-springs.ts`, `radar/hover-springs.ts`). There is no class or event alternative: a fixed delay would be a timer with no bklit source.
- **Proposal:** document `data-ts-motion-role` (and the root's `data-ts-motion-state`) as public, plus a transition-friendly way to opt a mark out of tweening a property. Related: #38.

## 51. radialArc carries no arc geometry for the motion tween (ring progress arcs, pie)

- **Needed:** bklit sweeps each ring progress arc by drawing a fresh d3 arc per frame (`cornerRadius = thickness / 2`) from the start angle to `start + range * progress`, so the leading cap stays round (bklit `ring.tsx:104`; nothing is drawn until the sweep passes 0.01 rad). Pie wedges tween the same way.
- **1.1.0 behaviour:** the same mechanism as #35. The arc tween runs only for nodes carrying the private `sceneMotionNode` geometry (`motion.ts:2386-2399`; set only in `bar.ts:385,661` and `hierarchy-sunburst.ts:301`), and `radialArc` sets none. `path: 'morph'` moves vertices along chords, and the radialArc enter is a group wedge clip (`motion.ts:1618-1690`) that cuts the round cap flat.
- **Workaround:** `ring/progress-layer.ts` renders the progress marks through a documented custom layer renderer (`renderer` on a radial mark, `reference/marks/polar.md:139`; `ChartLayerRenderer`, `reference/rendering-and-export.md:546-577`). The layer paints its own SVG and animates `d` on nodes it owns. Composition is our own compositor (`kit/layer/compose-layers.ts`, about 1.3 KB gz) because the only exported one is the Canvas module's (`canvasChartRenderer.compose`, 5.4 KB gz more). Cost: all tracks paint under all progress arcs (layers split by mark order).
- **Proposal:** the same as #35, plus an exported layer compositor (draft: `docs/upstream-issues/layer-compositor.md`) so a custom layer need not copy one.

## 52. No HTML or foreignObject scene node (marker `icon` ReactNodes, `iconFill`)

- **Needed:** bklit renders each marker's `icon` ReactNode (an SVG or HTML element) inside the marker disc through `foreignObject`, and `iconFill` makes the icon fill the disc instead of the 4 px inset (bklit `markers/marker-group.tsx:254`, `:358`, `:423`, `:435-456`).
- **1.1.0 behaviour:** `SceneNode` is `group | rule | polyline | area | dot | rect | label` (`types.ts:1599-1606`); none embeds HTML or foreign content, and a `label` is plain text. The tooltip body is the only per-datum HTML slot.
- **Workaround:** `kit/cartesian/overlays.ts:150-160` draws icons as label text; ReactNode icons are not supported (only strings and numbers render), and `iconFill` is accepted but inert (`kit/types.ts:275`).
- **Proposal:** an HTML/`foreignObject` scene node (position, size, a React or DOM child), or a documented custom-renderer slot for per-datum HTML that follows the scene's layout and motion.

## 54. Grid and guide lines have no `shape-rendering` channel

- **Needed:** bklit's grid rows render with `shapeRendering="crispEdges"` (the visx GridRows default), so each hairline paints one crisp device row.
- **1.1.0 behaviour:** `ChartGuideLineStyle` is `stroke | strokeOpacity | strokeWidth | strokeDasharray | lineCap` (`types.ts:419-425`), and `SceneStyle` (:1394-1404) has no rendering hint either, so rule marks cannot carry it. Native grid lines anti-alias across two device rows at half intensity.
- **Workaround:** `styles.css` sets `shape-rendering: crispEdges` on `.ts-chart__grid line` (:66-70) and on the `data-ts-key` `grid-rows`/`grid-columns` lines of our own grid marks (:132-135), class- and key-keyed rules on renderer-owned DOM.
- **Proposal:** a `shapeRendering` field on `ChartGuideLineStyle` and `SceneStyle` (or a generic SVG presentation passthrough on guide lines and rules).

## 55. No slot for user SVG or React children inside the chart

- **Needed:** bklit renders its children (user components, custom SVG indicators, annotations) as React inside the chart's own `<svg>`, in plot coordinates and JSX order, reading `useChart()`.
- **1.1.0 behaviour:** the React `Chart` (`react-charts/src`) takes a `definition` and renders no children; a scene node is one of the renderer's own types (`rect`, `path`, `text`, `group`, ...), with no node that hosts React or arbitrary SVG (see also #52).
- **Workaround:** `kit/cartesian/focus-layer.tsx` renders custom children in a second absolutely positioned `<svg>` over the host, translated by the plot margin. They paint above the chart marks and never between them, and the `<svg>` is not the renderer's. Carriers inside user components register through `kit/carrier-registry.tsx`, since only rendering reveals them.
- **Proposal:** a `children`/`overlay` render slot on the framework `Chart` that mounts inside the renderer's svg with the plot transform, or a scene node that hosts a foreign subtree.

## 56. `motion()` cannot start a tween from an earlier clock (no start time, negative delay clamped)

- **Needed:** bklit's entrances start on the effect that arms them (`chart-reveal-clip.tsx:81-85`, `heatmap-chart.tsx:566-585`); ours join a React commit later, which would shift the tween by 10-37 ms.
- **1.1.0 behaviour:** a timing is `{ delay, transition }` run from the moment it is scheduled, and a negative `delay` is clamped to 0 (`motion.ts:3792-3793`).
- **Workaround:** `kit/motion/resume-enter.ts` resumes the schedule from the arm time (shorter tween, renormalised easing); used by `kit/cartesian/wipe.ts`, `composed/bars.ts` and `heatmap/motion.ts`.
- **Proposal:** a `startTime` on the timing object, or a negative `delay` that starts the tween already advanced (draft: `docs/upstream-issues/25-motion-start-time.md`).

---

## 57. Focus follows `pointermove` only (no raw-pointer input path)

- **Needed:** the lowest move-to-paint latency needs `pointerrawupdate` (0.5-2 ms after input) instead of the frame-aligned `pointermove`, which costs about 8 ms of every sample.
- **1.1.0 behaviour:** the renderer listens to `pointermove` only (`handlePointerMove` -> `updateFocus`); no option picks the event, and `setControlledFocus` with `focusOwner="controlled"` stops pointer leave from clearing focus.
- **Workaround:** none; the charts keep `pointermove`, so the wait is shared with bklit (draft `docs/upstream-issues/raw-pointer-input.md`).
- **Proposal:** a `pointerEvent` interaction option, or a controller method applying a pointer sample with the renderer's own move semantics.

---

## 58. `motion()` is one function: its whole engine is bundled for every chart that uses it

- **Needed:** an entrance-only chart (pie, ring) should not carry path morph, rect-corner morph, the focus-guide layer or the spring tooltip controller.
- **1.1.0 behaviour:** `motion` is a single function (`charts-core/src/motion.ts:757-4177`) closing over `resolveRollingPathPlan` (`:1911`), `rectCornerRadiiPath` (`:1404`), `renderFocusGuideLayer` (`:1209`) and `createChartSpring` (`:4102`); `ChartMotionOptions` (`:84-93`) selects no features. `dist/motion.js` is 45.5 KB min; stubbing it and its exclusive imports saves 22.2 KB gzip of a 57.0 KB pie (22.7 KB line, 22.8 KB sunburst).
- **Workaround:** none; native `motion()` is the project rule, so this is part of the floor. `renderer.js` (9.6 KB gzip leave-one-out on a pie) is the interaction host, not waste.
- **Proposal:** feature engines as separate modules chosen from `motion()` options (draft `docs/upstream-issues/26-motion-module-split.md`; the renderer.js question is closed in `27-renderer-js-is-the-interaction-host-note.md`).

---

## 59. A rolling path re-presents every point on every frame

- **Needed:** the live line (bklit's streaming chart) scrolls its ~220 smoothed rows under a 600 ms tween, back to back, with the area, line and tail all rolling; nothing reads the interpolated points unless a pointer or focus is active.
- **1.1.0 behaviour:** each rolling transform plan gets a presentation track whose `apply` re-creates every point of the element (`{ ...point, x, y }` plus `pointIdentity(point)` for the map key) on every frame (`dist/motion.js:2531-2536`), then `publish` copies the map (`:2685`) and `handlePresentationPoints` filters it with `viewportInteractionPoints` (`renderer.js:888-896`) even with no pointer and no focus. Measured in a dev build with per-track timers: one frame's sampling is 0.26 ms, 77% of it that track (per-call 0.13 ms, 3 values); publish 0.008 ms. Production, 6 s steady: 131 ms of rAF in the motion tick on the migrated card against 14.7 ms for the whole bklit chart.
- **Workaround:** none. Fewer points would change the curve (`SMOOTH_STEPS` 4 -> 2 deviates 3.6-5.2 px from the exact cubic on steep data), and the area cannot be `decorative` (its points feed the plan).
- **Proposal:** present rolling points lazily (derive them from the affine transform when a listener or focus asks, `getPresentationPoints`), or skip the per-frame map rebuild while no pointer or focus exists (posted as [#201](https://github.com/TanStack/charts/issues/201)).

---

## Retired numbers

Not reused, so code and issue drafts keep their meaning.

- 2 retargeting focus guides: real, but nothing migrated uses `focusGuideX/Y` or `retarget`; the per-move cost lives in #21. 4 longest state transition wins: the workaround is gone (no native `states` on sunburst).
- 10 merged into #6. 16 merged into #35 (the seed/reshape code no longer exists). 32 and 44 merged into #21. 53 merged into #1.
- 13 no reveal/wipe entrance: resolved, `kit/cartesian/wipe.ts` builds it from public `createMark` groups and a static clip (residual rect-only clip is #49).
- 14 no number-tween text: parity, bklit's centre value is itself an HTML NumberFlow overlay.
- 28 Escape does not clear keyboard focus: no custom code depends on it (upstream #189 keeps it).
- 29 containment hit testing while entering: resolved, a strategy calls the documented `findNearestPoint` (`heatmap/focus.ts`).
- 41 pointer leave vs controller focus: resolved, `sunburst/focus.ts` uses a strategy and the host leave listener is gone.
