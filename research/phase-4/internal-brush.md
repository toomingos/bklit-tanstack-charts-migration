# internal-brush — Phase 4 Research Report

**Files:** `showcase/migrated/charts/internal/chart-brush.tsx` ~~(orphan)~~, `showcase/migrated/charts/internal/brush-chrome.tsx` ~~(orphan)~~, `showcase/migrated/charts/internal/brush-drag.ts`, `showcase/migrated/charts/internal/brush-layout.tsx` ~~(orphan)~~, `showcase/migrated/charts/internal/brush-selection.ts`

> **⚠ CORRECTION 2026-08-25 (D309): all three "(orphan)" labels above are STALE — every one of those modules is wired, and two are PUBLIC.**
> `chart-brush.tsx` → `internal/index.ts:165` → **`index.ts:351` (public barrel)**.
> `brush-layout.tsx` → `internal/index.ts:176` → **`index.ts:344` (public barrel)**.
> `brush-chrome.tsx` → consumed by `chart-brush.tsx:4`.
> The public barrel already exports `ChartBrush`, `ChartBrushProps`, `BrushLayout`, `BrushLayoutProps`,
> `BrushLayoutState`, `BrushSelectionPattern`, `ChartBrushSelectedBoxStyle`, `BrushHost`,
> `useBrushSelection`, `resolveBrushTrackXExtent` (`index.ts:341-355`).
> Genuinely still absent: `ChartBrushSelectionOverlay`, `ChartBrushTrackOverlay`, `ChartBrushHandle` — zero hits repo-wide.

**Legacy source(s):** `repos/bklit-ui/packages/ui/src/charts/chart-brush.tsx`, `repos/bklit-ui/packages/ui/src/charts/chart-brush-track-overlay.tsx`, `repos/bklit-ui/packages/ui/src/charts/chart-brush-selection-overlay.tsx`, `repos/bklit-ui/packages/ui/src/charts/chart-brush-handle.tsx`, `repos/bklit-ui/packages/ui/src/charts/chart-brush-layout.tsx`, `repos/bklit-ui/packages/ui/src/charts/filter-data-by-x-domain.ts`

## Feature summary

X-axis time-range brush: a flex-column layout (`BrushLayout`) that owns selection state (`useBrushSelection`) and passes an `xDomain` + slot-count to the main chart plus a mini "brush strip" render prop; data filtering by domain (`filterDataByXDomain`). The interactive overlay half (`ChartBrush` + `BrushChrome` + `useBrushDrag`) renders blur panes outside the selection, a pattern-filled selection window, border rect, and 24×4px drag-handle pills via DOM portals — reimplemented without `@visx/brush` using raw pointer events. Only the state/filter half and the `BrushHostContext` provider are live; the overlay stack is orphaned (see Deviations).

## Public API

Group exported surface (no public API); parity vs the corresponding legacy module(s). `ChartBrush.*` rows = props of `ChartBrush`; `BrushLayout.*` = props of `BrushLayout`; `BrushChrome.*` = props of `BrushChrome`.

| Prop/Export | Type | Legacy parity | Notes |
|---|---|---|---|
| `ChartBrush` (`chart-brush.tsx`) | component | same | Same name/role as legacy `ChartBrush`, but visx `Brush` replaced by custom pointer-drag (`useBrushDrag`); reads `BrushHostContext` instead of `useChartStable`; dev-only warn when no host; no default export (legacy had one) |
| `ChartBrush.host` | `BrushHost \| null` | extra | Migrated-only injection point; legacy got scales/margin from `ChartContext` |
| `ChartBrush.onSelectionChange` | `(sel: BrushSelection \| null) => void` | same | Legacy `onSelectionChange(domain)` — same semantics incl. null on zero-width drag (legacy `boundsToSelection`) |
| `ChartBrush.initialSelection` | `BrushSelection \| null` | same | Legacy same; migrated maps dates→pixels linearly over `trackExtent` instead of via `xScale` |
| `ChartBrush.blurPx` | `number` (default 1.5) | same | Clamped [0,5] both sides |
| `ChartBrush.fadeOuterEdges` | `boolean` (default true) | same | Outer-edge fade mask, 15% stop |
| `ChartBrush.selectionPattern` | `BrushChromePattern` | same | Type renamed (legacy `ChartBrushSelectionPattern`); `color` now optional, `dotFill` now forwarded (legacy didn't) |
| `ChartBrush.selectedBoxStyle` | `BrushSelectedBoxStyle` | renamed | Legacy: `React.SVGProps<SVGRectElement>`; migrated: 4-field subset (fill/fillOpacity/stroke/strokeWidth) |
| `ChartBrush.brushDirection` | — | missing | Legacy `"horizontal" \| "vertical" \| "both"`; migrated is horizontal-only |
| `ChartBrush.selection` | — | missing | Legacy accepted-but-ignored (bound to `_selection`); removed — behavior-neutral |
| `ChartBrush.useWindowMoveEvents` | — | missing | Legacy visx option; migrated always uses window pointer listeners |
| `ChartBrush.handleSize` | — | missing | Legacy visx prop (was 8); hardcoded as `HANDLE_HIT_PX = 8` |
| `ChartBrush.renderBrushHandle` | — | missing | Legacy custom-handle render prop; migrated handles are fixed chrome divs |
| `BrushHost` (`chart-brush.tsx` re-export of `brush-drag.ts`) | type | renamed | Legacy `ChartBrushOverlayHost` (`containerRef` + `margin`) in `chart-brush-track-overlay.tsx`; migrated adds `trackExtent: [Date, Date]` |
| `BrushSelectionPattern` (`chart-brush.tsx`) | type | renamed | Alias of `BrushChromePattern` vs legacy `ChartBrushSelectionPattern` |
| `ChartBrushSelectedBoxStyle` (`chart-brush.tsx`) | type | renamed | Alias of `BrushSelectedBoxStyle` |
| `BrushChrome` (`brush-chrome.tsx`) | component | renamed | Consolidates legacy `ChartBrushTrackOverlay` + `ChartBrushSelectionOverlay` + `ChartBrushHandleOverlay` + the visx-rendered selected-box rect into one composer; clamps x0/x1 once (legacy clamped per overlay) |
| `BrushChromeProps` | type | renamed | Consolidation of the three legacy overlay prop types |
| `BrushChromePattern` | type | renamed | vs legacy `ChartBrushSelectionPattern`; `color` optional (was required), adds `dotFill` pass-through |
| `BrushSelectedBoxStyle` | type | renamed | vs legacy inline `SVGProps<SVGRectElement>` default `{transparent, 0, var(--chart-brush-border), 1}` |
| `BrushHostContext` (`brush-drag.ts`) | context | extra | Migrated-only DI channel; legacy overlays consumed `ChartContext` (`useChartStable`). Provided by `line-chart.tsx`/`area-chart.tsx`; only consumer is orphan `ChartBrush` |
| `BrushDragState` | type | extra | `"idle" \| "creating" \| "dragging-handle-left" \| "dragging-handle-right" \| "dragging-body"`; legacy drag lived inside visx `Brush` |
| `UseBrushDragOptions` | type | extra | `{initialSelection?, onSelectionChange?}` |
| `UseBrushDragResult` | type | extra | `{extent, state, innerWidth, innerHeight}` |
| `useBrushDrag` | hook | extra | Replaces `@visx/brush` `Brush` drag interaction with pointer events |
| `BrushLayout` (`brush-layout.tsx`) | component | renamed | 1:1 port of legacy `ChartBrushLayout` (memo, same render-prop contract) |
| `BrushLayoutProps` | type | renamed | Same fields as legacy `ChartBrushLayoutProps` |
| `BrushLayoutState` (`brush-selection.ts`, re-exported by `brush-layout.tsx`) | type | renamed | Legacy `ChartBrushLayoutState` — identical fields (`xDomain`, `xDomainSlotCount`, `brushSelection`, `onBrushSelectionChange`) |
| `BrushSelection` | type | renamed | Legacy `ChartBrushSelection` (`{start: Date, end: Date}`) moved out of `chart-brush.tsx` |
| `UseBrushSelectionOptions` | type | extra | Extracted hook options (legacy logic was inline in `ChartBrushLayout`) |
| `UseBrushSelectionResult` | type | extra | Extends `BrushLayoutState` with `fullExtent`, `handleBrushSelectionChange` |
| `useBrushSelection` | hook | extra | Extracted from legacy `ChartBrushLayout` body; semantics preserved (useEffect reset, null→full-extent, slotCount = full data.length) |
| `filterDataByXDomain` | util fn | same | Verbatim port of `filter-data-by-x-domain.ts` (inclusive bounds) |
| `resolveDataXExtent` | util fn | same | Verbatim port |
| `resolveBrushTrackXExtent` | util fn | same | Verbatim port (optional `xExtentMax` projection horizon) |
| `createXAccessor` | util fn | same | Legacy-private fn in `chart-brush-layout.tsx`, now exported; identical body |

## Inventory

| Item | Kind | Origin | Impl | TanStack-native candidate? | Notes |
|---|---|---|---|---|---|
| `BRUSH_TRACK_OUTER_FADE = 0.15` | constant | BKLIT | CUSTOM | maybe | Fade stop 15%, "matches series edge fade" (legacy comment); TS-check: none |
| `HANDLE_WIDTH_PX = 4`, `HANDLE_HEIGHT_PX = 24` | constant | BKLIT | CUSTOM | no | shadcn ResizableHandle pill size (legacy same values); TS-check: CONTRADICTS no — partial: brushX handleSize/handleStyle render handles, no pill knob (charts-core) |
| `blurPx` default 1.5, clamp [0, 5] | constant | BKLIT | CUSTOM | no | Duplicated default in `ChartBrush` and `BrushChrome`; TS-check: none |
| `DEFAULT_SELECTED_BOX_STYLE` | constant | BKLIT | CUSTOM | no | transparent fill, opacity 0, `var(--chart-brush-border)`, 1px stroke; TS-check: CONTRADICTS no — native brushX selectionStyle accepts these exact fields (charts-core) |
| `HANDLE_HIT_PX = 8` | constant | BKLIT | CUSTOM | no | Matches legacy visx `handleSize={8}`; documented in comment; TS-check: CONTRADICTS no — native brushX handleSize option, default 24 (charts-core) |
| Portal z-layers `z-[1]` / `z-[2]` + `aria-hidden` | constant | BKLIT | CUSTOM | no | Blur/pattern/border at z-1, handles at z-2; TS-check: none |
| Outer-edge fade mask gradients | CSS class | BKLIT | CUSTOM | maybe | `linear-gradient(to right/left, transparent 0%, black 15%, black 100%)` via `maskImage` + `-webkit-`; TS-check: none |
| `backdropFilter: blur(Npx)` panes (+ `-webkit-`) | CSS class | BKLIT | CUSTOM | no | Direct inline style on portal divs; TS-check: none |
| `BrushTrackChrome` | component | BKLIT | CUSTOM-ON-TS | no | Left/right blur panes, portal into host container; TS-check: none — brushX paints selection/handles only, no blur panes |
| `BrushSelectionPatternChrome` | component | BKLIT | CUSTOM-ON-TS | no | SVG `<defs>` pattern + `<rect>` via `renderPatternPreset`; skipped when preset `none`; TS-check: none — gradients spec field only; no SVG pattern fills (charts-core) |
| `BrushBorderChrome` | component | BKLIT | CUSTOM-ON-TS | no | Selection border rect; legacy drew it via visx `selectedBoxStyle`; TS-check: CONTRADICTS no — native brushX selection rect + selectionStyle (charts-core) |
| `BrushHandleChrome` | component | BKLIT | CUSTOM-ON-TS | no | Pill divs, `ew-resize` cursor; single handle when x0===x1 (legacy parity); TS-check: CONTRADICTS no — partial: brushX styled handles; pill shape/ew-resize cursor not expressible |
| `BrushChrome` (composer) | component | BKLIT | CUSTOM | no | Mounted-gate + clamp + 4 sub-chromes; TS-check: CONTRADICTS no — partial: brushX overlay covers border+handles; blur/pattern stay custom |
| mounted-gate `useEffect(setMounted)` | hook | BKLIT | CUSTOM | no | SSR-safe portal mount in every chrome (legacy same pattern); TS-check: none |
| `useId()` colon-stripped pattern id | hook | BKLIT | CUSTOM | no | SVG `<defs>` id safety (legacy same); TS-check: none |
| `createPortal` into host container | side-effect | BKLIT | CUSTOM | no | Direct DOM portal — 4 chromes; TanStack has no portal-chrome equivalent; TS-check: CONTRADICTS no — partial: host controls (brushX) mount container chrome; no React portal |
| `BrushHostContext` provide/consume | context | CUSTOM | CUSTOM | maybe | New DI channel replacing `ChartContext` reads; provider live in line/area charts; TS-check: none — no React context API; onRender context supplies container/scene/scales |
| `useBrushDrag` | hook | BKLIT | CUSTOM | maybe | Replaces visx `Brush`; TanStack pointer-interaction layer could source events; TS-check: native — brushX control (interaction/brush) replaces drag layer fully |
| `ResizeObserver` + `window resize` listener | side-effect | CUSTOM | CUSTOM | maybe | Measures inner w/h minus margins; overlaps `use-container-size` (internal-foundation); TS-check: native — host ResizeObserver relayout + scene.chart inner bounds (charts-core) |
| container `pointerdown` + window `pointermove/up/cancel` listeners | side-effect | BKLIT | CUSTOM | maybe | Listeners added per-drag, removed on up/cancel; no rAF, no WAAPI; TS-check: native — brushX host control owns all pointer gestures (charts-core) |
| `pixelExtentToSelection` / `selectionToPixelExtent` | util fn | BKLIT | CUSTOM | no | Linear time↔pixel mapping over `trackExtent`; null on zero width; TS-check: CONTRADICTS no — native resolved-scale invert/position (scene.scales.x, charts-core) |
| `BrushDragState` state machine | type | CUSTOM | CUSTOM | no | Refs mirror state for stable event closures; TS-check: CONTRADICTS no — partial: BrushXTarget + BrushXChange reasons carry gesture state |
| `didWarnMissingHost` module flag + `console.warn` | side-effect | CUSTOM | CUSTOM | no | Dev-only, fires once per session; TS-check: none |
| `CHART_ROLE` = `"brush"` symbol marker | constant | CUSTOM | CUSTOM | no | From `../children` add-on infra (D227 compositional API); TS-check: none — definitions are data; no children composition API |
| `BrushLayout` (memo) | component | BKLIT | CUSTOM | no | Render-prop layout: children + optional brushStrip at fixed px height; TS-check: CONTRADICTS no — native grid fixed-size row + alignX linked views (@tanstack/charts/view) |
| flex-column layout classes (`gap-1`/`gap-3`, `fitMainContent` switch) | CSS class | BKLIT | CUSTOM | no | `flex size-full min-h-0 min-w-0 flex-col`, `shrink-0`/`flex-1` — Tailwind utilities, not styles.css; TS-check: none |
| `React.memo` on `BrushLayout` + memoized `layoutState` | hook | BKLIT | CUSTOM | no | Render-prop referential stability; TS-check: none |
| `useBrushSelection` | hook | BKLIT | CUSTOM | no | Dataset swap resets brush (useEffect, not initializer); null = back to full extent; slotCount always full length; TS-check: CONTRADICTS no — partial: controlledSignal holds range; reset/null policy stays app-side |
| `filterDataByXDomain` | util fn | BKLIT | CUSTOM | maybe | Inclusive-bounds array filter; TanStack domain zoom could subsume; TS-check: partial — axis.viewport clips window natively; row filtering app-owned (docs) |
| `resolveDataXExtent` | util fn | BKLIT | CUSTOM | maybe | Min/max scan; TanStack domain derivation could subsume; TS-check: partial — scale factories infer domains from channels; no exported extent helper |
| `resolveBrushTrackXExtent` | util fn | BKLIT | CUSTOM | no | Extends extent past last row via `xExtentMax`; TS-check: none — xExtentMax horizon projection is app policy |
| `createXAccessor` | util fn | BKLIT | CUSTOM | maybe | `d[key]` → Date coercion; TanStack `accessorFn` analog; TS-check: native — ChannelAccessor function channels (charts-core) |
| `BrushSelection` / `BrushLayoutState` / `BrushHost` types | type | BKLIT | CUSTOM | no | Date-based domain contracts; TS-check: CONTRADICTS no — native BrushRange<TValue> {start,end} (interaction/brush) |
| `--chart-brush-border` CSS var | CSS class | BKLIT | CUSTOM | no | Only styles.css artifact: `--chart-brush-border: var(--chart-grid)` (lines 5, 13); TS-check: none |
| Tailwind portal utilities (`pointer-events-none absolute inset-0`, `rounded-lg`) | CSS class | BKLIT | CUSTOM | no | Inline classNames on portaled chrome; TS-check: none |

## Imports

- `internal/pattern-preset` (internal-foundation group) — `renderPatternPreset` in `brush-chrome.tsx`
- `../children` (children add-on) — `CHART_ROLE` marker in `chart-brush.tsx`
- `@/lib/utils` — `cn` in `brush-layout.tsx` (app alias, not `internal/`)
- Within-group: `chart-brush.tsx` → `brush-chrome`, `brush-drag`, `brush-selection`; `brush-chrome.tsx` → `brush-drag` (type); `brush-drag.ts` → `brush-selection` (type); `brush-layout.tsx` → `brush-selection`

## Deviations

- **3 of 5 modules are orphans**: `chart-brush.tsx`, `brush-chrome.tsx`, `brush-layout.tsx` have no importers outside the barrels (`internal/index.ts`, `charts/index.ts`). The entire interactive overlay stack (`ChartBrush` → `BrushChrome` → `useBrushDrag`) is dead code in the migrated tree. `brush-drag` and `brush-selection` do have real importers: `line-chart.tsx` (lines 68–69, 971) and `area-chart.tsx` (lines 76–77, 964) — but only for `filterDataByXDomain`, `createXAccessor`, and the `BrushHostContext.Provider`, whose value currently has no live consumer (only orphan `ChartBrush` reads the context).
- `@visx/brush` dependency fully removed: drag state machine reimplemented with raw pointer events; 8px handle hit target documented as matching legacy visx `handleSize={8}`.
- `BrushChromePattern.color` made optional (legacy `ChartBrushSelectionPattern` required it) and `dotFill` is now forwarded to `renderPatternPreset` (legacy selection overlay did not forward it) — minor behavioral delta in pattern rendering.
- Legacy props `brushDirection`, `selection`, `useWindowMoveEvents`, `handleSize`, `renderBrushHandle` not carried over — migrated brush is horizontal-only with fixed handle chrome; legacy `selection` was accepted-but-ignored anyway (behavior-neutral).
- Legacy default export (`export default ChartBrush`) dropped.
- Suspicious duplication in `brush-drag.ts`: extent clamp/sort logic repeated nearly identically in `onPointerMove` and `onPointerUp`; state mirrored into refs every render (`extentRef`, `stateRef`, etc.) for closure stability.
- `blurPx = 1.5` default duplicated in `ChartBrush` and `BrushChrome` (legacy had it in `ChartBrush` and `ChartBrushTrackOverlayContent` — same pattern).
- `brush-layout.tsx` is a verbatim 1:1 port (header comment says so; verified against legacy lines 100–122) yet unused — candidate for removal or for wiring a brush strip.
