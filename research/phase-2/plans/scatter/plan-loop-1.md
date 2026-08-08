# ScatterChart — Phase 2 Refactor Plan (1.1 synthesis)

> Inputs: `research/phase-2/audits/scatter-audit.md`, `research/phase-2/inventory/04-migrated-inventory.md` §1 caps+§4 #4/#6/#8/#13, `research/phase-2/tanstack-native/01-load.md` (dynamic chart + adapter layout), `02-render.md` (scene→string→reconcile, Definition build), `03-hooks-and-updates.md` (definition ref + resize rAF), `04-interactivity.md` (focus presets + `ChartFocusStrategy`).
> `research/phase-2/bklitui-native/01-load.md` (scatter y-domain), `02-render.md` (fan-out + `getSeriesMarkerVisualExtent`), `03-hooks-and-updates.md` (dim/highlight), plus live reads of `migrated/charts/scatter-chart.tsx` (715 ln), `migrated/charts/internal/scatter-hover-chrome.ts` (504), `migrated/charts/internal/bisect.ts` (38), `migrated/charts/internal/deferred-reveal.ts` (151), and `repos/tanstack-charts/packages/charts-core/src/types.ts` (`ChartFocusStrategy`, `ChartSpec.gradients`).

## Goal (Phase 2)

Refactor scatter closer to TanStack-native backend: remove wrappers/extra steps where TanStack already provides the mechanism, without losing bklit design (marker fill+gap+ring, per-circle stagger reveal, dim 0.5+blur + enlarged 1.35 copy, crosshair/dot/box/pill, `xRangePadding` inset), animation (1100 ms `cubic-bezier(0.85,0,0.15,1)` + 500 ms per-circle stagger), or public API (`data`, `xDataKey`, `margin`, `aspectRatio`, `children: Scatter` config carriers).

Non-goal: reintroduce broad `yGradient` (`research/phase-1/01-bklit-ui-inventory.md` §2.5) beyond pilot scope — document as gap.

## Distilled overhead (non-redundant)

Audit §2+§3 listed 7 non-native + 5 wrapper flags. Consolidated into 4 families after dedup:

1. **Hover bypass** — audit §2 row 4 + §2 row 6 + §3 row 2/3 + `hoverInputsRef` triplet. `definition` declares `focus:"group-x"`/`maxFocusDistance:Infinity` but `handleFocusGroupChange` is inert (`scatter-chart.tsx:414-429` comment: bypass at n=10000). Real hover is native `pointermove` + `xScaleD3Ref.invert` + `bisectDateLeft`/`resolveNearestIndex` (`internal/bisect.ts:1-38`, strict `>` tie-break ported from bklit's `resolveTooltipFromX`) + `onFocusGroupChange` on the chrome directly (`scatter-chart.tsx:453-511`). This duplicates TanStack's `pointsAtPointer → resolvePointerFocus → updateFocus → onFocusGroupChange` pipeline (`tanstack-native/04-interactivity.md` §Pointer pipeline) and adds `querySelector("svg")` fragility (§4 row 2 — sibling gradient `<svg>` ordering hazard documented at `scatter-chart.tsx:644-656`).

2. **Sizing duplication** — audit §2 row 1. Manual `ResizeObserver` + `getBoundingClientRect().width` + `setWidth` (`scatter-chart.tsx:133-143`) duplicates `mountChartRenderer.currentWidth()` + `configureObserver` (`tanstack-native/01-load.md` §Size resolution, `renderer.ts:184/190`). Justified only to compute `innerWidth` before building `xScale`'s inset range.

3. **Reveal cost** — audit §3 row 1. WAAPI per-circle `circle.animate({opacity, filter:"blur(2px)"}, {duration:500, delay: leadingEdge/innerWidth*durationSec, fill:"backwards"})` (`scatter-chart.tsx:546-626`) is one `Animation` per circle (20k at n=10000, 40k if two marks — halved by single-`dot` redesign, inventory D14). Setup loop deferred via `onPostPaint` rAF×2+`setTimeout(0)` (`internal/deferred-reveal.ts:9-15`) to avoid blocking M1a, with `setRevealDeadline` → `cancel()` to drop finished `Animation`s from `document.getAnimations()` (M3a guard). Correct per `bklitui-native/02-render.md` per-point `getSeriesMarkerVisualExtent` stagger, but TanStack's `reconcileChartSvg` numeric-skeleton `animate:true` path (`tanstack-native/02-render.md` §reconcile, `03-hooks-and-updates.md` §resolveAnimation) has no per-point stagger equivalent.

4. **Axis + gradient + yScale boilerplate** — audit §2 row 3, §3 row 4/5, §2 row 2. `XAxisOverlay` + `x-ticks.ts` data-aligned `selectEvenlySpacedIndices` duplicates TanStack `x.guide`/`ticks`/`format` (inventory §4 #8); 0×0 sibling `<svg>` radial gradients reproduce ring+gap in one `dot` (halves DOM node count — inventory §1) but depend on DOM order and document-wide `url(#id)`; yScale `ChartScale` hatch (plain `scaleLinear` `.copy()` range bug, `scatter-chart.tsx:338-363` D18) is 25-line boilerplate that could be stashed via builder.

## Synthesis — what to change vs keep

### Change

**C1 — Wire bklit bisector into a custom `ChartFocusStrategy` and remove manual `pointermove` listener.**
- Keeps the same `bisectDateLeft`+`resolveNearestIndex` math (`internal/bisect.ts`, strict `>` tie-break) but moves it inside `defineChart(spec, { focus: scatterFocusStrategy })` (`types.ts:896` `ChartFocusStrategy{resolve,group,navigation}`).
- `attachScatterHoverChrome` then consumes only `onFocusGroupChange(points)` from TanStack (`tanstack-native/04-interactivity.md` §Focus strategies — `group-x` semantics or custom `group`) instead of `container.addEventListener("pointermove", handlePointerMove)`.
- Deletes: `hoverInputsRef` triplet ref indirection, `container.querySelector("svg")` per-move, `xScaleD3Ref`/`yScaleD3Ref` invert path for hover, and the `focus:"group-x"` declared-but-inert contract (§2 row 6). Keeps `xScaleD3Ref`/`yScaleD3Ref` only if still needed for reveal; otherwise stashed via the scale objects themselves.

**Verification that C1 is TanStack-native:** `tanstack-native/04-interactivity.md` §Focus strategies explicitly lists custom `{resolve,group,navigation}` as the consumer-provided path (`types.ts:680`) and `type-contract.test.ts:277` shows a categorical `resolve` that iterates `points` — our `resolve` will iterate `scene.points` filtered by `xValue` distance using the same bisect inputs but expressed over `ChartPoint`s. `maxFocusDistance:Infinity` maps to definition option `maxFocusDistance`. No raw DOM query, no ref triplet, sizing handled by host.

**C2 — Collapse yScale `ChartScale` hatch into the builder-stashed scale.**
- Derive `yScaleD3Ref` from the same `scaleLinear` instance created inside `y: { scale }`'s `resolve` (pattern already used for `xScaleD3Ref`, `scatter-chart.tsx:217-224`), or — when C3 switches to dynamic builder — create and stash there. Removes 25 lines, no behavior change.

### Keep (justified — do not absorb into TanStack stock)

**K1 — Custom `ChartScale` object for `xRangePadding` inset.** Plain `scaleUtc().range([margin.left, width-margin.right])` is unconditionally overwritten by `resolveConfiguredScale` (`tanstack-native/02-render.md` §Scene construction, verified via `configured-scale.ts` per comment at `scatter-chart.tsx:202-204`). Object-with-`resolve` hatch is the only mechanism that survives (`types.ts` `ChartScale.resolve`). Retain.

**K2 — WAAPI per-circle stagger reveal.** Stock `animate:true` interpolates `cx/cy/r` via `interpolateAttribute` but has no per-circle `leadingEdge/innerWidth` stagger or `filter blur` staggered entrance (`bklitui-native/02-render.md` §Per-datum fan-out, `01-bklit-ui-inventory.md` §2.5 `enterBlur 2`). Replacing with clip-path `inset` or single `clipPath` loses design fidelity; cost is deferred past first paint via `onPostPaint` and footprint halved by single-`dot` gradient (inventory). Keep as-is; no change in this slice.

**K3 — `XAxisOverlay` data-aligned tick search.** TanStack `x.guide` auto ticks differ from bklit's `selectEvenlySpacedIndices` even-spacing optimizer (`bklitui-native/02-render.md` §Margins/tick layout, `x-axis.tsx:315`) and the QA settled screenshot is gated at ≤0.5%. Keep HTML overlay for scatter; revisit for line/area where guide parity is lower risk.

**K4 — Radial-gradient sibling `<svg>` defs for fill+gap+ring.** TanStack `ChartSpec.gradients` is `ChartLinearGradient[]` only (`types.ts:335/640`) — no radial primitive — and the single-circle-per-point technique halves DOM node count at n=10000 (inventory §3 capsule). Keep sibling SVG, but retain the documented render-after-`<Chart>` DOM order fix (`scatter-chart.tsx:644-656` — avoids `page.locator("#chart-root svg").first()` collapsing hover bounds) and `React.useId` base for ID scoping (`scatter-chart.tsx:276`). No migration to `ChartSpec.gradients`.

### Defer

**D1 — Consolidate sizing to `<Chart>` host + dynamic builder `(ctx)=>spec`.** TanStack-native would be `defineChart({ chart: ({width,height,theme})=>spec })` receiving `width` from `currentWidth()` (`tanstack-native/01-load.md` §Data injection) and computing `insetLo/insetHi + xRangePadding` inside — eliminating duplicate `ResizeObserver`. Deferred for this slice because it requires switching from static `defineChart({marks, x:{scale:xScale}})` to dynamic form and re-proving `innerWidth` timing for decimation axes. Track as follow-up; not required to land C1/C2.

**D2 — `yGradient` per-dot vertical coloring.** Pilot API omits `yGradient?: boolean | {from,to}` (`01-bklit-ui-inventory.md` §2.5, audit §5). Document as out-of-scope; do not implement (`linearGradient gradientUnits="userSpaceOnUse"` variant).

## Plan of work (ordered)

1. Implement C1 in `migrated/charts/scatter-chart.tsx` (+ thin helper in `migrated/charts/internal/scatter-focus-strategy.ts` or inline): build `scatterFocusStrategy: ChartFocusStrategy<ChartDatum, Date, number>` whose `resolve(points,x,y,maxDistance)` reproduces `bisectDateLeft`/`resolveNearestIndex` semantics over `points`' `xValue` (number epoch ms) and whose `group` collects the per-series points sharing the resolved x (mirrors bklit's `primary`-index + per-series `x/y` mapping at `scatter-chart.tsx:485-497`). Wire as `defineChart(spec, { focus: scatterFocusStrategy, maxFocusDistance: Infinity })`, set `<Chart onFocusGroupChange={chrome.onFocusGroupChange}>`, and delete `container.addEventListener("pointermove"/"pointerleave")`, `hoverInputsRef`, `handlePointerMove`'s `invert` branch, and the inert `handleFocusGroupChange` stub. Keep `chrome` attachment via `overlayHostRef` only.

2. Implement C2 alongside: remove the second `ChartScale` object for y — keep single `resolve` that creates `scaleLinear().domain(yDomain).nice().range(context.range)` and stashes to `yScaleD3Ref` (or drop the ref entirely if hover no longer inverts y — C1 no longer needs `yScaleD3Ref` for hover y mapping; chrome receives `point.y` scene coords directly from TanStack points).

3. Bench/QA gate per `research/phase-1/05-qa-and-benchmark-gates.md` (frozen ground truth, cited by `docs/PROGRESS.md` legend): run `pnpm qa -- --chart scatter --impl-a bklit --impl-b migrated --n 100` and `--n 1000` and `--n 10000` settled + hover 30/50/70 captures. Expect Q1 ≤0.5% on settled (reveal kept) and hover tooltips detected; if hover-50/70 regress due to `group` collecting, adjust `group` to per-mark `group` (one point per series at same x — TanStack `focusX` grouped=true precedent, `focus.ts:85`).

4. Benchmark spotlight: M1a / M1c / M2a / M3a / M3c at n=100/1000/10000 vs `T`=native TanStack (`dot` without chrome) and `B`=bklit. G1 ≥20% on M1a/M3a/M3c and G2 ≥0.6 gap-closure are the north stars; M3a `@10k` has prior waiver precedent when `B` vs `T` headroom is compressed (Phase 1 D16). Report `bench/run.mjs` medians before/after.

5. Docs: update `docs/PROGRESS.md` Scatter row `Plan=done → Refactor=done → QA/Benchmarks`, and `docs/LOG.md` D106 with the TanStack-native rationale (why bisect inside `ChartFocusStrategy` is the correct seam vs raw listener).

## Questions before coding

- None that block synthesis — bklit bisector semantics are in `internal/bisect.ts:28` (strict `>`), TanStack `ChartFocusStrategy` contract is in `types.ts:896` (`resolve(points,x,y,maxDistance)`), and the chrome already consumes `ScatterFocusPoint{markId,datum,datumIndex,x,y,color}` which maps 1:1 to TanStack `ChartPoint`. Verification via QA hover screenshots confirms tie-break at high point-per-pixel density (audit §2 row 4).

## Risks

- Custom `resolve` must filter `points` by the focused x's `xValue` exactly — mismatch causes hover-50/70 pixel drift. Mitigate by reusing `dateAccessor` epoch-ms comparison over `point.xValue.getTime()`.
- Removing manual listener must not drop `phaseRef !== "ready"` gating (bklit `canInteract`). Replicate by returning `[]` from `resolve` when `phaseRef.current !== "ready"`.

## Out of scope this slice

- Sizing consolidation to dynamic builder (D1) — follow-up, requires broader bench/QA across charts.
- Reveal rewrite (K2) — keep WAAPI stagger.
- `XAxisOverlay` → TanStack guides (K3) — keep.
- `yGradient` — gap, not gated.
