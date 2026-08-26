# P4.1 executor notes (running log)

Insurance file per resume wrapper #2. Final report supersedes this.
Executor: P4.1 (T-C1 mapper kit + surviving T-C5 folds). Started once,
killed externally a few minutes in, resumed with work intact.

## Pre-kill dispatch verification (all re-derived from working tree)

### Importer greps at dispatch
- `hover-chrome.ts` importers = exactly TWO: `composed-chart.tsx:86`,
  `internal/use-hover-chrome.ts:14`. Wrapper §2a correction CONFIRMED;
  brief's pie/ring/funnel list is wrong (they import `pie-hover-chrome`
  instead). Matches wrapper's claim exactly.
- `radar-spring.ts` importers = TWO: `radar-chart.tsx:26-28` +
  `internal/enter-transition.ts:37`. enter-transition does NOT re-export
  either symbol (grep `estimateSpringSettleMs|sampleSpringProgress`: only
  imports + call sites). Wrapper §4 trap CONFIRMED as still true.
- Fold targets all single-importer AT DISPATCH:
  - tooltip-scheduler → only `tooltip-chrome.ts:19`
  - hover-reanchor → only `hover-chrome.ts:28` (line-chart.tsx:606 is a
    comment mentioning it, not an import)
  - x-ticks → only `x-axis-overlay.tsx:17` (bar-x-axis-overlay.tsx:5 is a
    comment; x-axis-overlay.tsx:5 also comment)
  - visx-pattern-bridge → only `pattern-preset.tsx:2`

### Decisions taken pre-kill (binding for resume)
1. radar-spring: LEAVE STANDALONE (still 2-importer; re-export variant =
   strictly more risk for zero gate-visible benefit, wrapper §4 explicitly
   accepts skip-with-reason).
2. MARKER_DIM_*: STALE CITATION, fold nothing. Names exist ONLY in
   hover-chrome.ts (38-40). NOTE: scatter-hover-chrome.ts:25-28 has
   value-identical twins (`DIM_OPACITY "0.5"`, `DIM_BLUR_PX 2`,
   `DIM_TRANSITION`, `ACTIVE_SCALE 1.35`) under DIFFERENT names — not a
   same-name cross-file duplicate; reported, not folded.
3. bar-hover-chrome.ts:376 stale bandWidth comment: KEPT — it documents a
   real, still-true deviation ("bandWidth was never populated by any caller")
   which line ~378 code confirms. It describes something real, so per
   "drop only if it describes nothing real" it stays.
4. LiveHoverConfig handling: generic structural type `TooltipMapperSource`
   (Omit<Partial<ChartTooltipConfig>,"indicatorFadeEdges"> & widened
   indicatorFadeEdges to IndicatorConfig["fadeEdges"]) — both configs satisfy
   it, no overload needed. LiveHoverConfig widens indicatorFadeEdges to
   `IndicatorFadeEdges | boolean` vs ChartTooltipConfig's enum-only.
5. candlestick: kit subset only (`toBoxConfig`,`toIndicatorConfig`) — NO
   forced no-op toDotConfig.

## Landed before kill (verified on disk after resume)
- NEW `internal/tooltip-mappers.ts` (60 lines): TooltipMapperSource +
  toDotConfig/toIndicatorConfig/toBoxConfig.
- hover-chrome.ts: mappers deleted, kit imported (line 27), Box/Dot/
  IndicatorConfig type imports dropped from tooltip-chrome import.
- bar-hover-chrome.ts: same treatment (line 20).
- candlestick-hover-chrome.ts: subset import (line 14), locals deleted.
- TSC_EXIT=0 on tree as-of-resume (lead-verified).

## Remaining work at resume
- [x] scatter-hover-chrome.ts: locals deleted, kit imported (:17-21); DotConfig/
      IndicatorConfig type imports dropped from tooltip-chrome import
      (ChartTooltipConfig still needed by resolveDotColor).
- [x] live-hover-chrome.ts: locals deleted, kit imported (:19-23); kept type-only
      `DotConfig, IndicatorConfig` import (:24) because LiveHoverConfig's OWN
      interface indexes DotConfig["variant"] / IndicatorConfig["width"|"fadeEdges"].
- [x] Fold 1: tooltip-scheduler → tooltip-chrome DONE (scheduler block now
      :20-110 of tooltip-chrome.ts; source stubbed to orphan note)
- [x] Fold 2: hover-reanchor → hover-chrome DONE (inlined :34-97; chart-phase
      import upgraded to value import `isChartInteractionPhase`; source stubbed)
- [x] Fold 3: x-ticks → x-axis-overlay DONE (inlined :18-302; source stubbed)
- [x] Fold 4: visx-pattern-bridge → pattern-preset DONE (passthroughs inlined
      as module-private fns :9-19; source stubbed)
- [x] Gate tsc #1: FAILED live-hover-chrome.ts(206,9) TS2304 updateDotPosition
      (I had over-pruned that import when deleting locals) → restored →
- [x] Gate tsc #2: TSC_EXIT=0
- [x] QA all six cells PASS (sequential, port 5198):
      bar 100:        settled 0.0000 · hover-30 0.0000 · hover-50 0.0757 ·
                      hover-70 0.1243  ← byte-identical to lead's fresh baseline
      candlestick 1000: 0.3025 / 0.4962 / 0.3927 / 0.3627 (all ≤ gate)
      scatter 1000:   0.4509 / 0.0000 / 0.1252 / 0.2968
      liveline 100:   0.0181 / 0.0539 / 0.0912 / 0.1145
      composed 1000:  0.0845 / 0.0000 / 0.0766 / 0.1804
      pie 1000:       0.0092 / 0.0000 / 0.0000 / 0.0007 (tooltipA/B=false —
                      pie has no DOM tooltip; expected)
- [x] Final greps: zero imports of the four folded modules remain; kit imported
      at all five chrome sites; folded symbols present in their targets.
- STATUS: COMPLETE. Awaiting lead deletion of the four orphan stubs.

## Orphans awaiting lead deletion (D216)
- internal/tooltip-scheduler.ts (stubbed with FOLDED note)
- internal/hover-reanchor.ts (stubbed)
- internal/x-ticks.ts (stubbed)
- internal/visx-pattern-bridge.tsx (stubbed)

## Temp files created by this executor
- research/phase-4/wave-tasks/P4-01-executor-notes.md (this insurance file,
  per resume wrapper; keep or fold into LOG.md)
