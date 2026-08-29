# Phase 6 go-to-plan (source of truth for 6.3+)

Orchestrator-authored, 2026-08-27. Merges 01–08. Once 6.3 starts, this file — not the 6.1
reports — is the reference (staleness rule, PLAN-phase-6.md).

## Commit ladder (bisect order)

Six commits, not seven: **S7 (legend coupling) is folded into C1** because S1's deletions
remove `syncDim`/`chromeStateRef` — the exact functions the legend effects call. Splitting them
would leave C1 untypecheckable or force throwaway stubs; merged, C1 is one coherent mechanism
(focus-driven styling, pointer + programmatic).

| Commit | Scope | Key deletions inside the commit |
|---|---|---|
| **C1 `states+legend`** | mark `states` on all Cartesian marks; custom-mark states in initializations (candle, bar family, sankey, pie/ring arcs, choropleth features); legend hover → `setControlledFocus(…, {source:'programmatic'})` via `onRender` controller; cross-chart sync via broadcast → `setControlledFocus`; scatter blur interim (`bkm` className + container attr CSS) | dim halves of hover-chrome/bar-/candlestick-/scatter-/pie-/ring-/sankey-/choropleth-hover-chrome; candlestick props-dim path; `chromeStateRef` plumbing in 5 charts |
| **C2 `tooltip`** | native `tooltip` ext + `renderTooltipBody` (existing `TooltipContent`/mappers as body); `sticky:false`; `placement:['right','left']`+offset; `motion:false` when ≥60 points; heatmap 120ms via debounced controlled focus | `tooltip-chrome.ts` (whole file); bespoke panel builders in pie/ring/sankey/heatmap chromes (funnel untouched) |
| **C3 `hover-geometry`** | native `crosshair` (gradient stroke via app `<defs>`), `whenFocused` dots/bands, reactive highlight-band slice, date pill from `onFocusGroupChange`, sankey/heatmap hit-tests → `clientToScene`, radar hover `r` → states/`whenFocused` | geometry halves of all hover-chromes; **hover-chrome.ts + use-hover-chrome.ts deleted here**; scatter/candle chrome files deleted |
| **C4 `axes`** | native axes: `ticks.values` fed by existing pure optimizers, `format`, `tickLabels{fontSize:12, opacity fade fn, motion}`; secondary-y via projector (kept); explicit margins where load-bearing | `x-axis-overlay.tsx`, `y-axis-overlay.tsx`, `bar-x-axis-overlay.tsx`, `y-axis-ticks.ts`, overlay scale duplicates, `data-bkm-xlabel` |
| **C5 `motion+reveals`** | `motion()` renderer everywhere; native enter (bars/candles/arcs/radial), `stagger()`, per-datum delays; candle spring via kept solver; pie grow / sunburst zoom as reactive definitions; sankey dash-sweep + bar-pulse wave moved inside mark renderers; live rolling-path contract; wipe reveal = single `onRender` helper (ACCEPT-WITH-LOG D420); authored-mark class rename `ts-chart__*`→`bkm-chart__*` + styles.css update | `spring.ts`, `candle-spring.ts` (solver kept), `enter-transition.ts`, `deferred-reveal.ts`, `chart-reveal-clip.tsx`, `sunburst-reveal.ts`, `native-stagger.ts`, `bezier-easing.ts`, `radar-spring.ts`, `radar-reveal.ts` reach-ins, per-chart reveal blocks (radar's pre-centralization stamps incl.), `dash-tail.ts` → authored mark |
| **C6 `brush+zoom+selection`** | two-host `brushX` (strip host, `values` snapping/keyboard); pill visuals via CSS on `ts-chart__handle-x` + app overlay for blur/pattern; choropleth zoom → projection params in definition (**spike first**; fallback D-logged transform via `onRender` svg); `chart-selection` keeps gesture, scales → `clientToScene` | `brush-drag.ts`, `brush-layout.tsx`, `chart-brush.tsx` internals, zoom-engine transform half + inverse-matrix hit-test, selection scale duplicates |

Typecheck + `next build` after every commit. No QA/bench until 6.5.

**6.3 amendments (orchestrator, pre-C1):**
- React `<Chart>` mounts the **static SVG renderer** (`dist/react/Chart.js:13-16`); the motion
  renderer attaches via `RendererChart` + `motion()` (`@tanstack/charts/react`). The renderer
  switch is C5's first task; C1–C4 state/tick transitions are declared but snap until then —
  expected inside the big-bang window.
- `{focus:'unmatched'}` selector is **group-scoped** (`dist/mark-state.js:104`); under group-x
  focus every series owns a group point. Series dim uses the `whenSeriesDimmed()` predicate
  (`internal/focus-injection.ts`, orchestrator-authored) — `!matches('series')`, where 'series'
  compares `point.group` (`dist/focus-layer.js:240-241`).
- `geo` marks have **no `states`** (`dist/geo.d.ts:17-35`) — choropleth dim is a reactive
  definition (per-datum `fill` alpha via `onFocusChange` state), not predicate states. Same
  fallback applies to any library-native polar/hierarchy mark an executor finds stateless.

## Per-chart × subsystem matrix

R = replace native · SE = sanctioned extension · AWL = accept-with-log · K = keep · — = n/a

| Chart | C1 states+legend | C2 tooltip | C3 geometry | C4 axes | C5 motion | C6 brush/zoom |
|---|---|---|---|---|---|---|
| line | R (dim 0.3/400ms) | R | R | R | AWL wipe + R dots | R brush |
| area | R (0.6/400ms) | R | R | R | AWL wipe | R brush |
| composed | R (bars 120ms) | R | R | R (projector K) | AWL wipe | SE selection |
| bar | R (150ms) | R | R band | R (modulo values) | R growth+stagger; pulse K-in-mark | — |
| candlestick | R (programmatic-only) | R | R | R | R spring growth | SE selection |
| scatter | R + AWL blur | R | R | R | R stagger | SE selection |
| live | R (0.25) | R | R | R | R rolling (loop stays app) | — |
| pie | SE mark-states (0.4) | R | — | — | R sweep + reactive grow | — |
| ring | SE mark-states | R | — | — | R sweep + stagger; scale 1.03 reactive | — |
| gauge | — | — | — | — | R arc sweep | — |
| sunburst | SE mark-states | — | — | — | R sweep + keyed zoom morph | — |
| radar | R (dot r states) | — (tooltip:false) | R | — | R (delete radar-spring/reveal) | — |
| sankey | R predicate states | R | R (clientToScene) | — | SE dash-sweep in-mark | — |
| heatmap | K (props) | R + SE hideDelay | R hit-test | — | R reveal | — |
| choropleth | R predicate states | R | R | — | R reveal | R projection (spike) / AWL fallback |
| funnel | — out of scope (D30/D54) — panel + chrome untouched | | | | | |

## Survivors (explicitly kept)

Focus strategies (bar/candle/scatter — already native), `y-domain.ts` (domain policy +
projector), `selectEvenlySpacedIndices` + modulo thinning (pure, feed `ticks.values`),
candle duration/bounce→stiffness/damping solver, `decimate.ts`, live data loop + y-lerp policy,
`tooltip-components.tsx`/`tooltip-mappers.ts`/`marker-tooltip.tsx` (body renderers, public API),
legend UI + `chart-legend-hover` context (public API), `chart-focus-kit`/broadcast (shrunk to
focus fan-out), date pill/odometer (app UI), gradients.tsx defs, loading/funnel untouched.

## Collision check (why this order is safe)

- hover-chrome.ts is co-owned by C1 (dim) / C3 (geometry) / C4 (label fade): C1 removes dim
  paths only; C3 deletes the file — the label-fade block dies with it, and C4 restores the fade
  natively. Interim gap is invisible (no QA between commits).
- tooltip-chrome (C2) consumes `data-bkm-xlabel` from overlays deleted in C4 — safe order
  (consumer dies before producer).
- C5's class rename touches styles.css + all mark files — after C1–C3 removed the queries that
  depended on the shared `ts-chart__` aliasing; before C6 (no overlap).
- C6 touches only brush/zoom/selection files + line/area/candle/scatter/composed shells — no
  overlap with C5's internals.
- Within each commit, per-chart executors are file-disjoint; shared internals go to a single
  agent; orchestrator commits after typecheck.

## ACCEPT-WITH-LOG register (D-entries at commit time)

| # | Deviation | Evidence |
|---|---|---|
| D420 | line/area/composed wipe reveal — one `onRender`-scoped clip helper; upstream ask `motion.enter:'wipe'` | 05, motion.md:55-58 |
| D421 | scatter inactive 2px blur via authored className CSS — no `filter` state channel; upstream ask | 01, types.d.ts:73-89 |
| D422 | brush keyboard+snapping arrive (legacy had neither) — intentional improvement, not parity break | 06 |
| D423 | choropleth hover-persistence quirk may not survive native focus — bug-parity intentionally dropped if so | 01 |
| (cond.) | choropleth transform fallback if projection spike <30fps | 06 |
| (cond.) | axis SVG-vs-HTML antialiasing if pixel gate >0.5% | 04 |
