# Phase 8 decision log

Continues the D-numbering from `docs/phase-7/LOG.md` (last: D709).

## D710 — Phase 8: native TanStack Charts 1.0 rewrite (2026-10-06)

- TanStack Charts 1.0.0 released; `@tanstack/charts` + `@tanstack/react-charts` bumped 0.18.0 → 1.0.0
  in `showcase/migrated` and `bench/app`; `repos/tanstack-charts` clone checked out at `v1.0.0`.
  Phase-7 WIP tree typechecked clean on both 0.18 and 1.0 and was committed as checkpoint `d869751`.
- Direction (owner request): stop iterating on the phase-7 parity machinery; rewrite every chart from
  first principles on 1.0 native primitives (polar/sankey/sunburst/geo marks, mark + container
  `states`, `motion()` renderer, native tooltip/crosshair/focus/keyboard, interactive legends),
  keeping bklit's public compound-component API. Legacy `internal/` code is deleted once unreferenced.
- Deterministic `qa/` pixel gates and `bench/` scripts retired for this phase. QA = visual review
  in Chrome (claude-in-chrome) on the showcase; performance = Live Perf panel on each showcase page.
- Plan: `PLAN-phase-8.md`. Tracking: `docs/phase-8/PROGRESS.md`.

## D711 — Line entrance: grow-from-baseline, no left-to-right wipe (2026-10-06)

- bklit reveals lines/areas with a 1100ms left-to-right clip wipe. TanStack 1.0 `motion()` has no
  native reveal/wipe (`clip` is a boolean plot clip; enter motion grows paths from the baseline;
  rolling paths are for streaming updates only). Ruling: keep native grow-from-baseline over a
  1100ms tween; no custom clip animation (would need rAF/DOM pokes, forbidden by PLAN-phase-8).

## D712 — Wave 2 launched in parallel on the kit API (2026-10-06)

- Bar family, Composed, Scatter, Candlestick, LiveLine each assigned to an agent consuming
  `native/kit/` read-only (kit still owned by the line/area agent). LiveLine uses native rolling
  path motion (`motion.path.update: 'rolling'`).

## D713 — Radar/gauge accepted (2026-10-06)

- Committed c03c298. Hover scale is a keyed-geometry spring (focused series rebuilt ×1.05), dim/
  emphasis remain native `states`. 1.0 core has no SVG filter resource → glow kept as a translucent
  underlay stroke. Gauge centre value stays a NumberFlow HTML overlay (bklit uses NumberFlow; no
  native number-tween text). Accepted diffs: label hover also dims series; notch enter uses native
  arc/rect grow instead of per-notch scale-from-zero.

## D714 — First-paint entrance pattern: seed empty marks, then enter (2026-10-06)

- Finding (heatmap + candlestick agents, independently): the 1.0 `motion()` renderer animates enter
  only for elements that join an already-painted mark group; marks present in the very first paint
  render at rest, and a post-mount size change cancels an in-flight enter. Ruling: accepted native
  pattern — measure the host once in `useLayoutEffect` before mounting `<Chart>`, first paint with
  empty data for the animated marks (scale domains still use full data), flip an `entered` state in
  `useEffect` so marks enter with their per-datum delays. No timers/rAF. Apply wherever an entrance
  doesn't visibly play.
- Sunburst accepted (d806cd0, 12cdb23): 1.0 sunburst entrance is one group clip sweep; per-arc
  stagger not expressible (sector paths get no enter track).
- Pointer-focus UA outline suppressed globally for chart svgs (`:focus:not(:focus-visible)`), ae3599a.

## D715 — Gradient limits + hover-rebuild costs (2026-10-06)

- 1.0 gradients are objectBoundingBox-only for marks (no userSpaceOnUse, no masks); zero-width/height
  rules can't take gradients. Ruling: grid/crosshair fade-edges and area horizontal edge fade are
  dropped (solid); line fadeEdges works via stroke gradient. (Heatmap separators use a userSpaceOnUse
  gradient via a ResourceHost — chart-local exception, not generalised.)
- Hover effects that change geometry (radar 1.05 scale, funnel ring pop-out, line highlight band)
  rebuild the definition on `onFocusChange`. Costs: line p95 interaction ~27ms vs bklit ~17ms
  (headless), and the motion renderer defers state paint until data motion settles, so funnel springs
  run ~3x stiffer than bklit. Accepted for now; kit round 3 investigates a cheaper update path.
- WAAPI/MutationObserver bar entrance in composed rejected (PLAN rule 2) → D714 pattern.
- Retired `showcase/migrated/fixtures/` (phase-7 qa/unit checks), aed2345.

## D716 — Kit round 3, bar round 2, wave 3 launch (2026-10-06)

- Commits: liveline 7a16629, pie/ring 56825e7, bar r1 68db16d, kit r3 + bar r2 ffb85e4.
- Accepted: liveline tip trails newest sample by 2 rows (rolling needs path past clip edge);
  linear curve under rolling. Bar `stackGap` drawn as background-colour stroke (1.0 `stack()`
  has no gap option). Hover p95 ~25ms vs bklit ~18ms: no cheaper update path than definition
  re-resolve (react-charts dynamic builder is size-driven only); p50 at parity.
- Pill/tick overlap solved kit-side: tick labels within the pill half-width are blanked while
  focused; pill is a native rect sized like bklit's.
- PatternArea hatch via CSS mask on the area path (no `<pattern>` resources in 1.0).
- Wave 3 launched: delete `internal/`, move surviving utilities to `native/shared/`, rewrite
  `index.ts` to bklit's public export list; showcase metadata (status/qaResult/gates) retired.

## D717 — Wave 3 landed; public API gap ruling (2026-10-06)

- cfa9740: legacy `internal/` (420 files, −52k lines) deleted; survivors in `native/shared/`;
  `index.ts` rewritten from bklit's export list. Composed (4b890ac → cfa9740): bars seed at
  zero height and grow via the native *update* tween; chained-rAF workaround removed.
- bklit exports with no native counterpart are split:
  - **Implement (public JSX/API):** Legend family, ProfitLossLegend family, ChartStatFlow,
    center classNames; tooltip primitives; Linear/RadialGradient + visx Gradient presets; css var
    maps, colour defaults and public types; chart/sankey hooks where react-charts exposes the
    state natively; marker components. Barrels: `native/api/legend.ts`, `native/api/misc.ts`.
  - **Excluded (bklit visx machinery replaced by the native engine, not public UX):** y-domain
    tween utilities (`useAnimatedYDomains`, `computeYDomainsByAxis`, `niceYDomain`, …), skeleton
    generators, loading sweep/pulse internals, sunburst geometry/reveal helpers, bar-square
    layout and `useBarDepthEntries`, projection extract/merge helpers, `splitProfitLossSegments`,
    reference-area rect math, `ChartRevealClip`, fade-gradient stop helpers,
    `resolveTooltipBoxMotion`, `CHART_CLIP_PASSTHROUGH`, brush overlay internals.

## D718 — Visual QA sweep, entrance regression, fidelity round (2026-10-06)

- Headless side-by-side sweep of all 24 routes (Chrome window hidden; lead Chrome pass still
  pending). Migrated console clean everywhere; render cost far below bklit (line 5ms vs 51ms).
- a403b46: `useChart()` context on every cartesian chart, content-keyed (no consumer loops);
  segment selection + brush hatch. **Regression fixed:** line/area entrance never played —
  `CartesianChart` observed its own host height, re-resolving the definition ~40ms after mount
  and cancelling motion tracks (D714 class). `plotHeight` now derives from width/aspect.
- Fidelity gaps dispatched in four non-overlapping rounds:
  - polar: pie/ring/funnel/radar hover dimming, radar glow, gauge/funnel/sunburst/choropleth
    entrance length (~250ms vs bklit 1.1s);
  - liveline: hover time pill + line dot, tooltip placement, y tick density, y intro;
  - kit: tooltip fade (~900ms vs <500ms), placement right of crosshair, line event markers,
    candlestick/scatter/composed pill, composed dim + grow, scatter blur, area edge fade
    (CSS mask, revisiting D715), reference-area fade-in, patternarea extra band;
  - bar: click→ArrowRight entrance replay + focus loss, barsquares build-up, bardepth focus ring.

## D719 — Fidelity rounds 1–3 landed (2026-10-06)

- Round 1: bar fb0f7fb, liveline a031131, polar 32c0bd6, kit cef58cc. Sweep 2 (23 routes) confirmed
  keyboard (no entrance replay, focus kept), focus-visible rings, tooltip placement, polar dims; and
  found two regressions (bar entrance lost its cascade; liveline area near-invisible).
- Round 2/3: liveline 8adc0ad, bar 0bd6740, kit 2b546c1 + c1f117b, polar bafca25, ring cfe06e9.
- **Principle ruled — no definition rebuild on focus.** A rebuild re-resolves marks, replaces DOM and
  defers state paint behind data motion (dim lag 150–1300ms). Hover effects are native states; where
  a geometry change is required (pie/ring pop) the dim is baked into keyed props of the same
  rebuild; covered tick labels are hidden by a scoped CSS rule keyed on the focused value.
- **Principle ruled — nothing may re-resolve the definition during the entrance** (D714 class):
  measure host before mounting (funnel, gauge), derive plotHeight from width, seed only charts whose
  custom marks need it. Ring progress arcs render in a separate non-interactive overlay Chart
  mounted once so the native radial sweep is never cancelled.
- CSS for effects 1.0 lacks (accepted, scoped by class/data-ts-key): blur on dimmed/entering
  scatter dots and line markers, area horizontal edge fade (mask-image), late label fades for
  sankey/sunburst/funnel (scene text bypasses motion), brush hatch tile mask.
- y domains use visx `nice` rounding like bklit (`bklitYDomain`).
- Console motion warnings on pie/radar/bardepth/composed/liveline originate in bklit's
  framer-motion chunk, not migrated code.

## D720 — Round 4 fidelity + live perf round (2026-10-06)

- Round 4: bar depth ac4a520, liveline 99b89a4, kit 4dde4fb, polar 14bbba4.
- **Perf is compared per interaction sample, not by raw counts.** The Live Perf panel's hover
  commits scale with hover time (scatter 14 vs 38 was 31 vs 87 samples, i.e. equal per sample).
  Agent measurements use one identical scripted hover path for both charts.
- **Spring rest thresholds match motion's** (`restSpeed: 2, restDelta: 0.5`). The native
  defaults (0.01/0.005) keep springs running ~1s after the frame is visually still, which inflated
  candlestick settle by ~950ms. Applied wherever a bklit motion spring is mapped (3a75e96).
- **Hover React state lives in a leaf, not the chart.** Focus is a ref store read through
  useSyncExternalStore by a `FocusLayer` that owns the useChart() context, the pill tick-mask
  <style> and passthrough children. The chart component and RendererChart never re-render on hover
  (scatter 3a75e96, liveline d5308a6 `TickMask`); kit/bar/composed follow.
- Scatter stagger spans `animationDuration - ENTER_MS` so the last dot lands when bklit's clip
  reveal ends (settle 1870ms to ~1550ms; bklit ~1600ms).
- Liveline x ticks stay on native 5s nice ticks. Copying bklit's fixed-position ~7.5s ticks would re-key
  every label on each roll, so it is held until a visual check is possible.
- Remaining `motion/react` imports in migrated code are type-only (funnel, sankey,
  native/shared/phase.ts); replace with a local type, then drop `motion` from the migrated package.

## D721 — Native mark `states` cost per pointermove; hover emphasis moves to scoped CSS (2026-10-06)

- **Finding (1.0 core):** `applyStateFocus` (charts-core/src/motion.ts:889) re-renders and
  reconciles the whole scene on every pointermove whenever any mark declares `states`;
  `resolveMarkStateScene` (mark-state.ts:28) returns a fresh scene even when no state matches.
  For per-datum hover emphasis this is the dominant hover cost (choropleth 888ms to 12ms render
  after moving hover out of the definition, faf64a3).
- **Ruling:** hover dim/highlight that depends only on the focused key is expressed as
  focus-keyed scoped CSS emitted by the `FocusLayer` leaf (kit 63fc71f; scatter, candlestick,
  bar, composed follow). Native `states` stay only where the state changes geometry or where the
  mark is small enough that the scene pass is free.
- **Finding:** the longest state transition on a mark governs all of that mark's states
  (sunburst's 450ms pop fade stretched its 160ms dim). Fix pattern: long cosmetic fades in CSS,
  native state transition 1ms (5a99802).
- Round 5 commits: pie/ring/gauge 3b54725; sankey/funnel/choropleth e1293c3 (full-duration
  bezier sankey entrance, funnel repeat-focus guard = 1 commit/hover, choropleth fade delay 165ms
  calibrated to bklit's useMountProgress start, local `Transition` type). `motion`, `@use-gesture`,
  `@visx/*`, `d3-array` dropped from the migrated package (eb90675); no motion library imports remain.
- Accepted as bklit-side or noise: ring bare-area Social pick (bklit's scaled hit target flips),
  funnel hover-follow (sweep harness measured the first stage's svg), sankey 70ms LoAF (1 of 5 runs).

## D722 — Round 5 close-out (2026-10-06)

- Commits: radar 1215608 (hovered glow fill underlay = bklit drop-shadow wash), bar/composed (per-datum
  hover as `native/bar/hover.ts` CSS targets, explicit `entering` flag, `entrance.ts` deleted),
  scatter/candlestick/kit e1b6c0d + 359792b, liveline c7b8cba, heatmap 488bb4f.
- **No chart uses native mark `states` for focus-keyed hover emphasis any more** (D721 applied to
  bar, composed, scatter, candlestick, heatmap). Heatmap dim/pop script time on an identical
  125-sample path went from 8–10x the no-effect cost to parity (~290ms vs bklit ~2900ms).
- **CSS exception — liveline area gradient:** 1.0 motion has no gradient interpolation
  (charts-core/src/motion.ts), so stop offsets/opacities patch instantly and a domain change snapped
  the fade end (~18px in one frame). The gradient is a fixed 41-stop ramp; only stop opacity changes,
  eased by a scoped `stop-opacity` CSS transition over the roll length.
- **Native gap — tooltip delays:** the 1.0 `tooltip` extension has no show/hide delay; bklit's
  120ms hideDelay and spring entrance on heatmap are not expressible. Extension motion is used.
- **Accepted:** heatmap entrance starts ~75ms after bklit (seed paint precedes cell enter; curves
  agree within 30–50ms through the steep part) — no duration trim. bklit's 18–55ms
  `useScheduledTooltip` input latency is not emulated (candlestick/line glide "lead").
- Projection y domain follows bklit `mergeProjectionYDomain` (projection extent merged after
  nicing, not re-niced); line edge fade re-expressed from bklit's viewport-pinned stops.
- Line/area dim levels follow bklit's `SeriesHoverDim` (0.3 line, 0.6 area, 400ms).
- `motion`, `@use-gesture`, `@visx/*`, `d3-array` removed from the migrated package (eb90675).

## D723 — Tooltip body leaf; native guide reconcile kept (2026-10-06)

- **Finding (react-charts 1.0):** `RendererChart` from `@tanstack/react-charts/tooltip` holds the tooltip
  body target in useState inside the chart wrapper (tooltip.tsx:103-157) and RendererChart.tsx builds a
  new hostOptions each render, so every tooltip target change re-ran `adapter.update`: `domText.refresh()`
  (forced style recalc), a second guide reconcile and a second `placeTooltip`.
- **Fix (4ba5a05):** `native/kit/tooltip-leaf.tsx` — the core chart (`@tanstack/react-charts/core`) gets a
  stable `onTooltipBodyChange` writing into a deduped ref store; `TooltipBodyLeaf` subscribes via
  useSyncExternalStore and portals the body. Hover renders of the chart wrapper: 0. Pointermove p95 on 100
  samples: line 11.4→4.1ms, markers 18.7→5.2, scatter 9.6→4.4, heatmap 10.1→2.3, composed 9.1→4.5;
  forced recalcs 1 per move. Sankey/choropleth (defaultBody) follow.
- **Ruled — keep native retarget guides:** focusGuideX/crosshair/date pill are `retarget`, so
  `resolveFocusScene` (charts-core motion.ts:898) mints a new scene per pointermove and the whole SVG is
  reconciled (~2.4ms/move on scatter, dev build). Replacing them with DOM overlays would violate plan
  rule 2; recorded as an upstream gap instead.
- Bar `entering` is true before the host size is captured (bardepth reached full height in ~245ms and
  could restart). Barsquares gradient offsets are percentages like bklit's `${offset}%` (bac4165); the
  showcase demo's 0/1 offsets make both impls near-flat.
- Disk-full incident: CDP traces (~0.9GB) filled the volume; agents keep captures at DPR 1, no traces.

## D724 — Round 6: bardepth geometry, tooltip leaf everywhere, sweep 5 cartesian (2026-10-06)

- Bardepth: depth faces span the uninset band slot; the band step is read from adjacent categories because
  the 1.0 band scale exposes no `step` (max depth now 5px like bklit). Side+lid dim as one composited group
  (bklit's wrapping motion.g). Front face trimmed by the perspective rise via a render wrapper (52c6b9b,
  665cb33); the key-suffix lookup is recorded as upstream gap 15. Earlier "glint bands" did not reproduce.
- Tooltip leaf: `defaultBody` replica of react-charts' DefaultTooltipBody (markup/classes identical); sankey
  and choropleth now on the leaf; sankey's per-hover same-value `setRevealedFor` guarded. Opt-in
  `sameCategoryTarget` dedupe for bar/composed (bar commits/hover 28→19, composed 44→39). Composed mounted
  one hover gradient per row × series (501 nodes); only the focused row's are mounted now (79, bklit 90) (2f5ed92).
- Sweep 5 cartesian: no console errors; hover/leave/brush/legend at parity; migrated render cost ~10-14×
  lower, heatmap commits 3× and latP95 2.7× lower. Open differences dispatched to fix agents: left-to-right
  clip-wipe entrance (8 routes; 1.0 has none, gap 13), liveline tip/labels/stroke/pill, crosshair+pill
  glide vs tooltip, 2px tooltip offset, segment drag state, heatmap entrance, marker series-hover blur.
- Ruling: generated, data-shaped CSS (the evtmarker block sized for 16 groups/8 items) is rejected; marker
  motion must be a small generic rule set driven by per-node values.
- Round-5 agents were stopped by the user mid-flight and relaunched fresh on the same scopes, inheriting
  their working-tree edits.

## D725 — Round 7: entrance wipe, liveline, markers, native-track transition guard (2026-10-06)

- Entrance: line/area/projection reveal left-to-right like bklit's ChartRevealClip — a CSS clip-path inset driven
  by a registered `--bkm-wipe` (1.0 has no reveal, gap 13); marks paint instantly under it. The vertical
  seed/grow state and timers are gone from the kit (1697569). Composed (shell also clips bars, bars grow with a
  `i·0.4·dur/n` stagger) dispatched to its own agent.
- Liveline: area/line cut at the tip, d3 `nice()` y domain, label pad, vertical 1→0.6 stroke gradient, pill in the
  tick row (6cc197b); 4% left-edge fade as a mask on the static groups, pill halo as one capsule via a
  close/blur/threshold filter (ec090f1).
- Heatmap: hover CSS opacity transition chased the native enter tween (cells at 0.3–0.6 of bklit, then snapped);
  transition limited to settled cells (e5553d1).
- Ruling: a CSS transition must never apply to a property the native renderer tweens while a track runs. Rules
  carry `:not([data-ts-motion-role])`. An audit of 27 routes found one live conflict (liveline x tick labels, up to
  0.89 opacity off, per roll) and five inert ones; all hardened (5e59202, radar/sunburst/kit with their agents).
- Markers: the generated block is replaced by generic per-group nodes + ~35 lines of CSS (bklit MarkerGroup enter,
  rule lift, cluster badge pop + 160° fan, tooltip hide); series marker dots dim/blur on hover (fb6b903). The
  stagger uses `sibling-index()` (Chrome 138+); older browsers enter without it.

## D726 — Round 8: per-family parity sweeps, no-rebuild hover everywhere, styles.css repair (2026-10-07)

- Kit (8fb35c5, 3dfbec4, 9c623de): wipe offset var, brush blur panes + strict-row ticks under xDomain, date pill
  32px/500 with `pillBoxWidth`, highlight .4s, refarea bracket markers, hover gated to the plot rect via a
  `focus.resolve` that returns `[]` outside the margin-inset rect (kit, scatter, candlestick, composed, bar).
- Tooltip (77a05c0, 103af1a): native presence neutralised on the outer element; bklit's panel + 300/25 enter on
  `.ts-chart-tooltip__body`; leave fades the outer element (a mid-enter leave drops in ~0.1s); a mirrored keyframe
  name replays the enter on a placement flip (bklit `flipKey`); radius `var(--radius-lg)` (0 in the showcase).
  Choropleth (90adc6d) and heatmap (3489041) joined via their own class; heatmap snaps between cells and hides
  after bklit's 120ms hideDelay with no fade; `instant` honoured.
- Liveline (823cf90, 8bed269, f416575): custom `liveFocus` (synthetic point at the pointer x); tick fade under the
  pill is one static typed-`attr(x)` rule against a host `--bkm-fx` var, because core defers focus-state label
  opacity under data motion (gap 18). Tooltip refresh during a roll is a 1.0 limit (gap 17, 6 vs 29 texts/3s).
- Polar (3eb8526, 9ff3732, 872a8d0): funnel/radar/pie/ring hover cause 0 definition rebuilds — host `data-hover`
  attribute + fixed-text static CSS with index caps (past the cap: no emphasis, nothing breaks). Pie pop is a
  translate along the mid-angle, ring a 1.03/1.02 scale about the centre, both on 400/25 `linear()` springs. Ring
  geometry snaps on resize (24 vs ~318 d mutations). Accepted: pie `hoverEffect="grow"` still rebuilds (radius).
- Bar (b8634e1, 637d447), composed/heatmap (f9613f0), candlestick/scatter (c6dd080), sankey (a06dcb0): see commits.
  Sankey flow hit-test by perpendicular distance (2/122 oracle mismatches vs 25).
- Ruling: migrated entrances start 80–85ms (composed) / 34ms (heatmap) before bklit's. Shape, stagger and snap are
  identical; the offset is bklit's ParentSize + phase-hop latency. Not padded — a fixed delay would be a harness hack.
- Ruling: heatmap `TOOLTIP_BOX_HEIGHT` 91 stays (default body is fixed-height; the anchor callback gets no size).
- Incident: zero-context partial stages (`git apply --unidiff-zero`) had nested tooltip/brush/hatch blocks inside
  other rules in every committed styles.css from 8fb35c5 to 90adc6d (the working tree was always correct).
  Repaired in 103af1a. Shared files are now committed whole once their owners finish, or rebuilt from HEAD by
  block insertion, and checked with a nesting parser before commit.
- Open: bar hover/legend dim is still regenerated CSS (D724) — round 3 moves it to native focus state or static
  index rules; sankey tooltip joins the shared body path; repo-wide R1–R7 audit running.

## D727 — Round 9: static-CSS hover across kit/heatmap/sunburst/polar, repo-wide R1–R7 audit (2026-10-07)

- Candlestick/scatter (2345103): hover and legend dim are fixed CSS constants reading host vars (`--bkm-fx` against each
  mark's own `attr(x)`/`cx`, `data-bkm-legend`); no definition rebuild on legend hover (stable child table); 0.15s ease
  as bklit. Sankey (18ebed6): tooltip on the shared native body wrapper (150.8x64 as bklit); generated entrance CSS
  replaced by static `sibling-index()` rules. Styles (ed96609): D725 motion-role guards on area fill, marker dim and
  event-marker transitions; dead projection-line/dash-tail/marker-base rules and `defineFragmentCarrier` removed.
- Heatmap/sunburst (93dc447, 2664075): hover as host attributes + fixed CSS, no per-hover `<style>`, no root re-render;
  sunburst hover in an external store so only the hint re-renders; ancestor pop sized from each node's own path length
  as bklit's `buildHoverGrowTargets` (Direct 159.7-212.9 exact); heatmap tooltip reserves its 91px box (no 45.5px jump).
- Kit (df1cecc, 4ffbe5e, f3b5927): line/area hover, settle, legend and profit/loss dim as fixed CSS on host
  attributes/vars; date-pill tick fade one static rule on `--bkm-fx`; `LegendHostSync` leaf + `useStableTable`
  (trampolined closures, structure-only equality), `useHoverHostSync`/`LegendHostSync` exported for composed;
  profit/loss dims the other sign on pointer focus too (legend wins), mixed-sign legend dim a 0.2s stop-opacity
  crossfade; tooltip radius `var(--radius-lg)`; fan marker icons 1px lower as bklit's HTML glyphs.
- Polar (e07bb1e, 5224e32, 0e40087, e2f8584, 0d09d87): funnel/radar entrance as fixed-text CSS driven by host vars;
  one definition build per mount (funnel gated on measured size, radar renderer mounted after layout: 27 keys, 0
  duplicate animations; ring seed/expand/intro phases removed); ring entrance drops the reduced-motion gate (bklit has
  none), curve identical to bklit's 1100ms cubic-bezier(.85,0,.15,1) up to a uniform 20ms lead (RMS <0.45px); pie
  grow without rebuild (scale about the centre via `--bkm-tf`, donut swaps to a precomputed outline via CSS `d`, peak
  264.9 = bklit).
- Audit (read-only, R1–R7 over 24 chart routes): every route except composed shows 0 `<style>` and 0 structural
  mutations on hover/legend/idle. Composed still generates focus CSS (`composed-chart.tsx` `focusCss`) and keys its
  definition memo on `legendHovered`. Leftover `TMPCOUNT` probes in kit/bar definitions, unused exports and CSS found.
  Dead CSS removed (fa5f64d): `.bkm-tooltip-layer`, three heatmap separator/axis rules, the loading-sweep band section,
  `.bkm-native-tooltip` (no setter; `:not()` references stripped). `.bkm-evt-*` transitions are not natively tweened
  (no `data-ts-motion-role` ever), so no guard.
- Ruling: tooltip fade-in matches bklit; the earlier +120ms was a sampler misalignment, not a real offset.
- Ruling: uniform startup leads accepted, not padded: ring 20ms, pie grow 35-45ms, kit band ~28ms (same class as D726).
- Ruling: projection/line 0.3-0.7px switch offset is bklit's integer mousemove `clientX`; not reproduced.
- Ruling: sunburst ancestor overlays may sit up to ~1.5px off bklit's.
- Ruling: Safari donut grow degrades to dim-only (no CSS `d` there).
- Ruling: the 17 `native/shared/phase.ts` and `native/api/misc.ts` exports and `useSunburstBreadcrumbItems` stay as
  bklit public API (flagged unused by the audit, not deleted).
- Ruling: liveline root commits (~40/s) are the demo's data feed plus the bklit card's own hover re-renders (bklit
  `LiveLineChartCore` ~293/3s hovered vs ours 25); the "animate opacity from undefined" warning on liveline (and likely
  composed, bardepth, pie, radar, resize-lab) comes from bklit's motion code, not migrated code. No change.
- Live-perf sweep: migrated is faster or equal on first paint and render on every route; hover p95 is at parity; four
  settle regressions are in progress (sunburst, choropleth, scatter, candlestick).
- Polar audit items: pie/ring hover mirrors live only in the re-provide API providers (chart roots do not re-render on
  hover); `radarCssVars`/`useRadar` kept as bklit public API; dead radar axis-label, center-stat icon and funnel
  segment-label CSS removed (fa5f64d). `TMPCOUNT` probes gone (grep 0).
- Open: composed static hover (R1/R4/R6, then delete `hoverCss`/`pillTickCss`); radar `RendererChart` re-renders on
  hover (16-17/sweep, provider above the renderer); settle parity for the four routes above.
- Addendum (D727): settle parity closed. Sunburst `intro` read through a ref (the end-of-entrance rebuild ran an 850ms
  identical-`d` tween), choropleth fade cut at `animationDuration` as bklit's `isLoaded` swap (40cf801); scatter replays
  the same cut, candlestick enter on motion's `findSpring` (8722b02). Ruling: choropleth keeps its uniform ~100ms lead
  (delay 165, not padded to 265), consistent with the startup-lead ruling. Kit `useStableTable` trampolines resolved
  the Map step wrong since 4ffbe5e (c71ac34); bar/composed static hover ce22c45, radar provider R6 601e2cf.

## D728 — Round 10: per-frame interaction parity (touch, isLoaded gate, brush, rapid hover, liveline roll) (2026-10-07)

- Kit: touch as bklit (8edcdb1, one finger focuses on touchstart, two fingers clear hover and drag a range, compat
  mouse/click swallowed 700ms); hover inert until bklit's `isLoaded` on every kit, bar, scatter, candlestick and composed
  chart via `data-bkm-ready` + one fixed pointer-events rule (2da794d, 16f4e29); `native/kit/touch-focus.ts` wired into
  composed, candlestick and scatter; date pill guide `match: "group"` (composed shows it over bars); focus-layer fade
  removed (0c21a29); hoverDim skips markers; event-marker badges on `dominant-baseline: central` (48ea27b).
  Brush commits bklit's SAFE_PIXEL-widened extent (2px/side) while the controlled range stays raw; hatch, handles and
  blur panes widened 2px clamped to the plot; exact-midpoint focus ties pick the lower x as `bisectDate` (6722adf).
- Radar: dot group scale `max(.001,var(--bkm-p))` with exact reciprocal on the circle, area hover transform guarded so
  it no longer overrides the native entrance (437d876). Rapid hover via the shared `writeHoverAttr` phase (091a6f5).
  The 17-65ms onset lag did not reproduce (migrated 8-12ms ahead); the dim tween already matches bklit's 0.15s
  (ease-out fits bklit's frames best, RMS 0.029; the 0.80 vs 0.875 reading was frame phase).
- Liveline: head motion as bklit's per-frame lerp (f99ca76); line rolls natively again — monotoneX sampled into
  interior rows (a custom curve path forced the rolling planner's snap fallback), badge text written from the shown
  value (1cc57a2). Dot-to-line gap 0.81/3.7px mean/max (bklit 0.15/12.9).
- Polar: funnel gap hovers nothing, ring hit areas follow the 1.03/1.02 hover scale at pointer time (0d4f82d).
  Rapid/interrupted hover: CSS transition reversal removed by a 3-phase `data-hp` epsilon on rest/hot transforms, so
  every change is a fresh full spring (2ebebd5): pie centre 5.9→3.3px, funnel pop 16.9→5.9px, radar 2.95→1.39px.
- Hierarchy/geo: sunburst hover-in no longer uncovers the hovered arc, sankey tooltip reserves 64px (no 22px jump),
  choropleth drag ignores the first move delta as use-gesture (b7413f7); heatmap tooltip leave holds 120ms through the
  native exit presence (c6faa78). Resize paired on heatmap/choropleth/sankey within 0.2px.
- Scatter: hover restyles only the focused and previous columns (`data-bkm-f/-p`), pill var on the tick group
  (8c65b7e): >25ms hover frames 18-20 → 2-5 of ~100 (bklit 0-1), p95 18.1 vs 18.
- Ruling (exception): rapid-retarget velocity carry-over on pie/ring/funnel/radar. TanStack 1.0 mark states are
  tween-only (`charts-core/src/mark-state-transition.ts:6`) and arc state styles cannot move or scale
  (`ChartAreaStateStyle`); spring retarget with velocity exists only for scene-update geometry, which needs a hover
  rebuild (R1). Residual mid-flight error up to ~3.3px (pie), ~5px (funnel), ~1.4px (radar) is accepted. Settled
  hover stays within 1 frame / 1px. Donut grow (`d` transition) can still reverse (path() takes no calc epsilon).
- Ruling: scatter's remaining 2-5 slow hover frames are TanStack `placeTooltip` (`charts-core/src/tooltip-position.ts`
  reads offsetWidth/Height → forced layout); library cost, not migrated code.
- Ruling: heatmap svg box 1px taller (271.8 vs 270.8) is kept — cells, bottom edge and legend are identical; the
  `chartHeight + gap/2` stride compensation in `native/heatmap/chart.tsx` (f9613f0) is required.
- Ruling: accepted as before — 0.3-0.7px pill offset, config-shaped CSS, LOOKAHEAD=2 liveline, candlestick touchend
  quirk not copied, bar/scatter re-resolve under a still pointer on resize.

### D728 addendum — sunburst push/dim, composed settle, quiet perf pass

- Sunburst: hover pushes every arc under the hovered path outward as bklit's `applyHoverGrow` (67b335d; rings 1-4 rest
  within 1.05-1.53px). Re-hover after a zoom paints at once via a fixed per-index pop rule (1e16f34; 15ms vs bklit
  170ms). Hover dim has one source — fixed index-capped rules on host `data-bk-pop`/`data-bk-path` over persistent mark
  class tokens `bk-sb-a<i>`/`bk-sb-u<j>`; native dim states deleted (bc85ecc). Un-dim on leave fades 160ms ease-out like
  bklit (`sunburst-segment.tsx:14`); dead fill-/stroke-opacity transitions removed (8ebce43).
- Composed: the isLoaded snap rebuild runs a 0ms chart-level update; the kit's 200ms no-op tween kept the scene busy
  ~196ms past bklit (a9eaced). Settle 1491 → 1300 vs bklit ~1386.
- Quiet perf pass (25 routes × 3 fresh loads, medians): migrated first paint and render faster or equal everywhere; hover
  p95 within 1ms; settle within noise except composed (fixed above). 0 console errors.
- Ruling: sunburst ring 3→3 mid-transition gap is bklit's ~94ms hover-onset lag; migrated leads.
- Ruling: choropleth's one 33ms hover frame is first-pointer-move cost; bklit shows it in 4/5 loads, migrated 0/5. No change.
- Ruling: migrated settling up to ~90ms before bklit (earlier reveal start) is accepted; no deliberate reveal delay.
- Open: liveline path starts ~44px right of bklit's left edge with no left fade (agent running).
- Liveline left edge: the visible-start gap was the accepted lookahead showing while history is shorter than the window;
  the clip pad now backs off by it (e763e77). The left fade already matched bklit within 2 grey levels. Intro rolls
  natively from the first tick (b7ee8ee); start x 0.8/3.8px mean/max in the first 1.3s (was 7.5/19.9).
- Ruling (library limit): the liveline intro roll uses one easing for x shift and y reprojection (charts-core
  `motion.ts:2246-2270` one rolling timing; `motion-path.ts:130-160` one transform). bklit's linear x + exponential y is
  approximated by a 0.4 exponential / 0.6 linear blend. The dot's 5-7px y offset is the accepted LOOKAHEAD=2 design.
- Kit: series markers dim 0.5 + blur 2px on another legend row (bklit SeriesMarkersDimWrapper); dead `legendHovered`
  input removed (8aa02c7).
- Sunburst: entrance scales each sector about its own box via a fixed CSS `scale` animation (index-capped delay vars,
  intro-only `data-bk-intro`) while the native tween sweeps the angle (30f651f); ring first-visible 0-17ms, area
  crossings lag 3-15ms mean (never lead). Zoom enter/exit sectors stay opaque like bklit (charts-core always pushes an
  opacity enter/exit track, `motion.ts:~2621-2745`; fixed `[data-ts-motion-role]{opacity:1}` before the dim rules).
  Zoom and pointerleave clear the cursor controller focus (afc2886): leave mid-zoom no longer leaves a stuck dim.
- Ruling: sunburst re-hover under a still pointer waits a fixed 135ms (bklit fires mouseenter when its animated geometry
  reaches the pointer; no per-frame hit test without an rAF loop). Drill-in re-dim 272-291ms vs bklit 261-312ms.
- R4 sweep (a41ce6d): pill box width, bar tick hide and composed bar hover no longer generate data-shaped CSS. Kit
  `staticHover` (always true) and its per-row hover gradient path deleted (9170a3d).
- Kit open items (11db8fa): brush hatch phase fixed (strip 27% → 0 differing px); line point markers clip to the plot
  rect. ChartSelectionContext/SegmentStats are not bklit exports (selection rides on `useChart()`, at parity); marker
  fan-out within ~1px/1 frame. Ruling: segment `variant="gradient"` keeps the intended fading rule — bklit's own renders
  nothing (objectBoundingBox gradient on a zero-width line), a bklit bug we don't copy. Ruling: tooltip stays hidden for
  the whole segment drag as `use-chart-interaction.ts` specifies; bklit's reappearing drag-start tooltip is a stale
  scheduled-tooltip quirk, not copied.
- Polar open items: radar glow is a CSS drop-shadow (as bklit) and label hover never dims series — both stale diffs.
  Radar interactive labels gained cursor:pointer + 150ms brighten. Gauge notch enter is now bklit's per-notch scale+fade
  as fixed index-capped CSS (0.04px mean). Ruling: the agent's calibrated 70ms START_LAG_MS (to mimic bklit's mount
  startup) was removed — leads are allowed, artificial delays are not; notches lead bklit by ~50-70ms.
- Bar/candlestick open items (ba56f14): "solid crosshair" and "pill overlap" were stale (gradient fade and per-tick pill
  fade already match). Fixed: bar hover guides faded in over ~230ms because native ignored GUIDE_MOTION's `enter` key —
  now first-frame like bklit; bar pill 32px capsule; candlestick pill y (0.6px); dashed crosshairs unmasked.
  barsquares/bardepth hover and bar-family entrances re-verification dispatched.
- Hierarchy/heatmap/choropleth open items (0a71578): sankey/funnel hover does 0 definition builds (stale "hover rebuild"
  diff); funnel renderPattern + sankey link patterns implemented; heatmap show/hideDelay implemented — the 120ms hold had
  been invisible since c6faa78 (global not-hovered tooltip rule); activeScale pop already wired (stale). Choropleth
  un-dim now snaps on leave like bklit. Ruling: bklit's stale country tooltip on ocean after a long pointer travel is a
  bklit bug, not copied. Follow-ups dispatched: sankey rapid-leave restart lag (200-400ms), declarative funnel pattern
  offset (replace the per-render layout effect), heatmap legend-hover build count.
- Bar family (f1a38ef, bar lid commit): single guide per category, ease-out face dims, lid seed fix, ground-shadow marks
  removed, pill ink-skew centring. Accepted diffs: bardepth side-face top edge slants (<=3px) mid-entrance and its
  objectBoundingBox gradients see a growing bbox (no tweened clip natively); barsquares bklit gradient puts --chart-1 in
  the bottom 1% of each column only (demo offsets read as %), a 1-2px sliver not reproduced — native gradients are
  objectBoundingBox/definition-level; logged as a library limit.
- Funnel pattern offset declarative (7055ce3); heatmap legend hover 0 builds.
- Sankey hover (21672e2): native mark states → generic CSS reading per-element --d/--h (no size cap); rapid-leave lag
  gone. Ruling: per-element inline custom properties written on state change are allowed (scatter data-bkm-f
  precedent); the epsilon phase nudge reproduces bklit's full-duration restart and stays.
- Liveline (141c17b): tip trail removed (line error 8-15px → 0.2-0.6px mean); useHeadText rAF loop replaced by a native
  label stack + CSS keyframes. Residual maxima 13-18px, tail-area approximation, badge text sequence: in verification.
- Liveline residuals (799c77d): y-domain jump ticks snap path + slide tip on bklit's head easing; tail wedge area;
  right-axis overhang. Label pool costs 2.8x bklit's DOM mutations at 1/60th the render time — reduction in progress.
- Gauge (e59d047): linear demos added. Ruling: data updates must match bklit — geometry snaps where bklit snaps; the
  hover spring must not be reused for data changes (pie/radar). bklit's stale-y-scale line on update is a bug, not copied.
- Scatter SSR (18f960c): web-font load after hydration forces an `update` render mid-entrance that cancels enter tracks;
  enter motion now resumes the original schedule. Same fix pattern queued for bar/composed.
- Liveline churn (209d299): svg mutations 15833 -> 7839/20s. Badge exact-string mismatches are a comparison artefact
  (independent feeds, cent-level drift; HEAD scores the same).
- Gauge (956a9ef): one mark per notch layer via the native colour scale; DOM 352 vs bklit 354. Hover lat50 gaps ruled
  noise (collector measures event → end of next frame; median-of-3 parity).
- Data updates (2185b2b): geometry snaps like bklit; line/area/composed build twice on a data change ("snap" over the old
  y domain, then "glide" to the new one, 500ms on bklit's ease). Ruling: two builds per *data* change are fine (R1 covers
  hover/legend only); bklit's stale-scale line is not copied. Shared resumeEnter replaces per-chart resume code.
- Ring (608cb26): charts-core's font-load scheduleRender(true) cancels every in-flight animation; unchanged-geometry marks
  never see a motion call, so resumeEnter can't help. Ruling: a textless chart passes a zero measureText (exact, not a
  workaround). Ring is one chart again; remaining node overhead is the TanStack shell + per-arc groups the CSS needs (accepted).
- Gauge (b2478da): bklit's theme gradient is objectBoundingBox per notch — reproduced exactly from a ResourceHost.
- Font-load audit (7aa897f): rule — an entrance clock must live outside anything that re-runs on render or rebuild; the
  forced font render resumes through resumeEnter. Unchanged-geometry marks have no native hook: zero measureText (textless)
  or CSS keyframe entrances.
- Pie/ring updates (2893ab6): donut-grow `d` transition scoped to grow hosts; ring motion false outside enter.
- Drag-select (f170494): press hides tooltip/crosshair/pill/dots at once; dim + highlight band driven by host attributes
  and CSS vars (data-bkm-press/drag/segon, --bkm-hl0/1), so a drag move rebuilds nothing; only a committed segment changes
  the definition. Drag enabled on every CartesianChart (bklit drags on line/area/markers too). Ruling: bklit's tooltip
  re-pinning at drag start is a parent-re-render quirk, not copied. Brush click-outside collapses the native range at the
  click (strip shows full extent) so the next drag anywhere starts a new brush, as bklit/visx does. Per-rAF re-verify running.
- Drag hook (fb6256f), touch (792bfd2), native interaction (babe5cb): drag-select is one shared useDragSelect (composed now
  drags); synthetic PointerEvent dispatches replaced by the renderer's interaction controller (onRender context.interaction:
  resolvePointer + setControlledFocus(..., {source:"pointer"})). Ruling: no tooltip re-anchor at the press point after a
  drag (bklit segment-demo quirk). Hover/legend/drag/touch: 0 rebuilds, onsets at parity or leading.
- Data-update first-change lag (bar 14-19 vs 2-5ms, scatter 26-45 vs 2-7, radar n=100 108-139 vs 13-14, composed/area snap
  +5-10ms): profiled — one build per update (two for the y-glide charts), our code 1-3ms; >70% of the task is charts-core
  reconcileMotionSvg (per-element timing contexts + linear scene.points scans, quadratic in elements × points) which the
  surface always takes for a data change even when motion returns false. Plain reconcile (reduced-motion) lands at parity.
  Ruling: D16-class native reconciler floor — waived. A wrapper renderer swapping motion() on updates depends on TanStack
  internals and loses focus-guide state; rejected. Upstream fix belongs in charts-core (skip timing contexts when the
  motion callback returns false for the phase).
- Press/touch parity (f3c7b9a): scatter hides its tooltip on press, candlestick freezes it until the next move, a touch
  lift hides at once, bar ignores touch (mouse handlers only). Shared usePressGuard/useTouchInert. Accepted, not copied:
  bklit bar tap flicker; candlestick two-finger difference and post-lift reappear (parent-re-render quirks).
- Markers/pie (c4a85d4): focused marker = bklit's 1.35x core + ring (crop diff 3913 -> 288 px); donut grow `d` transition
  armed by hover (data-hp), disarmed on a rows change so data updates snap like bklit.
- Non-cartesian touch (19dc2dd): tap-to-hover persisting until a tap elsewhere (pie, ring, radar, funnel, sankey); press
  hover cleared on lift/move (heatmap, sunburst). Shared useTapFocus/useMousePressFreeze via the interaction controller.
- Crosshair layering (fd5cd9b): crosshair declared before the base marks -> native under layer, beneath the focused dot
  (dot crops line 192->4, area/segment 194->0; full-height strips closer to bklit on every route, composed unchanged).
  Ruling: candlestick keeps the over layer (under hides it behind bodies). Markers residual (bklit's crosshair sits between
  the static ring and the active dot; no native middle layer) — accepted.
- Remaining sweep (eb6e681): liveline touch-inert; zoomable choropleth taps to hover (was a stuck tooltip) and one-finger
  pan skips the first delta like use-gesture (bbox within 1px); sunburst non-zooming clicks never reach the renderer.
  Funnel mouse-down frame not reproducible; heatmap "residue" is TanStack's hidden tooltip host (library, left).
  Rebuild counts pie/heatmap 0/0/0, sunburst 0/0/2 (zoom = data change). Open: choropleth rebuilds on every pan/pinch frame
  (transform + isDragging are definition-memo deps) and pinch steps differ (d3 continuous vs visx 0.9/1.1 eased) — in work.
- Choropleth pan/zoom (dee80ca): definition built once on the unzoomed projection; d3-zoom writes --bkm-zk/zx/zy on the
  host and static CSS transforms the marks layer (bklit's 0.18s ease-out, none while dragging); hit testing and tooltip
  anchor map through ProjectionHolder.transform. Rebuilds hover/drag/touch 0/24/42 -> 0/0/0. Touch pinch steps 1.1/0.9
  about the midpoint like visx (final sizes = bklit; onset leads). The "second move counts double" step count is empirical
  (matches bklit for 2/3/6/8 moves). Strokes scale with zoom, as bklit's <g transform>.
- Rebuild audit (all remaining routes): 0 rebuilds on hover, legend, press/drag and touch everywhere; liveline 1 build per
  600ms data tick regardless of interaction. Load-time extras found and in work: width-0 first build on every
  CartesianChart route; composed's snap rebuild at duration-16 (re-resolve during entrance) and its `entered` rebuild;
  bar depth/squares `entered` seed + `revealOver` rebuild at 2*duration+200.
- Load builds (9bb0674, 0834b7c, f2c12d8): measure-before-mount (kit/host-size.ts useHostSize: empty host measured in a
  layout effect before first paint, then the chart mounts at that size) — line/area family 2 -> 1 build, composed 4 -> 2.
  Composed's reveal-end snap (bklit's static-rect swap) is folded into each bar's single reveal-long tween easing, so
  nothing re-resolves during the entrance. Ruling: the remaining `entered` seed flip is the entrance trigger, not a
  mid-entrance re-resolve — charts-core's initial pass animates only barY marks and a rect only enters into a painted
  scene, so custom/rect marks need one seeded paint. Rejected for bar: a renderer/surface proxy that forces
  requestRender(true) after the seeded paint (renderer internals; same class as the rejected data-update wrapper).
- Bar reveal (9853a2c): revealOver timer and entering gate removed; one entrance clock shared by the seed and full builds,
  resumeEnter resumes inside the window and snaps after it. bardepth/barsquares 3 -> 2 builds, plain bar 1.
- Phone/regression sweep (24 routes, 1280 + 390): no layout shift, first paint 0–90ms earlier, settle equal or earlier,
  no migrated errors, hover p50 within 2ms. Heatmap (ded6278): the 160px fluid min-height is gone, so bklit's wrapper hugs
  the grid (390px 160 -> 100 = bklit; 320/600/900/1280 equal). The sweep's heatmap entrance "+87ms lag" did not reproduce
  (migrated leads 65–100ms by cell opacity and pixels). Ruling, barsquares at phone width: both impls render a degenerate
  92x46 chart with no animation; bklit's "settled 1857ms" is perf-panel timers on a broken chart, and matching it would need
  an artificial delay, so it is not copied.
- Sankey (515acaa, 13cede4): it no longer throws at phone width (sankeyDiagram rejects an extent narrower than a node; bklit's
  d3-sankey runs with a negative inner width). The native layout supplies y/heights/layer only, and layoutColumns places
  columns with d3-sankey's formula inside bklit's side margins, so the reversed narrow layout is pixel-identical at 390px.
  A ResizeObserver boolean rebuilds only when the width crosses that threshold. Flows: static clip reveal on bklit's
  schedule (mirrored keyframe under data-bkm-reversed) instead of a curve-morphing x2/y2 tween, p90 +52ms lag -> ~33ms lead.
  Labels use fill-mode backwards, so settled text leaves the composited layer and is crisp. Settled diff 0.78% -> 0.15%
  (pinned offsets; the 3.44% was partly a sub-pixel box offset), all sub-pixel text.
  Left as-is: flat flows use a solid source colour; bklit renders nothing below 10px.
- Sunburst/funnel (2db67da, 202dcc7, ae18692, d3a8af6): the cause of both tail lags was a compositor layer held past the animation.
  The sunburst label fade now animates fill/stroke-opacity, and the funnel grow and label fades now fill backwards. Removing the layer
  removed a re-raster pop or residue at the end (sunburst 99% +430ms -> +17ms). Funnel geometry snaps to whole pixels like
  bklit's per-stage svgs (stage starts, pill edges, label baselines from canvas font metrics); bklit's edge cubic has control points
  at 55%/45%; the pill shadow-sm is a static drop-shadow. Unsnapped pills measure worse (0.32/3.72% vs 0.24/2.64%). The funnel's
  entrance still trails by 3-4 frames in pixel terms while the shapes trail by only 1 frame per rAF; this is under investigation
  (labels/pills).
- Strict settled sweep (all routes, pinned integer offsets, RGB sum > 24): box sizes are equal everywhere and tooltips match. Fixes:
  brush b9c7a2c (visx selection stroke as an outline, since the hatch mask clips stroke; 1.09 -> 0.21%); sankey 70d2b26 (flat flows get
  a 0.001px rise so the objectBoundingBox gradient paints; 1.85 -> 0.65%); cartesian 9009c5d (x tick labels never thinned and
  lifted to bklit's fixed position when the margins exceed the host, markers 390 2.16 -> 0.40%, composed 1.98 -> 0.97%;
  marker fades snap to final at bklit's isLoaded timer, markers d90 +57 -> -117ms).
- Ruling, pie 99% tail +2 frames: a library floor (D16 class). Timing matches bklit exactly (last mutation 16ms earlier). TanStack's
  arc entrance clips each slice with a polygon wedge (radialSweepClipPath, a vertex every pi/24) that shaves ~0.4px off the
  outer arc until each track ends, so ~100-200 px stay off the final frame a few frames longer. Avoiding it would need a rebuild,
  a rAF loop or an offset. Sunburst and radar are at exactly 1 frame with no source mismatch (radar scales its stroke inside
  createRadialPathTracks). These pass.
- Brush drag: the strip rebuilt on every preview (84 builds per 20-move drag). Design: TanStack's documented two-state pattern
  (controlled value = last accepted range, previews never fed back; conformance case 89), plus brush initialSelection
  kept out of the stable-table identity. Done 055e370: strip 2 builds per gesture (StrictMode x2), 0 on Escape; the brushX
  reason sits at `context.reason.type` (reading `reason.type` gave undefined, so commit and cancel looked the same). Kit routes
  are unchanged settled at 1440 and 390.
- Funnel entrance, labels/pills (edd456a): there is one entrance mechanism (the CSS fade). The native text/rect enter motion was dead
  code (the charts-core initial pass animates only bars/paths/arcs) and was removed. Remaining lag ~2 frames at 1440 (d50 +33, d90 +34,
  d99 +50) and <=1 frame at 390: CSS animations get their start time on the first frame after insertion, while bklit's motion
  clock is read before the mount frame's work. Ruling: rejected the agent's fix of setting `animation.startTime` from handleRender
  (getAnimations on every entrance render, an imperative clock override = an artificial offset). Accepted as a CSS-timeline floor.
- Prop parity outside page defaults (6055b60): funnel grid lines are on by default and drawn at the gap centres (they were cell outlines); grouped
  label padding uses cell width; radar level labels are unrounded; bar Grid highlightRowValues are drawn. Open: shared Grid fade/edge/highlight
  props in kit/scatter/candlestick (agent running), gauge `uniformWidth` (notch shape, may need a polygon mark). Ruling: bar `barWidth`
  stays unimplemented (a bklit left-aligned fixed-width quirk; nothing passes it).
- Sub-pixel audit: candlestick is 0.000% at every width (the earlier 390 diff was the Next dev badge). Projection (5952adb): the forecast
  curve uses bklit's 0.45-tension horizontal-tangent bezier (curveBumpX is 0.5; the longer path drifted the dash phase), 0.255 -> 0.089% /
  0.370 -> 0.262%. Rulings: the sankey tooltip "0.6px lower" is input quantization (pointer events carry fractional coordinates, so
  TanStack's tooltip follows the exact pointer; at integer pointer positions y matches exactly and x is within 0.02px). The 390 top-edge
  clamp of 8px vs bklit's 16px is a library constant (tooltip-placement.ts). The sankey residual (0.65% / 3.4%) is text raster: label
  boxes match within 0.2px, and nudges only make it worse (CSS-transform text vs SVG-transform text advances). Accepted.
- Keyboard/a11y audit: bklit charts are not focusable at all (no tabIndex/keys/focus styles; sunburst has role=img + label only).
  Ruling: keep TanStack's native chart accessibility everywhere (svg tabindex=0, role=img + aria-roledescription=chart + label,
  arrow-key point navigation with tooltip/highlight, ring on :focus-visible only). It is strictly better and pointer behaviour is
  unchanged. Escape keeps TanStack's default (tooltip stays). No ariaDescription data summaries (they would be data-shaped). Fixes: stops that do
  nothing (brush strip: enable native brush keyboard, else non-focusable; gauge: one stop per gauge) and sunburst keyboard
  stepping that showed no visual. Gauge uniformWidth landed (10b5bea, areaX polygons via a createNotchPath curve); Grid props landed
  (9e76787).
- Line/area entrance "1 frame behind": not reproduced. The timing and easing match bklit (1100ms, cubic-bezier(.85,0,.15,1)); the migrated
  wipe starts ~3ms after insertion (composed 10-18ms) while bklit's clip starts 50-90ms later (effect-then-animate). Medians
  migrated - bklit are leads everywhere (line d99 +17/18ms = 1 frame). The bimodal late runs (reference-area 390, brush 1440) are the
  capture harness: the DOM timeline never shows migrated mounting later. Passes, no change. Brush strip a11y + sunburst
  description: 0b02bc4. Gauge default arc as chord polygons: 0c98b71.
- **Barsquares at 390 — no entrance in migrated, ruling: accepted.** At phone width the demo plot is ~12px and every bar rect is 0px wide in both impls. bklit's ~1.5s "entrance" in the panel is its JS tween writing `height` on invisible zero-width rects (864 mutations, nothing visible); screencasts show both boxes final by ~1170ms with only axis labels appearing. Generating invisible mutations would be fake motion. Settled diff 1.056% at 390 is bklit stacking every month label on top of each other (degenerate layout quirk, not copied); 0.150% at 1440.
- **Liveline settle in the live perf panel (992347a).** Per-tick roll animations (our CSS keyframes; bklit rolls by rAF style writes) kept migrated at the 5s cap. Rule for both impls: only finite animations that start within 500ms of first paint count as the entrance. bklit ~540ms after paint (500ms WAAPI wrapper fade), migrated ~660ms (600ms gradient stop fade) — fade parity handed to an agent.
- **Liveline entrance fade (1930507).** bklit's only load animation is the LiveYAxis tick labels (motion spring 180/24 -> 500ms WAAPI opacity); ours already does it natively via `y.tickLabels.motion`. The extra 600ms `stop-opacity` CSS transition on the area-gradient stops was ours alone and invisible (per-tick alpha step < one colour level), so it is gone. Settle now matches bklit within ~1ms absolute; entranceMs differs only by migrated painting ~45ms earlier.
- **Dark mode + live theme switch sweep.** All chart colours flow through `--chart-*`/`.dark` tokens; remaining literals are bklit's own defaults. Settled and hover strict diffs in dark within ~0.4pp of light on every route. Live `d` toggle: zero childList mutations, single-frame repaint in both impls (next-themes `disableTransitionOnChange`), post-switch frame = fresh dark load. One real bug: inline `background: transparent` on legend row buttons beat the hovered `bg-legend-muted` (fixed). Open: reference-area dashed boundary ~0.5px offset + fill-edge AA (theme-independent, more visible in dark) — handed to an agent.
- **Tooltip edge (ruling: documented `tooltip.portal` hook accepted).** The native resolver's fixed 8px scene edge (`charts-core/src/tooltip-placement.ts`) cannot express bklit's `offset`-px top clamp and flip threshold. `native/shared/bklit-tooltip-portal.ts` is a position-only portal extension (module constant, no rAF/overlay/transform) used by heatmap and sankey; tooltip rects now equal bklit at 390. Upstream ask (edge as tooltip option) noted for UPSTREAM-GAPS. Sunburst unrelated-label hide moved to host `data-bk-rel` + PUSH_CAP fixed index rules (same precedent as a41ce6d, not data-shaped). Residual heatmap/sankey 390 hover 2–4.6% is tooltip text AA (no ±2px shift reduces it); heatmap 1440 row-gap hit (bklit shows no tooltip in the cell gap) left open.
- **Reference-area boundary (ecd0a59).** Native `rect` insets 0.75px and `lineY` defaults to round caps (+0.5px per dash end); bklit is a plain rect + butt lines → `inset: 0`, `lineCap: "butt"`. The CSS edge-fade mask sized to the element bbox clipped zero-height lines' AA rows; bklit's SVG mask covers the plot, so the mask is one 10000px unclipped tile (Chromium clips repeated tiles to the bbox even with no-clip). Settled light 0.347/0.847, dark 0.372/1.319 (1440/390); remainder is y tick text and sub-threshold line-over-fill darkening.
- **Hover snap ties + legend layer (1b929cb).** 390 hover at f=0.5 landed one day apart: an exact midpoint tie, where bklit's bisect keeps the lower point and `focusGroupX` took the higher on ~1e-14 noise; kit and composed now hand it only the lower-x points. Legend dim: the migrated `:has` rule caused one subtree invalidation per pointer move (library detach/restore churn) → `[data-hovered-any]`. Found while checking it: the unscoped migrated rule was also what dimmed bklit's own legend in the showcase, and being unlayered it beat `opacity-40`, so both boxes showed 0.5 where bklit's app shows 0.4. The migrated rule now sits in `@layer base` like bklit's, and bklit's app-level rule lives in showcase globals scoped to the bklit box: faded rows 0.4/0.4. Open: hover-agent `--bkm-fx`/band-var writes on renderer-owned nodes held back until proven to survive reconcile (`syncAttributes` drops `style`); kit 390 tooltip flips against the viewport not the container (agent); remaining hover latency (~1ms over bklit) is library-side (`resolveFocusScene` fresh scene → full focus reconcile per move, `placeTooltip` offsetWidth recalc) → UPSTREAM-GAPS.
- **Live resize sweep (7b5aa26).** Playwright 1440→900→600→390→1100, a 41-step continuous drag, and a resize at 300ms into the entrance on every route. Every route but funnel matched a fresh load within 0.03% and settled no later than bklit (bklit itself is 3-50% stale ~90ms after a resize on many routes, and scatter's bklit box keeps stale dimensions; not copied). Neither impl replays its entrance on resize; one definition build per committed width. Funnel labels and pills glided for ~11 frames on the 120ms update tween → `motion: false` (snap like bklit): resized = fresh 0.000%, drag 937 → 443ms (bklit 399). Open: heatmap drag ~2x bklit (615 vs 288ms; 27k attribute mutations, style recalc 196 vs 33ms), under frame budget (p95 19ms) — queued after the heatmap tooltip agent.
- **Rule: never write state onto renderer-owned nodes (6516d66).** Verified: inline vars written on the kit x-tick group / highlight marks were gone within ~1s of pointer movement, because the per-move retarget reconcile's `syncAttributes` drops any attribute (incl. `style`) the next scene lacks; earlier passing diffs were pointer paths ending on a fresh write. Vars back on the host; kept only the host-side `hasBand` skip. Same root cause as the sunburst `data-sb-rel` loss (15993c7). Repo-wide audit of imperative writes onto renderer-owned nodes handed to an agent (scatter pill var on the tick group and per-dot `data-bkm-f/p` are the first suspects).
- **Heatmap gap + tooltip weight (af285a2).** Gap pointer no longer snaps to the nearest cell (`maxFocusDistance: 0`; containment still hits), tooltip weekday/value at weight 400. Ruling: the remaining ~0.25px tooltip text offset at 390 (Chrome snaps the paint offset of a root holding a finished fill-both presence animation; cloning/cancelling gives 0.00%) is accepted as a sub-pixel library artifact, alongside the earlier sankey quantization ruling. Upstream ask: release finished presence animations (commit styles + cancel) → UPSTREAM-GAPS.
- **Renderer-owned audit result.** Scatter pill var + per-dot `data-bkm-f/p` were lost to reconcile; host-var rewrite works but costs hover latency (16.1 → 20.7ms vs bklit 16.1), sent back for a cheaper host-owned scheme. Sankey `--d/--h` per-node writes + `hoverWriter.sync` (re-write-after-reconcile) handed to an agent. Heatmap `data-hm-active` survives move/hold/resize/theme; left as is.
- **Ruling: liveline `liveTooltip` wrapper stays (only sanctioned extension wrapper).** No native 1.0 route: with the pointer resting outside bklit's hover area, `updateFocus(…, forcePaint=true)` (renderer.ts L520-535) repaints the unchanged empty focus every roll frame, and `tooltip.hide()` (tooltip.ts L324-343) has no already-hiding guard, so the exit restarts forever. Focus config, `maxFocusDistance`, `visibility: 'pinned'` and `tooltip.portal` all hit the same path; a host-attr CSS fade would fight the WAAPI presence animation. The wrapper only makes `hide()` idempotent over the public extension instance. Upstream #19 (also: skip `forcePaint` when both focuses are empty).
- **Edge-case data sweep (361406e).** All 17 charts render empty / single / equal / zeros / negative / NaN / null / undefined cases without throws or NaN attributes. Rulings:
  - A: where bklit maps missing/NaN values to y=0 spikes or draws negative-size shapes (line/area/bar/barsquares nan-null-undef, bar negative, radar/funnel/sunburst negative, sunburst nan, candlestick null-nan-undef), migrated shows a gap or clamps to 0. Not copied: these are bklit defects, not design.
  - B: where bklit emits invalid `d` attributes and console errors (ring nan/undef, funnel nan/undef/zeros, sankey), migrated renders the sensible zero/empty result.
  - C: sankey with no positive link: bklit throws a RangeError, migrated renders the empty state.
  - Open: single-candle width (native barY caps inferred width at 48px with no spacing; bklit 0.8 of plot), candlestick x tick count at 640px (2 vs 4), liveline negative (5.1%), heatmap undef (0.34%) → agent.
- **Sankey/gauge resize cost ruling.** Sankey drag main-thread ~450ms vs bklit ~300ms over 41 steps: bklit's visx ParentSize is debounced (2-3 re-layouts, stale chart mid-drag, resized-vs-fresh 2.65%); migrated re-lays-out exactly every step (resized-vs-fresh 0). The extra ~4ms/step is browser text layout + style for genuinely changed attributes plus TanStack's markup re-parse (no redundant mutations, no forced layout). Ruling: keep exact per-step layout; do not copy the debounce (it trades correctness for a cost that stays inside one frame per step). Committed cleanup: one font read per layout, one placeLabels pass. Gauge: settles at frame 1 like bklit; the later 3-4 "changes" were only `data-ts-motion-state/progress` flips on the svg; main thread 386 vs bklit 485ms. No change.
- **Sankey hover on the host (see commit).** Per-element `--d/--h` writes + `hoverWriter.sync` replaced by host vars and a fixed index-capped rule set (caps 32 nodes / 96 flows, sunburst PUSH_CAP precedent; past the cap an element does not dim — documented limit). Verified surviving move/hold/resize/theme; latP50 17.8 vs bklit 21.6ms. 390 tooltip: root 16/24, rows 14/20, weight 500 on the value only; computed styles equal bklit at 390 and 1440.
- **Kit tooltip flip (see commit) + pill stacking ruling.** The cartesian tooltips now use the bklit portal with `pinTop` (bklit TooltipBox: flip on `x + width + offset > chart width`, top at plot top) instead of the viewport first-fit list; tooltip rects equal bklit within 1.5px at 390 and 1440 across the sweep. Ruling: the composed date pill painting under the tooltip at 390 (2.24% at one pointer position) is accepted as a library-structure limit: the pill is an svg guide label and the tooltip an HTML sibling; foreignObject surgery or a mask hole would break the overlay/wrapper rules. UPSTREAM-GAPS #23.
- **Scatter hover rebuilt on bklit's structure (see commit).** Group-level dim layer + native active focus marks replace per-dot attributes (lost to reconcile) and the rejected host-var `attr(cx)` scheme (+6.3ms). latP50 17.4 vs bklit 15.6: same absolute cost as HEAD, now with a dim that actually holds; ~0.6ms of the gap is the host pill-var write, the rest is library-side focus reconcile + tooltip layout (UPSTREAM-GAPS #21). Accepted. yGradient path untested in-browser → next sweep.
- **Edge leftovers.** Candlestick ticks now use bklit's even-spacing search (the old home-made rule only found equal gaps); heatmap undefined counts = level 0. Liveline negative values: no mismatch (5.1% was live timing; same data shifted positive reads 2.89%). Single-candle width: library cap, accepted, UPSTREAM-GAPS #24. Temporary edge-lab pages deleted.
- **Heatmap resize (see commit).** Root cause of the 2x cost: two renders per step (the chart's own observer painted the stale cellSize, then `onRender` reported the width and rendered again). Fixed by sizing from the container observer with an explicit `width`. The agent also added bklit's 300ms visx debounce (411ms, below bklit); the lead removed it for consistency with the sankey ruling: exact per-step layout, no debounce. Result ~495 vs bklit ~300ms, resized-vs-fresh 0.000% (bklit 0.524%), worst frame 27 vs 50ms. Remaining gap is TanStack `domText.refresh()` reading getComputedStyle per update (~92 forced recalcs per drag) → UPSTREAM-GAPS #21 class.
- **Scatter yGradient.** bklit draws each dot inside translate(cx, cy) with a userSpaceOnUse gradient (y1 = innerHeight, y2 = 0), so every dot renders the `to` stop; its tooltip dots and rows ignore yGradient. Migrated had invented per-height buckets. Ruling: match the rendered output (a flat `to` colour, not garbage, so ruling A does not apply). Rest diff 0.559 -> 0.128%; hover residual equals the no-gradient baseline. Temporary yg-lab page deleted.
- **Resize double-render audit.** Pattern: renderer's own observer paints the stale size, then onRender feeds scene size into state, which rebuilds the definition and renders again. Fixed in funnel (478 -> 395ms vs bklit 370; vsFresh 0 vs bklit 1.52%) and pie/ring (same pattern, flat; kept so every size-dependent chart sizes one way). Choropleth: `size` only feeds useChoropleth(), not the definition, so no change (39 callbacks / 41 steps, as bklit). No other chart feeds rendered size back into a definition.
- **Console sweep (26 routes × 1440/390, load + hover + resize).** Migrated: 0 warnings, 0 errors everywhere. All 176 messages are motion-dom "from undefined" warnings from bklit's motion/react elements (pie, bardepth, composed, liveline, radar, resize-lab); nothing under showcase/migrated imports the motion runtime.
- **390 hover sweep.** Fixed static causes (marker icon dy, pill offset/text columns, composed bar bottom corners per bklit rx=ry, grid mask edges, reference-area z-order). Lead amended the z-order: the agent always put the band under the series; bklit paints in JSX order, so `readChildren` now records declaration order (WeakMap, carried through `useStableTable` copies) and the band goes under only when declared before line/area/patternArea (verified in Chrome DOM order). Remaining 390 hover means 0.4-1.4% (composed worst): pill box device-pixel snapping in bklit's HTML vs SVG rect (~0.2px), data-dependent day-glyph subpixels, crosshair mask edge AA. Accepted as sub-pixel raster (pass bar ~1px). Bar resting 0.72% = corner AA.
- **Composed/bar 390 residuals.** Bar resting 0.716 -> 0.034% (rx/ry clamp, UPSTREAM-GAPS #25; checked in Chrome: bar demo rx = ry = min(8, w/2, h/2), squares and depth unaffected, stacked uses paths). Pill box: constant shift instead of centring on measured ink height. Composed hover still ~1.6% at 390: the pill sits under the tooltip (#23) and bklit's month/day two-column pill text for one-digit days (our single label sits ~4px off; no native per-text column layout). Accepted. Crosshair 1px rule rasterises as one lighter pixel vs bklit's two (geometry identical), accepted.
- **Date pill two columns.** Reversed the earlier acceptance of the ~4px one-digit-day offset (beyond the 1px bar). TanStack's guide label has no multi-part option, so the pill is two native focusGuideX guides (box + month, transparent day); per-definition `pillLayout()` measures the widest month/day once, host vars `--bkm-pm`/`--bkm-pd` + fixed CSS place each text. Text within 0.03px of bklit on all pill routes; latency line 17.6 vs 15.8 (sweep baseline 17.4 vs 16.0), area 16.8 vs 15.7: within a frame.
- **Gauge/sunburst/pill-tick follow-ups (ed058aa).** From the acceptance sweep: gauge arc value line box 1.5 (bklit's `leading-none` is dropped by tailwind-merge) and linear notches with corners use the createNotchPath polygon (390 rest 0.65 -> 0.13%); sunburst sectors paint deepest ring first like `sortSunburstSegments` (1.23 -> 0.15%); the scatter "tie" was bklit's `label === hoveredLabel` branch (same-label tick of another year hides), now on every pill chart via host x vars + fixed CSS (scatter 390 f=.5 2.74 -> 2.11%). Line/scatter hover p50 unchanged (17.8/17.7 vs 15.7/15.6). Scatter dim compositing (dot + ring dimmed as two groups vs bklit's one) dispatched.
- **Heatmap 390 residual ruling: accepted.** Hover ~4%: tooltip box, text rects, picked cell, pop and dim identical to 1/64px; the glyphs raster ~0.3px apart because the tooltip's backdrop-filter layer is composited for the library's enter animation (ActiveTransformAnimation) where bklit's is an Overlap layer. Controls: `will-change:transform` on bklit's panel makes it identical to ours; integer left makes both match. Matching would need a compositing hack or dropping the blur. Rest 0.91%: 380/387 px are SVG-text vs HTML-span axis-label raster (ink boxes identical); 7 px are the bottom-row cell overhang at ~15% coverage from the required `+gap/2` height compensation (LOG heatmap height). Both sub-pixel, under the 1px bar.
- **Pie/ring hit-testing.** Pie hover region is the painted radius (`size/2 - hoverOffset`, bklit's invisible `hitboxPath`), not out to the pop-out ring: rim probes at 390 now show no hover in both. Ties: `insideSector` is edge-inclusive (1e-9, wrap near 2π) so the later, topmost slice wins like SVG hit-testing, and the apex belongs to every sector (bklit centre picks the last slice). All pie probes match at 1440/390; pie/ring hover p50 15.3/17.0 vs bklit 15.6/17.5. **Ring rulings, accepted:** (a) bklit shows "Social" for any pointer with y exactly at the centre (dy = 0, every radius; dy = ±1 is normal), a measure-zero bklit artifact, not matched; (b) inner-edge flapping from the hover scale is timing-dependent and not expressible by a stateless focus resolver (UPSTREAM-GAPS #26).
- **Scatter dim compositing (cause confirmed).** bklit dims once on the series `<g>` holding each point's disc + ring (series-markers.tsx `SeriesMarkersDimWrapper`); migrated dimmed two sibling marks, double-compositing the blurred halos (splitting bklit's rings into their own group reproduced ours: 2.11 -> 0.79%). Fix: one dot mark per series with two circles per datum. Since `dot` `strokeWidth`/`stroke` are scalar (charts-core dot.ts:54-56), the disc is inset by half the ring width and its stroke fills to `radius`, so resting 390 edge AA rises 0.26 -> 0.43% (accepted, under the bar); hover 390 light 0.43-1.08% (was up to 2.11). Dark 390 hover ~1.2% residual is crosshair/pill-outline/active-ring raster, covered by the 390 hover sweep ruling. Hover p50 17.6 vs 15.8, DOM nodes stable across a hover sweep.
- Sankey leave-after-move fade re-measured per rAF (14 nodes, 33 flows, six move/leave/re-enter timings): node opacity max diff ≤0.001 vs bklit, flows a one-frame phase shift on the 180ms tween. The old "restart" open item is closed: hover-css.ts host-var retargeting already holds the in-flight value.
- Liveline visual-QA fixes:
  - The area stripe beside the tip was a gradient-box mismatch: the main ramp is now normalised to its own box, and fill levels are uniform to within 1 level.
  - The pulse ring drew at 0.2 peak opacity; it now peaks at 0.5 like bklit, and the radius range comes from the dot size through host vars.
  - X labels are now a slot-keyed `createMark` and the tail group has a stable key (CSS restarts through parity classes), so element churn over 10s fell from ~500 adds to 1 (gap #27).
  - Intro y labels: the previous tick set now glides off on the head easing. Residual accepted: bklit's new labels glide in over ~0.7s, while native tick labels have no enter-from position and fade in at their final positions; matching that would need a per-tick rebuild.
  - The 390 badge sliver is identical in both. The motion.dev "animate opacity from undefined" warnings come from bklit's motion components.
- Polar visual-QA fixes:
  - The gauge centre stat now mirrors bklit's PieCenterShell: it paints 0 and swaps in the real value after a double rAF (bklit pie-center-shell.tsx:59-60). The roll now ends 450-460ms after notch 0 in both.
  - Radar keyboard navigation has one stop per series, so arrows step series and match pointer hover within the focus outline.
  - Pie, ring and radar at 1440 dark and 390 light/dark match bklit at rest, on hover and after leave. The only ring outliers come from synthetic fast paths through the ring gaps.
  - Gauge notch delays and durations match bklit. A uniform 140-250ms start lead remains: bklit's motion entrance starts 70-110ms after its svg appears, and its chunk mounts later. This is under investigation (it is the same start-trigger question as for candlestick and heatmap).
  - Escape does not clear keyboard focus on any chart: charts-core only uses Escape to dismiss a pinned tooltip or cursor session (gap #28).
- Segment/markers/brush QA follow-ups:
  - Segment drag: bklit's press clears the tooltip, but its re-anchor effect immediately re-shows it at the last hovered x, held through the drag and after release until the next move. Migrated now keeps the hover chrome on press (drag-select.ts) and matches the held, released and next-move frames.
  - The markers 390 negative `<rect>` height console errors come from bklit's own rects; migrated has none.
  - The brush hook-size error does not reproduce (most likely a hot-reload transient).
  - Markers hover-enter: the active dot appears 1-2 frames after the dim starts; otherwise r, opacity and halo match.
- Gauge start lead root-caused. bklit's svg commits on the second frame: visx ParentSize's ResizeObserver callback, then one rAF, then a leading-edge debounce setState. Its motion notches start two frames after that commit (frame.read, then the clock frame).
  - Migrated mirrors both steps without timers: `useGaugeHostWidth` follows the ParentSize chain (fixed-size gauges measure immediately), and `<GaugeEnterArm>` holds the notch animations paused for the two frame hops.
  - Per-notch lead went from about +165-250ms to about -20ms (one frame late) at both 1440 and 390, with the svg commit at the same instant as bklit. Accepted at about one frame.
- Sunburst: sticky hover fixed with a capture-phase pointermove filter scoped to the chart's own host; leaving from the hole clears like bklit. Departed arcs keep collapsed copies, so zoom-out returning arcs grow from a point like bklit's (about 1 frame later at the start, accepted).
  - The settled zoom area gap (1162 vs 1126) was a probe artifact: it counted the invisible `:pop` copies and the path hub. All 10 arcs match within 0.1px and the hub is identical.
  - True 390 layout, light and dark: sunburst and choropleth load, hover, leave, zoom, pan and keyboard focus (Tab, arrows, Home/End, hover+focus, Tab out) match bklit or the native focus ruling. The choropleth tooltip y is within 1px.
- Segment, patternarea, markers and brush matrix (1440 dark, 390 light/dark):
  - Console clean on the migrated side.
  - Keyboard (Tab, arrows, Home/End, hover+focus, arrow after hover, Tab out) correct in all 12 combinations.
  - Brush handle and body drags give the same labels as bklit, with the selection box within 1-2px.
  - Markers legend hover and click and the cluster fan-out badge match.
  - Residuals: the fan collapse is 1-2 frames earlier, and the marker active dot appears 1-2 frames after the dim.
- Sankey 390:
  - The narrow-host `reversed` flag is now also measured in the layout effect. The observer's first callback landed mid-entrance, rebuilt the definition and restarted the flow draw 40-60ms late; flows are now within a frame of bklit.
  - Node hit-testing picks the last-painted node, as SVG does, so piled-up 390 labels dim the right item.
  - Funnel hover, keyboard and hover+focus match at 1440 dark and 390 light/dark.
  - bklit's 24-88ms React-rerender hover onset is not mirrored (it would need an artificial delay).
- One kit source for bklit's start chain: `native/kit/parent-size-arm.tsx`.
  - It provides `useParentSizeWidth`, `useParentSizeMounted`, `useFrameArm` and `HoldArm`, and owns the visx ParentSize chain (ResizeObserver, then one rAF, then the size commit) plus motion's frame hops.
  - The gauge-local `host-size.ts` and `enter-arm.tsx` are deleted, and the gauge notch d50 is about +18ms (one frame).
  - The tuned lag constants (candlestick 35ms, heatmap 85/15ms) are removed.
- Sankey nodes and labels are held for motion's two-frame start (`HoldArm`, released after the svg reveal). bklit's flows are a JS `animate()` started in an effect, one frame after commit, so they sit ahead of the nodes. Flows now follow the plain formula: within about 5ms at 1440, and inside bklit's run spread at 390. The labels slide 20px from the node edge like bklit's. Hover, keyboard and hover-during-entrance were re-verified.
- Heatmap start is +21-47ms, accepted. The tween chain is equal (commit to first nonzero is 158-170 vs 148-163ms). The residual comes from migrated committing its cells one effect hop after the svg, where a hop costs one ~400-cell paint. With no hop it starts -60ms, and with bklit's literal two hops +30-62ms.
- Cartesian wipe distance: `--bkm-wipe-mr` is now 0px and the right margin moves to `--bkm-wipe-off`, so the reveal grows 0 to the plot width like bklit's rect. Before, plot+margin led by up to ~250ms at 390.
  - With a post-rAF read, the reveal clock starts on the same frame as bklit for segment and patternarea: same hop count, and a one-rAF release delay A/B changed nothing.
- Waivers (lead ruling), both bklit commit cost with no trigger to mirror; matching would need a re-render or a fixed wait:
  - Markers' reveal starts 65-100ms after migrated's. bklit's two reveal commits are heavy (118/138 mutations, ~25ms FunctionCall tasks for ChartMarkers portals and the clip remount), so motion's clock starts 2-3 frames later than on segment.
  - Brush leads about 25ms for the same reason (ChartBrush/visx commit weight, one extra frame).
- Cartesian batch:
  - Reveal arm: the `<RevealArm>` leaf releases `data-bkm-hold` after two effect-driven commits, so line and composed wipes hit 50% within ~10ms of bklit.
  - Rolling date pill (design B): one custom focus-guide mark (box, native clip window, month and day stacks of static labels), with the roll driven only by the `@property` `--bkm-rm`/`--bkm-rd` spring-shaped transition. One guide per chart; hover writes nothing to nodes.
    - Hover p50 vs bklit: line +3.4, scatter +2.8, composed +3.1, candlestick +1.8, bar +1.6ms. With the pill disabled, line and scatter are still +3.2/+2.3, so the remainder is the chart's own focus work (TanStack's motion progress attrs).
    - Ticks under the capsule drop instantly via the shared `pillTickStaticCss`. The bar family gets bklit's tickerHalfWidth distance ramp via `--bkm-bfx`.
    - Composed `hostGeom` passes `pillLayout`; it showed row 0 before.
  - Ghost tooltip on a fast margin exit: fixed `visibility:hidden` rules on the tooltip and focus layers under a hovered surface without the hover attr; bar, scatter and candlestick set `data-bkm-on` on every focus. Hidden before the move ends on all routes at 1440, 390 and dark.
  - Keyboard after hover continues from the hovered point (`navigationPrimary`). The 390 tooltip enters already flipped like bklit's 180px first measure.
  - Candlestick: start on bklit's ParentSize+motion chain, both wicks from `open` (never detached), and the reveal-end swap on bklit's timer clock (`useRevealClock`, mount effect + duration).
  - Scatter: `REVEAL_LAG_MS`/`REVEAL_END_LAG_MS` removed for the same clock; start within ~1 frame, settle within +1.5%.
- Reveal clock fix: `useRevealClock` never engaged. The native enter resolves during the commit that mounts the svg, before its effects, so `mountedAt` was null and the end fell back to `enterAt + duration`; the earlier good numbers were coincidence.
  - It now stamps once in the render of that commit. Scatter's end is -18 to +22ms over 16 runs at 1440, and the 1-in-6 +110-160ms tail is gone. Candlestick's end is -33/-17ms.
- Keyboard during the entrance (scatter, candlestick): hover is inert until `data-bkm-ready`, but native keyboard focus showed the tooltip and focus layers. These now stay hidden until ready (the svg focus ring stays), so keyboard visuals equal hover visuals at every moment.
- Settled hover diffs, per element:
  - The hv 600ms frames were still in flight. At 1.5s the per-card diff is 0.01-0.3% on kit routes at 390 and 1440, and the tooltip bbox converges to 0.0px.
  - Composed 390: the tooltip box and pill rect are identical (0.1px). bklit paints the pill above its tooltip card, while ours is under it. Accepted residual (gap #23): an SVG guide can't interleave with the HTML portal, and the workarounds (a data-shaped clip, a DOM overlay) are banned.
  - Bar family pill centred on the nearest bar rather than the band centre: fix in work. The 390 crosshair antialiasing from the CSS mask is under investigation.
- Keyboard during the entrance, all 27 routes: every chart that gates hover with `data-bkm-ready` (kit, bar family, composed, scatter, candlestick) showed the native keyboard tooltip and focus layers while hover was inert. A fixed rule now hides the tooltip, focus layer and focus-guide layer and their descendants until ready, and early keyboard equals early hover everywhere.
  - Choropleth, liveline and sankey have no entrance gate (hover works early in bklit), so keyboard follows the native ruling.
  - Heatmap's early hover shows nothing in migrated where bklit shows a tooltip at 300ms: in work.
- Heatmap early hover, ruling: accepted as a library gap (#29). Migrated hover opens when the reveal ends (~2s after load); bklit's opens at the commit. The cause is that TanStack containment hit testing (`maxFocusDistance: 0`) finds no entering marks until their motion publishes presentation points. The inscribed-radius alternative was rejected because it over-hits gaps and margins after the reveal. Keyboard works early, which matches bklit's early hover availability.
- User ruling: QA is Claude in Chrome only. Headless/Playwright scripts and panel.mjs are banned for QA and verification from now on, because charts must be observed. The full Chrome pass (all routes, hover and keyboard focus, 1440/390, light/dark, live perf panel) restarts once the Chrome window is visible (document.visibilityState is currently "hidden").
- Chrome QA pass (5 parallel agents driving the one visible Brave tab under a lock, window captures via a local endpoint; all 24 chart routes plus overview and resize-lab; rest/hover/leave/keyboard/mixed, light/dark, 390px card width (the window manager won't go below 1440), live perf panel, console). Verified and committed: bar pill centred on the band (bar, bardepth, barsquares; pixel-identical to bklit by eye), crosshair as a gradient rect guide on line/scatter/candlestick (solid, faded ends, light and dark, matches bklit), bar keyboard visuals hidden until ready. Composed has no crosshair line in either impl. Guide paint scoping logged as gap #30.
- Chrome QA open items: liveline y tick step (bklit 5, migrated 4/10) and liveline keyboard landing on overscan rows outside the window; candlestick hover (crosshair dot under the hovered candle; dimmed candles show the wick through the body); funnel dimmed pill contrast; bar svg loses DOM focus when the reveal finishes; markers at 390px tooltip clipping (unclear); worst hover frame higher on line/area/patternarea (30/22 vs 12-20ms). Escape is gap #28 (every route). Funnel gap-hover: bklit source makes the gap dead too; re-check before changing.
- Bar "focus lost at reveal end": not reproducible in Chrome (bar, line, scatter, pie, composed hold focus through the reveal). The only svg swap is SSR hydration ~50ms after load (`RendererChart` client mount); Re-run remounts the card by design. No change. Closed.
- Candlestick hover (Chrome-verified, lead re-checked 0.06–0.08% pair diff at two positions): the close dot is a `guideMark` after the crosshair rule in the same over layer (was `focusGuideX` in the marks focus layer, so the rule painted over it), positioned with `scales.y.map` (`guideMark` now passes the render scales as a 4th `node` arg). Wicks cover only the part outside the body (max(o,c)→high, min(o,c)→low), so a dimmed translucent body no longer shows the wick through it (bklit dims the whole opaque group).
- Funnel dimmed pill (Chrome-verified, dark 0.02%): the percentage text is no longer colour-mixed to 40% on top of the already 40% pill (bklit dims the whole label group once; text stays at the card colour). Light/390px residual 0.6% on dimmed text antialiasing. Gap hover: dead in both at the gap centre; 1px boundary difference at the gap edge only, not changed.
- Liveline keyboard: `navigation` filters focus points to the plot bounds (the same bounds `resolve` uses), so Home/End/arrows no longer land on overscan rows (Chrome-verified by fix-live). Open: a keyboard-focused row then scrolls out with the stream (crosshair off-plot after ~1s); bklit has no liveline keyboard. Y tick step re-check by lead on a fresh visible load still diverges (bklit 5→20, migrated 4→10): bklit eases per rAF tick (refresh-rate dependent, display at ~100Hz) — sent back.
- Live perf panel: hover metrics split into first hover (first 300ms of the first enter window) and steady hover (p50/p95/worst/fps, plus last-window worst), with pointermove→next-frame latency p50/p95. The panel doesn't flush, sort, measure the DOM or re-render while the pointer is moving inside a chart, so it no longer adds noise to what it measures. `hoverWorstFrameMs`/`hoverP95FrameMs` now mean steady. A first small sample shows migrated line pointermove latency 12.4 vs bklit 2.9ms p50 (the per-move whole-chart re-render; kit refactor in progress).
- Liveline y step, ruling: migrated now replays bklit's per-rAF-tick domain ease at the display's frame period (one-shot 3-rAF measurement at mount, no loop) and re-picks on bklit's ≥32ms commit gate with the same hysteresis. Exact step parity is not reachable deterministically: bklit keeps a step while its spacing stays in [0.5, 3]×minGap, then picks fresh from whatever range the eased domain has at that frame, which depends on rAF and React-transition scheduling. bklit itself chose 4 on fix-live's load and 5 on both of the lead's fresh loads (migrated 4 then 10, matching fix-live's bklit). Accepted as same-algorithm parity. Keyboard: `group` clears a focused row once the roll carries it outside the plot (guard; the earlier drift did not reproduce on a visible tab).
- Chrome entry QA, all 24 routes: Re-run, then pairs at 150/400/700/1100ms taken from the same window capture, ±50ms (`scratchpad/qa2/report-qa-entry.md`). Matches: brush (no entrance), pie, ring, projection. Differences, in work: choropleth fades in too early (migrated drawn at 400ms, bklit nearly invisible), funnel later-stage pills/labels lag, gauge arc sweep behind and centre number roll order differs, sunburst slightly behind mid-reveal. Cartesian charts plus sankey and radar are 50–100ms ahead mid-reveal with total durations within 5%, and heatmap is 150ms longer: read-only analysis in progress, to find out whether it's clock start or mount order.
- Entry clock ruling (cartesian charts are 50–100ms ahead mid-reveal): the cause is clock start, not mount order (Re-run remounts both cards in one commit). bklit's wipe starts about 3–4 frames after mount because of its chain: visx `ParentSize` (a ResizeObserver callback plus a frame) mounts the svg in phase "ready", then an effect sets "revealing", and the `motion.rect` clock starts a frame later. Migrated measures the host in a layout effect before first paint, and `RevealArm` releases the CSS wipe one frame after mount. Easing `[0.85,0,0.15,1]` and the 1100ms duration are identical, so it's a constant 2–3 frame shift. Accepted, no change: copying it means adding artificial delay to model a visx measurement artifact (the no-tuned-delays rule). Heatmap +150ms entranceMs: same stagger formula on both sides (Park-Miller seed, `maxDelayMs` is 0 at the default 1.6s), so it's attributed to extra mount commits plus the settle poll's granularity (50ms poll, 150ms idle). Accepted.
- Gauge and sunburst entry (Chrome-verified with `__qa.entry`, before/after pairs `fixgauge_*`, `fixsun_*`):
  - Gauge: the centre number now mounts with the chart, once `hostWidth` is set (bklit's `PieCenterShell` mounts with the svg after ParentSize). Its count-up had started about 2 frames early, and now matches at 150, 300 and 450ms. Notch springs and delays already matched bklit's source.
  - Sunburst: the grow tween resumes from the mount-effect clock (`introAt`, reset on each replay) via `resumeEnter`, not from the first update after the seed timer and a render, which is where bklit's `useMountProgress` clocks start. Pair diff at 700ms is 0.58 → 0.36%, at 1100ms 0.49 → 0.27%. A small outer-ring trail at 700ms remains with no bklit-sourced cause, so no tuned offset was added.
- Choropleth entry (Chrome, per-frame opacity sampling after Re-run): the fade curve is now bklit's. The layer opacity is `curve(t)` over the 1100ms `[0.85,0,0.15,1]` tween, cut at `animationDuration` (800ms) with a snap to 0.85 (bklit's `isLoaded` static-layer swap). Migrated used to divide by `curve(window)`, which made it about 14% too bright at every moment. Before: 0.56 vs bklit's 0.12 at about 705ms. After: the same curve shape and the same snap, with a constant ~140ms lead from bklit's remount chain (measure → epoch effect → re-key → mount-progress effect, so its fade starts ~300ms after Re-run). Ruling: as with the cartesian entry clock, the latency isn't modelled further. The existing `ENTER_FADE_DELAY_MS = 165` (D727) stays, and no larger tuned delay is added.
- Kit hover cost refactor (native guide-only focus): the cartesian tooltip anchor is declarative (`{x:"value", y:"plot-top"}`), so the renderer skips tooltip repaint while the pointer stays on one point. Hover dots (`dotGuideMark`), the scatter/composed/vertical-bar dots and the bar rule (`crosshairRuleMark` with `centre`) are focus-guide marks, so a focus change reconciles only the guide fragment, not the whole scene (`focusGuideX` retarget removed from the kit). The pill roll is the guide motion on each stack's translateY. bklit's per-hover ticker mount (springs in from row 0) is a one-shot CSS keyframe from `--bkm-rm0/--bkm-rd0`, written once on hover entry; the `@property` transition is removed. Lead Chrome check, hover pairs vs bklit: line 0.022%, bar 0.03%, area/patternarea 0.02–0.03%, brush 0.1%, markers 0.06%, scatter 0.013%, composed 0.008%, candlestick 0.084% (anti-aliasing, identical zoomed). Bar keyboard rule, dots and pill are on the band. Line perf panel hover sweep: 100 fps, 0 dropped, worst frame 11.8 vs bklit 11.7ms; move latency p50 9.9 vs 7.7ms (was 12.4 vs 2.9). Open: horizontal bar crosshair/dots still use retarget; tick-label fade vars and settle flip not moved.
- Funnel entry, ruling: accepted as is. Grow, origin, 1100ms ease, 0.12s stagger and the label fade (350ms easeOut, +0.25s) are bklit's values. The migrated run is 1–2 frames behind (shape ~10ms, labels ~25ms, within ±50ms): Motion starts its label tween at commit, a CSS animation starts on the next frame. Closing it would need a negative delay or a rAF driver (both banned). An attempt using `startTime` from the frame clock made the gap worse and was reverted.
- Bar family, hover then keyboard: the focus strategy's category representative is the point keyboard navigation walks, not the bar nearest the pointer, so an arrow key after a hover continues from the hovered category (Chrome: bar Apr→May, bardepth Apr→May, barsquares May→Jun; hover pairs 0.026–0.043%).
- Horizontal bar is now guide-only and follows bklit's horizontal design: a fade rule at the end of the focused category's longest bar (`crosshairRuleMark` with `by: "y"` and `barEndCentre`), no pill and no dots. Category labels sit on the y axis at 0.7 opacity and go to full/foreground on focus, with no value axis. The retargeting `barCrosshair`/`hoverDots` layers are removed. The showcase has no horizontal route, so the lead verified it on a temporary horizontal config of the bar demo (since restored): rest 0.053%, hover 0.108% (labels ~1px), ArrowDown Safari→Firefox. A QA report of horizontal bar defects came from a half-edited demo by a stopped agent and is not a defect.
- Tooltip portal mount glide (bklit TooltipBox): the first placement of a show uses bklit's 180x80 default refs (which also set the entrance side), then retargets to the measured placement through the tooltipBoxSpring (100/20) sampled as a 900ms `linear()` transition (`data-bkm-settle`). Pointer moves to a new anchor use the native tooltip motion. Heatmap passes `animate:false` (bklit's static path, measured before paint). Chrome: scatter right edge at +120ms is mid-glide at the same spot as bklit and settled identically at 1000ms; heatmap right edge is static from the first frame (settled 0.13%). Known gap: a retarget during the glide starts from the final spot (~8px, <100ms).
- Liveline x labels are a `ChartControl` (outside the clipped marks group), with the `x-tick-label:slot:i` keys kept; Chrome: slot x positions identical to bklit through the roll. The hover point keeps the identity of the row at or left of the pointer, so an arrow key after a hover continues from it.
- Hover cost (Chrome, 40-move sweeps): choropleth and sunburst had real gaps from mark `states` (a full scene repaint per focus change, UPSTREAM-GAPS #31). Choropleth now uses host `data-hover` + scoped CSS: p50 15.5 → 8.2 ms against bklit's 7–8, handler 8.5 → 1.1 ms. Sunburst dropped `popStates`/empty `states` for `[data-bk-path~=i]` CSS: p50 10.7 → 8.9 ms, and paint latency is now below bklit's. Hover pairs match (sunburst 0.006–0.01%). Ruled not real: candlestick (noise), sankey and heatmap (migrated does less work; the rAF work lands in "lat"), radar (parity). Ring: the centre NumberFlow re-render is synchronous during pointermove in both impls (same total work), accepted. Composed and markers are at p50 parity, with about 5 ms more kit work per move (p95), still open.
- Bar and composed corner radius mid-grow: bklit's rects carry rx = ry, which the browser clamps per axis, so a growing bar shorter than 2×radius is a pill or oval. Composed now emits the scalar radius (native `<rect rx>`, ry auto) instead of the corner-radii tuple, whose path arcs shrink both radii together. Chrome showed per-bar enter timing is kept with the rect form, so the old comment saying it wasn't was wrong. The bar CSS clamp (UPSTREAM-GAPS #25) now limits the radius to half the band thickness only. Chrome e550: short May/Jun bars are pills in both. Bardepth is unaffected (bklit radius 0).
- Barsquares entry, ruling: the per-square schedule matches bklit exactly (frame-sampled square heights: identical gaps; every square leads by a constant 60–70ms). It is the accepted cartesian mount lead (bklit: ParentSize debounce + the revealEpoch remount). It still shows at e1100 only because the cascade runs to about 1600ms with the steep ease. Accepted, no change.
- Barsquares in a sub-160px chart (390px demo card beside the 200px legend), ruling: bklit's layout is degenerate there (aspect 2/1 with 40px margins gives a negative innerHeight, so no squares, and all six month labels overprint). Migrated (TanStack clamps the plot to 1×1, with native label thinning) is kept. Copying bklit's broken output is not migration parity, same as the bar n≥1000 precedent.
- Candlestick entry origin: bklit's AnimatedCandle scales each body and wick about its own centre (`bodyTop + bodyHeight/2`, the wick centre). TanStack 1.0 has no enter origin: a bar grows from its y1 (`addEnterMotionTrack`, `metadata.bar.baseline`). So during the entrance each body and each wick is two native `barY` bars from the shared centre growing outward (`body` + decorative `body-lo`, `wick` + `wick-lo`), with the same delay and spring. At bklit's `isLoaded` timer (the existing `data-bkm-ready`), the definition swaps once to the rest geometry (snap), which is not a hover rebuild. Exit is instant, as bklit unmounts. Legend dim is gated on ready, because bklit's AnimatedCandle ignores the legend during the entrance. Chrome entry pairs at 150/400/700/1100ms went from .77/1.06/.43/0 to .15/.10/.004/0 (light) and .22/.20/.08/0 (dark). Rest is 0 and the hover pair is 0.066%. The residual is 1px edges from the stroke (bklit's scaleY scales it too).
- Dark (1440) + true-390px entry QA, all 24 routes (Chrome; Re-run pairs at 150/400/700/1100ms): dark hover MATCH on all 24. Fixed: candlestick centre grow (5d184d8), bar/composed mid-grow pills (741b70e). Dispatched: liveline fill seam left of the live dot, gauge centre text 1px low at 390, radar late-reveal lag (100–200ms), sunburst trail (50–100ms), pie (1–2 frames), gauge/funnel fill lag at 390. Rulings: markers and barsquares in sub-160px charts are degenerate in bklit (accepted; migrated kept). Sankey at 390 collapses identically in both (parity). Sankey's mid-reveal lead is the cartesian-style mount lead (accepted).
- Hover dropped frames and per-move cost (Chrome, `__livePerf` + 84-frame probes):
  - **markers:** dropped about one frame per move because the highlight clip glide re-rasterised 24 per-bucket `blur(2px)` groups (bklit blurs one wrapper). The fix is `will-change: filter` on the marker groups (drops 12/84 → 0).
  - **composed:** the 64 per-index dim rules are now one geometric `attr()` rule (89 → 26 rules, handler 1.8 → 1.3 ms).
  - **tooltip portal:** the panel size comes from a ResizeObserver (no forced layout per move). The mount glide was re-verified in Chrome: first and second shows match bklit at +120 ms.
  - **FocusLayer:** subscribes only when it has passthrough children.
  - **choropleth:** a country-to-country move now snaps, as in bklit (`data-bkm-swap`); only the ocean-to-country enter fades. It still drops about 1 frame on that enter (177 per-path opacity transitions), and a follow-up is dispatched (focused feature as a guide over a group-level dim).
  - patternarea and barsquares now measure 0 drops. Hover pairs: markers 0.088%, line 0.006%, area 0.003%, patternarea 0.018%, composed 0.015%.
- Choropleth hover takes bklit's structure: one dim on the features group (host `data-hover` + CSS, 180ms ease-out on the ocean-to-country enter; country-to-country and leave snap), and the hovered country drawn again on top by a native focus-guide-only mark (`native/choropleth/highlight.ts`, `motion:false`, a copy of the feature's own scene path at opacity 1). This replaced the ~177 per-feature generated CSS rules and the per-path opacity transitions. The 0.85 rest opacity is on the group as in bklit, not per path. The zoom transform applies to the guide layer as well. There is no guide before the reveal (`data-bkm-ready`). Chrome: hover pairs match (Venezuela, zoomed, country-to-country, leave), and keyboard focus highlights. Real-mouse hoverDropped is 1 → 0; moveLat P50/P95 is 11/21.6 → 9.8/16.9 ms (bklit 8.8/10); first-hover worst frame is 21.7 → 10.1 ms (bklit 10.1). The 84-frame probe shows 0–2 drops per 70 enters, at noise level (bklit 0–1).
- Polar and funnel entry timing, ruling: accepted, with no code change. Per-frame geometry sampling after Re-run, at 1440 and at a true 390px card, paired elements by final box and compared 50%-crossing times. Migrated trails bklit by: radar 10–30 ms, sunburst 5–29 ms, pie 5–8 ms, gauge 2–25 ms, funnel 14–33 ms. All are inside ±50 ms. The QA estimates of 100–200 ms (radar) and 50–100 ms (sunburst) were amplified by the steep [0.85,0,0.15,1] ease. Delays, staggers, durations, springs and origins match bklit's source (radar-area seriesBase, sunburst buildSunburstEnterTiming, gauge 300/20 notches, funnel 0.12 stagger + pill 0.25/0.35). The residual is the clock start (UPSTREAM-GAPS #33). The radar dots' CSS animation trails its own polygon by 6–17 ms, also accepted.
- Liveline fill seam: the main area and three CSS-scaled tail pieces each had a bbox gradient, so the scaled pieces stretched their ramp and showed a lighter seam left of the live dot; hairlines opened mid-roll between clocks. Now all fill pieces are flat. bklit's 0.1→0 ramp is one view-box-fixed CSS mask from the curve peak to the plot bottom. The tail pieces sit opaque in one group at 0.1, outlined with the line's stroke width so joins close. One whole-pixel cut at the path's resting end splits the main area from the tail group, and piece A carries the last two intervals so the cut stays covered while rolling. Removed: the 40-stop gradient and all tail gradients. Chrome: rest plus 3 mid-roll frames show no deviation over 1 level, matching bklit within 1 level; hover and dark are fine.
- Gauge centre text 1px low at 390, ruling: not a chart defect. Inside the gauge, both impls measure identically (text box, padding, baselines). The bklit card's fractional height (559.14px from aspect 21/16) puts the migrated card below it at y ≈ .141, which tips the value across a pixel row. Shifting the bklit card by 0.141px takes the pair from 0.471% to 0.004%. No change.
- Focus-change QA sweep (Chrome, all routes: hover A→B mid-transition at 80ms and settled, leave, Tab + arrows/Home/End against bklit hover at the same datum, hover→arrow, arrow→hover, blur): a–f MATCH on area, bar, composed, funnel, line, patternarea, reference-area, scatter, segment and projection. hover→arrow continuation, hover taking over from keyboard (no double highlight) and blur clearing hold on every route. Dispatched:
  - liveline keyboard start (Tab/Home land on faded buffered rows; a held row rolls out), MEDIUM;
  - heatmap 2-D arrows;
  - arrow order on sankey (declaration, not layout y), sunburst (screen x across branches), choropleth (GeoJSON order);
  - gauge's 3 inert tab stops; square browser focus ring on charts narrower than their card;
  - bar/composed previous tick label and sunburst wedge fade at 80ms.
- Liveline keyboard: core re-checks a held row every roll frame through the strategy's `group()`, and the leftmost in-bounds row rolled past `bounds.left` within about 4 rows, so `group()` returned [] and focus cleared (0x0 tooltip, no guide). Now `navigation` walks the hover-reachable rows (real, in bounds, by x). Home goes to the first and End to the newest, and a rolled-out held row hands focus to the first visible row (`group()` contract), so focus rides the left edge. Smoothed rows leaving the last pad row count as pad. Chrome: Tab, Tab+Left, Home+Right×2, End, a 3s hold riding the edge, Left clamp, arrow→hover and blur all verified. Heatmap 2-D arrows: not expressible in 1.0 (UPSTREAM-GAPS #34); chronological order kept.
- Keyboard order follows the screen, through native `ChartFocusStrategy.navigation` (the renderer still steps, Home/End and Tab-in). Sankey: nodes column by column, top to bottom by layout y, then flows by source column → source node → target y (End = Homepage→Bounced). Choropleth: west→east by spherical geoCentroid longitude (antimeridian features sit where their land is), north first on ties; while zoomed or panned only features meeting the visible area are stops. Chrome verified the orders, hover→arrow (Blog→Product, Denmark→Germany), blur, and Home/End (USA/Fiji). Follow-up: after a drag-pan, Fiji's keyboard tooltip appeared at an unrelated spot, under investigation.
- Focus polish:
  - gauge: `keyboard: false` (native, so the host gets tabindex -1). The 3 inert tab stops are gone, and each svg is one `role=img` labelled `Gauge: N%`.
  - One shared focus ring in styles.css: `--bkm-focus-ring` (shadcn `--ring`, 55% in light), 2px, inset -2px so card overflow can't clip it, radius 6px, `:focus-visible` only. Removed the old not-focus-visible rule and the heatmap outline hack.
  - Sunburst: the old wedge's dim goes from 420ms to bklit `HOVER_DIM_TRANSITION` 160ms easeOut, and the on-path overlay shows instantly (no 420ms fade-in). 80ms A→B is 0.017% and rest→hover 0.072%.
  - Sunburst keyboard order: native `navigation` in `native/sunburst/focus.ts`, depth-first clockwise by bklit `arcIndex` with the hub first. The undrawn view-root point is excluded when drilled in, and `resolve` keeps the renderer's nearest-point hover.
  - Ruling, bar/composed 80ms tick fade: per-frame sampling shows identical 0.4s ease-in-out curves (bar-x-axis/x-axis source). The residual is bklit's React-commit start offset (~70 vs 47ms) plus capture latency. At 80ms, bar Feb→Mar is 0.509% (tooltip/pill 1px apart mid-slide) and composed 0.425%. Accepted, no tuned delay.
- Choropleth zoom/pan keyboard:
  - The 42c0369 visibility test used each feature's whole projected box. Antimeridian features (USA, Russia, Fiji) span the map, so they stayed stops everywhere, and their off-screen centroid tooltip clamped to the plot edge.
  - Now `createGeoGeometry` caches per-feature path bounds, a hit Path2D and one box per post-clip projected ring, rebuilt only on projection change. A feature is a stop when some ring overlaps the visible area by ≥2px.
  - The tooltip anchor follows bklit: the clamped base centroid, then `zoom.applyToPoint`. Keyboard falls back to the zoomed centre of the largest visible piece when that point leaves the plot. The hover store keeps the unzoomed point, like bklit `tooltipData`.
  - Chrome: wheel-zoom Europe walk, pan Home = USA beside its visible part, End = Indonesia (Russia/Fiji no longer stops), panned hover→arrow DR Congo→Botswana. Zoomed hover pairs match bklit (Russia, Spain).
  - Known: wheel-zooming while keyboard-held with the pointer off the map doesn't re-anchor until the next focus change.
  - The `writePillRoll` console error agents report is stale `.next` dev chunks; the source has only `writePillRollIn`.
- Verification pass, dark mode and 390px card:
  - focus ring (line, pie, sunburst, heatmap) is visible, rounded and unclipped; a mouse click never focuses the svg;
  - liveline keyboard at dark/390: Tab, Home, Right×2, End and a 3s hold all show tooltip, guide, pill and marker, and blur clears them;
  - gauge is skipped by Tab and Shift+Tab.

  Ruling: the liveline pill at End clips at the card's right edge, but bklit `live-x-axis.tsx` also centres the pill with `x:-50%` and no clamp, so this is parity.
- Choropleth keyboard through zoom:
  - The held tooltip already re-anchors on every zoom frame: a pan/zoom re-render calls the host `update` with the same definition, which repaints focus and re-runs `tooltipAnchor`, so the "doesn't re-anchor" note in the 700310c entry was stale.
  - A held feature the zoom carries wholly out of view is cleared by a layout effect through native `interaction.setControlledFocus(null)` (bklit parity: a hovered country is always under the pointer, so no tooltip ever names an unseen one). The next arrow resumes from the first visible stop.
  - Visibility now clips the projected shape to the view with d3 `geoClipRectangle` (box pre-filter kept, cached per projection and view). A stop needs a ≥2×2px clipped piece, and `visibleCenter` uses the largest piece.
  - Europe walk (k≈2.9): 87 stops from Canada to Russia, every one with painted pixels in view. The Venezuela 6×2px box graze is gone.
- Final regression sweep, part 1 (Chrome, light 1440): 15 routes, 0 FAILs.
  - Routes: area, bar, bardepth, barsquares, brush, candlestick, composed, funnel, gauge, heatmap, line, liveline, markers, patternarea, pie, plus resize-lab.
  - On every route: rest, hover, A→B and leave all under 0.25% (heatmap ≤0.25 is label AA). The first focus arrow shows the same tooltip as bklit's hover; with the ring band excluded every pair is ≤0.33%. Blur clears and the console is clean.
  - Liveline is over the gate only from live-stream time skew and the existing y-step ruling.
  - Ruling: barsquares legend rows are buttons (Tab reaches them and focus highlights the series), while bklit's `legend-item.tsx` is a hover-only div. This is a keyboard addition under the 0b02bc4 a11y ruling, kept.
  - The sweep stalled when a stray agent tab hid the shared tab, which froze captures. The lead closed it, and the last routes were re-dispatched.
- Final regression sweep, part 2: projection PASS (rest 0.000%, hover 0.014%, A→B 0.022%, leave 0; the first arrow equals bklit hover, ring-only 1.1%; blur clears; console clean). Radar, reference-area, ring, sankey, scatter, segment, sunburst and choropleth are blocked: the Brave window went hidden and resized to 717×763 outside the session, and capture needs a visible window. Pending a re-run when the window is restored.
- Final regression sweep, part 3 (light, 1714): radar, reference-area and ring PASS. Rest ≤0.006%, hover ≤0.045%, A→B ≤0.059%, and leave/blur clear (ring leave 0.312% is post-spring AA on both impls, not a stuck state). The first arrow equals bklit hover at that datum (ring-only ~0.78–1.1%), and the console is clean. Ring edge-point hover flap reproduced on bklit only (accepted gap #27); interior points pass.
- Final regression sweep, part 4 (light, 1714): sankey, scatter, segment, sunburst and choropleth PASS.
  - Rest ≤0.174%; sankey's 0.504% was a split-capture artifact from the narrow window. Hover ≤0.283%, A→B ≤0.136%, and leave/blur clear.
  - The first arrows equal bklit hover (ring-only ~0.7–1.3%), in the committed orders: sankey Paid Search→Organic→Email; sunburst Product→Enterprise→North America→Direct; choropleth USA→Mexico→Canada. Console clean.
  - **The sweep covers all 24 routes with 0 FAILs.** The Wave 4 Chrome QA relaunch (hover, focus change, dark, narrow, entry, perf) is complete.
- Liveline y ticks: the earlier "parity unreachable" ruling is replaced. Migrated already copied bklit's rule (15% pad, snap-expand/8%-ease shrink lerp, d3 nice, pickNiceInterval keeping the old step at 0.5–3× minGap, 32ms commits), but the step it settles on depends on the start-up path, i.e. the refresh rate (60Hz: 20→10→4; 100–144Hz: 20→5). Three bugs fixed:
  - The display-period measurement was taken from 2 gaps at mount (slow frames, so it fell back to 60Hz). It is now a bounded 8-frame run from module load, shortest gap snapped to a common refresh rate.
  - The seed was `[0, max(100,tHi)]`. It is now bklit's initial `[0,100]` frame with an immediate first commit.
  - The domain ease used a hard-coded 60Hz frame; it now uses the measured period. The edge fade measured label `position` from the chart top (TanStack scene.ts) instead of the plot top, so the top label showed 0.57 where bklit shows 0.

  Chrome: migrated 145/150/155 on 6 of 6 loads. Same-instant labels within 1.3px and the same fade. Re-pick moments within 35–45ms.

  Ruling: on 2 of 6 loads bklit itself took the 4-step path because of start-up frame drops. Migrated replays an ideal clock on the measured refresh rate. Copying bklit's jank would need an own rAF sampler, which is not done.
- Heatmap 2-D arrows, through public API:
  - A capture-phase `onKeyDownCapture` on the owned host runs before the renderer's bubble `keydown` (renderer.ts:921).
  - The target cell is found by (column, row) in the `onRender` scene: ±1 week on the same weekday, ±1 day in the column, clamped, skipping missing cells. `interaction.setControlledFocus` moves focus; the host `onBlur` clears it (controlled focus isn't keyboard-owned).
  - Tab-in, Home/End and Enter stay native.
  - Chrome: Right×3 on the same weekday, Down/Up/Left, edges clamp, End/Home, hover→arrow continues (10-3→11-3, equal to bklit hover at 11-3), hover takes over, blur clears.

  UPSTREAM-GAPS #34 is now a workaround in place, with the cleaner native API as the ask. Found: mouse-leave while a cell is keyboard-held clears the highlight but leaves the tooltip until blur (it predates this change; under investigation).
- Pointer-leave during keyboard hold. Rule (renderer.ts): mouseleave clears only pointer-owned focus; keyboard and controlled focus clear on focusout. Every visual now follows the renderer's focus:
  - heatmap: removed the host `onPointerLeave={clear}` (highlight is mirrored from `onFocusChange`). `HeatmapInteractionBoundary` leave now clears only the legend level.
  - sunburst: the host leave `forget` skips `setState(null)` when focus is keyboard-owned.

  Chrome: heatmap End/grid-arrows then mouse-out keep highlight and tooltip together; blur clears; pointer re-entry takes over; pure hover-leave clears like bklit. Sunburst and area also verified. The code sweep found no other host leave handler clearing focus visuals (kit hover-host follows focus). A browser pass of the remaining routes is pending; the tab group dropped mid-run.

  Found:
  - liveline's x-tick fade (`--bkm-fx`) follows only the pointer, not keyboard focus;
  - heatmap legend hover while a cell is keyboard-held clears the cell highlight but not the renderer tooltip.
- Radar glow colour: dropped the read-back of the renderer's rendered area `fill` (a DOM read of a renderer-owned node). `--bkm-radar-glow` now uses `radarAreaColor()`, the same resolver the definition uses for the fill (area.color → data colour → DEFAULT_RADAR_COLORS → --chart-1), so glow and fill cannot drift. A research agent's draft used the unresolved `area.color` and would have left default-palette areas without a glow colour; fixed before commit. tsc clean; Chrome check pending (window hidden).
- FIXER-RULES rule 4 (fork fixer C, comment-only): gauge `useIntroValue` double rAF cites bklit pie-center-shell.tsx:59-61. composed and cartesian ready timers cite use-chart-phase-orchestrator.ts:166-169 (via time-series-chart-shell). Verified against source.
  Two unmeasured offsets remain:
  - bklit arms the timer in the revealing-phase effect; ours arms at mount;
  - with `animationDuration<=0`, bklit flips synchronously; ours uses `setTimeout(0)`.
  Open nit: showcase pins d3-geo 3.1.0 while charts-core pins 3.1.1, so two copies can be installed. They are pure functions, so behaviour is unaffected; align at the next dependency touch.
- Heatmap (kfx fixer):
  - Active cell: no longer writes `data-hm-active` onto the renderer's rect (FIXER-RULES rule 2). The hover leaf renders one scoped `<style>` rule for the hovered cell (`[data-hm-id]`-scoped; only the leaf re-renders, no definition rebuild). The `rect[data-hm-active]` rule is removed. Keying on the `data-ts-key` cell segment is the existing gap #15 dependency (`rect.ts:267`; the `:c-r:` delimiters rule out `:1-2:`/`:11-2:` collisions).
  - Legend hover: follows bklit heatmap-legend.tsx `handleLegendEnter`, which clears the hovered cell and tooltip. A published legend level now releases the renderer focus through public `setControlledFocus(null)`, so highlight and tooltip clear together. Ruling: deliberate exception to "keyboard focus clears only on blur", justified by bklit's own clear (the cell outranks the level, so keeping it would hide the legend dim).
  - Browser verification pending (window hidden).
- Liveline x-tick fade follows the renderer focus (kfx fixer):
  - `onFocusChange` drives `--bkm-fx` for pointer focus.
  - For keyboard row focus, `--bkm-kx` is the row's x in this tick's layout plus a non-inherited `@property --bkm-fxr` roll offset (shift→0, linear over the roll, parity-restarted like the tail). The fade rides the held row without a rAF loop.
  - The pointerleave handler is removed (the renderer drops pointer focus); pointermove only refines a pointer-owned focus.
  - Not native via a ChartControl: `ChartControlContext` (types.ts:579) carries no focus.
  - Browser verification pending: guide x vs `--bkm-fx` mid-roll; intro-roll easing mismatch expected.
- Composed and cartesian ready timers (fork fixer): now armed at `<RevealArm>`'s arm, the commit that starts the reveal, matching bklit's revealing-phase effect (use-chart-phase-orchestrator.ts:155-170), not at mount. Behaviour:
  - flips synchronously when `animationDuration<=0` (:158-162);
  - re-arms on a duration change;
  - unmount clears the timer and the attribute;
  - composed re-arms on a revealSignature change via `enter` identity.
  Browser check pending: `data-bkm-ready` vs bklit hover-live, measured from the start of the wipe.
- Sunburst (FIXER-RULES rules 3, 4):
  - `SEED_MS = 1` removed (no bklit source). The React Chart mounts the seed scene in its layout effect (RendererChart.tsx:177-185), so the grown definition lands as an update from the seed, from bklit's mount-effect clock (use-mount-progress.ts:19-21).
  - The private `scene-motion-node` read has no public path. Rule 1's order was exhausted: motion() and mark motion are timing only; `path:'morph'` interpolates along chords; states have no geometry; a leaving sector with no painted ancestor only fades. It is confined to `reshape` and logged as new gap #35 (proposal: public `enter.from` / `exit.to` geometry on partition marks).
  - Browser pending: entrance, drill in/out, hover dim, pop, keyboard.
- Timers and support (tmx fixer):
  - hover-host double-rAF `data-bkm-settle` replaced with bklit's own rule (use-highlight-segment.ts:48-58, `wasActive`): enter jumps, later changes spring, keyed on state not time; no rAF left.
  - Rule 7: sankey.css and the markers block in styles.css carry stagger-free base values with `sibling-index()` under `@supports`; overlays.ts and sankey-chart.tsx note "Chromium-only stagger".
  - Still unguarded typed `attr()`: bar-chart.tsx, native/bar/hover.ts, candlestick/definition.ts, kit/date-pill.ts, composed-chart.tsx, cartesian-chart.tsx, liveline live-css.ts and live-line-chart.tsx. Queued.
  - Scatter (`+60` and the dot-transition removal, ready timer from `revealed`) is held until the fork's scale fixer finishes `scatter/definition.ts` and `kit/definition.ts`.
- RULING (mount-chain delays): keep `parent-size-arm.tsx`. One rule replaces LOG ~675's "artificial delay" refusal: reproducing bklit's measurement chain with the same events (ResizeObserver delivery, rAF hops, visx `useParentSize.js:37-63`, leading debounce) is allowed only through `parent-size-arm.tsx` and must cite the visx/bklit file:line. Millisecond-tuned offsets stay banned. Open: kit cartesian (line/area/bar/composed), choropleth and barsquares still start one ParentSize hop early; adopt the arm there (queued).
- Scatter (tmx fixer):
  - `animationDuration + 60` and `data-bkm-live` removed (no bklit source). They only suppressed a dot-level 150ms transition with no bklit counterpart: bklit's settled dots are StaticSeriesPointMarker (series-point-marker.tsx:95); the fade lives on the dim group (series-markers.tsx:240-251), as ours does.
  - Ready and phase timers start on `revealed`, cited to scatter-chart-shell.tsx:146-160.
  - Typed-attr() enter blur is under `@supports`.
  - Comment fix: bklit scatter measures with react-use-measure, not visx ParentSize.
- Compact scales (fork): radar `scalePoint` and liveline's nice-domain calculator now come from `@tanstack/charts/scales/*`. Proven identical over 84,058 cases (domain, nice, ticks, point, copy). Radar radius, gauge and liveline y mapping stay on d3: compact linear map/invert differs from d3 at the last ULP.
  - The fork's kit/scatter/candlestick scale hunks were reverted: they fed compact scales into `scales.y` (last-ULP mapping difference) without a complete proof. A tick-only dedupe is allowed only with a split proof (mapping vs ticks/nice).
- Bar depth (bdx fixer): `trimBarTopsForDepth` removed (wrapper around barY initialize/render/resolveLayout plus `data-ts-key` regex: FIXER-RULES 2, 3). Depth mode now uses `depthBarMark`, a documented `createMark` custom mark (custom-marks-and-renderers.md "Create a mark" / "Interaction points").
  - It draws the trimmed front face (bklit bar.tsx:358-381) with keys `bars:<i>:<series>` under our own control, and points mirror barY's.
  - Bars now share the depth faces' entrance clock (they previously entered about a frame later).
  - Known change: a data-removal exit uses the renderer's default rect motion; barY's baseline shrink used private sceneMotionNode metadata.
  - Ready timer cited to bklit bar-chart.tsx:381-384, 549.
  - Browser pending: entry, lid alignment, hover dim, keyboard, tooltip, console.
- Mount chain (per the ruling above), psa fixer:
  - Kit cartesian (line, area, loading), composed and choropleth now mount or start their entrance on bklit's ParentSize commit via `useParentSizeMounted`. Cites: bklit line-chart.tsx:265, area-chart.tsx:234, composed-chart.tsx:308, choropleth-chart.tsx:482; visx useParentSize.js:37-63.
  - Choropleth's tuned `ENTER_FADE_DELAY_MS = 165` (D727) is removed. The fade flip and the isLoaded timer wait for the ParentSize commit (choropleth-feature.tsx:162-166, use-mount-progress.ts:19-26).
  - Open: bar and barsquares (bklit bar-chart.tsx:701 ParentSize) need the same gate in bar-chart.tsx; queued after the @supports fixer releases that file.
  - Browser pending: wipe-start lead vs bklit; choropleth opacity curve (if it now lags, report the size; don't add a delay back); no empty-host flash.
- @supports guards (FIXER-RULES 7), sup fixer:
  - Typed attr() rules are now guarded in bar-chart, bar/hover, candlestick, kit/date-pill, composed, kit/cartesian-chart, liveline live-css and live-line-chart. No unguarded `type(<` remains.
  - Most sites used `var()`, which makes them computed-time invalid in non-Chromium browsers (property reset, `!important` still winning), not a harmless parse-time drop.
  - Real regressions fixed: liveline clip width became `auto`, which is zero for a rect (line invisible; inferred from the SVG2 spec, not observed); the cartesian brush selection collapsed and its handles pinned left; legend dimming in composed broke while a bar was focused. The rest lost emphasis only.
  - Chromium rule text is unchanged.
- Bar and barsquares mount on bklit's ParentSize commit (bar-chart.tsx:701) via `useParentSizeMounted`. The seed flip and the ready timer key on it; bklit's isLoaded timer lives in ChartInner, inside ParentSize.
  - Browser pending: host height before the commit (possible layout shift; bklit reserves aspectRatio). Same check applies to the cartesian and composed gates.
- Delay rulings (no-tuned-delays rule): funnel `entering` gate drops the unsourced +400ms and now clears exactly when bklit's last entrance tween ends, `(n-1)*staggerDelay + max(duration, 0.25+0.35)` (bklit funnel-chart.tsx:241,452,653-654,722-723), so hover pop is no longer blocked 400ms+one stagger past the entrance. Liveline `INTRO_DELAY_MS = 80` (no bklit source) is replaced by a paint signal: the intro roll starts two animation frames after the seed frame commits (`afterFrames`, kit/parent-size-arm.tsx).
- Ruling, D675 vs the frame arms: no conflict remains. D675 rejected *tuned* delays that model a measured lag. The later frame arms (f60ed54, 823c875) are not tuned: each reproduces a cited bklit/visx chain step (visx `ParentSize` rAF-debounced first size, kit/parent-size-arm.tsx; bklit pie-center-shell.tsx:59-61 double rAF, gauge/label.tsx) or is a paint signal (`HoldArm`: a CSS animation inserted mid-frame would start on an already-advanced timeline). D675's "no change" for the cartesian entry clock is superseded by f60ed54, which sourced the chain. Rule: a frame count must cite a bklit/visx rAF or be a paint dependency; a millisecond delay must cite a bklit timer.
- Ruling, liveline display-frame measurement (native-research 05, C row 2): kept. It is a measurement of the clock bklit's y lerp runs on (one `lerpSpeed` step per rAF tick, bklit live-line-chart.tsx:383-431), not a delay; the snap table only removes rAF timestamp jitter. Cite added to the comment.
- Hover trace (Continuexx Chrome probes, qa2/trace-*.js):
  1. The moveLat gap was an ordering artifact. bklit's React commit lands +11-24ms (scatter, markers) and +18-73ms (heatmap) after the paint the old metric stopped at; migrated updates in that same frame. Measured to the frame that shows the update, migrated is equal or faster. Collector fix 379b086.
  2. Per-move cost, measured, no action. Forced reads are small: bklit-tooltip-portal :65 is 1.8ms on first show only, :79 is 0.2-0.4ms per show, motion translate reads stay under 0.05ms, and TanStack's hide-path presence opacity read is 0.8-0.9ms per hide. The remaining 1.7-6ms style recalc per move follows TanStack-owned attribute toggles (motion role, state, progress) and transforms (gap territory). Deleting `:has(.bkm-evt:hover)` did not help, so it stays.
  3. Cold first hover, measured, no action. It is 5-10ms of first-show script plus 3-8ms of style. `will-change:auto`, removing `:has()` and presetting the host vars each change nothing. bklit heatmap's cold first paint is 50-70ms, which is worse than ours.
- Ruling, keyboard focus across a pointer pass (bargeo observer: bar, bardepth, barsquares, choropleth, projection): a keyboard-held focus survives the pointer crossing the chart and the next arrow continues from it; gap #34 does not cover it. TanStack 1.0 hands the focus to the pointer and empties it on leave (renderer.ts:700-733), and the next arrow then starts at index 0. The fix is `native/kit/keyboard-hold.ts`, wired into the cartesian kit, bar and choropleth. It restores the held point through `setControlledFocus` after leave and keeps empty-plot moves from the renderer. It is a shim for UPSTREAM-GAPS #42. The `setTimeout(0)` in it is an event-ordering hop with no duration, accepted under rule 4.
- Choropleth fade clock (fix2 fixer, gap #33):
  - Root cause: the fade track started at TanStack's frame timestamp (charts-core motion.ts:3988-3990), which Chrome back-dates behind the mount's long task. Headless, alone: our fade anchored at about 35 ms after Re-run vs bklit's at about 150-180 ms (useMountProgress `animate()` in a passive effect, use-mount-progress.ts:19-26). The old flip-stamped `resumeEnter` was not on the renderer's clock, and the window-scaled 800 ms tween reached its end value (snap) at rafStart + 800.
  - Fix: one 1100 ms bklit-curve tween whose easing samples `performance.now()` since the passive effect after the `shown` commit (motion's clock). The `loaded` update (bklit's isLoaded timer, choropleth-chart.tsx:390-397, unchanged) cuts it with `false` motion, as bklit's static-layer swap does (choropleth-feature.tsx:381-385). `fadingRef` and its parallel timer are removed.
  - Measured after: alone, ours anchors at 112-128 ms vs bklit 161 ms. The remaining ~35-45 ms is bklit's extra epoch re-render (re-keyed enter `motion.g` remounting 177 paths, a long task) before its effect runs: work, not clock, so not tuned. The cut lands at 888-906 ms vs bklit's swap at about 895 ms; no mutations after it (no ticking past ready).
  - Paired page caveat: both charts share the main thread, and our chain runs after bklit's (ours anchors at about 235-255 ms vs bklit at about 80 ms). Absolute anchors on the paired page measure scheduling order, not the clock; compare alone (`?only=`, a local probe filter, not committed).

### D729
- Rulings and Chrome QA after the reboot (tab 472097565, every timing sample passed the visibility gate):
  - **Choropleth easing-clock shim (D728): accepted as the gap-#33 workaround.** 1.0 has no public way to anchor a track's start clock, so this is the smallest native-compatible path: an easing function on the renderer's own tween, with no timer and no DOM write. It stays scoped to choropleth. The other `resumeEnter` users are judged on Chrome evidence only, because none of them currently measures a lead.
  - **Host heights (58cd77f): PASS** on bar, bardepth, barsquares, projection, line and area. Full height from the first frame, no layout shift inside a card.
  - **Projection entrance:** fixed by 21a712c, a terminal marker sourced from bklit. Line, bardepth and barsquares are no clock gap (probe in D728's fixer report). No change.
  - **Liveline (6411516..aa6ef61):**
    - PASS: mount timing (same paint frame; first move 0-24ms earlier), keyboard hold restore and clamp, leave into the margin hiding on the first frame, and the y-label gap (60ms on Re-run, ≤91ms on fresh load; one cold-nav case at 161ms).
    - FAIL: a seam between the main path and tail piece line-a during the intro only (22.9px decaying to 0 by about 700ms), and a doubled jump slide on about half of the keyboard jump ticks (20px). Minor: no tooltip fade-in on re-entry (bklit takes about 100ms). Sent to a fixer.
  - **Keyboard hold:** check 1 (restore, then next), check 2, check 4 (Tab), check 5 (click drops the hold) and check 6 PASS on all 17 hold routes. Check 3 FAIL everywhere: one frame of cleared hover state on leave, because of the setTimeout(0) restore. Sankey undims every node for that frame. Sent to a fixer.
  - **Separate bug:** after a click, the next leave keeps the tooltip at opacity 1 for about 265ms (bardepth, composed, bar, projection).
  - **Funnel:** cursor and immediate dim PASS. Pop timing FAIL: bklit springs the pop during the entrance, snaps back at enterComplete, then re-springs. Ours holds it until the gate and then jumps. Sent to a fixer.
  - **Sankey:** entrance within about 1 frame (one link offset reaches 2 frames). Cursor PASS. The earlier "+51ms" ordering does not reproduce.
  - **Sunburst un-dim snap (S):** root cause found. TanStack's keyed reconciler `insertBefore` re-orders matched nodes when the zoom scene arrives (motion.ts:2154), and re-inserting a node kills its CSS transition. It is not the motion-role pin. Sent to a fixer (keep child order stable, or animate opacity through motion).
  - **Showcase-wide:** both cards are 0px until hydration, then there is one page layout shift of 0.39-0.49 (sankey, funnel). This is a showcase problem, not a migration one; sent to a fixer.
- Keyboard first arrow (fix2 fixer, Chrome QA item 3), no change: bklit's charts have no keyboard handling at all (no `onKeyDown`/`keydown`/`ArrowRight` anywhere under `packages/ui/src/charts/`), so there is no parity target. TanStack's native semantics: focusing the svg already focuses the first navigation point (charts-core renderer.ts:899-914 `handleFocus`: `focus.navigation(points)[0]`, else `chartPointFromSceneOrder(..., 'Home')`), and each arrow steps from it, so the first ArrowRight lands on index 1 and three presses reach the 4th item. Probed with a real Tab on bar, line, area, bardepth, barsquares, composed, projection, candlestick, scatter, pie, ring, radar, sankey, funnel, heatmap, sunburst, choropleth and liveline: every route shows item 0 on Tab and item 1 on the first ArrowRight. Consistent, native; kept.
- Keyboard hold leave (fix2 fixer, Chrome QA item 1): the `setTimeout(0)` restore accepted in the ruling above let core commit and paint the empty focus (and fire `onFocusChange(null)`) for one frame on leave. Replaced by a capture listener on the host that restores on the `.ts-chart-surface` pointerleave, before the renderer's own `mouseleave` clear (renderer.ts:718-728, :919); the controller then owns the focus and the clear skips it. No timer left in the hold.
- Tooltip after click (fix2 fixer, Chrome QA item 2): the svg takes DOM focus on pointerdown, and the leave hide rule (styles.css) excluded `:focus-within`, so after any click the tooltip stayed opaque until the native presence ended (~270 ms). The rule now excludes only `:has(:focus-visible)` (fallback kept for no-`:has()` browsers).

### D730
- Merged after the fixer round, each checked by a Chrome observer on main (tab 472097565, visibility gate passed throughout):
  - **Keyboard hold leave (ca59824) and click-then-leave tooltip (d3f33a7): PASS** on 16 routes. The hover-to-held handoff happens on the leave frame with no empty focus. Sankey dims are kept, the ring centre never shows "Total Sessions", and the choropleth tooltip stays visible. The next arrow continues from the held point, and blur clears. After a click, the tooltip opacity is 0 on the first frame after leave. Keyboard holds stay visible under `:has(:focus-visible)`. No console errors.
  - **Composed host (d46d289): PASS.** The host holds 543px with aspect-ratio 2/1 on every frame of 3 Re-runs. On load, bklit and ours size on the same frame, with CLS 0. Hover content, the pill, fade-in (about 200ms vs bklit's 210ms) and hide on leave all match.
  - **Liveline tooltip re-entry fade (276042a): PASS.** The fade runs 0 to 1 over about 100ms ease-out, the same curve as bklit's TooltipBox.
  - **Liveline jump slide (4632b11): FAIL**, now inverted. On 8 of 76 ticks the path snaps about 21px while the keyboard guide slides about 20px over about 600ms. Sent back to the liveline fixer, together with a marker 6.2px off the line on one y-rescale tick and the hover crosshair arriving instantly, where bklit uses a spring of about 300ms.
  - **Funnel pop during the entrance (e0de4d0), sunburst zoom un-dim (2e2b273), showcase card reserve (1c3d482):** merged. Chrome QA is pending.
- **Ruling: liveline intro y-step held until the roll settles (fixer commit d07b272): rejected.** It closes the path/tail seam, but it leaves no readable y label for about 380ms on load, about twice bklit's gap. The fixer is reworking it so the step can change mid-roll without cancelling the rolling path's tween.
- **Ruling: cartesian hover stays gated until ready.** Every bklit cartesian chart attaches its interaction handlers only when `isLoaded` (line, area and composed at time-series-chart-shell.tsx:406 with use-chart-interaction.ts:327-337; bar at bar-chart.tsx:549,638-640; scatter at scatter-chart-shell.tsx:160; candlestick at candlestick-chart.tsx:225). The early tooltip seen on line, area and composed comes from a 16-52ms live window before the phase orchestrator's mount effect sets `isLoaded=false` (use-chart-phase-orchestrator.ts:39, :90-103). A tooltip caught in that window freezes and ignores leave until ready. That is a mount-order artifact, not design intent, so it is not reproduced. Ours un-gates within about 20ms of bklit's isLoaded.
- **Scatter clock and composed date pill: no change.** Measured one chart per page, the scatter dot ramps and the final snap are within one frame of bklit, so the paired-page lead is page work ordering. The pill uses bklit's DateTicker spring (400/35), and the rows left to roll match bklit frame for frame.
- **Showcase card reserve (1c3d482):** the per-route reserve values in chart-stage.tsx are derived by hand from each demo's layout. A demo layout change must update its entry.
- **Tooling note:** a dev server started in a worktree resolves `@showcase/migrated-charts` through the symlinked node_modules to main. Fixer probes now alias it to the worktree's `./migrated/charts/index.ts`, and the alias is never committed. Merged work is verified on main by the Chrome observers.

### D731
- **Sunburst still-pointer, browser-native route: rejected, 6fe4c8b stays.** Chrome fires `pointerover` on the sector paths for a still pointer, but the hub, which sat full size until its fade exit, and the static pop overlay covered the morphing sectors. Re-entry times were off by up to 230ms. The public `resolvePointer` picks the nearest point, not the path under the pointer, so naming the sector would need a forbidden renderer-class read.
- **Sunburst hub and pop overlay (cf04fac): merged.** The hub is a single stable-keyed radialArc whose radius tweens on bklit's zoomT, 0.75s [0.22,1,0.36,1] (sunburst-center.tsx:17-24,39; sunburst-chart.tsx:244-247). Zoom-in matches within 0.2px per frame. Zoom-out has two residuals: it starts one frame late (gap #33) and keeps a tail of ≤2px, because bklit's `max(r-2,0)` clamp can't be reproduced by a linear tween. The pop overlay is now the sector under its own key, so it morphs with the sector. zoomTo drops the hover at once (`data-bk-snap`), as bklit's zoomTo does (:231-234). The label lag during the zoom is sent back to the fixer.
- **Chrome QA, dark mode and 390px, 24 routes: 15 PASS.** No console errors. Open items:
  - patternarea: the crosshair below the point is drawn under the hatch pattern. Bug, sent to a fixer.
  - bardepth: narrow-width entrance is a few px taller at 400–700ms.
  - funnel: narrow-width entrance about one frame behind.
  - Not migration bugs: candlestick (bklit doesn't re-lay out on a width change), and markers/barsquares (both degenerate at 390px, already accepted).
  - Correction: sankey at 390px is not pixel-identical. It differs by 0.8–1.9% from sub-pixel label stacking, with the same layout.
- **Chrome QA, tooltip enter (758a8e4): PASS on 16 routes.**
  - Enter curve, glide, leave and keyboard all match. Ours starts 1–2 frames earlier, which is bklit's React commit latency, so no change.
- **Ruling: the bklit markers stale-dedupe is not reproduced.** `chart-markers.tsx:102-110` hides the tooltip through the raw `setTooltipData(null)`, which skips `clearTooltip`/`resetTooltipDedupe`. `use-scheduled-tooltip.ts:44-59` keeps `lastKeyRef`. Returning from a marker to the same datum is then deduped, and the tooltip stays hidden until a different datum. This is an accidental, pointer-path-dependent defect, not design. bklit's intent is "hidden while on a marker", which ours does (styles.css `:has(.bkm-evt:hover)`). This is also the cause of the "line same-datum" difference: the line demo's markers overlap the plot's top edge.
- **Heatmap show/hide: no change.** Ours uses bklit's timers (`showDelay 0`, `hideDelay 120`, heatmap-tooltip.tsx:46-47). The ~41ms gap is equal on show and on hide, and it is bklit's commit plus passive-effect latency (use-delayed-tooltip-data.ts:51-60).
- **Liveline perf investigation (read-only):** the panel's slowEvents counts Event Timing boundary events, all of which last ≥16ms because they run to the next paint, so it is not a slowness measure.
  - Real costs: inherited CSS vars written on the host on every move or rAF (1.2ms per forced recalc vs 0.06ms when scoped), a forced `getBoundingClientRect` after those writes, core's per-frame focus repaint (gap #43), and a hit-testable decorative layer.
  - Fixes are assigned: liveline to its fixer, the shared kit and other charts to fix2, the panel metrics to fix4.

### D732
- **Sunburst labels ride the zoom morph (6452478): merged.** Every sector keeps a label, placed on its arc's centroid path frame by frame and shown or dropped where the arc crosses bklit's fit rule, the same rule bklit applies. The labels need nested keyed elements with per-key curves. That complexity is accepted, because it is the only way to get bklit's centroid path through the public linear tween.
- **Chrome QA, sunburst (sb4): PASS** on disc, hover drop, ring artefacts, still pointer (within 7ms), intro, keyboard, dark mode and console.
  - FAIL: "Product / Starter" swept the long way across 12 o'clock.
  - Fixed in **ab0e88f**. `unwrapSector` shifts each live sector's angles by whole turns so its mid is within ±π of the arc it tweens from. This is bklit's `lerpAngle` (sunburst.ts:227-258) expressed through the native linear [start,end] track. Starter's centroid now tracks bklit within 2–5° per frame on zoom-in and on zoom-out.
  - The disc's zoom-out tail of ≤2.7px stays, because bklit's `max(r-2,0)` needs a negative target radius, which the native sector rejects (polar-sector-internal.ts:30).
  - A root-centre click zooms bklit but not ours: open, minor.
- **Showcase live-perf panel (31e2ec5): merged.** It groups Event Timing by interactionId per card and shows handler ms and React ms per 100 moves. "Boundary events ≥16ms / 100 moves" replaces slowEvents, because boundary events always run to the next paint, as D731 found. Each metric carries a scope mark: ● per card, ◐ hover window, ○ page-shared. The panel's own overhead is about 10ms/s on liveline and 0 elsewhere.
- **Crosshair layer (f95bd75): merged.** It now paints in the native over layer ahead of the pill and dot guides, which supersedes fd5cd9b's under-layer placement and fixes patternarea's crosshair being drawn under the hatch.
- **Liveline round 3: merged.**
  - be58cde: a left-edge keyboard guide holds on jump ticks.
  - 9a6c921: y ticks fade on LiveYAxis spring thresholds.
  - 6bbb09d: the frame anchors on bklit's clock (`tipAt = now + rollMs`, with roll edge `ROLL_SLACK_STEPS = 2` inside the plot right). This removes the intro hook and the seam bump, and the tail segments match bklit within about 1px.
  - b61ad9d / bebefa6 / 9ca19c3 (perf):
    - focus vars are `@property inherits:false` with explicit inherit paths;
    - the host rect is cached and invalidated by ResizeObserver, scroll and resize;
    - decorative nodes are `pointer-events:none`, as bklit's overlay is (live-y-axis.tsx:189).
  - Hover style recalc fell from 214 to about 105ms/s (bklit 28) and pointermove from 3.3 to about 2.0ms (bklit 0.16). The remainder is core placeTooltip (about 40ms/s) plus gap #43.
- **Cross-chart hover perf: merged.**
  - 7142d38: the heatmap has no hover attrs when the effect is off.
  - a81a10b: kit host vars are non-inheriting, `--bkm-fx` is renamed to `--bkm-hx`, and liveline keeps its own.
  - 915c00d: sankey dim uses per-index CSSOM rules.
  - 59d9cf9: ChartMarkers `:has()` rules are gated by `data-bkm-evt`.
  - d3d37e9: the sankey tooltip is `sticky:false`. That fixes a real bug: a click pinned it, and click-then-leave left it visible, which bklit doesn't do.
  - Restyled elements per second fell on every cartesian route. Heatmap recalc went from 97.8 to 14.3ms/s.
  - Bar click is at parity in headless (p50 16ms each). The 8ms gap in Chrome is one Event Timing frame boundary.
  - The remaining cost is native TanStack crosshair motion and focus paint, and NumberFlow on ring. No change.
- **Ruling: the bardepth (9–14ms) and funnel (4–8ms) narrow-width leads stay.** They are a constant offset from gap #33 (motion starts at the frame timestamp). Candlestick at narrow width is a bklit quirk.
- **Tooling: tab booking server.** All observers share one visible tab (472097565). The file lock is replaced by tabsrv (SP/qa2/tabsrv.py, port 5297): a FIFO queue with a 300s holder lease and a 120s waiter TTL. Agents run `tab.py book` plus `tab.py watch` under Monitor to wait without blocking, and release before analysis or coding. BRIEF.md is updated.

### D733

Chrome re-checks after D732, plus the markers glyph layer, liveline handler cost, and sunburst keyboard rulings.

- **Sunburst root-centre click: ruled not a defect.** At the root, every depth-1 hit path starts at `M 0 0` (sunburst.ts:457), so paint order makes Product win a click at the exact centre (sunburst-chart.tsx:68-82). The hub only zooms out (sunburst-center.tsx:38), and it has `centerR` 0 at the root (sunburst.ts:180-183). That is an accidental artefact of bklit's geometry, the same as the pie precedent, and bklit has no keyboard path, so there is no parity target.
- **Sunburst Chrome re-check (sb5/sb6): PASS** for zoom direction, all four sectors' sweeps (each within 15° of bklit, same sign), labels, interrupted zoom (ours is smoother; bklit jumps a frame plus three labels by 46–79px), intro, hover, still pointer, dark mode and console.
  - Perf on the same load: settled 3344 vs 3338ms, 0 long tasks, 96.6fps on both. Interaction p95 is 48 vs 32 on a small sample; bklit measured 48 in an earlier run. Not a regression.
  - **FAIL: keyboard after an Enter zoom.** End lands on a node outside the zoomed view. Focus is invisible after Enter (it sits on the undrawn root, then the hub).
  - Rulings, since bklit has no keyboard path: (a) the navigable set in a zoomed view is exactly the drawn sectors plus the hub; (b) Enter that zooms in focuses the first drawn child, and Enter on the hub focuses the node you zoomed out of; (c) a focused hub shows the chart's focus treatment. A fixer is on it.
- **Markers glyph layer: 626dc79.** The hovered point's 1.35x marker (bklit showActiveHighlight, series-markers.tsx:196, :270-292) is drawn in bklit's main svg, under the portalled crosshair. Our active-core and active-ring guides are now declared before the crosshair rule (native mark order), so the over layer runs core, ring, crosshair, pill, tooltip dots.
  - Chrome: crosshair columns over the ring rows match bklit within one level in light and dark; under keyboard focus the rule shows through the ring.
  - Two observer asides were not chart bugs. The cluster-centre rocket shows on bklit too for the first ~1.1s of a hover (the transition delay at marker-group.tsx:226-235). The segment header blur comes from the showcase's fixed site header backdrop-filter, and both cards blur the same way.
- **Cross-chart hover regression check (pv2) on a81a10b and 626dc79: 15/15 routes PASS** for hover, leave and keyboard, with 0 console errors. None of the six risk readers from reading the code is starved in Chrome: composed and candlestick dim, the bar `--bkm-bfx` tick, the hl0/hl1 band and segment edges, the pill roll-in, and the var host as the direct parent of `.ts-chart-host`.
  - Open: segment drag-hold (with a synthetic drag our chrome hid while bklit's held at the press x). A fixer is verifying it with trusted CDP input.
  - Open: the panel's bklit collector sticks at `moves=1`, so its bklit per-100 ratios are unreliable. Choropleth's move handler costs 1070ms per 100 moves. A fixer has both.
- **Liveline handler cost: a774579, f8c2dc2, ca76a4d.** A CDP profile put about 90% of pointermove in core `handlePointerMove`: placeTooltip's `offsetWidth` forced layout (tooltip-position.ts:25-26) plus the crosshair fragment re-parse and reconcile. Every invalidation before the forced read came from core.
  - a774579: liveline places its tooltip through the documented `tooltip.portal` extension. It uses the public `resolveChartTooltipPlacement` with a ResizeObserver-kept size (kit/sized-tooltip-placement.ts, gap #21).
  - f8c2dc2: the tooltip body takes a new target only when bklit's `liveTooltipKey` (the tooltip point rounded to whole pixels, live-line-chart.tsx:219-227, 271-284) changes.
  - ca76a4d: a blur with the pointer resting on the plot hands focus to the pointer through the public controller (opt-in `pointerOnBlur`, gap #42).
  - Chrome re-check: all three PASS.
    - Placement is identical to bklit at x 600, 1000, 1250 and 1340, flips included.
    - Text changes under a still pointer, over 6s: 15 vs bklit 26; it was 420 before.
    - Blur keeps the guide at the pointer for 4s, the next move follows, and leave clears.
    - Per 100 moves: handler 141.7 vs bklit 8.0 (it was 169.3), commits 102 vs 110 (it was 212), React render 30.5 vs 413.
  - The remaining handler cost is core's per-move crosshair repaint (`paintMotionSvgFocusGuides` toggles `data-ts-motion-role` even with `motion:false`, gaps #21/#32/#43), plus the default tooltip content built for a custom body. It is an upstream gap, not worked around. Hover fps and move latency are at parity (100 fps; p95 18.3 vs 17.8ms).
  - Liveline focus plus hover drift: no change. The keyboard owns the guide only from a key press until the next pointer move, and Chrome no longer reproduces the drift after a move.
  - In progress: the sized placement and `pointerOnBlur` kit-wide.

### D734 — Kit-wide sized tooltip and pointer-on-blur, segment press, sunburst zoomed keyboard and blur, pv3 sweep

- **Sunburst zoomed keyboard (a89ad78, 003199f): sb7 PASS in Chrome, light and dark.**
  - `orderOf` admits only the view root's descendants, plus the hub when zoomed.
  - A key-initiated zoom lands focus on the first child (zoom in) or the node left behind (zoom out).
  - The hub's keyboard state uses the chart's own focus-ring token (`--bkm-focus-ring`, 2px, styles.css:260-266). bklit's centre has no focus style (sunburst-center.tsx:36-49), so the ring follows the chart's keyboard ring rather than inventing one.
  - sb7 found that the highlight stuck after a blur that followed a keyboard zoom.
- **Sunburst blur (327aa7e).**
  - Cause: `setControlledFocus` sets `focusOwner='controlled'` (renderer.ts:622), and the renderer's blur clear only drops `focusOwner==='keyboard'` (renderer.ts:738).
  - Fix: keyboard-hold now exposes `setKeyboardFocus(point)`, and the zoom routes its focus through the hold. Blur then clears the highlight, or hands it to a resting pointer.
  - The observer's useEffect deps-size warning came from Fast Refresh after db4af4d and does not appear on a fresh load. Chrome re-check (sb8) is running.
- **Panel collector (54b3e88).** A move marks the collector dirty, and a pointer resting for 400ms flushes. Before this, a pointer that stayed inside a card stalled bklit at `moves=1`. pv3 move counts now match on 13 of 15 routes; segment overcounts and choropleth publishes oddly after a reload, and a fixer has both.
- **Kit-wide sized placement (99b0180).** Choropleth and horizontal bar place their tooltip through `sizedTooltipPlacement()`, so no chart reads `offsetWidth` on each pointermove. Choropleth's move handler fell from 1070 to 104 ms per 100 moves in Chrome (pv3). Its placement matches bklit within 2px, including right-edge flips.
- **pointerOnBlur by default (db4af4d).** Every keyboard-hold chart hands focus to a pointer resting over it on blur, and the option is gone. Recorded as UPSTREAM-GAPS #44 (3756354): core builds the default tooltip content per paint even under a custom body, and uses it as the aria-label. #21 now records the portal workaround.
- **Segment drag (694352f).**
  - A press sets `data-bkm-press` and clears the controlled focus. The first drag move re-anchors focus at the press x, and a leave during a press clears native focus. This is bklit's clearTooltip (use-chart-interaction.ts:198-225) and its re-anchor effect (use-chart-interaction.ts:315-325, line-chart.tsx:183).
  - pv3 real drag: the guide hides on press and returns at x 587.8 on the first drag frame, 1–2 frames ahead of bklit. The tooltip fades in over ~190ms vs ~200ms. After release both hold "Wed, Sep 16 users 1,480", and dragging off the card clears everything on both.
- **Liveline final numbers.** Handler 141.7 vs bklit 8.0 per 100 moves, commits 102 vs 110, hover fps at parity. The remainder is core crosshair repaint (gaps #21/#43), accepted upstream.
- **pv3 sweep (694352f): 14/15 routes PASS** (sunburst covered by sb7/sb8), 0 console errors. Blur-hold (shift+Tab, chrome sampled at 50–1000ms) matches bklit's guide x and label on every hold chart.
  - Migrated handler cost per 100 moves is 37–118ms against bklit's 5–9: core focus repaint, same gap.
  - Migrated React renders per 100 moves are 4–38 against bklit's 102–1141. Commits are at or below bklit's.
  - New: sankey blur within ~400ms of the last move flashes the node dims (0.4→0.9→0.4 over ~450ms); a fixer has it.
  - Capture diffs on cropped cards and hatched fills are capture artefacts; the measured positions are the evidence.
- **Process: :5200 incident.** A fixer's `pkill -f next-server` killed the shared showcase server. It was restarted, and the rule is now that agents kill dev servers only by port (`lsof -ti tcp:<port> | xargs kill`) and use their own port from 5240 up.

### D735 — Sunburst blur PASS, sankey blur "flash" is the dim transition, panel ignores re-dispatched pointermoves

- **Sunburst (sb8, Chrome, light and dark, 327aa7e): 5/5 PASS.**
  - Keyboard zoom then blur clears pop, dim and crumb, including the zoom-out to root that stuck in round 3. Against bklit the diff is 0.000–0.022%.
  - Tab to a page button clears it the same way.
  - With the pointer resting on a sector, blur hands the highlight to that sector (0.071% / 0.000% against bklit hovering it), and leaving clears it.
  - Fresh-load console clean; the round-3 useEffect deps-size error is gone.
  - Row done.
- **Sankey blur dim "flash": not a bug, no code change.**
  - A worktree investigation found blur makes no focus change. The pointer move leaves focusOwner='pointer', so the renderer's keyboard blur clear skips it, and the kit hold's pointer-on-blur hand-off resolves the same flow point, which the controller dedupes.
  - Node opacity with shift+Tab matched a no-blur control (0.88/0.80/0.54/0.42/0.40 vs 0.89/0.83/0.57/0.42/0.40).
  - The "flash" is the hover dim's own 1100ms staggered transition (hover-css.ts, cubic-bezier(.85,0,.15,1)), still about 0.9 around 400ms in. bklit has the same behaviour (sankey-node.tsx animates node opacity with enterTransition plus stagger).
  - Chrome sk1 confirmed with a rAF opacity sampler and real input: fast blur 8ms after the move, no-blur control, settled blur, plain hover blur, and Tab-out with the pointer resting. Every case had zero rise after the blur and matched bklit's curve.
  - The only rise seen was 0.02 on one endpoint node after a JS svg.focus(); it happens equally without blur (focus-to-hover hand-off).
- **Live-perf panel move counts: 97b605e.**
  - Chrome re-dispatches trusted pointermoves at an unchanged position when layout, scroll or the element under a resting cursor changes.
  - The collector now counts a move only if clientX/Y changed or it carries movement. Handler-time and latency samples skip the same events.
  - Chrome pc1: 40 real moves gave 40/40 on segment, choropleth, markers and line. Load baseline 0/0. Rest of 3–5s and scrolling under a resting pointer add 0. Markers' cumulative 218/381 baseline is gone. Console clean.
  - Handler cost is unchanged at bklit 7–9 against migrated 117–167 ms per 100 moves (core focus repaint, upstream gap).
- **Harness: worktree dev servers serve main's chart code.**
  - A worktree's node_modules is a symlink, and its `@showcase/migrated-charts -> ../../migrated` resolves to the main checkout.
  - A fixer verifying a chart change in its worktree must alias `@showcase/migrated-charts$` to the worktree's `migrated/charts/index.ts` (temporary; never committed), or confirm the served code with a console marker.
  - Fixes under `showcase/` itself are unaffected. Chrome QA always runs on :5200 (main), so merged fixes are verified on the real code.
- **Observer note:** Chrome screenshots time out ("Script injection timed out") on the shared tab while JS, hover, key and click work. sk1 and pc1 used DOM and rAF measurements instead.

### D736 — Full Chrome pass, round 1: two tabs, window capture, choropleth drag crash and markers fade fixed

- **Capture:** the extension's screenshot is broken on every site ("Script injection timed out", even after a reboot). Observers capture the Brave window with macOS `screencapture -l <CGWindowID>`, cropped to their tab's viewport. Two tabs run side by side in split view in one window, so the browser group still owns both. Each is booked FIFO through tabsrv.
- **Observer rules learned this round:**
  - Parity uses only real `computer` input. bklit listens to mouse events and migrated to pointer events, so a dispatched event drives only one card. That is how the "segment press shows a crosshair" FAIL arose; reading the source showed migrated matches bklit for real (a) press, (b) drag and (c) release.
  - The theme is shared across tabs through next-themes' storage event, so each observer blocks that event per page.
  - A capture renews the lease.
- **82b7ca8 choropleth:** d3-zoom's mouseup called d3-drag `yesdrag(view)` on a null view and threw. Now the zoom filter rejects mouse events without a view, and unmount removes a held drag's window listeners. Verified in Chrome: the navigate-away and view-less mousedown cases no longer throw; real wheel zoom and drag-pan diff 0.006% vs bklit.
- **e91a876 markers (kit):** a dashed line split into head and tail marks used one objectBoundingBox fade gradient. That gradient stretched to each mark's own bbox, so the dark, light and dashed segments landed one segment off. Now each part gets the 0/15/85/100% viewport stops fitted to its own x extent, which matches bklit's single userSpaceOnUse gradient. qa-a confirmed in Chrome that the line, area and composed end fades still match.
- **Round-1 PASS (bklit vs migrated, Chrome):**
  - candlestick, liveline, reference-area, projection, brush, pattern area;
  - line, area, scatter, bar, barsquares, bardepth, composed;
  - pie, ring, radar, gauge (at rest), funnel, heatmap;
  - sunburst (entrance light and dark, hover, A→B, keyboard, pointer-resting blur);
  - sankey (light: rest, entrance, hover, keyboard, both blurs);
  - choropleth (light: rest, hover, keyboard, blur, zoom, pan);
  - overview.
- **Not migrated issues:**
  - motion.dev "from undefined" warnings come from bklit's motion/react; neither the migrated code nor TanStack uses motion.dev.
  - bklit's ring flickers on a ring edge.
  - bklit's liveline pill time is 1s off.
  - gauge dark ticks are faint on both cards.
- **Round 2 (running):** qa-a2, qa-b2, qa-c2 and qa-d3 cover entrances, the remaining light/dark pairs, pointer-resting blur on every route, and a re-check of markers and segment with real input.

### D737 — Round 2 results: choropleth wheel hover, barsquares legend-focus dim

- **137469e, 3bef767 choropleth wheel:** a d3-zoom wheel event now re-hit-tests the pointer on the next rAF against the new transform. If the hovered country is still under the pointer, hover and tooltip stay; otherwise hover clears. The new country is never focused until the pointer moves. A held keyboard focus is never touched.
  - qa-ch, Chrome, dark and light: A (scroll in place), D (keyboard focus, then wheel) and E (drag-pan) match bklit.
  - **Ruling, accepted divergence:** in B (scroll over another country) and C (scroll over ocean), bklit keeps a stale Canada highlight and tooltip, because a wheel delivers no mousemove. Migrated clears them, since Canada is no longer under the pointer. The next pointer move gives the same state on both cards. Showing a tooltip for a feature that is not under the pointer is a bklit artifact, not design, so it is not ported.
- **1e641bf barsquares (bar/bardepth share the rule):** Tab out of the chart lands on a legend row whose `onFocus` sets legend hover. `barDimCss` then dimmed every non-legend series even while the chart had a hovered category (pointer handover), so May's profit column stayed dimmed. Now `[data-legend]:not([data-hover])`: a focused category outranks a legend-row dim. bklit's legend only reacts to the mouse, so the overlap cannot occur there.
- **Round 2 PASS (Chrome, real input):**
  - qa-a2: entrances for line, area, scatter, bar, barsquares, bardepth, composed in light and dark; light hover, keyboard and blurs on scatter, bar, barsquares, bardepth, area; composed dark in full; handover on line (light) and composed (dark). Perf at load never clearly worse.
  - qa-b3: candlestick, liveline, reference-area, projection light and dark; pointer-resting handover on candlestick, liveline, reference-area, projection, markers, brush; markers entrance; segment perf at or better than bklit except the known handler gap; migrated brush.
  - qa-d3: sunburst light, sankey dark, choropleth dark click/wheel/pan, clean console.
- **Open:** bklit brush drag and segment band mid-hold need a multi-step real drag, which the `computer` tool cannot do (awaiting the user's choice). qa-a4 re-checks barsquares and runs the dark interaction pass on scatter, bar, barsquares, bardepth, area. qa-c3 runs pie/heatmap/funnel strict blur and ring dark entrance timing.

### D738 — Round 3: funnel spring settle, scatter press lift, heatmap tooltip lag ruling

- **0835da5 funnel:** ring pops ran one fixed 700 ms `linear()` spring and the label dim a fixed 600 ms, so the card settled ~120 ms after bklit. Each ring now takes its own spring's rest time (`springSettleMs`, motion's rest thresholds), and the label dim/restore both use bklit's 300/24 spring. qa-f1 (Chrome, real input): A→B 550/558 ms, leave 559/559 ms dark, same in light; hover, keyboard and console PASS. A rapid A→B→A reversal is smooth but its summed bbox swing is ~63 vs 30 px; a per-ring like-for-like trace is running to tell artefact from real.
- **84331e0 scatter:** a mouse press sets `data-bkm-press` (chrome hidden until the next focus), but only a pointer move cleared it, so arrows after a click left the tooltip and crosshair hidden. Any non-empty focus now lifts it. qa-s1 (Chrome): fixed in light and dark; hover, A→B, leave, press, Tab-out and handover unchanged vs bklit.
- **Ruling, heatmap tooltip timing (accepted divergence, fix 16d345e rejected):** bklit shows the tooltip ~70 ms after hover and removes it ~200 ms after leave; migrated 0–6 ms and ~125 ms. bklit declares `showDelay=0`, `hideDelay=120` (the demo uses `instant`); the extra ~60 ms is its React effect chain (data → effect → displayData → mount effect → layout position) in dev mode, not a design delay. Migrated honours the declared delays exactly. A fixer emulated the lag with a 60 ms constant; that copies an implementation artefact, so it is not merged.
- **Round 3 PASS (Chrome, real input):** barsquares legend-focus re-check (light, dark); dark interaction pass on scatter, bar, barsquares, bardepth, area incl. pointer handover; light pointer-resting blur on pie, heatmap, funnel, ring, radar; strict blur pie/heatmap/funnel dark; ring entrance dark = light (migrated 10–40 ms ahead); radar and ring dark; consoles clean.

### D739 — Round 4: velocity-preserving springs everywhere bklit uses a motion spring; marker actions

- **Principle:** bklit's hover motion is motion.dev springs, which keep velocity when retargeted. A CSS transition restarts at zero velocity, so quick reversals diverged (funnel ring up to 0.03 scale, pie/ring/radar ~3 px, highlight band trailing 16–33 px mean on a sweep). Springs now run on native drivers in `native/kit`:
  - `spring-animate.ts`: closed-form spring (under- and over-damped) sampled into WAAPI keyframes, live position and velocity read from `animation.currentTime`, motion's rest thresholds, optional delay. The rest/hot value stays a static CSS rule so recreated elements paint correctly. Hover never re-renders React.
  - `band-spring.ts`: rAF closed-form integrator for the highlight band (target changes every frame), writing `--bkm-hs0/1`.
- **Commits:** 4c47f1b, 997f77e, fd287a6 funnel rings (+ rebuild resumes the painted hover); d124547 funnel label dim; 15cf054 pie; 066271a ring, regression fixed in 97cb71c (the skip-if-running check also matched the dim's opacity CSSTransition, so pushed/released rings snapped); 67ee885 radar; 11ea03b marker cluster fan; e1b5658 highlight band. Tooltip follow already used the library's rAF spring with bklit's parameters: unchanged. Opacity dims stay tweens, as in bklit.
- **628a281 marker actions (missing feature):** fan discs with `onClick`/`href`/`target` get bklit's pointer cursor, hover 1.15 + shadow and press 0.95 springs (400/17), and the same click semantics (onClick wins, `_blank` → `window.open` noopener).
- **Chrome (real input, dark + light), all PASS:** funnel (peaks 1.063/1.127, max frame step equal to bklit, keyboard, handover), pie (peak 10.80 vs 10.81 px), radar (1.054 both), ring after 97cb71c (max step 0.003 both, after 5 cycles and 2 theme toggles), marker fan (peaks within 0.01, settle 507 vs 511 ms), highlight band (overshoot and reversal like bklit), marker actions (hover 33.15 vs 33.16, click hash parity), marker entrance (1489 vs 1498 ms), keyboard on line and markers.
- **Minor, open:** actionable disc rest shadow is a `drop-shadow` without bklit's negative spread (shadow-lg); migrated marker emoji y settles with a 1.6 px wobble vs bklit 0.6 px monotonic. Ring entrance arc ends may look flat mid-entrance vs bklit rounded (clip-wedge reveal) — fixer investigating.

### D740 — Ring entrance caps; marker shadow and emoji entrance

- **8551ffa ring:** the native arc mount motion revealed the finished arc through a wedge clip, cutting the rounded leading cap flat mid-sweep; bklit animates the arc's end angle with cornerRadius = half thickness. Progress marks now take `motion: false` and `native/ring/sweep.ts` redraws each arc's `d` from the same arc generator on bklit's schedule (hidden before first paint, restored to the rendered path at the end, reduced motion skipped). Clip-wedge path removed. Chrome dark + light PASS: t50/t95 per ring within 0–12 ms of bklit, round caps, no full-arc flash, settled d identical, hover springs unchanged (1.0324 both), theme toggle and hover mid-entrance end full.
- **d0fdfcf + 615120e markers:** fan disc shadow-lg was a CSS `drop-shadow` (no negative spread). Now two shrunk blurred circles behind each disc, radii derived from `size`, springing to bklit's hover shadow; scale origin pinned to the disc centre. Body emoji get `text-rendering: geometricPrecision` (Chrome snapped scaled glyph metrics, a ~0.5 px sawtooth). Light crop diff vs bklit 1.52 → 0.105 at rest. Chrome PASS (light; dark shadows near-invisible): shape match, peak 33.16 both, no shadow offset during the spring, fan timing within 20 ms, emoji monotonic, entrance within 10 ms, no console errors.

### D741 — Entrance clocks: motion's time origin; radar/candlestick spring rest units

- **81daecf radar, 29c9b33 candlestick:** springs on a normalised 0..1 span were given motion's px rest thresholds (0.5/2), so they declared rest at ~85% and snapped (radar grid/spokes finished 40–120 ms early; candlestick custom spring enters ran ~1 s past bklit's reveal cut). Rest thresholds now follow the integrated quantity, like motion (granular below a span of 5). Audit of every other spring config: correct (px) or already granular. Chrome PASS (radar ±12 ms, no snap; candlestick ±10 ms, peak 0.6% both).
- **Entrance time origin (379eed2, 08fd55c, ecd6a5c, c373408, a8241e9, 06d2355, b8952ed, 11d6b45, c3ca1db):** declared delays/durations/eases were equal, but the clocks were not. motion stamps WAAPI `startTime` with the frame timestamp after the commit (render-start clock, falling back to resolve time when >40 ms stale) and JS-driven values with that stamp + 1000/60; migrated CSS animations started at the next style recalc (funnel segments +17 / labels +33 ms in production) or earlier than bklit (ring −27, sunburst −37, wipe −10, event markers −34/−48 ms). `native/kit/entrance-origin.ts` + `entrance-align.tsx` re-stamp each CSS entrance by kind ("frame" for WAAPI-backed opacity/transform, "motion" for JS-driven values), deciding staleness from the same reference points as motion. Gauge notch and event-marker entrances split into scale ("motion") and fade ("frame") keyframes, as motion runs them on different drivers. Radar axis-label fade uses motion's default ease-out (bklit's WAAPI tween), not the declared bezier. Production after: ring +4, wipes +1–4, markers −0.3/+3, radar labels +4, sankey +2, gauge −5..−1, funnel +6–8, sunburst +9 ms — all under one frame, nothing early. Chrome PASS (funnel, radar, gauge, sankey; dark + light).
- **Ruling — sub-frame residual:** the remaining +4–9 ms is the side-by-side harness: bklit's card renders first in the same React commit, so motion's render-start stamp precedes the migrated card's by that card's render time. In a standalone page the stamps coincide. Accepted, no constant offset.
- **e48e8ba radar:** the entrance aligner shared the renderer's React key (duplicate-key console error on every radar visit). Fixed.

### D742 — Entrance follow-ups: wipe flash guard, sunburst labels

- **ce66b15 + a925e23:** an aligned stamp can land a few ms past the timeline when the first frame after release is heavy (markers mount), leaving a CSS animation in its before phase; without backwards fill the un-animated value showed for one frame (markers: whole line visible mid-wipe, ~5/16 Chrome navs). The wipe now fills backwards, and the aligner guarantees backwards fill on every animation it re-stamps. Chrome PASS: 0 open-clip frames in 13 markers + 9 line/area/composed navs; 0 final-value-then-depart frames on funnel, radar, gauge, sankey, ring.
- **adbbb9c sunburst:** labels faded fill-/stroke-opacity separately while bklit's `motion.text` animates `opacity` (JS-driven, shared delay, 1100 ms cubic-bezier(.85,0,.15,1)); and the staleness check, judged on `performance.now()` inside our rAF (which runs after motion's batch), sent ~1 in 4 runs to the resolve-time clock (+33–50 ms). Labels now animate `opacity`; sunburst judges staleness on the frame timestamp (`resolveOnFrame`) from its mount-effect clock. Chrome PASS: labels +10–20 ms at every depth, not bimodal, curve RMS diff 0.014; arcs +8–13 ms; hover and zoom/breadcrumb pixel-identical.

### D743 — Cleanup pass and native-claim research, first batch

- **Cleanup (15dc4b2..dfc84e3):** 77 unused exports and their dead helpers dropped, the unused showcase component and 10 orphan demo variants removed, phase-era comments dropped, heatmap enter easing on the shared `cubicBezier` (the only runtime change, ≤1e-5 difference), stale phase-7 scripts (orphans, reach-in guard, bundle gate, sync-data) and their `guard:*` scripts removed, README/AGENTS rewritten for phase 8. `bench/` and `qa/` kept as retired reference.
- **Native research (docs/native-research/, test routes under showcase/app/test/, uncommitted):** the "partly native" verdict mostly holds. Actionable: D-1, `defineChart(({ width }) => spec)` replaces ResizeObserver + state for width-derived spec flags (sankey `reversed` first; moved to production by a fixer). Proven real by live test: #12 (first paint animates only bar/line/area/arc; the empty-then-flip trick is the supported route) and #29 (entering cells publish focus points only at finish). Measured: native mark `states` cost 7.1 ms per hover move at 300 bars vs 0.70 ms for the focus layer, so the CSS/focus-layer hover stays for large scenes.
- **UPSTREAM-GAPS corrections:** #8 hide delay is native through `tooltip.motion`; #10 glow/blur are CSS filters in bklit too (parity), only mask/pattern remain; #15 the key-suffix wrapper is gone, depth front faces are a custom mark.

### D744 — Sankey builder, hover polish, native sunburst focus, one native wipe

- **6791dd2e, 0973be51, 5cb86440 sankey:** `reversed` is derived in the `defineChart(({ width }) => ...)` builder (research D-1); ResizeObserver + state removed. A builder chart takes `focus`/`tooltip` in defineChart's second argument; inside the built spec they are silently ignored (the tooltip vanished until 5cb86440). Chrome PASS dark + light.
- **804e6d9d pie/ring glow:** hover drop-shadow 12px in the slice colour, honouring `showGlow`. **Ruling:** bklit's source sets it (pie-slice.tsx:158/183, ring.tsx:174, `showGlow` default true, demos don't override) but its rendered DOM keeps `filter: none` in this build. That is a bklit runtime artifact, not design intent; the migration keeps the glow. Rest tone and post-leave now 0.00% diff (Chrome qa-f5).
- **77720491 liveline, bbdc42ff kit/candlestick/composed:** hover dot radius is the tooltip `dotSize` (default 5) × `dotScale`, as bklit chart-tooltip.tsx:34,147 (it was the line dotSize / dotSize/2). Chrome PASS.
- **Ruling — ring centre number:** bklit's NumberFlow re-triggers ~every 200 ms for ~2 s during hover (re-render artifact); migrated rolls once (0.9 s). Hover resolve is ~10 ms on both. Parity; keep migrated.
- **d074e28b sunburst (research D3-1):** focus resolves with `findNearestPoint(scene, x, y, maxDistance)` without the presented points, so TanStack re-resolves through the zoom tween natively. Resync/replay timers, pointer refs, pointerleave listener and the onRender zoom replay deleted (+47/−113). Hover gated until the entrance ends.
- **23255c5a, 4b733c17, f28bb503 wipe (research M3-1):** the entrance wipe is a native keyed nested-group pair (`wipe-o` clipped, translated −(1−p)·W; `wipe-i` +(1−p)·W; tween 1100 ms cubic-bezier(.85,0,.15,1)) for kit line/area, projection lines, and composed lines/areas/bars (one shared wipe padded by half a bar, frontier −pad → w+pad as bklit's ChartRevealClip). Terminal markers are post-overlay in bklit and leave the clip. The CSS wipe (`@property --bkm-wipe`, keyframes, data-bkm-wipe/hold, WIPE_ORIGINS) is deleted; entrance-origin stays for radar, funnel, ring, sankey, sunburst, gauge, markers. Zoomed (`xDomain`) frontier now matches bklit (the CSS one ran margin.right ahead).
- **Chrome qa-f5 dark pass, 17 routes:** all PASS (rest/hover A/hover B/leave ≤0.44% except heatmap hA 1.76%, a 1 px cell-gap hover point from a 306 vs 305 px svg; no tooltip on either side at a gap). Consoles clean.

### D745 — Wave B: raw-DOM replacements applied

- **Size and timers:** bar and candlestick fill-height come from CSS (`height: 100%`, `aspectRatio` undefined) instead of a ResizeObserver plus `fitHeight`. Bar, scatter and kit `useReadyGate` use a single ready timer (optional `onReady` callback); scatter's phase "ready" is driven by that timer. Timing unchanged, Chrome: 732 ms gate after the reveal.
- **Scene coordinates:** kit drag-select uses the public `interaction.clientToScene`; Chrome: a 300→600 px drag publishes `--bkm-hl0=300` / `--bkm-hl1=600`. Composed drops its second ResizeObserver; after the entrance the width comes from `onRender` `scene.width`; Chrome: 1086→600→1086, no idle mutations. Live-line takes its width from the kit parent-size hook and `onRender`; Chrome: 620/900/1086 verified, and the keyboard Home hold sits at the plot's left edge via `setControlledFocus`.
- **Hooks instead of renderer DOM:** markers' actionable discs are identified by the documented className `bkm-evt-act-<mi>-<gi>-<k>` instead of `data-ts-key`. B3 selectors: pie uses `bkm-pie-arc`, ring `bkm-rg-arc`, instead of `ts-chart__arc`, via `radialArc` className (reference/marks/polar.md:42). About 330 other renderer selectors are kept with gap #36/#20 comments (cartesian marks take no className); inventory in `docs/native-research/B3-SELECTORS.md`. ring-springs does one `getAnimations({ subtree: true })` per hover change.
- **Sunburst:** the hub no longer clears the hover. At the root the focus resolve excludes the hub and undrawn arcs, so the centre resolves to its ring-1 sector, as in bklit (bklit's hub shows "Revenue › Product"); zoomed in, the hub stays a target. The still-pointer hold moved to a `stillRef` cleared on a real move or on pointerleave, which fixes a first teleport move not hovering. Keyboard zoom goes through the `selection.change` source. Chrome: click zoom, hub zoom-out and Arrow+Enter zoom verified.
- **Comment-only:** gap citations in `sweep.ts` (#35), `pop-spring.ts` (#16/#36) and the choropleth wheel rAF (bklit choropleth-feature.tsx:90-91,114-115,201-202).
- **Docs:** R3 layout plan written (`docs/native-research/R3-LAYOUT.md`); B2 (1.1.0 upgrade) findings in `docs/native-research/UPGRADE-1.1.0.md`, waiting on the user's OK.

### D746 — TanStack Charts 1.1.0, ring edge hover, Chrome QA

- **Upgrade (user OK):** `@tanstack/charts` and `@tanstack/react-charts` pinned to 1.1.0 (additive types; focus-callback dedupe on identity + `Object.is` datum; first ResizeObserver report accepted when it matches the measured size; neutral card for custom tooltip bodies). `repos/tanstack-charts` checked out at v1.1.0 (user OK). The choropleth and heatmap `--ts-chart-tooltip-*` resets are removed (core neutralises custom bodies); cartesian, sankey and liveline resets stay (default bodies). Research: `docs/native-research/UPGRADE-1.1.0.md`. No UPSTREAM-GAPS item and none of #186-#198 is closed by 1.1.0 (`docs/native-research/ISSUES-VS-1.1.0.md`).
- **Ring edge hover:** the hit test reads each ring's live spring value (`SpringDriver.value`, `liveRingScale`) instead of the static hover/pushed target, so 1 px moves across a growing ring's edge keep the hover. Arcs still in their entrance use the static target.
- **Chrome QA (tab 472097901, real cursor where noted):** markers cluster fan-out matches bklit (single markers have no action, so no lift, as bklit marker-group.tsx:506-508). Ring: 1 px real-cursor moves across ring 3's edges keep `data-hover`; outer hover edge matches the paint, inner edge reaches ~2 px into the track (not compared with bklit). Dedupe sites: line keyboard hold, heatmap, sunburst (click, hub, Arrow+Enter zoom), funnel and live-line hold all survive hover and leave. Heatmap and choropleth tooltips match bklit in light and dark. Consoles clean on 11 routes. Resize not checked (no width control; window not resized).
- **Accepted:** live-line keyboard hold clamped at the plot's left edge shows the edge's time on the axis pill and the held row's time in the tooltip (1 s apart); bklit has no keyboard hold.

### D747 — R3 package layout ruling, B0 moves

- **Ruling:** adopt `docs/native-research/R3-LAYOUT.md`. `native/` is dropped; family folders sit directly under `charts/` (`live-line/` replaces `liveline/`); family-agnostic code lives in `kit/` subfolders (cartesian, motion, entrance, size, tooltip, legend, pattern, polar). Dependency rule: a family imports only `kit/`; `kit/` never imports a family or an entry. Public API is `index.ts` plus `./styles.css`; the 18 unused subpath exports are removed (no subpath import anywhere in `showcase/`).
- **B0:** 160 renames via `git mv`, 537 import specifiers rewritten, entrance files byte-identical (R100). Temporary `kit/api/` holds the old `native/api` until B1 dissolves it. Known rule breaks left for B1: `kit/api/misc.ts` imports `heatmap-chart`; `funnel/hover-css` (`springLinear`) is used by gauge and ring, `pie/center` by ring, `bar/easing` by scatter. tsc clean; 10 routes 200.

### D748 — R3 B2 splits, choropleth fade, lint toolchain, R5 wave 1

- **B2:** composed (633d7dc1), radar + sankey (959a7ac3), choropleth (0d1f6404), sunburst (44458814) and live-line (47d89a34) split into bklit-style part files; every entry is under 300 lines. Dead sunburst zoom exports removed.
- **Choropleth fade (053217ef):** the fade clock's zero is the commit that shows the layer (stamped once in render), as bklit's fade starts at its mount effect (use-mount-progress.ts:19-26). Chrome check pending.
- **Lint:** oxlint 1.87 + tsgolint replace ESLint (0f108066). knip config added. Hazard rules: getAnimations, private TanStack subpaths, `bklit/no-ts-dom-reach-in` (needs a gap or issue comment within 20 lines; documented `--ts-chart-*` theme vars are exempt), `bklit/timer-needs-citation` (affc2da6, 7cb7abc9). The style rules follow bklit's Biome config (e7eeb71f). R5 wave 1 brought the hazard hits from 102 to 0.
- **Citations:** committed code cites UPSTREAM-GAPS entries or posted issue numbers, never the untracked `docs/upstream-issues/` drafts (a4766645). New gaps #45-#48 cover the draft items that had no entry.

### D749 — bklit public API parity

- **Audit:** bklit `./charts` exports 503 names; ours exported 415, so 88 were missing. Consumer-facing names, props and context fields were added in four batches (A 7109ac9b, C 1b045911, B b3fb9ecd, D 5415a512); `index.ts` lists each one explicitly.
- **Not ported (bklit internals with no consumer meaning on a native renderer):** sunburst geometry/reveal helpers, y-domain tween helpers, square-column and skeleton-height math, `CHART_CLIP_PASSTHROUGH`, `DEFAULT_CHART_LIFECYCLE`, `resolveTooltipBoxMotion`, indicator fade helpers, `resolveLineLoadingPulseMode`, `getSeriesMarkerVisualExtent`, profit-loss/projection/reference-area geometry helpers, `useAnimatedYDomains` (our y tween is native motion with no animated domain), `useChartInteraction` (focus lives in the renderer; `useChart`/`useChartHover` give `tooltipData`, `selection` and the focus setters).
- **Accepted divergences:**
  - ChartBrush `brushDirection` draws horizontal only (1.1.0 has `brushX` only). `selection` is ignored, as in bklit's own ChartBrush. `useWindowMoveEvents` is a no-op.
  - Context `chartStatus` is always "ready"; `chartPhase` is "revealing" until the entrance ends, then "ready"; `revealEpoch`, `enterTransition` and the y-tween state have no equivalent.
  - Sankey context: `mousePos` is null, and custom children render in the host div.
  - Gradient SVG passthrough props type-check but have no native target.
  - Loading pulse enter/exit restart their half-cycle instead of resuming the phase; a series' `loadingStyle="sweep"` uses the diagonal sweep, not the re-rolling silhouette.
  - An unmatched SeriesMarkers `dataKey` draws nothing (bklit falls back to series 0's style).
- **Fidelity fixes found by the audit:** the default marker radius is 5 (bklit line.tsx:370-375, series-markers.tsx:59), not 4. BarXAxis/BarYAxis thin labels with bklit's `maxLabels` defaults (12/20). `maxFanned` is honoured on ChartMarkers and MarkerGroup.
- **Removed:** the duplicate `BrushLayout` export; bklit's name is `ChartBrushLayout`.
- **D749 addendum (E-G):**
  - `setHoveredBarIndex` / `setHoveredCandleIndex` drive native focus by index. bklit declares them but never sets them, so ours do more than the original.
  - MarkerGroup `iconFill` is accepted and has no visible effect on text icons. `animationDelay`: ChartMarkers reproduces bklit's `gi * 0.1` stagger; a standalone MarkerGroup uses the chart's entrance timing rather than bklit's 0 delay.
  - Gradient components take no `ref`: they are config carriers that render no element.
  - `Transition` is a structural supertype of motion's (`type: unknown`; `ease` may be a bezier, a keyword or a function). A function ease drives the native tween directly.
  - Re-audit (`scratchpad/w5/api/types.cjs`): every bklit export, prop key and prop value type is accepted by ours, except the ruled-out internals and the gradient `ref`.

### D751 — pie and ring hover glow removed (bklit never shows it)

- **Ruling:** the migrated pie and ring draw no hover glow. `showGlow` stays in the public prop types (bklit API) and has no effect, as in bklit.
- **Evidence (Chrome DOM probe on bklit):** pie-slice.tsx:183/314 and ring.tsx:171-180 put `filter: showGlow && isHovered ? drop-shadow(0 0 12px color) : "none"` in the plain `style` of a `motion.path`/`motion.g`. framer-motion 12.43.0's useSVGProps memoizes that style on first render, so the DOM keeps `filter: none`. A MutationObserver saw 97 style writes during hover, none a drop-shadow; computed filter stayed none, whether `showGlow` is true or false.
- **Removed:** the `--bkm-gl<i>` host vars (pie-chart.tsx, ring-chart.tsx, ring/model.tsx), the pie glow rule and `buildRingGlowCss` with its `<style>` (kit/polar/polar-dim.ts), `GLOW_BLUR_PX`.
- **Radar unaffected:** its glow is visible in bklit and Chrome QA confirmed the match.

### D752 — cartesian loading: phase machine, sweep silhouette, per-letter label

- **Phase machine (2b0fcfc8, e4913445):** area and line loading run from the first series only, with 5 grid rows, and the loading to ready flip happens in place with no remount (pulse remainder, 500 ms y tween, native wipe). The phase state adjusts during render (`kit/cartesian/loading-phase.ts`), with no `setState` in effects.
- **Sweep:** the sweep style draws bklit's own silhouette (`kit/loading/sweep`, `loading-sweep-overlays.tsx`) instead of a masked series path.
- **Label:** `LoadingLabel` pulses colour per character like bklit's ShimmeringText (shimmering-text.tsx:42-93). 458fd29c sets the outer line-height to 1.25rem as bklit's `text-sm`.
- **Chrome check pending:** sweep silhouette and per-letter label on area and line; Line component unchecked.

### D753 — bar reveal through zero-value bars; bardepth pulse clipped to the front face

- **Bar (4c04e5a5):** loading kept no bars mark, so at the flip a new mark group joined through the update path and only faded in (`motion.ts` `reconcileMotionSvg` / `addEnterMotionTrack`). Loading now keeps zero-value bars, so ready is a keyed value update that grows like bklit's reveal (bar-chart.tsx:372-386); timing runs off the shared clock via `enterOrResume`. Recorded as the UPSTREAM-GAPS #12 addendum (74c88f49).
- **Bardepth pulse (38fb3490):** a soft travelling gradient band like bklit's (bar-depth.tsx:88-106, 936-1073): bell-curve white gradient, 0.85 peak, wave height `max(0.55*bar, 36px)`, 2.4 s ease-in-out sweep gated on ready.
- **Accepted divergence (gap #49):** the group clip supports rect bounds only, so the band is clipped to the front face and does not light the lid or side face as bklit's silhouette clip does (bar-depth.tsx:964-966).

### D754 — heatmap loading: axes, label box, per-cell shimmer

- **Axes and label (337afc00, 9058132a):** loading shows the axes, and the label sits in the plot box (margin-inset) as bklit heatmap-chart.tsx:482-497, text-sm per chart-loading-label.tsx:41. A loading to ready switch re-seeds the per-cell reveal (`cellsEntered` follows `status === "ready"`), and the shimmer layer drops at once on reveal (heatmap-cells.tsx:149-151).
- **Shimmer (9a1b2e67):** per cell like bklit heatmap-cells.tsx:313-348 (defaults heatmap-animation.ts:22-25). Marks have no per-datum opacity or style channel (`rect.ts:48` scalar `fillOpacity`), so the shimmering cells share one group and `styles.css` derives each rect's cycle length and peaks from `sibling-index()` (gap #36 for the group key). The 16 hand-picked lanes are removed.
- **Accepted divergences:** (a) the cycle length is fixed per cell (4 pulses of 0.43 to 1.7 s), where bklit re-rolls duration and pause every pulse; (b) a CSS cycle loops 4 peak values per cell, where bklit draws a new random target every pulse; (c) cells start at a random opacity (keyframe 0% is `0.85 * r0`) rather than bklit's 0, with no per-cell delay; settles within about 1 s. Browsers without `sibling-index()` rest at the base opacity (`@supports` fallback).

### D755 — L5 lint pass

- **Count:** oxlint type-aware errors on `migrated` are 511 on a clean checkout of 458fd29c (515 on 4f8730bc). 22f77366 and e4913445 made the cartesian loading code lint-clean (arrow `BrushPanes`, non-deprecated sr-only clip, no setState in effects); 9058132a removed negated conditions in the heatmap axis flags.

### D756 — B2b tooltip resets removed; knip leftovers

- **B2b (925ac83d):** every bklit tooltip passes `renderTooltipBody` (cartesian, sankey, liveline, heatmap, choropleth), so charts-core `tooltip.ts:130-135` applies `customTooltipCardStyle` (`tooltip.ts:391-400`) inline. The `--ts-chart-tooltip-*` resets in cartesian `styles.css` (background, shadow, radius), `sankey.css` (max-width, padding, border, color) and `liveline.css` (radius) were never read and are removed. Rendered output should be unchanged; Chrome check pending (light/dark, 1440/390; tooltip panel look on cartesian, sankey, liveline).
- **Knip (8d6df6f1):** removed the unused exports, the dead `lib/demo-data.ts` generators (kept: heatmap, world countries, liveline) and unused type re-exports in `kit/types.ts`. `@base-ui/react` stays. Left open: unused deps d3-geo, d3-scale, d3-shape (not removed), and `ChartRevealClipMode`, kept because bklit's `chart-reveal-clip.tsx` exports it.


### D757 — B2c ruled: pre-measured width stays

- The 1.1 host measures the container on first scene and `defineChart(({width,height}) => …)` sizes the definition, but ring, funnel and heatmap use the width outside the definition: heatmap `computeMetrics` feeds cell geometry, scales and grid focus (`heatmap/chart.tsx`); funnel `stagePx` positions pattern resources (`funnel-chart.tsx`); ring radii feed the centre children and the sweep (`ring-chart.tsx`). Taking width from `onRender` instead commits once at the placeholder and rebuilds, which cancels the entrance (D714).
- `useFluidWidth` (`kit/size/use-fluid-width.ts`) and `useHostSize` (`kit/size/host-size.ts`) stay. Pie alone could move, but it would delete nothing while the hook serves the other three, so it stays too.

### D758 — Cartesian loading follows bklit's phase order and pulse-end rule

- **fbba41de, 45b7538a:** phases `loading|exiting|swap|tween|ready|concealing|tweenLoading` run in place (no `loadingEpoch` remount). The y tween waits 500 ms only when bklit's 2% span rule says the domains differ (use-animated-y-domains.ts:50-79), so line starts the wipe straight after the pulse ends and area keeps its tween. Ready→loading conceals for `animationDuration`, tweens, then loops the pulse, like bklit's orchestrator.
- The pulse is one eased 2.2 s progress (`@property --bkm-p` clip-path). On exit it follows useGrowExitClip (line-loading-pulse.tsx:99-130): below 0.5 it grows to 0.5 then shrinks, otherwise it shrinks over 2.2 s × (1 − p).
- Chrome, same sampler and t0 for both cards: line wipe start within −30..+10 ms of bklit over waits 0.4–2.5 s (was ~550 ms late); area within ±20 ms; pulse end 30–60 ms ahead of bklit; wipe 980 ms on both. The pulse overlay keys on `data-ts-key^="id:loading"` (UPSTREAM-GAPS #36).

### D759 — Springs run on native createChartSpring

- **db267ba4 (fx-s1):** spring curves sample `createChartSpring` from `@tanstack/charts/spring`. Constants live in `kit/motion/springs.ts`, each citing its bklit source; `spring-linear.ts` is deleted.
- Curve diff against the old closed form is under 1e-3 everywhere except overdamped 60/20. The old closed form was invalid there, so native is the fix.
- Chrome (qa-spr), bklit vs migrated:
  - line highlight band 180/28: 50/90/99 % at 129/308/550 vs 130/300/538 ms, no overshoot;
  - liveline y glide 180/24: 50/90 % at 132/270 vs 141/272 ms, about 60 ms longer rest tail from the rest thresholds;
  - candlestick crosshair 300/30: identical;
  - ring hover 400/25 and radar hover: match.
- The candlestick rect-sum gap (449 vs 667) is a sampler artefact. Migrated splits each wick around the body with a 0 px gap, and the bodies match to 0.000 px.

### D760 — Tooltip box motion and ring dot read bklit's props

- **f8e7c142 (fx-tprops):** `kit/tooltip/box-motion.ts` resolves the native tooltip spring with bklit's precedence: `boxSpringConfig`, then `matchCrosshair`, then `damping`. It is used by the cartesian, bar, scatter, candlestick and live-line definitions.
- Bar gains the ring `dotVariant` with `dotRadiusFraction`, `dotScale`, `dotStrokeWidth` and `dotColor` (chart-tooltip.tsx:145-160).
- Chrome on barsquares: `boxSpringConfig` 30/12 and `matchCrosshair` sweeps settle identically to bklit. The ring dot matches at fraction 0.5.

### D761 — Ring progress paints through a custom layer renderer

- **8937338f (fx-ring):** the progress radialArc marks take `renderer`: a `ChartLayerRenderer` (rendering-and-export.md, "Mark-level renderers") that mounts its own SVG.
  - Each frame it draws a fresh d3 arc with cornerRadius = thickness/2 (ring.tsx:104).
  - `ring/sweep.ts`, its MutationObserver and every write to renderer-owned paths are deleted.
- **Composition:** uses `canvasChartRenderer.compose`, the documented built-in compositor. The canvas module enters the bundle. Accepted.
- **Accepted divergence:** progress arcs paint above every track, where bklit interleaves track then progress per ring. The rings don't overlap, so it is not visible.
- **Chrome:** the round cap holds mid-sweep, the stagger and final angles match bklit, and hover scale/dim and arrow-key focus work. Entrance and settle are within 1 % of bklit.
- Gap #51 records why the native radialArc tween can't sweep (no arc geometry in the motion tween, same mechanism as #35).

### D762 — Loading swap advances to tween on a frame

- **3b80cfd3 (fx-cl4):** the renderer applies a 0 ms motion track on its next rAF tick, not synchronously. A `setTimeout(0)` tween commit could land first, cancel the swap snap and slide the wipe from p=1. That was the intermittent area slow slide (qa-cl2, 1 in 4 runs).
- **Fix:** swap→tween now advances from `requestAnimationFrame`, like bklit's frame-driven phase advance (use-chart-phase-orchestrator.ts:145-152).
- **Chrome:** 24 runs on area and line, with Data clicked at 0.5 s and 2.4 s after Loading. No slow slide. Reveal start within ±20 ms of bklit, with one +32 ms outlier on line.

### D763 — Background renders through pattern resources and fades in on the ready gate

- **975922f6 (fx-props):** Background presets render as real `<pattern>`s via `ResourceHost` and `kit/pattern`. They are identical to bklit's apart from the id. Only the edge fade is CSS (two intersected gradient masks).
- **dfeb5c87 (fx-bg2):** the pattern rect is hidden until `data-bkm-ready` (bklit's `isLoaded`), then fades in with `bkm-bg-in` over 420 ms ease-out. The start is aligned on motion's frame clock (background.tsx:119-125,208). Chrome: 50 % and 90 % land on the same frame as bklit in light and dark.
- **Not wired:** `enterTransition` is a chart-level bklit prop. Our charts accept it but don't read it; the fade uses bklit's default.
- **Gap #52:** the TanStack scene has no HTML node kind, so ReactNode marker icons render as label text and `iconFill` is inert. Accepted until upstream.

### D764 — Ids from useSanitizedId, one useLoadedTimer

- **09f10486 (fx-s5):** the scatter, bar, candlestick and live-line uids come from `useSanitizedId` instead of `Math.random`. This removes the SSR mismatch risk.
  - The letter prefix is kept for the `[data-bkm-*="…"]` selectors.
  - choropleth, sankey, funnel, brush and the heatmap legend share the same hook.
- `kit/entrance/use-loaded-timer.ts` holds bklit's mount-anchored `isLoaded` timer for sankey, candlestick and choropleth (sankey-chart.tsx:118-124, candlestick-chart.tsx:202-207, choropleth-chart.tsx:390-397). Chrome: each schedules within 12 ms of bklit's.
  - Candlestick now also resets on an `animationDuration` change, as bklit does.
- **Kept separate:**
  - `RevealArm`/`useReadyGate` start at the reveal-arm commit (use-chart-phase-orchestrator.ts:164-169).
  - Funnel's per-stage timers come from a different bklit source.
  - Candlestick's `measured` layout effect is a client-commit gate. `useIsClient` would mount a commit earlier and shift the entrance.
- Lint 506 → 501.

### D765 — Audit set 4: one crosshair gradient, host-write helpers, writeFocusHost

- **ff03c849, 8bed01c8 (fx-s4):** segment-marks and bar call the shared `crosshairGradient` (kit/cartesian/date-pill.ts).
  - `writeAttribute` joins `raiseAttribute`/`writeVar` in host-write.ts and covers every set site on our own host.
  - `writeFocusHost` replaces the hand-rolled focus blocks in scatter and candlestick.
- Gradient and mark dumps are byte-identical. Chrome: `showCrosshair={false}` hides the rule on bar, barsquares and line on both sides, and the tooltip and dots stay.

### D766 — Generated CSS rules, dead fade-edges CSS removed

- **40c0fb3b (fx-f1):** the `[data-bkm-fade-edges]` mask rules had no producer and are deleted.
  - The brush fallback selector stays, citing gap #40: the static `renderFallback` rect never gets `data-chart-brush-selection`.
  - The heatmap legend level dim is one scoped rule for the hovered level, not 20 enumerated rules.
  - The marker `--bkm-mk` stagger rules are generated from `MARKER_BUCKETS`. Computed delays are identical.
- The commit also tracked a `migrated/node_modules` symlink that pointed at itself. After the merge it replaced main's real directory and :5200 returned 500. I untracked it, restored the directory with `pnpm install --offline --frozen-lockfile`, and changed the root `.gitignore` to `node_modules` (no trailing slash) so it also matches symlinks.

### D767 — useResizeBox, trackPanelSize

- **ff7c0e78 (fx-f4):** `kit/size/use-resize-box.ts` (`observeResize`, `useResizeBox`) replaces `useMeasuredSize` and the second observer in `usePlotMeasure`.
  - `useHostSize`/`useFluidWidth` keep their own rounding and collapse semantics on `observeResize`.
  - `kit/tooltip/track-panel-size.ts` is shared by the sized placement and the tooltip portal.
- Chrome: Live Perf entrance rows match bklit on line, composed, liveline, scatter, sankey and bar. Edge tooltips still flip.

### D768 — Reach-in citations, marker hot radius survives reconcile

- **16c5c650 (fx-f3):** the funnel pop, ring and radar hover reach-ins now cite #36. Funnel area marks have no `className` hook.
  - bar-chart cites #25.
  - The sunburst intro timer cites sunburst-labels.tsx:51-53 and use-enter-complete.ts:11-26. It equals the last label's motion end.
- **Bug fixed:** the actionable marker disc's inline `style.r` was stripped by a scene rebuild while hovered, so the disc shrank from 14 to 11 px (gap #20). The hot radius is now a CSS rule using typed `attr(r)`, citing #48. Chromium-only, like the existing `typedAttr` use.
- The sunburst entrance re-measured over 3 runs is within 40 ms of bklit (t50 matches). The earlier "70–190 ms late" reading is not reproduced.
- **Open:** migrated sunburst hover stays inert for the whole intro, while bklit's segments are live while they grow. Sent to fx-sbi.

### D769 — Terminal marker props declared like bklit's

- **c6ba695d (fx-f5) and the follow-up:** `LineSeriesTerminalMarkerProps` declares bklit's seven fields (line-series-terminal-marker.tsx:8). It no longer inherits unread marker-style keys.
- SeriesMarkers `fill` and the choropleth/sankey callback parameters already match bklit.
- **Open:** `yAxisId` is declared but not read. bklit plots via `useYScale(yAxisId)`. Sent to fx-yax.
- Lint 501 → 491 across D765–D769.

### D770 — Stale path comments, FIXER-RULES ledger, knip reasons

- **f5643170 (fx-f2, user approved):** fixed 32 comment path tokens in 18 files, the paths in UPSTREAM-GAPS and two PROGRESS rows. bklit citations are untouched.
- FIXER-RULES "Known violations" is down to one true row, `charts/sunburst/sunburst-mark.ts:94-128`, the scene-motion-node symbol read.
- `showcase/knip.jsonc` gives a reason for the root `ignoreDependencies`: those deps are imported only by bklit's clone, which knip does not follow.
  - knip now reports only the `ChartRevealClipMode` type re-export. It is kept for bklit file parity (D756).
  - Every dependency in migrated/package.json is imported.

### D771 — Overlays honour yAxisId; projection default curve is linear

- **97270569 (fx-yax):** the terminal marker, projection lines and ReferenceArea bind `yScale: "y:<id>"` through `yScaleForAxis`, the same path series use.
  - Projection values widen each axis's domain, as in bklit's `mergeProjectionYDomain`.
  - Chrome: on a temporary right-axis demo the marker sits at the same pixel as bklit's.
- **Lead fix:** `curveKind` now defaults to linear (projection-line.tsx:110). Before, ours fell through to the bezier curve. The demo passes `bezier`, so nothing visible changes there.

### D772 — Sunburst live during the entrance

- **da481df9 (fx-sbi):** the `isIntro()` focus gate and the still-pointer hold are removed.
  - The focus strategy's `resolve` rejects a sector until bklit's growing, box-centre-scaled hit path covers the pointer (sunburst-segment.tsx:98-137). It uses the entrance's own delay, duration and easing.
- **Ruling:** with a resting pointer, ours hovers at the renderer's next re-resolve, about 200 ms before Chrome re-hit-tests bklit's scaled path. This is a browser hit-test cadence, not a design difference. Accepted.
- Chrome: dim and grow mid-entrance match bklit, and entrance t50 and settle are unchanged.

### D773 — One ready gate

- **33fcba05 (fx-ci):** `useReadyGate` (kit/entrance/reveal-arm.tsx) serves every chart with an interaction gate. Its `resetKey` and `viaState` options cover the mount-anchored state charts (candlestick, choropleth, sankey). This supersedes D764's `useLoadedTimer`, which is deleted.
  - The pointer-inert rule is folded into `readyGateCss`, replacing 5 copies.
- **Start points stay per bklit:** line, composed, bar and scatter arm at their bklit commits. Candlestick, sankey and choropleth arm at mount or `parentSized`.
- TanStack has no runtime enable/disable for interaction. `focusDisabled` is definition-level, so toggling it would rebuild the definition.
- Chrome: ready times are unchanged within one cold sample. Charts are inert after Re-run and live after ready.

### D774 — Hygiene

- The root `.gitignore` uses `node_modules` with no slash (see D766). The worktrees that held no unmerged commits are removed.
- Lint is at 488. tsc is clean. The bklit/no-restricted count is 0.

### D775 — Sunburst focus changes no longer re-tween every sector

- **509ebc67 (fx-sbt):** the hub mark's `states` made every focus change produce a fresh state scene (charts-core mark-state.ts:34,107). That ran the 750 ms fallback tween over unchanged geometry, about 4,400 `d` writes per hover.
  - The hub keyboard ring is now `HUB_FOCUS_CSS` on `[data-bk-hub] svg:focus-visible`.
  - Hover, move, leave and hub focus now write 0 `d`. Entrance with a mid-entrance hover is about 3.04 s, against 3.8 s before.
- **Ruling:** the ring keys on svg `:focus-visible` with the hub focused, not on the keyboard source. A pointer on the hub during keyboard focus shows the ring. Accepted.
- **Open:**
  - Other charts whose marks have `states` may pay the same full update per focus change. Needs an audit, and an upstream draft if confirmed.
  - The focus-ring var was reported undefined on a direct dev load of /charts/sunburst, but styles.css is imported in app/globals.css. Re-check.

### D776 — Bardepth light-theme band: accepted one-frame divergence

- **Not reproduced (fx-bd).** 8 light cycles gave about 313 real-time captures, none with near-white pixels; a frozen-time sweep over 700–1150 ms in 12 ms steps was also clean. Pulse is off in the demo, and the lid tip cannot paint bright.
- **Likely cause:** the depth faces and the bars are separate marks with their own motion tracks. One run peaked at a 6 px bar-to-lid gap at 966 ms, against a normal 1.7–3 px, which matches the single QA frame.
- **Ruling:** accepted. Removing it would mean merging the faces into the bar mark, which changes the entrance model. Rare, a few ms, a few px. Per-mark clock sampling goes into the upstream notes.

### D777 — Markers fan findings: no divergence

- **fx-mk** compared computed styles on both cards over time, in light and dark. The cluster body holds for 1.1 s on hover and on leave on both, matching bklit marker-group.tsx:228-237 (delay `animationDuration/1000 + groupIndex*0.1`). bklit returns at 1.08 s, migrated at 1.1 s.
- **"Dim icon":** the 50% core disc (marker-group.tsx:369-390) sits over the still-visible body during that hold on both cards. Settled, both show a plain disc.
- **Cause of the QA findings:** the QA captures were taken one card after the other, at different elapsed times. Arrow keys do not open the fan on either card, so the keyboard-blur finding was a resting pointer.
- **Ruling:** closed, no change.

### D778 — Ring hover dim and centre roll: accepted

- **Dim:** same 0.35 opacity and 150 ms ease-out as bklit ring.tsx:168,186. Migrated dims the track and the progress arc as separate groups, so a dimmed arc blends over its dimmed track: about 4–5/255 darker in light mode. A track mask under the custom progress layer is out of proportion. Accepted.
- **Centre roll:** both use NumberFlow defaults, 900 ms with the same easing. bklit's 1.03 hover scale moves the hit area under a resting pointer, so its label flips about 5 times in 440 ms and the roll restarts. That is a bklit artifact, so we don't reproduce it (FIXER-RULES 4).

### D779 — Radar empty first load: not reproduced

- **fx-rdr:** 24 cold direct loads, light and dark, all rendered both cards. Of 32 client-side navigations right after a theme toggle, all rendered within 0.6–2.1 s. Where slow, both cards were empty together and neither was ever empty alone.
- **Likely cause:** a dev-mode on-demand chunk compile under CPU contention from other agents' servers. radar/entrance.ts reads nothing theme-dependent at mount.
- **Ruling:** closed, no change.

### D780 — Liveline entrance gap is measurement semantics; lint 488 → 448

- **Entrance:** Live Perf's entrance (collector.ts:495-700) counts only Web Animations. bklit's liveline entrance is an rAF lerp, so the panel sees only its ~500 ms opacity fades (~515 ms). Migrated's first roll is a real 600 ms CSS animation sized to the sample interval (live-frame-build.ts:122), so it reads ~565 ms.
  - The gap swings from −17 % to +11 % over 7 runs.
  - Ruling: no change, and nothing tuned to the metric.
- **Lint:** the live-line wave (dd66aa2f) took the count from 488 to 448. The new baseline is 448.

### D781 — 390 px QA via the stage width control

- **How:** the stage width control (bae578f3, `?w=390`) gives both cards a real 390 px container. This makes phone width and resize QA possible without resizing the window.
- **Results:** q390-a and q390-b covered 24 routes. 21 pass on layout, entrance, edge tooltips, keyboard and the 390 → auto → 390 resize.
- **Rulings:**
  - Barsquares at 390 is degenerate on both cards, because the legend squeezes the plot to about 158×79. bklit overlaps its x labels and draws no bars. Migrated thins the labels and draws a sliver. Accepted; we don't degrade migrated to match.
  - Sankey at 390 is degenerate on both cards. Parity.
- **Open:**
  - Choropleth wheel zoom keeps the hover tooltip and dim, while bklit clears them (fx-cz).
  - The markers rest baseline looks different (fx-mb, unconfirmed).
- **Gaps:** console errors were not read at 390. Light theme got less coverage on the cartesian routes, because of shared theme flips between observers.

### D782 — Native-first audit (au-nat) rulings

- **`data-ts-key` selectors stay (gap #36).** 1.1.0 documents that scene keys become `data-ts-key` (rendering-and-export.md:130), but not their format. Adding classes by wrapping a mark's `initialize`/`render` would trade a documented attribute for an undocumented override (FIXER-RULES 3). Gap #36 stands as written.
- **Polar hover dim stays CSS.** Polar `states` would turn every focus change into a full state-scene update (gap #53, D775), and `states` are deferred during entrance (motion.md:63). Rejected.
- **Dispatched:**
  - fx-dd: cartesian helper dedup (`dataTickValues`, `toDate`, `toNumber`, `yScaleOption`, `toTime`) and the missing gap citations in touch-focus, drag-select and hover-host.
  - fx-wp: `wipeWrap` to a documented composite mark, or evidence that none fits.
- **Queued until fx-rest and fx-ll2 land:**
  - size-hook consolidation on bar, scatter, candlestick and composed;
  - `findSpring` moved into kit/motion;
  - `clearAttribute`/`clearVar` host-write helpers;
  - pie/ring `useIsClient` dedup;
  - tooltip helper dedup;
  - `isMotionNode`;
  - small polar/funnel/sankey duplicates;
  - gap citations in band-spring, spring-animate, funnel and radar;
  - re-export `ChartRevealClipMode` (bklit API parity, D756).

### D783 — Plot dot clip matches bklit's reveal clip; markers 390 tick waiver

- **9af4fc09 (fx-mb):** `--bkm-plot-clip` now extends 20 px below the plot, as bklit time-series-chart-shell.tsx:658 (`innerHeight + 20`) does.
  - At normal sizes, point dots within 20 px of the plot bottom now show, as on bklit.
  - At 390 the markers dot row is no longer clipped away.
- **Waiver:** at 390 the markers plot height is −1 px. bklit skips its guide ticks when `lineHeight <= 0` (marker-group.tsx:193). TanStack clamps `chart.height` to at least 1, so migrated draws 3 small ticks. Degenerate size only; accepted.

### D784 — Choropleth wheel-zoom hover: not reproduced

- **fx-cz** tested with trusted hover and scroll at 390 and 1440, light and dark. Both cards keep the tooltip and dim when the zoom leaves the country under the pointer, and both clear it when the zoom moves the country away (wheel.ts re-hit-tests the resting pointer).
- **Likely cause of the QA finding:** the tool's scroll moves the pointer onto the card at the moment of the wheel.
- **Ruling:** closed, no change. Drag-pan was not compared because it needs a real drag, so it joins Q4.

### D785 — Size hooks stay; mount glue not collapsed (audit N3, D8)

- **N3:** bar, scatter, candlestick and composed use the measured box outside `defineChart`. They need it for the public `useChart()` width and height, for React-side scales and pill ticks, and for bar's hover rect and skeleton. By the D757 criterion, `useResizeBox` stays.
- **D8:** the `useParentSizeMounted` + `useReadyGate` + `useResizeBox` glue has a different shape in each chart (options, reveal clock, reset key, when it arms). One shared hook would need about five options and would remove no code, so it is not collapsed.
- **Cartesian helper merge (0fcedd76):** tick, date, domain and number helpers now come from kit/cartesian. `scatter/ticks.ts` is deleted. Three look-alikes stay because their behaviour differs on bad input: scatter `toNumber`, scatter `yScaleOption`, brush `toTime`.

### D786 — Polar Chrome QA after the helper dedup (qpol)

- **PASS side by side on pie, ring, radar, funnel, sankey and gauge.** Checked: entrance, hover in light and dark, keyboard (migrated only; bklit has none) and 390 dark.
  - Radar keyboard is now verified: focus confirmed on the svg.
- **Gauge in dark:** active bars render near-black on both cards. This is a shared demo colour issue, not a migration divergence.
- **Open:**
  - Early-entrance offsets on gauge, sunburst and ring, seen only in screenshots. Sent for per-frame measurement (ient).
  - Choropleth, liveline and the rest of sunburst are sent to qpol2.

### D787 — Polar entrance offsets measured per frame (ient)

- **Method:** one Re-run click starts both clocks; path bbox sampled every rAF, 3 runs per chart.
- **Gauge and ring:** migrated trails bklit by 0–25 ms with an identical curve shape and the same stagger; it is never ahead. This is the accepted clock-start residual (UPSTREAM-GAPS #33). The QA screenshot counts were capture timing.
- **Sunburst:** a 20–40 ms constant lag with the same easing. Migrated also paints a seed with about 11% of the final bbox area from the first frame. Likely cause: the grow starts one render after mount (sunburst/intro.ts `grownKey`, definition.ts `resumeEnter`). Sent to a fixer (fx-sb).

### D788 — Cartesian QA gap-fill (qgf): no FAIL

- **Coverage:** 15 cartesian routes, compared with bklit:
  - hover in dark at left, middle and right;
  - keyboard (migrated only);
  - entrance frames, including the reworked wipe: edge position matches, no start flash;
  - console clean;
  - markers cluster fan identical;
  - 390 px in dark (line, bar, composed, heatmap).
- **Open:** over a red candle, the candlestick crosshair is slightly darker on migrated (177,102,113 vs bklit 190,104,115). Below the candle the colours are identical. Sent to fx-cx.

### D789 — Liveline QA divergences (fx-ll3)

- **Left-edge fade: fixed.** bklit fades from 0 to 4% (live-line.tsx:173-175). Migrated's mask was anchored on the rolling group's own box, which starts about 35 px left of the plot, so the fade ended before the visible edge. It is now anchored in view-box space at the plot's left margin (`--bkm-live-fade-x0`).
- **Live dot while hovered: parity.** It is at 0.25 opacity on both (bklit live-line.tsx:112,245). The brighter dark ring QA saw was the pulse ring at a different phase.
- **Tooltip and pill 1 s apart while hovering: parity.** It happens on both, in 7% of samples on migrated and 18% on bklit. The tooltip commits on a key change while the pill follows the roll.
- **Keyboard at the edge:** steps do land, then roll back to the left-edge clamp within about 0.4 s. This is the accepted clamp (D-entry at LOG line 1098) plus native first-point focus.

### D790 — Sunburst entrance clock moves to render start (fx-sb)

- **The 11% "seed" from D787 is invisible:** it is the hover pop overlays at opacity 0. The real seed is a 0.002 rad sliver at `scale:0`.
- **Lag fixed:**
  - The grow flip in sunburst/intro.ts is now a `useLayoutEffect`. It runs after the renderer's own layout effect mounts the seed (RendererChart.tsx:177-185), so the tween starts in the same frame instead of one render later.
  - The intro clock is `useRenderStart()` (kit/entrance/entrance-align), not `performance.now()` in the effect, so the renderer mount is no longer counted into the entrance.
- **Result:** the lag at 50% and 90% area went from 40–126 ms to 10–30 ms. The residual is the clock-start offset (UPSTREAM-GAPS #33). Delays, duration and easing are unchanged.

### D791 — Candlestick crosshair over a candle: accepted (fx-cx)

- **Cause:** bklit paints the hovered candle twice, once in the faded group at opacity 1 and again via `highlightGeometry` (candlestick.tsx). The 1.5 px wick's anti-aliased edge columns therefore composite twice: coverage 0.10 vs migrated's 0.053, matching 1-(1-c)^2.
- **What is identical:** crosshair colour, paint order and opacity, the body pixels, the tooltip and the close dot.
- **Ruling:** accepted. The only difference is a ≤1 px anti-aliasing column. Reproducing it would need a duplicate wick node, which is not a native path.

### D792 — Chrome re-check of D789 and D790 (qv1) passes

- **Sunburst:** compared side by side with bklit in light and dark at 1440, and in dark at 390. The entrance shows no flash and no snap. Hover and click-zoom in and out match, and migrated keyboard focus works (bklit has no keyboard focus).
- **Liveline:** the left-edge fade starts at the same x and runs the same width as bklit, at rest and while rolling, in light and dark, at 1440 and 390.
- **Not covered:** liveline hover and keyboard in light and at 390; sunburst keyboard and zoom in dark and at 390.
- **Audit 2** (scratchpad AUDIT-NATIVE-2): fixer waves S, A, F, E, G and C are dispatched. Gap #54 (grid crispEdges) is allocated.

### D793 — Marker click listener stays (fx-E, audit 2 M3)

- **Why no native path:** markers are `decorative()`, which removes them as pointer and keyboard targets (custom-extensions.md:245). `focus.onSelect` reports only focused chart points (focus-and-interaction.md:967-976), so it can never name a marker.
- **Ruling:** the host click listener stays. It parses our own `bkm-evt-act-*` scene className, not renderer-owned attributes, so it is rule-2 compliant.
- **Docs:** marker-springs.ts now cites gaps #31 and #50.

### D794 — Audit-2 merges and Chrome QA (qv2, qv3)

- **Merged:**
  - fx-A: the ready-gate store replaces the useHostReady MutationObserver.
  - fx-F: funnel ring lookup has no key read-back; shared `writeHoverIndex`/`readHoverIndex`.
  - fx-G: one MS_PER_SECOND, joinClasses, displayNameOf and textWidth.
  - fx-C, Z1, Z2: every comment block outside sunburst is ≤2 lines.
- **Lint:** 262 errors.
- **QA PASS:**
  - Ready gate on 6 cartesian routes, light and dark: inert during the entrance, re-arm.
  - Funnel, radar and bar hover and keyboard.
  - Sankey labels and hover, including 390.
  - Heatmap fade and hover.
  - Liveline tooltip offset.
  - Radar dark keyboard and Tab-out.
  - Line, bar and funnel at 390.
  - Funnel entrance by rAF sampler: +8 to +20 ms per stage, within one frame.
- **Ring hover at 3 o'clock:** bklit returns Social at every radius, while migrated follows the ring under the cursor. This is the bare-track case already accepted in D721 (bklit's scaled hit target flips), so it stays accepted.
- **Open:** a coarse capture shows ring outer rings lagging ~1 frame and gauge ticks 40–60 ms, against D787's 0–25 ms. Heatmap axes show at ~100 ms while bklit is blank. Sent to fx-rg for rAF measurement.

### D795 — Sunburst on a documented layer renderer; last rule-3 violation gone (fx-S)

- **Change:**
  - `sunburst/sunburst-layer.ts` is a documented `ChartLayerRenderer`, following ring's D761 pattern. It paints the sectors, ghosts, pop overlays and labels from our own partition geometry (`sunburst/geometry.ts`) on bklit's curves.
  - The entrance stays on the D790 render-start clock. Zoom runs 750 ms with short-way unwrap.
  - Hit testing, the hub and keyboard stay native.
  - The private `scene-motion-node` read and SECTOR_MOTION_CSS are deleted. FIXER-RULES now lists no known violations.
- **390 fix found on the way:** bklit draws in a 440-unit viewBox, so text, strokes, padding, pop and the label-fit thresholds scale with width. These now scale via `useResizeBox`. At 390, pixels above 24 went from 8073 to 148; at 440 nothing changes.
- **Evidence (Chrome, rAF samplers on both cards):**
  - Entrance: within ~20 ms at 50% and 90% area.
  - Mid-zoom: area, centroid and gyration track bklit within 1–3 units per frame.
  - Labels: track bklit within a few px and ~10 ms.
  - Zoom-out blip: the 80 ms dip is present in bklit too.
  - Light hover: 97 of 193600 pixels differ.
- **Accepted:** ghost paths unmount at ~700 ms against ~500 ms, after they have collapsed to a point.

### D796 — Ring, gauge and heatmap entrance measured (fx-rg, rAF sampler on :5200)

- **Ring:** a uniform ~24 ms trail on every ring, at 50% and 90% (20–31 ms over 3 runs). This is the D787 clock-start offset (gap #33). The "outer rings lag more" reading came from mismatched ring pairing. No change.
- **Gauge:** 0–8 ms, under one frame. The 40–60 ms figure came from capture timing.
- **Heatmap:** the axes appear 31–43 ms *after* bklit, never before. bklit's axes are static spans; ours mount with the first sized scene. Cells match within 16 ms. Accepted as a mount floor: an unsized mount trial did not help.

### D797 — Hover springs on our own className-addressed groups: ruling (audit 3)

- **Allowed:** querying renderer-painted groups by a className *we* set through the documented `SceneNodeBase.className`, and running WAAPI on them, follows the D793 precedent (gaps #20 and #36: no transform channel in `states`). Sites:
  - kit/polar/polar-dim.ts
  - radar/hover-springs.ts
  - kit/motion/marker-springs.ts
  - ring/ring-springs.ts
- **Not allowed:** parsing a renderer element's `class` attribute back into model data. The read-back in ring/ring-springs.ts (`getAttribute("class")`) moves to the model's row index (fx-C3).
- **Each site cites #20/#36 in its comment.**
- **Audit 3 waves:**
  - A3: a shared svg layer helper for ring and sunburst, plus reduced motion.
  - B3: date-pill reuses text-width; sunburst comments.
  - C3: the ring read-back.
  - D3: Live Perf keyboard and wheel/zoom latency rows.

### D798 — Sunburst layer renderer: independent Chrome QA passes (qv4)

- **Coverage:** light and dark, at the default 440 px card and at ?w=390, on :5200.
- **Pass:** entrance, hover at 3 depths, keyboard, click-zoom and zoom-out all match bklit.
  - At 390 the visible labels are 25 against 25. Three opacity-0 label nodes are extra and invisible.
  - The console is clean.
- **Accepted:**
  - Hovering the exact sector vertex at the hub after zoom-out picks a different sector, a degenerate hit.
  - A leaf sector's cursor resolves to `auto` against bklit's `default`, which is the same arrow.
- **Not captured:** a mid-zoom (~300 ms) frame, though fx-S's rAF samplers cover it (D795).

## D799 — qv5 re-check after the audit-3 merges passes

- **Scope:** shared svg layer helper (ring, sunburst), ring springs without class read-back (D797), date-pill on the shared font context, Live Perf key and wheel/press/drag rows. Chrome, :5200, ~1710 px and ?w=390.
- **Sunburst entrance:** the 80–140 ms lag fx-A3 reported is a measurement artifact (raw area threshold against migrated's residual t0 area). Baseline-subtracted bbox area over equal path sets (56 each) puts migrated 10–40 ms ahead at 5/25/50/75/95%, consistent with D795.
- **Sunburst zoom-out:** the centre hole zooms out one level on both cards. Earlier misses came from capture pixels being page clientY + 73.
- **Ring:** light and dark hover, keyboard and entrance match bklit; track rings trail ~20–30 ms mid-entrance (D796).
- **Date pill at 390 dark:** both show "Sep 26"; bklit's "Sep Oct…" DOM text is its rolling ticker.
- **Live Perf:** the key row populates for migrated on line (n=11; bklit has no focus target); the press row populates for both on sunburst (n=8 each).
- **Gauge, resize-lab:** render, console clean.
- **Not covered:** light-mode sunburst, gauge and resize-lab; 390 px sunburst, ring and gauge; wheel and drag samples for the press row.

## D800 — audit-4 merges; qv6 gap pass passes

- **Audit-4 (no High findings):** fx-B4 single-sources `displayNameOf` (kit/read-children.ts), `TAU` (kit/polar/tau.ts) and funnel `AREA_PATH`, and drops tooltip comment noise. fx-A4 routes the remaining inline class joins through `joinClasses` and host presence writes through a new `writePresence` in kit/host-write.ts (heatmap, composed, choropleth). sankey's builder-time `data-bkm-reversed` write stays. tsc clean, lint 262, knip clean.
- **qv6 (Chrome, :5200):** light-mode sunburst (rest, hover, zoom in, centre zoom-out), gauge and resize-lab match bklit; ?w=390 sunburst, ring and gauge match in light and dark with no clipping; ring keyboard in dark (Tab in, arrows, Tab out clears dim and outline); line in light (hover, date pill, keyboard); Live Perf wheel row on choropleth populates for both (n=4).
- **Shared with bklit, accepted as parity:** in dark mode the radial gauge's filled ticks are near-black on the dark card in both implementations (identical computed fill). Not a migration divergence.
- **Infra:** a fixer's dev server was assigned :5297 and its kill-by-port stopped the tab-booking server; it was restarted, and the fixer and QA briefs now reserve 5297.
- **Pending:** qv7 hover re-check of the fx-A4 sites (heatmap, composed, choropleth, radar, pie, sankey 390, bar).

## D801 — qv7 hover re-check of the fx-A4 sites passes

- **Chrome, :5200, light and dark:** composed (`data-bkm-hover`/`data-bkm-bi` set on hover, cleared on leave), choropleth (`data-hover` while on a feature, `data-bkm-idle` after leave), radar and pie hover highlight, sankey ?w=390 tooltip, bar and pattern-area hover all match bklit.
- **Radar and pie tooltips:** neither showcase demo mounts a tooltip on either side, so the earlier "no tooltip" was the demo, not a regression.
- **Heatmap:** tooltip matches, but the demo passes `inactiveOpacity={1}` `inactiveScale={1}`, so the `data-hm-hover` dim path is unreachable from the showcase; qv8 exercises it on a worktree with the props removed (uncommitted).
- **Sankey:** a hover at a node's exact right edge misses on migrated only; sub-pixel hit-test edge, accepted.
- **Not covered:** bar in dark, bar-depth/bar-squares/pattern-bar, keyboard, fade timing.

## D802 — qv8 heatmap dim path passes

- **Method:** worktree-only demo edit removing `inactiveOpacity={1}` `inactiveScale={1}` (reverted, not committed), Chrome on :5299, rAF opacity sampler.
- **Result:** cell hover, cell-to-cell, legend-level hover and leave match bklit in light and dark (181 or 173 cells dim to 0.3; `data-hm-hover` cell/level set and removed through kit/host-write.ts). Fades are within 15–35 ms of bklit (sampling and handler latency). Keyboard focus dims and clears; bklit has no equivalent.

## D803 — qv9 coverage of remaining cartesian routes

- **Pass (Chrome, :5200, no console errors):** bar dark; bardepth light and dark; barsquares light (and dark hover); patternarea light and dark; area light and dark incl. loading; candlestick dark (light entrance and hover); funnel light entrance and hover. Entrance, hover, leave and keyboard where focusable match bklit; bardepth's mid-entrance lead (≤20 px) fits D795/D799.
- **Open:** barsquares at ?w=390 — bklit overlaps every x label, migrated thins alternate labels and draws a thick bar sliver. fx-B5 traces the cause (native axis vs our code) and fixes or brings evidence for a ruling.
- **Not yet covered:** liveline, scatter, line dark, markers, brush, segment, reference-area, projection, overview (qv10, no drags); ?w=390 on most qv9 routes.

## D804 — bar category labels never collision-thin, as bklit

- **Cause:** the bar category axis left TanStack's default `tickLabels.thin` on (docs concepts/layout-axes-and-coordinates.md; types.ts:393), so the 158 px barsquares plot at ?w=390 dropped alternate labels. bklit bar-x-axis.tsx:91-107 thins only by `maxLabels`. The shared cartesian x-axis already sets `thin: false` (kit/cartesian/x-axis.ts:124).
- **Fix (fx-B5):** `thin: false` on the bar category `tickLabels` (bar/definition.ts), both orientations; `maxLabels`/`showAllLabels` unchanged. Chrome :5299 dark: barsquares and bar at 390 show all six labels like bklit.
- **The 3×3 px squares at 390:** covered by the D689 ruling (bklit's layout is degenerate there; not copied).
- **Owed:** a light and 1710 px look at bar and barsquares.

## D805 — qv10 coverage of the remaining routes passes

- **Pass (Chrome, :5200, no drags):** liveline, scatter, line, markers, brush, segment, reference-area and projection match bklit on entrance, hover sweep, leave and keyboard, across light, dark, default width and ?w=390 (one theme per width per route). overview is an index page and loads clean.
- **D804 follow-up:** bar and barsquares labels identical to bklit in light at default width and 390.
- **Accepted:** markers and barsquares at 390 render bklit's degenerate 158×79 plot; migrated's extra dotted square row there falls under D689. scatter's mid-transition tooltip x offset (11 px) settles to parity.
- **Coverage:** with D794–D805 every showcase route has passed Chrome QA against bklit. Open only: Q4 real-cursor drags (brush, segment, choropleth pan), user-gated.

## D806 — user go for Q4 drags; another audit and QA round

- **User decisions (2026-10-10):** run real-cursor drag QA on brush, segment and choropleth drag-pan; upstream drafts stay local for the user's own review; run one more native/dead-code audit (audit-5) and a full Chrome sweep of every route in both themes at both widths.

## D807 — audit-5 findings and fix waves

- **Result:** nothing High, no rule-1/2/3 violation, no further native composition hand-rolled. Choropleth d3-zoom, `axis.nice`, `axis.viewport`, `@tanstack/charts/legend` and the gapBand wrapper re-checked and kept.
- **M1:** collision `thin` still on for scatter, candlestick, shared y axis, bar value axis; heatmap sets `thin: true`. bklit never thins (D804 class). Wave fx-A5, with the `formatTick` dedupe.
- **M2:** funnel may rebuild its definition a frame after mount at fractional host widths (`clientWidth` vs ResizeObserver). Wave fx-B6, Chrome-confirm first.
- **M3 ruling:** port bklit's LTTB decimation (rows beyond max(64, 1.5 × innerWidth)) for line, area, composed and candlestick, to preserve bklit behaviour; fix the comment claiming native decimation. **M4:** Live Perf React cost shows n/a on production builds. Wave fx-C5.
- **Lows:** helper dedupes, long and stale comments, collector hover-window total, MutationObserver scope, rAF patch restore. Wave fx-D5.

## D808 — qs2 full sweep: pass

- **Scope:** brush, segment, choropleth, funnel, gauge, heatmap, pie, radar, ring, sankey, sunburst, resize-lab and overview, in light/dark at default width and ?w=390, bklit vs migrated via cap.sh pixel diffs. Console clean on every route.
- **Result:** all 52 cells pass. Settled diffs are at most 0.44%; hover diffs are at most 0.5% on desktop. At 390 the heatmap tooltip text sits 0.5–1 px left (up to 1.5%), and segment's second hover is a 1 px shift: sub-pixel, accepted. Sunburst zoom in and centre zoom-out match (mean diff ≤ 0.02).
- **Parity notes:** gauge hover has no effect on either side; sankey at 390 is degenerate on both; `?w=390` doesn't narrow resize-lab or overview.
- **Gaps:** brush keyboard in dark, and sunburst keyboard plus zoom outside light/default, were not run. Both are theme-only or already covered by D794–D805 and are left for the post-fix gap-fill. Entrance frame diffs of 5–15% come from capture timing, not divergence.

## D809 — qs1 sweep and qd1 drag QA

- **qs1** (area, bar, bardepth, barsquares, candlestick, composed, line, liveline, markers, patternarea, reference-area, scatter, projection; light/dark, default and ?w=390): default width passes on every route; console clean.
  - **At 390:**
    - barsquares' dotted square row falls under D689.
    - A 2–4 px tooltip x offset shows on most routes, and area's right-edge tooltip placement fails. Both are being re-measured after the hover settles (qv11), since earlier rulings found mid-transition offsets settle to parity.
    - qv11 also checks the dark strip under the markers row (bklit degenerate plot, D689, or real) and whether bklit's legend-button focus dims its series like migrated's.
- **qd1** (real-cursor drags, user-approved D806): brush select, move, handle resize, reset and linked zoom; segment stats and highlight at every drag step; and choropleth pan, wheel zoom, hover after pan and cursor all match bklit at default width and 390, light and dark.
  - **Open:**
    - Brush drags land at ~0.8× the drag distance on bklit vs ~1.0× on migrated; choropleth pan is 0.8× on both.
    - A capture right after a brush drag showed migrated's linked zoom one beat late.
    - bklit in dark shows a ghost hatch and handle after clear + reselect.
    - Source investigation running for all three.
  - **Live Perf:** the drag row counts 2 migrated drags vs 12 bklit; moved to fx-D5 (collector).
- **Port note:** qs1 left a helper on 127.0.0.1:5301 that collided with fx-C5's :5301 dev server; it was stopped by port. QA helpers must use ports ≥ 5320.

## D810 — fx-B6 merged: fluid width first measure

- **Cause (audit-5 M2, confirmed):** with a fractional host width (forced to `calc(100% - 0.4px)`), the funnel definition built [640, 1086, 1085.59] — rebuilt a frame after mount, against D714. Showcase hosts are integer width (1086, 390), so it never showed there.
- **Fix:** `useFluidWidth` first measures with `getBoundingClientRect().width`, matching the observer's `contentRect.width`; builds are now [640, 1085.59]. The pie, ring, heatmap and funnel hosts have no padding or border, so the two agree. Funnel epsilon 0.01 kept.
- **Owed:** ring and heatmap visual check, funnel 390 entrance; folded into the post-fix gap-fill.

## D811 — brush drag findings (D809 open items)

- **Drag end 0.8× vs 1.0×: not a parity issue.**
  - visx debounces window moves with a 1 ms trailing timeout (`@visx/brush` BaseBrush.js:158, utils.js:70-81). A synthetic mouseup arriving within 1 ms of the last move drops that move (`:93` early return), and BaseBrush commits the stored extent (`:56-85`).
  - d3-brush applies moves synchronously (brush.js:413-431). Neither side reads the mouseup position, so both use the same end rule.
  - A human drag ends at the same place on both, give or take the data-step snap (interaction-brush.js:474-505).
- **Ghost hatch and handle after click-outside, ruling: not copied.** This is a bklit desync, not a theme effect: visx's rect sits at -1 (0×0) while bklit's `pixelExtent` overlays are reset to the full width via `initialSelection` (chart-brush.tsx:165-185, chart-brush-layout.tsx:73-81). Migrated treats a collapsed range as the full extent (use-brush.ts:73-76, kit/brush.tsx:194-202). Copying a bklit bug isn't parity (D689 precedent).
- **Linked zoom motion, real divergence: fix queued.**
  - On a brush `xDomain` change, bklit snaps the x scale, axis and grid (time-series-chart-shell.tsx:284-300). It tweens only the series path (use-animated-series-path.ts:54-65, 111-130) and the y domain (use-animated-y-domains.ts:88), both for 500 ms (chart-phase.ts:25).
  - Migrated applies `UPDATE_MOTION`, a 200 ms ease-in-out, to everything (kit/cartesian/definition.ts:47, 66-80; cartesian-chart.tsx:169).
  - The fix touches the same files as fx-C5, so it goes as fx-E5 after fx-C5 merges.

## D812 — fx-A5 merged: axes never collision-thin

- **Change (audit-5 M1):** `tickLabels.thin: false` on the scatter and candlestick x/y axes, the shared y axis (kit/cartesian/y-axis.ts), the bar value axis and both heatmap axes, each citing bklit's axis file:line (y-axis.tsx:106-142, x-axis.tsx:397-430, heatmap-x-axis.tsx:25-52, heatmap-y-axis.tsx:44-49). heatmap's `thin: true` had no ruling (phase-7 D526 only moved to package axes), and bklit draws every label. `formatTick` is single-sourced in y-axis.ts.
- **Evidence:** a JS DOM probe of every tick label (text, x, y) matches bklit on scatter, candlestick, line, bar and heatmap at default and ?w=390, dark (heatmap 390 light too). Gates are tsc, lint 262 and knip, all clean.
- **Owed:** the bar horizontal demo is unchecked; this goes into the post-fix gap-fill.

## D813 — fx-D5 merged: kit dedupes, comment trims, Live Perf collector

- **Dedupes:** `hasText` (sankey), heatmap `defineCarrier`, `measureNoText` (new kit/polar/measure-no-text.ts) and `sameValue` (kit/guards.ts, `Object.is`) are each single-sourced. Long CSS-module headers are cut to 2 lines, and stale collector comments are rewritten.
- **Collector:**
  - A running total keeps hoverSec, LoAF and long-task sums correct after old hover windows drop.
  - The rAF patch installs with the first collector and is restored with the last, unless something wrapped it since.
  - The MutationObserver is kept: it is identical for both implementations and disconnects at settle. Liveline disconnects after first paint.
- **Drag latency (D809):** migrated drag-select stops propagation of capture-phase pointermove during a press (kit/cartesian/drag-select.ts), so the bubble listener missed drags. A capture-phase card listener now stamps drag latency for both implementations: brush ×3 drags gives n=18 for both, p50 13.1 vs 13.5 ms.
  - **Known residual:** the migrated hover `moves` counter stays low during a press-drag, since drag is not hover. Accepted.
- **Evidence:** settle on line, sunburst and funnel pairs is within 9 ms. Sankey, heatmap, ring, pie and gauge render. tsc, lint 262 and knip are clean.
- **Owed:** a real-cursor hover pass on sankey, heatmap, ring, pie, gauge and funnel, in the post-fix gap-fill.

## D814 — qv11: the qs1 390 flags are artifacts

- **Area right-edge tooltip:** with a 1.5 s hold, bklit and migrated rects are identical at nine pointer x positions in light and dark (e.g. 619/40/154.6/90 at x=786), and flip states match. qs1 captured mid-transition.
- **2–4 px tooltip x offset:** at +250 ms both are mid-transition (bklit width also still moving). By +1.5 s line, scatter, candlestick, composed, patternarea, reference-area, projection and bar are identical. Same as the earlier mid-transition rulings.
- **Markers dark strip at 390:** present on both. It is the 2.5 px series paths flattened in bklit's degenerate 158×79 plot (inner height −1); migrated's extra stems fall under D689.
- **Legend-button focus dim:** bklit's legend rows are not focusable; migrated's are buttons, kept under the existing a11y ruling (LOG ~739, D737).
- **Result:** qs1 passes all 52 cells once settled. D809's 390 items are closed.

## D815 — fx-C5 merged: bklit decimation ported; Live Perf production n/a

- **Line, area, composed (audit-5 M3):**
  - kit/cartesian/decimate.ts ports bklit's LTTB unchanged (decimate-time-series.ts:7-91): max(64, ⌈1.5 × innerWidth⌉) points, over the mean of the series keys, rows by reference. TanStack 1.1 has none; docs/guides/large-data.md leaves sampling to app code.
  - Marks draw the decimated rows, while domains and overlays keep every row. Hover keeps every row via an invisible full-row focus line, matching bklit's use-chart-interaction.ts:81. Dashed tails split on drawn rows.
  - No decimation before the plot is measured, and data identity is unchanged below the threshold, so there is no entrance rebuild (D714).
- **Candlestick: not decimated.** bklit computes `renderData` but draws full `data` (candlestick.tsx:325), so the OHLC port was dropped.
- **Comment fix:** chart-context.tsx no longer claims native decimation.
- **Live Perf (audit-5 M4):** the eight Profiler-fed rows show "n/a (production build)" when `NODE_ENV` is production.
- **Evidence:** 600 rows at ?w=390 give 465 drawn points on both implementations, and hover lands on the same row and value (Oct 15 / 1,504). Showcase data (≤90 rows) is undecimated. Gates: tsc, lint 262, knip clean.
- **Next:** fx-E5 (brush linked-zoom motion, D811) is unblocked.

## D816 — fx-E5 merged: brush linked-zoom motion like bklit

- **Change:** a brushed `xDomain` change is a new "window" update step (use-data-update-step.ts). The chart `motion` function snaps the x axis and x-positioned marks (`false`), and glides line/area paths, the y axis and the grid rows for 500 ms with cubic-bezier(.85,0,.15,1). Non-brush data updates keep their steps. While brushed, paths draw the full decimated series so the point count is constant and the native morph applies.
- **bklit evidence (lead-checked in source):**
  - x-axis.tsx:650 `animatePosition={xDomain == null}` makes the axis snap when brushed.
  - time-series-chart-shell.tsx:303-306 keeps the full series for paths while brushed.
  - line.tsx:246-251 tweens the path with `yDomainTweenDuration`, 500 ms by default, and `LINE_LOADING_PULSE_EASE` [0.85, 0, 0.15, 1] (line-loading-timing.ts:13). The y domain tween uses the same ease (use-animated-y-domains.ts:90).
- **Chrome (migrated, :5303, light and dark):** x labels are final within ~30 ms; the path's first x settles by ~500 ms with slow-start/ease-out; the y grid rows tween over the same window.
  - A bklit frame baseline couldn't be taken: the extension's drag can't drive visx's debounced brush (D811), and a synthetic drag gives per-move previews. The ruling rests on the source citations.
- **Owed:** the brush has no own tab stop on either side; a keyboard pass in dark goes to qg1's follow-up. tsc, lint 262 and knip clean.

## D817 — qg1 post-fix gap-fill

- **Pass:**
  - ring, heatmap and funnel (default and 390, light and dark): hover and leave.
  - sankey, pie and gauge hover (light and dark); gauge hover has no effect on either side.
  - line, area and composed (default and 390, light and dark): hover diffs ≤ 102 px. Per-series path point counts match bklit (no decimation on showcase data).
  - Live Perf React and hover rows populate on the dev server for line and funnel.
  - Sunburst zoom in and centre zoom-out in dark/default, light/390 and dark/390.
- **Brush (D816):**
  - Migrated x labels are final at t0, and the line settles by +600–750 ms.
  - bklit's line read as final at the first probe (~100 ms after the drag). Its per-move previews already tweened during the debounced drag (D811), so this doesn't contradict the source (line.tsx:246-251); kept on the source ruling.
  - The brush strip is a tab stop on neither side; the migrated main chart's keyboard focus (tooltip, crosshair, pill, Tab-out clears) passes.
- **Horizontal bar:** no demo exists, so the value-axis check is moot.
- **Open:**
  - Migrated entrance read 15–20% behind at +500 ms on ring, heatmap and funnel, converging by ~1 s. The probe was a sequential DOM read, so it is being re-measured with a same-frame recorder (qv12).
  - The sunburst keyboard can zoom in (Enter) but not out (no Escape; centre click only), a keyboard trap in our a11y addition. Fixing as fx-F5.

## D818 — qv12: polar entrance lag is a probe artifact; one-frame residual waived

- **Method:** a same-frame rAF recorder sampled both cards from the Re-run click, 3 runs per chart, each normalised to its own settled value.
- **Result:** the 15–20% at +500 ms (D817) was the sequential probe reading the steep part of the ease. The real offset is constant and doesn't grow:

  | Chart | Offset (migrated vs bklit) |
  |---|---|
  | ring | +12–13 ms track scale, +20–28 ms arc sweep |
  | heatmap | +10–35 ms through 50%, ±35 ms at the tail |
  | funnel | +17–19 ms from 25% on, slightly ahead below 10% |

  Live Perf entranceMs: ring +17–28 ms, heatmap +25–28 ms (one run +77), funnel equal or 5–10 ms earlier.
- **Timing sources:** duration, ease, delay and stagger are identical on both sides (ring.tsx:84,92 and animation.ts:7-14 vs ring/entrance-css.ts:11 and enter-transition.ts:14; funnel-chart.tsx:236-243,759 vs funnel/entrance-css.ts:8-31; heatmap-animation.ts:6-27 vs heatmap/motion.ts:15-69).
- **Cause (hypothesis):** bklit starts motion in a useEffect after commit, while migrated starts after the TanStack scene commit, one frame later. fx-B6 can only remove a restart, not delay a start.
- **Waiver:** the ~1 frame (≤ 35 ms) entrance-start residual on ring, heatmap and funnel is below perception and consistent with the existing motion-clock anchoring. Accepted.

## D819 — fx-F5 merged: sunburst Escape zoom-out

- **Change:** Escape within the migrated sunburst host zooms out one level through the hub-click path (zoom.ts), with the same ~760 ms animation, and focus lands on the arc just left. At the root, Escape is not prevented and reaches the page. The hub was already a keyboard stop (Enter/Space).
- **Native path:** TanStack 1.1 has no drill-out. Its Escape handling covers pinned tooltips and cursors, brush cancel and the continuous zoom (renderer.ts:882-887, interaction-brush.ts:440, interaction-zoom.ts:582).
- **Lead change:** dropped the fixer's `closest('[role="img"]')` target check, which keyed on renderer-owned DOM; the host listener scopes it.
- **Scope:** a keyboard addition (bklit's sunburst has no keyboard); pointer behaviour is unchanged.
- **Verified:** fixer Chrome :5304 light and dark, two levels deep. Lead Chrome :5200: Escape is handled when zoomed and passes through at the root.
