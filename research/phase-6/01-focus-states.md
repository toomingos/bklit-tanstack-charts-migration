# 01 — Focus styling / hover-dim

Orchestrator-ruled, 2026-08-27, against `@tanstack/charts@0.15.0`. Inventory from Explore agent
(hover/focus sweep); every verdict below is mine, with dist/docs evidence.

## Current implementation inventory

| File | LOC | Role | Reach-ins owned |
|---|---|---|---|
| `internal/hover-chrome.ts` | 779 | line/area/composed chrome: crosshair, dots, series dim (`syncDim` :638-716), highlight band, date pill, axis-label fade, reanchor | 18 `querySelector` into `.ts-chart__*`; opacity/filter style mutation on series groups |
| `internal/use-hover-chrome.ts` | 147 | React lifecycle wrapper for the above | — (indirect) |
| `internal/bar-hover-chrome.ts` | 411 | bar row highlight + dim (`syncDim` :216-272) | series-group style mutation |
| `internal/candlestick-hover-chrome.ts` | 347 | candle dim (`setMarksDimmed` :120-126, legend dim :178-192) | marks-group style mutation |
| `internal/scatter-hover-chrome.ts` | 331 | inactive dim+blur, 1.35× active copy | marker node clone + style mutation |
| `internal/pie-hover-chrome.ts` | 235 | slice fade 0.4 (glow = dead code) | path style mutation |
| `internal/ring-hover-chrome.ts` | 179 | ring scale 1.03/1.02 (fade/glow dead) | path style mutation |
| `internal/sankey-hover-chrome.ts` | 215 | connectivity dim (node 0.4 / link 0.1 / connected ×1.3) | path style mutation |
| `internal/heatmap-hover*.ts` | 145 | cell fade 0.3 — **React props, no DOM reach-in** | none |
| `internal/choropleth-hover-chrome.ts` | 348 | dim via DOM-reparenting wrapper; hover-persistence quirk | reparents feature paths |
| `internal/live-hover*.ts` (in live chrome) | — | scrub dim 0.25 | style mutation |
| `internal/*-focus-strategy.ts` (bar 152, candle 67, scatter 61) | 280 | **already-native** `ChartFocusStrategy` impls | none — KEEP |
| `internal/chart-focus-kit.ts` / `broadcast-store.ts` | 147 | pure infra | none — shrinks with consumers |

## bklit behavioral requirement (legacy spec numbers)

| Chart | Dim spec | Active spec |
|---|---|---|
| line | others opacity 0.3, 0.4s easeInOut | full opacity |
| area | others 0.6, 0.4s easeInOut | — |
| bar | others dim @ 0.15s (standalone) / 0.12s (in composed) — deliberate legacy split | row highlight |
| candlestick | legend-hover dim only | — |
| scatter | inactive 0.5 + **blur 2px**, 0.15s | r ×1.35 |
| pie | others fade 0.4 | slice expand (see 05) |
| ring | — | segment scale 1.03/1.02 |
| sankey | non-connected: node 0.4 / link 0.1; connected links ×1.3 opacity boost | — |
| heatmap | others 0.3 @ 0.22s cubic-bezier(0.4,0,0.2,1) | — |
| choropleth | others dim @ 0.18s ease-out | — |
| live | non-scrubbed 0.25 | — |

## Native mechanism

- `states: [{when, style, transition}]` on Cartesian mark options; `when: {focus: 'primary'|'group'|'key'|'x'|'y'|'series'|'unmatched', source?, pinned?}` **or arbitrary predicate** `(context)=>boolean` with `{datum, point, focus, pointer, matches()}` — `dist/types.d.ts:63-107`.
- Style channels: fill, fillOpacity, stroke, strokeOpacity, strokeWidth, opacity, strokeDasharray, r, radius, inset, fontSize, fontWeight, dx, dy, rotate. Per-state `transition` (duration/easing/spring) — interruptible via motion renderer.
- **Constraint (verified):** `states` is absent from polar mark options (`dist/polar.d.ts`) and hierarchy-sunburst. Custom marks carry states via initialization (`InitializedMarkBase.states`, `dist/types.d.ts:672`).
- Renderer applies state styles inline and stamps **no** focus classes on mark DOM — CSS cannot see "unmatched". Blur therefore has no native channel (no `filter` in `ChartMarkStateStyle`).
- Legend-driven dim: `host.interaction.setControlledFocus(point, {source:'programmatic'})` (`dist/dom-types.d.ts:31-38`, controller from React `onRender` context) + `states` scoped `when:{focus:'unmatched', source:'programmatic'}` — see 07.

## Mapping verdicts

| Chart | Verdict | How |
|---|---|---|
| line / area / composed lines+areas | **REPLACE** | `states:[{when:{focus:'unmatched', source:'programmatic'}, style:{opacity: line 0.3 / area 0.6}, transition:{duration:400, easing:easeInOut}}]` on `lineY`/`areaY`; pointer-driven per-x styling stays with 03/04 geometry |
| bar (standalone + composed) | **REPLACE** | `states` on bar/rect marks, `when:{focus:'unmatched'}`, transition 150ms standalone / 120ms composed (preserve the deliberate split — carry both constants); custom bar marks (squares/track/depth/pulse) get identical states in their `createMark` initialization |
| candlestick | **REPLACE** | states on the custom candle mark initialization, `source:'programmatic'` (legend-only dim); delete both dim paths (imperative + props-driven `isWickDimmed`/`isBodyDimmed` converge on states) |
| scatter | **REPLACE + ACCEPT-WITH-LOG (blur)** | dot `states`: unmatched `{opacity:0.5}` @150ms, primary `{r: r*1.35}`; 2px blur has no native channel → authored mark `className` + container `data-bkm-focus` attr CSS as interim, logged D-entry + upstream ask (`filter` state channel) |
| pie / ring / gauge | **SANCTIONED-EXTENSION** | polar marks lack `states` → slices become/stay custom marks (`ScenePolyline/SceneArea.path` accept raw arc paths, `dist/types.d.ts:886-901`) with `states` in initialization: unmatched fade 0.4 (pie); ring active scale via geometry in 05. Native `pie` transform for accumulation |
| sankey | **REPLACE** | sankey mark is already `createMark` → predicate states: `when:(ctx)=> !isConnected(ctx.datum, ctx.focus)` → node 0.4 / link 0.1; connected-link ×1.3 as second predicate state |
| heatmap | **KEEP (already sanctioned)** | React-prop fade, zero reach-ins; optional later move to rect `states` in 6.4 if it deletes code |
| choropleth | **REPLACE** | delete DOM-reparenting wrapper; features as marks with predicate states dim @180ms ease-out. Hover-persistence quirk re-checked at gate — it was a replicated *bug-parity* behavior; if native focus loses it, D-log as intentional fix |
| live | **REPLACE** | states unmatched 0.25 keyed off native focus during scrub |
| focus strategies (bar/candle/scatter) | **KEEP** | already native `ChartFocusStrategy` |

## Deletion list (this subsystem's commit)

`hover-chrome.ts` dim paths (`syncDim` + callers), `bar-hover-chrome.ts:216-272`,
`candlestick-hover-chrome.ts` dim paths, `scatter-hover-chrome.ts` dim/clone machinery,
`pie-hover-chrome.ts`, `ring-hover-chrome.ts`, `sankey-hover-chrome.ts`,
`choropleth-hover-chrome.ts` dim wrapper. Files fully die only when 02/03 take their
tooltip/geometry halves — the commit ladder in go-to-plan sequences this.

## Open questions — resolved

- Dead code confirmed by agent: pie glow, ring fade+glow → delete, no replacement.
- No click-pin anywhere in bklit → no `pinned` selectors needed.
- Blur: attempted channels exhausted (`ChartMarkStateStyle` closed set; no focus classes stamped) → ACCEPT-WITH-LOG candidate with evidence above.
