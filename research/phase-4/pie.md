# pie — Phase 4 Research Report

**Files:** `showcase/migrated/charts/pie-chart.tsx`, `showcase/migrated/charts/internal/pie-center.tsx`, `showcase/migrated/charts/internal/pie-reveal.ts`
**Legacy source(s):** `repos/bklit-ui/packages/ui/src/charts/pie-chart.tsx`, `repos/bklit-ui/packages/ui/src/charts/pie-slice.tsx`, `repos/bklit-ui/packages/ui/src/charts/pie-context.tsx`, `repos/bklit-ui/packages/ui/src/charts/pie-center.tsx`, `repos/bklit-ui/packages/ui/src/charts/pie-center-shell.tsx`

## Feature summary

Composable pie/donut chart: d3 `pie()` angle computation rendered as ONE multi-row TanStack `radialArc` mark inside `polar()` (D77 redo — `<PieSlice>` children are classified, never rendered; their props bake into the mark). Per-slice angular-sweep WAAPI enter reveal with stagger, imperative hover springs (translate/grow/none + fade), `PieCenter` donut-hole stat overlay with NumberFlow digit roll, gradient/pattern `<defs>` passthrough, and a plain-SVG `geometryScrubbing` mode.

## Public API

Legacy public surface = `charts/index.ts` pie exports + exported members of the five legacy files above.

| Prop/Export | Type | Legacy parity | Notes |
|---|---|---|---|
| `PieChart` | component | same | TanStack-native rewrite; composable children API preserved |
| `PieChartProps.data` | `PieData[]` | same | |
| `PieChartProps.size` | `number?` | same | fixed size; else measured (`useMeasuredRect`) |
| `PieChartProps.innerRadius` | `number?` = 0 | same | |
| `PieChartProps.padAngle` | `number?` = 0 | same | |
| `PieChartProps.cornerRadius` | `number?` = 0 | same | forced 0 when availableRadius ≤ 0 |
| `PieChartProps.startAngle` | `number?` = −π/2 | same | |
| `PieChartProps.endAngle` | `number?` = 3π/2 | same | |
| `PieChartProps.className` | `string?` | same | |
| `PieChartProps.style` | `CSSProperties?` | extra | migrated-only; merged onto container div |
| `PieChartProps.hoveredIndex` | `number \| null?` | same | controlled hover |
| `PieChartProps.onHoverChange` | `(i: number \| null) => void?` | same | |
| `PieChartProps.hoverOffset` | `number?` = 10 | same | also polar inset (anti-clip padding) |
| `PieChartProps.children` | `ReactNode` | same | PieSlice/PieCenter/defs classification |
| `PieChartProps.enterTransition` | `PieEnterTransition?` | renamed | type reshaped: motion/react `Transition` → `{kind:"tween"\|"spring"}`; same fallback timing |
| `PieChartProps.enterStaggerScale` | `number?` = 1 | same | |
| `PieChartProps.geometryScrubbing` | `boolean?` = false | same | switches to plain-SVG path branch |
| `PieSlice` | component | same | now a null-rendering config carrier (never mounted; props extracted in `classifyChildren`) |
| `PieSliceProps.index` | `number` | same | |
| `PieSliceProps.color` | `string?` | same | |
| `PieSliceProps.fill` | `string?` | same | pattern/gradient URL |
| `PieSliceProps.animate` | `boolean?` = true | same | false skips WAAPI reveal |
| `PieSliceProps.showGlow` | `boolean?` = true | same | plumbed to hover runtime; bklit glow dead at runtime (D49) |
| `PieSliceProps.hoverEffect` | `"translate"\|"grow"\|"none"?` | same | |
| `PieSliceProps.hoverOffset` | `number?` | same | overrides chart-level offset |
| `PieSliceProps.className` | `string?` | same | dead prop in BOTH legacy and migrated (D49 finding carried forward) |
| `PieSliceHoverEffect` | type | same | |
| `PieCenter` | component | same | now delegates body to shared `CenterStat` (internal-foundation) |
| `PieCenterProps.defaultLabel` | `string?` = "Total" | same | |
| `PieCenterProps.formatOptions` | `PieCenterFormat?` | same | default = bklit `defaultChartStatFlowFormat` verbatim |
| `PieCenterProps.children` | render fn | same | `{value,label,isHovered,data}` signature identical |
| `PieCenterProps.className` | `string?` | same | |
| `PieCenterProps.valueClassName` | `string?` | same | default class ported to `.ts-bkm-center-stat-value` (same clamp() values) |
| `PieCenterProps.labelClassName` | `string?` | same | default ported to `.ts-bkm-center-stat-label` |
| `PieCenterProps.prefix` | `string?` | same | |
| `PieCenterProps.suffix` | `string?` | same | |
| `PieData` | type | same | |
| `PieArcData` | type | same | |
| `DEFAULT_HOVER_OFFSET` | const = 10 | missing | exported by `pie-chart.tsx` but NOT re-exported from migrated `charts/index.ts` (legacy barrel exports it) |
| `defaultPieColors` | const | missing | demoted to module-local const in `pie-chart.tsx`; not exported |
| `pieCssVars` | const | missing | no migrated equivalent (palette inlined as `var(--chart-1..5)`) |
| `PieProvider` | component | missing | replaced by non-public `PieStableContext.Provider` + `PieHoverCoordinatorContext.Provider` |
| `usePie` | hook | missing | no combined-hook equivalent |
| `usePieStable` | hook | missing | exists as internal `usePieStable` (internal/pie-center.tsx) but not public |
| `usePieHover` | hook | missing | internal `usePieHoverCoordinator` replaces it; not public |
| `PieContextValue` | type | missing | split into `PieStableValue` + coordinator (internal) |
| `PieCenterShell` | component | missing | not migrated; its 0→value double-rAF entrance trick is ported 1:1 inside `gauge-center.tsx` only (comments reference it) |
| `PieCenterShellProps` | type | missing | see above |
| `PieEnterTransition` | type | extra | migrated-only alias for `EnterTransition` (analog of legacy motion `Transition` prop type) |
| `PieCenterRenderProps` | type | extra | legacy children-callback type was inline/anonymous |
| `PieCenterFormat` | type | extra | alias of `CenterStatFormat` (legacy used `ChartStatFlowFormat` inline) |

## Inventory

| Item | Kind | Origin | Impl | TanStack-native candidate? | Notes |
|---|---|---|---|---|---|
| `DEFAULT_HOVER_OFFSET = 10` | constant | BKLIT | CUSTOM | no | hover offset AND outer-radius inset/polar inset; TS-check: none |
| `defaultPieColors` = `var(--chart-1..5)` | constant | BKLIT | CUSTOM | maybe | module-local; 5-color cyclic palette; TS-check: partial — `defaultChartTheme.palette` is 6-color `var(--ts-chart-N)` (charts-core) |
| Stagger `(0.1 + i·0.08)·enterStaggerScale·1000` ms | constant | BKLIT | CUSTOM | no | per-slice reveal delay, matches bklit `animationDelay`; TS-check: CONTRADICTS no — native `stagger({each})` computes offset+each·index (@tanstack/charts/motion) |
| Reveal fallback 1100ms `cubic-bezier(0.85,0,0.15,1)` | constant | BKLIT | CUSTOM | no | `PIE_TWEEN_FALLBACK` ← `TWEEN_FALLBACK` ← design-tokens `REVEAL_DURATION_MS`/`REVEAL_EASE_CSS`; TS-check: CONTRADICTS no — motion.ts internal defaults 1100ms/cubicBezier(0.85,0,0.15,1) |
| Slice-hidden epsilon 0.01 rad → `{d:"none"}` | constant | BKLIT | CUSTOM | no | keyframe guard before sweep starts; TS-check: none |
| `size < 10` early return | constant | BKLIT | CUSTOM | no | renders bare sized div, no SVG; TS-check: none |
| 0.5px epsilon in measurement hook | constant | BKLIT | CUSTOM | no | inside consumed `useMeasuredRect`; TS-check: none |
| `centerSize = innerRadius·2 − 16` px | constant | BKLIT | CUSTOM | no | PieCenter box padding; TS-check: none |
| `defineChart` + `polar({inset:hoverOffset})` + one multi-row `radialArc` | mark | TANSTACK | TS-NATIVE | yes | N rows in ONE mark avoids 50× mark-validation (Phase 2.5→2.2 note); TS-check: native — `polar`, `radialArc`, `defineChart` (@tanstack/charts /charts,/polar) |
| `focusDisabled` | util fn | TANSTACK | TS-NATIVE | yes | suppresses TanStack pointer handling; custom hover owns surface; TS-check: native — `focusDisabled` (@tanstack/charts/focus/disabled); also `pointer:false`, `focusGroupAngle` |
| `tooltip:false, guides:false, x:null, y:null` definition opts | constant | TANSTACK | TS-NATIVE | yes | disables TanStack chrome; TS-check: native — `ChartDefinitionOptions.tooltip?:false`, `ChartSpecBase.guides?`, `x/y?:null` (charts-core types) |
| `PieSlice` null-stub component | component | BKLIT | CUSTOM | no | JSX-compiles + carries `displayName` for classification; TS-check: none |
| `classifyChildren` / `displayNameOf` matching | util fn | BKLIT | CUSTOM-ON-TS | no | PieSlice→configs, PieCenter→overlay, *Gradient*/*Pattern*→defs; TS-check: none |
| Hidden 0×0 defs SVG for gradients/patterns | overlay | BKLIT | CUSTOM-ON-TS | maybe | `url(#id)` resolves across SVG trees; scrubbing branch inlines defs instead; TS-check: partial — `ChartSpecBase.gradients` renders linearGradient defs only, no patterns |
| `geometryScrubbing` plain-SVG path branch | mark | BKLIT | CUSTOM | no | uses `pieArcPath` from pie-geometry (internal-foundation); bypasses TanStack marks entirely; TS-check: none — though `radialArc.generator` covers custom arc geometry natively |
| WAAPI `el.animate({d:[…]})` angular-sweep reveal | side-effect | BKLIT | CUSTOM-ON-TS | maybe | per-slice `path('…')` interpolation, `fill:"backwards"`, cancel-on-finish/cancel; TS-check: partial — svg-motion `createArcTracks` radial-sweep clip animates g.ts-chart__arc enter; no per-path d tween/stagger-by-datum |
| `onPostPaint` + `setRevealDeadline` | side-effect | CUSTOM | CUSTOM | no | deferred-reveal (internal-animation group); deadline timer cleared on unmount; TS-check: none |
| Double-rAF reveal retry + `getAnimations()` scan | side-effect | BKLIT | CUSTOM | no | fires `handleRender` if no anims started; bounded single pass, not per-element post-mutation loop; TS-check: none |
| `pointerenter`/`pointerleave` listeners per slice path | side-effect | BKLIT | CUSTOM | no | legacy used `mouseenter`/`mouseleave` — event-type delta; TS-check: none — TanStack pointer pipeline is surface-level, not per-mark listeners |
| `groupEl.style.cursor = "pointer"` | side-effect | BKLIT | CUSTOM | no | direct DOM mutation; TS-check: none — only interactive-legend/handle set cursor internally, no mark-level option |
| Coordinator subscribe → `runtime.paint(hov)` fan-out | side-effect | BKLIT | CUSTOM | no | imperative springs live in pie-hover-chrome (internal-interaction); TS-check: partial — `ChartInteractionController.setControlledFocus` + `createChartSpring` cover declarative focus/springs, not translate/grow slice effects |
| `setTimeout(0)` teardown-race cancel of reveal anims | side-effect | CUSTOM | CUSTOM | no | guards unmount-vs-callback race; TS-check: none |
| TanStack DOM binding: `.ts-chart__marks` + `path[data-ts-key^="pie-slices:"]` queries | CSS class | TANSTACK | CUSTOM-ON-TS | no | structural seam between TanStack-rendered DOM and imperative layer; falls back to any `svg` descendant; TS-check: native — scene.ts emits `.ts-chart__marks`, svg-renderer emits `data-ts-key` (documented contract) |
| `PieStableContext` + `PieHoverCoordinatorContext` | context | BKLIT | CUSTOM | no | provided by PieChart; replaces legacy PieProvider stable/hover pair; TS-check: none — react-charts exposes no contexts/hooks |
| `usePieStable` / `usePieHoverCoordinator` | hook | BKLIT | CUSTOM | no | consumed by PieCenter; throwing getters; TS-check: none — react-charts exports Chart components only |
| `useMeasuredRect(containerRef, !fixedSize)` | hook | BKLIT | CUSTOM | maybe | replaces visx `ParentSize debounceTime={10}` — see Deviations; TS-check: partial — `<Chart aspectRatio width>` + adapter ResizeObserver resize natively, but no measured-rect hook export |
| `useCenterStatHover` (`useSyncExternalStore`) | hook | CUSTOM | CUSTOM-ON-TS | no | scopes the one sanctioned React re-render to PieCenter island; TS-check: none |
| `CenterStat` + `@number-flow/react` digit roll | component | BKLIT | CUSTOM | no | restores real NumberFlow (see Deviations — stale header comment); TS-check: none — no animated-number/text-roll primitive in any package |
| `import "./styles.css"` side-effect | CSS class | CUSTOM | CUSTOM | no | pulls `.ts-bkm-*` rules; TS-check: none |
| `.ts-bkm-center-stat`, `-value`, `-label` classes | CSS class | BKLIT | CUSTOM | no | hand-authored port of `chart-center-typography.ts` clamp() values; applied via center-stat constants; TS-check: none |
| `[data-bkm-chart="pie"] .ts-bkm-pie-center{,-value,-label}` rules | CSS class | BKLIT | CUSTOM | no | ORPHANED — no migrated element applies these classes anymore; TS-check: none |
| `data-bkm-chart="pie"` attr + inline flex/aspect-ratio container styles | CSS class | BKLIT | CUSTOM | no | replaces legacy `cn("relative flex…"/"aspect-square w-full")` + CSS-grid stacking with inline styles + absolute overlay; TS-check: partial — `<Chart>` host applies aspectRatio/fluid sizing itself (`chartSizingStyle`, @tanstack/charts core) |

## Imports

`internal/` modules imported by this part's files:

- `internal/pie-center.tsx` (this part — contexts, hooks, PieCenter)
- `internal/pie-reveal.ts` (this part — re-export shim)
- `internal/pie-hover-chrome` — reassigned to **internal-interaction** (coordinator + per-slice hover runtime)
- `internal/pie-geometry` — reassigned to **internal-foundation** (`pieArcPath`)
- `internal/center-stat` — internal-foundation (`CenterStat`, class-name/format constants, `useCenterStatHover`)
- `internal/deferred-reveal` — **internal-animation** (`onPostPaint`, `setRevealDeadline`)
- `internal/enter-transition` — **internal-animation** (behind pie-reveal shim: `TWEEN_FALLBACK`, `resolveEnterTransition`, `revealTiming`, `buildProgressKeyframes`)
- `internal` barrel → `useMeasuredRect` (**internal-foundation**, `use-container-size.ts`)
- `internal/styles.css` side-effect import (**internal-foundation**)
- Non-internal sibling: `./children` (`displayNameOf` — children add-on part)

## Deviations

- **Stale header comment:** `pie-chart.tsx` line 35 still claims "NumberFlow omission (disclosed D49 deviation — uses Intl.NumberFormat)", but `PieCenter` now renders the REAL `@number-flow/react` digit roll via shared `CenterStat` (which gates on `customElements.whenDefined`). The D49 deviation appears resolved; comment not updated.
- **Orphaned CSS:** `styles.css:443–457` defines `[data-bkm-chart="pie"] .ts-bkm-pie-center*` rules; no migrated file applies those classes since PieCenter moved to `.ts-bkm-center-stat*`. Dead rules (styles.css belongs to internal-foundation's report scope).
- **Barrel gap:** `DEFAULT_HOVER_OFFSET` is exported from `pie-chart.tsx` but missing from migrated `charts/index.ts`; legacy barrel exports it. Also `defaultPieColors`/`pieCssVars`/context hooks lost their public exports (rows above).
- **Resize semantics:** legacy wrapped fluid pies in visx `ParentSize debounceTime={10}`; migrated uses undebounced `useMeasuredRect` (0.5px epsilon, immediate commit). Fixed-size mode bypasses measurement in both — QA/bench unaffected (fixed sizes), but live-resize update cadence differs.
- **Container styling approach:** legacy `cn()` Tailwind classes + CSS-grid layer stacking replaced by inline styles + absolutely-positioned overlay div; visual result equivalent, implementation differs.
- **Event types:** hover hitbox uses `pointerenter`/`pointerleave` vs legacy `mouseenter`/`mouseleave`.
- **`PieCenterShell` not migrated** — legacy public export with no counterpart; its entrance trick survives only inside gauge-center (out-of-part consumer).
- Carried-forward known-dead code (both sides): `PieSliceProps.className`; `showGlow` plumbing where bklit's glow never renders (D49 "ported as observed pixels").
