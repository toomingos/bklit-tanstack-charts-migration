# sankey — Phase 4 Research Report

**Files:** `showcase/migrated/charts/sankey-chart.tsx`, `showcase/migrated/charts/internal/sankey-animation.ts`, `showcase/migrated/charts/internal/sankey-hover-chrome.ts`, `showcase/migrated/charts/internal/sankey-layout.ts`, `showcase/migrated/charts/internal/sankey-mark.ts`
**Legacy source(s):** `repos/bklit-ui/packages/ui/src/charts/sankey/sankey-chart.tsx`, `repos/bklit-ui/packages/ui/src/charts/sankey/sankey-context.tsx`, `repos/bklit-ui/packages/ui/src/charts/sankey/sankey-link.tsx`, `repos/bklit-ui/packages/ui/src/charts/sankey/sankey-node.tsx`, `repos/bklit-ui/packages/ui/src/charts/sankey/sankey-tooltip.tsx`, `repos/bklit-ui/packages/ui/src/charts/sankey/index.ts`

## Feature summary

Flow diagram: d3-sankey layout (center-aligned nodes, cubic-Bézier links whose stroke width IS the flow value) rendered as ONE positionless TanStack mark (links + nodes + native scene labels). Staggered WAAPI enter reveal (nodes scaleY, links dash-draw via `pathLength="1"`), connectivity-based hover dimming with imperative DOM writes + cursor-following light-DOM tooltip. Composition API (`SankeyNode`/`SankeyLink`/`SankeyTooltip` children) preserved as null-rendering config carriers.

## Public API

Legacy public surface = `sankey/index.ts` barrel exports (+ per-file default exports). Migrated surface = `charts/index.ts` sankey block (all from `sankey-chart.tsx`).

| Prop/Export | Type | Legacy parity | Notes |
|---|---|---|---|
| `SankeyChart` | component | same | TanStack-native rewrite; `defineChart` + single mark |
| `SankeyChartProps.data` | `SankeyData` | same | defensively cloned before d3-sankey (both sides) |
| `SankeyChartProps.margin` | `Partial<Margin>?` | same | default `{top:40,right:180,bottom:40,left:180}` |
| `SankeyChartProps.animationDuration` | `number?` = 1100 | same | |
| `SankeyChartProps.enterTransition` | `SankeyEnterTransition?` | renamed | motion/react `Transition` → `{type,duration(s),ease,bounce,stiffness,damping,mass}`; same fallback timing |
| `SankeyChartProps.revealSignature` | `string?` = "" | same | replay trigger |
| `SankeyChartProps.aspectRatio` | `string?` = "2 / 1" | same | parsed to numeric for TanStack `Chart` |
| `SankeyChartProps.nodeWidth` | `number?` = 16 | same | |
| `SankeyChartProps.nodePadding` | `number?` = 24 | same | |
| `SankeyChartProps.className` | `string?` = "" | same | |
| `SankeyChartProps.children` | `ReactNode` | same | config-carrier extraction by `displayName` |
| `SankeyChartProps.hoveredNodeIndex` | `number \| null?` | missing | controlled node hover (e.g. ChartLegend) not migrated |
| `SankeyChartProps.onNodeHoverChange` | `(i: number \| null) => void?` | missing | see above |
| `SankeyLink` | component | same | now null-rendering config carrier |
| `SankeyLinkProps.stroke` | `string?` | same | overrides gradient |
| `SankeyLinkProps.strokeOpacity` | `number?` = 0.5 | same | |
| `SankeyLinkProps.fadedOpacity` | `number?` = 0.1 | same | |
| `SankeyLinkProps.useGradient` | `boolean?` = true | same | forced off when `stroke` set (both sides) |
| `SankeyLinkProps.getNodeColor` | `(node,i)=>string?` | missing | gradient colors now come from `SankeyNodeProps.getNodeColor`/default palette only |
| `SankeyLinkProps.getLinkColor` | `(link,i)=>string?` | missing | solid-color override not migrated |
| `SankeyLinkProps.patterns` | `ReactNode?` | missing | visx pattern defs passthrough not migrated |
| `SankeyLinkProps.getLinkPattern` | `(link,i)=>string?` | missing | pattern-url override not migrated |
| `SankeyNode` | component | same | null-rendering config carrier |
| `SankeyNodeProps.fill` | `string?` | same | |
| `SankeyNodeProps.lineCap` | `number?` = 4 | same | node rect corner radius |
| `SankeyNodeProps.fadedOpacity` | `number?` = 0.4 | same | |
| `SankeyNodeProps.showLabels` | `boolean?` = true | same | |
| `SankeyNodeProps.showValueLabels` | `boolean?` = true | same | |
| `SankeyNodeProps.labelOrientation` | `"horizontal"\|"vertical"?` | same | PROP same but DEFAULT flipped: legacy `"horizontal"` → migrated `"vertical"` (see Deviations) |
| `SankeyNodeProps.getNodeColor` | `(node,i)=>string?` | same | |
| `SankeyTooltipProps.formatValue` | `(v:number)=>string?` | same | default `intFmt` |
| `SankeyTooltipProps.className` | `string?` | same | |
| `SankeyTooltipProps.nodeContent` | render fn | missing | custom node tooltip renderer not migrated |
| `SankeyTooltipProps.linkContent` | render fn | missing | custom link tooltip renderer not migrated |
| `SankeyData` | type | same | |
| `SankeyNodeDatum` | type | same | `category?: "source"\|"landing"\|"outcome"` identical |
| `SankeyLinkDatum` | type | same | |
| `Margin` | type | same | |
| `SankeyLabelOrientation` | type | same | |
| `SankeyEnterTransition` | type | extra | migrated-only reshaped enter-transition type |
| `SankeyProvider` | component | missing | context eliminated; refs + closures instead |
| `useSankey` | hook | missing | no combined-hook equivalent |
| `SankeyContextValue` | type | missing | |
| `SankeyTooltipData` | type | missing | tooltip payload now internal (`type/nodeIndex/linkIndex/names/value`; legacy carried `x/y/data`) |
| `sankeyCssVars` | const | missing | no migrated equivalent |

## Inventory

| Item | Kind | Origin | Impl | TanStack-native candidate? | Notes |
|---|---|---|---|---|---|
| `DEFAULT_MARGIN {40,180,40,180}` | constant | BKLIT | CUSTOM | no | TS-check: none |
| `DEFAULT_ANIMATION_DURATION = 1100` ms | constant | BKLIT | CUSTOM | no | M1b settle-time parity; TS-check: none — value coincides with motion() default 1100ms entrance duration (unexported) |
| `DEFAULT_NODE_WIDTH = 16` / `DEFAULT_NODE_PADDING = 24` | constant | BKLIT | CUSTOM | no | TS-check: none — sankeyDiagram nodeWidth/nodePadding options native (defaults 24/8) |
| `DEFAULT_COLORS` = `var(--chart-1..5)` + hex fallbacks (`#7c3aed`,`#0ea5e9`,`#f59e0b`,`#10b981`,`#ec4899`) | constant | BKLIT | CUSTOM | no | cyclic `index % 5`; legacy palette had NO hex fallbacks; TS-check: partial — theme.palette carries palettes natively, different tokens than --chart-N |
| Node reveal timing chain: `nodeAnimDuration = dur·0.6`, stagger `(i/N)·0.4·that`, name label `+dur·0.108`, value label `+60ms` | constant | BKLIT | CUSTOM | no | formulas match legacy AnimatedNode exactly; TS-check: partial — stagger()/motion delay fns express per-index delays, not this chain |
| Link reveal window: start `dur·0.2`, window `dur·0.8`, stagger `·0.4` | constant | BKLIT | CUSTOM | no | matches legacy AnimatedLink; TS-check: partial — same: stagger()/delay fns generic, exact windows custom |
| `DEADLINE_SLACK_MS = 150` | constant | CUSTOM | CUSTOM | no | throttled-tab safety-net timer slack; TS-check: none |
| Hover dim transition `0.18s ease-out` | constant | BKLIT | CUSTOM | no | legacy per-element motion `transition={duration:0.18,ease:"easeOut"}` → one injected CSS rule; TS-check: partial — ChartMarkState.transition animates focus-driven dim styles natively |
| `SANKEY_LABEL_OFFSET = 12` / `SANKEY_VALUE_LABEL_GAP = 16` px | constant | BKLIT | CUSTOM | no | legacy `LABEL_OFFSET`/`VALUE_LABEL_GAP` inlined in sankey-node; TS-check: none |
| Default opacities: node faded 0.4, link faded 0.1, link base 0.5, rect radius 4 | constant | BKLIT | CUSTOM | no | TS-check: partial — rect(radius) native; dim opacities map to mark-state styles |
| Value-label resting `fillOpacity 0.6`; hover dim `fadedNode·0.8` | constant | BKLIT | CUSTOM | no | dim writes fill-opacity to avoid multiplying with reveal opacity track; TS-check: partial — scene style fillOpacity native; dim multiplier custom |
| Link highlight opacity `min(1, base·1.3)` | constant | BKLIT | CUSTOM | no | TS-check: partial — mark-state strokeOpacity covers highlight natively |
| `pathLength="1"` + dash keyframes `{"1 1", offset 1→0}` | constant | CUSTOM | CUSTOM | no | length-independent dash draw; replaces legacy `getTotalLength()` + motion `strokeDashoffset`; TS-check: none — motion grows path groups via baseline matrix, no dash-draw |
| Tween resolution: `duration·1000` s→ms, `cubic-bezier(ease)` else `REVEAL_EASE_CSS` (design-tokens) | constant | CUSTOM | CUSTOM | no | spring type falls back to reveal ease (WAAPI has no springs); TS-check: partial — ChartMotionTransition tween/spring native; WAAPI can't spring |
| Tooltip geometry: `EST_TOOLTIP_H 64`, `OFFSET 16`, minWidth 140, radius 8, zIndex 50, dot 10px, fonts 12/14, tabular-nums | constant | CUSTOM | CUSTOM | no | hand-rolled port of legacy TooltipBox/TooltipContent look; TS-check: none |
| `svg` width `< 10` reveal guard | constant | BKLIT | CUSTOM | no | legacy rendered null below 10px; migrated leaves reveal key unconsumed for retry; TS-check: none |
| `defineChart({guides:false, x:null, y:null, margin})` | mark | TANSTACK | TS-NATIVE | yes | disables axes/guides chrome; TS-check: native — defineChart guides:false, x/y:null, margin (@tanstack/charts) |
| `createMarkWithScaleValues<unknown,ChartValue,ChartValue,never,never>` positionless mark, `channels:{}` | mark | TANSTACK | TS-NATIVE | yes | library idiom for scale-free marks (`polar()`, `geoShape()`); TS-check: native — createMarkWithScaleValues (@tanstack/charts/mark/scale-values) |
| Single mark emits 3 scene groups: `sankey:links` → `sankey:nodes` → `sankey:labels` | mark | CUSTOM-ON-TS | CUSTOM-ON-TS | maybe | mirrors tanstack-sankey ceiling scenario; kills dual layout + layoutRef sharing; TS-check: partial — group nesting native; sankeyDiagram child composition supersedes |
| Links as `kind:"area"` paths, `fill:none`, `strokeWidth = max(1, link.width)` | mark | BKLIT | CUSTOM-ON-TS | maybe | stroke width carries the data; needs `vector-effect:none` CSS override; TS-check: partial — link() strokeWidth channel native; non-scaling-stroke hardcode persists |
| Nodes as `kind:"group"` + `kind:"rect"` with `radius = lineCap` | mark | BKLIT | TS-NATIVE | yes | TS-check: native — rect() radius / SceneRect rx (@tanstack/charts) |
| Labels as native `kind:"label"` scene nodes (rotate ±90, anchor, baseline middle, fontSize 13/11, weight 500) | mark | BKLIT | TS-NATIVE | yes | replaces legacy `motion.g`+`text`; guide-layout reserves margins natively; TS-check: native — SceneLabel/text() rotate+anchor+font; margin reservation needs layoutLabels |
| Gradient datums computed in-mark → `gradientDataRef` side-channel (`x1=src.x1??0`, `x2=tgt.x0??100`) | overlay | BKLIT | CUSTOM | no | ids `sankey-grad-${index}` (legacy `link-gradient-${index}`); TS-check: partial — definition.gradients render defs natively; %-coords, frozen at definition |
| `injectGradientDefs`: creates `defs.ts-sankey__gradients`, writes `linearGradient` markup via `innerHTML` | overlay | BKLIT | CUSTOM | no | userSpaceOnUse, stop-opacity 1 — same gradient spec as legacy; TS-check: partial — svg.ts renderGradients native via gradients[]; same %-coord limit |
| `computeSankeyLayout`: d3-sankey `sankeyCenter`, extent from chart pixel bounds, defensive clone, default iterations (6) | util fn | BKLIT | CUSTOM | no | same generator config as legacy; bounds come from TanStack `chart` instead of `[0,0]` extent; TS-check: CONTRADICTS no — native sankeyDiagram (@tanstack/charts/network/sankey) covers align/size/inset/extent |
| `SANKEY_LINK_PATH = sankeyLinkHorizontal()` | util fn | BKLIT | CUSTOM | no | cubic Bézier centerline; TS-check: partial — link(curve)/d3Curve approximates; no exported sankeyLinkHorizontal |
| `getSankeyDisplayValue`: category-based flow sum (`source`→outflow, else inflow) | util fn | BKLIT | CUSTOM | no | verbatim port of legacy displayValue loop; TS-check: partial — native SankeyNode.value aggregates flow; category variant custom |
| `getSankeyNodeIndex` (object-or-index coercion) | util fn | BKLIT | CUSTOM | no | TS-check: none — moot: native rows expose index/sourceIndex/targetIndex directly |
| `extractChildByDisplayName` + `SankeyLink`/`SankeyNode`/`SankeyTooltip` null stubs | util fn | BKLIT | CUSTOM | no | composition model preserved; TS-check: none — sankeyDiagram marks() callback replaces children-config extraction |
| `aspectRatio` string parse → numeric (`parseFloat` split on "/", fallback 2) | util fn | CUSTOM | CUSTOM-ON-TS | maybe | glue between bklit string API and TanStack numeric prop; TS-check: none — Chart.aspectRatio is number-only; parse glue required |
| `runSankeyReveal`: WAAPI `el.animate` per rect/label/path, `fill:"backwards"`, tracked `maxDelay` | side-effect | BKLIT | CUSTOM-ON-TS | maybe | keyframes end at resting state — cancel-safe, no commitStyles; TS-check: partial — motion() entrance+stagger native; scaleY/dash/label choreography custom |
| Pre-paint hide: `.ts-chart__marks--revealing` added sync in onRender, removed onPostPaint | side-effect | CUSTOM | CUSTOM | no | shared reveal contract (styles.css); TS-check: none — motion stages start values pre-paint; no hide-class hook |
| `onPostPaint` (deferred-reveal) + deadline `setTimeout(dur+maxDelay+150)` + `Promise.allSettled(finished)` early-clear | side-effect | CUSTOM | CUSTOM | no | deadline cleared once all animations settle; TS-check: none — onRender fires post-reconcile; motion owns paint timing |
| `stampSankeyLinkPathLength`: re-set `pathLength="1"` every onRender | side-effect | CUSTOM | CUSTOM | no | reconciler strips attributes absent from scene markup; same-task re-stamp never visible; TS-check: none |
| `injectLabelCssTransitions`: guarded `<style.ts-sankey__transitions>` injection | side-effect | CUSTOM | CUSTOM | no | one-time; transitions for node rects, links, nlabel/vlabel keys; TS-check: partial — mark-state transitions replace injected CSS (need motion renderer) |
| `mouseenter`/`mouseleave` listeners per node group + link path (`attachSankeyHoverListeners`) | side-effect | BKLIT | CUSTOM | no | legacy used React onMouseEnter/Leave props; cleanup fn returned; TS-check: partial — painted-containment pointer focus native, but requires interaction points |
| Container `pointermove` listener gated on active hover + `onMouseLeave` reset | side-effect | BKLIT | CUSTOM | no | replaces legacy svg onMouseMove + visx `localPoint` (client coords now); TS-check: partial — tooltip ext anchors to pointer with placement/offset natively |
| Direct DOM style writes: `rect.style.opacity`, label `opacity`/`fillOpacity`, link `opacity`, `transformOrigin="center"` | side-effect | BKLIT | CUSTOM | no | zero-React-pointer-path hover (refs, not state); TS-check: partial — mark states apply focus style overrides declaratively |
| Element-ref population via `[data-ts-key^="sankey:node:"/"sankey:link:"]` querySelectorAll | side-effect | TANSTACK | CUSTOM-ON-TS | no | structural seam to TanStack-rendered DOM; TS-check: none — data-ts-key emission native contract; no element-handle API |
| `RevealKey` seen-gate: data identity + `revealSignature` + `animationDuration`; unmount resets key | util fn | BKLIT | CUSTOM | no | replaces legacy `revealEpoch` state; NOTE: data-identity trigger added (see Deviations); TS-check: none — closest knob motion initial:'always'; different gating |
| Reduced-motion / `duration<=0` branch: cancel + consume key, resting scene already visible | side-effect | CUSTOM | CUSTOM-ON-TS | maybe | no legacy equivalent; TS-check: partial — respectReducedMotion snaps natively (motion()); duration<=0 custom |
| `usePrefersReducedMotion` (internal-foundation) | hook | CUSTOM | CUSTOM | maybe | media-query hook; TS-check: none as hook — motion()/core track reduced-motion internally, unexported |
| No context provided/consumed — legacy `SankeyProvider`/`useSankey` eliminated (refs + closure configs) | context | BKLIT | CUSTOM | no | structural change, see Public API missing rows; TS-check: none |
| `intFmt` (internal formatters) | util fn | BKLIT | CUSTOM | no | tooltip + value labels; TS-check: partial — formatChartTooltipValue locale-formats (@tanstack/charts/tooltip/model) |
| styles.css: `.ts-sankey__link { vector-effect: none }` | CSS class | CUSTOM | CUSTOM | no | beats renderer's hardcoded non-scaling-stroke; fixes hiDPI device-px dash ("black rectangle" tail); TS-check: none — hardcode confirmed in svg-renderer; override unavoidable |
| styles.css: `[data-bkm-chart] .ts-chart__marks--revealing { opacity: 0 }` | CSS class | CUSTOM | CUSTOM | no | pre-paint hide rule (shared); TS-check: none — ts-chart__marks group native; --revealing modifier custom |
| Mark-emitted selector classes: `ts-sankey__links/-nodes/-labels/-node/-node-rect/-link/-label-name/-label-value` + `data-bkm-chart="sankey"` attr | CSS class | CUSTOM | CUSTOM | no | targets for injected CSS + hover queries; TS-check: none — className passthrough native; specific classes custom |
| Injected style-tag classes `ts-sankey__gradients` / `ts-sankey__transitions` | CSS class | CUSTOM | CUSTOM | no | idempotency guards for defs/style injection; TS-check: none |

## Imports

`internal/` modules imported by this part's files:

- `internal/sankey-layout.ts` (this part — d3-sankey wrapper, path gen, label offsets, display value)
- `internal/sankey-mark.ts` (this part — single createMark)
- `internal/sankey-animation.ts` (this part — WAAPI reveal, gradient/CSS injection, pathLength stamping)
- `internal/sankey-hover-chrome.ts` (this part — connectivity math, style application, listener attach)
- `internal/formatters` — **internal-foundation** (`intFmt`)
- `internal/use-prefers-reduced-motion` — **internal-foundation**
- `internal/design-tokens` — **internal-foundation** (`REVEAL_EASE_CSS`)
- `internal/deferred-reveal` — **internal-animation** (`onPostPaint`)
- `./styles.css` side-effect import (**internal-foundation**)
- External: `@tanstack/react-charts` (`Chart`), `@tanstack/charts` (`defineChart`, `createMarkWithScaleValues`, scene types), `d3-sankey`

## Deviations

- **`labelOrientation` default flipped:** legacy `SankeyNode` defaulted `"horizontal"`; migrated resolves unset prop to `"vertical"`. Charts that omit the prop render rotated labels where bklit rendered horizontal ones.
- **Controlled hover dropped:** `hoveredNodeIndex` / `onNodeHoverChange` props gone — legend-driven node highlighting is not wireable.
- **`SankeyLink` feature loss:** `getNodeColor`, `getLinkColor`, `patterns`, `getLinkPattern` not migrated (no visx-pattern support on links).
- **`SankeyTooltip` feature loss:** `nodeContent` / `linkContent` custom renderers not migrated; tooltip is a fixed hand-rolled layout.
- **Context API removed from public surface:** `SankeyProvider`, `useSankey`, `SankeyContextValue`, `SankeyTooltipData`, `sankeyCssVars` no longer exported; composition internals are closed.
- **Reveal replay triggers differ:** legacy epoch effect keyed on `[animationDuration, revealSignature]` only; migrated gate ALSO keys on `data` object identity (new array → full reveal replay). Unmount resets the key, so StrictMode/remount replays (legacy epoch persisted per mount tree).
- **Reduced-motion handling added** (no legacy counterpart): `usePrefersReducedMotion` or `duration<=0` skips the reveal entirely.
- **Palette hardening:** migrated colors carry hex fallbacks (`var(--chart-1, #7c3aed)` …); legacy relied on bare `var(--chart-N)`.
- **Tooltip dot color:** migrated uses `var(--chart-1, #7c3aed)` for both node and link rows; legacy used `var(--chart-line-primary)` (node) and `var(--chart-foreground-muted)` (link).
- **Node tooltip value source:** legacy showed d3-computed `node.value`; migrated recomputes via `getSankeyDisplayValue` (category-based sum) — equal on well-formed graphs, divergent if categories are absent/misused.
- **Label entrance simplified:** legacy labels slid from an inset start position (`x±8`) with opacity; migrated labels fade in place (opacity-only keyframes) — no positional slide.
- **Dash-draw technique replaced:** `getTotalLength()` + motion `strokeDashoffset` → `pathLength="1"` normalized WAAPI keyframes (survives mid-flight geometry changes; requires the `vector-effect:none` CSS override).
- **Hover wiring:** React props → imperative per-element `mouseenter`/`mouseleave` listeners rebuilt in an effect; tooltip tracks `clientX/Y` via container `pointermove` instead of visx `localPoint`.
