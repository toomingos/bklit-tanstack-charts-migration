# radar — Phase 4 Research Report

**Files:** `showcase/migrated/charts/radar-chart.tsx`, `showcase/migrated/charts/internal/radar-reveal.ts`
**Legacy source(s):** `repos/bklit-ui/packages/ui/src/charts/radar-chart.tsx`, `radar-context.tsx`, `radar-grid.tsx`, `radar-axis.tsx`, `radar-labels.tsx`, `radar-area.tsx`

## Feature summary

Compositional radar/polar chart: concentric polygon grid rings + value labels, radial spokes + metric labels, and N filled series polygons with vertex dots. Enter reveal is a WAAPI deferred campaign (rings 80ms stagger → spokes 50ms → labels → areas 150ms stagger, 1100ms budget) reproducing bklit's `useMountProgress` flow; hover dims non-hovered series, scales/glows the hovered one, and grows dots. Rendered entirely by TanStack `polar()` marks with two custom guides.

## Public API

| Prop/Export | Type | Legacy parity | Notes |
|---|---|---|---|
| `RadarChart` | component | same | Same rendering contract; TanStack `Chart` + `defineChart` underneath |
| `RadarChartProps.data` | `RadarData[]` | same | |
| `RadarChartProps.metrics` | `RadarMetric[]` | same | |
| `RadarChartProps.size` | `number?` | same | Fixed size; else measured rect + `aspect-ratio: 1/1` (legacy: `ParentSize`) |
| `RadarChartProps.levels` | `number?` | same | Default 5 |
| `RadarChartProps.margin` | `number?` | same | Default 60 |
| `RadarChartProps.animate` | `boolean?` | same | Default true |
| `RadarChartProps.enterDurationMs` | `number?` | same | Default 1100; drives `durationFactor = /1100` |
| `RadarChartProps.staggerScale` | `number?` | same | Default 1 |
| `RadarChartProps.enterTransition` | `RadarEnterTransition?` | renamed | Was motion/react `Transition`; now local structurally-compatible subset (spring/tween fields) |
| `RadarChartProps.motionReplayKey` | `string?` | same | Replay via reveal-episode reset instead of element-key remount |
| `RadarChartProps.hoveredIndex` | `number \| null?` | same | Controlled hover |
| `RadarChartProps.onHoverChange` | cb? | same | |
| `RadarChartProps.className` | `string?` | same | |
| `RadarChartProps.style` | `React.CSSProperties?` | extra | Migrated-only inline style escape hatch |
| `RadarChartProps.children` | `ReactNode` | same | Role-carrier children (Grid/Axis/Labels/Area) |
| `RadarMetric` | type | same | `{key,label}` |
| `RadarData` | type | same | `{label,color?,values}` |
| `RadarGrid` + `RadarGridProps` | component | same | Props `showLabels/stroke/strokeOpacity/className` identical; null-rendering role carrier |
| `RadarAxis` + `RadarAxisProps` | component | same | Props `stroke/strokeOpacity/className` identical |
| `RadarLabels` + `RadarLabelsProps` | component | same | Props `offset/fontSize/interactive/className` identical |
| `RadarArea` + `RadarAreaProps` | component | same | Props `index/color/showPoints/showStroke/showGlow/className` identical |
| `RadarEnterTransition` | type | renamed | Local re-declaration of the legacy `Transition` shape |
| default exports (all 6 legacy modules) | export | missing | Migrated is named-export only |
| `radarCssVars` | const | missing | Inlined as `RADAR_BORDER_VAR`/`RADAR_LABEL_VAR`/`RADAR_FOREGROUND_MUTED_VAR`/`RADAR_BACKGROUND_VAR` |
| `defaultRadarColors` | const | missing | Inlined as `DEFAULT_RADAR_COLORS` (`--chart-1..5`) |
| `RadarProvider` | component | missing | Two-context provider eliminated; state lifted into `RadarChart` |
| `useRadarStable` | hook | missing | Context consumers replaced by props/closures |
| `useRadarHover` | hook | missing | Replaced by controlled/uncontrolled state in `RadarChart` |
| `useRadar` | hook | missing | |
| `RadarContextValue` / `RadarStableContextValue` / `RadarHoverContextValue` | type | missing | |
| `bklitRadarGrid` + `BklitRadarGridOptions` (radar-reveal.ts) | util fn | extra | Custom `PolarGuide` reproducing bklit grid divergences |
| `resolveRadarEnterTransition` / `buildRadarProgressKeyframes` / `radarRevealTiming` (radar-reveal.ts) | util fn | extra | Aliases over shared `./enter-transition` |
| `RADAR_TWEEN_FALLBACK` + `RadarResolvedTiming` / `RadarRevealTiming` (radar-reveal.ts) | const/type | extra | `=== TWEEN_FALLBACK` |

## Inventory

| Item | Kind | Origin | Impl | TanStack-native candidate? | Notes |
|---|---|---|---|---|---|
| `polar()` + `radialArea` + `radialDot` marks | mark | TANSTACK | TS-NATIVE | yes | d3 `curveLinearClosed`, fill/stroke accessors read resolved colors; TS-check: native — polar/radialArea/radialDot (@tanstack/charts/polar) |
| `angleGrid()` spokes + metric labels | mark | BKLIT | TS-NATIVE | yes | `format` maps metric key→label; `strokeWidth:0` when no `RadarAxis` child; TS-check: native — angleGrid (@tanstack/charts/polar) |
| `bklitRadarGrid` custom guide (rings + ring value labels) | mark | BKLIT | CUSTOM-ON-TS | no | From-scratch `PolarGuide`: half-step vertex offset `(m+0.5)*step` + flat `(i+1)*radius/levels` ring values — neither expressible in `radialGrid`; TS-check: none — radialGrid polygon lacks vertex phase-offset; flat ring values expressible via `values` |
| Series color resolution (`colorForIndex`, datum.color → palette fallback) | util fn | BKLIT | CUSTOM | maybe | Mirrors legacy `getColor`; TS-check: partial — z color-scale + fill channel; palette half needs theme.palette |
| Long-format row reshape (`RadarRow`, `series` = index padded to `Z_PAD`) | util fn | CUSTOM | CUSTOM | maybe | Feeds TanStack z-encoding; TS-check: partial — fold transform covers reshape, Z-pad series-id is custom |
| Role-carrier child extraction (`CHART_ROLE`/`roleOf` via `./children`) | util fn | BKLIT | CUSTOM-ON-TS | maybe | Compositional API compiled into `defineChart` spec; TS-check: none — no children-role concept; composition is marks arrays |
| Controlled/uncontrolled hover state machine | hook | BKLIT | CUSTOM | maybe | Functional-updater support added vs legacy plain setter; TS-check: partial — interaction.setControlledFocus + onFocusChange; no series-index hover |
| WAAPI deferred reveal campaign (`handleRender` + `onPostPaint`) | overlay | BKLIT | CUSTOM | no | Parity with `useMountProgress`; TanStack `svgAnimation` deliberately off; TS-check: CONTRADICTS no — partial motion() renderer animates radial enter, not guide choreography |
| Reveal bookkeeping (`pendingRevealRef` Map, `seenRevealedRef` Set, `revealAnimsRef`) | util fn | CUSTOM | CUSTOM | no | Guards hover vs live reveal anims; TS-check: none — no WAAPI-animation inspection API |
| Double-rAF mount/replay handoff | util fn | CUSTOM | CUSTOM | no | `requestAnimationFrame` ×2 before first reveal; TS-check: none — app scheduling |
| `motionReplayKey` replay episode reset | hook | BKLIT | CUSTOM | no | Cancel all anims + clear bookkeeping + re-run reveal (no DOM keys to remount); TS-check: none — no replay-token API |
| `hasLiveRevealAnims` guard (`getAnimations()` scan) | util fn | CUSTOM | CUSTOM | no | Avoids stomping TanStack update motions; TS-check: none — no animation-inspection API |
| Hover chrome DOM walk (dim 0.3, scale 1.05, fillOpacity, strokeWidth, drop-shadow glow, dot `r` 4↔6) | overlay | BKLIT | CUSTOM-ON-TS | maybe | `useLayoutEffect` direct style writes; `focusDisabled` chosen instead of TanStack focus; TS-check: partial — polar marks lack states[] (dot/area have it); scale/glow/r not state-stylable |
| Pointer listeners on area paths + dots | util fn | BKLIT | CUSTOM | maybe | `pointerenter`/`pointerleave` (legacy: `onMouseEnter/Leave`); suppressed during pending reveal; TS-check: partial — pointer:true handles focus, not per-path pointerenter callbacks |
| CSS hover transitions (styles.css radar block) | CSS class | BKLIT | CUSTOM | no | opacity .15s ease-in-out, transform .35s cubic-bezier(.22,.61,.36,1) as spring surrogate; TS-check: none — app CSS |
| Interactive metric-label hover (rest .8 → 1) | CSS class | BKLIT | CUSTOM | yes | Pure CSS `:hover`, no JS handlers; TS-check: CONTRADICTS yes — none; labels/labelClassName native, hover CSS is app-side |
| Container sizing (fixed vs `useMeasuredRect`, min(w,h)) | hook | BKLIT | TS-NATIVE | maybe | Replaces visx `ParentSize` (debounceTime 10 dropped); TS-check: native — Chart width/aspectRatio + host ResizeObserver (react-charts) |
| `svgAnimation:false` + `focusDisabled` + `tooltip:false` config | constant | CUSTOM | TS-NATIVE | yes | TanStack-native toggles; TS-check: native — defineChart svgAnimation/focus/tooltip options (@tanstack/charts) |
| Teardown guards (`setTimeout(0)` unmount check, `clearTimeout` deadline, `anim.cancel()`) | util fn | CUSTOM | CUSTOM | no | TS-check: none — plain JS lifecycle guards |
| `DEFAULT_LEVELS=5`, `DEFAULT_MARGIN=60` | constant | BKLIT | CUSTOM | no | Prop defaults; TS-check: none — app-level defaults |
| Color CSS-var constants (`--border`, `--chart-label, oklch(0.65 0.01 260)`, `--chart-foreground-muted`, `--chart-background`) | constant | BKLIT | CUSTOM | no | Inlined `radarCssVars`; TS-check: partial — theme.foreground/muted/grid/background tokens exist, bklit CSS vars aren't them |
| `DEFAULT_RADAR_COLORS` (`--chart-1..5`) | constant | BKLIT | CUSTOM | maybe | Inlined `defaultRadarColors`; TS-check: partial — theme.palette + color scale; var names differ |
| `LABEL_DEFAULT_OFFSET=24`, `LABEL_DEFAULT_FONT_SIZE=11` | constant | BKLIT | CUSTOM | no | `RadarLabels` defaults; TS-check: none — app-level defaults (angleGrid labelOffset/fontSize configurable) |
| `Z_PAD=5` series-id padding | constant | CUSTOM | CUSTOM | no | TanStack z-encoding detail; TS-check: none — z accepts any ChartKey string |
| Hover constants (`HOVER_SCALE=1.05`, fill .35/.15, stroke 3/2, dot r 6/4, dim .3, glow 12px/8px) | constant | BKLIT | CUSTOM | no | Matches legacy radar-area values; TS-check: none — hover constants are bklit parity values |
| Reveal timing magic numbers (budget 1100, `durationFactor=/1100`, grid stagger 80ms, campaign base `+200ms` & `×0.5` term, area stagger 150ms, spoke 50ms, label 60/80ms, label duration ×0.5) | constant | BKLIT | CUSTOM | no | See Deviations for formula drift; TS-check: none — motion delay is per-datum fn, stagger formulas are bklit parity |
| `TWEEN_FALLBACK` easing/timing (via `./enter-transition`) | constant | BKLIT | CUSTOM | maybe | Shared module owns actual bezier/spring math; TS-check: partial — ChartMotionTween/SpringTransition types + createChartSpring sampler |
| WAAPI `element.animate()` on paths/dots/rings/spokes/label texts | util fn | BKLIT | CUSTOM | no | `fill:"backwards"`, cancel-on-finish; replaces motion/react; TS-check: partial — motion() renderer animates mark enter only, not guides |
| Direct DOM mutation (inline styles, `setAttribute("r")`, `classList.add/remove("ts-chart__marks--revealing")`, `data-bkm-revealed` attr) | util fn | CUSTOM | CUSTOM | no | Post-paint + layout-effect channels; TS-check: none — scene/DOM writes are app-side |
| Legacy radar contexts (`RadarProvider`, stable/hover split) | context | BKLIT | CUSTOM | n/a—removed | Eliminated; no context provided or consumed in migrated part; TS-check: none — n/a, removed by design |
| `.ts-chart__marks` / `.ts-chart__marks--revealing` | CSS class | TANSTACK / CUSTOM | CUSTOM | no | Built-in marks group + reveal modifier; TS-check: partial — `.ts-chart__marks` native, `--revealing` custom |
| `.ts-chart__radial-area`, `.ts-chart__radial-dot` | CSS class | TANSTACK | TS-NATIVE | yes | TanStack polar output; used as selector fallbacks + CSS hooks; TS-check: native — emitted by radialArea/radialDot groups (charts-core) |
| `.ts-chart__radial-grid`, `.ts-chart__text` | CSS class | TANSTACK | TS-NATIVE | yes | Applied by `bklitRadarGrid` groups; TS-check: native — radialGrid/angleGrid label-group classes (charts-core) |
| `.ts-bkm-radar-spokes`, `.ts-bkm-radar-axis-labels`, `.ts-bkm-radar-axis-labels--interactive`, `.ts-bkm-radar-grid-labels` | CSS class | CUSTOM | CUSTOM | no | Styled in `styles.css` (fontWeight 500, interactive opacity); TS-check: none — app-authored class names |
| `[data-bkm-chart="radar"]` transform-origin/transform-box rules | CSS class | CUSTOM | CUSTOM | no | Scale pivots at polar center (bklit `transformOrigin:"0px 0px"`); TS-check: none — no transform-box/origin CSS hooks |
| `RadarRow` / `ResolvedRadarArea` / `ExtractedRadarChildren` | type | CUSTOM | CUSTOM | no | Internal shapes; TS-check: none — app-local types |

## Imports

- `./internal/radar-reveal` — this part (`bklitRadarGrid`, reveal aliases)
- `./internal/deferred-reveal` — shared internal-animation group (`onPostPaint`, `setRevealDeadline`)
- `./internal` barrel → `useMeasuredRect` (`./internal/use-container-size`, internal-foundation group)
- `./children` — add-on part (`CHART_ROLE`, `roleOf`)
- `./styles.css` — internal-foundation group
- Transitive via `radar-reveal`: `./enter-transition` → `./radar-spring` (both internal-animation group; `radar-spring` reassigned to the shared group, not this part)

## Deviations

- **Area campaign base-delay drift:** migrated `(5 * gridStaggerMs * 0.5 + 200) * durationFactor` vs bklit radar-area `(levels * gridStagger + 0.2) * durationFactor` — the extra `×0.5` on the levels term (borrowed from radar-grid's *label*-delay formula) starts areas ~200ms earlier than bklit at defaults.
- **Spoke stagger scaling:** migrated `i * 50ms * staggerScale * durationFactor`; bklit radar-axis uses raw `i * 0.05` ignoring both knobs.
- **Ring-label stagger:** migrated `i * 60ms * staggerScale * durationFactor`; bklit `i * 0.06 * durationFactor` (no `staggerScale`).
- **Axis-label entrance:** bklit springs x/y outward (stiffness 80/damping 15) + 0.5s fade; migrated only fades opacity (angleGrid places labels statically).
- **Grid ring `strokeLinecap="round"`** (bklit `LineRadial`) not reproduced on the custom-guide polylines.
- **A11y:** legacy svg `aria-hidden="true"`; migrated `Chart ariaLabel="Radar chart"`.
- **Events:** `mouseenter/leave` → `pointerenter/leave`; dot-radius hover spring (300/20) replaced by instant `setAttribute("r")` + CSS opacity transition.
- Header comments document two intentional grid divergences (half-step vertices, flat ring values) as deliberate reproductions, not gaps.
