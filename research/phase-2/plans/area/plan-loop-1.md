# AreaChart — Phase 2 Refactor Plan (1.1 synthesis)

> Inputs: `research/phase-2/audits/area-audit.md`, `research/phase-2/inventory/04-migrated-inventory.md` §1 caps+§4, `research/phase-2/tanstack-native/01-load.md` + `02-render.md` + `03-hooks-and-updates.md` + `04-interactivity.md`, plus live reads of `migrated/charts/area-chart.tsx` (483 ln), `migrated/charts/internal/area-fill-mark.ts` (95), `migrated/charts/internal/hover-chrome.ts` (682), `migrated/charts/internal/x-axis-overlay.tsx` (116).

## Goal (Phase 2)

Move Area closer to TanStack-native without losing bklit 1:1 parity. Area is already the most TanStack-native cartesian (areaFill+lineY on TanStack host, focus:'group-x' kept live) — so this plan is intentionally minimal: one targeted no-risk addition, rest is keep/defer.

## Distilled overhead (non-redundant)

Audit §2+§3 lists ~15 flags; consolidated deduplication:

1. **Missing Y-axis parity** — audit §4 row 6 + §5 y-axis deviation + §6 candidate 2. `extractChildren` yields `yAxis` but Area never renders it; `line-chart.tsx` already renders `YAxisOverlay` with `nicedYDomain`/`chartTop/Bottom/Left/Right`. Gap is low-risk because bench omits `YAxis`, but it's the only true missing-prop regression vs bklit.

2. **Custom primitives justified as GAP-equivalents** — audit §2 rows 2-5. `areaFill` (G4 heap 19% saver `4.45MB→benign`), `decimateTimeSeries` LTTB, `XAxisOverlay` data-aligned ticks, highlight/xForIndex, WAAPI clip reveal. These are keeps — see Synthesis Keeps. Only Y-axis is a change candidate; sizing/hover/gradients are deferred.

3. **Sizing + gradient host ownership** — audit §2 row 1 + §3 rows 1/6. Manual `ResizeObserver` + string `aspectRatio` + sibling `<svg>` grad defs vs `<Chart aspectRatio>` + `gradients:[]` spec. Correct to defer to broader sizing 'D' sweep per Phase 2 maintain principles (don't churn bench-visible plumbing for 1 chart alone).

## Synthesis — what to change vs keep

### Change

**C1 — Restore Y-axis parity.**
- Destructure `yAxis` from `extractChildren` (same tuple as Line) and render `<YAxisOverlay yDomain={nicedYDomain} chartTop={margin.top} chartBottom={width/parseAspectRatio(aspectRatio)-margin.bottom} ... />` when `yAxis` is present (exact lineage of `line-chart.tsx:340-343`). Mirror imports (`YAxisOverlay`) and formula so tick ticks are `nicedYDomain`-aligned. Bench demo still passes with zero Y-axis instances; existing Area screenshot gate unaffected.

Verification that C1 is TanStack-native-aligned: TanStack guides remain deferred — this is bklit-parity via the same overlay Line settled on, not a new custom layer. Y-axis was the only dropped prop.

### Keep (justified — do not absorb into TanStack stock this slice)

**K1 — `areaFill` custom mark stays** (audit §2 H JUSTIFIED). Stock `areaY` still carries `points: [...top,...lower]` + per-datum `ChartPoint`s, blowing G4 heap at n=1000 for zero visual gain; `lineY` already supplies focus geometry. Keep `areas/configs/design` per-capsule rationale.

**K2 — Decimation + XAxisOverlay + highlight/xForIndex + clipPath reveal stay.** Same reasons as Line: TanStack has no decimation primitive, data-aligned ticks diverge from SVG guides, highlight band needs xForIndex, single-`Animation` clipPath is the shared 4-chart reveal seam. No churn on bench-visible plumbing for this slice.

**K3 — Imperative `attachHoverChrome` stays** — unlike scatter/bar/candlestick, Area already wires TanStack `onFocusGroupChange → chrome.onFocusGroupChange` correctly (audit §2 row 4 notes "not inert"). Chrome is the deferred hover 'D' sweep (dedup across charts), not a single-chart fix.

**K4 — Gradient sibling `<svg>` stays** — moving into `defineChart({gradients})` + `renderChartSvgWithResources` is the deferred gradients 'D' sweep; sibling `useId`-scoped URLs are stable per existing gate. No functional change this slice.

### Defer

**D1 — Unified TanStack sizing + gradients host** (audit §3 candidates 4/5). `<Chart aspectRatio>` owns height + `gradients:[]` owns defs. Defer to the cross-chart sizing sweep; keep local `ResizeObserver` + sibling defs for now.

**D2 — xForIndex → ChartPoint.x / scene.scales.x.map** (audit §6 candidate 3). Keep `xForIndex` linear interpolation this slice; risks off-by-slotWidth at decimated tails but gates already green at demo scale.

**D3 — TanStack guides for one axis** (audit §6 candidate 2). Keep `XAxisOverlay` this slice; moving to `x:{guide:true}` is a separate tick-evenness validation task.

## Plan of work (ordered)

1. Implement C1 in `migrated/charts/area-chart.tsx`: import `YAxisOverlay`, destructure `yAxis` from `extractChildren`, append `yAxis ? <YAxisOverlay .../> : null` branch mirroring `line-chart.tsx` (top/bottom via `width/parseAspectRatio(aspectRatio) - margin.bottom`, `orientation ?? "left"`, `numTicks ?? 5`, `formatLargeNumbers ?? true`, `formatValue`). Verify file still 483+14 lines and `bench/app` typecheck passes.

2. Bench/QA gate per frozen ground truth: run `pnpm qa -- --chart area --impl-a bklit --impl-b migrated --n 100` and `--n 1000` (area supports seeded screenshot + interactivity sweep) and a spot `pnpm qa -- --chart line --impl-a bklit --impl-b migrated --n 100` to prove sibling Area token changes don't disturb Line's shared hover-chrome contract. Expect already-PASS gates to remain PASS (Line's prior scatter/bar/candlestick gate deltas were ±0).

3. Docs: update `docs/PROGRESS.md` Area row (Plan=done, Refactor=done, QA done) and `docs/LOG.md` D109 with TanStack-native rationale (why Y-axis is the only non-deferred change vs keeps/deferrals).

## Questions before coding

- None blocking — areaFill heap math is documented at `internal/area-fill-mark.ts:1-12`; YAxisOverlay contract matches `line-chart.tsx:340`; bench scenario `migrated-area.tsx` renders without YAxis, so C1 is additive-only.

## Risks

- `<YAxisOverlay>` bottom depends on `parseAspectRatio(aspectRatio)` runtime division — same as Line, no drift.
- `renderData` vs `data` yDomain scope stays as ported (`data` scoped `yDomain`, `renderData` scoped ticks domain) — no change.

## Out of scope this slice

- Replacing `areaFill` → stock `areaY` (K1).
- Sizing/gradients consolidation to host (D1).
- xForIndex → scene scales (D2).
- Moving X-axis to TanStack guides (D3).
