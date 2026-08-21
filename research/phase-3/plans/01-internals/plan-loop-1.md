# Initiative 1 — Plan Loop 1: internals consolidation (spring / reveal / hover-chrome tokens / y-scales)

Synthesized from `research/phase-3/audits/01-internals.md` + `research/phase-3/inventory/05-consolidated-internals.md` (rows re-verified by grep against the working tree on 2026-08-18 before this plan was written). Governed by `research/phase-3/00-layer-contract.md`.

## Verified current state (working tree, post-D205)

- `springFromBounce` defined 5× — `internal/{funnel,gauge,radar,pie,ring}-reveal.ts` (identical formula: `stiffness = clamp(base*(1+bounce*0.35), 80, 400)`, `damping = max(8, base*(1-bounce*0.25))`).
- `resolveEnterTransition` / `revealTiming` / `buildProgressKeyframes` defined 4× each — `internal/{funnel,gauge,pie,ring}-reveal.ts`; radar carries its own variants of the same machinery. Structural diff of pie vs ring shows the files are identical modulo family naming.
- `TOOLTIP_SPRING = {300, 30}` + `BOX_OFFSET = 16` defined 5× — `internal/{bar,candlestick,scatter,live,}-hover-chrome.ts` (`hover-chrome.ts` is the shared line/area/composed one).
- `internal/y-domain.ts` exists (D205) but `scaleLinear().domain(yDomain).nice()` is still inlined at `bar-chart.tsx:208` and `composed-chart.tsx:559`.
- `internal/deferred-reveal.ts` `runDeferredReveal` returns `void`: the `onPostPaint` callback and the deadline timer cannot be cancelled on unmount/re-render → the audit's "uncancellable post-paint/deadline races". Heatmap forks the primitive with its own epoch guard (`revealInputsRef`/`seenRevealEpochRef`, `heatmap-components.tsx:252/430-559`).
- Canonical single implementations that must NOT be forked or moved: `internal/spring.ts` (`createSpring`), `internal/radar-spring.ts` (`estimateSpringSettleMs`/`sampleSpringProgress`), `internal/candle-spring.ts` (`createSpringResolver`/`sampleSpringKeyframes`), `internal/bezier-easing.ts`.

## Deliverables (one impl, one import path each)

### D1. `internal/design-tokens.ts` — the single tokens module (layer contract §Tokens)

New module exporting, with values verbatim from the current call sites:

- `REVEAL_DURATION_MS = 1100`
- `REVEAL_EASE_CSS = "cubic-bezier(0.85, 0, 0.15, 1)"` and `REVEAL_EASE_POINTS = [0.85, 0, 0.15, 1] as const`
- `TOOLTIP_SPRING = { stiffness: 300, damping: 30 }`
- `TOOLTIP_BOX_SPRING = { stiffness: 100, damping: 20 }` (bklit `DEFAULT_CHART_CONFIG`)
- `HIGHLIGHT_SPRING = { stiffness: 180, damping: 28 }` (bklit `DEFAULT_CHART_CONFIG`)
- `BOX_OFFSET = 16`

Then: delete the 5 local `TOOLTIP_SPRING`/`BOX_OFFSET` definitions in the hover-chrome files and import from `./design-tokens` (constants only — the hover-chrome implementations themselves are initiative 4's scope). Replace the literal `1100` / `"cubic-bezier(0.85, 0, 0.15, 1)"` fallback constants in the reveal modules with imports of these tokens. Initiative-10/11 tokens (`FAN_ANGLE`, `BAR_DEPTH_PERSPECTIVE_RATIO`, …) are added by those initiatives when they build their utilities — do not pre-add dead constants.

### D2. `internal/enter-transition.ts` — single enter-transition/reveal-timing engine

Generic module replacing the 4-5 clone sets, API shaped exactly like the existing per-family versions (they are already identical modulo naming):

- `export interface EnterTransition` (the current `PieEnterTransition` shape: `type/duration/ease/bounce/stiffness/damping/mass`)
- `export type ResolvedTiming = { kind: "tween"; durationMs; easingCss } | { kind: "spring"; stiffness; damping; mass }`
- `export const TWEEN_FALLBACK: ResolvedTiming` (1100ms + reveal ease, values imported from `design-tokens.ts`)
- `export function springFromBounce(bounce, base)` — verbatim formula
- `export function resolveEnterTransition(transition, fallback = TWEEN_FALLBACK)` — verbatim semantics (explicit caller transition always wins; spring path honors direct stiffness/damping, else bounce conversion off the fallback's base or `{100, 15}`)
- `export interface RevealTiming { durationMs; easing; sampledProgress }`
- `export function revealTiming(resolved)` — tween → 64 uniform samples + bezier easing; spring → `estimateSpringSettleMs` + `sampleSpringProgress(…, 40)` + `"linear"` (imports from `./radar-spring`; D51 rule preserved)
- `export function buildProgressKeyframes(timing, toKeyframe)`

Propagation: `funnel-reveal.ts`, `pie-reveal.ts`, `ring-reveal.ts`, `gauge-reveal.ts`, `radar-reveal.ts` delete their local copies and re-export/import from `./enter-transition`. Per-family files keep ONLY family-specific parameterization (their fallback constants, per-family baselines, geometry-specific keyframe builders). Family-specific type aliases (`PieEnterTransition` etc.) may remain as `export type PieEnterTransition = EnterTransition` re-exports so chart files don't churn, but the implementations must have exactly one definition site. Radar's differing per-sub-component fallback kinds are expressed through the existing `fallback` argument — no radar-specific fork of the functions.

### D3. Cancellable reveal controller — harden `internal/deferred-reveal.ts` + fold heatmap fork

- `onPostPaint(callback)` returns a cancel function (cancels the pending rAFs/timeout chain).
- `setRevealDeadline` unchanged signature (already returns the timer id).
- `runDeferredReveal(config)` returns a `RevealHandle = { cancel(): void }`: `cancel()` clears the deadline timer, cancels the pending post-paint chain, cancels+clears all tracked animations, and removes the `--revealing` class. Add optional `config.revealEpoch?: number` + `config.seenEpochRef?: { current: number | null }` implementing heatmap's epoch guard (skip if `seenEpochRef.current === revealEpoch`, else stamp it) inside the primitive.
- Every `runDeferredReveal`/`onPostPaint`+`setRevealDeadline` consumer (`bar-chart.tsx`, `scatter-chart.tsx`, `candlestick-chart.tsx`, `gauge.tsx`, `pie-chart.tsx`, `ring-chart.tsx`, `radar-chart.tsx`, `sunburst-chart.tsx`, `choropleth-chart.tsx`, `composed-chart.tsx`, `heatmap-components.tsx`) stores the handle and cancels it in its effect cleanup (teardown race comments per D205 canonical wording).
- Heatmap: replace the hand-rolled epoch/guard logic in `heatmap-components.tsx` with the extended primitive where it is a true 1:1 fold. If heatmap's flow genuinely needs behavior the primitive cannot express, keep the minimal residue but route ALL guard/deadline/post-paint mechanics through the primitive — no duplicated `bkmRevealed` stamping logic outside `deferred-reveal.ts`.
- Contract note: the `.ts-chart__marks` DOM query is a rendered-DOM reach-in. It stays CONFINED to `deferred-reveal.ts` (single impl, single import path); a waiver ruling for this confinement is logged in `docs/phase-3/LOG.md` at gate time (WAAPI needs element handles; TanStack public API exposes no per-mark refs). No new DOM queries may appear in chart files.

### D4. y-domain propagation

Route `bar-chart.tsx:208` and `composed-chart.tsx:559` through the existing `internal/y-domain.ts` helper (same `scaleLinear().domain(yDomain).nice()` shape). Do NOT touch candlestick/scatter/live-line domain code — their padding formulas differ (candlestick 5% pad, scatter ×1.1 fallback) and are not this family; forcing them through the helper would change behavior.

### Explicitly deferred

Family 12 (`ChartScale` stashes, 9 chart files) is deferred to initiative 2: eliminating the stashes requires the sizing/contexts host owning the resolved scales (`resolveConfiguredScale`), which is initiative 2's deliverable. Logged as a scope ruling in `LOG.md` at gate time.

## Invariants (review checklist)

1. Zero behavior change: same keyframes, same timings, same guard semantics. This is a pure consolidation — Q1 diffs should be ~0%, not just ≤0.5%.
2. No new dependencies, no deep TanStack imports, no new DOM queries outside `deferred-reveal.ts`.
3. `grep -rn "function springFromBounce\|function resolveEnterTransition\|function revealTiming\|function buildProgressKeyframes" showcase/migrated/charts/internal/` → exactly 1 definition site each.
4. `grep -rn "TOOLTIP_SPRING\s*=\|BOX_OFFSET\s*=" showcase/migrated/charts/internal/` → only `design-tokens.ts`.
5. `pnpm --dir showcase check-types` and `pnpm --dir showcase lint` pass.

## Gate plan (PLAN-phase-3.md order, cross-chart)

Affected charts: pie, ring, funnel, gauge, radar, heatmap, sunburst, choropleth, bar, scatter, candlestick, composed (reveal/controller); + line, area, live-line (token imports only).

1. **Q3 boundary**: grep sweeps above + no deep imports (`@tanstack/*/src`, `dist/` paths) + DOM-query sweep (`querySelector` outside `deferred-reveal.ts` limited to pre-existing reviewed sites).
2. **Type parity**: `pnpm --dir showcase check-types` clean; public chart prop types untouched by this initiative (assert no `.tsx` public prop interface changed).
3. **Q2 API**: showcase demos render with zero console errors (qa/api-compat fixtures).
4. **Q1 visual**: `node qa/screenshot.mjs --chart <c> --impl-a bklit --impl-b migrated` for each affected chart with a bklit baseline scenario; ≤0.5% per screenshot.
5. **G1–G4**: `node bench/run.mjs` for affected charts, migrated impl only, compared against frozen B/T baselines in `bench/results/`.
