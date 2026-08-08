# BarChart — Phase 2 Refactor Plan (1.1 synthesis)

> Inputs: `research/phase-2/audits/bar-audit.md`, `research/phase-2/inventory/04-migrated-inventory.md` §1 caps+§4 #3/#4/#6/#7/#8, `research/phase-2/tanstack-native/01-load.md` (host sizing + adapter layout), `02-render.md` (scene→string→reconcile, `data-ts-key` identity), `03-hooks-and-updates.md` (definition ref + `resolveAnimation`), `04-interactivity.md` (focus presets + `ChartFocusStrategy` + pointer pipeline), `05-stack.md` (`d3-scale`).
> `research/phase-2/bklitui-native/02-render.md` (Bar fan-out + margins), `04-interactivity.md` (Bar `handleMouseMove` band-index), `01-load.md` (Bar `extractBarConfigs`), plus live reads of `migrated/charts/bar-chart.tsx` (542 ln), `migrated/charts/internal/bar-hover-chrome.ts` (455), `migrated/charts/internal/bar-x-axis-overlay.tsx` (90), `migrated/charts/internal/deferred-reveal.ts` (151).

## Goal (Phase 2)

Move Bar closer to TanStack-native backend: remove wrappers/extra steps where TanStack already provides the mechanism, without losing bklit design (grouped `individualBarWidth` with `GROUP_GAP=4`, `cornerRadius` per `lineCap`, per-category `opacity 0.3 / 0.15s` dim, crosshair/dot/box/pill springs, `BarXAxisLabel` centered modulo-thinned ticks), animation (1100 ms `cubic-bezier(0.85,0,0.15,1)` per-bar WAAPI stagger `0.4*animationDuration` deferred via `onPostPaint`), or public API (`data`, `xDataKey`, `margin`, `aspectRatio`, `barGap`, `children: Bar/Grid/BarXAxis/Tooltip` carriers). Pilot remains vertical grouped only (no stacked/horizontal/perspective — documented gap).

Non-goal: widening pilot to stacked/horizontal branches or introducing a bklit `BarDepth`/`BarSquares` parity.

## Distilled overhead (non-redundant)

Audit §2+§3 listed 5 non-native + 6 wrapper flags + 6 broken/design rows. Consolidated into 4 families after dedup:

1. **Hover bypass + parallel scales** — audit §2 row 4 + §3 row 5 + §4 rows 2/5. `definition` declares `animate:false` and no `focus` at all; real hover is native `pointermove` listener on the host (`bar-chart.tsx:324-423`) doing band-index arithmetic `Math.floor((pointX-margin.left)/columnWidth)` with `columnWidth = innerWidth/renderData.length` (ignores `scaleBand.padding(barGap)` outer padding — audit §4 row 2 drift) + `container.querySelector("svg")` per move + `hoverInputsRef` triplet + `setCategoryHover` `querySelectorAll rect → style.opacity` O(totalBars) per `pointermove` (no rAF coalesce — audit §4 row 5). This duplicates TanStack's `pointermove → clientToScene → resolvePointerFocus → updateFocus → onFocusGroupChange` pipeline (`tanstack-native/04-interactivity.md` §Pointer pipeline, `focus:"group-x"` groups by semantic `xValue`). Parallel margin-inclusive `categoryScale: scaleBand().range([margin.left, margin.left+innerWidth])` + `valueScale: scaleLinear().range([margin.top+innerHeight, margin.top])` (`bar-chart.tsx:216-242`) reconstructs `resolveConfiguredScale`'s margin-inclusive range (inventory §4 #4) — verified not to drift but a full scale rebuild TanStack already runs inside `createChartScene` (`tanstack-native/02-render.md` §Scene construction).

2. **Sizing duplication** — audit §2 row 1 + §4 row 1. Manual `ResizeObserver` + `getBoundingClientRect().width` + `setWidth` with `Math.abs>0.5` throttle (`bar-chart.tsx:154-164`) plus `chartHeight = Math.round(width / parseAspectRatio(aspectRatio))` (`bar-chart.tsx:211-212`) reproducing `resolveChartSize` (`tanstack-native/01-load.md` §Size resolution, `adapter-shared.ts:22` + `renderer.ts:184/190` `currentWidth`/`configureObserver`). `parseAspectRatio` guards only `width<=0`, not `innerHeight<=0` → degenerate `valueScale` if ratio malforms (audit §4 row 1).

3. **Per-rect WAAPI reveal** — audit §2 row 5 + §4 row 4. `rect.animate([{height:0,y:baseline},{height,y}], {duration:1100, delay:i*staggerDelaySec})` loop over `querySelectorAll("rect")` per series (`bar-chart.tsx:437-502`, `staggerDelaySec = animationDuration*0.4/1000/data.length`). One `Animation` per bar (200 at n=100 with 2 series; 20k at n=10000 if ever scaled — degenerate). Deferred via shared `onPostPaint` rAF×2+timeout + `bkmRevealed` guard, `fill:"backwards"` (matches scatter). Stock path is `defineChart({animate:{duration,easing}})` + `reconcileChartSvg` interpolating `height,y` (`tanstack-native/02-render.md` §reconcile `interpolatedAttributes:14`, `03-hooks-and-updates.md` §`resolveAnimation`) — but `height,y` tween has no per-bar stagger.

4. **Axis + chrome duplication + groupScale algebra** — audit §2 row 3 + §3 rows 1/2/4/5. `BarXAxisOverlay` HTML `left:bandCenterX` with `ceil(count/maxLabels)` modulo thinning (`bar-x-axis-overlay.tsx:28-81`) vs TanStack `x:{guide:true,ticks,format}` auto guides; `bar-hover-chrome.ts` (455 ln) is a full copy of `hover-chrome.ts` with per-category `setCategoryHover` + per-series dot `x = barPos+idx*(gBandwidth+gap)+gBandwidth/2` vs band-center `anchorX` (audit §3 row 6 duplication); `groupScale` nested `scaleBand` with `paddingInner = n*GROUP_GAP/(bandWidth+GROUP_GAP)` deriving exact `individualBarWidth` (`bar-chart.tsx:20-34` header) is algebraic parity for `barY`'s `inferBandwidth×0.8` mismatch — correct at pixel level, but verbose.

## Synthesis — what to change vs keep

### Change

**C1 — Wire band-category into a custom `ChartFocusStrategy` and delete manual `pointermove` + parallel scale lookup.**
- Move band resolution inside `defineChart(spec, {focus: barFocusStrategy, maxFocusDistance: Infinity})` as a `ChartFocusStrategy<ChartDatum,string,number>` (`types.ts:680`). `resolve(points,x,y)` iterates `points` grouped by `xValue` (category label string = `barCategoryAccessor` output) translating `clientToScene` scene-x → nearest `categoryLabel` via the same string domain but expressed over `ChartPoint.xValue` — no `Math.floor(pos/columnWidth)` and no `columnWidth` ignoring `padding`. `group` collects the per-series points sharing that `xValue` (mirrors TanStack `focusX` grouped precedent `focus.ts:85`, `groupPoints` collecting one point per `group` sharing `xValue`, sorted by `y`).
- `attachBarHoverChrome` then consumes only `onFocusGroupChange(points)` from TanStack (plus `onFocusChange` nil→hide) instead of `container.addEventListener("pointermove")`. Deletes: `hoverInputsRef` triplet, `columnWidth`, per-move `container.querySelector("svg")` + `getBoundingClientRect`, `handlePointerMove`'s `Math.floor` branch, and the unused `focus` absence.
- Keeps `categoryScale`/`valueScale`/`groupScale` only as the `definition`'s `x.scale`/`y.scale`/`groupScale` inputs; hover no longer reads them outside `definition`. Fixes audit §4 rows 2/5 and removes the padding-induced hit-test drift.

**Verification that C1 is TanStack-native:** `tanstack-native/04-interactivity.md` §Focus strategies lists custom `{resolve,group,navigation}` as the consumer path and `audit §6 item 1` prescribes exactly this. `maxFocusDistance:Infinity` maps to `StoredChartDefinitionOptions.maxFocusDistance` (`scene.ts:272`). Sizing stays coherent because anchor uses `point.x` / band center derived from the scene-resolved scales, not a parallel `categoryScale(categoryLabel) ?? 0` fallback.

**C2 — Collapse sizing/hover scale reads: pass factories, use scene-resolved scales for chrome y.**
- Pass `scaleBand().domain(categories).padding(barGap)` and `scaleLinear().domain([0,max*1.1]).nice()` as factories (not pre-ranged instances) as `x.scale`/`y.scale`; let TanStack `resolveConfiguredScale` apply margin-inclusive range. Read back ranged y for dots via `onRender({scene})` → `scene.scales` / `scene.points[].y` instead of local `valueScale(numValue)` (audit §6 item 4). Keep `groupScale` derivation (still needs local `bandWidth` → `paddingInner`) until folded in follow-up. Removes the `Math.round(width/aspectRatio)` manual height reproduction and the `parseAspectRatio` NaN → `height NaN` degenerate path (audit §4 row 1): host `<Chart aspectRatio>` owns it via `resolveChartAdapterLayout`.

### Keep (justified — do not absorb into TanStack stock)

**K1 — Stock `barY` per series with nested `groupScale`.** Already TanStack-native at the mark layer — the one cartesian chart where marks themselves are stock (inventory §1). Keep `barY(renderData,{x,y,z:()=>series.dataKey, groupScale, fill, radius})` and the algebraic `paddingInner` proof (header `bar-chart.tsx:20-34`) that guarantees `individualBarWidth` pixel parity. Not a wrapper.

**K2 — WAAPI per-bar stagger reveal (deferred).** Stock `animate:true` interpolates `height,y` via `interpolatedAttributes` but has no per-bar stagger or 1100 ms bklit tween (`bar-chart.tsx:447` `REVEAL_EASING`). Keep `onPostPaint` + `bkmRevealed` + `fill:"backwards"` + `staggerDelaySec` in this slice — same rationale as scatter K2 — and revisit only if bench proves `Animation` allocation is the M1a bottleneck at demo n=100 (pilot `bar` is gated at n=100 only; docs/PROGRESS bar note `degenerate at n≥1000`).

**K3 — `BarXAxisOverlay` HTML label placement.** TanStack `x.guide` auto tick labeling differs from bklit's `bar-x-axis.tsx` modulo-thinned centered `bandCenterX` placement (inventory §4 #8); QA settled ≤0.5% gate is sensitive to 1px band drift. Keep overlay for bar; porting to guides is lower-value than hover/sizing fixes.

### Defer

**D1 — Merge `BarHoverChrome` duplication into shared `hover-chrome` base.** 455-line copy vs shared helper (`audit §6 item 3`) — real debt, but touching `hover-chrome.ts` risks regressing line/area/composed/scatter proven hover dims. Defer until bar focus is proven.

**D2 — Single `clipPath` reveal or shared `animate:true` for bars.** D2 of audit §6 item 2 — loses stagger. Defer; keep WAAPI.

**D3 — Fully remove local `categoryScale`/`groupScale` in favor of scene-derived `bandwidth`.** Requires `groupScale` folding into `barY`'s `inferBandwidth` path; keep local band derivation until TanStack `bandwidth` inference is re-proven at composed width (inventory §1 composed row).

## Plan of work (ordered)

1. Implement C1 in `migrated/charts/bar-chart.tsx` + new thin helper `migrated/charts/internal/bar-focus-strategy.ts` (or inline): build `barFocusStrategy: ChartFocusStrategy<ChartDatum,string,number>` whose `resolve` reproduces band selection over `points`' `xValue` (category label) with stable tie-break and `phaseRef!=="ready" → []` `canInteract` gate (mirrors bklit `ChartCore` gating and scatter's `phaseRef` pattern). Wire as `defineChart(spec, {focus: barFocusStrategy, maxFocusDistance: Infinity})` + `<Chart onFocusGroupChange={adapter}>`, deleting `container.addEventListener("pointermove"/"pointerleave")`, `hoverInputsRef`, `columnWidth`, and the `categoryScale(categoryLabel) ?? 0` fallback. Keep chrome attached via `overlayHostRef` only.

2. Implement C2 alongside: pass `x`/`y` scales as factories and plumb `onRender` scene y for dots if needed; remove manual `chartHeight`/`innerHeight` derivation beyond what `<Chart aspectRatio>` already owns (keep `innerWidth` only if still needed for `maxValue` domain calc — y domain stays local).

3. QA gate per `research/phase-1/05-qa-and-benchmark-gates.md` (frozen): run `pnpm qa -- --chart bar --impl-a bklit --impl-b migrated --n 100` settled + hover 30/50/70. Expect Q1 ≤0.5% settled (reveal kept) and hover tooltips detected; bar only runs at n=100 (degenerate at n≥1000 per docs/PROGRESS legend). Self-test gate 0.1% optional.

4. Benchmark spotlight: M1a/M1c/M2a at n=100 vs `B`=bklit bar (degenerate-scale gate). G1/G2 waived where no native `T` headroom; report medians before/after.

5. Docs: update `docs/PROGRESS.md` Bar row and `docs/LOG.md` D107 with TanStack-native rationale.

## Questions before coding

- None blocking — `ChartFocusStrategy` contract is `types.ts:680`, TanStack `focusX` grouping is `focus.ts:85`, and `bar-hover-chrome.ts`'s `BarFocusGroup{categoryIndex,categoryLabel,anchorX,points}` maps 1:1 to a grouped `ChartPoint` set keyed by category label string.

## Risks

- Custom `resolve` must map scene-x → category label exactly — mismatch causes hover-50/70 drift. Mitigate by comparing against `point.xValue` string equality, not arithmetic `columnWidth` division.
- Removing manual listener must not drop `phaseRef !== "ready"` gating. Replicate by returning `[]` from `resolve` when not ready (same as scatter C1).

## Out of scope this slice

- Sizing consolidation to dynamic `(ctx)=>spec` builder — D2, follow-up.
- Reveal rewrite to clipPath / `animate:true` — K2.
- `BarXAxisOverlay` → TanStack guides — K3.
- Hover-chrome dedup — D1.
