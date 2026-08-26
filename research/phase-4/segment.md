# segment — Phase 4 Research Report

**Files:** `showcase/migrated/charts/segment.tsx`
**Legacy source(s):** `repos/bklit-ui/packages/ui/src/charts/segment.tsx`; export block in `repos/bklit-ui/packages/ui/src/charts/index.ts` (L514–522)

## Feature summary

Add-on exposing drag/brush segment-highlight visuals: a filled background rect plus optional from/to vertical boundary lines (dashed/solid/gradient), shown while an active selection spans >5px. Legacy components self-rendered (motion/react + AnimatePresence, selection read from chart context); migrated versions are null-rendering `CHART_ROLE` config-carriers whose props are extracted by host charts (`extractSegmentComponents`) and rendered through `SegmentOverlay` in 4 host charts (line, area, composed, candlestick).

## Public API

| Prop/Export | Type | Legacy parity | Notes |
|---|---|---|---|
| `SegmentBackground` | `(props: SegmentBackgroundProps) => null` | same | Now a config-carrier tagged `CHART_ROLE="segmentBackground"`; renders nothing — visuals moved to `SegmentOverlay` |
| `SegmentBackgroundProps.fill` | `string?` | same | Default unchanged: `var(--chart-segment-background)` |
| `SegmentLineVariant` | `"dashed" \| "solid" \| "gradient"` | same | Identical union |
| `SegmentLineProps.stroke` | `string?` | same | Default unchanged: `var(--chart-segment-line)` |
| `SegmentLineProps.strokeWidth` | `number?` | same | Default 1 |
| `SegmentLineProps.variant` | `SegmentLineVariant?` | same | Default `"dashed"` |
| `SegmentLineFrom` | `(props: SegmentLineProps) => null` | same | Carrier `CHART_ROLE="segmentLineFrom"` (x = selection.startX); rendering moved to `SegmentOverlay` |
| `SegmentLineTo` | `(props: SegmentLineProps) => null` | same | Carrier `CHART_ROLE="segmentLineTo"` (x = selection.endX) |
| `ChartSelectionContext` | `Context<ChartSelection \| null>` | extra | Re-export from `internal/chart-selection`; legacy had no context (selection lived in `useChartInteraction` return value) |
| `ChartSelection` (type) | `{startX, endX, startIndex, endIndex, active}` | same | Field-identical to legacy `use-chart-interaction.ts` type; source module moved to `internal/chart-selection` |
| `SegmentOverlay` | host-side SVG overlay component | extra | Migrated-only: compiles carrier props into rects/lines (from `internal/segment-visuals`); legacy had no equivalent export |

## Inventory

| Item | Kind | Origin | Impl | TanStack-native candidate? | Notes |
|---|---|---|---|---|---|
| `SegmentBackground` carrier | component | BKLIT | CUSTOM-ON-TS | no | Null render; props carried to host-compiled spec; TS-check: CONTRADICTS no — `brushX` selectionStyle rect (@tanstack/charts/interaction/brush) paints drag range natively |
| `SegmentLineFrom` carrier | component | BKLIT | CUSTOM-ON-TS | no | Role `"segmentLineFrom"`; TS-check: partial — `ruleX` vertical rules (dasharray-capable); brushX handles are rects, wiring is app-side |
| `SegmentLineTo` carrier | component | BKLIT | CUSTOM-ON-TS | no | Role `"segmentLineTo"`; TS-check: partial — `ruleX` vertical rules; brushX handles are rects, wiring is app-side |
| `CHART_ROLE` symbol tagging (`Symbol.for("migrated.chartRole")`) + `displayName`s | constant | CUSTOM | CUSTOM | no | Replaces legacy displayName-based identification; symbols defined in `children.tsx`; TS-check: none — TS has no children/carrier API (definition objects only) |
| Default `fill` = `var(--chart-segment-background)` | constant | BKLIT | CUSTOM | no | CSS custom property, resolved at paint time; TS-check: none — var is app-defined; TS styles do pass CSS-var strings through |
| Default `stroke` = `var(--chart-segment-line)` | constant | BKLIT | CUSTOM | no | Same var as legacy `chartCssVars.segmentLine`; TS-check: none — CSS-var stroke strings pass through, var itself bklit-specific |
| Defaults `strokeWidth=1`, `variant="dashed"` | constant | BKLIT | CUSTOM | no | Applied at overlay render time; TS-check: partial — `SceneStyle.strokeWidth`/`strokeDasharray` native fields; defaults stay app-side |
| Dash pattern `"4,4"` | constant | BKLIT | CUSTOM | no | Identical literal in legacy `SegmentLine`; TS-check: native — `SceneStyle.strokeDasharray` accepts arbitrary patterns ("4,4") |
| Vertical `linearGradient` (y 0→100%), stops 0%/10%/90%/100%, outer stops opacity 0 | constant | BKLIT | CUSTOM | maybe | Plain SVG `<defs>`; identical geometry/stops to legacy; TS-check: native — `spec.gradients` (`ChartLinearGradient`), svg-rendered defs with stop opacity (svg.ts) |
| Gradient ids `bkm-seg-from-{key}` / `bkm-seg-to-{key}` | constant | CUSTOM | CUSTOM | no | Replaces legacy module-level mutable counter `segment-line-grad-N` (deterministic, SSR-safe); TS-check: partial — `ChartLinearGradient.id` app-set, renderer scopes ids via idPrefix (svg.ts) |
| Visibility rule: `selection.active && |endX−startX| > 5` | constant | BKLIT | CUSTOM | no | Same 5px threshold as legacy `useSegmentVisibility` (mirrored in `internal/chart-selection.useSegmentVisibility`); TS-check: none — brushX/keyedSelection lack any min-width threshold option |
| Background fade: `opacity` CSS `transition 150ms ease-out` | constant | BKLIT | CUSTOM | maybe | Replaces legacy motion/react `AnimatePresence` fade (`duration: 0.15`); applies to background rect only, lines hard-mount/unmount in both; TS-check: partial — motion tween `{duration, easing:'ease-out'}` animates opacity; not wired to overlay elements |
| `prefers-reduced-motion` branch (`window.matchMedia` read) | hook/side-effect | CUSTOM | CUSTOM | maybe | Fades become instant when reduced motion is set; legacy had no reduced-motion handling here; TS-check: partial — `ChartAnimationOptions.respectReducedMotion` (default true) covers mark motion only, no exported matcher |
| Overlay positioning: absolute `<svg>` at `left: marginLeft / top: marginTop`, `overflow: visible`, `pointerEvents: none`, `aria-hidden` | overlay | CUSTOM | CUSTOM-ON-TS | maybe | Layered over plot area by each host chart; TS-check: native — brushX mounts own absolute overlay SVG; `createMark` scene nodes are renderer-positioned |
| `ChartSelectionContext` (created in `internal/chart-selection`; provided by 4 host charts) | context | CUSTOM | CUSTOM | no | Consumed downstream via `useChartSelectionContext()`; TS-check: partial — `controlledSignal` (@tanstack/charts/interaction/signal) is the native state-binding analog; no context API |
| `ChartSelection` type | type | BKLIT | CUSTOM | no | Field-identical to legacy; TS-check: partial — `BrushRange{start,end}` (@tanstack/charts/interaction/brush) lacks px/index/active fields |
| `SegmentComponent` descriptor type `{key, type, props}` | type | CUSTOM | CUSTOM | no | Duplicated verbatim in `internal/chart-selection.ts` AND `internal/segment-visuals.tsx` (see Deviations); TS-check: none |
| `extractSegmentComponents(children)` (lives in `internal/chart-selection`) | util fn | CUSTOM | CUSTOM | no | Walks children incl. Fragments/nested, collects the 3 segment roles by `CHART_ROLE`; compile step feeding `SegmentOverlay`; TS-check: none — no children API; TS composition is definition arrays |
| `SegmentOverlay` (body in `internal/segment-visuals`, reassigned to internal-interaction group) | component | CUSTOM | CUSTOM-ON-TS | maybe | Renders rect/lines from carrier props; detailed in that group's report; TS-check: partial — rebuildable via `createMark` scene nodes (rect/rule/gradients) or brushX chrome; no drop-in overlay |
| Side-effect channels in scope file | util fn | — | — | no | None: `segment.tsx` performs no WAAPI/DOM mutation/listeners/rAF; only channel nearby is the `matchMedia` read above (event listeners for drag live in `internal/chart-selection`, internal-interaction group); TS-check: none — file channel-free; brushX encapsulates equivalent gesture listeners as host control |
| CSS classes from `styles.css` | CSS class | — | — | no | None used — overlay styling is inline; consumes CSS vars `--chart-segment-background` / `--chart-segment-line`; TS-check: partial — TS ships `.ts-chart__brush-x-fallback` (.selection/.handle) classes; `--chart-segment-*` vars absent |

## Imports

- `./internal/chart-selection` — `ChartSelectionContext`, `ChartSelection` (re-exported); also home of `useChartSelection`, `useSegmentVisibility`, `extractSegmentComponents`
- `./internal/segment-visuals` — `SegmentOverlay` (re-exported; module owned by internal-interaction group, consumed by 4 charts)
- Non-internal sibling: `./children` — `CHART_ROLE` symbol (add-on part, not `internal/`)

## Deviations

- Architecture inversion: legacy `SegmentBackground`/`SegmentLineFrom`/`SegmentLineTo` were self-rendering context consumers (motion/react, `AnimatePresence`); migrated versions are null config-carriers rendered by host charts via `extractSegmentComponents` + `SegmentOverlay`. Public prop surface preserved.
- Exit animation gap: legacy background faded out via `AnimatePresence` exit; migrated toggles inline opacity with a CSS transition (no unmount animation). Boundary lines hard-unmount in both.
- Migrated adds `prefers-reduced-motion` handling (instant opacity); legacy had none in this add-on.
- Gradient stop coloring switched from inline `style={{stopColor, stopOpacity}}` (legacy) to SVG presentation attributes — cosmetic, same output.
- Legacy gradient ids used a module-level mutable counter (potential SSR collision); migrated uses deterministic per-key ids.
- Suspicious duplication: `SegmentComponent` interface declared identically in both `internal/chart-selection.ts` and `internal/segment-visuals.tsx` rather than shared.
- Legacy hover-band trio (`highlight-segment.tsx`, `use-highlight-segment.ts`, `highlight-segment-bounds.ts`) is unrelated to this add-on despite the name overlap — never publicly exported; its behavior was absorbed by internal-interaction `hover-chrome` (clip-band + highlight springs), covered elsewhere.
