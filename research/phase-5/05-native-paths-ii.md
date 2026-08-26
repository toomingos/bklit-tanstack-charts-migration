# Phase 5 / 05 — Native Paths II (audit-driven clusters)

> Solutions for deviations D7–D17 found by the independent audit (`04`). Verified vs `@main` (pushed 2026-08-20) / npm 0.14.0 via web + gh CLI, Aug 2026. All gated on the ≥0.14 re-vendor.

## A. Interaction & tooltips (D7, D8, D9)

**Verdict: migrate-fully (~90% parity), polar gated on ≥0.12.0.**

| Bypass | Native replacement | Sketch | Parity loss |
|---|---|---|---|
| D7 tooltip siblings | Tooltip extension token + motion renderer | `tooltip:{use:tooltip, anchor:'group-center', sort:'color-domain', portal}` + `focus:'group-x'`; rows/pills via native grouped rows or `content`/`renderTooltipBody` for pixel-parity; spring box motion = `motion({transition:{type:'spring'}})` + `tooltip.motion`; delete createRoot+rAF scheduler | Leader lines; chrome outside positioned box; interactive transient bodies (pin-gated only) |
| D8 bisectors | Built-in/custom focus strategies | composed/live-line/heatmap → `group-x`/`group-y` + `maxFocusDistance:Infinity`; sankey → painted containment; bit-exact tie-breaks → custom `ChartFocusStrategy{resolve,group,navigation}` (owns containment; keyboard nav mandatory) | Custom strategy loses host two-stage painted-containment pass |
| D9 polar opt-out | Geometry-backed default nearest + `focusGroupAngle` (PR #90→0.12) | Delete `/focus/disabled` + listeners: pie/ring/gauge → default `nearest` over painted arcs (donut holes handled — sectors attach sampled boundary to interaction point); radar/ring-series → `focusGroupAngle`+`onFocusGroupChange`; select→`onSelect`(±`keyedSelection`); sunburst drill→`onSelect`→`rootId` rebuild | Low-to-positive: geometry hit-testing more faithful than centroid bisectors |

Bonus deletions unlocked: hand-drawn hover-chrome DOM (rules/bands/axis pills/markers) covered by `crosshair` (rules, categorical bands w/ inset/radius, halo labels, intersection marker) + `focusGuideX/Y` (datum-bound rule+marker+label boxes, motion-preserving keys). Cross-chart linked cursors → `createChartCursor`+`cursorHost` shared controller (kills our rAF sync loop). Remaining gaps: leader lines only.
Key APIs: `onFocusChange/onFocusGroupChange/onSelect(ChartPoint)` · strategies from `/focus`, `focusGroupAngle` from `/polar` · `sticky` click-pin, `visibility:'pinned'` · body inert while transient.

## B. Paint resources & defs (D10)

| Workaround | Verdict | Path |
|---|---|---|
| Sibling 0×0 defs svg hosts (scatter/pie/gauge) | **migrate-to-scene-gradients** | Declare `spec.gradients:[{id,x1..y2,stops}]`, paint `fill:'url(#id)'`, pass stable document-unique `idPrefix` to `<Chart>`; delete hosts. Rewrite requires exact url(#id) form + declared id; distinct idPrefix per mount; SSR-safe; Canvas consumes too |
| createElementNS `<clipPath>` in bar pulse mark | **migrate-to-scene-group-clip** | Emit `{kind:'group', clip:{x,y,w,h}, children}` — renderer generates scoped clipPath+attr (id = FNV-1a of group.key); plain plot-edge clipping → just `spec.clip:true`. Manual DOM bypasses reconciler keying + motion clip handling |
| sankey `<defs>`+`<style>` keyframes | **migrate** | Keyframes → declarative per-mark `motion:` (native sankey wires composite children this way, network-sankey.ts:234); styling via container CSS vars/classes (`--ts-chart-*`, node className renders class attr). `<style>` injection never copied by serializeChartSvg → lost in exports either way |

Sanctioned injection hook if needed: public-typed `ChartSvgRenderHooks{renderDefinitions?, renderGroup?, resolvePaint?}` via `renderChartSvgWithHooks` (charts-core-d3 subpackage; not re-exported by main index).

## C. Renderer coupling & replay (D11, D14)

Stability facts: `data-ts-key` + root `svg.ts-chart` = **documented public contract**; `.ts-chart__marks/__dot/__viewport-*` classes = internal-but-stable (pinned only by charts-core's own unit tests — mirror that pattern with our own pinning tests).
`onRender(context{container,svg,scene,interaction})` documented; refires only after actual render — same-definition same-size update is a no-op by design ("definition identity is the application update boundary"). Keyed-compatible external DOM edits survive reconcile; others get clobbered.

| Coupling | Ruling |
|---|---|
| Dataset flags on marks groups | **Replace**: reveal/stagger is definition-level — `stagger(...)` + phase filters + roles; state lives in renderer; read progress via onRender(scene)/getScene(). Upstream examples never annotate mark groups |
| querySelector `[data-ts-key]` | Acceptable (documented) — but join via `scene.points[].key` rather than sibling/class assumptions |
| `.ts-chart__dot` etc. | No alternative contract — keep + **pin with tests** like upstream does |
| Sunburst playKey hand-called render | **Replace**: remount (React key) or fresh `motion()` instance via `update({renderer})` (renderer identity forces re-render), or `motion({initial:'always'})` for adopted SVG. Mid-flight cancel sanctioned implicitly |
| Global getElementById wipe rect | **Redesign**: no loading API exists; global ids violate idPrefix scoping. Position app overlays from scene coords or emit keyed extension nodes (inherit reconcile/animation) |

## D. Sizing / reduced-motion / window reach-ins (D12, D13, D17)

| Item | Ruling | Detail |
|---|---|---|
| use-container-size ×14 | **Delete — replace-with-native** | Host creates own RO when `width` undefined; rAF-coalesced, exact-equality skip (no debounce/epsilon — settled geometry identical, ≤10ms latency delta invisible to QA). Size-dependent specs → responsive builders `defineChart(({width,height})=>…)`; SSR → `initialWidth`; height via `height`/`aspectRatio` props |
| matchMedia ×12 | **Keep-but-consolidate** | No exported reduced-motion signal exists; `respectReducedMotion` covers library transitions only. Centralize into one shared hook |
| window.innerHeight (sankey) | Keep-but-guard | Measure once + subscribe once, feed as prop so definition identity stays stable |
| Drag-select (chart-selection) | Mixed | x-range → `brushX`+`controlledSignal` (+`whenSelected` paint); lasso/keyed → app-owned gesture is documented-sanctioned (`focusDisabled`+`pointer:false`) — route through controlledSignal anyway |
| Extra window resize listener | **Delete** | Host owns observation, disconnects on destroy |

## E. Legends / a11y / text (D15, D16)

| Item | Ruling | Detail |
|---|---|---|
| Legend systems ×4 | **Keep-custom (mostly)** | Library legends: placement top/bottom only, no styling hooks (#95 open since Aug 13, no movement), no motion; ours have multi-column + hover chrome. Adopt `interactiveColorLegend` for series toggle UI (native aria-pressed buttons free) and possibly `colorGradientLegend` for simplest heatmap ramp |
| Hardcoded English ariaLabels | **Quick win** | Not an API gap (no per-node label APIs exist — text groups even emitted aria-hidden); thread `ariaLabel` through props w/ current strings as defaults; add `ariaDescription` plumbing (used 0× today) |
| Sunburst second-SVG labels | **Partial path only** | `radialText` mark exists BUT sunburst exposes no node angles/radii and cross-mark transform graphs are forbidden. Realistic: custom polar mark running partition inside its own render closure → SceneLabel output + motion role 'text'; else file upstream for a sunburst label channel. Keep overlay until then |
| Tick pills | Unchanged ruling | tickLabels still {rotate, thin} only; rect+text custom marks remain the route — now with documented `layoutLabels(context)` margin participation. Note: no collision/thinning for dense text marks (explicit placement owns collisions) |

## Roll-up

| Cluster | Migrate | Partial/Keep-guard | Blocked |
|---|---|---|---|
| Interaction/tooltips | D7 D8 D9 (+most hover-chrome DOM) | custom-strategy edge cases | leader lines |
| Paint resources | all three workarounds | — | pattern fills (see `01` §#5, `02`) |
| Coupling/replay | dataset flags, replay, wipe rects | `[data-ts-key]` joins, class pins | loading states (app-owned) |
| Sizing/window | RO hooks, resize listener, drag-select ranges | matchMedia, innerHeight, lasso | — |
| Legends/a11y/text | aria strings, toggles | legends, sunburst labels | tick pills (custom marks), #95 upstream |
