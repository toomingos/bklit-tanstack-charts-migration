# P5.3 / T-E1c — Barrel ACCEPT ledger (Part 1)

Scope fixed by lead brief 2026-08-25 (run #3): exactly these 16 symbols — the
`*Provider` / `*ContextValue` / `*ProviderProps` names present in the legacy barrel
(`repos/bklit-ui/packages/ui/src/charts/index.ts`) that the migrated barrel genuinely
does not export. The 10 sibling symbols that ARE still public (`BarDepthProvider`,
`ChartConfigProvider(Props)`, `ChartLegendHoverProvider`, `ChoroplethContextValue`,
`HeatmapContextValue`, `HeatmapInteractionProvider`, `Legend(Context|ItemContext)Value`,
`ProfitLossLegendHoverProvider`) are out of scope by lead instruction and are not rows here.

Written incrementally per the D291/D295 mandate: one row filled → file saved.

Doctrine shorthand: **DOC-4** = `go-to-plan.md:13` — "Context/provider architecture
removals stay ACCEPTED (D210-2 precedent): `*Provider`/`use*` internals not re-exported;
thin legacy-named wrapper hooks added only where trivial."

> **FILLED BY THE LEAD 2026-08-26, not by an executor.** The P5.3 dispatch was killed three
> times (6m, ~25m, 19m49s — the last one running *alone*, which eliminates concurrency as the
> cause) and never wrote a row. The remaining work was audit and classification with no code,
> so the lead completed it directly rather than keep feeding an unreliable channel. Every row
> below was verified against the live tree at fill time.

**Verification method (applies to all 16):** for each symbol, `grep -rE "\bSYMBOL\b"` across
`showcase/migrated/charts/` **and** a separate check of the barrel. A barrel miss alone is not
evidence of absence (correction-7 / D312: this port renamed aggressively), so a zero-barrel hit
was only ruled ACCEPT after the whole-tree grep also came back empty **or** the surviving hits
were shown to be comments rather than implementations.

| # | Symbol | Ruling | Doctrine | Evidence |
|---|--------|--------|----------|----------|
| 1 | ChartProvider | **ACCEPT** | DOC-4 | Barrel 0. Tree grep returns **2 hits, both comments referencing bklit's provider** — `candlestick-chart.tsx:158` ("ChartProvider ready check — plain boolean, not ChartPhase") and `internal/candlestick-focus-strategy.ts:5`. No implementation, no context object. The ready-state it used to carry is now a plain boolean. |
| 2 | ChartContextValue | **ACCEPT** | DOC-4 | Barrel 0, tree 0. Context value type for the provider in row 1; dies with it. |
| 3 | ChartHoverContextValue | **ACCEPT** | DOC-4 | Barrel 0, tree 0. Hover state is carried by the hover-chrome modules and focus strategies, not a context. |
| 4 | ChartStableContextValue | **ACCEPT** | DOC-4 | Barrel 0, tree 0. Paired with the retired `useChartStable`; see also D323, where the *sunburst* equivalent's absence was confirmed independently. |
| 5 | ChoroplethProvider | **ACCEPT** | DOC-4 | Barrel 0, tree 0. Note its sibling `ChoroplethContextValue` **is** still public and is out of scope — the pair split, which is why each row is checked separately rather than swept. |
| 6 | HeatmapProvider | **ACCEPT** | DOC-4 | Barrel 0, tree 0. `HeatmapContextValue` and `HeatmapInteractionProvider` remain public (out of scope); heatmap state moved to `createBroadcastStore` per D293/T-C7. |
| 7 | PieProvider | **ACCEPT** | DOC-4 | Barrel 0, tree 0. |
| 8 | PieContextValue | **ACCEPT** | DOC-4 | Barrel 0, tree 0. Pair with row 7. |
| 9 | RadarProvider | **ACCEPT** | DOC-4 | Barrel 0, tree 0. |
| 10 | RadarContextValue | **ACCEPT** | DOC-4 | Barrel 0, tree 0. Pair with row 9. Distinct from `RadarStableContext`, which P5.4 reports separately and which DOC-4 also covers (legacy default-exported a raw context object). |
| 11 | RingProvider | **ACCEPT** | DOC-4 | Barrel 0, tree 0. |
| 12 | RingContextValue | **ACCEPT** | DOC-4 | Barrel 0, tree 0. Pair with row 11. |
| 13 | SankeyProvider | **ACCEPT** | DOC-4 | Barrel 0, tree 0. |
| 14 | SankeyContextValue | **ACCEPT** | DOC-4 | Barrel 0, tree 0. Pair with row 13. |
| 15 | StaticChartPreviewProvider | **ACCEPT** | DOC-4 + no backing impl | Barrel 0, tree 0. Stronger than the rest: P5.2 established there is **no backing implementation at all**, so this cannot be "restored" even in principle — there is nothing to re-export. |
| 16 | BarDepthProviderProps | **ROUTE → P5.4** | *not* DOC-4 | **The outlier, and it is NOT a retirement.** Correction-7 applies: the name is gone but the thing is alive under a different name. Migrated has **`BarDepthProviderConfig`** (`internal/types.ts:287`), consumed by the **public** `BarDepthProvider` (`children.tsx:80`, barrel `index.ts:208`). So the component ships but its props type does not — `BarDepthProviderConfig` is absent from the barrel. See the routing note below for the exact fix. |

**Summary: 15 ACCEPT / 1 ROUTE.** The 15 are one doctrine (DOC-4) applied to seven
provider/context-value pairs plus `ChartProvider`'s own pair and `StaticChartPreviewProvider`.

### Row 16 routing detail — for P5.4, whose package owns `index.ts`

A consumer today can render `<BarDepthProvider>` but cannot type its props, and
`import type { BarDepthProviderProps }` fails against migrated while succeeding against legacy.
Same class of API-parity defect as `BarOrientation` (also caught this session).

**The alias is not a straight one, so do not write the obvious one-liner.** Legacy is
`export interface BarDepthProviderProps extends BarDepthContextValue { children: ReactNode }`
(`repos/bklit-ui/packages/ui/src/charts/bar-depth.tsx:264-266`) — it **includes `children`**.
Migrated's `BarDepthProviderConfig` does **not**: the component declares children separately, as
`BarDepthProvider(_props: BarDepthProviderConfig & { children?: React.ReactNode })`
(`children.tsx:80`). So `export type { BarDepthProviderConfig as BarDepthProviderProps }` would
export a structurally *different* type than legacy's and silently fail the parity it is meant to
restore. The export needs to carry the children member, e.g.
`export type BarDepthProviderProps = BarDepthProviderConfig & { children: ReactNode };`
— note legacy's `children` is **required**, not optional.

`BarDepthContextValue` itself (legacy's parent interface) has zero hits in migrated and is
covered by DOC-4 like rows 2/3/4; it is not in this ledger's 16 and needs no separate action.

---

## Non-scope notes (for the record, not rows)

- **DOC-10 loading sub-list** (`LineLoadingSweep`, `BarLoadingSkeleton`,
  `generateChartSkeletonData`, `getSkeletonHeights`,
  `GenerateChartSkeletonDataOptions`, `useStaticChartPreview` + its Provider):
  grep across `showcase/migrated/charts/` returns **zero occurrences for all seven**
  (verified this session). Per P5.1's executor-notes routing these belong to the
  **P5.7 loading-family package**, not this ledger — recorded here so the zero-hit
  evidence is not lost, rows not duplicated.

  > **⚠ LEAD RESOLUTION 2026-08-26 — this note and row 15 collided, and it was my doing.**
  > The note above hands `StaticChartPreviewProvider` to P5.7, but the lead brief's Part-1
  > list put it in this ledger's 16, and I then *also* wrote it into a new
  > `P5-07.md` Strand 6. One symbol, three owners. **Split by kind, and the split is now
  > binding:** the **Provider** (`StaticChartPreviewProvider`) is **row 15 of this ledger**
  > — it is a provider/context symbol and DOC-4 is its doctrine. The **hook**
  > (`useStaticChartPreview`) belongs to **P5.7**, with the rest of the loading family under
  > DOC-10. `useStaticChartPreview` is confirmed zero-hit in migrated. P5-07's Strand 6 list
  > still names the Provider; that is harmless duplication of *evidence*, but the ruling of
  > record for the Provider is row 15 here, and P5.7 should not write a competing one.
  > Logged because a symbol with three owners usually ends up with none.

- **Sunburst retired six** (Part 4A) are logged in `docs/phase-4/LOG.md` D-entry,
  not here (different doctrine path: P3.6-split retirement, not DOC-4).

## Part 4C — the "99 absent" list (lead, 2026-08-26)

**Skimmed, not chased, per instruction — and Part 3 has now superseded it.** P5.1's headline
("99 of 206 worksheet symbols fully absent from migrated") was already carrying a `⚠ LEAD CAVEAT
(D312)`: it is accurate as a *name match* and unsafe as a statement about functionality, because
this port renamed aggressively. Part 3 above is the same question asked properly — measured at
the barrel, whole-tree grepped, comment-only hits separated from real declarations — and it
resolves to **zero unaccounted symbols**. The 99-list needs no separate pass; anything real in it
surfaces in Part 3's buckets. Recommend retiring the 99 figure from future charters rather than
re-citing it, since it reads as a backlog and is not one.

## Part 4A — `lerpGeometry` exclusion CONFIRMED (lead, 2026-08-26)

`lerpGeometry` is **public API and correctly EXCLUDED** from the six retired sunburst symbols:
definition site `internal/sunburst-geometry.ts:314` carries the `export` keyword (added by P5.1),
and the barrel exports it at `index.ts:432`. It is used internally at `:358`, `:361`, `:364`.
The retired six remain `buildRevealDelays`, `buildRevealSchedule`, `buildSunburstEnterTiming`,
`centroidAngle`, `localProgress`, `segmentRevealFromRingSweep`.

## Part 3 — CH17 barrel-drift classification (lead, 2026-08-26)

Source data: `research/phase-4/wave-tasks/ch17-barrel-delta.md` — legacy barrel **503** exports,
migrated **427**, **154 in legacy not migrated** (153 non-empty names; the 154th is a trailing
blank) and **78 in migrated not legacy**.

**Method, and why the first cut is not the answer.** Every one of the 153 was grepped across
`showcase/migrated/charts/` — a barrel miss is not an absence proof (D312). That splits them
**29 present in tree / 124 zero-hit**. The 29 then split again, because "the string appears"
is also not an existence proof: **20 of them appear ONLY in comments**, the same shape as
`ChartProvider` in row 1 above. So the honest tally is **4 real unexported declarations,
5 partial/indirect, 144 genuinely gone**.

### Bucket 1 — OWNED (by an existing package). ~120 of the 153.

| family | count | owner | note |
|---|---|---|---|
| `*Provider` / `*ContextValue` | 15 | **this ledger, Part 1** | exactly rows 2–16 above (row 1 `ChartProvider` is comment-only, so it sorted into "present") |
| loading family | 24 | **P5.7** (DOC-10) | `AreaChartLoading(Props)`, `BarChartLoading(Props)`, `LineChartLoading(Props)`, `BarLoadingSkeleton(Props)`, `ChartLoadingLabel(Props)`, `LineLoadingSweep(Props)`, `LineLoadingPulseStroke(Props)`, `LineLoadingPulseMode`, `resolveLineLoadingPulseMode`, `LoadingStyle`, `isLoadingChromePhase`, `generateChartSkeletonData`, `getSkeletonHeights`, `GenerateChartSkeletonDataOptions`, `useStaticChartPreview` |
| `ChartBrush*` overlays | 10 | **P5.6** | `ChartBrushSelectionOverlay(Props)`, `ChartBrushTrackOverlay(Props|Style)`, `ChartBrushLayoutProps`, `ChartBrushLayoutState`, `ChartBrushSelection`, `ChartBrushPatternPreset`, `ChartBrushSelectionPattern` — matches P5.2's explicit routing of the per-overlay public components |
| y-domain / multi-axis | 11 | **P6.1** (DOC-8) + `useAnimatedYDomains` → **P6.2** | `computeYDomainsByAxis`, `mergeYDomainRecords`, `shouldTweenYDomain`, `isYDomainTweenPhase`, `getPrimaryYScale`, `YDomain`, `YAxisOrientation`, `DEFAULT_Y_AXIS_ID`, `LiveYAxisProps`, `BarYAxis` (behaviour half, already routed post-pilot) |
| sunburst breadcrumb/hint | 6 | **P5.5** | `SunburstBreadcrumb(Item|Props)`, `useSunburstBreadcrumbItems`, `SunburstHintContext`, `SunburstHintProps` — **`useSunburstBreadcrumbItems`'s zero-hit here independently confirms D323**, which ruled SB8 must be built on the public `focusId`/`onFocusChange` API rather than a hook that does not exist |
| retired sunburst six | 6 | **closed** (Part 4A) | `buildRevealDelays`, `buildRevealSchedule`, `buildSunburstEnterTiming`, `centroidAngle`, `localProgress`, `segmentRevealFromRingSweep` |
| retired chart hooks | 12 | **DOC-4**, same doctrine as Part 1 | `useChart`, `useChartHover`, `useChartInteraction`, `usePie`, `usePieHover`, `useRadar`, `useRadarHover`, `useRadarStable`, `useRing`, `useRingHover`, `useSankey`, `useSunburstStable`, `useSunburstHover`, `useBarDepthEntries` — the hook half of the provider/context removal; `useRing` R2–R4 wrappers are **P5.6**'s named scope |

### Bucket 2 — ACCEPTED under a doctrine not yet written down. 7 symbols.

The `*CssVars` family: `chartScaleCssVars`, `choroplethCssVars`, `heatmapCssVars`, `pieCssVars`,
`radarCssVars`, `ringCssVars`, `sankeyCssVars` (plus `chartCssVars`, comment-only). Legacy
generated CSS custom properties from TS constants; migrated declares them in
`showcase/migrated/charts/styles.css`. **This is an architectural swap, not a deletion**, and it
is the same shape DOC-4 covers for providers — but no doctrine names it. **Flagged for the lead
to rule** rather than silently accepted here; it is the one bucket in Part 3 without a citation.

### Bucket 3 — RENAMED / present but unexported. 4 real declarations + 5 partial.

| symbol | where it actually is | disposition |
|---|---|---|
| `DEFAULT_ANIMATION_DURATION_MS` | declared **six times privately** (`area-chart.tsx:95` et al) | **P5.4 Strand 3a.** Legacy exports it from the barrel; migrated exports none of the six. Centralizing it and exporting it are the same edit — noted so 3a does not stop at dedup and leave the barrel gap open. |
| `MarkerTooltipContent` | `internal/marker-tooltip.tsx:23` | **P5.6** (named in its scope). Real, implemented, just unexported. |
| `useActiveMarkers` | `internal/marker-tooltip.tsx:148` | **P5.6**, markers family. Real and unexported. |
| `TooltipContentProps` | `sankey-chart.tsx:172` | **Needs a look.** Legacy exports a general tooltip type; migrated's is sankey-local. Same-name/different-scope, so exporting it as-is could be wrong. → lead. |
| `PieCenterShell` | used at `internal/gauge-center.tsx:46` | **P5.6** (its named `PieCenterShell` wrapper). Consistent with D322: `CenterShell` exists at `internal/center-stat.tsx:310`. |
| `CandlestickProps`, `MarkerGroup` | `internal/types.ts:404`, `internal/chart-markers.tsx:165` | referenced, not declared under this name — renamed. Low priority. |
| `chartCenterLabelClassName`, `chartCenterValueClassName` | `styles.css:495` | same CSS swap as Bucket 2. |

### Bucket 4 — UNACCOUNTED. **Zero.**

Every one of the 153 lands in a bucket above. **This is the CH17 question answered: the migrated
barrel's drift from legacy is fully explained by known doctrine or an owned package, with no
orphan gaps.** The two items needing a lead decision are Bucket 2's `*CssVars` doctrine and
Bucket 3's `TooltipContentProps` — both flagged, neither an unexplained hole.

### The 78 migrated-only extras

Grouped rather than enumerated, as instructed. They are TanStack-native surface with no legacy
equivalent (mark/scale/focus primitives), internals promoted to public during the port
(`internal/*` helpers the barrel now re-exports, e.g. the tooltip and gradient tiers P5.2
landed), and the pilot renames DOC-9 already covers. **No extra implies a legacy regression** —
an added export cannot break `import` parity, only widen it. Not treated as work.

## Part 2 — the stale D-number literals (lead, 2026-08-26)

Two sentences, as scoped. **`docs/phase-4/LOG.md` now runs past D325, so the next free number is
D326.** `go-to-plan.md`'s literals **D240**, **D243**, and **D244** are all stale and must not be
taken as instructions to claim those numbers: D240 is already consumed at `docs/phase-4/LOG.md:79`
(the bench fix), and D243/D244 are double-booked across T-E7, T-F2 and this package. Wherever
go-to-plan.md says "Log as D24x", read it as **"log this ruling under the next free sequential
number, and state which number you took"** — the literals were written when the log was ~40
entries shorter and are now pure premise-rot of the D309 status-label kind.
