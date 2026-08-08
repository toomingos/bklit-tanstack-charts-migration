# LiveLineChart — Phase 2 Refactor Plan (1.1 synthesis)

> Inputs: `research/phase-2/audits/live-line-audit.md`, `research/phase-2/inventory/04-migrated-inventory.md` §1+§4, `research/phase-2/tanstack-native/01-load.md` + `02-render.md` + `03-hooks-and-updates.md` + `04-interactivity.md` + `05-stack.md`, live `migrated/charts/live-line-chart.tsx` (958) + `internal/live-line-mark.ts` + `internal/live-hover-chrome.ts` (547).

## Goal
LiveLine is the highest-cost streaming chart and architecturally isolated: the continuous rAF lerp + tip chrome dominate. Goal is TanStack-native, non-custom migration without bklit parity drift and without re-adding the wrapped complexity that Phase 2 targets.

## Distilled overhead (audit non-redundant)

- ~20% TanStack-native today: bundled `liveLineMark` inside `defineChart→<Chart animate:false>`.
- ~80% custom/imperative: rAF loop, synthetic tip points, dual-scale hover resolution, imperative `LiveHoverChrome` + 5 SVG overlay children, dual `ResizeObserver`, seven refs.
- `liveLineMark` partial justification: one `createMark` deduplicates x/y channels vs two stock `lineY+areaY`; G4 heap still relevant.
- Hovers/spins outside host: pointer listeners bypass `focus→paintFocus/paintTooltip`, chrome duplicates bklit's tooltip pipeline.

## Synthesis — Keep / Defer / Change

### Keep (justified GAPs — not TanStack rewrite this phase)
- `K1` `liveLineMark` bundled `area+polyline` (audit §2 row 2 partial-just; retain with GAP note; revisit only if G4 margin shrinks).
- `K2` Synthetic trailing tip points at `frame.now / frame.now+xTickUnitMs` (audit §2 row 6 JUSTIFIED — window-edge interpolation).
- `K3` `pickNiceInterval` hysteresis + `edgeOpacity`/`EDGE_FADE_PX` + `detectMomentum` (audit §2 rows 8/10 JUSTIFIED — bklit `live-y-axis.tsx` / `live-line.tsx` verbatim).
- `K4` `extractLiveLineChildren` dedicated walker (audit §3 row L JUSTIFIED — role isolation).
- `K5` Throttled `LIVE_FRAME_COMMIT_MS=32` commit + `PAUSED_FRAME_PIXEL_THRESHOLD=0.25` lerp still advances while paused (deliberate bench M3b point; keep).

### Defer (cross-chart sweeps, not single-file plan)
- `D1` Full host-scoped sizing (`<Chart width height>` + responsive spec) — defer until time-series sizing sweep can absorb `innerWidth/innerHeight` contract (Line/Area/Composed share it).
- `D2` Five tip SVG overlay collapse into TanStack `ruleY/dot/text` marks — defer unless SMIL/pulse diverges; overlay remains plain SVG reconciled outside host this phase.
- `D3` Move y-domain lerp into `defineChart animate` — defer; asymmetric contract (instant expand, 0.08 exponential contract) is non-TanStack and gate-sensitive.

### Change — tight C this slice (TanStack-native, no parity drift)

**C1 — Roots + groups lifecycle fix.** `attachLiveHoverChrome` `boxCustom` root is `createRoot` per `show→hide→show`; stale `customRoot` stays hidden then double-mounts. Fix: scope `customRoot` init to chrome instance id (once per attach) and tear down only in `detach()`; keep `lastContentKey` render guard. Prevents leak at ~30fps.

**C2 — Live hover rAF stall + per-tick alloc fix.** (a) Paused branch `if (paused && pixelChange<THRESH) return` without re-arm dead-ends the loop when `targetRange` is unchanged — fix with `wakeLoopRef` re-arm on that path + ensure `data` still flows (audit §4 row 2). (b) Per raw tick `dataRef.filter(...).push synthetic×2` (60/s, N~500) adds GC churn — hoist filtered view via `bisectTime`-windowed `contextData` slice already computed for rendering, reuse it in hover path instead of allocating a fresh filtered copy (audit §4 row 3).

**C3 — Pointer-space/margin staleness hardening.** `cursorX` captured inner-space but `chromeMargin` read from possibly-stale `chromeConfigRef.margin` across the 32 ms commit window; harden by snapshotting `margin` synchronously on pointer move and closing tick over that snapshot (or by routing hover point through the same `innerWidth/innerHeight` derived scales via `ChartScaleRef`). Small fix, visible drift when prop `margin` changes under pause.

**C4 — Tick transition race guard.** New tick sets `opacity 0 → rAF→ transition` but second `updateFrame` before rAF can clobber the transition setup. Guard by applying the 220ms opacity transition synchronously when scheduling, or by queuing a single pending rAF per tick.

## Execution (1.2)
- Single file + `internal/live-hover-chrome.ts` patch; `npm run build --prefix bench/app` green; QA `node qa/screenshot.mjs --chart live-line` (`impl-a bklit --impl-b migrated n=100` + `n=1000`) + pair `line` spot to confirm hover chrome isolation.

## Risks
- Minimal: fixes are in rAF/hover hot path but no `defineChart`/`mark` contract changes; fall back to current behavior on regression.

## Questions open
- None blocking — verify before/after QA deltas and hover fraction runs.
