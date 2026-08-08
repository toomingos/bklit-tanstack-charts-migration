# CandlestickChart — Phase 2 Refactor Plan (1.1 synthesis)

> Inputs: `research/phase-2/audits/candlestick-audit.md`, `research/phase-2/inventory/04-migrated-inventory.md` §1 caps+§4 #1/#2/#4/#6/#7/#8, `research/phase-2/tanstack-native/01-load.md`, `02-render.md`, `03-hooks-and-updates.md`, `04-interactivity.md`, `research/phase-2/bklitui-native/02-render.md` + `04-interactivity.md` (candlestick bisected hover), plus live reads of `migrated/charts/candlestick-chart.tsx` (826 ln), `migrated/charts/internal/candlestick-hover-chrome.ts` (445), `migrated/charts/internal/candle-spring.ts` (217), `migrated/charts/internal/bisect.ts` (38).

## Goal (Phase 2)

Move Candlestick closer to TanStack-native backend: remove wrappers/extra steps where TanStack already provides the mechanism, without losing bklit design (WICK_WIDTH 1.5, bodyWidthPx=min(candleWidth ?? slotWidth*0.8, slotWidth), rx 1, SOLID_POSITIVE/NEGATIVE, per-candle dim fadedOpacity 0.3 with wick-under-body compounding), animation (spring 0.8s bounce 0.15 via candle-spring WAAPI 60-sample + CSS fast path, 150ms opacity tween, stagger 0.6*animationDuration/n), or public API (data, xDataKey, candleGap/candleWidth, enterTransition, revealSignature, Grid/XAxis/YAxis/Tooltip carriers). Pilot retains plain-OHLC raw rendering (no decimation).

Non-goal: re-introducing decimation or stock lineCap:'round' marks (D85.1 reverted).

## Distilled overhead (non-redundant)

Audit §2+§3 flagged 6+6 patterns; consolidated into 3 families after dedup:

1. **Hover bypass** — audit §2 row 5 + §3 row 5 + §4 row 1. `definition` declares `focus:'group-x'`+`maxFocusDistance:Infinity` but `handleFocusGroupChange` is inert (`candlestick-chart.tsx:567-570` bypass). Real hover is native `pointermove` on `containerRef.current` (`candlestick-chart.tsx:596-661`) doing `container.querySelector("svg")` per move + `xScaleD3Ref.invert` + `bisectDateLeft`/`resolveNearestIndex` (bisect.ts strict `>`) + `hoverInputsRef` triplet stashing `xScale/yScale`/`renderData`. Duplicates TanStack `pointermove → clientToScene → resolvePointerFocus → updateFocus → onFocusGroupChange` (`tanstack-native/04-interactivity.md` §Pointer pipeline, `focus:'group-x'`).

2. **Sizing + scale + y-ticks duplication** — audit §2 rows 1/3/4 + §3 rows 1/3. Manual `ResizeObserver`+width state + `parseAspectRatio`→`heightPx` local duplicate, custom `ChartScale` x (`slotWidth/2` inset) + y hatch stashing refs, and `yAxisTicks` local `scaleLinear().domain(yDomain).nice().range([...])` duplicate of y `ChartScale.resolve()` (header `candlestick-chart.tsx:466-473` bar precedent). `slotWidth` computed twice (local + inside x resolve).

3. **Indexed clone + weak keys + reveal branching** — audit §3 rows 2/4/6 + §4 rows 2/3. `indexedRows = renderData.map(d=>({...d,__dataIdx:i}))` O(n) clone to feed `parseIdx` via `data-ts-key` suffix parsing; dual reveal WAAPI vs CSS `animationName "ts-candle-reveal"` gated on `enterBounce===0.15` exact float compare; `revealEpochRef`/`revealDeadlineTimerRef` local re-implementation of `ChartPhase` guard.

## Synthesis — what to change vs keep

### Change

**C1 — Wire bisected dates into a custom `ChartFocusStrategy` and delete manual `pointermove` listener.**
- Keep the same `bisectDateLeft`+`resolveNearestIndex` math (`internal/bisect.ts`) but move it inside `defineChart(spec, {focus: candlestickFocusStrategy, maxFocusDistance: Infinity})` (`types.ts:680` `ChartFocusStrategy{resolve,group,navigation}`).
- `attachCandlestickHoverChrome` then consumes only `onFocusGroupChange(ChartPoint[])` from TanStack (group-x by `xValue` date epoch ms; dates unique so grouping is 1:1) instead of the native listener + `hoverInputsRef` + `querySelector("svg")` per move + `xScale.invert` branch + inert `focus:'group-x'` stub.
- Strategy resolves nearest xValue by epoch ms distance using the same bisect semantics but expressed over `ChartPoint.xValue.getTime()`; `group` collects the mirrored wick+body points sharing that date; gate on `canInteractRef.current !== true → []` (mirroring prior `canInteract` boolean guard ported from bklit's `ChartProvider` ready check).

**Verification that C1 is TanStack-native:** `tanstack-native/04-interactivity.md` §Focus strategies lists custom `{resolve,group,navigation}` as the consumer path; audit §6 item 2 prescribes `focus:'group-x'` for candlestick with unique dates; no raw DOM query, no ref triplet.

**C2 — Collapse `indexedRows` clone; fix key/parse path.**
- Drop `indexedRows` spread; derive stagger index from mark `key` directly (`key: "wicks:"+i` / `"bodies:"+i`) and read `parseIdx` robustly from that known suffix (or drop `parseIdx` DOM parse entirely and rely on `ChartPoint.datumIndex`). Keeps chrome mapping 1:1 without extra O(n) clone — matters for M3a rapid data-update cost (audit §6 item 6).

**C3 — Soften CSS fast-path gate to epsilon compare.**
- Replace `enterBounce === DEFAULT_ENTER_BOUNCE` with `Math.abs(enterBounce - DEFAULT_ENTER_BOUNCE) < 1e-6` to avoid spurious WAAPI fallback on near-default bounce (audit §4 row 3 perf cliff).

### Keep (justified — do not absorb into TanStack stock)

**K1 — Two custom `createMark` rect groups (wicks+bodies).** Stock `link`/`rect` with `lineCap:'round'` cannot match bklit `<rect>` fills at both n=100 and n=1000 (D85.1 revert) — GAP-justified per `inventory §4 #1/#2` and `audit §2 row 4`. Keep.

**K2 — `candle-spring.ts` verbatim physics + 60-sample WAAPI (or CSS fast path).** Stock `animate:true` interpolates `transform: scaleY` but has no per-candle spring curve with bklit's `calcAngularFreq(undampedFreq**2)` quirk or 150ms opacity staging; keep as-is (audit K2) — same rationale as scatter/bar reveal retention.

**K3 — `slotWidth` inset `ChartScale` hatch for x.** Plain `scaleUtc().range([...])` is overwritten by `resolveConfiguredScale` (`tanstack-native/02-render.md`); `slotWidth/2` inset via object-with-`resolve` is the only surviving mechanism (same hatch as scatter xRangePadding and bar category band). Keep; collapsing to dynamic builder `(ctx)=>spec` is D3 deferred.

**K4 — Dual reveal + `revealEpochRef`/`revealDeadlineTimerRef` guard.** Mirrors bklit `revealSignature` deps `[animationDuration, revealSignature]` with DOM dataset guard so data-only updates SNAP; `canInteractRef` plain boolean is the `ChartPhase` ready check. Keep — collapsing to TanStack `hasRendered` gate would lose the epoch-arms-only-on-those-deps semantics (audit §3 row 5 retain).

### Defer

**D1 — Responsive builder `(ctx)=>spec` to eliminate local `heightPx`/`yAxisTicks` duplicate.** TanStack-native would compute `yDomain`/`heightPx`/ticks from `ctx.width/height` inside `defineChart((ctx)=>spec)` (`tanstack-native/01-load.md` §Data injection). Deferred for this slice — keep local `heightPx`/`yAxisTicks` independently-exact duplicate (bar precedent) to avoid re-proving tick parity under the gate.

**D2 — Indexed clone removal fully (C2 already trims it).** Further shrinking of wake-up indexing, not required this slice beyond C2.

**D3 — Consolidated sizing to `<Chart width|aspectRatio>` alone.** Keep manual `ResizeObserver` this slice; moving to host-owned sizing is a broader D3 sweep.

## Plan of work (ordered)

1. Implement C1 in `migrated/charts/candlestick-chart.tsx` + thin helper `migrated/charts/internal/candlestick-focus-strategy.ts` (or inline): build `candlestickFocusStrategy: ChartFocusStrategy<ChartDatum,Date,number>` whose `resolve(points,x,y,maxDistance)` reproduces `bisectDateLeft`/`resolveNearestIndex` over `points[].xValue.getTime()` with strict `>` tie-break and `canInteractRef !== true → []` gate; `group` collects mirrored wick+body points sharing same `xValue`. Wire as `defineChart(spec, {focus: candlestickFocusStrategy, maxFocusDistance: Infinity})`, set `<Chart onFocusGroupChange={adapter ChartPoint→CandlestickFocusPoint}>`, delete `container.addEventListener("pointermove"/"pointerleave")`, `hoverInputsRef`, `xScaleD3Ref` hover invert path, and the inert `handleFocusGroupChange` stub.

2. Implement C2+C3 alongside: remove `indexedRows` spread (keep `renderData` as source, derive `i` in marks via loop index), soften `useCssRevealFastPath` to epsilon compare, and update `handleRender` stagger to use loop index directly where needed.

3. Bench/QA gate per `research/phase-1/05-qa-and-benchmark-gates.md`: run `pnpm qa -- --chart candlestick --impl-a bklit --impl-b migrated --n 100` and `--n 1000` settled+hover 30/50/70. Expect Q1 ≤0.5% settled and hover tooltips detected (pre-refactor QA already PASS at n=100 settled 0.04%/hover ~0.23% and n=1000 settled 0.30%/hover up to 0.50% near line). If hover regresses, adjust `group` to include both wicks+bodies points for the resolved date.

4. Benchmark spotlight: M1a/M1c/M2a/M3a/M3c at n=100/1000 vs bklit; report medians before/after (custom marks + spring WAAPI remain, so gap-closure G2 is waived where no native T headroom).

5. Docs: update `docs/PROGRESS.md` Candlestick row and `docs/LOG.md` D108 with TanStack-native rationale.

## Questions before coding

- None blocking — bklit bisector semantics in `internal/bisect.ts`, TanStack custom `ChartFocusStrategy` contract in `types.ts:680`, and candlestick chrome's `CandlestickFocusPoint{datum,datumIndex,x,yValue,group}` already maps 1:1 to `ChartPoint`.

## Risks

- Custom `resolve` must filter `points` by focused `xValue` exactly — mismatch causes hover-50/70 drift. Mitigate by reusing `dateAccessor` epoch-ms comparison over `point.xValue.getTime()`.
- Removing manual listener must not drop the `canInteract` boolean gating. Replicate by returning `[]` from `resolve` when not ready.
- `indexedRows` removal must not break body/wick key identity used by `parseIdx` stagger — use mark key suffix directly or drop DOM parse entirely.

## Out of scope this slice

- Stock `link`/`rect` mark rewrite — K1 keeps custom marks.
- Spring/WAAPI reveal rewrite to `animate:true` — K2.
- Dynamic `(ctx)=>spec` sizing — D1.
- Wrapping filler chart back to candlestick — not in scope.
