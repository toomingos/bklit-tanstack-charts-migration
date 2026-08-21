# Initiative 8 — Legend + ChartLegend + ProfitLoss (plan-loop-2, Tier B) — FINAL

Status: **FINAL loop 2** (Sonnet-drafted synthesis, lead-reviewed; §9 open questions resolved by lead rulings in §10; two draft unknowns lead-verified against source before finalization). Loop-1 (Tier A) is CLOSED and gated (D224). This draft covers exactly the Tier B scope pre-ruled in D223 rulings 1/3/6: cross-chart hover-dim wiring, candlestick 2-slot legend, and the full G1–G4 re-gate this implies (loop-2 re-touches frozen baselines of initiatives 1/2/5). Built from fresh file:line reads of bklit sources, the loop-1-shipped migrated tree, and the D224 renderer-doctrine facts. Not a re-litigation of D223 — this stops at the same kind of "needs a lead call" boundary loop-1 did, in §9.

## 0. Confirmed starting state (evidence)

- D223 (`docs/phase-3/LOG.md:46`) ruled Tier A only for loop-1; rulings 3 and 6 pre-stage loop-2's two open items: SeriesHoverDim conditional-application design, and candlestick 2-slot legend verification.
- D224 (`docs/phase-3/LOG.md:48`) closed loop-1 and recorded two renderer-doctrine facts that are now load-bearing for every mark this loop touches:
  (a) `charts-core-d3/src/svg-renderer.ts`'s `renderStyle` whitelist emits only `fill/fill-opacity/stroke/stroke-opacity/stroke-width/opacity/stroke-linecap/stroke-linejoin/stroke-dasharray` from a SceneNode's `style` object — a top-level node `opacity` field is silently dropped, and there is no `transition` attribute at all. Dims MUST ride `style: { opacity }`; transitions MUST ride a `className` + rule in `showcase/migrated/charts/styles.css`. Verified precedent: `showcase/migrated/charts/internal/profit-loss-line-mark.ts:96-110` (`className: "chart-profit-loss-segment"`, `style: { opacity }`) + `showcase/migrated/charts/styles.css:979-985` (`.chart-profit-loss-segment { transition: opacity 0.2s ease-in-out; }`).
  (b) Grid highlight rows render via `showcase/migrated/charts/internal/grid-highlight-mark.ts` (not the `grid-chrome.tsx` comment in `internal/grid.ts`, which is stale) — not directly relevant to hover-dim wiring but confirms the "one mark module per rendered feature" convention this draft follows.
- **`internal/chart-legend-hover.tsx` is NOT a stub.** Direct byte comparison of `showcase/migrated/charts/internal/chart-legend-hover.tsx` against `repos/bklit-ui/packages/ui/src/charts/chart-legend-hover.tsx` shows an exact 1:1 port (context shape, no-op-default hook, memoized value) — fully functional today. D224's "executor mislabeled it bklit-faithful" ding is about `series-hover-dim.ts` only; `chart-legend-hover.tsx` earns that label legitimately. This draft treats `ChartLegendHoverProvider`/`useChartLegendHover` as already-correct infrastructure — no rewrite needed, only new **consumers**.
- **`internal/series-hover-dim.tsx` IS the confirmed-broken stub** — full gap analysis in §2.

## 1. bklit source inventory — file:line contracts

### 1.1 `series-hover-dim.tsx` (`repos/bklit-ui/packages/ui/src/charts/series-hover-dim.tsx`, 60 lines)

```
SeriesHoverDim({ enabled=true, dimOpacity=0.5, durationSec=0.4, seriesIndex?, children })
```
- L38: `const { tooltipData, selection } = useChartHover();`
- L39: `const { hoveredIndex: legendHoveredIndex } = useChartLegendHover();`
- L40: `isChartHovering = tooltipData !== null || selection?.active === true`
- L41-44: `isLegendDimmed = legendHoveredIndex !== null && seriesIndex !== undefined && legendHoveredIndex !== seriesIndex`
- L45-46: `opacity = enabled && (isChartHovering || isLegendDimmed) ? dimOpacity : 1`
- L47-55: wraps `children` in `motion.g` animating to `opacity`, `transition={{ duration: durationSec, ease: "easeInOut" }}`.
- Call-site overrides: `line.tsx:337-341` → `dimOpacity=0.3`; `area.tsx:316-320` → `dimOpacity=0.6`. Default `0.5`/`0.4s` is never actually used at either of the two real call sites — only the interface default.
- Not in bklit's public barrel (`charts/index.ts`) — internal-only, no external API contract to preserve literally.

### 1.2 `chart-legend-hover.tsx` (44 lines) — already ported verbatim, see §0. No further contract needed here.

### 1.3 Consumers (bklit) — exact wiring points

| bklit file:line | Signal read | Dim target | Opacity/transition |
|---|---|---|---|
| `line.tsx:336-341` | `SeriesHoverDim dimOpacity={0.3} enabled={effectiveShowHighlight} seriesIndex={seriesIndex}` wraps `LineSeriesStroke` + `SeriesDashTailOverlay` | stroke path + dash tail | 0.3, 0.4s easeInOut (from component default; not overridden) |
| `area.tsx:316-320` | `SeriesHoverDim dimOpacity={0.6} enabled={showHighlight} seriesIndex={seriesIndex}` wraps fill/gradient layers (masked or not) | fill | 0.6, 0.4s easeInOut |
| `bar-squares.tsx:307-321` (`BarSquaresInner`) | `const { hoveredIndex: legendHoveredIndex } = useChartLegendHover();` (L307) then `isLegendDimmed = legendHoveredIndex !== null && legendHoveredIndex !== seriesIndex` (L319-320) — **read directly, no `SeriesHoverDim` wrapper**; squares component applies the opacity itself per-square | bar squares for the whole non-matching series | not centrally defined — squares component's own `fadedOpacity` prop (default 0.3, distinct token) |
| `candlestick.tsx:110-126,319,426` | `geometryDimOpacity(geometry, fadedOpacity, legendHoveredIndex, hoveredTime)`: legend branch first (`legendHoveredIndex===0 && !isPositive` OR `legendHoveredIndex===1 && isPositive` → dim), falls back to time-hover branch only when `legendHoveredIndex===null` | **per-candle**, keyed on `geometry.isPositive`, not on a row index | `fadedOpacity` prop, default `0.3` (`CandlestickProps.fadedOpacity`, L31) |
| `series-bar.tsx:179-181,150-200` | `const { hoveredIndex: legendHoveredIndex } = useChartLegendHover();` → `isLegendDimmed = legendHoveredIndex !== null && legendHoveredIndex !== seriesIndex` — read directly, no wrapper | ComposedChart's ad-hoc bar series | not seen in the sampled range — verify at dispatch (component renders per-datum rects directly under `<g className="series-bar">`) |
| `series-markers.tsx:200-256` (`SeriesMarkersDimWrapper`, own component, NOT `SeriesHoverDim`) | `const { tooltipData } = useChartHover(); const { hoveredIndex: legendHoveredIndex } = useChartLegendHover(); isLegendDimmed = legendHoveredIndex !== null && legendHoveredIndex !== seriesIndex; dimBase = enabled && (tooltipData !== null \|\| isLegendDimmed)` | point-marker grid (consumed by `area.tsx`/`line.tsx`/`scatter.tsx`) | `opacity: dimBase ? inactiveOpacity : 1`, `transition: "opacity 0.15s ease-in-out, filter 0.15s ease-in-out"`, optional `blur(${inactiveBlur}px)` — **a third distinct timing/mechanism**, not `SeriesHoverDim` at all despite the same legend-comparison formula |

**Correction to loop-1 plan §1.3**: `bar-squares.tsx`, `series-bar.tsx`, and `series-markers.tsx` never import or use `SeriesHoverDim` — they read `useChartLegendHover()` directly and apply their own opacity. Only `line.tsx` and `area.tsx` use the actual `SeriesHoverDim` wrapper component. This matters for scope: rewriting `series-hover-dim.tsx` only ever affects line/area; the other four hosts need their **own** legend-index term added to their **own** existing dim logic, independent of whatever `SeriesHoverDim` becomes.

### 1.4 Candlestick legend pairing verification (D223 ruling 6, MANDATORY)

Two bklit sources were checked for an actual `Candlestick`+legend pairing:
- `apps/web/components/charts/chart-examples.tsx` (docs gallery, ~30 candlestick example blocks around L5595-5871): **no legend pairing anywhere** — every `CandlestickExampleChart` renders `<Candlestick>` + `<ChartTooltip>` + `<XAxis>` only.
- `packages/ui/registry/examples/candlestick-chart.tsx` and `apps/web/components/docs/candlestick-chart-demo.tsx`: **no legend references** (grepped clean).
- **Found it in the Studio app** (`packages/studio/`), not the docs/registry gallery:
  - `packages/studio/src/components/charts/candlestick-studio-preview.tsx:115-152` (`CandlestickStudioPreview`) renders `<StudioChartShell legendComponentId="candlestick.legend" legendItems={legendItems} ...><CandlestickChartBody .../></StudioChartShell>`, where `CandlestickChartBody` (L35-113) contains the actual `<CandlestickChart><Candlestick .../></CandlestickChart>`.
  - `packages/studio/src/components/charts/studio-chart-shell.tsx:128-147`: `StudioChartShell` wraps its `children` (i.e. the candlestick chart body) in `<ChartLegendHoverProvider hoveredIndex={hoveredIndex} onHoverChange={setHoveredIndex}>` — confirmed via grep at L6 (import), L100 (`useState<number|null>`), L128-147 (provider wraps children). This means `Candlestick`'s `useChartLegendHover()` call (`candlestick.tsx:319`) **does** receive live hover state when a user hovers the studio's legend UI — this is a real, exercised pairing, not dead wiring.
  - `packages/studio/src/lib/studio-legend-items.ts:237-250` (`studioCandlestickLegendItems`): `return [{ label: "Bullish", value: 100, color: bullishColor }, { label: "Bearish", value: 100, color: bearishColor }]` — **item 0 = Bullish/up, item 1 = Bearish/down.**
  - Cross-checked against `candlestick.tsx:116-120`: `dimFromLegend = (legendHoveredIndex === 0 && !geometry.isPositive) || (legendHoveredIndex === 1 && geometry.isPositive)` — hovering index 0 dims everything that is NOT positive (keeps bullish candles full-opacity, dims bearish) → **index 0 = up/bullish, confirmed**. D223's stated "0=up" assumption is verified correct.
- **Verification is CLOSED**: 0 = up/bullish, 1 = down/bearish, exercised via Studio's `StudioChartShell` + `studioCandlestickLegendItems`, not via any docs-gallery demo. The migrated equivalent has no `StudioChartShell` — loop-2's QA scenario must build the pairing directly (see §5B).

## 2. `internal/series-hover-dim.tsx` — stub gap analysis (loop-1 vs bklit)

Current file (`showcase/migrated/charts/internal/series-hover-dim.tsx`, full text read):

```tsx
export function SeriesHoverDim({ enabled = true, dimOpacity = 0.5, durationSec = 0.4, seriesIndex: _seriesIndex, children }: SeriesHoverDimProps) {
  void _seriesIndex;
  const ref = React.useRef<HTMLDivElement | null>(null);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.transition = `opacity ${durationSec}s ease-in-out`;
    void enabled;
    void dimOpacity;
  }, [durationSec, enabled, dimOpacity]);
  return <div ref={ref}>{children}</div>;
}
```

Gap vs bklit, itemized:
1. **Never reads any hover signal.** No `useChartHover`/chart-tooltip-state import, no `useChartLegendHover()` call anywhere in the file. `seriesIndex` is destructured and immediately discarded (`void _seriesIndex`).
2. **Never sets opacity.** `enabled` and `dimOpacity` are received then `void`-discarded in the effect body — only `el.style.transition` is ever written. The `opacity` CSS property is never touched, so the element is permanently at its initial (unset → 1) opacity regardless of hover state. This is the literal mechanism behind D224's probe finding "NO group ever carried an opacity attribute."
3. **Wrong element/wrong rendering model.** Wraps `children` in a plain `<div>`. But per §0/D224, migrated chart visuals (Line stroke, Area fill, etc.) are not React-rendered SVG JSX subtrees the way bklit's are — they are TanStack `ChartMark`/`SceneNode` trees built by mark functions (e.g. `profit-loss-line-mark.ts`) and painted by `charts-core-d3`'s svg-renderer. A React `<div>` wrapper has no children to "wrap" in that model — `line-chart.tsx`/`area-chart.tsx` don't pass their series visuals through `internal/series-hover-dim.tsx` at all (confirmed: `grep -rl "series-hover-dim" showcase/migrated/charts` returns only the file's own barrel export in `internal/index.ts:114` — zero import sites). The component is unimported anywhere in the migrated tree.
4. Net effect: `SeriesHoverDim` is dead code with an API shape that cannot be made to work as a children-wrapper in this architecture, not merely an unwired-but-correct leaf module. The loop-1 executor's "bklit-faithful" label (already ding'd in D224 register) was wrong on substance, not just on wiring status.

## 3. Architecture finding — the migrated tree already implements HALF of `SeriesHoverDim`'s behavior, via a different mechanism

This is the central technical fact this draft is built on, and it changes what "port `SeriesHoverDim`" should mean.

bklit's `SeriesHoverDim` conflates two independent triggers into one opacity value:
- **(a) `isChartHovering`** — `tooltipData !== null || selection?.active === true`. Series-index-agnostic: dims **every** series equally whenever any tooltip/selection is active, and is always paired in bklit with a separate highlight-overlay component (`SeriesHighlightLayer` in area/line) that draws the actually-hovered series on top at full opacity.
- **(b) `isLegendDimmed`** — `legendHoveredIndex !== null && seriesIndex !== undefined && legendHoveredIndex !== seriesIndex`. Series-index-specific, driven by `ChartLegendHoverProvider`, decoupled from chart pointer state.

**Trigger (a) is already fully implemented in the migrated tree**, for every Tier-B host except candlestick's per-sign case, via a pre-existing (initiative 1/2/5, frozen/gated) **imperative DOM-mutation** mechanism — not a React wrapper:
- `showcase/migrated/charts/internal/hover-chrome.ts` — `attachHoverChrome(host, getState, options)`. `DIM_OPACITY = "0.3"` (L35) = exactly line's `SeriesHoverDim dimOpacity={0.3}` override. `attachHoverChrome`'s per-frame update (L328-366) sets `base.style.opacity = dimOpacity` / `fill.style.opacity = dimOpacity` on the series' own SVG path elements directly (`DIM_TRANSITION = "opacity 0.4s ease-in-out"`, L36 — matches bklit's `durationSec=0.4`/`ease:"easeInOut"` exactly), then draws a `highlightPath` overlay for the hovered series at full color/opacity on top — this is the migrated equivalent of bklit's `SeriesHighlightLayer` companion pattern.
  - `showcase/migrated/charts/area-chart.tsx:86` — `const AREA_DIM_OPACITY = "0.6";`, threaded into `attachHoverChrome(..., { dimOpacity: AREA_DIM_OPACITY, ... })` at L630 — exact match to `area.tsx`'s `dimOpacity={0.6}` override.
- `showcase/migrated/charts/internal/bar-hover-chrome.ts:167` — `rect.style.opacity = hoveredIndex !== null && hoveredIndex !== i ? String(s.fadedOpacity) : "1";` — per-bar-row dim, driven by pointer-hovered row index, not legend.
- `showcase/migrated/charts/internal/candlestick-hover-chrome.ts:136-141` (`setMarksDimmed`) — dims/undims the **entire** `.ts-chart__candle[data-ts-key="wicks"]`/`"bodies"` group at once (`DIM_TRANSITION = "opacity 0.15s ease-in-out"`, L19) via a single boolean, backed by a separate highlight-overlay layer (`activeHighlightSvg`, L128) for the pointer-hovered candle. **No per-candle-sign granularity exists today** — see §4C.
- `composed-chart.tsx:87` imports from the same `./internal/hover-chrome`, and threads `bars: resolvedBars.map((b) => ({ dataKey: b.dataKey, fadedOpacity: b.fadedOpacity }))` (L983) into the shared `attachHoverChrome` state — composed's line+bar dim on tooltip-hover also goes through this single mechanism.

**Trigger (b) — legend-hover — is the only genuinely missing piece**, for every host.

### Design consequence

`internal/series-hover-dim.tsx` as a React children-wrapper component **cannot be resurrected as a working port** — there is no JSX subtree in the migrated architecture for it to wrap, and the mechanism that already owns writing `style.opacity` to these exact DOM nodes (`attachHoverChrome` / `attachBarHoverChrome` / `attachCandlestickHoverChrome`) must remain the **single writer** of that property. If a second, independent mechanism (e.g. a React-driven mark rebuild baking `style.opacity` at SceneNode-creation time) also wrote to the same DOM nodes, the two would race: `attachHoverChrome`'s per-pointer-move imperative writes would clobber a legend-driven value on the next mousemove, and a legend-hover-triggered React re-render would blow away whatever the imperative layer had just set. **The only safe design is to extend the existing imperative dim computation with an additional legend term, not to add a second writer.**

This means the *correct* faithful-behavior port of `SeriesHoverDim` (a) preserves its exact trigger formula (`isChartHovering || isLegendDimmed`, per-target opacity values, transition timings — all unchanged) and (b) does **not** preserve its literal wrapper-component shape, because bklit's own component is internal-only (§1.1, not in bklit's public barrel) and the "one clean import path" contract this codebase follows (`internal/index.ts:1-2`) has no obligation to expose a component whose only job in bklit was working around React re-render cost in a JSX-tree rendering model this codebase doesn't have.

## 4. Migrated target design — files to create/rewrite/wire

### 4A. `internal/series-hover-dim.tsx` — retire the wrapper, keep the constants

- **Delete the component** (or reduce the file to a documented no-op re-export kept only so `internal/index.ts:114`'s barrel entry doesn't need touching mid-loop — lead call, see Open Questions). Either way, remove it from any "ported and functional" claim; if kept, its doc comment must say plainly it is unused-by-design and point at `hover-chrome.ts`/`bar-hover-chrome.ts`/`candlestick-hover-chrome.ts` as the real dim owners.
- `design-tokens.ts:48-50` (`SERIES_HOVER_DIM_OPACITY = 0.5`, `SERIES_HOVER_DIM_DURATION_SEC = 0.4`, `SERIES_HOVER_DIM_EASING = "easeInOut"`) become **orphaned** if the wrapper is deleted — these were the *interface defaults*, never the real values (line uses 0.3, area uses 0.6, both already independently named `DIM_OPACITY`/`AREA_DIM_OPACITY` at their real call sites). Recommend deleting these three tokens too (dead exports = a Q3 boundary-grep false-positive risk: "legend/ProfitLoss references outside internal/" greps are supposed to find zero noise, and an unused-but-exported constant invites exactly the kind of "why does this exist" confusion D224's register exists to prevent). Flagged, not decided — see Open Questions.

### 4B. Extend the existing imperative dim mechanisms with the legend term

For each host, thread `legendHoveredIndex` (read once per host via `useChartLegendHover()` inside the host's own top-level React component — same call site pattern already established for `ProfitLossLine` wiring in `line-chart.tsx:173` reading `extractProfitLossHoveredIndex`) into the host's existing hover-chrome `getState()` closure, and OR it into that mechanism's own dim boolean using bklit's exact formula per host:

- **`internal/hover-chrome.ts`** (serves `line-chart.tsx` + `area-chart.tsx` + `composed-chart.tsx`'s line/area paths): add `legendHoveredIndex: number | null` and a `seriesIndex` (or per-`dataKey` index map, since `HoverChromeState.series` is keyed by `dataKey`) to `HoverChromeState`. In the L328-336 per-series loop, change the dim condition from "series lacks `showHighlight`" (existing tooltip-hover logic, unchanged) to *also* dim when `legendHoveredIndex !== null && legendHoveredIndex !== seriesIndexOf(series.dataKey)`, i.e. `shouldDim = !series.showHighlight || isLegendDimmed`. Reuse the existing `dimOpacity`/`DIM_TRANSITION` — bklit doesn't distinguish the two triggers by value, only by whether either is true, so no new constant is needed here beyond what already exists (`DIM_OPACITY`, `AREA_DIM_OPACITY`).
- **`internal/bar-hover-chrome.ts`**: extend `BarHoverChromeState`-equivalent with `legendHoveredIndex`; at L167 change `hoveredIndex !== null && hoveredIndex !== i` to `(hoveredIndex !== null && hoveredIndex !== i) || (legendHoveredIndex !== null && legendHoveredIndex !== i)` — same `s.fadedOpacity` target, no new opacity constant.
- **`internal/candlestick-hover-chrome.ts`** — cannot reuse `setMarksDimmed`'s group-level opacity (§1.3, §4C below) — needs a **new per-candle path**.
- **`series-bar-mark.ts` / `series-bar-layout.ts`** (composed's ad-hoc bar series, bklit `series-bar.tsx`) — verify at dispatch whether composed's bar rendering already goes through `attachHoverChrome`'s `bars` state (per `composed-chart.tsx:983`, it appears to) or needs its own legend-index thread; not fully confirmed in this session (bklit's `series-bar.tsx:179-181` reads `useChartLegendHover()` directly rather than via `SeriesHoverDim`, so its migrated port should mirror that: read the value in the host, thread into the same `bars` state array already passed to `attachHoverChrome`).
- **Point markers (bklit `series-markers.tsx`)** — **migrated equivalent module not located this session.** `grep -rln "SeriesMarker|point-marker|PointMarker|seriesMarker"` under `showcase/migrated/charts` returns only `children.tsx`, `scatter-chart.tsx`, `internal/types.ts` — none of which are obviously a dedicated point-marker rendering module; point-marker rendering may be inlined directly in `area-chart.tsx`/`line-chart.tsx`/`scatter-chart.tsx`, or may not exist as a discrete feature yet. **This must be re-verified by the executor before dispatch** — same gap loop-1's plan flagged and left open (`plan-loop-1.md:116`, `:173`). Loop-2 does not resolve it; if the module truly doesn't exist, point-marker dimming should be explicitly deferred (loop-3 or later), not silently dropped.

### 4C. Candlestick — new per-candle-sign dim path

`setMarksDimmed` (candlestick-hover-chrome.ts:136-141) dims the *entire* wicks/bodies group with one opacity value — it has no concept of individual candle sign. bklit's legend-hover branch needs per-candle opacity keyed on `geometry.isPositive`, which is fundamentally different in kind (mixed dim state within one paint pass) from the group-level pointer-hover dim.

Recommended approach, mirroring `profit-loss-line-mark.ts`'s precedent exactly (a low-frequency, React-render-triggered per-item `style.opacity` bake, since legend-hover changes are discrete/rare, unlike pointer moves):
- Candlestick's mark-building function (wherever `CHART_ROLE = "candlestick"` gets turned into `ChartMark[]`/`SceneNode`s — not yet located by name in this session, likely inside `candlestick-chart.tsx` itself or a not-yet-created `candlestick-mark.ts`; **must be located by the executor before dispatch**) needs to accept `legendHoveredIndex: number | null` and compute, per candle, `opacity = legendHoveredIndex !== null ? (legendHoveredIndex === 0 ? (isPositive ? 1 : fadedOpacity) : (isPositive ? fadedOpacity : 1)) : 1`, baked into each candle body/wick `SceneNode.style.opacity` (per D224 doctrine — never a top-level node field), with a `className` (e.g. `chart-candlestick-body`) carrying the transition rule in `styles.css` (candlestick's own `fadedOpacity` default is `0.3`, not `0.25` — do not reuse `PROFIT_LOSS_LEGEND_DIM_OPACITY`, this is a fourth distinct dim value).
- This bake must compose with (not conflict with) the *existing* pointer-hover-driven `setMarksDimmed` group-level toggle: when a legend item is hovered, per-candle bake wins for that candle's opacity; when only pointer-hover is active (no legend hover), the existing group-level toggle applies as today, unchanged. The two are mutually exclusive triggers in bklit (`geometryDimOpacity`'s `if (legendHoveredIndex !== null) { ...; return }` short-circuits before ever checking `hoveredTime`) — the migrated port should preserve that same precedence, not attempt to combine both simultaneously.

### 4D. New QA/bench scenario for candlestick+legend (D223 ruling 6 follow-through)

Since no bklit docs/registry demo pairs Candlestick with a legend (§1.4), and the only real bklit pairing (Studio) has no migrated equivalent chrome, loop-2 must **construct** a minimal direct pairing for QA purposes: a `Legend`/`ChartLegend` instance with the exact `[{label:"Bullish",...},{label:"Bearish",...}]` 2-item shape (mirroring `studioCandlestickLegendItems`, not `ProfitLossLegend`'s `PROFIT_LOSS_LEGEND_ITEMS` which is P/L-specific), wrapping `CandlestickChart` in a `ChartLegendHoverProvider`, in a new `candlestick-legend` scenario pair (lead-built, `bench/` executor-forbidden, D220 precedent — same as `profitloss`/`legend` in loop-1).

## 5. Propagation list (Tier B — final)

| bklit source | Migrated host | Migrated dim mechanism to extend | New code |
|---|---|---|---|
| `line.tsx:336-341` | `line-chart.tsx` | `internal/hover-chrome.ts` | legend term in existing dim boolean |
| `area.tsx:316-320` | `area-chart.tsx` | `internal/hover-chrome.ts` (shared, `AREA_DIM_OPACITY`) | legend term in existing dim boolean |
| `bar-squares.tsx:307-321` | `bar-chart.tsx` | `internal/bar-hover-chrome.ts` | legend term in existing dim boolean |
| `candlestick.tsx:110-126` | `candlestick-chart.tsx` | `internal/candlestick-hover-chrome.ts` (group-level, tooltip-hover only) | **new** per-candle-sign bake at mark-build time (§4C) |
| `series-bar.tsx:179-181` | `composed-chart.tsx` | `internal/hover-chrome.ts`'s `bars` state (`composed-chart.tsx:983`) | legend term, verify composed's bar dim already routes through this |
| `series-markers.tsx:200-256` | not located — `area-chart.tsx`/`line-chart.tsx`/`scatter-chart.tsx` point-marker rendering (module name unconfirmed) | unknown | **executor must locate before dispatch**; may need deferral |

No per-chart forks to delete — this is net-new wiring on top of already-shipped hosts, same framing as loop-1 plan §3.

## 6. Executor task breakdown (cmd-executor dispatches)

Executor cannot touch `qa/`, `bench/`, `docs/`, `research/`, `repos/`, `showcase/repos/`, `.claude/`, `.opencode/`; git is read-only for it. All scenario/bench wiring below is LEAD-built, not executor work.

1. **Task 1 — retire `internal/series-hover-dim.tsx` + orphaned tokens.** Delete the component (or reduce to a documented no-op per lead ruling, Open Question 1); remove the `internal/index.ts:114` barrel export if deleted; remove/repurpose `design-tokens.ts:48-50`'s three `SERIES_HOVER_DIM_*` constants per the same ruling. Confirm zero remaining imports (`grep -rl "series-hover-dim\|SeriesHoverDim" showcase/migrated/charts` → clean).
2. **Task 2 — line/area legend-dim.** Extend `HoverChromeState` (or its option/getState contract) in `internal/hover-chrome.ts` with `legendHoveredIndex` + a series-index resolver; update the L328-336 per-series dim condition; wire `line-chart.tsx` and `area-chart.tsx` to read `useChartLegendHover()` once and pass the value into their existing `getState()` callbacks. No new design-tokens entries needed (reuse `DIM_OPACITY`/`AREA_DIM_OPACITY`/`DIM_TRANSITION`).
3. **Task 3 — bar legend-dim.** Same pattern in `internal/bar-hover-chrome.ts` (L167) + `bar-chart.tsx` host wiring.
4. **Task 4 — composed (series-bar) legend-dim.** Verify `composed-chart.tsx`'s existing `bars` → `attachHoverChrome` thread (L983) is sufficient, or add a parallel thread if `series-bar`'s bklit source reads `useChartLegendHover()` independently of `SeriesHoverDim`'s call sites (confirmed at `series-bar.tsx:179-181` — it does read directly, no wrapper). Wire `composed-chart.tsx`'s host-level `useChartLegendHover()` read into whatever this task determines is the right thread point.
5. **Task 5 — candlestick per-candle legend-dim.** Locate the candlestick mark-building code path (verify exact file/function first — not confirmed this session). Add `legendHoveredIndex` param, bake per-candle `style.opacity` per §4C formula, add a `className` + `styles.css` transition rule for the new class (lead or executor edit to `styles.css` — confirm which side owns `showcase/migrated/charts/styles.css` under the executor's file-boundary rules before assigning; loop-1 precedent (`profit-loss-line-mark.ts` + its `styles.css` rule) suggests this is in-bounds for the executor since `styles.css` sits under `showcase/migrated/charts/`, not the barred paths).
6. **Task 6 — point-marker legend-dim.** Blocked on locating the migrated point-marker module (§4B). First sub-task: grep/Explore pass to find it (or confirm it doesn't exist yet and this item needs deferral to a later initiative, reported back to lead rather than assumed).
7. **Task 7 — Q3 boundary self-check.** Grep the diff for any new `useChartLegendHover`/dim-opacity logic living outside `internal/*` and the six sanctioned host files (`line-chart.tsx`, `area-chart.tsx`, `bar-chart.tsx`, `candlestick-chart.tsx`, `composed-chart.tsx`, `scatter-chart.tsx` if point-marker work lands) — report any stray duplicate inline opacity logic instead of importing the shared mechanism.

Each task should be dispatched separately (small, host-scoped diffs) per the phase's "small reviewable diffs" convention, not one giant Tier-B dispatch — mirrors loop-1's own two-dispatch pattern (main + fix-up).

## 7. Gate matrix (full G1–G4 sweep, per D223 ruling 1's own framing — this loop re-touches frozen 1/2/5 baselines)

| Gate | Charts/scenarios | What to re-run |
|---|---|---|
| **Q1 frozen-baseline re-runs** | `line`, `area`, `bar`, `candlestick`, `composed`, `scatter` (if point-marker work lands) — every existing Q1 scenario pair for each, via `qa/screenshot.mjs --chart <chart> --impl-a bklit --impl-b migrated [--n 1000]` | Confirm settled-state diffs stay at their D207/D210/D214/D215/D218/D220/D221-established levels (adding a legend-term OR-branch to an existing dim computation must be a no-op when no `ChartLegendHoverProvider` ancestor exists — the no-op-default context guarantees `legendHoveredIndex === null` at rest, so the new OR-term never fires unless a provider is present) |
| **Q1 new legend-hover states** | `candlestick-legend` (new pair, §4D) + re-verify `profitloss`'s existing legend-hover captures still pass (shared `ChartLegendHoverProvider`/`chart-legend-hover.tsx` code untouched, but worth a spot-check since Tier B is the first *other* consumer of that context) | Hover-state screenshot diffs for each 2-slot legend item |
| **Q2 console-errors** | `qa/console-errors.mjs` full existing target list + `candlestick-legend` | Zero console errors across all impls |
| **Q3 boundary greps** | Full-tree grep for `useChartLegendHover`/dim-opacity logic outside `internal/*` + the sanctioned host files (§6 Task 7); grep for duplicate dim-opacity constants (new candlestick fadedOpacity vs `PROFIT_LOSS_LEGEND_DIM_OPACITY` vs `LEGEND_HOVER_DIM_OPACITY` must stay separately named, not unified) | Clean |
| **Type parity** | `showcase` `check-types`, `bench` tsc (zero errors in initiative-8 files) | Exit 0 |
| **G1–G4 bench** | `line`, `area`, `bar`, `candlestick`, `composed` — n=100 spot-check minimum, n=1000 for any host whose diff % moves | M1a/M3a/M3c/heap vs frozen D207/D210/D214/D215/D218/D220/D221 values — this is explicitly **not** a waiver-eligible loop per D223 ruling 1's own framing ("later work never re-touches gated utilities... belongs in its own diff with its own full G1–G4 sweep") |
| **`candlestick-legend` new pair** | bklit-/migrated- scenario, settled + 2 legend-hover states (D210-class G-gate candidate, additive on candlestick host — same waiver-candidate framing as loop-1's `profitloss` pair, subject to the same "prove render-path-neutral at rest" bar) | Bench pair per lead-built scenario |

## 8. Risks

1. **Two-writer race** (§3) is the single highest-risk item — if any host's implementation adds a *second* place that writes `style.opacity` to the same DOM node instead of extending the existing single writer, the two mechanisms will visibly fight on every pointer move while a legend item is hovered (a real, easily-missed Q1 flicker that a static screenshot diff won't catch — needs an eyeballed hover+pointer-move interaction check, not just settled-state diffs, per the D213/D215 "tiny diff % ≠ correct render" doctrine that already caught two defects in loop-1).
2. **Candlestick's per-candle-sign dim is architecturally new**, not a small extension like line/area/bar — it's the one host where "just add an OR-term" doesn't work (§4C). Underestimating this as "same pattern as the others" is a real schedule risk for whichever executor task lands it.
3. **Point-marker module location is still unknown** after two research passes (loop-1's and this one) — if it turns out to not exist yet, Tier B ships with one incomplete host relative to bklit, which needs explicit disclosure (not silent scope-shrink) in the loop-2 close-out, mirroring how loop-1 disclosed the `series-hover-dim.ts` stub gap.
4. **Orphaning `SERIES_HOVER_DIM_*` design-tokens** (§4A) if the wrapper is deleted is a minor but real Q3 grep-noise risk — needs an explicit decision, not a silent leave-in-place.
5. **Composed/`series-bar` legend-dim thread is unconfirmed** — `composed-chart.tsx:983` looks like the right insertion point but was not traced end-to-end to `series-bar-mark.ts` in this session.
6. Full G1–G4 re-gate across 5-6 hosts is a materially larger gate surface than loop-1's single-host `profitloss` pair — schedule accordingly; do not compress to a same-day spot-check the way loop-1's Tier-A waiver did (D223 ruling 1 already rules this out).

## 9. OPEN QUESTIONS FOR LEAD RULING

1. **`internal/series-hover-dim.tsx` disposition**: delete outright (cleanest, but removes a loop-1-shipped file and its barrel export — a bigger diff footprint than "rewrite"), or keep as a documented, permanently-unused no-op component with a doc-comment pointing at the real dim owners (preserves the file's existence for anyone grepping bklit's file list, but is dead code by design forever)? Same question extends to `design-tokens.ts`'s three `SERIES_HOVER_DIM_*` constants (§4A).
2. **Composed-chart's `series-bar` legend-dim insertion point**: is `composed-chart.tsx:983`'s existing `bars` → `attachHoverChrome` thread actually sufficient to carry a legend-hover term, or does `series-bar.tsx`'s bklit direct-read pattern (no `SeriesHoverDim`, own `isLegendDimmed`) imply composed needs an independent code path? Not traced end-to-end this session — needs either a lead source-read or an executor research task before Task 4 can be dispatched with confidence.
3. **Point-marker module**: does a migrated equivalent of `series-markers.tsx` exist at all today (inlined in `area-chart.tsx`/`line-chart.tsx`/`scatter-chart.tsx`, or genuinely absent)? If absent, should loop-2 explicitly defer this one host (disclosed, not silent) rather than block the whole loop on locating/building it?
4. **Candlestick mark-building module**: this draft could not confirm in-session exactly which file turns the `candlestick` `CHART_ROLE` into rendered `SceneNode`s (unlike `profit-loss-line-mark.ts`'s clear precedent) — needs a location pass before Task 5 can be dispatched with a concrete file target.
5. **`styles.css` executor-boundary question** (§6 Task 5): is a new candlestick-dim transition class in `showcase/migrated/charts/styles.css` in-bounds for the executor (loop-1 precedent for `profit-loss-line-mark.ts`'s CSS rule suggests yes, since the path isn't in the barred list), or does this specific loop's file-boundary note need an explicit lead confirmation given styles.css is shared/global?

## 10. LEAD RULINGS (finalize §9 — D225 will record loop-2 close-out)

1. **`internal/series-hover-dim.tsx`: DELETE outright**, plus its `internal/index.ts` barrel export and the three orphaned `design-tokens.ts` `SERIES_HOVER_DIM_*` constants (§4A). Rationale: the wrapper shape is unimplementable in the mark-based rendering model (§3) and bklit's own component is internal-only (not in bklit's public barrel, §1.1) — there is no API contract to preserve; dead exports are Q3 grep noise. **Task 1 is LEAD work** (executors never delete files — standing constraint); the lead performs the deletion as a surgical pre-dispatch edit (D215 precedent).
2. **Composed insertion point: CONFIRMED sufficient.** Lead source-read (composed-chart.tsx:970–1000): composed builds ONE `chromeState` for the shared `attachHoverChrome` (series list with dataKey/color/showHighlight + `bars: resolvedBars.map(({dataKey, fadedOpacity}))` at :983). The legend term lands ONCE in `internal/hover-chrome.ts` (state gains `legendHoveredIndex` + series-index resolution) and covers line/area/composed line-and-bar paths through the same single writer. No independent composed code path. Executor MUST verify bklit's seriesIndex semantics for composed (`series-bar.tsx:179-181` — index within which ordering? legend-items order) and cite file:line in its report before wiring the index map.
3. **Point markers: DEFERRED to initiative 10 (disclosed).** `SeriesMarkers`/`SeriesPointMarker`/`SeriesHighlightLayer` are D200 initiative-10 scope ("Markers + Series chrome"); two research passes (loop-1 + this draft) confirm no migrated point-marker module exists to dim. Building it here would smuggle initiative-10 work into initiative 8. `scatter-chart.tsx` drops out of the Tier-B host list; the deferral is disclosed here and must be restated in the loop-2 close-out LOG entry (mirrors loop-1's stub disclosure). §5 row 6 and §6 Task 6 are VOID.
4. **Candlestick mark-building: LOCATED (lead-verified).** It is INLINE in `candlestick-chart.tsx` — wicks/bodies marks built ~L294–350 (wicks group node `className:"ts-chart__candle"` at :347; bodies mark analogous). No new file is mandated: bake per-candle `style.opacity` (D224 doctrine — never top-level node opacity) in the existing marks memo per the §4C formula, `className` (e.g. `chart-candle-cell`) + transition rule in `styles.css`. Precedence: preserve bklit `geometryDimOpacity`'s short-circuit — when `legendHoveredIndex !== null`, the per-candle bake owns opacity and the host must SUPPRESS the group-level `setMarksDimmed(true)` pointer path; when null, existing group-level behavior applies unchanged. `fadedOpacity` default 0.3 stays a candlestick-local value (fourth distinct dim constant — do NOT unify with `PROFIT_LOSS_LEGEND_DIM_OPACITY`).
5. **`styles.css` executor boundary: IN-BOUNDS.** `showcase/migrated/charts/styles.css` is not under any barred path; loop-1's lead edit there was expedience, not a boundary. The executor may add the candlestick transition class.
6. **Dispatch shape (supersedes §6's seven-task split): TWO executor dispatches + lead work.** Lead pre-work: Task-1 deletion (ruling 1) + `candlestick-legend` scenario pair + query.ts/index.ts bench wiring + qa target additions (§4D — bench/, qa/ are lead-only). **Dispatch A** = shared-mechanism legend term: `hover-chrome.ts` + `bar-hover-chrome.ts` OR-terms + host wiring in line/area/bar/composed (draft Tasks 2–4), including the ruling-2 seriesIndex verification, Q3 self-greps, and `check-types` in its report. **Dispatch B** = candlestick per-candle path (draft Task 5, per ruling 4), separate because it is architecturally new (§8 risk 2). Gates (§7) all lead-run per standing doctrine; the two-writer-race risk (§8 risk 1) gets a lead interactive eyeball check (pointer-move WHILE legend-hovered) in addition to static Q1 — D213 doctrine.
