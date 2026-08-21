# Initiative 5 — Chart hooks + interaction phase (plan-loop-1) — FINAL

Status: FINAL (synthesized 2026-08-19 from two Explore audits — bklit hook inventory + migrated phase/interaction survey — plus lead verify-at-finalize greps; supersedes the thin `research/phase-3/audits/05-interaction-phase.md`).

Scope (D200 item 5): `useChartInteraction` / `useChartPhaseOrchestrator` / `useScheduledTooltip` — phase + interaction consolidation. Executor: cmd-executor fallback (opencode credit-blocked, re-probed at this boundary: identical 401 CreditsError).

## Ground truth (bklit, verified file:line)

### useScheduledTooltip — `repos/bklit-ui/packages/ui/src/charts/use-scheduled-tooltip.ts:29-97` (INTERNAL — not in bklit's public barrel)
- `useScheduledTooltip<T>(): { tooltipData, setTooltipData, scheduleTooltip(tooltip, dedupeKey?), clearTooltip, resetTooltipDedupe }`, no params.
- rAF-coalesced commit: at most ONE rAF in flight; `pendingRef` last-write-wins, read at rAF fire time; double dedupe (schedule-time vs committed key `lastKeyRef`, and again at commit time). `defaultDedupeKey` = `${index}:${Math.round(x)}` when tooltip has numeric `index` (+numeric `x`), else `String(index)`, else `JSON.stringify`.
- `clearTooltip` SYNCHRONOUS: cancel rAF, null pending/pendingKey/lastKey refs, `setTooltipData(null)` immediately. `resetTooltipDedupe` nulls only `lastKeyRef`. Unmount cancels pending rAF. NO ms constants — pure rAF cadence.
- bklit consumers: `useChartInteraction` (internal), `useScatterChartInteraction` (sibling clone), `bar-chart.tsx:197-198` direct.

### useChartInteraction — `use-chart-interaction.ts:1-352` (PUBLIC: barrel `index.ts:608-609` exports it + `type ChartSelection`)
- Params `{ xScale, yScale, yScales, data, lines, margin, xAccessor, bisectDate, canInteract }`; returns `{ tooltipData, setTooltipData, selection, clearSelection, interactionHandlers (7, `{}` when !canInteract), interactionStyle { cursor: canInteract?"crosshair":"default", touchAction:"none" } }`.
- `ChartSelection { startX, endX, startIndex, endIndex, active }` — drag/2-touch box-select; mouseup ALWAYS `setSelection(null)`.
- resolveTooltipFromX: invert + `bisectDate(data, x0, 1)` + nearest of d0/d1 by time delta; yPositions via `yScales[normalizeYAxisId(line.yAxisId)] ?? yScale`.
- Re-anchoring effect (`:314-325`): when scale/data identity or `canInteract` changes and `lastHoveredXRef` non-null → re-project px, `scheduleTooltip(tooltip, "${index}:${Math.round(x)}")`, else `clearTooltip()`. Comment: "Re-anchor tooltip/crosshair when x-scale or visible data changes (e.g. brush zoom commit)."
- Consumers: `time-series-chart-shell.tsx:408-425` (line/area/composed; `canInteract = isLoaded && isChartInteractionPhase(chartPhase)` at `:406`); `candlestick-chart.tsx:209-226` (`canInteract` = LOCAL `isLoaded` + setTimeout — candlestick does NOT use the orchestrator); scatter uses sibling `useScatterChartInteraction` with local `isLoaded`.

### useChartPhaseOrchestrator — `use-chart-phase-orchestrator.ts:1-183` (INTERNAL — not in barrel; SOLE consumer `time-series-chart-shell.tsx:236-253` = line/area/composed)
- Options `{ chartStatus, targetData, skeletonData, animationDuration, yDomainTweenDuration, revealSignature?="", skipEnterReveal?=false }`; returns `{ chartPhase, plotData, revealEpoch, concealEpoch, isLoaded, notifyLoadingPulseComplete, notifyRevealConcealComplete, notifyYDomainTweenComplete }`.
- `ChartPhase` (chart-phase.ts:12-20): `loading | exiting | gridTweenReady | revealing | ready | exitingReady | gridTweenLoading | revealingLoading` (last declared, never assigned — reserved).
- Edge-triggered status machine (prevStatusRef guard):
  - loading→ready: `isLoaded=false`; `animationDuration<=0 ? (yTween<=0 ? plotData=target + "revealing" : "gridTweenReady") : "exiting"`.
  - ready→loading: `isLoaded=false`; `animationDuration<=0 ? (yTween<=0 ? plotData=skeleton + "loading" : "gridTweenLoading") : concealEpoch++ + "exitingReady"`.
- revealSignature replay: only when `!skipEnterReveal && chartStatus==="ready" && phaseRef.current==="ready"` → `"revealing"` + `isLoaded=false`.
- plotData sync: `loading`(guarded on status)/`exiting` → skeleton; `exitingReady|gridTween*|revealing|ready` → target.
- Notify callbacks (useCallback `[]`, phaseRef-guarded): pulseComplete `exiting→gridTweenReady`; revealConcealComplete `exitingReady→gridTweenLoading`; yDomainTweenComplete `gridTweenLoading→loading` / `gridTweenReady→revealing`.
- `"revealing"` entry: `revealEpoch++`; `animationDuration<=0` → `"ready"`+`isLoaded` sync, else `window.setTimeout(animationDuration)` → `"ready"`+`isLoaded=true`, clearTimeout cleanup.
- Constants (chart-phase.ts): `DEFAULT_CHART_STATUS="ready"`, `DEFAULT_Y_DOMAIN_TWEEN_MS=500`, `Y_DOMAIN_TWEEN_SKIP_THRESHOLD=0.02` (used by `y-domain-utils.ts:19-31` shouldTweenYDomain: `span=max(spans,1)`, tween iff either endpoint delta/span ≥ 0.02), `resolveRestingChartPhase`, `isChartInteractionPhase = (phase==="ready")`, `DEFAULT_CHART_LIFECYCLE` (`:39-53`).
- Collaborator `useAnimatedYDomains` (use-animated-y-domains.ts:124-242): motion/react tween, ease `[0.85,0,0.15,1]`, tweens ONLY in gridTween* phases, snaps otherwise, `onSettled` → notifyYDomainTweenComplete (instant-snap paths also call onSettled).

## Migrated today (verified)

- FOUR phase shapes: (1) `ChartPhase` union in `internal/types.ts:10-18` + per-chart `phaseRef`/`setPhase` (line:90, area:113-120, bar:127-139 starts "revealing", scatter:98-109 starts "revealing", composed:298 starts "loading" — bklit-parity, no status prop, comment composed-chart.tsx:39-40); (2) candlestick boolean `canInteractRef` (candlestick-chart.tsx:131,471-501) — MIRRORS bklit candlestick's local isLoaded, NOT a defect; (3) narrow local unions (sunburst:124; `HeatmapChartPhase` heatmap-lifecycle.ts:6) — match their bespoke bklit counterparts, OUT OF SCOPE; (4) coordinator charts (pie/ring/radar/funnel) + no-phase charts (sankey/choropleth/gauge/liveline) — OUT OF SCOPE.
- Ready-gates duplicated: line-chart.tsx:297-300, area-chart.tsx:376-378, bar-focus-strategy.ts (phaseRef check), scatter-focus-strategy.ts (same), candlestick-focus-strategy.ts:31 (boolean), composed-chart.tsx:688-758 own pointermove (bklit-parity bisector; TanStack focus callback deliberately inert :672-675).
- Reveal sequencing: line/area inline WAAPI (line-chart.tsx:307-335: `bkmRevealed` guard → setPhase("revealing") → `marks.animate(clipPath inset)` → onfinish setPhase("ready")); bar/scatter/composed/candlestick via `internal/deferred-reveal.ts` (`onPostPaint` rAF→rAF→setTimeout(0), `setRevealDeadline`).
- NO scheduled-tooltip primitive anywhere; content-portal commit in `tooltip-chrome.ts` `applyBoxContent` (:395-418) is key-gated (`lastContentKey`, key = `${index}:${JSON.stringify(point)}`) but NOT rAF-coalesced.
- `internal/use-*` hooks: use-chart-margin, use-container-size (×4 hooks), use-prefers-reduced-motion.
- Migrated exports NONE of the three hooks; zero showcase consumers of `useChartInteraction`/`ChartSelection` (lead grep).

## Rulings (lead, to be recorded in the gate D-entry)

1. **`useChartInteraction` public export NOT adopted** — D210-D2 class: TanStack focus owns hover state in the migrated stack; zero showcase consumers; the hook's remaining unique machinery (drag/2-touch `ChartSelection`) ships with initiative 9 (ChartBrush), where a selection surface actually exists. Its pixel-relevant internals (nearest-point bisector, yPositions mapping, ready-gating) are already ported into the focus strategies/chromes.
2. **`useScheduledTooltip` ported as plain-TS `createTooltipScheduler`** (internal) — bklit keeps it internal; migrated chromes are plain TS (D10/D16/D22 imperative-chrome doctrine), so the React hook form is unnecessary; behavioral content (rAF coalesce, double dedupe, synchronous clear, last-write-wins pending) ports 1:1.
3. **Candlestick's boolean gate retained** — mirrors bklit candlestick's local `isLoaded` (bklit does not run the orchestrator there); normalizing onto ChartPhase would be a structural deviation.
4. **Orchestrator adopted with `skeletonData: []`** — bklit's skeleton data generators are initiative 12 per D214's deferral; `[]` reproduces the current loading render (marks gated to `[]`) exactly.
5. **`notifyYDomainTweenComplete` short-circuit** — migrated has no `useAnimatedYDomains` yet (loading-dynamics parity deferred D213/D214); gridTween phases must call the notify immediately after a synchronous domain snap (bklit's own instant-snap path also calls `onSettled` immediately). Initiative 12 replaces the snap with the real tween. Machine topology and resting states stay 1:1.
6. Sunburst/heatmap/coordinator/no-phase charts: out of initiative-5 scope (their bespoke lifecycles mirror bespoke bklit counterparts). `spatialIndex`: skip, per the standing initiative-4 ruling 2.

## Deliverables (one executor dispatch, one diff)

**D1 — `internal/chart-phase.ts` single source.** Port bklit `chart-phase.ts` 1:1: `ChartStatus`, `ChartPhase` (8-value union — MOVE from types.ts:10-18; types.ts re-exports for compat), `DEFAULT_CHART_STATUS`, `DEFAULT_Y_DOMAIN_TWEEN_MS=500`, `Y_DOMAIN_TWEEN_SKIP_THRESHOLD=0.02`, `resolveRestingChartPhase`, `isChartInteractionPhase`, `DEFAULT_CHART_LIFECYCLE`. Route every `phaseRef.current !== "ready"` / `=== "ready"` gate in line/area/bar/scatter/composed (chart files + bar/scatter focus strategies) through `isChartInteractionPhase`. Candlestick untouched (ruling 3).

**D2 — `internal/use-chart-phase-orchestrator.ts` 1:1 port + adoption in line/area/composed.** Port the hook exactly as specified in Ground truth (state machine, refs, notify guards, revealing timer with cleanup, plotData sync, revealSignature replay). Adopt in line-chart, area-chart, composed-chart, replacing their hand-rolled `phaseRef`/`setPhase` + status wiring:
- `chartStatus` = existing `status` prop (line/area); composed = constant `"ready"` (LEAD-VERIFIED: bklit composed renders `TimeSeriesChartInner` with no chartStatus → shell default `DEFAULT_CHART_STATUS="ready"`; the orchestrator's revealSignature effect at `use-chart-phase-orchestrator.ts:89-103` has NO first-run skip, so it fires on mount: phase init `"ready"` → `"revealing"` + `isLoaded=false` → `setTimeout(animationDuration)` → `"ready"` + `isLoaded=true`. THAT is bklit's mount reveal + interaction gate — the port must preserve this mount-run behavior exactly; do not add a first-run guard). Migrated composed's current `"loading"` init is replaced by this identical-behavior wiring.
- `targetData` = current renderData source, `skeletonData: []` (ruling 4), `animationDuration`/`yDomainTweenDuration` from existing props/defaults (`DEFAULT_Y_DOMAIN_TWEEN_MS`), `revealSignature` unused today (`""`).
- WAAPI reveal keyed on `revealEpoch`: the existing `marks.animate` clip reveal runs on `"revealing"` entry per epoch (replaces the `bkmRevealed` dataset guard for these three charts); `onfinish` no longer sets phase — the orchestrator's `animationDuration` timer owns `"revealing"→"ready"` (bklit parity). Keep the `prefers-reduced-motion`/`animationDuration<=0` snap path.
- Loading chrome wiring: loading-pulse exit completion (loading-chrome exit animation end) → `notifyLoadingPulseComplete`; reveal-conceal completion → `notifyRevealConcealComplete` (concealEpoch keys a conceal clip if one exists today; if none exists, call the notify immediately on `"exitingReady"` entry — snap semantics, ruling 5 analog — and note it); gridTween phases → synchronous snap + immediate `notifyYDomainTweenComplete` (ruling 5).
- `canInteract` per chart = `isLoaded && isChartInteractionPhase(chartPhase)` exactly as bklit `:406`.
- PIXEL MANDATE: at rest and during the default enter reveal, output must be pixel-identical — Q1 baselines below are the acceptance test, including the three loading states.

**D3 — `internal/tooltip-scheduler.ts`.** Plain-TS port of useScheduledTooltip semantics (ruling 2): `createTooltipScheduler<T>({ commit(t: T|null): void })` with `schedule(tooltip, dedupeKey?)`, `clear()`, `resetDedupe()`, `dispose()`; identical coalesce/dedupe/synchronous-clear rules and `defaultDedupeKey`. Wire it into the content-portal commit path: `applyBoxContent`'s custom-content render (`tooltip-chrome.ts:404-418`) currently re-renders synchronously per chrome update when the key changes — route the React `.render()` commits (content + children roots) through one scheduler per box so commits coalesce to ≤1/frame (bklit cadence), while all non-React DOM writes stay synchronous (pixel-neutral by construction: same frame, same paint). Apply in both hover-chrome and live-hover-chrome box paths if they call applyBoxContent separately.

**D4 — re-anchor parity.** Port the `:314-325` re-anchoring semantics for line/area/composed (the charts whose bklit shells re-anchor): when render data or x-scale identity changes while a hover is active (chrome holds last pointer x), re-resolve the focused points and re-drive the chrome (equivalent of scheduleTooltip with key `${index}:${Math.round(x)}`); when resolution fails, clear the chrome (tooltip hide). Implement ONCE in shared internal code (hover-chrome or a small helper), not per chart. If this produces ANY Q1 drift, stop and report rather than tuning.

**D5 — exports/types.** No new public exports (rulings 1–2). `check-types` must show `ChartPhase` consumers unchanged via the types.ts re-export.

## Boundaries (unchanged)
Executor must not modify `qa/`, `bench/` (except nothing is expected there this initiative), `repos/bklit-ui/`, `showcase/repos/tanstack-charts/`; no `/tmp`. Guard hook armed.

## Gates (lead re-runs everything on final code)
- Q3 greps: phase constants single-sourced in `internal/chart-phase.ts`; no spring/ms literals leak outside `internal/`; no deep imports.
- Type parity: `pnpm --dir showcase check-types` + `lint` exit 0.
- Q1 (frozen baselines, n=100 unless noted; cite run ids): line 0.0000 + hovers ≤0.0005; area 0.0002 + ≤0.0017; bar 0.0000 + ≤0.0017; scatter 0.1230 + 0.0000; candlestick 0.0354 + 0.2345/0.2341/0.2325; composed settled 0.199–0.261 band + ≤0.0041; liveline settled 0.017–0.046 + hovers ≤0.15; heatmap 0.4277 (n=52); pie 0.0000 (n=50). Loading states (`--state loading`): line ≤0.1345, area ≤0.0490, heatmap ≤0.1948 + lead PNG eyeball. Known pre-existing FAILs (heatmap hovers ~0.52–0.59 D208-5, pie hover-30 ~3.11 D208-2) reported, not fixed.
- Q2: `node qa/console-errors.mjs` zero errors (D208-8 warnings excluded).
- G1–G4: render/phase path changed → full 16-run sweep ×(7 tooltip charts n=100 + heatmap n=52); D215 conditions: re-check scatter m1a (was 83.8% noise-adjacent) and heatmap m1a (waiver band 80.8–82.4%).

## Executor report contract
Exact per-file diff summary; verbatim verify outputs with `qa/results/<chart>/<run-id>` on every QA line (frozen baselines embedded above — any number above them is a defect in the change; fix before reporting); `git status --porcelain` boundary self-check; anything observed but not changed.
