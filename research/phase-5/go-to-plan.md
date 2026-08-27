# Phase 5 — Go-To-Plan

> **Status: AUTHORITATIVE (2026-08-26).** 5.2.1 and 5.2.2 are closed; the staleness rule is live. Merges `01`, `02`, `05` with the rulings
> logged at D363–D366 and the corrections at D362. Cells that depend on the 5.1.1 pin-check
> (`07-pin-check.md`) are marked **[pin-check pending]** rather than guessed — per the
> standing rule that nothing here is invented.
>
> Once 5.3.2 begins this file is the **source of truth** (staleness rule, `PLAN-phase-5.md:114`).
> Do not re-consult `00`–`05` for code already touched.
>
> Gates are defined by **`docs/phase-5/GATE-MAP.md`** (D362), which supersedes the stale gate
> section in `02`. Diffs are taken against **`docs/phase-5/BASELINE.md` §1** and nothing else.

## Standing rulings (logged before implementation, per `PLAN-phase-5.md:70`)

| Ruling | Outcome | Entry |
|---|---|---|
| Funnel | No-migration stands | **D364** |
| Pinch | Continuous centroid-anchored; justified deviation, no automated gate | **D365** |
| Passthrough | **SPLIT** — gradients documented (no guards), patterns keep every guard | **D366** |
| Gauge linear | **FIX** — port under `<Chart>` via custom mark emitting `polyline.path` | **D363** |
| Heatmap | **MIGRATE, SPLIT** — A (colour + focus styling) gates before B (binning + stagger) | **D368** |

## Risk policy (D362)

`candlestick` (**T0**, 0.0047% headroom) · `scatter` / `heatmap` (**T1**, 0.0490 / 0.0723) get
pre+post captures in **every** batch that touches them, and go **revert-first**, never
fix-forward. No batch may stack two risky changes onto one chart within a single gate.

---

## Task table

| # | task | deviation | files | acceptance criteria | batch | risk |
|---|---|---|---|---|---|---|
| T1 | Delete `use-container-size`; adopt native fluid sizing + responsive builders; SSR via `initialWidth`, height via `height`/`aspectRatio` | D12 | `internal/use-container-size.ts` (225 LOC), all 14 `<Chart>` hosts — **NOT `adapter-shared.ts`** (see corrections) | All 14 hosts resize identically; no ResizeObserver left in migrated code; full QA unchanged | B1d | med — touches every chart at once; split per-host if any cell moves |
| T2 | Drop the redundant resize listener (host owns observation and disconnects on destroy) | D17 | `brush-drag.ts:118,342` | No duplicate RO/resize subscription; `brush` n=1000 unchanged | B1a | low |
| T3 | Consolidate ~12 `matchMedia` sites into one shared reduced-motion hook. **Keep-custom** — no exported reduced-motion signal exists (`05:46`) | D13 | `use-prefers-reduced-motion.ts:4` + 11 call sites | Single hook, one listener; reduced-motion behaviour identical | B1b | low |
| T4 | Thread `ariaLabel` through props with current hardcoded English strings as defaults; add the unused `ariaDescription` plumbing | D15 | `line-chart.tsx:1059` (**not `:1018`** — D373) + chart props | Public API additive-only; defaults reproduce today's strings byte-for-byte | B1a | low |
| T5 | Native tick config: `ticks.values` / `tickLabels.*` for format, values, rotation | D6 (fragment) | `internal/x-axis-overlay.tsx`, `y-axis-overlay.tsx`, `bar-x-axis-overlay.tsx` | Axis pixels unchanged; overlay code deleted only where fully replaced | B1c | med |
| T6 | Scene gradients: declare `spec.gradients` + stable `idPrefix`; delete sibling defs hosts and `createElementNS` | D10 | `scatter-chart.tsx:402`, `pie-chart.tsx:724`, `gauge.tsx:854` | Defs emitted inside `svg.ts-chart`; **no custom `renderSvg` wrapper** (D366a); `scatter` pre+post (T1 chart) | B2 | med — `scatter` is T1 |
| T7 | Group clip: `{kind:'group', clip:{…}}` / `spec.clip:true` replaces the hand-built clipPath | D10 | `bar-pulse-mark.ts:221` | Clip geometry identical; `bar` n=100 unchanged | B2 | low |
| T8 | Sankey `<defs>`+`<style>` keyframes → declarative per-mark `motion:` + container CSS vars | D10 | `sankey-animation.ts:94–120` | No injected `<style>`; `sankey` n=33 unchanged (T2 watch) | B2 | med |
| T9 | Replace raw `pointermove` bisectors with `group-x`/`group-y` + `maxFocusDistance` | D8 | `composed-chart.tsx:1053,1212`, `live-line-chart.tsx:500`, `internal/heatmap-components.tsx:410` | Focus resolution matches per-pixel; **`heatmap` is T1** — pre+post required | B3 | high |
| T10 | Sankey focus → painted containment; bit-exact tie-breaks via custom `ChartFocusStrategy{resolve,group,navigation}` | D8 | `sankey-chart.tsx:566` | Tie-break order identical to today | B3 | high |
| T11 | Polar: delete `/focus/disabled` + raw listeners; default `nearest` over painted arcs; `focusGroupAngle`+`onFocusGroupChange` for radar/ring-series; `onSelect`→`rootId` for sunburst drill | D9 | `pie-chart.tsx:54,614`, `ring-chart.tsx:42,722`, `sunburst-chart.tsx:44,703`, `radar-chart.tsx:14,736` | `ring` n=4 (gate of record), `pie`, `radar`, both `sunburst` densities unchanged | B3 | high |
| T12 | Crosshair + `focusGuideX/Y` replace hover-chrome DOM for marker bands and pill labels | D6 (fragment) | `internal/marker-tooltip.tsx`, `hover-chrome.ts` | Hover probes unchanged on all hover-sensitive charts | B3 | high |
| T13 | **Tooltip token migration.** `tooltip:{use:tooltip, anchor:'group-center', sort:'color-domain', portal}` + `focus:'group-x'`; delete `createRoot` + rAF scheduler. **Import `renderTooltipBody` from `@tanstack/react-charts/tooltip`** — it ships in both packages, but ours is `@tanstack/react-charts` (`gauge.tsx:111`), whose exports are exactly `.`, `./canvas`, `./core`, `./tooltip`. **Tooltip motion is opt-in via the `motion()` renderer, not automatic** (pin-check #5) | D7 | `internal/tooltip-chrome.ts` (689 LOC — the rAF scheduler was **folded in** at phase 4, `:20`; `tooltip-scheduler.ts` no longer exists). **`renderer.ts:66–85` DELETED from this list — no such file exists under `showcase/migrated`** (D373). Charts, traced by importer: `line` `area` `bar` `scatter` `composed` `candlestick` `live` **`choropleth`** — **NOT `sankey`, NOT `heatmap`** (both own independent tooltip stacks; zero imports of `tooltip-chrome`) | Every hover probe within baseline; **`candlestick` is T0 (0.0047% headroom) — revert-first**; dedicated hover screenshot pairs | B4 | **highest** |
| T14 | Dataset-flag/querySelector state machine → `stagger()` + phase filters; read state via `onRender(scene)`/`getScene()`; join via `scene.points[].key` | D11 | `line-chart.tsx:643`, `composed-chart.tsx:1221`, `candlestick-chart.tsx:832`, `scatter-chart.tsx:690`, `choropleth-chart.tsx:439`, `deferred-reveal.ts:43`, `dash-tail.ts:61`, `hover-chrome.ts:404` | No `dataset.bkm*` reads; `.ts-chart__dot` queries retained + pinned by test (`05:37`); `scatter`/`candlestick` pre+post | B5 | high |
| T15 | Sunburst replay: remount key / `update({renderer})` / `motion({initial:'always'})` replaces the hand-called `handleRender` | D14 | `sunburst-chart.tsx` — `handleRender` at `:651`, `:920`, `:1059–1138` (**not `:956–986`** — D373) | Replay visually identical; both `sunburst` densities unchanged | B5 | med |
| T16 | Wipe-rect redesign via scene coords or keyed extension nodes (**no loading API exists** — `05:39`) | D14 | `internal/loading-chrome.tsx:200` (**`.tsx`, not `.ts`; `:200`, not `:71`** — D373) | No unscoped `getElementById`; `arealoading` unchanged | B5 | med |
| T17 | **Gauge-linear port (D363).** Custom mark emitting `kind:"polyline"` + `path: createNotchPath(...)`, mirroring arc's shipped mark at `gauge.tsx:598–671`. Reuse `gauge-notch.ts`/`gauge-reveal.ts` verbatim. Reveal wiring via arc's proven `[data-ts-key="gauge-bg"]` + `onRender` | D3 | `gauge.tsx:941–1234` (raw `<svg>` 1160–1203; reveal 1091–1146) | **`gaugelinear` must stay 0.0000% on all four probes.** Real risk is viewport framing, not geometry — reproduce `viewBox="0 0 w h"` + `overflow:visible` exactly. Any movement = revert | B5 | high — zero gate upside |
| T18 | Pattern removal: port the presets to plain `<pattern>` JSX in `internal/pattern-preset.tsx`. **The bridge no longer exists** — it was folded into `pattern-preset.tsx` at phase 4 (`:9`), which now holds the sole `@visx/pattern` import (`:2–7`) covering **4** components (`PatternCircles`, `PatternHexagons`, `PatternLines`, `PatternWaves`) — not the 2 the research recorded | D5 | `internal/pattern-preset.tsx:2–7` (sole import site) + 8 call sites (`background.tsx:56`, `reference-area-layer.tsx:201`, `brush-chrome.tsx:141`, `heatmap-components.tsx:253`, `heatmap-legend.tsx:50`, `area-chart.tsx:288`, `bar-chart.tsx:1061`, `candlestick-chart.tsx:1036/1041`) | `patternarea` n=1000 is the direct gate. **Guards REQUIRED (D366b):** dev-mode registry assertion, solid-fill degradation off-SVG, static `url(#` registry test. `heatmap` is T1 | B6 | high |
| T19 | Zoom removal (see also: **x-range drag-select is only *reduced*, not resolved** — `whenSelected` does **not** compose with `brushX`; it pairs only with `keyedSelection`, so range→mark filtering stays app-owned, pin-check #27): ~140–190 LOC `internal/zoom-matrix.ts`; keep `initialZoom?: TransformMatrix` public shape, `reset()`/`setTransformMatrix()` | D5 | `choropleth-chart.tsx:27–29,77,113–121,147,151`, barrel `index.ts:223` (**not `:184–192`**, which is sunburst-breadcrumb exports — D373) | bklit-exact wheel ±5%, extent [0.5,4], cursors, idle-only transition. **Pinch is a logged deviation (D365)**, verified by scripted screenshots — no automated gate exists | B6 | high |
| T20 | Adopt `motion()` renderer; retire WAAPI `.animate()` + custom springs (~100 sites). Springs `{stiffness:170,damping:26,mass:1}` — **not** the `damping:18` shown in the tooltip guide example | D4 | ~100 call sites, all charts | M1b curve preserved (1100ms, `cubicBezier(.85,0,.15,1)`); WAAPI shell retained only for app-owned hover chrome (residue rule, `01:40`) | B7 | high |
| T21a | **Heatmap A — paint only.** Per-mark colour channel (`rect.d.ts:11`) + declarative focus styling (`states`, `when:{focus:'unmatched'}`, `whenFocused()`) | D2 | `heatmap-chart.tsx`, `internal/heatmap-components.tsx:18–19,192–210` | `heatmap` n=52 within baseline (0.4277 worst cell, **0.0723% headroom, T1 revert-first**). Nothing in A may move a cell position — a red A is a paint/hover-state defect | B2 | high |
| T21b | **Heatmap B — geometry + timing.** Binning (`binTimeX/Y`, `binX/Y`, `binXY`) + `stagger()` | D2 | same | Gates **only after T21a is green** (D368). B is the only half that can move geometry or retime the reveal | B5 | high |
| T22 | Deferred, upstream-gated: sunburst label channel (no node angles exposed), tick pills (no fill/background accessor) | D16, D6 (fragment) | `internal/sunburst-labels.tsx:56`, `sunburst-chart.tsx:447` | Executed **only** if unlocked upstream; otherwise accepted-with-log | B8 | n/a |

## D1–D17 reconciliation

Every deviation appears exactly once.

| D | disposition | where |
|---|---|---|
| D1 | accepted-with-log | D364 |
| D2 | resolved (split) | T21a, T21b (D368) |
| D3 | resolved | T17 (D363) |
| D4 | resolved | T20 |
| D5 | resolved | T18, T19 |
| D6 | reduced (split: T5 native-config, T12 crosshair, T13 tooltip content; tick pills → T22) | multiple |
| D7 | resolved | T13 |
| D8 | resolved | T9, T10 |
| D9 | resolved | T11 |
| D10 | resolved | T6, T7, T8 |
| D11 | reduced (`.ts-chart__dot` queries retained + pinned by test, `05:37`) | T14 |
| D12 | resolved | T1 |
| D13 | reduced (keep-custom, consolidated — no exported signal) | T3 |
| D14 | resolved | T15, T16 |
| D15 | reduced (aria resolved; legends keep-custom, #95 open) | T4 |
| D16 | accepted-with-log — blocked upstream | T22 |
| D17 | **reduced** — `innerHeight` keep-but-guard; resize listener deleted; brush yields the range natively but range→mark filtering stays app-owned (pin-check #27) | T2, T19 |

## Lead corrections to research citations (verified on disk, 2026-08-26)

The research files cite three paths that **do not exist**. Carried into implementation
unchecked, each would have cost a batch:

| research says | reality | effect |
|---|---|---|
| `adapter-shared.ts:32–45` is migrated code to delete (D12, `04:14`) | It is a **library** file — `@tanstack/charts/dist/adapter-shared.js`. Zero references to it anywhere in `showcase/migrated`. | Dropped from T1. We cannot delete upstream's file. |
| `tooltip-scheduler.ts:40` is a separate file (D7, `04:9`) | Folded into `internal/tooltip-chrome.ts` at phase 4 — see its `:20` and `:375` comments. | T13 file list corrected. |
| `internal/visx-pattern-bridge.tsx` is the only `@visx/pattern` import site, 17 lines, 2 components (D5, `02:9`) | Bridge folded into `internal/pattern-preset.tsx` (`:9`). That file now holds the sole import (`:2–7`) and re-exports **4** components — `PatternCircles`, `PatternHexagons`, `PatternLines`, `PatternWaves`. | T18 scope **grew**: 4 components to port, not 2. |

**visx census at this pin** (the DoD's "zero `@visx/*` imports in migrated code" target).
**CORRECTED 2026-08-27 (D392).** The previous text read "Exactly **5** real import/export
statements remain, in 2 files — everything else matching `@visx` in `showcase/migrated` is prose
in comments". That was wrong in both halves. The true count is **7 real statements in 4 files**:

- ~~`internal/pattern-preset.tsx:7` — `@visx/pattern` (T18) — 1 statement~~ — **REMOVED, D396**
- `choropleth-chart.tsx:29,30,31,224` + `index.ts:223` — `@visx/zoom` (T19) — **5** statements
- ~~`internal/gradients.tsx:14` — **`@visx/gradient`** — 1 statement~~ — **REMOVED, D396** (folded into T18 since no task row covered it)

Two errors: (a) `@visx/gradient` was omitted entirely — it is a real import of **11** components
(`GradientDarkgreenGreen`, `GradientLightgreenGreen`, `GradientOrangeRed`, `GradientPinkBlue`,
`GradientPinkRed`, `GradientPurpleOrange`, `GradientPurpleTeal`, `GradientSteelPurple`,
`GradientTealBlue`, `LinearGradient`, `RadialGradient`), publicly re-exported via the barrel
(`index.ts:579`), not "prose in comments"; (b) even the zoom lines the census itself listed total
6 statements, which it recorded as 5. **Consequence: completing T18 and T19 exactly as written
leaves the DoD unmet**, and the census re-run mandated by `PLAN-phase-5.md:118` would fail.

**Census as of D398: ZERO.** `grep -rn '@visx' showcase/migrated/` returns 21 matches, **all comment
prose**; no import, export or require statement remains. The `PLAN-phase-5.md:118` DoD clause is met.
(Intermediate state, D396: 5 `@visx/zoom` statements owned by T19.) Every `@visx/*` **package** is
still installed and declared, as D392 requires — `showcase/repos/bklit-ui` is impl-A of every QA
comparison and imports them.

**Installation is out of scope and must not change.** Per `ledger.md:76` (from `02-visx-removal.md:7`)
the `@visx/*` packages must **stay installed** at workspace level: vendored
`repos/bklit-ui/packages/ui` imports them directly and compiles as source via `transpilePackages`.
Uninstall is Stage 2, gated on legacy-bklit sunset (`03-dependencies-and-packaging.md:29`).
Removing them now would break the vendored bklit reference implementation — which is impl-A of
the QA gate itself. The DoD target is **imports in `showcase/migrated/**`**, never `package.json`.

## Open items before this file goes authoritative

1. ~~Heatmap ruling~~ — **done, D368.**
2. ~~Pin-check corrections~~ — **done**, `07-pin-check.md` folded in (D369). Verdicts: 18 CONFIRMED / 11 CONFIRMED-BUT-DIFFERENT / 1 REFUTED / 0 UNVERIFIABLE.
3. ~~Batch ordering (5.2.2)~~ — **done, D372.** Sequencing is canonical in **`docs/phase-5/BATCH-ORDER.md`** (B0 · B1a–B1d · B2–B8, strictly sequential); collision evidence in `09-batch-collisions.md`. **B1 was split** because T3 and T5 both reach `candlestick` (T0) and T5 also reaches `scatter` (T1).

**No blockers remain. Implementation (5.3.2) may begin at B0.**

> **Standing instruction for every executor: re-locate targets by SYMBOL, never by line number.** Four cited paths in the research corpus turned out to be phantom (`adapter-shared.ts`, `tooltip-scheduler.ts`, `visx-pattern-bridge.tsx`, `renderer.ts`) and line numbers have drifted by up to +249. The `files` column is a starting point, not an address.

## Capability corrections carried from the pin-check (D369)

- **No `ChartSvgRenderHooks` escape hatch.** `renderChartSvgWithHooks` is declared at
  `dist/svg-renderer.d.ts:2,10` but **no `exports` subpath maps to `svg-renderer.js`**, so it
  is unreachable. `05:26`'s fallback does not exist. The surviving renderer boundary is
  `createSvgChartRenderer` (`dist/svg-surface.d.ts:3`, via `./svg/renderer`) — build the
  D366(b) pattern guards on that. Largely moot for T6 anyway: declared gradients need no
  wrapper at all (D366a).
- **Springs are `{stiffness:170, damping:26, mass:1}`** (`dist/spring.js:1-6`). The
  `damping:18` in `docs/guides/tooltips-and-focus.md:308-309` is an illustrative snippet, not
  the default — do not copy it into T20.
- **Newly available for D15:** `ChartColorLegend{height, placement, render}` lets custom legend
  content participate in native chart layout without adopting the library legend wholesale.
  Optional improvement on T4's keep-custom disposition; not required by the DoD.
- **`clip` is a whole-marks-group boolean**; internal `SceneGroup.clip` uses `width`/`height`,
  not `w`/`h` — affects T7's shape.
- **Crosshair/focusGuide are richer than assumed** (independent x/y toggles, plus
  `paddingX`/`paddingY`/`radius`/`background` pill fields) — may reduce T12's custom surface.

## Task resolutions (appended as batches close)

Satisfies the Definition-of-Done clause "all go-to-plan tasks closed or skipped-with-reason
(logged, `D` convention)". Authoritative status lives in `docs/phase-5/PROGRESS.md`; the
reasoning lives in the cited LOG entry.

| task | batch | resolution | entry |
|---|---|---|---|
| T2 | B1a | **CLOSED** — redundant `window` resize listener deleted from `useBrushDrag`; the `ResizeObserver` fully covers it (`update` reads only `rect.width`/`height`) | D377 |
| T4 | B1a | **CLOSED, narrowed** — `ariaLabel`/`ariaDescription` threaded through `line-chart.tsx` only. The other 14 hosts still hardcode `ariaLabel`; threading them would pull T0/T1 charts into B1a's gate and breach D362's stacking rule. Candidate follow-up batch, not dropped | D377 |
| T3 | B1b | **CLOSED, narrowed** — the "~12 `matchMedia` sites" were already consolidated in an earlier phase (only 3 occurrences remain repo-wide). Only the "one listener" half was open; closed with a lazy module-level `MediaQueryList` + subscriber `Set` | D378 |
| T5 | B1c | **SKIPPED — not implementable at this pin.** `rotate` has no call site to migrate; `ticks.values` is mutually exclusive with the `ticks.count` grid alignment all six charts already use; `ticks.format`/`tickLabels.*` are inert under `.ts-chart__axes { display:none }`. Per-tick label colour, the `[data-bkm-xlabel]` hover-fade DOM contract, and the bespoke tick-selection algorithm have no native expression. Acceptance says delete only what is fully replaced — nothing is, so nothing was | D379 |
| T1 | B1d | **SKIPPED — premise wrong in both halves.** Native fluid sizing is *already adopted* on 8 of the 14 `<Chart>` hosts (no `width` prop → ResizeObserver installed at `renderer.js:184`); the other 6 pass explicit square `Math.min(width, height)` deliberately, which native cannot express. `use-container-size` is not the sizing mechanism T1 would replace — it feeds the app's parallel out-of-scene overlay geometry, blocked at all 14 call sites by circularity, sibling-overlay scene access, and a deliberate cadence difference. Census correction: 3 consumers render no `<Chart>` at all | D380 |
| T6 | B2 | **SKIPPED — half already done, half impossible.** `spec.gradients` already adopted in `area`/`bar`/`composed`/`gauge` from a prior phase, and no custom `renderSvg` wrapper exists, so the acceptance is already met. The remainder cannot be built: the package has no radial gradient type, and `renderGradients` never emits `gradientUnits` (coords clamped to [0,1] percentages), so `scatter`'s 6-stop radial + `userSpaceOnUse` gradients and `pie`'s arbitrary caller-supplied defs children (incl. `<pattern>`) are inexpressible. Cites a non-existent call site (`pie-chart.tsx:724`) | D381 |
| T7 | B2 | **SKIPPED — geometry mismatch.** Native clip is unconditionally an axis-aligned `<rect>` (`SceneGroup.clip: ChartBounds`, emitted as a literal `<rect>` in `svg.js:29`/`svg-renderer.js:81`). The hand-built clip is a 6-point perspective polygon for every bar not dead-centre (`bar-pulse-mark.ts:39-71`) | D381 |
| T8 | B2 | **SKIPPED — the named artefact does not exist.** No `@keyframes` anywhere in `sankey-animation.ts`; the cited range is gradient defs (T6's subject, `userSpaceOnUse`, inexpressible) plus CSS `transition:` rules that `sankey-hover-chrome.ts:155-161` documents as load-bearing for hover. The actual reveal animates `stroke-dashoffset`, which is absent from the motion engine's 20-attribute allowlist | D381 |
| T21a | B2 → **B3** | **RE-SEQUENCED, not dropped.** Colour half is already satisfied by the `z`→colour fallback (`rect.js:49`) — declaring `color:` is byte-identical. States half is implementable but reads TanStack focus, which nothing populates for heatmap (dim rides a hand-rolled `pointermove`; `<Chart>` gets no focus handler). That migration is **T9's** deliverable, so T21a must follow T9 in B3. Implementation constraints recorded in D381 | D381 |
| T9 | B3 | **SKIPPED as scoped — three independent blockers, none of them a missing capability.** The presets, `maxFocusDistance` (default 48px, `renderer.js:799`) and the tie-break all check out (`focus.js` `>= distance ? continue` == bklit's strict `>`). But `composed` resolves TWO point sets per move — raw `data` for tooltip values and per-row bar fade, decimated `renderData` for the highlight band's post-LTTB `datumIndex` (`composed-chart.tsx:1259-1345`) — and native focus resolves only the scene's; `resolveChartPointerFocus` runs painted containment **first** for all four presets, so a bar rect beats nearest-x near every band edge; and heatmap cells carry `inset:1` + `radius` (`heatmap-components.tsx:203-211`), so `containsRoundedRect` disagrees with the band scan at every cell boundary on a **T1** chart. `live-line` has no bisector to replace. Census corrections: `composed-chart.tsx:1053` is a min/max loop, `:1212` a series config, `live-line-chart.tsx:500` a cursor-x tracker | D382 |
| T10 | B3 | **SKIPPED — false premise, and the swap would be a regression.** Sankey has no pointermove hit-test: `sankey-chart.tsx:545-559` binds element-level `mouseenter`/`mouseleave` to real SVG nodes and links, i.e. browser-native containment over actual bezier geometry, tie-broken by paint order. A custom `ChartFocusStrategy` cannot match it — `resolve` receives only `{x, y, maxDistance}` and geometry-free `ChartPoint`s; the runtime's containment fast-path is gated on **built-in-preset identity** (`interaction.js`); `findContainingScenePoint` is unexported; `containsTarget` has no path/bezier case; and `internal/sankey-mark.ts` emits zero `interaction:` targets | D383 |
| T11 | B3 | **SKIPPED — all four deliverables; capability present, app blocked.** Containment-only `nearest` over geometry-affinity arcs verified working end-to-end (`polar.js`, `hierarchy-sunburst.js`, `nearest.js:23/33/47/110`). But the pop/growth is applied imperatively to the DOM and never to the scene (`pie-hover-chrome.ts:139,161`), so "painted arcs" are not the scene's arcs — and hit-testing animated geometry is exactly what **D254** (~3.18% pie hover-gate failure, `qa/results/pie` 2026-08-19->08-22) and **D258** (ring, "no steady state") measured and fixed with static hitbox twins. `focusGroupAngle` groups by **angle**; radar hovers by **series** (`radar-chart.tsx:766-806`), gated on `pendingRevealRef`. `onSelect` cannot serve the sunburst drill: the D32 bench dispatch sends a `MouseEvent` with no `clientX`/`clientY`, and real pointer interaction is served by a hit layer above the stage svg | D384 |
| T12 | B3 | **SKIPPED — a pincer between the two native APIs.** `focusGuideX/Y` carries the pill kit but is `whenFocused`-gated (`focus-guide.js:147`), so D382 kills it. `crosshair()` *is* reachable without focus (`crosshair-resolver.js:8` accepts an app cursor) yet cannot paint the chrome: `CrosshairRuleOptions` is stroke-only while the indicator is a computed `linearGradient` fade (`tooltip-chrome.ts:173-237`); its only motion hook is `ChartMotionDefinition`, not the clock-time spring D234 requires; `CrosshairLabelOptions` has no padding/radius/background; and the pill is **HTML** — a two-column month/day odometer with its own translateY springs (`:583-665`) that also fades the axis tick labels underneath (`applyLabelFade`). `band` is a categorical scale band, not the spring-driven `clipPath` reveal the code uses. File-list error: `internal/marker-tooltip.tsx` paints no chrome at all | D385 |
| T13 | B4 | **SKIPPED as scoped — five blockers, and the starting state is not what this row assumes.** The native tooltip is adopted on **zero** charts: no migrated chart passes `tooltip` into `defineChart` (`pie`/`ring`/`radar`/`sunburst` pass `tooltip:false` outright), `renderTooltipBody` is imported nowhere, `ts-chart-tooltip` appears nowhere in migrated output — so T13 is a from-zero adoption on 8 charts, not a token swap. (1) The row's two acceptance clauses contradict: `renderer.js:810` gates motion on `surface.renderer.capabilities?.tooltipMotion`, `capabilities` has **0** hits in `svg-renderer.js`/`svg-surface.js`, so the native tooltip snaps — while the box carries `leftSpring`/`topSpring` (3-way resolved), a fixed `entranceSpring {300,25}` scale/translateX/opacity pop, and a 100 ms WAAPI fade. (2) It is 1 of 6 sibling layers (`hover-chrome.ts:227`); the other five keep springs at `{180,28}`/`{300,30}`. (3) 27 public fields vs no native counterpart for `panelStyle`/`backgroundColor`/`boxSpringConfig`/`damping`/`matchCrosshair`/`springConfig`/`columnWidth`. (4) `paintTooltip` has one caller (tail of `paintFocus`), so it is focus-gated — `composed` (inert callback, D382) plus `live-line` and `choropleth` (no `focus` config) would render **no tooltip**. (5) `qa/screenshot.mjs:199-212` prefers `.ts-chart-tooltip`, absent today — adoption moves all 8 charts onto a different measurement branch mid-gate, on a protected file. **T20/B7 lifts (1) only.** | D386 |
| T14 | B5 | **SKIPPED as scoped — `stagger()` is already adopted.** `internal/native-stagger.ts` (24 Aug) imports the real `stagger()` from `@tanstack/charts/motion/definition` with **12 live call sites** (`pie` `ring` `candlestick` `gauge` `composed` `chart-markers`), deliberately as a delay-*value* calculator with a synthetic `ChartMotionContext`, because no chart is wired to `motion()`. `stagger()` returns `Pick<ChartMotionTiming,'delay'>` — a number — so it cannot remove a state machine. **All 8 cited lines are wrong or near-misses** (`line-chart.tsx:643` is a numeric compare; `composed-chart.tsx:1221` a tick-pill comment; `deferred-reveal.ts:43` a bare `//`). The `bkm` prefix covers **four** distinct mechanisms, and one of them — six out-of-scene overlay states — has no `ChartPoint` to join `scene.points[].key` against, permanently. `dash-tail.ts` is rAF geometry measurement, not timing: a category error in this row. Residue parked: the `bkmRevealed` stamp could become a `useRef`, but that is storage churn on 9 charts incl. `candlestick` (**T0**) for zero native surface | D387 |
| T15 | B5 -> **B7** | **RE-SEQUENCED, not voided — all three mechanisms are gated on T20.** `motion({initial:'always'})` exists (`motion.d.ts:6-17`) but is consumed via the `renderer` prop, and **`<RendererChart>` appears nowhere in `showcase/migrated`**; plain `<Chart>` has no `renderer` field and hardcodes `createSvgChartRenderer` (`react-charts/dist/Chart.js:13-14`). `update({renderer})` exists on `ChartRendererHost` but is core-only — no `forwardRef`, no hook exposes the adapter. A remount key is **strictly more destructive** than today's `playKey`, which deliberately preserves `internalFocusId`/`hoveredArcIndex`/`zoomT`; remounting resets focus to `rootId`, i.e. zooms fully out. Independently, labels/hit-layer/centre overlay are app-owned siblings no native replay reaches. Citations drift by one throughout but hit the right region **UPDATE 2026-08-27 — now RESOLVED as NOT IMPLEMENTABLE (D404).** **NOT IMPLEMENTABLE (D404).** D401 removed its reachability blocker, so it got a real audit and failed structurally. Sunburst declares one `radialArc` mark (`sunburst-chart.tsx:616`) and `polar.js` wraps every row in a **single** `<g class="ts-chart__arc">`; `createArcTracks` (`motion.js:987-1005`) therefore derives one `{startAngle, sweep, radius}` via `sceneArcGeometry` and calls `timingFor` with **`datumIndex: 0, datumCount: 1`** — per-arc stagger is structurally unavailable, against a reveal where each arc sweeps its own `a0 -> a1` (`sunburst-reveal.ts:92-125`) on a `(ringIndex*0.12 + index*0.08)*scale` delay (`:45-73`). Second blocker: `arcRows` depends on `hoveredArc` and `motion.js:606-612` animates every non-resize reconcile, re-creating the Wave-1 regression documented as fixed at `sunburst-chart.tsx:673-680`. Third: no caller-facing replay hook — `RendererChart.d.ts` declares no `ref`, `ChartRendererHost.update` is unreachable from React, and `initial:'always'` is an SSR-hydration switch; only a `key` bump remains, which tears down the surface plus the `pointerleave` listener at `:811-824`. | D388, D404 |
| T16 | B5 | **SKIPPED as scoped — both named mechanisms are absent, and the gate is miswired.** "No loading API exists" confirmed: `grep -rl "loading\|skeleton\|placeholder"` over `dist/*.d.ts` returns **zero files**. "Keyed extension nodes" is dead on arrival — no plugin/extension/`defineMark` surface exists; the mark set is closed. "Scene coords" are available (`ChartScene.margin`/`.chart`) but unwanted: `LineLoadingPulse` positions from its own React state and uses `getElementById` only as an existence guard. **Acceptance criterion cannot fire:** `arealoading` renders `<AreaChartLoading/>`, and `area-chart.tsx:72` imports only `LoadingLabel`+`buildLoadingSkeletonRows` — `LineLoadingPulse` (which holds the cited `:200`) is imported by `line-chart.tsx:62` **alone**. Correct gate is `line --state loading`. **First exactly-correct file citation in the phase.** Residue parked: the tree's **only** `document.getElementById`, latent (React `useId` + single root) and app hygiene, not native adoption | D389 |
| T17 | B5 | **IMPLEMENTED — GREEN.** The only task in six batches with no premise error, and the first code shipped since B1b. Linear gauge moved off a hand-written raw `<svg>` sibling onto a TanStack custom mark: `createMark` (public — `dist/index.d.ts:46`) emitting two `ScenePolyline` groups whose `path` carries the existing `createNotchPath(...)` output verbatim (`path` public at `types.d.ts:886-889`, honoured at `svg-renderer.js:42`). No geometry recomputed — `notch.points` passed straight through with no centre-subtraction (arc subtracts one; linear must not). `margin` zeroed; theme gradient moved to `defineChart`'s `gradients`. Reveal rewired from a pre-paint `useLayoutEffect` + `[data-bkm-key^="bg-"]` key-parse to `onRender` + a positional `[data-ts-key="gauge-bg"]` lookup — safe because `gauge-notch.ts:337,447` set `isActive: i < activeNotches` (ascending prefix), so positional index === `notch.index` and every delay/`transformOrigin`/key is preserved. **Gate: `gaugelinear` `diffPixels: 0` of 960000 on all four probes** (literal zero; acceptance was "any movement = revert"). Arc `gauge` regression-gated at **0.0064 x4, bit-identical to BASELINE §1**. Three risks outside the gate accepted: svg-root a11y attributes (`svg-renderer.js:19` has no `aria-hidden` branch), literal-px host sizing vs the disclosed `labelPlacement="left"\|"right"` quirk, and D52's one-frame mount flash re-admitted by `onRender` | D391 |
| T18 | B6 | **IMPLEMENTED — GREEN, with the undocumented `@visx/gradient` removal folded in (D392).** `pattern-preset.tsx` (+361) and `gradients.tsx` (+283) now carry local implementations; `@visx/pattern` and `@visx/gradient` are gone from `showcase/migrated/**`, leaving only the five `@visx/zoom` statements T19 owns. No package uninstalled (14/14/8 declarations intact) — the vendored bklit build is impl-A of every QA comparison. Lead-verified: `patternarea` bit-identical to BASELINE on all 4 cells + 8/8 preset cells PASS; `brush` PASS; `barsquares` PASS **at the mandated n=100** (the agent's FAIL was an n=1000 artifact); T0 `candlestick` and T1 `heatmap` bit-identical to pre-capture and BASELINE. 5 of 8 pattern sites and all 11 gradients have no pixel coverage — verified at source instead (displayName strings byte-identical, Hexagons `width`-ignoring quirk kept). | D396 |
| T19 | B6 | **IMPLEMENTED — GREEN.** Not a `zoomX` rewrite (D393: `zoomX` is 1-D and cannot express a 2-D geo gesture) but a line-by-line local port of `@visx/zoom` into `internal/zoom-engine.tsx` (663 lines), keeping `@use-gesture/react` — which visx uses to bind *native* wheel/pinch listeners, so it is the gesture engine, not an incidental dep. Full 19-method + 3-field `ProvidedZoom & ZoomState` surface preserved (the row claimed only `reset()`/`setTransformMatrix()` were needed). `choropleth` and the zoom gate both bit-identical to their baselines; tsc exit 0; no `@visx` package uninstalled. `localPoint` inlined from `@visx/event` as well, since leaving it would have missed the DoD. | D397, D398 |
| T20 | B7 | **NOT ADOPTED (D401).** Ruled down to a single-chart `area` pilot in D400 and then refused. The renderer switch itself works and is pixel-neutral — `@tanstack/react-charts/dist/core.d.ts:1` exports `RendererChart` aliased `Chart`, correcting D388 — but T20 has no deliverable left: the spring half has **zero** in-scope call sites (all four tokens are consumed only by exempt hover-chrome/tooltip modules), the tween half already equals `motion.js`'s defaults byte-for-byte, and the WAAPI-retirement clause is unachievable because `motion()`'s only group-level clip is `radialSweepClipPath` (pie/arc), not a horizontal inset wipe. `motion.js:612` also never reads the definition's `animation` option, so every data update would tween at 1100 ms against area-chart's explicit immediate-paint policy. Pilot reverted, tsc exit 0. **T15 unblocked.** The pilot's real yield was **D402**: a 537 px hover-50 move I first attributed to it survived the revert, exposing **71 flip-flopping gate cells** and three unsurfaced `candlestick` (**T0**) gate FAILs — root-caused in **D403** to a +/-1 device-pixel tooltip-panel quantization (noise, not divergence), with `candlestick`'s excursion a separate hovered-candle effect on a chart already at 0.480-0.496% of a 0.5% gate. | D399, D400, D401, D402, D403 |
| T21b | B5 | **VOID — both halves are premise errors and the gate precondition is unreachable.** Gated "only after T21a is green" (D368); T21a is permanently skipped (D381/D382), so that state will never exist. **Binning: nothing to swap.** All five helpers are real (`binX/Y` continuous, `binTimeX/Y` via `TimeIntervalLike`, `binXY` 2-D numeric) but the heatmap never bins — `HeatmapChartProps.data: HeatmapColumn[]` requires pre-binned input; the only transforms are a time filter and a `weekStartDay` rotation; `buildCellData` flattens existing bins onto `scaleBand`. **Timing: structurally incompatible.** `stagger()` is `offset + each*index` off one flat index; the shipped reveal is a seeded Lehmer PRNG on the 2-D address (`heatmapCellSeed = column*1009 + row*9176`, `state*16807 % 2147483647`, `heatmap-animation.ts:51-80`). A linear function of one index cannot express a pseudo-random function of two. Confirmed independent of T21a's focus blocker. `heatmap` is **T1**, 0.0723 headroom | D390 |
