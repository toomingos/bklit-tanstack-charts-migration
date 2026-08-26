# gauge — Phase 4 Research Report

**Files:** `showcase/migrated/charts/gauge.tsx`, `showcase/migrated/charts/internal/gauge-center.tsx`, `showcase/migrated/charts/internal/gauge-notch.ts`, `showcase/migrated/charts/internal/gauge-reveal.ts`, `showcase/migrated/charts/internal/focus-disabled.ts`
**Legacy source(s):** `repos/bklit-ui/packages/ui/src/charts/gauge.tsx`, `repos/bklit-ui/packages/ui/src/charts/notch-gauge-shared.ts`, `repos/bklit-ui/packages/ui/src/charts/gauge-label-layout.tsx`, `repos/bklit-ui/packages/ui/src/charts/pie-center-shell.tsx` (arc-center entrance-trick source; shell itself belongs to the pie part)

## Feature summary

Segmented notch meter (no needle, zero pointer/tooltip interaction) in two orientations dispatched off `orientation`: **arc** (default) renders via TanStack `polar()` + two `radialArc` marks (tapered notches) or one custom `PolarMark` emitting bklit's own `createNotchPath` quads (`uniformWidth=true`); **linear** renders plain hand-rolled SVG with no TanStack container (ring/pie precedent). Mount reveal + value-update pop-in/vanish come from ONE WAAPI key-diffing reconciler (`reconcileGaugeReveal`) instead of epoch-replay machinery — bklit's `bg-i`/`active-i` notch keys are permanent identities, so "new key ⇒ animate" reproduces both mount and update idioms. Center readout: arc overlays a NumberFlow stat with PieCenterShell's double-rAF 0→value intro; linear is an un-animated pass-through (real bklit orientation divergence, preserved).

## Public API

Barrel: `charts/index.ts` exports `Gauge`, `GaugeProps`, `GaugeOrientation`, `GaugeEnterTransition`, `GaugeLabelAlign`, `GaugeLabelPlacement` (legacy barrel: `Gauge`, `GaugeProps`, `GaugeOrientation` from gauge.tsx + `GaugeLabelAlign`, `GaugeLabelPlacement` from gauge-label-layout.tsx).

| Prop/Export | Type | Legacy parity | Notes |
|---|---|---|---|
| `Gauge` | component | same | `displayName="Gauge"`; dispatches `GaugeLinear`/`GaugeArc` |
| `GaugeProps` | interface | same | 34 props vs legacy 33 |
| `GaugeOrientation` | `"arc" \| "linear"` | same | |
| `GaugeEnterTransition` | type | **extra** | migrated-only export; structural port of framer `Transition` (spring/tween/bounce subset) |
| `GaugeLabelAlign` | `"start" \| "center" \| "end"` | same | |
| `GaugeLabelPlacement` | `"top" \| "bottom" \| "left" \| "right"` | same | |
| `orientation?` | `GaugeOrientation` | same | default `"arc"` |
| `value` | `number` | same | 0–100 fill level |
| `totalNotches?` | `number` | same | default 40 |
| `spacing?` | `number` | same | default 25 (% of track reserved for gaps) |
| `notchCornerRadius?` | `number` | same | default 0 |
| `uniformWidth?` | `boolean` | same | arc default false, linear default true |
| `startAngle?` | `number` | same | default 135 |
| `endAngle?` | `number` | same | default 405 |
| `useGradient?` | `boolean` | same | default false |
| `activeGradient?` | `readonly [string, string]` | same | |
| `inactiveGradient?` | `readonly [string, string]` | same | falls back to activeGradient |
| `centerValue?` | `number` | same | omit hides label block |
| `defaultLabel?` | `string` | same | default `"Total"` |
| `prefix?` | `string` | same | |
| `suffix?` | `string` | same | |
| `formatOptions?` | `CenterStatFormat` | same | prop name same; type renamed from `ChartStatFlowFormat` — verbatim port, same shape |
| `labelPlacement?` | `GaugeLabelPlacement` | same | linear only; default `"top"` |
| `labelAlign?` | `GaugeLabelAlign` | same | linear only; default `"start"` |
| `inactiveFill?` | `string` | same | |
| `activeFill?` | `string` | same | |
| `inactiveFillOpacity?` | `number` | same | default 0.8 |
| `activeFillOpacity?` | `number` | same | default 1 |
| `children?` | `ReactNode` | same | children-as-defs collector; **behavioral gap: honored on linear only, no-op on arc** (see Deviations) |
| `className?` | `string` | same | |
| `width?` | `number` | same | |
| `height?` | `number` | same | |
| `minWidth?` | `number` | same | defaults 300 (arc) / 200 (linear) |
| `notchLengthPercent?` | `number` | same | default 100; clamped 5–100 |
| `notchWidthPercent?` | `number` | same | linear only; default 80; clamped 10–100 |
| `linearHeight?` | `number` | same | linear only; default 24 px |
| `enterTransition?` | `GaugeEnterTransition` | same | name same; type ported from framer `Transition`; gauge fallback is a spring (unique among families) |
| `enterStaggerScale?` | `number` | same | default 1; clamped 0.25–2.5 |
| `geometryScrubbing?` | `boolean` | same | linear only in migrated (`Omit` on arc); legacy arc accepted-but-ignored (hardcoded false) |
| `style?` | `React.CSSProperties` | **extra** | disclosed addition (pie/ring precedent); forwarded to outermost wrapper |

## Inventory

| Item | Kind | Origin | Impl | TanStack-native candidate? | Notes |
|---|---|---|---|---|---|
| `Gauge` orientation dispatcher | component | BKLIT | CUSTOM-ON-TS | maybe | thin switch over `GaugeArc`/`GaugeLinear`; TS-check: none — no native Gauge component, docs prescribe pie/`radialArc` composition |
| Arc tapered path: `polar({radiusRatio:1})` + 2× `radialArc` (bg + active overlay) | mark | BKLIT | TS-NATIVE | yes | flat per-notch datum rows; per-datum start/endAngle channels; d3 arc convention via `(deg+90)·π/180`; TS-check: native — `radialArc`/`polar` (`@tanstack/charts/polar`), per-datum angle channels + radius-fn options verified |
| Arc `uniformWidth` path: custom `PolarMark<unknown>` emitting `createNotchPath` quads | mark | BKLIT | CUSTOM-ON-TS | maybe | scene groups keyed `gauge-bg`/`gauge-active`; coords shifted by `-(layout.centerX/Y)` at render; TS-check: partial — `PolarMark` type native (`@tanstack/charts/polar`) but no quad primitive; `radialArc.generator` only takes d3 `Arc` |
| Linear render path: plain `<svg>`, no TanStack container | mark | BKLIT | CUSTOM | no | no natural x/y domain for `defineChart`; ring/pie precedent, flagged for review; TS-check: none — `rect`/`barX` still demand x/y scales, no scale-free cartesian mark |
| `useGaugeFillState` | hook | BKLIT | CUSTOM | maybe | ported verbatim (legacy gauge.tsx L223-267); `React.useId` gradient id; TS-check: none — gauge-specific fill/gradient state, no TanStack equivalent |
| `FOCUS_DISABLED` (`{resolve,group,navigation: ()=>[]}`) | constant | TANSTACK-shaped | TS-NATIVE | yes | TanStack now exports `focusDisabled` (`@tanstack/charts/focus/disabled`, used by radar) — drop-in candidate; TS-check: native — `focusDisabled` verified identical shape; also `defineChart(d, {focus:false})` shortcut (renderer.ts L1171) |
| `defineChart({x:null,y:null,guides:false,focus})` config | util fn | TANSTACK | TS-NATIVE | yes | axes/guides fully off; TS-check: native — `defineChart` (`@tanstack/charts`), `x/y: null`, `guides?: boolean` (ChartSpecBase) all verified |
| `gradients:` option (theme-palette active gradient defs) | util fn | TANSTACK | TS-NATIVE | yes | rendered via `renderChartSvgWithResources`; replaces sibling-`<defs>` hack; TS-check: native — `gradients?: ChartLinearGradient[]` (ChartSpecBase, types.ts L640) + `renderChartSvg` emits `<defs data-ts-key="gradients">` |
| `renderSvg={renderChartSvgWithResources}` | util fn | TANSTACK | TS-NATIVE | yes | required for `scene.gradients` rendering; TS-check: native — `renderChartSvgWithResources` (`@tanstack/charts/svg/resources`, re-export of `renderChartSvg`) + `Chart.renderSvg` prop verified |
| `Chart onRender` → `handleRender` reveal hook | side-effect channel | CUSTOM | CUSTOM | maybe | arc path; queries `.ts-chart__marks` post-render; TS-check: native — `onRender` is a first-party `Chart` prop (react-charts Chart.tsx L45); the DOM-querying reveal itself stays custom |
| WAAPI `.animate()` pop-in (opacity 0→1 + scale 0→1, one combined call, `fill:"backwards"`) | side-effect channel | BKLIT | CUSTOM | no | replaces framer `motion.path` initial/animate; TS-check: CONTRADICTS no — partial: `motion()` renderer does keyed enter/exit springs (`@tanstack/charts/motion`) but opacity-fade only, no scale pop |
| `GAUGE_SPRING_FALLBACK` `{spring, stiffness:300, damping:20, mass:1}` | constant | BKLIT | CUSTOM | no | gauge's default enter transition is a spring (other families: tween); TS-check: CONTRADICTS no — partial: `ChartMotionSpringTransition` `{type:'spring',stiffness,damping,mass}` native (`@tanstack/charts` types) |
| `reducedMotionTiming()` `{durationMs:0, easing:"linear", sampledProgress:[0,1]}` | constant | BKLIT | CUSTOM | no | reduced motion routed through same reveal path, not a skip branch; TS-check: CONTRADICTS no — partial: `respectReducedMotion` built into `motion()`/`svgAnimation` (matchMedia snap) |
| Reveal delay formulas: bg `idx·0.015s·stagger`, active `(0.3+idx·0.02)s·stagger` | constant | BKLIT | CUSTOM | no | ×1000 → ms; stagger clamp [0.25, 2.5]; TS-check: partial — `stagger({each,offset})` native (`@tanstack/charts/motion`) but fixed linear formulas + clamp are gauge-specific |
| `reconcileGaugeReveal` key-diffing reconciler (seen-set mutate-in-place, forget removed keys) | util fn | BKLIT | CUSTOM | no | one engine for mount reveal AND update pop-in/vanish; TS-check: CONTRADICTS no — partial: `motion()` renderer key-diffs enter/exit (`@tanstack/charts/motion`); but two-wave delays + scale pop stay custom |
| `trackRevealFactory` onfinish self-release of tracked animations | util fn | CUSTOM | CUSTOM | no | D48 backstop hygiene; TS-check: none — no TanStack WAAPI tracking/backstop surface |
| `onPostPaint` double-rAF + `setTimeout(0)` mount deferral | side-effect channel | BKLIT-timing | CUSTOM | no | from `internal/deferred-reveal`; matches framer pre-commit `initial` timing; TS-check: none — TanStack animates initial paint directly, no post-paint deferral hook |
| `classList.add/remove("ts-chart__marks--revealing")` | side-effect channel | CUSTOM | CUSTOM | no | direct DOM mutation on marks group; TS-check: none — class doesn't exist in TanStack (migrated-owned styles.css) |
| Per-element `el.style.transformOrigin` writes (linear) | side-effect channel | BKLIT | CUSTOM | no | `${xCenter}px ${yCenter}px`; arc uses CSS rule instead; TS-check: none — plain DOM writes, no TanStack surface |
| DOM queries: `.ts-chart__marks`, `[data-ts-key="gauge-bg"|"gauge-active"]`, `[data-bkm-key^="bg-"|"active-"]` | side-effect channel | CUSTOM | CUSTOM | no | target collection for the reconciler; TS-check: none — selectors hit TanStack's own emitted attrs but querying them is custom |
| Unmount teardown: `setTimeout(0)` + `anim.cancel()` loop, generation ref guard | side-effect channel | CUSTOM | CUSTOM | no | arc path; linear cancels synchronously in effect cleanup; TS-check: none — motion() owns its own cancel internally, no exported teardown API |
| `usePrefersReducedMotion` (`useSyncExternalStore` + `matchMedia`) | hook | BKLIT | CUSTOM | maybe | replaces framer `useReducedMotion`; TS-check: partial — TanStack reads the same media query internally (`motion()`, core controller) but exports no React hook |
| `useMeasuredRect` / `useContainerWidth` (ResizeObserver, 0.5px epsilon) | hook | BKLIT | CUSTOM | maybe | ParentSize replacement; **no 10ms debounce** (see Deviations); TS-check: partial — ResizeObserver lives inside Chart's own sizing (core controller), no exported measurement hooks |
| Arc geometry constants: outer `0.42·size`, inner base `0.28·size`, depthFactor clamp[5,100], notch span `0.8·notchAngle`, radius ratios 0.84 / `0.84−0.28·depthFactor` | constant | BKLIT | CUSTOM | no | ratios derived for polar layout radius = size/2; TS-check: none — bklit-specific proportions |
| Linear geometry constants: `taperRatio 28/42`, depthFactor clamp[5,100], widthFactor clamp[10,100], slot/gap width math | constant | BKLIT | CUSTOM | no | lifted into `computeLinearNotches`; TS-check: none — bklit-specific proportions |
| Layout constants: `ARC_ASPECT_RATIO 21/16`, `ARC_MAX_WIDTH 560`, minWidth 300/200, `DEFAULT_LINEAR_GAUGE_HEIGHT 24`, center `paddingTop 0.08·size` | constant | BKLIT | CUSTOM | no | TS-check: none — layout policy constants; Chart offers only `aspectRatio` prop |
| Colors/opacities: `var(--border)` arc track, `var(--chart-background)` linear track, `var(--chart-1)`/`var(--chart-5)` gradient stops, `DEFAULT_ACTIVE_GRADIENT ["#bef264","#10b981"]`, fill opacities 1 / 0.8 | constant | BKLIT | CUSTOM | no | TS-check: none — bklit design tokens; TanStack `ChartTheme` is a different token set |
| `createNotchPath` corner-fillet caps `0.48·verticalDepth`, `0.49·edge` | constant | BKLIT | CUSTOM | no | bespoke straight-chord + quadratic-Bézier fillet, zero d3-arc; TS-check: none — no path-fillet primitive in TanStack |
| `interpolateGaugeHex` | util fn | BKLIT | CUSTOM | maybe | verbatim hex lerp; TS-check: none — no color-interpolation export (scales lerp numbers only) |
| `resolveGaugeBgFill` / `resolveGaugeActiveFill` | util fn | BKLIT | CUSTOM | maybe | verbatim fill-state dispatch; TS-check: none — gauge-specific fill policy, no TanStack counterpart |
| `computeArcNotches` / `computeLinearNotches` | util fn | BKLIT | CUSTOM | maybe | lifted from legacy `GaugeArcInner`/`GaugeLinearInner` useMemo bodies; absolute pixel space; TS-check: none — bespoke slot math; `pie()` allocates slices, not fixed notch slots |
| `collectGaugeDefsElements` children-as-defs collector | util fn | BKLIT | CUSTOM | no | displayName/name heuristic incl. Fragment recursion; arc path discards result (no-op); TS-check: none — `gradients` option is structured stops, no JSX-defs escape hatch |
| `GaugeCenterOverlay` double-rAF 0→`centerValue` intro | component | BKLIT | CUSTOM | no | PieCenterShell trick ported 1:1 (`introStartedRef` re-arm on remount); rAF side-effect channel; TS-check: partial — `radialText` can paint a static center readout (docs gauge example) but no digit-roll intro |
| Center sizing: `innerRadiusPx = max(size·0.2, 52)`, `centerSize = innerRadiusPx·2 − 16` | constant | BKLIT | CUSTOM | no | D52 fix: box is container-query basis for clamp() fonts; TS-check: none — bklit-specific box math |
| `GaugeLabelStat` un-animated pass-through + `.ts-bkm-gauge-linear-stat-*` classes | component | BKLIT | CUSTOM | no | reproduces bklit's tailwind-merge-invalid-length INHERITED 16px/1.5 typography (D52); TS-check: none — HTML stat block outside TanStack's scope |
| `GaugeLabelLayout` four-placement/three-align flex composition | component | BKLIT | CUSTOM | maybe | inline styles replace Tailwind utilities; gaps 0.75rem (top/bottom) / 1rem (left/right); TS-check: none — pure flex layout wrapper, no TanStack equivalent |
| `CenterStat` / NumberFlow digit-roll island | component | BKLIT | CUSTOM | no | sanctioned React island (`@number-flow/react`); shared `internal/center-stat.tsx`; TS-check: none — third-party NumberFlow, nothing comparable in TanStack |
| CSS: `[data-bkm-chart="gauge"] [data-ts-key^="gauge-"] { transform-origin: 0px 0px }` | CSS class | CUSTOM | CUSTOM | no | arc notches pre-centered on polar origin; styles.css; TS-check: none — migrated-owned stylesheet rule |
| CSS: `.ts-chart__marks--revealing` | CSS class | CUSTOM | CUSTOM | maybe | shared reveal guard class (added/removed by gauge itself); TS-check: none — class absent from TanStack source, migrated-owned |
| CSS: `.ts-bkm-center-stat`, `-value`, `-label`, `-icon` | CSS class | BKLIT | CUSTOM | no | hand-authored port of chart-center-typography + ChartStatFlow wrappers; clamp(22cqw/9cqw) fonts, label line-height 1.5 (dead-class kill, D52); TS-check: none — bklit typography classes |
| Types: `NotchPoint`, `ComputedNotch`, `GaugeArcRow`, `UniformArcRow`, `GaugeRevealTarget`, `ArcNotchGeometry(Input)`, `LinearNotchGeometry(Input)` | type | BKLIT | CUSTOM | no | geometry/fill plumbing; TS-check: none — gauge-specific types; `SceneNode`/`PolarMark` come from TanStack but these don't overlap |

## Imports

Part-internal (own group):
- `./internal/gauge-notch` — `collectGaugeDefsElements`, `computeArcNotches`, `computeLinearNotches`, `createNotchPath`, `DEFAULT_*` constants, `interpolateGaugeHex`, `resolveGaugeActiveFill`, `resolveGaugeBgFill`, types
- `./internal/gauge-reveal` — `GAUGE_SPRING_FALLBACK`, `reconcileGaugeReveal`, `resolveEnterTransition`, `revealTiming`, types
- `./internal/gauge-center` — `GaugeCenterOverlay`, `GaugeLabelLayout`, `GaugeLabelStat`, types
- `./internal/focus-disabled` — `FOCUS_DISABLED`

Shared internals consumed:
- `./internal/deferred-reveal` — `onPostPaint`
- `./internal/center-stat` — `CenterStat`, `centerStatContainerClassName`, `defaultCenterStatFormat`, `CenterStatFormat`
- `./internal/use-prefers-reduced-motion` — `usePrefersReducedMotion`
- `./internal` (barrel) — `useContainerWidth`, `useMeasuredRect`
- `./styles.css` — side-effect import

External/TanStack: `@tanstack/react-charts` (`Chart`), `@tanstack/charts` (`defineChart`, `SceneNode`), `@tanstack/charts/polar` (`polar`, `radialArc`, `PolarMark`), `@tanstack/charts/svg/resources` (`renderChartSvgWithResources`). Transitive via gauge-reveal → `./enter-transition` (→ `radar-spring`, `design-tokens`).

## Deviations

- **`children` no-op on arc (disclosed):** bklit's children-as-defs escape hatch (arbitrary caller `<linearGradient>`/`<pattern>` JSX) is honored only on the linear path; TanStack's `gradients` option accepts structured stop lists, not arbitrary JSX, so arc drops `defsChildren`. Real, narrow prop-compat gap flagged for Fable.
- **Tapered arc notch shape approximated (D82):** stock `radialArc` pie slices + `cornerRadius` replace bklit's bespoke trapezoid quads when `uniformWidth=false`; exact `createNotchPath` quads retained only for `uniformWidth=true` (custom PolarMark). Pixel parity delegated to QA gates.
- **Linear path bypasses TanStack entirely:** plain SVG, no `defineChart`/`Chart` (ring/pie precedent); flagged for review in the file header.
- **Fixed-size arc routing:** migrated routes ALL arc modes (including explicit `width`+`height`) through the `aspect-[21/16] max-w-[560px]` wrapper; legacy fixed-size arc used a bare `inline-flex max-w-full` wrapper with no 560px cap — potential divergence for fixed sizes above 560px wide.
- **Measurement debounce dropped:** legacy `ParentSize debounceTime={10}` replaced by undebounced `useMeasuredRect`/`useContainerWidth` (0.5px epsilon only); the debounced variants exist in `internal/use-container-size.ts` but gauge doesn't use them.
- **Stale headers/comments:** `gauge.tsx` L21 and `internal/focus-disabled.ts` claim radar-chart.tsx also uses `FOCUS_DISABLED` — radar now imports TanStack-native `focusDisabled` (`@tanstack/charts/focus/disabled`); `focus-disabled.ts` is gauge-only (matches taxonomy, headers stale). `styles.css` L548/L551 cite a nonexistent `internal/gauge-arc-mark.ts` (pre-D82 architecture leftover).
- **Preserved-not-fixed quirk:** linear responsive mode measures the FULL wrapper width before left/right label composition, so the track can overflow/crowd with `labelPlacement="left"|"right"` — reproduced verbatim from bklit (top/bottom unaffected).
- **Reduced-motion idiom changed:** framer `useReducedMotion` + `{duration:0}` transition replaced by `matchMedia` hook feeding a `durationMs:0` timing through the same WAAPI reveal path (key bookkeeping stays identical).
- **Arc reveal keys are DOM-order positional** (`bg-${idx}` from `querySelectorAll` order) rather than bklit's literal React keys; equivalent because bg rows render every notch in index order and the reconciler's forget-on-remove semantics match unmount/remount.
