# Phase 5 — Canonical Deviation Ledger

> Extracted from `00-nativeness-audit.md`, `01-deviation-native-paths.md`, `04-independent-audit.md`, `05-native-paths-ii.md` (full reads) and `02-visx-removal.md` (skim). Compiled per Phase 5.1.1/5.2.1 prep — does not decide anything; the lead decides.

**Count check:** D1–D17 all appear, sourced from `00-nativeness-audit.md` lines 25–41 (the consolidated table). No renumbering found across `01`/`04`/`05` — those files address D-numbers by cluster (`01` covers D1, D2, D4, D5, D6; `05` covers D7–D17) rather than re-numbering. Exactly 17 entries produced below, one each. No gaps, no overlaps, no invented entries.

---

## Section A — D1–D17 ledger

| D# | Deviation (one line) | Affected files/charts | Proposed native path | Research verdict | Blocked-by |
|---|---|---|---|---|---|
| D1 | Funnel: plain hand-rolled React SVG, full bypass of `<Chart>` | `showcase/migrated/charts/funnel-chart.tsx` | **No migration.** Case `125-sales-funnel` (PR #81, v0.11.0) is composition-only (areaX trapezoids + text, case-local unexported layout math); scene nodes forbid the spring/div-hover affordances bklit needs (01:26). Log case-125 golden SVG as corroboration reference (01:27). | CONFIRMED gap (no funnel mark/series upstream; 0 issues requesting one) — 01:23 | — (accepted-with-log; explicitly out of scope per PLAN-phase-5.md:20) |
| D2 | Heatmap *file wrapper*: pure React tree; internals (`HeatmapCells`) already on-pipeline — hybrid, not zero-TanStack | `showcase/migrated/charts/heatmap-chart.tsx` (wrapper); `internal/heatmap-components.tsx:18–19,192–210` (already hybrid, 04:23) | **Migrate fully** (0%→~90%): emit flat cells → `cell(...)` + dual band scales + chart color scale → `<Chart>`. Binning via `binTimeX/Y`/`binXY`/`binX/Y`; color via `RectOptions.color?: Channel`; stagger via generic `stagger()`; focus via inline `states`/`whenFocused()`. Prior art: `repos/tanstack-charts/examples/sandbox/src/plots.ts` (01:18). | REFUTED for binning/color/stagger/focus-styling (01:12–15); CONFIRMED gap for loading/skeleton, app-owned (01:16) | Re-vendor ≥0.14 (01:5 cross-cutting blocker; 01:81 heatmap rationale explicitly invalid ≥0.14) |
| D3 | Gauge linear orientation: no TanStack container at all — third full bypass | `showcase/migrated/charts/gauge.tsx:10–32` (04:30, admits it in-source) | **Not researched in 01/05.** PLAN-phase-5.md:77 frames it as an open ruling: "FIX (bring under `<Chart>`) or ACCEPT — decide during planning." No native-path spec exists yet for a linear-gauge mark/composition. | Not evaluated (no CONFIRMED/REFUTED verdict recorded) | Lead ruling (PLAN-phase-5.md §5.2.1); see Section D |
| D4 | Animation: WAAPI `.animate()` + custom springs (~100 sites) **plus** dataset-flag/querySelector state machine coupled to renderer internals | ~100 call sites across all charts (00:28); `use-prefers-reduced-motion.ts` + 11 sites (04:15); dataset-flag machine: `hover-chrome.ts:404`, `bar-pulse-mark.ts:221`, `sankey-animation.ts:94–120`, `deferred-reveal.ts:43`, `dash-tail.ts:61` | **Replace with `motion()` renderer** ≥0.14; springs = `{stiffness:170,damping:26,mass:1}` velocity-preserving retarget; defaults match bklit M1b curve (`1100ms`, `cubicBezier(.85,0,.15,1)`, motion.ts:207–210); WAAPI shell stays ONLY for app-owned hover chrome (residue rule, 01:40). Coupling half → `stagger()`+phase filters, state read via `onRender(scene)`/`getScene()` (05:35). | CONFIRMED (motion() SVG-only, Canvas host-driven-not-definition-driven, coverage gaps: legends/app controls, no dataset-crossfade primitive) — 01:33–39; REFUTED for tooltip tweening specifically (01:36, "don't rebuild it") | Re-vendor ≥0.14; sequenced after B4/B5 in batch plan (PLAN-phase-5.md:91, B7) |
| D5 | `@visx/zoom` (choropleth), `@visx/pattern` (heatmap/pie) | Zoom: `choropleth-chart.tsx` L27–29/77/113–121/147/151 (02:45). Pattern: `internal/visx-pattern-bridge.tsx` (only import site); 8 call sites — see Section C | **Remove from migrated code; hand-roll.** Zoom → ~150-line `internal/zoom-matrix.ts` (01:47, full spec 02). Pattern → port ≈130 lines to `internal/pattern-preset.tsx` (already exists per repo listing), delete bridge (01:53). Packages stay installed (bklit-ui source dependency, 02:7). | CONFIRMED gap — interaction package has exactly 5 gestures, none is 2D/geo zoom (01:44); resource registry is linearGradient-only, zero `<pattern>` hits repo-wide (01:51) | — (independent of re-vendor; own removal spec in `02`) |
| D6 | React sibling overlays: axis pills, reference areas, segment dims, marker tooltips | `internal/x-axis-overlay.tsx`, `internal/y-axis-overlay.tsx`, `internal/bar-x-axis-overlay.tsx`, `internal/reference-area-layer.tsx`, `internal/segment-visuals.tsx`, `internal/marker-tooltip.tsx` | Mixed, per-fragment (01:59–68): tick format/values/rotation → `ticks.values`/`tickLabels.*` (native-config); per-value colored tick pills → still custom-mark-in-scene (no fill/background accessor); reference rules/flat bands → `ruleX/ruleY`/ranged `rect`/`areaY` (native-config/in-scene); patterned/faded areas, edge fades, ifOverflow, corner markers → stays-as-overlay (zero repo hits for the upstream equivalents); z-ordering → native-config (declaration order = paint order); marker/hover bands & pill labels → `crosshair`+`focusGuideX/Y` (0.14); tooltip content → extension token (native-config); tooltip chrome beyond body, loading states → stays-as-overlay; label-position tweens → needs motion renderer. | Split — native-config/REFUTED for several fragments (01:59,61,63,64,65); CONFIRMED gap (stays-as-overlay) for others (01:62,66,67) | Re-vendor ≥0.14; tooltip-token piece rides D7/B4 |
| D7 | Tooltip system 100% bypassed: `createRoot` siblings, own rAF scheduler, zero `renderTooltipBody` use | `internal/tooltip-chrome.ts:3,309–352`, `tooltip-scheduler.ts:40`, lib-native `renderer.ts:66–85` (04:9); applies to line/area/bar/scatter/composed/candlestick/live/sankey/heatmap | **Migrate fully (~90% parity).** `tooltip:{use:tooltip, anchor:'group-center', sort:'color-domain', portal}` + `focus:'group-x'`; spring box motion via `motion({transition:{type:'spring'}})` + `tooltip.motion`; delete `createRoot`+rAF scheduler (05:11). | CONFIRMED bypass (04:9); native-capability-claim — extension token `@tanstack/charts/tooltip` exists ≥0.14 (05:11, 01:65) | Re-vendor ≥0.14; own dedicated batch (PLAN-phase-5.md:88, B4 — "highest parity risk") |
| D8 | Raw `pointermove` bisectors replace focus pipeline (composed, live-line, sankey, heatmap) | `composed-chart.tsx:1053,1212`, `live-line-chart.tsx:500`, `sankey-chart.tsx:566`, `internal/heatmap-components.tsx:410` (04:10) | composed/live-line/heatmap → `group-x`/`group-y` + `maxFocusDistance:Infinity`; sankey → painted containment; bit-exact tie-breaks → custom `ChartFocusStrategy{resolve,group,navigation}` (05:12) | CONFIRMED bypass (04:10); native-capability-claim — built-in/custom focus strategies exist (05:12) | Re-vendor ≥0.14 |
| D9 | Polar family: `/focus/disabled` + raw listeners, zero `onFocusChange` | `pie-chart.tsx:54,614`, `ring-chart.tsx:42,722`, `sunburst-chart.tsx:44,703`, `radar-chart.tsx:14,736` (04:11) | Delete `/focus/disabled` + listeners: pie/ring/gauge → default `nearest` over painted arcs; radar/ring-series → `focusGroupAngle`+`onFocusGroupChange`; select → `onSelect`(±`keyedSelection`); sunburst drill → `onSelect`→`rootId` rebuild (05:13) | CONFIRMED opt-out (04:11); native-capability-claim — geometry-backed default nearest + `focusGroupAngle` (PR #90→0.12) (05:7,13) | Polar explicitly gated ≥0.12.0 (05:7); re-vendor ≥0.14 satisfies |
| D10 | Defs/gradients/clips outside scene pipeline (sibling defs hosts, `createElementNS`, `<style>` injection) | `scatter-chart.tsx:402`, `pie-chart.tsx:724`, `gauge.tsx:854`, `bar-pulse-mark.ts:221`, `sankey-animation.ts:94–120`, lib-native `types.ts:335` (04:12) | Sibling defs hosts → declare `spec.gradients:[{id,x1..y2,stops}]` + stable `idPrefix` (05:22); `createElementNS` clipPath in bar-pulse-mark → `{kind:'group', clip:{x,y,w,h}}` / `spec.clip:true` (05:23); sankey `<defs>`+`<style>` keyframes → declarative per-mark `motion:` + container CSS vars (05:24). Escape hatch: `ChartSvgRenderHooks` via `renderChartSvgWithHooks` if needed (05:26). | CONFIRMED (04:12); native-capability-claim — scene gradients/group-clip/declarative motion exist (05:22–24,26) | Re-vendor ≥0.14 |
| D11 | Renderer-DOM scraping/mutation as app state (`dataset.bkmRevealed`, `[data-ts-key]`/`.ts-chart__dot` queries, body-fallback roots) | `line-chart.tsx:643`, `composed-chart.tsx:1221`, `candlestick-chart.tsx:832`, `scatter-chart.tsx:690`, `choropleth-chart.tsx:439,179–200`, `deferred-reveal.ts:43`, `dash-tail.ts:61`, `hover-chrome.ts:404` (04:13) | Dataset flags → replace with `stagger()`+phase filters, state read via `onRender`/`getScene` (05:35); `[data-ts-key]` querySelector → acceptable/documented, but join via `scene.points[].key` (05:36); `.ts-chart__dot` etc. → no alternative contract, keep + pin with tests like upstream does (05:37) | CONFIRMED for dataset-flag machine (04:13, "renderer implementation details, not public API"); native-capability-claim for `data-ts-key`+`svg.ts-chart` = documented public contract, `.ts-chart__marks/__dot/__viewport-*` = internal-but-stable (05:30) | Re-vendor ≥0.14 |
| D12 | Measurement duplicated (custom ResizeObserver hook ×14 vs library fluid sizing) | `use-container-size.ts:31–226`, `adapter-shared.ts:32–45`, all 14 `<Chart>` hosts (04:14) | Delete; host creates its own RO when `width` undefined, rAF-coalesced exact-equality skip; responsive builders `defineChart(({width,height})=>…)`; SSR via `initialWidth`; height via `height`/`aspectRatio` (05:45) | REFUTED — native fluid sizing already exists, custom hook is unnecessary duplication (05:45, verdict label "Delete — replace-with-native") | Re-vendor ≥0.14 (05 header: "All gated on the ≥0.14 re-vendor") |
| D13 | Parallel reduced-motion plumbing (~12 matchMedia sites) | `use-prefers-reduced-motion.ts:4` + 11 call sites (04:15) | Keep-but-consolidate into one shared hook; `respectReducedMotion` covers library transitions only (05:46) | CONFIRMED gap — "no exported reduced-motion signal exists" (05:46) | Re-vendor ≥0.14 (cleanup only, not blocked on new capability) |
| D14 | Imperative replay outside setState→definition (sunburst `playKey` hand-calls `handleRender`; unscoped `getElementById`) | `sunburst-chart.tsx:956–986`, `loading-chrome.tsx:71` (04:16) | Sunburst: remount (React key) or fresh `motion()` instance via `update({renderer})`, or `motion({initial:'always'})` for adopted SVG (05:38). Wipe rect: no loading API exists — redesign via scene coords or keyed extension nodes (05:39). | CONFIRMED (04:16); native-capability-claim for the remount/renderer-swap substitution mechanisms (05:38); CONFIRMED gap for wipe-rect (no loading API, 05:39) | Re-vendor ≥0.14 |
| D15 | Custom legends (library ones unused); hardcoded English `ariaLabel`s; `ariaDescription` unused | `internal/legend.tsx`, `internal/chart-legend.tsx`, `internal/heatmap-legend.tsx`, `internal/profit-loss-legend.tsx`, `line-chart.tsx:1018` (04:17) | Keep-custom (mostly) — library legends: placement top/bottom only, no styling hooks, #95 open since Aug 13 with no movement, no motion (05:55). Adopt `interactiveColorLegend` for series-toggle UI and possibly `colorGradientLegend` for heatmap ramp. `ariaLabel`: thread through props w/ current strings as defaults (quick win); add unused `ariaDescription` plumbing (05:56). | CONFIRMED gap for full legend migration (05:55, styling hooks missing); native-capability-claim for `interactiveColorLegend`/`colorGradientLegend` as partial adoption (05:55) | Upstream issue #95 (open, no movement) blocks full legend parity; ariaLabel/ariaDescription unblocked |
| D16 | Text split-brain: sunburst second SVG + rAF ticker; overlay ticks duplicate scale math | `internal/sunburst-labels.tsx:56`, `sunburst-chart.tsx:447`, `internal/y-axis-overlay.tsx:64` (04:18) | Partial path only: `radialText` mark exists but sunburst exposes no node angles/radii and cross-mark transform graphs are forbidden. Realistic option: custom polar mark running partition inside its own render closure, or file upstream for a sunburst label channel. Keep overlay until then (05:57). | native-capability-claim (partial) — `radialText` mark exists (05:57); CONFIRMED gap for the missing node-angle/radius API that would make it usable | Blocked upstream — no sunburst label channel (PLAN-phase-5.md:20, explicitly out of scope) |
| D17 | Window reach-ins (`innerHeight`, extra resize listener, window pointer-capture drag-select) | `sankey-chart.tsx:203`, `brush-drag.ts:118,342`, `internal/chart-selection.ts:149` (04:19) | `innerHeight` → keep-but-guard (measure once, subscribe once, feed as stable prop); extra resize listener → delete (host owns observation, disconnects on destroy); drag-select → mixed: x-range via `brushX`+`controlledSignal`(+`whenSelected`), lasso/keyed stays app-owned (documented-sanctioned via `focusDisabled`+`pointer:false`), routed through `controlledSignal` anyway (05:47–49) | CONFIRMED (04:19); native-capability-claim for `brushX`/`controlledSignal` covering the x-range case (05:48) | Re-vendor ≥0.14 |

---

## Section B — native-capability claims needing a pin-check

Every claim of the form "upstream now supports X" / "REFUTED because upstream has X" in `01`/`05`, with exact citation and the dependent API/subpath. This is the input list for Phase 5.1.1's drift check (re-verify against the actual pinned version, not `@main` snapshot the research used).

| # | Claim | Citation | Dependent API / subpath |
|---|---|---|---|
| 1 | Binning transforms exist since 0.3.0 | `01:12` | `binTimeX`, `binTimeY`, `binXY`, `binX`, `binY` |
| 2 | Per-mark color channel exists | `01:13` | `RectOptions.color?: Channel` |
| 3 | Generic cell stagger since 0.13 (PR #96) | `01:14` | `stagger()`, `by:'datum'\|'series'`, `roles:'rect'`, `ChartMarkMotionOptions` (needs `motion()` renderer) |
| 4 | Declarative focus styling exists | `01:15` | mark `states`, `when:{focus:'unmatched'}`, `whenFocused()`, `keyedSelection`, `whenSelected` |
| 5 | Tooltip tweening already built-in (don't rebuild) | `01:36` | Built-in HTML tooltip controller (WAAPI + rAF springs) |
| 6 | `motion()` spring defaults are `{stiffness:170, damping:26, mass:1}` | `01:34` | `./spring` → `createChartSpring` |
| 7 | Motion defaults match bklit M1b curve | `01:35` | `motion.ts:207–210` — `1100ms`, `cubicBezier(0.85,0,.15,1)` |
| 8 | Case 90 uses first-party `zoomX` (wraps `d3-zoom@3.0.0` internally, not raw d3-zoom) | `01:46` | `zoomX` (interaction package) |
| 9 | `url(#id)` passthrough on SVG renderer verified verbatim, undocumented | `01:52`, `02:53` | `svg-resources.ts:16–22`; forensics: byte-identical since init commit through v0.7 consolidation |
| 10 | Tick format/values/rotation/hiding covered natively | `01:59` | `ticks.values`, `tickLabels.*` |
| 11 | Reference rules / flat bands covered natively | `01:61` | `ruleX`/`ruleY` (null-skipping legal), ranged `rect`/`areaY` |
| 12 | Z-ordering has no *arbitrary* z-index but is declaration-order deterministic | `01:63` | fixed groups grid→marks→axes→legend; focus-guide `placement:'under'\|'over'` |
| 13 | Marker/hover bands & pill labels covered by 0.14 marks | `01:64` | `crosshair` (rules, categorical bands, halo labels, intersection marker), `focusGuideX/Y` (rule+marker+pill, boxStyle/radius/padding) |
| 14 | Tooltip content is native-config via extension token | `01:65` | `@tanstack/charts/tooltip` token; `items`/`sort`/`anchor`/`placement`/`content`/`format`/`sticky`/`visibility:'pinned'`; `renderTooltipBody` |
| 15 | Label-position tweens need the motion renderer (else "inert policy") | `01:68` | `motion()` renderer |
| 16 | Tooltip extension token + motion renderer sketch (anchor/sort/portal/focus) | `05:11` | `tooltip:{use:tooltip,...}`, `focus:'group-x'`, `motion({transition:{type:'spring'}})`, `tooltip.motion` |
| 17 | Built-in/custom focus strategies (`group-x`/`group-y`, `maxFocusDistance`) | `05:12` | `/focus` strategies, `ChartFocusStrategy{resolve,group,navigation}` |
| 18 | Geometry-backed default nearest + `focusGroupAngle` (PR #90→0.12) | `05:13` | `onFocusGroupChange`, `focusGroupAngle` from `/polar`, `onSelect(ChartPoint)`, `keyedSelection` |
| 19 | Cross-chart linked cursors via shared controller | `05:15` | `createChartCursor`+`cursorHost` |
| 20 | Scene-level gradients replace sibling defs hosts | `05:22` | `spec.gradients:[{id,x1..y2,stops}]`, `idPrefix` on `<Chart>` |
| 21 | Group-level clip replaces manual `createElementNS` clipPath | `05:23` | `{kind:'group', clip:{x,y,w,h}}`, `spec.clip:true` |
| 22 | Sankey keyframes replaceable by declarative per-mark motion (native precedent) | `05:24` | `motion:` on marks; upstream precedent `network-sankey.ts:234` |
| 23 | Escape hatch for paint-resource injection exists if needed | `05:26` | `ChartSvgRenderHooks{renderDefinitions?, renderGroup?, resolvePaint?}` via `renderChartSvgWithHooks` (charts-core-d3 subpackage, not re-exported by main index) |
| 24 | `data-ts-key` + root `svg.ts-chart` are documented public contract; `.ts-chart__*` classes internal-but-stable | `05:30` | DOM contract pinned by charts-core's own unit tests |
| 25 | `onRender` refires only after actual render; same-definition same-size update is a documented no-op | `05:31` | `onRender(context{container,svg,scene,interaction})` |
| 26 | Fluid sizing exists natively (host owns its own RO when `width` undefined) | `05:45` | responsive builders `defineChart(({width,height})=>…)`, `initialWidth` (SSR), `height`/`aspectRatio` props |
| 27 | x-range drag-select maps to `brushX`+`controlledSignal` | `05:48` | `brushX`, `controlledSignal`, `whenSelected` |
| 28 | `interactiveColorLegend`/`colorGradientLegend` exist as partial legend adoption | `05:55` | `interactiveColorLegend` (aria-pressed buttons), `colorGradientLegend` |
| 29 | `radialText` mark exists (but insufficient alone for sunburst) | `05:57` | `radialText` mark; missing: node angle/radius exposure, cross-mark transform graphs |
| 30 | `layoutLabels(context)` participates in margin calc for tick-pill custom marks | `05:58` | `layoutLabels(context)` |

Also flagged in `01`'s own corrections log (`01:72–81`) as prior corrections worth re-verifying against the actual pin: PR #81 refusal was structural not explicit; case 90 zoomX vs raw d3-zoom; spring damping is 26 not 18; tooltip motion already upstream; Canvas motion is host-driven-rAF not definition-driven; `url(#id)` passthrough is SVG-hosts-only (Canvas nulls); "no z-index" corrected to "no *arbitrary* z-index"; heatmap's original "lacks binning/color/focus" rationale is invalid ≥0.14.

---

## Section C — visx removal stages (from `02-visx-removal.md`)

**Constraint (02:7):** `@visx/*` packages must stay installed at the workspace level — vendored `repos/bklit-ui/packages/ui` imports both directly and compiles as source into host apps via `transpilePackages`. Scope is removal from **migrated code only**; uninstall is deferred to legacy-bklit sunset.

### Stage 1 — Pattern removal (`@visx/pattern`)

- **Import site:** `internal/visx-pattern-bridge.tsx` (17 lines: `PatternCircles`, `PatternLines`) — the only `@visx/pattern` import in migrated code (02:11).
- **Definitions:** `internal/pattern-preset.tsx` (179 LOC; presets none/dots/circles/diagonal/horizontal/vertical/cross/accent; default color `var(--chart-1)`).
- **Call sites (8):** `background.tsx:56` · `reference-area-layer.tsx:201` · `brush-chrome.tsx:141` · `heatmap-components.tsx:253` + `heatmap-legend.tsx:50` (phase-offset aliasing) · `area-chart.tsx:288` · `bar-chart.tsx:1061` (gradient-stroked pattern) · `candlestick-chart.tsx:1036/1041`.
- **Type-only consumers (no change needed):** `reference-area.tsx`, `internal/types.ts`, `bar-squares-mark.ts`, `heatmap-colors.ts`, `internal/index.ts:166`. Funnel/pie/gauge already visx-free (displayName sniffing).
- **Path:** inline plain `<pattern>` JSX per preset shape; consumers untouched.
- **Guards required (02:20–23):** (1) inject defs INSIDE chart SVG via public `renderSvg` prop (closes canvas/export hole — canvas.ts:840–851 nulls unknown `url(#id)`; `renderChartImage` only rasterizes `svg.ts-chart` subtree); (2) dev-mode assertion every pattern id renders, degrade to solid fill off-SVG; (3) static grep test for `url(#` against central registry.

### Stage 2 — Zoom removal (`@visx/zoom`, choropleth only)

- **Parity baseline** (bklit source, `repos/bklit-ui/.../choropleth-chart.tsx:437–451`): visx `<Zoom>` 4.0.1-alpha.0, binary ±5% wheelDelta, scale extent [0.5,4], `touchAction:'none'`, CSS transition idle-only, no keyboard/dblclick/rotation/inertia; delegates to `@use-gesture/react@10.3.1`.
- **Replacement (~140 LOC core, ~190 w/ optionals):** matrix core (required) · wheel bklit-exact (required) · drag pan (required) · pinch continuous centroid-anchored (required, upgrade over ±10% steps — log as justified deviation) · pointer add/remove mid-gesture (required) · gesture enders: pointercancel/lostpointercapture/blur (required) · touch-action none (required) · double-click zoom (optional) · keyboard + zoom buttons (optional, WCAG fast-follow).
- **Type-surface swap:** `choropleth-chart.tsx` L27–29 imports, `initialZoom?` prop (L77), re-export (L147), `DEFAULT_INITIAL_ZOOM` (L151), `ChoroplethZoomContextValue`+hook (L113–121), barrel `index.ts:184–192`. Downstream compat (bench `ZoomQaBridge`, qa/api-compat) verified against structural local type. Build config: prune `bench/app/vite.config.ts:89–91` + `tsconfig.json:344–352` visx aliases.
- **Precedent:** archived phase-1/2 manual matrix engine, `archive/*/migrated/charts/choropleth-chart.tsx:245–262`.

### Gate map (02:58–75)

Known pre-existing baseline failures (post-removal diffs compare **against these**, not against zero): **heatmap FAIL** (hover ≈0.506–0.583%) · **pie FAIL** (hover ≈3.18%) · **choropleth FAIL** (hover-30 1.53%, tooltip absent). area/bar/candlestick PASS.

| Gate | Command |
|---|---|
| Direct pattern gate (8 preset captures) | `pnpm qa -- --chart patternarea --n 1000` |
| Area | `pnpm qa -- --chart area --n 1000` |
| Reference-area | `pnpm qa -- --chart refarea --n 1000` |
| Brush | `pnpm qa -- --chart brush --n 1000` |
| Candlestick + profit/loss | `pnpm qa -- --charts candlestick,profitloss --n 1000` |
| Bar family (D238a density rule) | `pnpm qa -- --charts bar,barsquares,bardepth --n 100` |
| Heatmap (vs baseline FAIL) | `pnpm qa -- --chart heatmap --n 52` |
| Choropleth (vs baseline hover-30 FAIL) | `pnpm qa -- --chart choropleth --n 1000` |
| Zoom-state | MANUAL — no automated gate consumes `__benchZoomTo`; G2 has no tanstack-zoom leg per D34. Scripted screenshots at named states, bklit vs migrated. |
| Bench smoke | `pnpm bench -- --chart area --impl migrated --n 1000` + `--chart bar --impl migrated --n 100`; skip pie/heatmap/candlestick bench until Wave-1 fixes land |
| Console errors | `node qa/console-errors.mjs` (one pass) |
| Skip list | pie/ring/radar/gauge*/funnel*/sunburst/scatter/composed/liveline/legend — no pattern/zoom exposure (re-grep `Background` `pattern` prop before finalizing) |

**Stage count: 2** (pattern removal, zoom removal), plus a shared upstream-stability ruling (build on undocumented `url(#id)` SVG passthrough now, with guards + `renderSvg` fallback + a drafted feature request — 02:50–57) that isn't itself a removal stage but gates both.

---

## Section D — the five rulings pending (per PLAN-phase-5.md §5.2.1)

No decisions made here — summary of what the research says plus the evidence bearing on each, for the lead to rule on.

> **RULING STATUS (lead, 2026-08-26): 3 of 5 decided.** Funnel -> **D364** (no-migration stands). Pinch -> **D365** (continuous centroid-anchored, logged as a justified deviation). Gauge-linear -> **D363** (**FIX**), on the back of the research gap being filled by `08-gauge-linear.md`. Passthrough -> **D366** (**SPLIT** — settled by the lead directly from the shipped docs: gradients are a documented contract needing no guards, patterns are provably outside the declared-resource system and keep every guard). Heatmap -> **D368** (**MIGRATE, SPLIT** — all four capabilities CONFIRMED at 0.15.0, but the re-scope is split so the paint half gates before the geometry half, because heatmap has only 0.0723% headroom). **All five rulings are logged; 5.2.1 is complete.**

### Funnel — **RULED: D364, no-migration stands**
- **What research says:** No funnel mark/series exists on latest upstream `main`; catalog `llms.txt` enumerates every family with zero hits under `packages/*/src`; 0 of 17 repo issues request one; Discussions disabled (01:23). PR #81 (merged 2026-08-11, v0.11.0) added conformance case `125-sales-funnel`, but it's composition-only (areaX trapezoids over synthetic linear domain + text labels, axes off), with case-local unexported layout math (01:24). No explicit "refusal" statement anywhere exists upstream — the original claim of a stated refusal is corrected to "structural, not explicit" (01:25, 01:74).
- **Evidence for keeping current approach:** Migrating to the native path would lose bklit's spring reveal + div-hover affordances — scene nodes are limited to `group|rule|polyline|area|dot|rect|label`, described upstream as "deterministic and DOM-free"; springs need the motion renderer, which case 125 doesn't use (01:26).
- **PLAN framing:** Already listed as explicitly out of scope ("no-migration stands; PR #81/case-125 recorded as corroboration," PLAN-phase-5.md:74, :20).

### Pinch — **RULED: D365, continuous centroid-anchored (justified deviation)**
- **What research says:** bklit's existing behavior (visx/`@use-gesture`) is quantized ±10%/event at gesture origin (02:27). The proposed replacement is continuous, `k·sqrt(distRatio)` with live-centroid anchoring, using the same re-invert-anchor-each-frame formula as d3-zoom — described in the spec as "smoothness upgrade over ±10% steps (log as justified deviation)" (02:36).
- **Evidence:** This is flagged REQUIRED in the gesture table (02:36) as part of the hand-rolled `internal/zoom-matrix.ts` replacement for `@visx/zoom`, not contingent on any upstream capability — it's an implementation choice within the from-scratch zoom-matrix module.
- **PLAN framing:** "Continuous centroid-anchored replaces visx ±10% steps (justified smoothness deviation)" (PLAN-phase-5.md:75) — framed as a ruling to log, not re-derive.

### Passthrough — **RULED: D366, SPLIT (gradients documented/no guards; patterns keep all guards)**
- **What research says:** The SVG renderer's `url(#id)` passthrough (`svg-resources.ts:16–22`) is verified verbatim and undocumented; forensics show it's been byte-identical since the init commit (Jul 28) through the v0.7 consolidation — "intent, not accident" — and zero upstream tests pin foreign passthrough, so it's "deletable silently with green CI" from upstream's side (02:53). Canvas renderer nulls unknown ids silently (invisible fills) — a real risk if patterns/gradients ever hit a canvas surface (02:17, 01:52). A sanctioned escape hatch exists regardless: the `renderSvg` prop / `createSvgChartRenderer` / custom-renderer boundary (02:54).
- **Evidence for building on it now:** Precedent — Observable Plot documents foreign refs officially, visx treats it first-class ("Definition Caveat" section), Recharts documents a `<defs><pattern>` workflow, and TanStack's own case-84 recharts reference renders a real stripe pattern (02:55).
- **PLAN framing:** "Build on undocumented url(#id) SVG passthrough WITH guards (registry test + renderSvg fallback + solid-fill degradation)" (PLAN-phase-5.md:76) — matches 02's own ruling (02:56): build on passthrough now + guards + ready `renderSvg` fallback + file a feature request (drafted, not yet filed — 5.1.2 requires user approval).

### Gauge-linear — **RULED: D363, FIX (bring under `<Chart>`)**
- **What research says:** Almost nothing directly — `04:30` is the only substantive finding: "plain hand-rolled `<svg>`, NO TanStack container (gauge.tsx:10–32 admits it). Arc variant is on-pipeline" — i.e., only the linear orientation bypasses, the arc/radial gauge does not. Neither `01` nor `05` proposes a native path for it; it isn't covered by any of the six 01 clusters or the five 05 clusters.
- **Evidence:** None of the overlay-chrome or paint-resource native paths in `01`/`05` obviously covers a full container bypass (as opposed to an in-pipeline chrome deviation) — this looks like a genuine research gap, not a considered "stays custom" ruling.
- **PLAN framing:** Explicitly still open — "FIX (bring under `<Chart>`) or ACCEPT — decide during planning" (PLAN-phase-5.md:77). No research currently supports either branch with a concrete implementation sketch; the lead ruling here is effectively unblocked-but-unresearched, not evidence-backed like the other four.

### Heatmap — **RULED: D368, MIGRATE but SPLIT (paint-half gates before geometry-half)**
- **What research says:** This is the single biggest confirmed win in the whole ledger. Every one of the original "no TanStack equivalent" claims for heatmap is REFUTED against ≥0.14: binning (`binTimeX/Y`, `binXY`, `binX/Y` since 0.3.0), per-mark color channel (`RectOptions.color?: Channel`), cell stagger (`stagger()` since 0.13/PR #96, generic), and declarative focus styling (inline `states`, `whenFocused()`, `keyedSelection`) — only loading/skeleton stays CONFIRMED app-owned (01:9–16). The file-level "0% TanStack" framing was independently found overstated in `04`: the exported `HeatmapCells` already runs the full pipeline (`defineChart`+`cell`+`<Chart>`, `heatmap-components.tsx:18–19,192–210`) — the family is hybrid, not zero-TanStack (04:23).
- **Evidence:** Prior art exists in-repo (`repos/tanstack-charts/examples/sandbox/src/plots.ts`: `createHeatmapChart`, `createTriageChart`) and in the official catalog (`heatmap-labeled`, `24-quantitative-binned-heatmap`, `25-calendar-heatmap`, `118-token-usage-calendar`) (01:18). Bonus marks available if wanted: `hexbin`, `contour`, `densityContour`, `mosaicX/Y`, `waffle`, `colorGradientLegend` (01:19).
- **PLAN framing:** "File-wrapper re-scope onto native binning/color/stagger post-upgrade" (PLAN-phase-5.md:78) — matches 01's explicit correction #8: "Heatmap rationale ('upstream lacks binning/color/focus') invalid ≥0.14 → heatmap re-scope mandatory post-revendor" (01:81).

---

## Section D addendum — lead corrections to the evidence above (2026-08-26)

- **Gauge-linear's "genuine research gap" is closed.** `research/phase-5/08-gauge-linear.md` now
  specifies both branches. The decisive fact was not in any research file: the scene-node union
  (`dist/types.d.ts`) has **no `path` kind**, so "emit bklit's Bezier notch geometry" had to be
  proven rather than assumed. It is proven — `polyline` and `area` nodes both carry an optional
  `path?: string` which `dist/svg-renderer.js:43` renders as `<path d>`, and **arc's shipped
  custom mark in the very same file already does exactly this** (`gauge.tsx:598-671`, emitting
  `kind:"polyline"` with `path: createNotchPath(...)`). Stock `rect` is disqualified: its
  `radius` renders as SVG `rx` (`svg-renderer.js:56`), a circular corner that cannot reproduce
  the Bezier fillet the frozen scenario requests at `notchCornerRadius={3}` on both legs.

- **Heatmap's prior art got *stronger*, not staler.** The Section-D citation points at
  `repos/tanstack-charts/examples/sandbox/src/plots.ts`, which lives in the old root clone that
  Phase 5.0.1 stopped resolving. Checked: the file still exists on disk in both the root clone
  and the archive, **and** the published 0.15.0 package ships first-party
  `docs/examples/heatmaps-and-densities.md` and `docs/reference/marks/bar-and-rect.md`. The
  ruling should cite the shipped docs, not the clone path.

- **Heatmap carries the second-tightest gate headroom in the project** (worst cell 0.4277 vs the
  0.5 gate = **0.0723**, see `docs/phase-5/GATE-MAP.md`). The re-scope changes binning, colour
  AND stagger at once. Splitting it is under consideration for exactly this reason; the ruling
  will say so explicitly.
