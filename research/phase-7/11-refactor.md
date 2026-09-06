# 11 — 7.4 refactor triage

Lead triage of the 7.4 inventory audit, HEAD `665a9ad`. Every row below was
re-measured by the lead; the audit's report is input, not proof (principle 5).
Rows are split into two commits because they carry different risk: **7.4a** changes
no call site and no observable DOM, **7.4b** unwinds live call sites and therefore
needs a QA run.

## Lead corrections to the audit

1. **`chart-reveal-clip.tsx` cannot be deleted.** It is barrel-exported
   (`showcase/migrated/charts/index.ts:118-119`), it exists in legacy
   (`repos/bklit-ui/packages/ui/src/charts/chart-reveal-clip.tsx:30`) and
   `qa/api-compat/all.ts:75,356` asserts both the component and its props type.
   Deleting it breaks claim 2 (seamless swap). It stays. G31's count is wrong by
   132 lines and by one module.
2. **`sankey-animation.ts` is not caller-free.** `sankey-chart.tsx:20,21,323,502`
   imports `runSankeyReveal` and `stampSankeyLinkPathLength`. The audit's own
   importer probe returned empty because it only matched `./sankey-animation`,
   not the `./internal/sankey-animation` form used from the chart file.
3. **The G31 shells are neutralised, not inert.** They still stamp
   (`reveal-wipe.ts:10` sets `data-bkm-revealed`, `sunburst-label-reveal.ts:30`
   sets `data-bkm-labels-revealed`), clear inline style, and schedule the phase
   deadline (`composed-reveal.ts:27-45` fires `onPhaseChange("ready")` on a
   timeout). Deleting the module without re-homing that work changes behaviour.
   Each has live importers: `reveal-wipe` from `area-chart.tsx:23`,
   `use-line-reveal.ts:5`, `use-composed-reveal.ts:13`; `composed-reveal` from
   `use-composed-reveal.ts:14`; `sunburst-label-reveal` from `sunburst-chart.tsx:41-43`.

Two further audit rows are **rejected on measurement**:

- *`internal/index.ts` is unimported* — false. `area-chart-loading.tsx:19` imports
  `ChartMargin` from `"./internal"`. Keep.
- *Child-flatten duplicated ×4* — not duplicated logic. The shared part is the
  one-line idiom `[node].flat(Infinity)`; the four loop bodies differ entirely
  (`children-extract.ts:227`, `composed-children.ts:184`, `reference-area-config.ts:38`,
  `sunburst-chart.tsx:179`). Extracting it saves no lines and adds a hop.
- *`MS_PER_SECOND` in 22 files* — deferred, not scheduled. A 22-file touch for one
  line each is churn that conflicts with everything else in the commit.

## 7.4a — dead code and duplicate collapse (no call-site change)

Every symbol below was verified at zero consumers with
`git grep -n "\b<sym>\b" HEAD -- showcase bench qa` run from the repo root.

| # | Row | File | Effect |
|---|---|---|---|
| 1 | `createPieHoverCoordinator` + the `PieHoverCoordinator` interface, both consumer-free | `internal/hover-motion.ts:11,21,70,75` | ~55 lines. Keep `PieSliceHoverEffect` and `HoverSource`: both live, `PieSliceHoverEffect` is barrel-exported and api-compat-asserted. Update the stale mention in `showcase/oxlint.config.mts:333`. |
| 2 | `clearRevealed`, no caller | `internal/reveal-root.ts:32,45` | ~14 lines |
| 3 | `buildLoadingSkeletonSeries` and `loadingSkeletonBarHeights`, no caller; the orphaned `hashFract` / `HASH_FRACT_MULTIPLIER` / `SKELETON_HEIGHT_*` / `LOADING_SKELETON_BASE_DATE` block and the now-unused `ChartDatum` import go with them | `internal/loading-chrome.ts:60-99,106` | ~45 lines |
| 4 | Un-export `LOADING_SKELETON_POINT_COUNT`, `loadingSkeletonValue`, `loadingSkeletonValueFromTarget` — all three are read only inside their own file | `internal/loading-chrome.ts:102-104` | surface only |
| 5 | `LINE_LOADING_PULSE_MIDPOINT`, `DEFAULT_LINE_SKELETON_POINT_COUNT`, no caller | `internal/line-loading-sweep.ts:9,11,62,63` | ~4 lines |
| 6 | Four dead re-exports (D573) | `internal/radar-reveal.ts:151,154,156` | ~4 lines. The file stays: three live consumers. |
| 7 | `LoadingLabel`'s `exiting` prop, accepted then `void`ed, and no caller passes it. Internal component only; the public `ChartLoadingLabel` in `internal/loading-entries.tsx:318` is untouched | `internal/loading-label.tsx:4-5` | ~2 lines |
| 8 | The dead `animate` prop threaded into three leaf indicators that never read it | `internal/tooltip-indicator-{solid-rect,faded-rect,dashed-line}.tsx:6/8/6`, pass-throughs at `internal/tooltip-indicator-inner.tsx:32,44,55` | ~10 lines. Keep `animate` on `tooltip-indicator-inner.tsx:76`: that is the outer prop surface. |
| 9 | Collapse the two one-hop alias files into their only importer | `internal/pattern-public-circles.ts`, `internal/pattern-public-waves.ts`, importer `internal/pattern-shapes.ts:10,12` | 2 files, ~6 lines. Barrel names `PatternCircles`/`PatternWaves` unchanged. |
| 10 | **Duplicate collapse.** `loading-chrome.ts` re-implements `skeleton-data.ts` with the same constants: base 110/36/1.15/9, target 95/28/1.05/7, hash 43758.5453, salt 12.9898, heights 20..80. `skeleton-data.ts` survives (V3.4b verbatim parity source, barrel-exported, covered by the ported legacy tests). `buildLoadingSkeletonRows` — the only live reader, from `use-area-y-domain.ts:5` and `use-line-y-domains.ts:15` — is repointed at value helpers exported from `skeleton-data.ts`, and the duplicated constants in `loading-chrome.ts` are deleted | `internal/loading-chrome.ts:31-58` vs `internal/skeleton-data.ts:5-13,42-56` | ~25 lines, numerically identical output |
| 11 | One genuinely stale comment: "mounts the `/core` entry until V3.5", a regime closed by D567 | `internal/chart-host.tsx:106` | 1 line |

The `V1.2/G6` and `D521b` tags are **not** swept: they are provenance markers on
live code, not scaffolding, and they appear on 20+ files.

Expected removal: ~165 lines and 2 files. No call site changes, no DOM change, no
barrel change. Floor must read unchanged afterwards.

## 7.4b — G31 shell unwind (separate commit, QA-gated)

Not free deletes. Each shell has live importers and each carries observable work
that must be re-homed, not dropped:

| Shell | Lines | Live importers | Observable work to preserve |
|---|---|---|---|
| `reveal-wipe.ts` | 57 | `area-chart.tsx:248,262`, `use-line-reveal.ts:47,75`, `use-composed-reveal.ts:210,241` | stamps `data-bkm-revealed`, clears inline `clipPath`; `use-line-reveal.ts:41` latches replay on the stamp |
| `composed-reveal.ts` | 48 | `use-composed-reveal.ts:223` | the reveal-deadline timeout that drives `onPhaseChange("ready")` |
| `sunburst-label-reveal.ts` | 52 | `sunburst-chart.tsx:611,613,644,650` | stamps `data-bkm-labels-revealed`, clears inline label opacity, replay reset |
| `scatter-reveal.ts` | 108 | `internal/scatter-reveal-setup.ts` | reveal-key tracking and stale-timer settle |
| `choropleth-reveal.ts` | 109 | `choropleth-chart.tsx` | pending/seen replay tracking |
| `sankey-animation.ts` (+ `sankey-reveal-specs.ts` 211) | 134 | `sankey-chart.tsx:20,21,323,502` | link path-length stamp, reveal handle |
| ring track expand | in `ring-chart-model.ts:156-182` | in-file | `data-bkm-revealed` latch at `:128` |
| `chart-reveal-clip.tsx` | 132 | `index.ts:118` | **stays** — public export, see correction 1 |

Order: `reveal-wipe` and `composed-reveal` first (they share `use-composed-reveal`),
then sunburst, then scatter/choropleth, then sankey, then the ring block. The
reach-in ledger entries for the deleted files drop in the same commit. QA run
required before the commit lands, because the stamps are read on the replay path.

## V5.3 answer (`internal/` family directories): against

`internal/` holds 407 files. By basename prefix, ~180 are single-family (bar 29,
scatter 24, sunburst 18, heatmap 13, composed 13, pie 11, sankey/live/line 10 each)
and ~227 are cross-cutting (`use-` 34, `chart-` 23, `pattern-` 18, `marker-` 13,
`tooltip-` 12, `legend-` 10, `brush-` 10, plus `parity/`). Family directories would
home under half the tree while the larger, more entangled half still needs a shared
home. It moves neither claim. Recommend dropping V5.3 or reducing it to moving
`parity/` alone, which is already a directory.
