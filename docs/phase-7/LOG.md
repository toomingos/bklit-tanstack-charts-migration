# Phase 7 — Decision log

Numbering continues from Phase 6 (last: D502). Append, newest last.

| # | Decision | Context |
|---|---|---|
| D503 | **Baseline inherited, not re-run.** The phase-6 final gate (`archive/phase-6/docs/gate/latest`, run `2026-09-02T20-09-29-038Z`: tsc/build/lint/census ok, 43 roster cells, 11 classified issues) and `bench/results/latest.json` are the reference until V0.3 re-baselines at the 0.16.0 pin. | `PLAN-phase-7.md` "Baseline". |
| D504 | **d3 boundary (R4 amended).** A direct d3 import is allowed only if the module is in the upstream "import directly" column (`docs/concepts/scales-and-d3.md:130-145`) and is a legacy direct dependency or already in the package tree. Admitted: `d3-scale`, `d3-geo`, `d3-delaunay` (6.0.4, spatial index), `d3-zoom` (3.0.0, choropleth gesture). Excluded: `d3-quadtree`, `d3-sankey`, `d3-shape`. No other new dependency in any parity exception. | `research/phase-7/08-synthesis.md` R4. |
| D505 | **One resource seam (R10).** `<pattern>`, `<radialGradient>` and the loading sweep, which the package cannot declare (upstream F-259), render from exactly one module, `internal/resource-host.tsx`, beside the chart svg, ids scoped by `idPrefix`, referenced only as `url(#id)`. Marked `// R10 seam: remove when TanStack/charts I4/I5 ship`. Known degradation: exports omit these paints. | `08` R10, §7; `07` I4/I5. |
| D506 | **Upstream asks are issues, not PRs, filed only for features other libraries share.** File now: I1 (polar/geo `states` typing), I2 (legend hover, low priority), I4 (`<pattern>` resources), I5 (`radialGradient` in `gradients`), I6 (react-charts peer `^18 \|\| ^19`), plus an evidence comment on F-260. I3 (motion renderer per-element scan) only if the V2.5 bench still shows O(elements × points). Interim code links its issue. | `07`; R6. |
| D507 | **Definition-level motion field is `svgAnimation`, not `animate`.** `09` §1 invariant 5 and earlier passes used `animate`; 0.16.0 strict literals would reject it. `surface.render` replays for wipe/sweep are dropped: `motion({ initial: 'always' })` is the single animation owner (`docs/reference/motion.md`, catalog case 112). | `08` §2 corrections. |
| D508 | **Legacy test count is 23, not 17.** 17 under `__tests__/` plus 6 under `heatmap/__tests__/`. V4.6 targets 23. | `research/phase-7/10-parity-contract.md` §6. |
| D509 | **Execution model: one tree, lead commits (R9 amended).** No per-vector worktrees: all items land on `main` in the one checkout; a wave is a dispatch batch whose items own disjoint files (`go-to-plan.md` §3). OpenCode `executor` edits and reports (every file, every command, real output) and never commits; `audit` is read-only for inventories and batch-end count checks; `work` is retired. The lead reviews the diff, re-runs the item's "done when" count, commits `phase-7(<item>)`. Discovered issues get a `G<n>` row in PROGRESS with a vector and a disposition (FOLD / NEW / ACCEPT-WITH-LOG / UPSTREAM) before any code. | `PLAN-phase-7.md` "How to work"; `08` §9. |
| D510 | **0.16.0 R1 surface was 5 migrated files, not 15 definitions.** After the pin only the polar definitions broke: `pie-chart.tsx`, `ring-chart.tsx`, `gauge.tsx` (+ `internal/gauge-geometry.ts`), `internal/use-sunburst-definition.ts`. Cartesian definitions already used `scales.x/y`; `radar-chart.tsx` already declared real `angle`/`radius` scales; no `ChartMarkX/Y` or `layout.angle` reads existed. Fix shape: `scales: { angle: null, radius: null }` on every `polar()` whose marks carry `never` scale ids, and `PolarMark<…, never, never>` / `ChartMark<never, never, never>` annotations where a bare `PolarMark`/`ReturnType<typeof createMark>` defaulted to named scales. Bench control scenarios (17 `tanstack-*.tsx`) moved root `x`/`y` into `scales`, and `tanstack-bar.tsx` replaced the removed `groupScale` with `layout: group({ scale })` (0.16.0 `bar-and-rect.md` "Grouped bars"). Strict option literals broke no wrapper, so the conditional `07` item stays unfiled. QA sweep at the pin (`docs/phase-7/gate/runs/2026-09-05T10-55-45-508Z`, 43 runs / 190 cells): gate FAIL 4 (markers hover-30, barloading settled, sankey hover-30/70: the D498-ruled cells, all inside history), out-of-range 6, all *below* floor (bardepth settled 0, barloading hover 0 ×3, ring hover-50 2933 vs floor 2954); every polar cell PASS within history. | V0.2. |
| D511 | **Upstream issues filed (V0.5, 2026-09-05, all against 0.16.0).** I1 → [#126](https://github.com/TanStack/charts/issues/126) (`states` on polar/`geoShape`), I2 → [#127](https://github.com/TanStack/charts/issues/127) (legend hover), I4 → [#128](https://github.com/TanStack/charts/issues/128) (`<pattern>` resources, cites F-259), I5 → [#129](https://github.com/TanStack/charts/issues/129) (`radialGradient` in `gradients`), I6 → [#130](https://github.com/TanStack/charts/issues/130) (react-charts peer `^18 \|\| ^19`), F-260 evidence → [#131](https://github.com/TanStack/charts/issues/131) (no tracker existed; short issue referencing F-260). I3 stays deferred to after V2.5 + V3.5 (D506). Evidence re-verified in the installed 0.16.0 dist before filing: no `states` in `polar.d.ts`/`geo.d.ts`, `gradients` is `ChartLinearGradient[]` only, peer `react ^19.0.0`. Interim code links: V2.1 `withStates` → #126, V2.3 legend hover → #127, V3.4 `resource-host.tsx` → #128/#129, V1.9 `package.json` → #130, grid style constants → #131 (each landed by the item that owns the file). | `07`; R6; D506. |
| D513 | **Orphan gate cascades to 0 (V0.4): 18 files deleted, not 9.** The audit-05 count of 9 was the first layer; deleting it exposed 7 second-layer modules (`candlestick-{bodies,highlight,hover-dot,wicks}-mark.ts`, `chart-marker-badge.tsx`, `chart-marker-circle.tsx`, `tooltip-dot-marker.tsx`) and one third-layer (`candlestick-fields.ts`), each imported only by a file above it and none exported from the barrel. `scripts/orphans.mjs` is the gate. Consequences: P-23's second tab stop (`chart-marker-circle.tsx:138`) no longer exists; only `sunburst-center-overlay.tsx:68` remains for the V4.1 probe. N-10 collapsed at `internal/bar-chart-series-marks.ts:687,776` (the `bar-chart.tsx:1825,1914` citation in `08`/`09` predates the lint split). G1 folded here: `bench/app` `CountryProperties` index signature typed to `ChoroplethFeatureProperties`' value union, no showcase edit. D364 reversal is R2 (already stamped in `08`); the funnel-on-marks note lands with V3.1. | V0.4; G1. |
| D512 | **Gate output lives in `qa/gate/latest`, runs under `docs/phase-7/gate/runs`.** `qa/gate/lib.mjs` retargeted from the phase-6 `docs/gate/latest` (now `archive/phase-6/docs/gate/latest`, D503) so V0.3 and 7.5 publish beside the roster they read. No other gate script changed. | V0.3; `PLAN-phase-7.md` "Baseline". |
| D514 | **V4.2 fixture: 292 value + 211 type `Eq` lines; 478 red lines across 420 exports; 81 migrated-only exports.** `qa/api-compat/generate.mjs` reads the legacy barrel and writes `all.ts` (strict `Eq<>` per export, legacy via the bench alias `@bklitui/ui/charts`) and `report.md` (backlog by `10` §2 family: geo/network/heatmap 81, polar 80, composed/scatter/funnel/markers 56, context/hooks 33, area/line/live-line 32, bar 31, legend 25, gradients 20, brush 13, other 13, typography 11, loading 9, animation 6, candlestick 5, utilities 5; plus the migrated-only list = V1.6's un-export inventory). Deterministic (two runs, identical md5). The fixture has its own `qa/api-compat/tsconfig.json` (extends bench) and is removed from the bench `include`, so its expected red lines never break the bench typecheck; `pnpm api-compat` is the count command, `pnpm api-compat:gen` regenerates, `roster-check.mjs` maps all 43 roster entries. `Eq` is identity, so "mismatch" (TS2344) is an upper bound on true gaps; V1.6 reports which survive as aliasable vs V3.7. The 15 hand fixtures are deleted. G3: the bench typecheck carried 22 pre-existing lib errors nobody ran (`gate:checks` builds with vite only); lib bumped to ES2023, bench tsc 0 at this commit apart from V1.8's in-flight edit. |
| D515 | **`qa/unit` scaffold (V4.1): `pnpm test` = 84 tests, 46 pass, 38 todo, ~0.4 s on `node --test`.** `qa/unit/lib/render.mjs` bundles a `.tsx` entry with esbuild into `qa/unit/.tmp/` and re-exports `defineChart`/`createChartScene`/`createChartRuntime`/`renderChartSvg` from the pinned package; `scene.test.mjs` runs one representative native definition per family through `createChartScene` + `renderChartSvg` and snapshots mark count, point count, domains and unreferenced resource ids (`qa/unit/snapshots/<family>.json`); `probes.test.mjs` server-renders every migrated family at `initialWidth` 640 and pins today's `role="img"` / tab-stop / `aria-label` counts, with the P-22/P-23 targets as `todo`. Measured today: area, composed, line, sankey, sunburst throw `Missing getServerSnapshot` (V1.7, N-2); bar, candlestick, choropleth, funnel, gauge, heatmap, live-line, scatter render no svg on the server (N-2); pie, radar, ring render 1 `role="img"`, 1 tab stop (the package svg `tabindex="0"`, package-owned keyboard focus: allowed under claim 1, not a P-23 stop), aria-label present. Placeholders `hoc/throw/resolver/ssr.test.mjs` for V1.3/V2.1/V1.7. Limits: the scene tests exercise representative package specs, not the migrated components' own definitions (those are built inside components today); they deepen once V1.1's host exposes `definition`. The pins are a ratchet: the item that moves a count updates its pin in the same commit. |
| D516 | **`ariaLabel`/`ariaDescription` forwarded on all 16 entries (V1.8).** Every entry declares both props and forwards them to its `<svg>` / chart mount, with today's literal strings as defaults, so a consumer's value replaces the literal instead of sitting beside it: `grep -rn 'ariaLabel="' showcase/migrated/charts` = 0 (was one literal per mount). Heatmap pipes the pair through `heatmap-chart-core` → `heatmap-chart-body` → `heatmap-chart-inner` → `heatmap-context` → `heatmap-cells-view` (option a, one context field, no prop drilling past the body); scatter carries them in `internal/scatter-chart-props.ts`; funnel declares the props only, because it has no `role="img"` surface until V3.1 puts it on marks (R2) and no div waiver is taken. The V4.1 probe pins (`aria-label` present) do not move: the defaults reproduce the previous literals byte for byte; the SSR pins move only with V1.7. Lint floor unchanged at 7 (V1.9's in-flight `internal/cn.ts` adds 4 that belong to that item's review, not this one). | V1.8; `10` §1 A11y surface. |
| D517 | **Package contract (V1.9): `@showcase/migrated-src@0.2.0` packs and renders standalone; dependency delta vs `10` §4 is +10.** `pnpm pack` → 450 files; installed into a fresh Next 15 app (`showcase/migrated/__pack-smoke`, gitignored): `next build` compiles and typechecks, a `LineChart` from `@showcase/migrated-src/line` renders `<svg class="ts-chart" … role="img" aria-label="Line chart">` in the browser (Playwright); the static HTML carries only the container because the chart measures client-side until V1.7 (N-2). `exports`: root + 18 family subpaths + `./styles.css`; every family entry imports the stylesheet (scatter added by the lead); `sideEffects: ["**/*.css"]`; peers react/react-dom `^19` (I6 → #130). Declared truthfully beyond `10` §4: `d3-shape`, `d3-array`, `d3-sankey`, `@base-ui/react`, `@number-flow/react`, `clsx`, `tailwind-merge`, `@use-gesture/react`, `d3-path`, `@types/geojson`; each removal belongs to the item that deletes the last import (V3.2 sankey/shape, V3.5 motion, V2.x gesture, V3.6 base-ui/number-flow), not to this one. `internal/cn.ts` replaces the 12 `@/lib/utils` imports (a package cannot reach the host app). `usePrefersReducedMotion` gained a server snapshot (`false`): five families (area, composed, line, sankey, sunburst) stopped throwing on the server; sankey and sunburst now server-render one `role="img"` + the package tab stop; the V4.1 pins moved in this commit (84 tests / 53 pass / 31 todo). `showcase/package.json` keeps `@tanstack/charts` and `@tanstack/react-charts`: the showcase compiles `migrated/charts` from source through tsconfig `paths`, so nothing else declares those deps to pnpm (G4). | V1.9; `10` §4. |
| D518 | **V0.3 baseline is run `2026-09-05T11-24-30-421Z` at `61d6179`, tree `69b9ef07…`; bundle pins re-pinned to it.** Full gate (checks, 43-run QA, 4 probes, 10 paired bench cells, 43 bundles) run in a frozen git worktree at `61d6179` while wave 1 edited the main tree; artifacts copied back (`docs/phase-7/gate/BASELINE.md` has the numbers). QA vs phase-6: 86 cells changed, 7 gate flips all FAIL → PASS, 0 PASS → FAIL; the 6 remaining gate FAILs are the D498-ruled cells. Probes: first baseline (hover-lag 5, legend-hover-dim 4, others 0). Bench: 2 flags against the kept phase-5 baseline, the +24.7 % line M1c measured beside three compiling executors (noise until 7.5 re-runs idle). Bundle: `bundle-gate.json` pins raised on 41 scenarios (+3.5 … +12.6 %, Σ +5.82 %, the 0.16.0 pin) and lowered on 2 (pie −7.2 %, barloading −97.1 %: standalone skeleton); tolerance stays 3 %; V5.1 measures against legacy, not these pins. `bench-baseline.json` unchanged. Checks at the baseline: tsc 0, lint 7 (floor), census 17 (G2). | V0.3; D503 superseded. |
| D519 | **V4.4 gate integrity: tree hash on artefacts, tsc → lint (floor 7) → bench tsc → build → unit → census → bundle-gate, 11 hand rulings as `qa/gate/rulings.json`, reach-in ledger re-keyed.** `run-checks`/`run-all` write `qa/gate/latest/tree-hash` (HEAD + dirty marker); `summarize`, `compare-qa --runs` and `run-bench` refuse artefacts from another HEAD unless `--allow-hash-mismatch`; artefacts without a hash (the V0.3 baseline) warn as unknown and continue. Checks stage stops on tsc errors; oxlint runs `--deny-warnings` and fails only above the pinned floor of 7 (count printed); `pnpm test` and `bench/app` tsc (G3) are checks steps. `rulings.json` carries the 11 hand-ruled QA cells (D498's 6 standing FAIL deviations: markers h30/h70, sankey h30/h70, barloading h50/h70; 5 out-of-range acceptances: candlestick h30/h50/h70, radar h50, barloading h30) as cell → bound → D-entry; a FAIL cell at or under its bound reads `ruled (D498)`, above it stays FAIL, so the baseline re-summarises as gate FAIL 0 / ruled 6 and 13 issues (was 16), everything else byte-identical. `scripts/reach-in-ledger.json` re-keyed to the `f5928ab` split: 15 stale entries out, 15 split modules in with the entry file's ruling, pins = today's counts, total 67 ≤ 79, guard failures 17 → 0 (G2 closed). Lead verification with V1.1's untracked WIP on disk: tracked-tree oxlint errors = 7 (the floor), the WIP adds 61 that V1.1 must clear before its own commit. Executor's checks run dir and `latest/{checks,census}.json` not committed (lint count polluted by the WIP); `latest` is refreshed by the next clean checks run. | V4.4; G2, G3 closed. |
| D520 | **V1.1 host module landed: `internal/{chart-host.tsx,chart-host-store.ts,chart-context.tsx,use-chart-interaction.ts}` + `fixtures/legacy-hooks.{tsx,check.mjs}`.** `ChartHost` mounts the package `Chart` (`@tanstack/react-charts/tooltip`, or `/core` when a renderer is passed), captures `onRender`/`onFocusGroupChange` into a `useSyncExternalStore` store with separate stable and hover subscribers, and exposes `definition`/`onRender`/`renderTooltipBody` as the raw-TanStack escape hatch. Legacy names `ChartProvider`, `useChart`, `useChartHover`, `useChartStable`, `useYScale`, `useChartInteraction` (P-8 result shape; pointer handlers are no-ops because the package owns the pointer) with the legacy throw messages. Fixture: 12 `Eq<>` tuples against `@showcase/bklit-charts` types, mutation-tested (TS2322 on a wrong pair), `renderToString` at 640 px prints `<svg` (6512 chars) via an esbuild node/cjs bundle (data-URL import of the browser build hangs on React's module-scope `MessageChannel`). Library cannot (0.16.0): `ResolvedScale` carries no configured scale object (`configured-scale.js` returns `{id, type, domain, map, invert?, ticks, bandwidth, viewport?}`), so the host builds d3 scales from `domain` + `map`-observed range; V1.2 turns those into the one scale source for every LOCAL `.range(` site. Lead counts: fixture exit 0, tsc 0, oxlint 7 (floor), `pnpm test` 84/53/0/31 todo, reach-in guard 0. Barrel exports for V1.6: `ChartHost`, `ChartHostProps`, `ChartProvider`, the five hooks, `ChartContextValue`, `ChartHoverContextValue`, `ChartStableContextValue`, `ChartSelection`, `LineConfig`, `Margin`, `TooltipData`. Executor timed out once at 2700 s (esbuild service port kept the process alive) and was resumed in-session. | V1.1; unblocks V1.2, V1.6, wave 2. |
| D521 | **Order inside V1: V1.7 (mount every family through `ChartHost`, host-owned sizing) runs before V1.2 (scales and bounds from the store); go-to-plan §4 had V1.2 first.** V1.2's executor (`ses` in PROGRESS G5) classified all 45 `.range(` hits (13 FACTORY, 7 STORE, 26 LOCAL, 2 rulings) and stopped without edits: no entry renders `ChartHost`, so no LOCAL site has a provider above it, and mounting families is V1.7's owned work. Rulings for the V1.2 re-dispatch: (a) `heatmap-cell-motion.ts:80` is an ordinal colour scale, not positional: not a V1.2 site (V3.3 owns the heatmap rewrite); (b) `bar-trimmed-mark.ts:91` `.copy().range(...)` derives from the resolved scale: counts as STORE-derived, keep; (c) `useYScale`: the host reader (`chart-context.tsx`) wins, `y-domain.ts`'s builder is the LOCAL site V1.2 replaces and V1.6 re-exports the host's; (d) hand margins: sankey and choropleth pass their margin to the package definition (automatic margins arrive with V3.2's `sankeyDiagram`/`geoShape`), radar and live-line go automatic if their QA cells stay in range, else stay as definition `margin` with the measured difference; overlays read `scene.chart`/`scene.margin` from the store in every case. V1.7 owns the store's size fields (`width`, `height`, `chart`, `margin` from the render context) while V1.2 waits; V1.2 then owns the callers of the LOCAL pure builders (`heatmap-definition.ts`, `use-composed-overlays.ts`, `line-overlay-marks.ts`, `line-gradient-defs.ts`, `bar-chart-series-marks.ts`, `reference-area-layer.tsx`, `use-line-overlays.tsx`). Serial order on area/line becomes V1.7 → V1.2 → V1.4. | V1.2, V1.7, V1.4; go-to-plan §4 wave 1/2 order amended. |
| D522 | **V4.3 curve parity in Node: `qa/curve-parity.mjs` samples 10 legacy transients against the package at 64 points; 9 PASS within 0.02, `line-pulse` is parity-contract exception 1.** Legacy side uses the installed `motion-dom` spring and `motion` bezier generators (no new dependency); package side uses `createChartSpring` from the 0.16.0 dist plus a cited verbatim copy of its unexported easing resolver and the migrated candle `findSpringStiffnessDamping`. Results (max abs Δ): reveal-enter 0, candle-enter 0.00079 (overshoot 1.0063 on both sides), sunburst zoom/grow 0.00056, ring-hover 0, hover-dim and candle-dim 0.01215, tooltip-spring 0, gauge-notch 0; line-pulse residual 1.0 (grow+shrink vs one monotonic tween; two package transitions per `10` §5 exception 1). Tolerance 0.02 on normalised progress: no earlier D-entry sets one. `qa/unit/curve-parity.test.mjs` asserts zero FAIL and the candle/reveal PASS (`pnpm test` 85 tests, +1); `qa/k4-tween-probe.mjs` demoted to smoke (`--full` keeps the WAAPI readback). Lead re-ran the table: identical. | V4.3. |
| D523 | **V1.6 export parity, first pass: generated-fixture red lines 478 → 384; 84 leaked internals un-exported; 10 `internal/parity/*` modules.** Barrel re-exports the V1.1 host under the legacy names (`ChartHost`, `ChartProvider`, the five hooks, context value types, `ChartSelection`, `LineConfig`, `Margin`, `TooltipData`; the V1.1 source wins over five older migrated definitions of `Margin`, `LineConfig`, `ChartSelection`, `useYScale`, `defaultScatterColors`). `internal/parity/{animation,typography,y-domain,heatmap,candlestick,legend,brush,bar,child-props,sunburst}.ts` carry the alias-able rows of `09` §3 (P-3, P-4 `LegendItem` shape vs `LegendItemComponent`, P-5, P-7, P-10, P-12, P-13, P-14, P-15, P-16 types, P-17 types, P-18, P-19, P-20, P-26) as types and pure ported helpers; Utilities family closed (5 → 0), Brush 13 → 5, Bar 31 → 23, Typography 11 → 8. Remaining 384 red lines are component/prop work owned by V3.7 (P-1, P-2, P-9, P-11, P-21, P-24, P-25, providers/hooks per family, the R10 gradient/pattern seam components, prop-shape mismatches on 20 components, `useBarDepthEntries`); the V1.6 count is re-read at V3.7 and must read 0 then. Kept exported although migrated-only, because `showcase/components/demos` and `bench/app` import them: `BrushLayout` value, `ChartSelectionContext` (drop with V3.7/V5.3 when the demos use the public API). Verified in an isolated worktree at HEAD with only the V1.6 files applied (V1.7 was editing the main tree): tsc 0, oxlint 7 (floor), orphans 0, api-compat 384, bench tsc 0, bench build ok, `pnpm test` 85/54/0. Executor's provider connection dropped after its final report. | V1.6; V3.7 owns the remainder. |
| D524 | **V1.7 host-owned sizing and SSR: every family but funnel mounts through `ChartHost`; `initialWidth` on 18 mounts; all 16 families server-render a non-empty `<svg>`.** Entries pass `initialWidth` + `aspectRatio`/`height` and never a measured width; `use-container-size` is imported only by `funnel-chart.tsx` (R2: funnel mounts on marks with V3.1, which also removes the hook file). The host now forwards `width` (fixed-size families) and `onFocusChange`, exposes the plot rect (`chart`) on the stable slice from the live scene, exports `HOST_INITIAL_WIDTH`/`adoptHostWidth`, and mounts custom renderers through the tooltip entry's `RendererChart` so `renderTooltipBody` keeps working (was `/core`, no tooltip bridge). Setup hooks (`use-area-chart-setup`, `use-composed-reveal`, `scatter-series-setup`) adopt the host-measured width with a 0.5 px epsilon instead of owning a measurement. The four entry-level `undefined`-on-width returns are gone (area, bar, choropleth, gauge entries); guards of the same shape survive inside pure builders (`area-chart-definition.ts:467`, `use-bar-definition.ts:217`, gauge geometry) as dead code because width is never below `initialWidth` now: V1.2 deletes them with the LOCAL sites it owns. Accepted interim, each with its owner: heatmap keeps a local live-size observer in `heatmap-chart-core.tsx` (640×160 SSR fallback) until V3.3 rewrites the heatmap on package scales; `chart?: ChartBounds` is optional on the stable slice so the V1.1 `Eq<>` fixture still holds (V3.7 makes it required with the legacy shape). Lead counts: `initialWidth` files 16 / mounts 18 ≥ 15; SSR `<svg>` 16/16 (area 12304 chars … pie 1406); V4.1 pins moved for area, bar, candlestick, choropleth, composed, gauge, heatmap, line, live-line, scatter to `{roleImg 1, tabStops 1, ariaLabel true}` (the package svg tab stop, D515); `pnpm test` 85 / 64 pass / 0 fail / 21 todo; tsc 0; oxlint 7 (floor); bench tsc 0, build ok; legacy-hooks fixture `<svg` 6512 chars. | V1.7; unblocks V1.2 re-dispatch, V1.4. |
| D525 | **`qa/unit/ssr.test.mjs` wired (V4.1 home for the V1.7 fixture): 16 real tests, one per family, `<svg>` present with a drawn node and a per-family markup floor (rounded down from the V1.7 measurement: area 8000 … pie 1000 chars); hydration adoption stays a todo.** `pnpm test` 101 tests / 80 pass / 0 fail / 21 todo. The floors are a ratchet like the probe pins: an item that shrinks a family's server markup below its floor moves the floor in its own commit with the reason. Wave 2b dispatch after the collision check: V1.2 owns `chart-host-store.ts` + `chart-context.tsx` (the `chart`/`margin` slice landed with V1.7, so it needs no `chart-host.tsx` edit); V1.3 owns `chart-host.tsx` and a new `chart-child-registry.ts` instead of a store slice; heatmap `.range(` sites, the `heatmap-cells-hooks.tsx` margin constant and V1.7's interim observer move to V3.3; V2.1 leaves the radar/sankey/choropleth margins untouched and V1.2 reports on them without editing (a margin tick follows V2.1). | Lead; V1.2, V1.3, V2.1, V3.3 in flight. |
| D526 | **V3.3 heatmap on package band scales and package axes: 39 → 13 modules, 26 deleted; `.range(`, `ResizeObserver`, `createPortal` in `internal/heatmap-*` = 0.** Cells are `cell()` marks on two package `scaleBand` scales (week columns × weekday rows) with package axes (`ticks.values`/`ticks.format`, thinning, top/left) replacing the two portal axes; per-level marks carry a constant `fill`; motion and hover `states` inlined in the definition; the separator labels are SVG `<text>`; V1.7's interim size observer is gone (host `adoptHostWidth` through `reportWidth`). Ruling: the band scales are configured *instances* with fixed ordered domains, not `() => scaleBand()` factories: with factories the package infers the y domain from the per-level marks and scrambles weekday order (`["Sun","Fri","Thu",…]` measured headlessly); the range is still package-assigned, so claim 1 holds (the package owns the range, we own the data order). Cell centres match the legacy arithmetic to 0.0000 for all 364 cells. Lead consolidated the 19 re-export statements of `heatmap-chart.ts` into one per source module (oxlint `group-exports` had risen to 18; floor 7 restored). Verified in an isolated worktree at `5e63e93` with only the V3.3 files applied: tsc 0, oxlint 7, orphans 0, reach-in guard 0, api-compat 384 (unchanged), `pnpm test` 101/80/0, bench tsc 0 + build ok; heatmap QA (built there): settled 4615, hover-30 4015, hover-50 4115, hover-70 4745 px, all PASS under the 4800 gate, each ≈ +500 px over the V0.3 baseline (4106/3522/3622/4185): label rasterisation of the package axes; 7.5 watches hover-70's headroom (55 px). Dead CSS for V3.6: `ts-bkm-heatmap-html-layer`, `ts-bkm-heatmap-axis-layer`, `ts-bkm-heatmap-axis-label(--y)`; `HEATMAP_AXIS_LAYER_CLASS` stays exported until then. `heatmap-children.ts` untouched (V1.3 owns it); `HeatmapXAxis`/`HeatmapYAxis` are null-rendering carriers detected by reference in the core until the registry pass. | V3.3; unblocks V2.2 heatmap, V2.6 heatmap axes. |
| D527 | **V1.3 registering children: carriers call `useChartChild(role, props)` into a registry provider rendered by `ChartHost`; `roleOf` unwraps `memo`/`forwardRef` and falls back to `displayName ?? name` (R5); the extractors merge scan ∪ registry with props-identity dedupe; a carrier with no host throws the legacy `useChartStable must be used within a ChartProvider…` message.** New `internal/chart-child-registry.ts` (context + register/unregister + version counter; a separate module because V1.2 owned the store this wave) and `internal/use-chart-child.ts` (layout-effect registration; `useChartChild` stays internal, nothing for the barrel). `chart-child-carrier.ts` now carries the closed `RolePropsMap` union and 32 role-checked guards with no casts; 18 carriers gained a `displayName` (survives minification). Double-paint: the prop scan still produces the SSR HTML and the first definition; registration happens in `useLayoutEffect` and the provider's version bump re-renders inside the same pre-paint commit, only when the registry adds something the scan missed. Fixture `fixtures/hoc.{tsx,check.mjs}`: memo + displayName HOC resolve through a real `AreaChart` SSR (area path 3848 chars), registry union merged=2 deduped=1, standalone `<Grid>` throws the legacy message, a `<div>` child is ignored. Same finding as G6 from the other side: entries scan `children` but never render them inside the host, so a *plain* wrapper (`p => <Area {...p}/>`, no marker, no name match) never mounts its carrier; the V1.2 resume that seats overlays inside `<ChartHost>` also renders `{children}` there and merges `extractChildren(children, useChartChildEntries())` per entry (G6 widened). Verified in an isolated worktree at `76a0fb1` with only the 40 V1.3 files: tsc 0, oxlint 7, orphans 0, reach-in 0, api-compat 384, `pnpm test` 101/80/0, bench tsc 0 + build ok, both fixtures exit 0. | V1.3; unblocks V1.4, wave 3. |
| D528 | **V2.1 `withStates` on polar/geo (0.16.0 stamped): four families carry package `states` for hover dim; sankey states are a library-cannot at 0.16.0 and wait for V3.2.** New `internal/with-states.ts`: `withStates(mark, data, definitions)` sets `states` on the initialized mark (I1 / TanStack#126 wrapper, `scene.js:187-197`). Applied to the `polar(...)` container of pie (`pieDimStates`: unmatched fill through `resolvePieRowFill(null)` + FADE_OPACITY, 150 ms ease-in-out), radar (`radarFocusStates`: matched `strokeWidth 3` stroke pop, 200 ms; unmatched dot fill/stroke dim, 150 ms; mark-id scoped because Polar drops child states), sunburst (`sunburstFocusStates` on the flattened container: unmatched fill at base × 0.25, 160 ms ease-out) and to the `geoShape` mark of choropleth (`choroplethFocusStates`: unmatched fill/stroke + pattern-dim opacity, 180 ms ease-out). Ring and gauge carry no alpha-baked dim (ring hover is geometry, gauge has no focus), so no wrapper. D424 drops restored: radar stroke pop, dot ring dim, choropleth pattern dim. Library-cannot at `@tanstack/charts` 0.16.0, each an upstream-issue candidate at batch end: (a) `states` on any child of `sankeyDiagram` makes every flow vanish on hover (hover-30/50/70 px 21806/14501/17676 with node+link wrap, 21810/14498/17793 node only, 21800/14436/17653 without transition, vs HEAD 11174/3067/7512 unwrapped; `geoShape` at top level is fine): `sankey-mark.ts` stays at HEAD and sankey dim/stagger stay reactive until V3.2 puts sankey on package marks; (b) `ChartMarkStateStyle` has no `filter`/`scale` (radar glow) and no `zIndex`/sort (hovered-feature paint order); (c) `ChartMarkStateTransition` has no `delay` (sankey node stagger); (d) `when: { focus: 'other' }` does not exist in the 0.16.0 types (`ChartFocusMatch | 'unmatched'` only), so every dim uses `unmatched`. Transitional double ownership, on purpose: the reactive alpha dims stay in place (alpha-site grep pie 6, ring 2, gauge 0, radar 16 → 23, sunburst 5 + 11 → 13, choropleth 19 → 27, sankey 1) until V2.2 wires package focus per family and deletes them; V2.2 owns those deletions (go-to-plan §2 has no V2.1 row). Barrel unchanged: `pieDimStates`/`PieRowDatum` are not parity exports, the fixture imports the module path. Verified in an isolated worktree at `dec759f` with only the 7 V2.1 files (lead fix: `PieRowDatum` moved into the trailing type export block, oxlint `exports-last`): tsc 0, oxlint 7, `states.check.mjs` exit 0 (focused arc keeps `#0ea5e9`, other resolves to `color-mix(in srgb, #f43f5e 40%, transparent)`), `pnpm test` 101/80/0, orphans 0, api-compat 384, bench tsc 0 + build ok; QA pie/1000, ring/4, radar/6, sunburst/33+27, choropleth/100 PASS; sankey/33 settled 1057 PASS, hover 11132/2905/7387 = HEAD (ruled cells, D498); gauge/gaugelinear 16742/14143 FAIL identically on a clean-HEAD worktree and PASS at `171e3c7`, so the regression is V1.7's, not V2.1's (G7). | V2.1; unblocks wave 3 (V2.2, V2.3, V3.2, V3.4 on polar/geo). |
| D529 | **V4.1 follow-up: the V1.3 HOC/throw fixture and the V2.1 states fixture run under `pnpm test`.** `qa/unit/entries/hoc.tsx` and `entries/states.tsx` re-export the showcase fixtures (`fixtures/hoc.tsx`, `fixtures/states.check.ts`) so `lib/render.mjs` bundles them like `families.tsx`; `hoc.test.mjs` asserts the scan (memo + displayName HOC = 2 areas) and the registry union (merged 2 / deduped 1), `throw.test.mjs` the legacy `must be used within a ChartProvider` message and the ignored unknown child, `resolver.test.mjs` the package `mark-state` resolver (focused arc keeps `#0ea5e9`, unmatched resolves to `color-mix(`); crosshair resolution stays a todo for V2.5/V2.6. `pnpm test` 105 / 86 pass / 0 fail / 19 todo, 1.1 s. The `.check.mjs` scripts stay as the executor-facing entry points. | V4.1; V1.3, V2.1 proof now in the gate. |
| D530 | **V4.6: the 23 legacy test files run against the migrated barrel under `pnpm test`, imports only; 38 cases pass, 87 are named todos for V3.7, 1 is a signature gap.** `qa/unit/legacy-<name>.test.mjs` × 23 port `__tests__/*.test.ts` (17) and `heatmap/__tests__/*.test.ts` (6) from vitest to `node:test` + `node:assert/strict` with zero assertion changes; `qa/unit/lib/legacy.mjs` bundles `showcase/migrated/charts/index.ts` once (pid-temp + atomic rename so parallel test files never read a half-written bundle). Per file pass/todo: animation 3/0, bar-depth-geometry 0/8, chart-formatters 0/5, decimate-time-series 0/6, heatmap-animation 0/7, heatmap-ghost 1/5, heatmap-inactive 0/7, heatmap-quarter-separator 0/1, heatmap-separator 0/11, heatmap-tooltip-format 3/0, heatmap-week-range 4/2, heatmap-week-start 4/5, highlight-segment-bounds 0/7, line-loading-pulse 2/0, loading-sweep 0/5, profit-loss-segments 3/0, projection-utils 2/1, reference-area-geometry 6/2, series-bar-layout 0/3, series-path-utils 0/4, sunburst-hover-grow 1/5, sunburst-reveal 3/0, y-domain-utils 5/4. Every todo names the export the barrel lacks (the legacy tests import module paths, so most targets are legacy internals that V1.6 never promised; the ones that are legacy barrel exports are already red lines in `pnpm api-compat` and belong to V3.7): `barDepthMaxDepth`, `barDepthAndRise`, `BAR_DEPTH_MAX_PX`, `BAR_DEPTH_PERSPECTIVE_RATIO`, `shortDateFmt`, `weekdayDateFmt`, `hmsTimeFmt`, `intFmt`, `decimateTimeSeries`, `decimateOhlcData`, `maxRenderPointsForWidth`, 27 heatmap helpers (`buildHeatmapQuarterSeparatorGroups` … `HEATMAP_ENTER_STAGGER_SPREAD`), `computeSegmentBounds`, `getSkeletonHeights`, `resolveReferenceDataRange`, `computeSeriesBarWidth`, `computeSeriesBarRevealClipPadding`, `computeSeriesPathPoints`, `interpolateSeriesPathPoints`, `seriesPathTransitionSignature`, `visibleHoverPathLength`, `hoverGrowForPathSegment`, `ancestorGrowOffset`, `applyHoverGrow`, `maxHoverSegmentThickness`, `domainsEqual`, `isReferenceAreaVisiblePhase`. The one red case, `buildHorizontalTangentBezierPath(0, 100, 200, 50)` (legacy positional, migrated options object at `internal/projection-utils.ts:147`; api-compat line 203 already red), is a lead-marked todo naming the V3.7 fix, not a weakened assertion. V3.7 turns todos green by exporting under the legacy names; a todo that stays after V3.7 is a logged rewrite. Lead: verified in an isolated worktree at `2084414` with only the 24 files: `pnpm test` 230 / 123 pass / 0 fail / 107 todo, 3.5 s. | V4.6; V3.7 backlog. |
| D531 | **G7 closed: gauge/1000 and gaugelinear/1000 read 206 / 0 px (gate 4800) after `gauge.tsx` gives the responsive wrappers a fluid width.** Root cause of the V1.7 regression (G7): `useGaugeArcStyles.innerWrapStyle` and `useLinearGaugeStyles.chartWrapStyle` set the wrapper `width` to the measured px in every branch, so the host measured its own last render and `adoptHostWidth` stayed at 640 while legacy filled 1200; the arc drew larger and lower (centre ≈ (590,275) vs (550,240)). Fix: fixed-size branches keep the px width, responsive branches use `width: "100%"` so `ChartHost` measures the container. Isolated worktree at HEAD + `gauge.tsx`: QA gauge/1000 206 px PASS ×4, gaugelinear/1000 0 px PASS ×4; tsc 0, oxlint 7, `pnpm test` 230 / 123 / 0 / 107, bench build ok. Executor `ses_f8df59e99ffe4FxjDa0GPJD75e`. |
| D532 | **V2.2 heatmap (+V2.3): the package owns the cell pointer; the legend drives dim through controlled focus; `addEventListener` and `pointer: false` in `internal/heatmap-*` = 0.** `heatmap-focus-bridge.ts` 479 → 75 lines: the hand pointer bridge (`heatmap-focus-bridge.ts:143` listener, hit rectangles, per-cell pointer maths) is deleted; `useHeatmapPointerBridge` now takes the `ChartHost` `containerRef`, `handleRender` and `onFocusChange` and mirrors the package focus point into the tooltip coordinator; legend hover calls `focusHeatmapLevel` → `setControlledFocus(sample, { source: "programmatic" })`, and the package `states` (`heatmapLegendDimStates` via `withStates`, `HeatmapCellMarkParams.focusStates`) paint the dim. Tooltip show 0 ms / hide 120 ms from legacy `heatmap-tooltip.tsx:46-47` preserved; the overlay `<svg>` is `pointer-events: none` so it never shadows the package hit test; no `aria-pressed` on legend items because legacy has no toggle. Verified in an isolated worktree at `d321313` + the four files: tsc 0, oxlint 7, `pnpm test` 230 / 123 / 0 / 107, orphans 0, reach-in 0 failures, bench build ok; hover-lag probe heatmap/52 unflagged (181/181/433 vs 119/119/119 ms); QA heatmap/52 4615 / 4015 / 4115 / 4745 px, identical to baseline. Executor `ses_f8df3022fffem7UGkplAShFIJN`. |
| D533 | **V2.2 sankey: the package owns the sankey pointer; the legacy pick order is a `ChartSpatialIndex`; the tooltip is anchored like legacy `TooltipBox`; `addEventListener` and `pointer: false` in `sankey-chart.tsx` + `internal/sankey-*` = 0.** Deleted from `sankey-chart.tsx`: the `pointermove`/`pointerleave` listener effect (`:615-655`, go-to-plan §2 `:645`), `pointer: false`, `createHoverHandlers`/`findSankeyHoverHit`/`buildSankeyClearHover`, the link-index ref mirror and the render-time prop comparison. Replacements: `ChartHost.onFocusChange` → `applySankeyFocusPoint` maps the package focus point (`sankey:sankey-node` / `sankey:flow` by `markId` + `datumIndex`) onto the reactive dim; a parent-controlled `hoveredNodeIndex` paints through `setControlledFocus(point, { source: "programmatic" })`. Default resolution picked link 10 at the QA point (its anchor 0.01 px away) where legacy's topmost-painted order picks link 16, so `internal/sankey-mark.ts` exports `createSankeySpatialIndex(points, nodes, links)`: nodes first, links in reverse paint order through `findHoveredSankeyTarget` (bezier band test, kept in `sankey-hover-chrome.ts`), miss → `null`; the definition passes it as `spatialIndex` (focus-and-interaction.md §spatial indexes). No `states` (D528 holds). Tooltip: legacy `TooltipBox` places at the mouse (`left = x + 16, top = y - h/2`, flips against the container, no enter fade), so the package tooltip runs `anchor: "pointer"`, `offset: 16`, `placement: ["right", "left"]`, `motion: false`; with `anchor: "point"` and default motion the hover-30/70 cells read 11908 / 7446 px because the QA frame caught the tooltip mid-travel. Verified in an isolated worktree at `cba58f8` + the two files: tsc 0, oxlint 7 (the `sankey-mark.ts:241/:255` sort-keys hit is the load-bearing key order at HEAD), `pnpm test` 230 / 123 / 0 / 107, orphans 0, reach-in [], bench build ok; hover-lag probe sankey/33 71 / 71 / 156 ms (legacy — / 101 / 181), `dim-presence-mismatch` 5 vs 47 dimmed nodes is the open `qa:sankey/33:hover-dim` row (ISSUES), unchanged by this item; QA sankey/33 settled 1057 (= baseline), hover-30/50/70 10071 / 2879 / 1632 px (baseline 8377 / 2866 / 7367, gate 4800): hover-50 and hover-70 PASS, hover-30 stays the D498 ruled cell (its residual is the open `qa:sankey/33:hover-dim` dim difference plus a 1-2 px tooltip box offset). Executor `ses_f8df309c7ffey1M4upskkD33FU`. | V2.2 sankey; V3.2 sankey (`sankeyDiagram`) removes the index when the package layout owns the paint order. |
| D534 | **V2.2 choropleth: the package owns the feature pointer through a `ChartFocusStrategy`; `choropleth-hover-chrome.ts` deleted; library gap stamped: a `spatialIndex` is ignored once mark states paint (0.16.0).** Deleted: `internal/choropleth-hover-chrome.ts` (per-path `onMouseEnter`/`onMouseLeave` bridge, go-to-plan §2 `:21-35`), the `pointer: false` opt-out and the interim `internal/choropleth-spatial-index.ts`. First attempt used `spatialIndex` (containment via `geoContains`); it resolved nothing in the bench because `renderer.js:772-783` consults the index only while `presentationPoints === undefined && interactionScene === scene`, and `renderer.js:350` sets `interactionScene = paintedScene` after any state paint, so a definition with `states` (D528) never reaches its index. That is a library-cannot at `@tanstack/charts` 0.16.0 (upstream issue at batch end: "spatialIndex bypassed after mark-state paint"). The seam the package does honour first is the definition `focus` strategy (`resolvePointerFocus` → `resolveChartPointerFocus`, an empty array is respected), so `internal/choropleth-focus.ts` exports `createChoroplethFocus({ features, projection })`: `resolve` inverts the scene point through the projection and tests `geoContains` in reverse feature order (legacy topmost paint), falls back to the nearest projected polygon edge within `maxDistance`, returns `[]` over open ocean; `group` is the single feature; `navigation` is feature order; hits map through `datumIndex` = index in `data.features` (`geo.js:41-92`). `choropleth-chart.tsx` sets `focus:` first in `buildChoroplethDefinition`; `choropleth-reveal.ts` clears the reveal handle on `oncancel` so an interrupted reveal cannot leave the focus scene stale. Reach-in ledger `choropleth-chart.tsx` max 2 → 1. Verified in an isolated worktree at `cba58f8` + the item files: tsc 0, oxlint 7, `pnpm test` 230 / 123 / 0 / 107, orphans 0, reach-in [], bench tsc 0 + build ok; headless resolution at the QA points (315.6,295.9) → United States of America (idx 4), (526,295.9) → Algeria (82), (736.4,295.9) → Pakistan (102); QA choropleth/100 settled 0 / hover-30 791 / hover-50 697 / hover-70 1348 px (baseline 0 / 2669 / 4687 / 4305), tooltips true/true; hover-lag probe choropleth/100 tip/last 107 / 107 ms (legacy 107 / 178, baseline 129 / 129), 0 flags. Executor `ses_f8df31363ffemCraJgg3s2V47c`. | V2.2 choropleth; upstream issue list (7.5); V3.2 geo. |
| D535 | **V2.2 polar (pie · ring · radar · sunburst · gauge): the package owns pointer and focus; definitions are hover-invariant; hover presentation rides mark states; hover geometry the package cannot express is dropped (0.16.0 gap).** Deleted: `internal/polar-hit.ts`, `internal/pie-hover-chrome.ts`, `internal/ring-hover-chrome.ts`, `internal/sunburst-hit.tsx`, `internal/sunburst-hit-path.tsx`; `focusDisabled` on radar/gauge; the radar listeners; `styles.css:193` (`svg:focus:not(:focus-visible)`) plus the dead E3/E4 radar block (`.bkm-radar-area*`, 63 lines, no class stamped any more); polar diff 541 + / 1122 −. Rulings (lead, logged verbatim in the executor session): (1) nothing derived from hovered/focused state is an input of any `defineChart`/`polar`/mark builder in the five families — `buildPieDefinition`, `buildRingDefinition`, `buildRadarDefinition`, `buildSunburstDefinition`, `buildArcDefinition` are exported pure builders and a headless double-build proves deep-equal scenes; (2) hover geometry that `dist/mark-state.js:114-165` cannot apply to arc/area nodes (state `dx/dy/r/radius/inset/rotate` reach dot, rect and label kinds only) is a library gap at `@tanstack/charts` 0.16.0 — pie slice translate/grow (`hoverOffset`/`hoverEffect`), ring 1.03/1.02 radius scale, sunburst hover grow and the radar hovered-area 1.05 scale + drop-shadow glow (`ChartAreaStateStyle` is fill/fillOpacity/stroke/strokeOpacity/strokeWidth/opacity) are dropped, props stay accepted for the parity contract (upstream issue at batch end: "arc state geometry"); (3) controlled hover (`hoveredIndex` on pie/ring, controlled radar/sunburst) goes through `setControlledFocus(point, { source: "programmatic" })` from the `onRender` interaction (`useFocusInjection`), never a definition rebuild; uncontrolled hover is package pointer focus → `onFocusChange` → the hover store for centre/legend chrome only; (4) radar's hovered boost rides states (area fill 0.15 → 0.35, stroke 2 → 3, dot `r` 4 → 6); (5) the radar grid leak (`mark-state.js` ownership fallback dims grid nodes) is answered by two containers — states wrap only the owned area/dot marks, every guide key lives outside and is byte-identical under focus (headless proof); (6) sunburst: `focusGroupAngle` never resolved because the package `sunburst()` mark carries no polar focus geometry (`withPolarFocusGeometry` is attached by polar marks only) and `nearest-x` skips hierarchy points, so `internal/sunburst-focus.ts` exports `createSunburstFocus` (`ChartFocusStrategy`: angular containment in reverse paint order from the definition's own arc geometry, `[]` outside the outer radius, closure-kept last hit inside the centre vertex / ring padding because 0.16.0 has no retain option; `group` = hovered + ancestors/descendants; `navigation` = a0 order) — headless resolution at the QA points: n=27 Branch 1 / Branch 1 / Branch 3, n=33 Branch 1 / Branch 1 / Branch 4. (7) radar: `focusGroupAngle` groups every series' vertices as one match so the unmatched dim never fires (hover cells 14636 / 10802 / 9320 px vs baseline 157 / 754 / 143), so `internal/radar-focus.ts` exports `createRadarFocus({ metricKeys })` (`ChartFocusStrategy`: even-odd containment of the pointer in each series' painted polygon built from the package's own vertex `ChartPoint.x/y`, topmost paint order first, returns that series' points, `[]` outside every polygon = legacy mouse-leave; `group` = the series; `navigation` = series then metric order) — headless at the QA points (120,200) → series 3, (200,200) → 5, (280,200) → none, matching legacy `onMouseEnter`; vertex deviation 0. `internal/hover-motion.ts` (new) holds the easing adapter (cubic-bezier → progress fn for mark motion), the pie hover coordinator and the broadcast hover source shared by pie/ring/radar/gauge reveal code; its `createOffsetArc` is dead with zero offsets and goes with V3.5 (G row). oxlint 7 → 4 (floor lowered). `qa/unit/ssr.test.mjs` floors gauge 17000 / radar 10000 (hover chrome left the SSR string); reach-in radar 20 → 18, ring-chart-model 5 → 4, sunburst 8 → removed. Verified in an isolated worktree at `cba58f8` + the item files: tsc 0, oxlint 4, `pnpm test` 230 / 123 / 0, orphans 0, reach-in [], fixtures 0/0/0, bench built; hover-lag probe (pie only among polar): 6 flags all baseline-identical (`dim-presence-mismatch` pre-existing, D-ruled); QA pie/1000 411 / 99 / 0 / 155, ring/4 0 / 2928 / 2533 / 547, gauge/1 213 ×4, gaugelinear/1 0 ×4 PASS; radar/6 96 / 629 / 6446 / 99: hover-50 sits above the 4800 gate because the legacy hovered polygon scales 1.05 about the centre with a drop-shadow glow and `ChartAreaStateStyle` has no geometry or filter channel (ruling 2, G9), so `qa/gate/rulings.json` `radar/6/hover-50` moves from the D498 bound 758 to 7000 under this entry; sunburst/27, sunburst/33 and sunchrome/27 hover-30 read 8439 / 9075 / 8667 (baseline 3107 / 2768 / —) with hover-50/70 at baseline: routed to V3.2 sunburst (G12), not fixed here. Executor `ses_f8d4d765affeN3G7OH71ZjWuOO`. | V2.2 polar; V3.2 sunburst; V3.4; V3.5; upstream issue list (7.5). |
| D536 | **V3.2 sankey: the package `sankeyDiagram` owns the flow layout, links, node rects and labels; `d3-sankey` and `createElementNS` leave the sankey path.** `internal/sankey-mark.ts` builds one `sankeyDiagram` with package `link` (curve `d3Curve(curveBumpX)`, `strokeWidth max(1, width)`), `rect` (`color` channel through `sankeyIdentityColorScale`, `radius: lineCap`) and two `text` marks (name, value); `sankey-layout.ts` reads node/link geometry from the package scene (local `LaidOutNode`/`LaidOutLink`, no `d3-sankey`); `sankey-gradients.ts` deleted, `sankey-label-nodes.ts` −237 lines, link gradients are declared per link as `sankey-flow-<i>` in `sankeyChart` `gradients` (`sankey-flow-style.ts`: solid source colour when `|y1 − y2| < 0.5`); reveal/animation code queries `[data-ts-key^="sankey:sankey-node:"]`. 7 files, +324 / −462. Rulings: (1) gradients: the package `ChartLinearGradient` has no `gradientUnits`, so a per-link objectBoundingBox gradient x1:0 → x2:1 stands in for the legacy `userSpaceOnUse` source-x → target-x gradient; for a bumpX link the two are the same colour field over the link's bounding box, flat links paint solid (upstream issue "gradientUnits on ChartLinearGradient", G row); (2) label baseline: the package `text()` mark hard-codes `baseline: "middle"` while legacy paints alphabetic + `dy=0.35em`; measured in Chromium with Geist the residual is 0.0844 em (1.097 px at 13 px, 0.928 px at 11 px), applied in screen space through the `dx`/`dy` channels (+x at −90°, −x at +90°, +y unrotated) — this is the one hand offset kept, stamped here, upstream issue "text() baseline option" (G13); (3) the legacy `sankey-link.tsx` connected-flow boost `min(1, strokeOpacity·1.3)` rides a second `withStates` entry, not the definition (the executor had dropped it; QA settled cell read 7045 px until baseline + boost were restored, then 1028); (4) D528(a) (states cannot attach to the sankey containers at 0.16.0) no longer reproduces with package `link`/`rect` marks — `withStates` is on both; the reactive dim rebuild is still alive next to it (dim double-owned, G15, V2.2 sankey follow-up, not this item); (5) `bar-pulse-clip.ts` keeps 3 `createElementNS` calls — not sankey, routed to V3.4/V3.9 (G14); (6) `d3-sankey` stays in `showcase/package.json` / `migrated/package.json` until V1.9 removes it (§3 owner), imports are 0 (`sankey-hover-chrome.ts` keeps two comment mentions). Verified in an isolated worktree at `fa11cfd` + the item files: tsc 0, oxlint 4 (floor), `pnpm test` 230 / 123 / 0, orphans 0, reach-in [], fixtures 0/0/0, bench built; hover-lag probe sankey tip/last 120 / 208 ms (legacy 105 / 181; the previous 1298 `settles-after-700ms` flag is gone, `dim-presence-mismatch` pre-existing); QA sankey/33 settled 1028 (baseline 1057) PASS, hover-30 9983 ruled (D498), hover-50 2953 PASS, hover-70 4519 PASS. Executor `ses_f8d1639a1ffe2MAuWkNXCijbi3`. | V3.2 sankey; V1.9; V2.2 sankey follow-up (G15); V3.4/V3.9 (G14); upstream issue list (7.5). |
| D537 | **V1.2 merged (G5, G6 closed): every positional scale and plot bound in the cartesian families comes from the host store; LOCAL `.range(` = 0; registration is identity-stable.** Classification of the 22 remaining `.range(` rows: 13 FACTORY (d3 factories that build the package scale from the store's resolved range: `composed-scales.ts`, `scatter-scale-setup.ts`, `area-chart-definition.ts`, `live-line-scales.ts`, `line-x-scale.ts`, `candlestick-chart-scales.ts`), 8 STORE (`chart-host-store.ts` readers plus `bar-trimmed-mark.ts:85` `.copy().range(...)`, D521 b), 1 read-only getter (`use-composed-reveal.ts:225`); LOCAL 0 (was 26 at D521). Margin constants are gone from `brush-chrome.tsx`, `dash-tail.ts`, `terminal-marker.tsx` (heatmap's went with V3.3): each overlay reads `plot`/`margin` from `useChartStable()`. G6 fix: the six cartesian entries (area, line, bar, composed, candlestick, live-line) and scatter render their overlays as `ChartHost` children behind a `{children}` bridge, so the store provider sits above every former LOCAL site; `useChartChildEntries()` is called only in the bridge. Regression found by the lead in the bench (React #185 update loop on every cartesian mount): three identity-based mechanisms compounded (fresh carrier props every render → `useChartChild` unregister+register → registry consumers re-render → `report` identity guard fails → chart re-renders). Ruling: registration is identity-stable and comparison is by value. `chart-child-registry.ts` gains `register(entry): number` + `update(id, entry)` (shallow-compare, bumps `version` only on real change) + `unregister(id)` and `shallowEqualChildProps` (own keys, `Object.is`, `children` excluded); `use-chart-child.ts` registers once per mount and updates through a no-deps layout effect; `chart-host.tsx` `report` compares role + shallow props; `children-extract.ts`/`composed-children.ts` skip registry entries that match a scanned element by role + shallow props (identity fast-path kept, `hoc.check` unchanged: merged 2, deduped 1, throw intact). Verified in an isolated worktree at `cba58f8` + the V1.2 file set: tsc 0, oxlint 4 (floor; one memo dependency and one wrapped comment fixed by the lead), orphans 0, reach-in [], fixtures 0/0/0, `pnpm test` 230 / 123 / 0 / 107, bench tsc 0 + build ok; Playwright mount+hover on line/bar/liveline/area/composed/candlestick/composedstacked/areamultiaxis/scatter/brush/markers: 0 console errors, tooltips visible on every hover chart; second executor pass (band-start vs package band-centre `map`, margin-inclusive `context.range`, figure-svg origin) fixed bardepth (93 → 0 diff nodes), barsquares, refareamultiaxis and profitloss; 43-run QA: every cell PASS or ruled except sunburst hover-30 ×3 (G12, V3.2 sunburst) and brush ×5 / barloading ×3, which read identically on the untouched HEAD worktree and bisect to `0012eca` (V1.7) — 171e3c7 brush 401 / barloading 0, 0012eca brush 10929 / barloading 20549 — logged as G16, not this item; hover-lag probe: no new flag, the 13-chart table matches the untouched `7e183af` tree flag for flag (line 176/63/176, area 195/85/195, composed 142/142, candlestick and liveline flags pre-exist vs the V0.3 baseline → G17). Executors `ses_f8e278ecaffe1v21g6xwaZOzjf` (first: `ses_f8e5d909effe6PGyPKJO5rnNpP`). | V1.2; G5, G6; unblocks V1.4, V2.4, V2.5, V2.6 on area/line. |
| D538 | **V3.2 geo: `d3-zoom` owns the choropleth gesture policy; the five vendored `internal/zoom-*.ts` (976 lines, the visx zoom port) are deleted; `ProvidedZoom`/`ZoomState`/`TransformMatrix` stay as a type facade.** `internal/choropleth-zoom.ts` (new, 420 lines) binds one `zoom()` behaviour on the chart container through `select(el).call(behaviour)` (`d3-selection`, declared in `showcase/package.json` and `bench/app` by the lead; it is `d3-zoom`'s own dependency, no new weight — the executor's first pass had a 99-line native-DOM selection shim, deleted under principle 2), `scaleExtent([zoomMin, zoomMax])`, `wheelDelta` = `Math.log2(1.05)` / `Math.log2(0.95)` reproducing the legacy per-tick step, d3's default filter and native pinch; `<ChoroplethZoom onZoomTick>` replaces `<Zoom>`, every `zoom` event feeds `onZoomTick({ transformMatrix, isDragging })` and `end` after a drag starts the 180 ms ease (`choropleth-zoom-motion.ts`, `resolveWheelZoomDelta` and the step constants deleted); the render-time tick gate and `useMountedRef` in `choropleth-chart.tsx` are gone. `internal/choropleth-zoom-types.ts` (85 lines) carries the legacy surface verbatim (`TransformMatrix`, `Point`, `Translate`, `Scale`, `ScaleSignature`, `ProvidedZoom`, `ZoomState`, `ZoomInstance`, `GenericWheelEvent`, `InteractionEvent`; `ZoomProps`/`PinchDelta` dropped, no importer). Rulings: (1) the facade methods (`setTransformMatrix` → `behaviour.transform(zoomIdentity.translate(tx, ty).scale(k))`, `reset` → initial, `scale`/`translate` → `scaleBy`/`translateBy`, `applyToPoint`/`invert`/`toString` from the live `ZoomTransform`) are the parity surface, not a second gesture engine — nothing in the chart calls `handleWheel`/`dragMove`/`handlePinch`, d3 owns the events; (2) a `TransformMatrix` with skew or non-uniform scale throws like an invalid prop (d3-zoom is uniform); (3) `setTransformMatrix` clamps `k` into `scaleExtent` (legacy rejected out-of-range). `bench/app/vite.config.ts` aliases `d3-zoom` and `d3-selection` to their ESM sources like `d3-sankey`. Verified in an isolated worktree at `7e183af` + the item files: tsc 0, oxlint 4 (floor), `pnpm test` 230 / 123 / 0, orphans 0, reach-in [] (total 55), fixtures 0/0/0, bench built; QA choropleth/100 settled 0, hover 791 / 697 / 1348 PASS; hover-lag probe choropleth tip/last 107 / 107 ms (legacy 113 / 197), no flag. Executor `ses_f8d031f9dffeQOJ3lEjSybdeXO`. | V3.2 geo; V1.9 (`d3-selection` in the package contract); upstream none. |
| D539 | **G15 closed: sankey hover dim owned once, by package states.** `internal/sankey-mark.ts` lost `resolveSankeyHoverState`, `SankeyHoverState` and the `hoveredNodeIndex`/`hoveredLinkIndex` config; the definition is hover-invariant (link endpoints captured once per build, `when` predicates read `context.focus`/`context.matches` through `sankeyFocusPrimaryOf`/`isSankeyLinkConnected`/`isSankeyNodeConnected`) and dim, the 1.3 connected-flow boost and label dim all ride `withStates` on `link`, `rect` and both `text` marks. `sankey-chart.tsx` lost every React hover state and the definition rebuild; controlled `hoveredNodeIndex` goes through `useFocusInjection().focusPoint` (`programmatic` source, the pie pattern), `onFocusChange` only notifies `onNodeHoverChange`. `sankey-hover-chrome.ts` keeps hit-testing for the spatial index, loses `computeNodeHoverConnected`/`computeLinkHoverConnected`. 3 files, +98/−220. Counts: `hoveredNodeIndex\|hoveredLinkIndex` in sankey-mark = 0, `useState` in sankey-chart = 0, headless double-build deep-equal under different hover. Verified in isolation at `7e183af` + the 3 files: tsc 0, oxlint 4, tests 230/123/0, orphans 0, reach-in [] total 55, fixtures 0/0/0, bench built; QA sankey/33 settled 1028 PASS, hover-50 3276 PASS, hover-70 2087 PASS, hover-30 10071 ruled (D498); hover-lag probe sankey tip/last 101 / 188 ms (legacy 102 / 181), migrated dimmed elements 5 (was 0 at `7e183af`; legacy 47, `dim-presence-mismatch` stays and is G17-class). Executor `ses_f8e09a1d3ffeUv4qwx8pXwdB7q`. | G15 closed; V2.2 sankey follow-up. |
| D540 | **V3.2 sunburst: package `sunburst()` owns the partition; the hand partition left the chart path (G12 closed).** `internal/sunburst-geometry.ts`, `sunburst-layout.ts`, `sunburst-arc-path.ts` (468 lines) are deleted; the legacy partition survives verbatim as `internal/parity/sunburst-geometry.ts` (434 lines, self-contained) because the barrel exports `buildArcs`/`geometryFor`/`arcPath`/`transitionGeometry`/… (P-20) — it is imported by `index.ts` only, nothing in the chart path reads it. `internal/sunburst-rows.ts` (160 lines) is the only pre-package step: flat rows + a pre-order sector index (ids, trails, branch colours; `a0/a1` are the package's). `use-sunburst-definition.ts` feeds `sunburst(flatRows, { rootId, motion })` with node-keyed fills; drill is `rootId` + package motion, the hand `zoomT` morph in `use-sunburst-zoom.ts` is gone (commit-only zoom). `sunburst-focus.ts` resolves the pointer against the painted sector polygons (`area.points` + group offsets, reverse paint order, 0.5 px centre-vertex guard, enter-only `lastHit` parity) — this is the G12 fix: at (0.3·W, H/2) the strategy now resolves `Leaf 1.1` like legacy (headless replay on the recorded QA points, n = 27 and 33, centroids self-resolve 25/25 and 36/36). Reveal stagger is pre-order (= angular order), delays bit-identical; labels are settled-scene snapshots (centroid, angle, lineage, arc length scaled to the centroid radius) and remount per root. Ruling: no mid-zoom label morph and the hub jumps to its target size at commit — the package morphs the arcs and the hole; a hand label tween would be a second motion engine (principle 2), and zoom-transit label motion is outside the `10` §1 runtime rows. `sunburst-chart.tsx` memoises `createChartScene(definition)` so SSR and first paint agree (SSR 22654 chars vs 22657, `<path` 28 = 28). Counts: `d3-sankey` 0, `createElementNS` 0, chart-path imports of the parity geometry 0. Verified in isolation at `21bd65b` + the 10 files: tsc 0, oxlint 4 (after a lint follow-up: the executor's first report claimed the floor while the tree read 77), tests 230/123/0, orphans 0, reach-in [] total 55, fixtures 0/0/0, bench built; QA sunburst/33 581 / 2768 / 2654 / 1676, sunburst/27 576 / 3107 / 3100 / 2790, sunchrome/27 651 / 3252 / 3242 / 2991, all PASS; hover-lag probe hover-lag 13-chart table matches the G15 run flag for flag (sunburst is not a probe chart). Executor `ses_f8cf081e3ffeWqgAIvSGNeQrSx` (timed out at 2700 s once, resumed). | V3.2 sunburst; G12 closed. |
| D541 | **G16 closed under a stamped ruling (0.16.0): the package cannot report a measured height, so line, area and the bar loading skeleton read the container height from `use-container-size` again; the package still owns width, plot, scales and resize.** Evidence: `dist/renderer.js:720` sets `height = options.height ?? width / aspectRatio ?? 320` and the renderer's ResizeObserver (`:187-191`) schedules a render only when `currentWidth()` changes — a container whose height is set by CSS (brush mini-line below the plot, loading skeleton in a fixed box) never reaches the scene. V1.7 (`0012eca`) latched `measuredHeight = 0` in `line-chart.tsx` and `use-area-chart-setup.ts` and rendered `bar-chart-loading` at `HOST_INITIAL_WIDTH`; brush/1000 read 10929 px and barloading/100 ~20000 px (G16). Fix: `line-chart.tsx` height from `useDebouncedContainerSize(containerRef)`, `use-area-chart-setup.ts` from `useMeasuredRect(containerRef)`, `bar-chart-loading.tsx` measured rect wins over the host initial width with height via `resolveChartHeightPx`; `line-chart-support.tsx` re-exports the hook. 4 files, +15/−6. This is not a second sizing implementation: the hook measures the box the host already owns and feeds `height` into the same `createChartScene` options; nothing derives a width. Upstream I7 (07-upstream-issues.md, candidate): height-aware resize (observe `contentRect.height`, or an `options.height` observer). Composed (`composed-chart.tsx:159`) and candlestick (`candlestick-chart-chrome.ts:587`) still derive height from width/aspect: logged as G18, routed to V2.5/V2.2 composed follow-ups. Verified in isolation at `57d8840`: static gates green; QA brush/1000 401 / 630 / 689 / 3092 / 401 (settled, left, right, hover-50, clear; 171e3c7 read 1231 on hover-50 — the delta is the hovered-line dim and pill antialias, V2-class, all PASS), barloading/100 0 / 0 / 0 / 0. |
| D542 | **V2.4: decorative tooltip springs are package transitions; the hand spring engines are deleted.** `internal/tooltip-mappers.ts` gains the pure `resolveTooltipSpringTransition(spring)` (legacy `{damping, stiffness}` → `ChartMotionTransition {type:'spring'}`, docs/reference/motion.md, 0.16.0). `tooltip-components.tsx` lost `ensureDotSprings`, `useTooltipDotSprings`, `ensureIndicatorSprings`, `useTooltipIndicatorSprings`, `useTooltipBoxMotion`, `useTooltipBoxFollow` and every `setAttribute` write; dots, indicators and the box render their positions declaratively from focus-point props; `tooltip-date-ticker.tsx` lost its `createSpring` ticker. 7 files, +107/−701; `grep "setAttribute\|createSpring" internal/tooltip-*` = 0. Entries never mount these React indicator components (indicators are package marks via `buildIndicatorMark`), so the QA cells are the parity proof for the mark path: verified in isolation at `57d8840`, static gates green (tsc 0, oxlint 4, tests 230/123/0, orphans 0, bench built); QA line/1000 0 / 875 / 985 / 1267, area/1000 3 / 1048 / 1095 / 1379, bar/100 0 / 1977 / 2262 / 2122, candlestick/1000 3263 / 1877 / 818 / 729, scatter/1000 34 / 4368 / 4201 / 4690 — every cell equal to the V1.2 run (`d083c3a`) within ±130 px, all PASS. Remaining non-aria `setAttribute` sites (bar-pulse-clip 1, bar-pulse-sync 1, chart-reveal-clip 5, sankey-reveal-specs 1) are V3.5/V3.9 owned. |
| D543 | **V2.2 composed: the package owns composed pointer and focus; the reactive hover rebuild and the hand listener are deleted.** `internal/use-composed-hover.ts` and `internal/composed-hover.ts` are gone; `internal/use-composed-focus.ts` (new) reads `onFocusChange` from the host; `composed-chart.tsx` has 0 `useState`/`useEffect` and 0 `addEventListener`; `hoveredIndex`/`labelFade` left `composed-definition.ts`, `composed-marks.ts`, `composed-scales.ts` and `composed-series-marks.ts` (definition hover-invariant, executor headless proof deep-equal at marks 3/3, points 3000/3000 and 300/300; focus identical at 0.3/0.5/0.7·W for composed and composedstacked). 9 files, +155/−503. Executor `ses_f8c45a2d1ffe506w2NjjJevjRx`. Three legacy hover affordances are not rebuilt: the x-tick label fade under the date pill, the area-fill hover dim and the bright highlight band — line and area still thread the same `labelFade` through their definitions (`use-line-chart-spec.ts:111`, `area-chart-definition.ts:89`), and V2.6 replaces the HTML date pill and `hover-geometry.ts` with the package `crosshair({ x: { label: true } })`, which is where the tick treatment becomes package-owned for all four cartesian families: G19, routed to V2.6, not a composed-local rebuild. QA in isolation at `57d8840`: composed/1000 811 / 1171 / 1523 / 1850 (baseline 811 / 557 / 919 / 1839 — the hover deltas are the G19 tick label under the pill, all PASS), composedmultiaxis/1000 853 / 1950 / 1935 / 2449 (853 / 1598 / 1958 / 2435), composedstacked/100 390 / 1544 / 2033 / 1855 (390 / 3096 / 3632 / 3228, better); static gates green (tsc 0, oxlint 4, tests 230/123/0, orphans 0, bench built). |
| D544 | **V2.5: a finite `maxFocusDistance` on every cartesian focus option; no `spatialIndex` on the five families — ruling stamped 0.16.0.** Evidence: `docs/reference/focus-and-interaction.md:963` ("A custom `focus` strategy takes precedence over `spatialIndex` for pointer resolution") and `dist/interaction.js:3-11` resolve the built-in strings (`group-x`, `nearest-x`) to strategies as well, so `renderer.js:770-781` returns the strategy result before `spatialIndex.findNearest` on line, area, bar, candlestick (`group-x`) and scatter (custom strategy). The executor's first pass wired a `d3-delaunay` factory (`internal/cartesian-spatial-index.ts`) and proved it consultation-dead; it is deleted (principle 2), `d3-delaunay` imports in charts = 0. `internal/cartesian-focus-distance.ts` (new) exports `CARTESIAN_MAX_FOCUS_DISTANCE_PX = 16_384` (finite, larger than any display diagonal, so the pick equals legacy whole-plot nearest-x; headless proof: 15/15 primaries identical at 0.3/0.5/0.7·W for line, area, bar, scatter, candlestick n per roster); `maxFocusDistance: Number.POSITIVE_INFINITY` in charts = 0 (area ×2, line, bar ×2, scatter, candlestick, composed:240, live-line:515). D472 decision: the focus path is one linear scan per resolve (line n=1000 100 resolves 25–42 ms, n=5000 104–343 ms; the index query would be 0.1–1.4 ms but cannot run) — not O(elements × points), so the cardinality gate (`NATIVE_MOTION_MAX_POINTS`, motion-renderer.ts) has no focus justification and V3.5 deletes it with the renderer switch (go-to-plan §3); I3 stays "file only if the cost remains after V3.5". Executor `ses_f8c35704effe6Ps7uOfUTu1Abv`; 8 files (+14/−8 plus the new module). Verified in isolation: QA (`run-qa` on HEAD 3b6ea32 + item files, 1200×800, 8 charts/32 cells): gate FAIL 0, every settled cell identical to `qa/gate/latest`; hover-70 cells moved within the gate — bar 3813→2115 px, composedstacked 3228→1855, line 1231→1267, composed 1839→1853, scatter 4690→4697, candlestick 591→729, liveline 2279→3043 (rolling path, time-dependent), area unchanged 1379. Probes (`hover-lag`, 13 charts): 6 flags, the same set as the V3.1 run on the pre-item tree (bar settle, scatter dim-lag, candlestick tooltip/dim-lag/settle, pie and sankey and liveline dim-presence); no flag added or removed by the item. G17's candlestick `dim-lag` (758 vs 130 ms) survives the finite focus distance, so it is not a focus-option cost: G17 re-routes that half to the wave-3 batch-end bisect. |
| D545 | **V3.1: funnel on marks — D364 reversed; the funnel mounts through `ChartHost` on a `defineChart` with one `createMark` per orientation.** D364 (phase 5, 2026-08-26) ruled no migration because 0.11.0/0.15.0 shipped no funnel mark and the upstream 125-sales-funnel case was composition-only; 0.16.0 custom marks carry the affordances that ruling missed (`SceneArea{path,points}` morph, `states` + transitions, mark-level `ChartMotionDefinition`, geometry-affinity points), so R2 reopens D364 against the same case. `internal/funnel-mark.ts` (new): `buildFunnelStageRows` (norms → per-ring `SceneArea` rows, four corner points each; `funnelRingExtraScale` on the hovered stage is a geometry re-emit), `createFunnelStageMark` via `createMarkWithScaleValues` (scales `x/y: null`, per-stage `delay: datumIndex × staggerDelay`, `resolveEnterTransition` → package tween/spring), `funnelDimStates` (`when: { focus: 'unmatched' }`, opacity 0.4, 150 ms); same `funnel-{h,v}-pattern/grad-{i}` ids. `funnel-chart.tsx` builds `buildFunnelDefinition` (pie-shaped: `focusRing: false`, `guides: false`, `withStates`, `tooltip: false`) into `ChartHost` with `useFocusInjection`; label overlays stay HTML with pointer → `focusPoint` bridging; props, defaults, aria forwarding unchanged, `ariaLabel` default "Funnel chart". Deleted: `internal/funnel-hover-chrome.ts`, the funnel WAAPI keyframes and graphic/hover code in `funnel-segment.tsx` (labels only now), `computeFunnelRings`/`FunnelRingGeometry`/`funnelRingSpringParams` in `funnel-geometry.ts`, the funnel branch of `enter-transition.ts` (`FunnelEnterTransition` now lives in funnel-mark.ts, same shape). 6 files, +592/−723 (the new `funnel-mark.ts` is 272 lines; −403 net outside it). Records moved in the same commit: `qa/unit/probes.test.mjs` funnel `{roleImg: 1, tabStops: 1, ariaLabel: true}` (the package svg the other families took at V1.7); `qa/unit/ssr.test.mjs` funnel floor 6000 → 5800 (measured 5870: hand segment paths became one package svg). Skipped, routed: label enter-fade → V3.5 (motion owner); `url(#id)` scheme → V3.4 (hand ids). Executor `ses_f8c383244ffe8txsjclmGtDUuw`; `grep -c defineChart funnel-chart.tsx` = 2, `animate(\|requestAnimationFrame\|createElementNS` in funnel files = 0. Verified in isolation: first `run-qa` (funnel, funnelvertical at n=1000) passed but read 1166/1167 and 1613/1747 px against 99/0 at `qa/gate/latest`: a dark spike at the plot's x offset, because n=1000 with the default gap makes the per-stage segment length negative and legacy's negative-width `viewBox` paints nothing while the mark drew a degenerate ring. Follow-up in the same session: `funnel-mark.ts` returns no rings when `segLen <= 0 || crossLen <= 0` (labels and hover persist, like legacy). Re-run: funnel settled 3 px, funnelvertical 0, all hover cells 0; hover-lag probes on the item tree read the G17 set only (6 flags, no funnel row — not a probe chart). |
| D546 | **V1.4: optional layers register their state as a registry `contribution`; the entries merge contributions generically and import no layer module.** First executor pass moved the hook bodies into `area-layer-state.ts`/`line-layer-state.ts` and re-imported them (a rename: an `<AreaChart>` with no brush still ran the brush hook) and faked P-25 as a `<div data-aligned>` wrapper — rejected under principle 5. Landed design: `ChartChildRegistration.contribution?: ChartLayerContribution` (`chart-child-registry.ts`; `brush`, `markerGradients`, `profitLossHoveredIndex`), compared by identity in `update` and in the host bridge so memoized contributions never bump the version; `useChartChild(role, props, contribution?)`. `ChartHost` gets `chartData/chartXDataKey/chartXDomain` inputs it never reads itself and a `LayerContributions` dispatcher that mounts `BrushLayer` (`internal/brush-layer.ts`: `brushX` control, range state, track extent from the full data + projection tail) only when a brush child is composed and `MarkerLayer` (`internal/marker-layer.ts`: gradient defs and id lookup) only when a line has `showMarkers`; `ProfitLossLine` contributes the legend hover index from its own context. Entries read `layer:brush`/`layer:markers`/`profitLossLine` contributions with no-layer fallbacks (`use-line-layer-inputs.ts` for line; inline for area); `useLineYDomains` owns `visibleData`. Deleted: `use-area-brush.ts`, `use-line-brush-controls.ts`, `use-line-marker-gradients.ts`, the children scan in `profit-loss-config.ts`, and `area-marker-reveal.ts` (its hand WAAPI marker enter stagger duplicates package `motion.delay`/`stagger()` — `docs/reference/motion.md:120-142`, 0.16.0 — and goes to V3.5 as G20; the reveal wipe stays entry-side). P-25 ruling: legacy has no `data-aligned` DOM attribute; P-25 is the tick policy at `x-axis.tsx:586-621` (brush keeps data-snapped ticks, projection tail gets domain ticks), already implemented in `x-axis-tick-values.ts:205-230` — nothing to add. Counts: entry imports matching `brush|marker|pattern|projection|profit|reference|layer-state` = 0, layer hook calls in entries = 0, `data-aligned` = 0, orphans 0, reach-in failures [] (ledger row for `area-marker-reveal.ts` removed). Isolation QA run 1 caught a render loop the executor's checks could not (React #185 on the `markers` scene, `__benchPaintDone` never set): every registry bump re-ran `extractChildren`, the new `lines` array re-memoized `MarkerLayer`'s contribution, the identity change bumped the registry again. Lead fix in `chart-host.tsx`: `useStableList` keeps the previous `lines`/`brushes`/`projectionLines` array while its elements are identical (registry props keep identity across no-op updates), so a layer's own registration cannot re-trigger it; the same latent loop existed for a brush composed with projection lines. Verified in isolation: 13 charts / 65 cells, gateFail 0, ruled 2 (`markers` hover-30/70, D498), non-PASS 0 (run 2 on `iso-v14`, `qa-v14`); brush-hover-50 1231 → 3092 px is the pre-existing brush clip (G21); hover-lag/legend-hover-dim/no-rereveal probe run hit `ERR_CONNECTION_REFUSED` on the first scene after the QA run (harness port handoff, not a chart failure) and is re-queued after the G17 bisect; its flags land with the next docs commit |
| D547 | **V1.5: `xDomainSlotCount` drives the tooltip column width; the `cursorHost` half has no object.** Ruling: neither the legacy tree (`repos/bklit-ui/packages/ui/src/charts/`), the migrated tree nor its history has a `host` prop, so the `host` → `cursorHost` + `createChartCursor` half of `08` §4 V1.5 is void; the item is the slot-count wiring only. Legacy formula (`time-series-chart-shell.tsx:317-326`): `slotCount = xDomain && xDomainSlotCount != null ? xDomainSlotCount : visible.length; columnWidth = slotCount < 2 ? 0 : innerWidth / (slotCount - 1)`, and `chart-brush-layout.tsx:93` passes `xDomainSlotCount = data.length` under a brush selection so the indicator keeps full-dataset slots. Executor (`ses_f8b9db7d1ffexhiF7CJjaBklP9`): new `internal/column-width.ts` (16 lines, the formula verbatim), `area-chart.tsx` and `line-chart.tsx` compute `columnWidth` from the host-adopted plot width (`setup.innerWidth`/`innerWidth`, no DOM measure, no margin math), the `xDomain` prop (the brush layout already passes it, `brush-layout.tsx:30`) and `xDomainSlotCount`, and feed it to the definition tooltip params, which the indicator marks already read (`area-chart-marks.ts:157`, `line-series-marks.ts:183`); the inert comments and `_xDomainSlotCount` discards are gone. Not done, by design: the host context value (`chart-host.tsx:259,297`, `columnWidth: innerWidth`, `xDomainSlotCount: undefined`) is untouched because no area/line consumer reads context `columnWidth` and the host is not V1.5's file; composed keeps its own slot width in `series-bar-scene.ts:167`. Lead re-ran: `inert` in area/line = 0, `_xDomainSlotCount` = 0, tsc clean, tests 230/124/0/106, lint 4 on V1.5 files (12 total with V3.4a's in-progress pie edits in the tree). Bench `brush` scene at 1200×800: plot width 972, slot count 1000, columnWidth ≈ 0.973 px with or without a selection; the QA-visible effect is nil at n=1000 (the indicator stays the 1 px preset with no `indicatorSpan`), so "both observable in QA" reduces to the unchanged tooltip cells of the V3.4a run. |
| D548 | **V3.4 first half (non-cartesian): the R10 seam exists and every mount is id-scoped; two rulings.** Executor (`ses_` V3.4a, run `20260906-024318`): new `internal/resource-host.tsx` (`// R10 seam: remove when TanStack/charts I4/I5 ship`, a hidden 0×0 svg mounted by the host after the chart svg, renders the mount's `resources` inside one `<defs>`, null when empty); `chart-host.tsx` gains `idPrefix` (per-mount `useSanitizedId()` fallback, threaded to `Chart`/`TooltipRendererChart`) and `resources`; pie, gauge, candlestick, choropleth and funnel lose their hidden `<svg><defs>` islands (pie :289/:307, gauge :518/:1014, candlestick :369/:433, choropleth :741, funnel :298), consumer `RadialGradient`/pattern children go through `resources`, candlestick and funnel patterns take `${idPrefix}-…` ids, the candlestick crosshair fade and funnel stage gradients become `spec.gradients` (bbox 0→1 with the percent stops mapped to ratios; pixel-identical by construction since the mark bbox is the plot span), the gauge theme gradient is a bare id the renderer scopes; live-line only passes `idPrefix`. Lead re-ran: `<svg\|<defs\|<pattern\|<radialGradient` in the six owned files = the four visible drawing roots plus `live-line-overlay.tsx:398` (ruled below); `<pattern\|<radialGradient` elsewhere only in cartesian-half files and the shared `pattern.tsx` builder; 8 `ChartHost` mounts, 8 `idPrefix=`; SSR of two `Gauge`s gives `_R_3_-gauge-theme-active` vs `_R_4_-gauge-theme-active`; tsc clean, lint 4, tests 230/124/0/106, orphans 0, fixtures 0/0/0, bench builds. Ruling 1 (R10 amended, 0.16.0): the live-line edge fade is an SVG `<mask>` (`maskUnits="userSpaceOnUse"`, applied as CSS `mask-image` on the host wrapper) that fades line, fill and tip chrome together; a stroke gradient with opacity stops cannot reproduce it, so `<mask>` joins the seam's resident list next to pattern/radialGradient/sweep and moves into `resource-host.tsx` in the cartesian half (it owns `live-line-chart.tsx`); upstream ask filed with I4/I5 as the fade case. Ruling 2: consumer-supplied `RadialGradient`/pattern children keep hand ids, so two mounts with identical consumer ids still collide (pre-existing, document-wide `url(#id)`); the cartesian half makes the seam rewrite consumer ids with the mount prefix and exposes the scoped id to the definition. Deferred to the cartesian half: folding the pattern builders into the seam (shared), the live-line crosshair gradient (`live-line-overlay.tsx:222-235`, bbox reproduces it), G21 (the brush clip becomes spec `clip`). Verified in isolation (worktree at `b636390`, bench built, `run-qa` pie,gauge,gaugelinear,candlestick,candlelegend,choropleth,funnel,funnelvertical,liveline): 36/36 cells PASS/PASS, exit 0 |
| D549 | **V2.3 reduced to legend buttons; legend hover stays a definition input (0.16.0 ruling).** Executor (`ses_f8b8c661fffeiNkaJsgRCadMqp`) blocked twice: first on a cursor bridge that needed files outside its ownership (`use-area-chart-setup.ts`, `candlestick-chart-marks.ts`, `candlestick-chart-scenes.ts`), then on the finding that programmatic focus in 0.16.0 paints tooltip and chrome with no source gate (`paintTooltip` is called from `paintFocus`; `ChartFocusFilter` is `{match, retarget}` only; `ChartFocusSource = 'pointer'|'keyboard'|'programmatic'|'restored'` is reported, not filtered). Lead ruling: a bridge that drives `setControlledFocus` from legend hover would paint a tooltip the legacy never shows, so the cursor bridge is rejected; legend hover stays what it already is, an input to the definition rebuild (the package's own `interactiveColorLegend` idiom: app state → definition), which is TanStack-native as far as 0.16.0 allows. Evidence posted as a comment on upstream #127. The legacy has no legend click toggle, so no `keyedSelection` and no `aria-pressed`. What landed: `legend-item.tsx`, `chart-legend-default-row.tsx`, `chart-legend-custom-row.tsx` render `<button type="button">` instead of `div`, with `onFocus`/`onBlur` mirroring the hover setters (keyboard focus now dims/emphasises exactly like hover) and an inline reset of only the UA chrome the div never had (custom row also zeroes padding and inherits cursor). Lead re-ran: `<button` 1/1/1 in the three files; `aria-pressed` 0 outside a comment (`heatmap-legend.tsx:521`); tsc clean; lint 4; tests 230/124/0/106; fixtures 0/0/0. Verified in isolation (worktree at `4c05265`): `run-qa` legend, legendhover, candlelegend PASS on every cell; markers PASS except hover-30/70 ruled (D498) as in the baseline; profitloss FAIL on all four cells (settled 1.77% vs 0.0003% baseline): the button reset's inline `display: block; width: 100%` overrides the `flex` item className of the profit-loss legend template, so marker and label stack and the legend takes two rows. Routed as G22 (V2.3 defect, three legend files, fix = the reset never sets display/width). `legend-hover-dim` probe: flags on legendhover, candlelegend, markers, barsquares exactly as the baseline (I2, #127), profitloss clean |
| D550 | **Parity fixture ruling: `Eq` is mutual assignability, not structural identity; V3.7 backlog re-read 384 → 239 red exports; G17 bisected to V1.7; V1.4 probes re-run clean.** The V4.2 fixture's `Eq<A,B>` (`(<T>() => T extends A ? 1 : 2) extends …`) fails on `readonly` property modifiers, which TypeScript itself ignores for assignment, so 130 exports read red although every legacy call site compiles against them and their results are usable where the legacy ones were. The swap claim is assignability in both directions (10 §1: "same name and an assignable type"), so `qa/api-compat/generate.mjs` now emits `type Eq<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;` (D514 called the strict form an upper bound). Re-read: 239 red lines across 239 exports (56 missing, 183 mismatched); a lead-run two-way harness (`declare const l: Legacy.X; const m: Migrated.X = l;` and the reverse, `--noErrorTruncation`) gives the per-export cause for every row, which the V3.7 prompts carry: 109 fail both ways (prop-shape deltas: `enterTransition` narrower than framer `Transition` on every `*ChartProps`, `children` optional where legacy requires it, `readonly` arrays in public props, `displayName` missing or optional, `memo` wrappers missing, config carriers returning elements where legacy returns `null`, context values missing host fields), 74 fail one way. V3.7 is split into four disjoint parts: D (barrel, providers/hooks, animation/typography types; 17 rows; runs first because it owns the shared `Transition` type), B (cartesian, markers, tooltip, brush, loading; 105), C (geo/heatmap/sankey, polar, legend; 107), G (14 gradient/pattern components; folded into V3.4b). G17 bisect (hover-lag on candlestick, `dec759f` bad → `171e3c7` good → `5e63e93` bad → `0012eca` bad): first-bad `0012eca` (V1.7, host-owned sizing), last-good `171e3c7` (V1.6); the candlestick migrated dim/tooltip lag reads 783/302 ms from V1.7 on and 160/393 before. Routed to V3.5 (one animation owner: a focus state change must not wait on the motion renderer's enter transition, which is what the host's `RendererChart` mount added to candlestick). V1.4 probe re-run in isolation (`$S/probes-v14`, hover-lag + legend-hover-dim + no-rereveal, exit 0): hover-lag flags are exactly the G17/baseline set (bar settles, scatter dim-lag, candlestick tooltip/dim-lag + settles, pie/sankey/liveline dim-presence), legend-hover-dim flags are the baseline four (legendhover, candlelegend, markers, barsquares), no-rereveal 0 flagged rows; nothing V1.4-specific. |
| D551 | **V2.6: the package crosshair and tooltip own the hover chrome on every cartesian family; nine hand modules deleted (1,556 lines), no bridge kept.** `hover-geometry.ts` (201), `native-tooltip.tsx` (190), `date-pill-overlay.ts` (133), `date-pill.ts` (51), `date-ticker.ts` (288), `tooltip-date-ticker.tsx` (186), `spring.ts` (166), `scatter-pill-chrome.ts` (175), `scatter-pill-setup.ts` (166) are gone. What replaces them: one `crosshair({ marker: false, x, y: false })` builder in `internal/focus-marks.ts` (142 lines: `buildIndicatorMark` with the `band: true` form for bar and the `label: { format }` x label that carries the legacy pill text, `buildHoverDotMark`, `pointerSeriesDimStates`, `isFocusOutsideXDomain`, `buildCrosshairGradientDef`); the package `tooltip({ anchor, placement, portal, className: "bkm-native-tooltip", content })` written directly into each definition (`bar-chart-series-marks.ts`, `area-chart-definition.ts`, `use-line-chart-spec.ts`, `candlestick-chart-scales.ts`, `scatter-tooltip-extension.ts`, `live-line-chart.tsx`, `composed-chart.tsx`, `heatmap-definition.ts`; `portal` from `@tanstack/charts/tooltip/portal` where the legacy tooltip escaped the plot); `renderSeriesTooltipBody` and the legacy-exported `DateTicker` moved into `internal/tooltip-components.tsx`. The scatter and candlestick pill bridges the executor first kept "for the contract" (`PillBuild`, `updateCandlePill`, `PILL_OVERLAY_STYLE`, the empty overlay host divs, `overlayHostRef`, area's never-mounted `datePillOverlayHostRef`) were deleted on review (principle 2); what remains of the pill is the axis label fade, renamed to say so (`scatter-label-fade.ts`, `syncDateLabelFade`, `updateAreaLabelFade`). `showDatePill` stays as the consumer flag that gates the crosshair x label. Brush: the native `brushX` handles and selection are hidden through `handleStyle`/`selectionStyle` and the brush chrome keeps the legacy look (the V1.4 brush ruling in D546 stands); heatmap keeps its own axes and needs no portal (V3.3 owns the band there). Counts: 53 files +606/−2319; `pill` outside `showDatePill`/`pillRadius`/`pillClassName` = 3 (comments); `overlayHostRef|PILL_OVERLAY_STYLE|PillBuild` = 0; orphans 0; non-aria `setAttribute` = 8, all reveal/pulse code (V3.5), none in tooltip code; reach-in total 52 (55 before), failures 0; `pnpm api-compat` 239 red before and after (no export changed shape). For V3.6: `styles.css:317-351` (`.bkm-date-pill-layer`, `.bkm-date-pill`, `.dark … .bkm-date-pill`, `.bkm-date-pill-inner`, `.bkm-date-pill-inner span`) have no consumer left; `.bkm-sankey__link`/`.bkm-sankey__node` were already unused. Verified in isolation: Verified in isolation (`iso-v26` worktree, lead): `run-qa` 16 runs / 69 cells → gate FAIL 1, ruled 2 (markers hover-30/70 5165/5169, D498), everything else PASS; profitloss settled 3 (G22 fixed in this commit: the legend `<button>` reset no longer sets display/width); bar hover 3407 (pre-item 3979), liveline 3427. Area/line/bar/candlestick hover cells sit ~+500 px above their pre-item numbers because the pill is now the package crosshair label's glyph halo (14px/500 text over a strokeWidth-20 round-join stroke, `--chart-date-pill-*` vars, 62×30 px) where legacy drew a 77×32 rounded box: `resolveLabel` in 0.16.0 `dist/crosshair.js` knows fill/halo only, `strokeWidth` trades width for height, no value reproduces the box → ruling: the halo stays, no second pill implementation; upstream [#132](https://github.com/TanStack/charts/issues/132) (label background/padding). The one gate FAIL, scatter hover-70 5047, was not the pill: scatter was the only family whose tooltip body bypassed `renderSeriesTooltipBody` and left the box to the package shell chrome (no `bkm-native-tooltip` class) — 173×103 px vs legacy 151×90 since before the item (pre-item scatter hover 4190–4690). G23: `scatter-tooltip-body.tsx` → `.ts` now calls the shared renderer and `scatter-tooltip-extension.ts` passes the shell class like every other family; scatter hover 1531/1691/1692, box 153×90; scattermultiaxis 1528/1685/1722. Probes (`hover-lag`, `no-rereveal`, 18m25s): flags identical to the pre-item set (6: bar settles-after-700ms; scatter dim-lag; candlestick tooltip-lag/dim-lag/settles; pie, sankey, liveline dim-presence-mismatch), no-rereveal 0. Counts after the review fixes: tsc 0, lint 4, tests 230/124/0/106, orphans 0, reach-in 52/0, fixtures 0/0/0, api-compat 220. |
| D552 | **V3.7 part D (barrel, providers, hooks, animation types): 239 → 220 red exports; the parity harness now compiles both sides against one `motion`.** `Background` is the legacy-shaped renderer again (`internal/background.tsx`: dims and `isLoaded` from `useChartStable`, `null` returns, `displayName`; `width`/`height` props gone, `background-layer.tsx` stops forwarding them; the dead `ChartBackground` alias deleted); `Grid` keeps the legacy component type (verbatim `GridProps`, mutable arrays, returns an empty `<g>`) while the package keeps the paint (the child is scanned, never mounted, so nothing paints twice); `ChartRevealClipProps` and every `*EnterTransition` alias are the framer `Transition` (`enter-transition.ts` narrows `ease` at the use site only); `useChartInteraction` takes the legacy params and gates its no-op handlers on `canInteract` (the package still owns the pointer); `StaticChartPreviewProvider`/`useStaticChartPreview` (`internal/static-chart-preview.tsx`, legacy-verbatim) read by the host as a fixed-width mount (idiom 9); `fixtures/legacy-hooks.tsx` follows the signature. Harness ruling: `repos/bklit-ui` carries its own pnpm store with `motion@12.27.0` while showcase resolves `motion@12.43.0`, and `motion-dom`'s `GeneratorFactory.applyToOptions` differs between them, so every export carrying a `Transition` read red although the legacy and migrated types are the same symbol from the same package; a consumer app has one `motion`, so `qa/api-compat/tsconfig.json` now pins `motion`, `motion/react` and `motion-dom` to `bench/app/node_modules` for both sides (`--traceResolution`: 81 + 1 resolutions, all one copy) — 233 → 220 (13 rows: the 8 part-D `Transition` carriers plus 5 `enterTransition` props elsewhere). Still red in part D: `LoadingStyle` (one type line in `chart-phase.ts`, owned by part B; handed to B). Counts: tsc 0, lint 4 (none in owned files), `pnpm test` 230/124/0/106, orphans 0, fixtures 0/0/0, `pnpm api-compat` 220. |
| D553 | **V3.7 part B (cartesian, markers, tooltip, brush, projection, profit-loss, loading entries): 220 → 42 red exports with part C.** Every cartesian carrier (`area/bar/line/live/scatter/candlestick/series-bar/axis/depth/pulse/tooltip/markers/projection/profit-loss-*-child.ts`) is a legacy-shaped component again: `Object.assign` + `displayName`, legacy prop names, mutable arrays where legacy is mutable, `createElement("g")`/`null` returns (the chart still scans them; nothing mounts twice). Legacy names restored: `BarYAxis` (`internal/bar-y-axis-child.ts`), `useBarDepthEntries`, `MarkerGroup`, `SeriesMarkers`, `SeriesPointMarker` (`+Props`), `LoadingStyle` (`chart-phase.ts`), `BarLineCap`, `ChartTooltipProps`; `tooltip-components.tsx` accepts `MotionValue` on `left`/`top` and carries the five legacy `displayName`s; `area/bar-chart-loading` drop their non-legacy `displayName`s. Lead fixes: `chart-child-carrier.ts` `ProjectionLine(EndMarker)Props.data` mutable like legacy (the `Readonly*` aliases stay for readers); `children-extract.ts` `applyBarDepthRoles` recurses into `BarDepthProvider` children so the legacy composition (`Provider > Back, Bar, Front, Pulse`) scans; `demos/bardepth.tsx` uses that composition; `scatter-chart.tsx` `displayName` above the exports (`exports-last`). Types only, behaviour not wired (V3.7 follow-up G24): candlestick `xDomain`/`xDomainSlotCount`, brush `direction`/`selection`/`useWindowMoveEvents`, depth `Provider` context. Counts (B alone in an isolated worktree on `a20c7fd`): tsc 0, lint 4, `pnpm test` 230/124/0/106; combined with part C see D554. |
| D554 | **V3.7 part C (polar, geo, heatmap, sankey, legend) + lead rulings: 42 → 36 red exports; the seven left are library-owned internals, waived here.** Providers and hooks the legacy barrel exposes exist again with the legacy shape: `PieProvider`/`usePie`/`usePieHover` (`internal/pie-context.tsx`), `RadarProvider`/`useRadar`/`useRadarHover`/`useRadarStable` (`radar-context.tsx`), `useSunburstHover`/`useSunburstStable` (`sunburst-context.tsx`), `RingProvider`, `ChoroplethProvider`, `HeatmapProvider`; `choropleth-chart.tsx` gains `ChoroplethTooltipData` and `featurePaths`; `pie-chart.tsx` keeps the legacy 100 ms `isLoaded` timer; `radar-chart.tsx` wraps its body in `RadarProvider` with the legacy formulas; `sankey-chart.tsx` mirrors d3's node/link prop shape structurally (`SankeyPropNode`/`SankeyPropLink`, no `d3-sankey` import, V3.2 holds); `sunburst-chart.tsx` splits a `SunburstChartBody` fed by `useSunburstLegacyContextValue`; heatmap components are `memo` with legacy names; legend items are mutable (`LegendItemData[]`), `LegendProgress` returns `null`. Lead fixes: `parity/sunburst-geometry.ts` takes the legacy signatures (`SunburstNode.children` mutable, `sumValues`/`buildArcs`/`geometryFor` on the plain types, `transitionGeometry` positional with six params, `max-params` disabled on that one line) — five rows; `useSunburstBreadcrumbItems` is the legacy context-fed hook returning `{ items, zoomTo }` (`sunburst-breadcrumb-items.ts`; `buildSunburstBreadcrumbItems` stays for the tests) and `bench/app/src/scenarios/migrated-sunchrome.tsx` calls it like the bklit scenario — one row; `profit-loss-legend.tsx` spreads its tuple once at module level (`react-perf`). Rulings (principle 2, R-settled, no second implementation): `HeatmapContextValue`/`HeatmapProvider`/`useHeatmap` carry the legacy fields except `xScale`/`yScale`/`timeXScale`/`brushYScale`/`containerRef` — the package owns the heatmap scales and the mount (V3.3, V1.7), so the legacy scale closures are not re-exposed; `SankeyContextValue`/`SankeyProvider`/`useSankey` are not recreated: their value is the `d3-sankey` graph that V3.2 deleted (the package `sankeyDiagram` owns layout); `useChoroplethZoom` returns the package zoom instance typed on `HTMLElement` where legacy typed d3-zoom's `Element`. These 7 rows stay red in `pnpm api-compat` as the documented waiver list (contract `10` §1 amended by this entry); the other 29 belong to V3.4b (11 gradients, 3 patterns, 13 loading, 2 brush overlays). Counts (B + C on `a20c7fd`): `pnpm api-compat` 36, tsc 0, lint 3 (≤ 4 floor), `pnpm test` 230/124/0/106, orphans 0, reach-in 52 / 0 failures, fixtures 0/0/0, bench build ok. |
| D556 | **Waves 1–3 batch-end audit (audit agent `ses_f8ab2f6b7ffemM3eupzAQLkzJe`, HEAD `73cc44e`, committed tree via `git grep HEAD`): every `08` §6 count re-read; the reds are all owned by wave 4, V3.4b or V5, none is a silent gap.** Green: `defineChart` on all 16 families (funnel `funnel-chart.tsx:275`), `focusDisabled` 0 in code, stylesheet imported 16/16, `chartCssVars` exported, `createMark` 40 sites (gated), `hover-geometry`/`native-tooltip`/`date-pill` deleted. Red, with the vector that owns each: raw `<svg|<rect|<path|<circle|<g |<pattern|<radialGradient` outside the seam 115 (cartesian islands and loading modules → V3.4b, V3.9; chrome wrappers → V3.5/V3.8 census); `createPortal` 6 = tooltip 1 + brush chrome 4 (`brush-border/handle/selection-pattern/track-chrome.tsx`, V3.4b brush overlays) + 1; `setAttribute` 8 (`chart-reveal-clip.tsx:42-65` ×5 and `sankey-reveal-specs.ts:25` are reveal motion → V3.5; `bar-pulse-clip.ts:64`, `bar-pulse-sync.ts:171` → V3.9), so V2.4's tooltip count (0) still holds and the ≤4 target is a wave-4 number; `createElementNS` 3, all `bar-pulse-clip.ts:58,60,73` = G14 (V3.9); d3 imports outside R4: `d3-shape` 18, `d3-path` 2, `d3-selection` 2, `d3-array` 1 (V3.5/V3.8 census decides delete-or-ruling per module; `d3-shape` in `area-chart-loading.tsx:7` is V3.9); `styles.css` 10 `animation`, 3 `@keyframes`, pre-hide `:150,847,916`, transforms `:325,439,566,586,605,716` → V3.6; `renderer={` 19 with `useChartRenderer` regime at `bar-chart.tsx:287`, `line-chart.tsx:389` → V3.5; `svgAnimation: false` 8 literal in 6 files (the rest inherit through `chartMotionRenderer`, V3.5 makes the count read 15 or stamps it); `spatialIndex` only `sankey-chart.tsx:473` — V2.5's cartesian indexes go through the package `focus` option, the §6 grep is the wrong probe and V3.8 rewrites it (G25); `use-container-size` 4 files = the G16/D541 ruling (line/area/bar-loading read container height) + funnel (V3.1), V1.7's claim stands under D541; `initialWidth` on 12/16 entry files, the other four (area, heatmap, scatter, live-line) mount it in their internal view (`area-chart-layers.tsx:207`, `heatmap-components.tsx:215`, scatter view, live-line overlay) — count is by mount, not by entry file (G26 notes it for V3.8's probe); `idPrefix` on 5 entry files, not 15: V3.4a scoped the 8 mounts it owned, the cartesian families get theirs in V3.4b (G27); reach-in ledger 19 files pinned → V3.5/V3.8; `data-slot` 0 → V3.6; `role="img"` 0 and `tabIndex` at `sunburst-center-overlay.tsx:68` → V4.1 (G28); `package.json` still lists `d3-sankey`, `@base-ui/react`, `@number-flow/react`, `@use-gesture` → V5.3 (G4). Idiom proposal (Block 2, evidence per family): idiom 2 `withStates` ✓ 14/16 (gauge, live-line ✗), idiom 9 host width + aspect ✓ 14/16 (funnel `initialWidth={chartW}` without aspect, live-line entry ✗), idiom 10 `idPrefix` ✓ 5/16, idiom 6 funnel ✓; idioms 1, 3, 4, 5, 7, 8, 11, 12 ✗ everywhere (`decorative(` 0 hits, `radialText` 0 hits, legend buttons without `aria-pressed`, tooltip `content({index,point})` singular) — the table is filled at V3.8 from this baseline, not now. Not determinable by a read-only audit and re-run by the lead on the same HEAD: `tsc` 0, lint 3 (floor 4), `pnpm test` 230/124/0/106, orphans 0, reach-in total 52 failures [], fixtures 3/3 exit 0, api-compat 36 (D554), full-roster isolated QA 43/43 charts, 191 cells, 4 FAIL all ruled cells (markers/100 hover-30/70 D498, radar/6 hover-50 D535, sankey/33 hover-30 D498), 0 unruled. Waves 1–3 ticked; wave 3 stays open only for V3.4b. |
| D555 | **V4.6 follow-up (V3.7 test backlog): the 87 named todos are legacy-internal helpers, not barrel exports; ruling and port.** `grep -o "Legacy\.[A-Za-z_]*" qa/api-compat/all.ts` against the 47 names the todos wait on: 1 is a barrel export (`getSkeletonHeights`, V3.4b), 46 are helpers the legacy barrel never exported, so `10` §1 does not cover them and the "V3.7 backlog" label on the V4.6 row was wrong. Ruling: a legacy test of an internal helper is ported when the migrated tree keeps a helper of the same name (29 do: heatmap-lifecycle 5, heatmap-utils 13, bar-depth-geometry 2, series-bar-layout 2, decimate 2, y-domain 1, formatters 4, parity/sunburst-geometry 1, reference-area-scale 1), loaded through a test-only `legacyInternal(relPath)` in `qa/unit/lib/legacy.mjs` (esbuild of the one module, never a barrel export); the 17 whose helper was replaced (`ancestorGrowOffset`, `applyHoverGrow`, `computeSegmentBounds`, `computeSeriesPathPoints`, `decimateOhlcData`, `getHeatmapColumnXOffset`, `getHeatmapMonthLabelColumnIndex`, `getHeatmapSeparatorLineY`, `heatmapLoadingCellParticipates`, `interpolateSeriesPathPoints`, `isHeatmapInactiveEffectEnabled`, `maxHoverSegmentThickness`, `resolveHeatmapInactiveStyle`, `resolveHeatmapSeparatorConfig`, `resolveReferenceDataRange`, `seriesPathTransitionSignature`, `visibleHoverPathLength`) stay `test.todo` stamped `internal helper replaced (D555)`; a ported case that fails is stamped `fails: <expected vs actual>` and is a finding, never loosened. Result: executor `ses_f8ab4c58effe6fQDpRp3mDf1Ag`, 18 files (17 tests + `lib/legacy.mjs`, +652/−168 with docs): 51 bodies ported verbatim, 46 pass; `pnpm test` 230/124/0/106 → 240/180/0/60, `test.todo(` 87 → 41 = 5 `— V3.4b` (`getSkeletonHeights`) + 31 `— internal helper replaced (D555)` + 5 `— fails:`; the 5 fails are heatmap findings, not test defects: `resolveHeatmapDisplayRange` returns `{start: undefined, end: undefined}` where legacy infers Date bounds for year/six-month grids and `null` bounds for custom grids (×3, G29), `findHeatmapColumnIndexForDate` Oct 1 2025 → column 0 vs legacy test's 1 (the legacy implementation agrees with 0, the legacy test is stale, ACCEPT), quarter-separator lead-week case is date-sensitive (range start Mar 1 2026 falls on a Sunday; re-run after the date, ACCEPT). `qa/unit/.tmp` is gitignored. |
| D557 | **V3.4b-i (parity half of the seam item): 29 red exports landed by legacy name, 36 → 9; `PatternArea`/`PatternAreaProps` waived; the seam half is split off as V3.4b-ii.** Executor `ses_f8ab583feffeZchtXqfxe4EhNj` spent its 45-minute wall on the parity table and none of the island work, so the item is split at the commit boundary rather than half-landed. New: `internal/gradient-entries.tsx` (`LinearGradient`, `RadialGradient`, 9 `@visx/gradient` presets as bare `<linearGradient>`/`<radialGradient>` elements with visx prop types, mounted only through the seam's `resources` or a consumer `<defs>` — never a hidden svg island of their own), `internal/loading-entries.tsx` (`LineLoadingSweep`, `BarLoadingSkeleton`, `LineLoadingPulseStroke`, `ChartLoadingLabel`, legacy prop shapes), `internal/skeleton-data.ts` (`generateChartSkeletonData`, `getSkeletonHeights`), `internal/brush-overlays.tsx` (`ChartBrushSelectionOverlay`, `ChartBrushTrackOverlay`, legacy portal composition), `line-chart-loading.tsx` (`LineChartLoading` on `LineChart`+`Grid`+`Line`, `loadingStyle="sweep"` accepted and inert until V3.9); `resource-host.tsx` gains `scopedResourceId(idPrefix, id)` (D548 ruling 2, wiring is V3.4b-ii); `PatternLines.orientation` becomes a mutable array (the one real type gap in that row). Ruling: `PatternArea` keeps `fill` optional because the migrated component adds `patternPreset` (bench `migrated-patternarea.tsx`, the `__qaSetPatternPreset` hook and the showcase demo build on it); a wider prop type compiles every legacy caller unchanged, only the L→M fixture direction reads red, so the two rows are stamped exceptions (with D554's seven: 9 red = 9 waived, api-compat done reads 9, §6 "exceptions ≤ 3" counts these 2, the 7 are library-owned internals). The loading entries are hand SVG with `requestAnimationFrame` sweeps (`<pattern>`, `<linearGradient>`, `<defs>` inside the chart svg, 561 lines): that is V3.9's deletion list ("skeleton as a chart"), recorded here so it is not a silent second implementation; the two brush-overlay portals join the four brush-chrome portals in the V3.8 `createPortal` census. Counts: api-compat 9, tsc 0, lint 3 (floor 4), `pnpm test` 240/180/0/60, orphans 0, reach-in 52 failures [], fixtures 3/3, bench build ok. No rendering path of an existing chart changed (additive exports, one type widening), so QA is deferred to V3.4b-ii's sweep. |
| D558 | **V3.4b-ii (seam half, two parallel executors + lead fold): every hidden `<svg><defs>` island is gone, hidden-svg style constants 0, every `ChartHost` mount passes `idPrefix` (19/19), consumer resource ids are scoped per mount, G21 clip and D548 ruling 1 landed.** Cartesian executor `ses_f8a85f963ffexmkdNN9oD2fISA`: islands in `use-line-overlays.tsx` (4), `area-chart-layers.tsx` (3), `bar-chart.tsx`, `scatter-chart-view.tsx`, `line-chart-support.tsx` deleted with `HIDDEN_DEFS_SVG_STYLE`/`HIDDEN_DEF_SVG_STYLE`/`BAR_HIDDEN_DEFS_STYLE`; crosshair fades in area/line/scatter/composed definitions are `spec.gradients` (bbox 0→1, `fade-mask.ts` `toSpecCrosshairGradient`); marker radials, area patterns, profit-loss (0→innerWidth), bar-squares slice (0→100 user space) and scatter y-gradients (chart height, shared) are seam `resources` because their span is not the mark bbox; projection gradients ride the visible marker overlay svg (`terminal-marker.tsx` `projectionDefs`); brush x-domain clip is spec `clip` on the marks group, `rendererClipStyle` and the wrapper divs in area/line deleted (G21 closed); `segment-visuals.tsx` ids from `idPrefix` fixed a real cross-mount `bkm-seg-*` collision; `tooltip-components.tsx` default gradient id is per mount. Non-cartesian executor `ses_f8a85e3a0ffeNS5JeA2yhjIoGl`: `resource-host.tsx` gains `scopeResourceIds` (clones a resources tree rewriting `id`/`href`) and `scopePaintUrl`; `pattern.tsx` nested `<defs>` quirk deleted (bare `<pattern>`); pie/gauge/choropleth/funnel scope consumer `<RadialGradient>`/`<PatternLines>` ids (pie `displayNameOfType` falls back to `type.name`: without it consumer gradients were silently dropped); heatmap cell patterns are `resources`, the hover-only svg deleted; live-line fade gradients and `<mask>` are seam resources (D548 ruling 1), its crosshair a spec gradient; loading defs in `bar-loading-sweep`, `line-loading-pulse`, `loading-entries` render through `ResourceHost`; `idPrefix` added on radar ×2, sankey, ring, sunburst, heatmap. Lead: `composed-gradient-nodes.tsx` (the last island, caller `composed-overlay-chrome.tsx`) deleted, its projection gradients ride `ProjectionMarkerOverlay` like line/area, dead `ComposedCrosshairDef` deleted; the executor's `bar-pulse-clip.ts` rewrite of `createElementNS` into `insertAdjacentHTML` was reverted (a count made to read 0 without the clip becoming a resource; G14 stays open for V3.9, `createElementNS` = 3). SSR proof (executor scratchpad script, reproduced by the lead at 48bed3a: `renderToStaticMarkup` of two pies sharing `<RadialGradient id="x">`): def ids `_R_1_-x`/`_R_2_-x`, every `url(#…)` resolves, no bare `x`. Remaining `<defs>` outside the seam are all inside visible overlay svgs, not hidden islands: `background.tsx:147,223`, `segment-visuals.tsx:86`, `reference-area-figure.tsx:143,206`, `tooltip-components.tsx:239`, `tooltip-indicator-faded-rect.tsx:26`, `terminal-marker.tsx:81`, `brush-overlays.tsx:105`, `dash-tail.ts:64` (created clip), `heatmap-separator.tsx:89` (plot-span gradient inside the separator svg), `heatmap-legend.tsx:360` (standalone legend swatch) — the V3.8 census rules each (overlay chrome that is not inside the chart svg) or routes it; pre-existing and unchanged: the heatmap legend swatch fills `url(#id)` while only `#id-base` exists (G30). Counts: tsc 0, lint 3 (floor 4), `pnpm test` 240/180/0/60, orphans 0, reach-in 52 failures [], fixtures 3/3, api-compat 9 (= 9 waived), bench build ok, `HIDDEN_*_SVG_STYLE` 0, `idPrefix=` mounts 19/19, `createElementNS` 3 (G14). 54 files, +754/−798 before the lead fold. QA: full roster in an isolated worktree, recorded in the V3.4 row. |
| D559 | **V3.4b-ii follow-up (lead, `b350286`): masks in the seam host declare their region.** Isolated full-roster QA at `48bed3a` read 5 unruled FAIL cells (barloading settled/hover-70, liveline hover-30/50/70): the migrated bar loading skeleton and the whole live-line scene rendered blank. Every `url(#id)` resolved (DOM probe); the cause is geometric: a `maskUnits="userSpaceOnUse"` mask without `x/y/width/height` takes the default region −10%/120% of its nearest svg viewport, and the ResourceHost viewport is 0×0, so the region is empty and Chrome masks everything. Headless probe (playwright chromium): gradients, patterns, clipPaths and objectBoundingBox masks paint from a 0×0 host; userSpaceOnUse masks paint only with an explicit region (top-level or nested host alike). Ruling: every `<mask>` that rides the seam carries `x=0 y=0 width height` of the space it masks (bar/line loading sweeps: plot size; live-line fade: container size); rule stated in `resource-host.tsx`. Re-run on barloading/liveline/arealoading/heatmap/markers: barloading 0 px on 3 cells, liveline 1726/3378/3512/3643 px (all PASS, prior clean run 1440/3135/3381/3005), heatmap and markers unchanged. Full-roster board for V3.4 therefore reads: 43/43 runs, 190 cells, 5 ruled FAIL (markers ×2, radar, sankey, barloading hover-30 D498/D535), 0 unruled after the fix. |
| D560 | **§7.5 upstream re-check (audit `ses_f8a569087ffePJPYuve4Vyhuzh`, lead-verified with `gh issue view` and `npm view`, 2026-09-06): #126–#132 all OPEN, no linked merged PR; `@tanstack/charts` latest on npm = 0.16.0 = the pin, remote HEAD `258ed39` = local v0.16.0, no tag after v0.16.0; changelog delta empty.** Interim code that links an issue therefore all stays: I1 `internal/with-states.ts` (+ pie/choropleth/sunburst/heatmap wrappers), I2 definition-rebuild legend hover (D549), I4/I5 the R10 seam `internal/resource-host.tsx` (+ live-line/loading callers), I6 `showcase/migrated/package.json` peer `^19`, F-260 halo instead of dashed guides, #132 halo label (`internal/focus-marks.ts`). I3 stays unfiled until V3.5 removes the point gate; I7 (height-aware resize, D541) stays unfiled. Zero removable seams. Re-run the seven `gh issue view` calls at the 7.5 gate; the verdict changes only if a release after 0.16.0 appears. |
| D561 | **V3.5 merged (`5dafad4`): one animation owner — every mount renders through `motion()`.** A single `motion({ initial: "always", respectReducedMotion: true })` factory in `internal/motion-renderer.ts`; the cardinality gate, `chartRendererFor`/`useChartRenderer` and the static fallback are deleted. All 16 families (20 mounts) route to that instance and `svgAnimation` is `false` on every definition. Deleted: `deferred-reveal.ts`, `enter-transition.ts`, `line-marker-reveal.ts` (G20), `animated-y-tween.ts`, `use-animated-y-domains.ts`, the hover-motion `createOffsetArc` + bezier solver (G11), the `.ts-chart__marks--revealing` rule and the `ts-bkm-shimmer` / `ts-bkm-loading-exit` keyframes. Legacy `enterTransition` types and the spring/tween resolution moved to `internal/parity/animation.ts`; the hand WAAPI reveal writers (clip wipe, composed bars, scatter dots, ring track, choropleth features, sunburst labels, sankey draw-on) are neutralised so the renderer owns every entrance while phase deadlines keep legacy timing. Lead-verified counts: 20 mounts all resolving to `chartMotionRenderer`, one `motion(` call, `svgAnimation` non-false 0, deleted-module refs 0, tsc 0, lint 3, tests 240/180/0/60, orphans 0, reach-in [], fixtures 0/0/0, api-compat 9 waived, bench build ok. | V3.5 commit body. |
| D562 | **Rule-4 rulings where the package has no expression for hand sequencing (V3.5).** (a) The sunburst label-after-arc delay is dropped, labels enter with the arcs; (b) the sankey dash draw-on and node/link stagger are dropped, nodes and links enter with the renderer; (c) the ring track scale-expand is dropped, arcs keep the per-ring package delay; (d) per-mark `stagger()` on line/area/composed dots stays at chart-level motion functions (`markerEnterDelay`), no per-builder stagger; (e) G17 candlestick dim-lag is ungated at entry, the revealed-flip diff stays in `candlestick-chart-chrome.ts`. Settled pixels are unchanged; only entrance frames move, and they are now renderer-owned. | V3.5 commit body. |
| D563 | **V3.5 handover to V3.6/V3.9/7.4.** Hover CSS transitions now carried by `states` were V3.6's to delete (candle, sunburst, pie, choropleth, radar ×2, line, composed bar). Kept with reason: area fill-opacity, sankey (no states, D528), `.bkm-dash-tail`, `.bkm-marker-base` (filter, D528b), axis text (G19). The loading-label shimmer restore belongs to the V3.9 pulse. The neutralised reveal shells (reveal-wipe, chart-reveal-clip, composed-reveal, scatter-reveal, ring expand, sunburst-label-reveal, sankey-animation) are 7.4 deletion candidates. `use-prefers-reduced-motion` stays for non-scene chrome only. | V3.5 commit body. |
| D564 | **V3.6 merged (`7b31a15`): the stylesheet stops owning scene timing — `styles.css` 1057 → 769 lines, still one file.** Every scene `transition:` whose timing now rides `states[].transition` is gone (candle, sunburst, area fill-opacity, pie, choropleth, radar labels/area/dot, line, composed bar-y, profit-loss, candle-cell, sankey node/flow/labels, axis text), together with the `transform-origin`/`transform-box` rules left over from the deleted WAAPI reveals, the pre-hide `opacity: 0` rules and the whole reduced-motion block (every selector in it targeted a V3.5-deleted animation; the host enforces reduced motion). Orphans deleted: `.bkm-date-pill*`, `.bkm-sankey__link`, `.bkm-sankey__node` and four heatmap rules the package has owned since V3.3. `data-slot` on 21 host roots and 13 part roots; six CSS-var maps derive from `chartCssVars` instead of repeating literals, resolved colours unchanged. Lead-verified counts: `animation:` 1, `@keyframes` 1, literal `opacity: 0` 0, `transition:` 3, `transform-origin`/`transform-box` 0, `data-slot="chart"` 21 + 13 parts, tsc 0, lint 3, tests 240/180/0/60, orphans 0, reach-in [], fixtures 0/0/0, api-compat 9 waived, bench build ok. | V3.6 commit body. |
| D565 | **Lead correction to the V3.6 sweep: `.bkm-dash-tail` is restored.** The executor claimed every deleted transition had a `states` carrier; that is false for the dash tail. `DashTailOverlay` is an app-owned React overlay outside the chart scene (`internal/dash-tail.ts` rendered through `use-line-overlays.tsx`), so no mark state and no renderer motion can carry its 0.4s dim and the class is its only home. `.chart-candle-cell` stays deleted (`CANDLE_DIM_TRANSITION` in `candlestick-chart-marks.ts:90` carries it) and `.chart-profit-loss-segment` stays deleted (a scene node whose opacity change is renderer-owned under V3.5); the stale comment in `profit-loss-line-mark.ts` that pointed at the stylesheet is corrected. | V3.6 commit body. |
| D566 | **V3.6 rulings on the executor's three blocked items.** (a) `.ts-bkm-loading-root` is the one sanctioned orphan selector, authored in V3.6 and consumed by V3.9 — adding the class in V3.6 would start the pulse and move settled pixels; (b) `CenterStat` and `BrushChrome` return fragments, so their `data-slot` stays on the containers they render into, no structural change; (c) `heatmapCssVars` is kept because `index.ts` is append-only and api-compat would break. | V3.6 commit body. |
| D567 | **V3.5 follow-up merged (`029cbd8`): the cardinality regime and the y-domain tween gate are restored, and the reason is measured, not inherited.** Full-roster QA at `5dafad4` read 20 unruled hover FAILs plus a barsquares no-report: dims that land in 71–99 ms through the package static renderer take 700–2700 ms through `motion()`, past the harness 700 ms hover wait, and barsquares settled in 19.2 s against 1.88 s. Profiles and precise coverage against the bench preview attribute it: each pointer move runs `applyStateFocus` → `animateSvg` over the whole scene, four times per hover, and per element the package resolves a timing context that runs a full-SVG `querySelectorAll`, so the work is quadratic in element count — bardepth resolves 8,544 timing contexts over 2,073 elements, about 17.7M node visits and ~1.2 s of long tasks. `NATIVE_MOTION_MAX_POINTS = 200` therefore returns to `internal/design-tokens.ts` with `chartRendererFor`/`useChartRenderer` in `internal/motion-renderer.ts` and six mounts, and the y-domain tween gate returns to line/area/composed. `svgAnimation` stays `false` everywhere and there is still no second renderer implementation: the regime selects between two package renderers. Counts: tsc 0, lint 3, tests 240/180/0/60, orphans 0, reach-in [], fixtures 0/0/0, api-compat 9 waived, `motion(` call sites 2, `svgAnimation` non-false 0, bench build ok. | This session; V3.5 follow-up commit body. |
| D568 | **I3 stays unfiled: the original claim does not reproduce on a package-only control, and the negative result is recorded instead of the issue.** `07-upstream-issues.md` allows filing I3 (motion renderer per-element scan, D472) only after V2.5 + V3.5 and only with a repro built on a `tanstack/*` control scenario. Two were built and neither separates the renderers. Keyed `barY` at n=4000 (20,039 SVG elements, focus `states` with a 400 ms dim): hover long tasks 320 ms under `motion()` against 318 ms under the static renderer; updates 231 ms against 223 ms. A `createMark` custom mark emitting one keyed node per datum, with keys deliberately changed every update to force enter/exit, is flat at every cardinality tried. The measured cost in D567 appears only on our own scene shapes, and its trigger — a whole-scene `animateSvg` per pointer move — is reached through package-internal `paintFocus`, which no migrated module calls. Ruling: do not file, keep the measurement, and treat "four whole-scene reconciles per pointer move" as a migrated-side reduction candidate routed to its vector before any further code. | `07` I3; D472; this session's profiles. |
| D569 | **V3.9 merged: the loading placeholders are charts, not hand SVG — `defineChart` definitions with the sweep as R10 paint; G14 closed.** Executor `ses_f89f39404ffe5vwd4pROUkd1Cb` plus a lead fold. New `internal/loading-definitions.ts` builds bar, line, area and heatmap placeholders on `defineChart` with `focus:false`, `focusRing:false`, `guides:false`, `pointer:false`, `tooltip:false`, `svgAnimation:false`, geometry from the legacy skeleton numbers; the shimmer rides `fill="url(#…)"` through the R10 seam instead of a hand `<pattern>` island. Deleted from the loading modules: every hand `<rect>`/`<path>`/`<circle>`, every `requestAnimationFrame` sweep and every `.animate()` call; `internal/bar-pulse-clip.ts` is pure gradient-stop data, so tree-wide `createElementNS` reads 0 and **G14 closes** (D536, D558 kept it open when the executor's `insertAdjacentHTML` rewrite was reverted). Net −738 lines before the fold. Sweep silhouette: **accept** per `08` §7 — the placeholder wash is a spec gradient on the area mark rather than a per-bar silhouette clip, because the seam cannot colour gradient stops per mark and a second clip implementation is what principle 2 forbids. No CSS change was needed from V3.6; `.ts-bkm-loading-root` (D566) is now consumed. Four lead corrections, each a principle violation in the executor's output, not a taste call: (1) `qa/api-compat/report.md` was generated mid-work and read 12 red with three new loading mismatches — regenerating it reads 9, the floor, and the file is unchanged from HEAD; (2) an append-only `// V3.9` block added 15 migrated-only barrel exports with no consumer outside the package, growing the V1.6 un-export backlog — removed, barrel back to 295 value / 214 type; (3) `internal/bar-pulse-sync.ts` was left as a signature-kept no-op with five live call sites — the module, its re-export in `bar-pulse-mark.ts` and all five calls are deleted, `syncBarPulseIfRevealed` inlined as its own condition, and the parameters that fell dead with it (`svgRoot` in `armBarRevealDeadline`/`beginBarReveal`/`handleBarSvgRender` params, `phaseRef` in `BarSvgRenderParams`) removed down the call chain into `bar-chart.tsx`; (4) `internal/generate-chart-skeleton-data.ts` was a byte-for-byte copy of the V3.4b `internal/skeleton-data.ts` (identical apart from comments and line wrapping) — deleted, its four importers repointed, so the skeleton helpers stay owned once and the barrel keeps exporting them from one module. Lead-verified counts: tsc 0, lint 3 (floor), tests 240/180/0/60, orphans 0, reach-in [], fixtures 3/3 exit 0, api-compat 9 (all waived), `createElementNS` 0, hand SVG and rAF/WAAPI in the loading modules 0, bench build ok. Reach-in ledger still lists the now-zero-site `bar-pulse-sync.ts` and `line-loading-pulse.tsx`: both go on the 7.4 removal list, not here. | V3.9 commit body; `08` §7. |
| D570 | **V3.9 QA found a parity regression the item itself introduced, and the shimmer band gets a stamped home: seam CSS, not rAF.** Isolated full-roster QA at `1c2d276` read 43/43 runs, 190 cells, 5 unruled FAIL, all on the loading pair: barloading/100 settled 0 → 88,398 px (9.21%), hover-50 0 → 77,171 (D498 bound 53,588), hover-70 8,034 → 97,982 (bound 33,734); arealoading/1000 settled 231 → 15,449, hover-70 308 → 24,768. Cause, from the screenshots and the module's own comment (`internal/bar-loading-sweep.tsx:2` "the traveling band is deleted"): bklit masks the skeleton bars with a shimmer band travelling over `DEFAULT_SWEEP_DURATION_S`, re-rolling `getSkeletonHeights`/`getSkeletonSigns` on each completed pass; V3.9 replaced it with a static gradient fill plus the `.ts-bkm-loading-root` opacity pulse. The loading scenarios are captured in the ready state, not under `prefers-reduced-motion`, so both impls sweep live and the pixels only agree when the migrated band travels the same path on the same clock — which is why these cells read 0 before the item. Geometry is not the problem: first-bar x and bar width match bklit exactly, so `internal/loading-definitions.ts` stands. Ruling: **the shimmer band is loading chrome, not scene motion, so its animation rides a `@keyframes` rule on the seam-hosted mask or gradient — the sanction `.ts-bkm-loading-root` already carries under D566 — never `requestAnimationFrame`, never `.animate()`, never a second renderer.** The seam node declares its region per D559, and the per-pass re-roll listens to `animationiteration` on that node, which is a DOM event, not a timing loop. This keeps V3.9's win (the placeholders stay `defineChart` definitions, `createElementNS` 0, no hand SVG writers) without paying for it in swap parity, per principle 1. Follow-up dispatched; the V3.9 row stays open until the five cells read their pre-item values. | This session; QA run `qa-v39`. |
| D571 | **V3.8 census (executor `ses_f89c55f82ffeokQv7D4LPfMM1J`, measured at `6b2d014` with `git grep HEAD`, lead re-run independently): the §6 scoreboard is stamped, the reach-in ledger drops from 19 files to 12, and the `<defs>` question is closed.** Evidence in `research/phase-7/12-census.md`. PASS: `createElementNS` 0, `setAttribute` 3 (target ≤ 4), `svgAnimation` non-false 0 of 23 literals across 16/16 families, `focusDisabled` 0, `styles.css` `animation:` 1 / `@keyframes` 1 / literal `opacity: 0` 0 / transform rules 0, `idPrefix` on every mount, d3-path and d3-sankey imports 0. Stamped rather than failed: `renderer={` reads 28 sites = 20 mounts against §6's "15, all `motion(`" — the number is 20 because mounts, not families, are the unit, and six ride the D567 cardinality regime, so §6's 15 is superseded; `initialWidth=` reads 28 sites and §6's 15 means mounts, which **closes G26**; `use-container-size` 3 files is the G16/D541 height ruling plus funnel. Still red with an owner: raw `<svg|<rect|…` 89 line-hits over 36 files, every one classified in census §1 as overlay svg, seam input builder or legend chrome, with the in-chart remainder being the ring hand paths and the neutralised reveal shell (G31, 7.4); `createPortal` 13 sites = 1 tooltip + 5 brush overlay portals; d3-shape 21 files, d3-selection 2 lines in `choropleth-zoom.ts` riding the admitted d3-zoom, d3-array 1 (`bisector` in `live-line-chart.tsx:15`) — each needs a delete or a ruling from its vector, not from the census; `spatialIndex` 1 keeps **G25 open** because the probe itself is wrong (D544: cartesian indexes go through the package `focus` option), and rewriting it needs `qa/` which V3.8 does not own; **G30 stays open and still reproduces** (`heatmap-legend.tsx:363` fills `url(#id)` while `:348` defines `#id-base`, visible whenever a pattern level renders). `createMark` gate: 43 line-hits over 19 files (the 19th is V3.9's `loading-definitions.ts`), each row in census §3 naming the package gap — strongest are no candle/OHLC mark in dist, no funnel primitive, and the F-259 pattern channel. Ledger: seven zero-site entries removed (`bar-pulse-sync`, `choropleth-reveal`, `composed-reveal`, `deferred-reveal`, `line-loading-pulse`, `line-marker-reveal`, `sankey-animation`) and three pins lowered (`radar-chart.tsx` 18 → 3, `ring-chart-model.ts` 4 → 2, `ring-chart.tsx` 2 → 1); guard total 67 → 21, failures [], notes []. **`<defs>` ruling, stamped: every remaining `<defs>` outside the R10 seam is app-owned overlay chrome and stays** — `background.tsx:147,223`, `brush-overlays.tsx:105`, `brush-selection-pattern-chrome.tsx:42`, `reference-area-figure.tsx:143,206`, `segment-visuals.tsx:86`, `terminal-marker.tsx:81`, `tooltip-components.tsx:239`, `tooltip-indicator-faded-rect.tsx:26`; none sits inside a chart `<svg>` and none references a definition's `url(#id)`, so moving them into the seam would buy nothing and cost a hop. Idiom checklist filled in PROGRESS (it landed a commit early, inside `665291e`): idioms 3 (`decorative(`) and 4 (`radialText`) are blank tree-wide with 0 hits although the package exports both, 8 is blank because legend buttons exist without `aria-pressed` and legacy has no toggle to mirror (D549), 11 is blank because families take the host `renderTooltipBody` escape instead of `content(points)`, and 7 is `n/a` everywhere because no family ships a sparkline mode. Lead re-ran the counts: guard 21/[]/[], `createElementNS` 0, `setAttribute` 3, `createPortal` 13, `createMark` 43 over 19 files, `initialWidth=` 28, `spatialIndex` 1. | `research/phase-7/12-census.md`; D556. |
| D572 | **V3.9 follow-up merged (`d724449`): the shimmer band is back, as seam CSS, and the roster board is clean.** `internal/resource-host.tsx` gains `LoadingSweepMask` and `LoadingSweepResources` — the eased white stops, tile width 3 and `rotate(25)` of bklit `loading-sweep.tsx`, `maskUnits="userSpaceOnUse"` with the plot region declared per D559 — and `@keyframes ts-bkm-loading-sweep` in `styles.css` travels the band from −1 to 2 over 2 s linear, with the per-pass re-roll of `getSkeletonHeights`/`getSkeletonSigns` listening to `animationiteration` on that node. The static-fill replacement (`LoadingSweepGradient`, `loadingSweepPaint`) is deleted and the root pulse is dropped from every module, because bklit never pulses the root: bar sweeps the mask, area and line sweep or travel a pulse-clip, heatmap shimmers per cell. Bklit constants matched with file:line in the executor report (duration :35, travel :37-38, tilt :40, tile :153, bar fraction :52, radius :44, fill :46, fill-opacity :47, tick-seeded heights :67-85). V3.9's win survives intact: the placeholders stay `defineChart` definitions and `createElementNS`, `requestAnimationFrame` and `.animate(` all read 0 in the loading modules. Isolated full-roster QA at `d724449`: **43/43 runs, 190 cells, gateFail 0, 2 ruled FAIL (radar/6 hover-50 6,458 D535; sankey/33 hover-30 10,053 D498), 0 unruled** — the cleanest board of the phase; barloading reads 0 px on settled, hover-30 and hover-70 and passes hover-50 outright, arealoading passes every cell. Counts: tsc 0, lint 3, tests 240/180/0/60, orphans 0, reach-in [], fixtures 3/3, api-compat 9 waived. Two deferrals the executor named and the lead accepts: the pulse-versus-sweep split for the area and line turnkey defaults is unnecessary while every arealoading cell passes, and heatmap per-cell shimmer parity belongs to the heatmap vector, not here. | V3.9 follow-up commit body; QA run `qa-v39c`. |
| D573 | **Wave-4 batch-end audit (audit `ses_f89a73947ffeNSIgRgQYL3JRU4`, committed tree `d724449`, lead re-verified): wave 4 ticks, with three corrections and no new vector.** Every wave-4 done-when still reads on HEAD. V3.1 funnel: `defineChart` 2, WAAPI and `createElementNS` 0. V3.5 as amended: `NATIVE_MOTION_MAX_POINTS` defined once at `internal/design-tokens.ts:22`, exactly six mounts consult `useChartRenderer` (bar `:286`, candlestick `:370`, composed `:384`, scatter `scatter-selection-setup.ts:105`, area `use-area-layer-props.ts:42`, line `:389`), `svgAnimation` non-false 0 of 23 literals, and `qa/gate/summarize.mjs:14` still describes the regime that exists. V3.9 as amended: the sweep is a seam `<mask>` with `maskUnits="userSpaceOnUse"` and an explicit region (`resource-host.tsx:137`), its travel is `@keyframes ts-bkm-loading-sweep` (`styles.css:705`), the re-roll is `onAnimationIteration` (`resource-host.tsx:131`), and rAF, `.animate(` and hand SVG writers are 0 across the eight loading modules. Claim 2 re-derived from the generated report: migrated 295 value / 214 type against legacy 292 / 211, api-compat 9 errors that are exactly the seven D554 waivers plus the two D557 `PatternArea` rows, no new mismatch hiding inside the count. Corrections applied by the lead: (1) `styles.css` `animation:` and `@keyframes` each read 2, not the 1 the V3.6 row claims — the second of each is the D570 sweep, sanctioned, and the V3.6 row now says so rather than reading stale; (2) `12-census.md` undercounts the raw-svg line hits by one at its own commit (89 written, 90 measured at `6b2d014`) and HEAD reads 93, the three extra lines being the seam's shimmer mask, gradient and band rect — the correction is stamped at the top of census §1; (3) the audit proposed `internal/radar-reveal.ts` as an eighth G31 shell and that is **rejected on measurement**: it has three live consumers (`radar-chart.tsx:39,40`, `radar-focus.ts:6`), so 7.4 prunes its four dead re-exports (`buildRadarProgressKeyframes`, `radarRevealTiming`, `RadarResolvedTiming`, `BklitRadarGridOptions`) instead of deleting the file. G31 is otherwise confirmed at eight modules and 905 lines, all still on disk with no live caller. Closed and agreed by the tree: G11 (no `createOffsetArc`), G14 (`createElementNS` 0), G20 (module gone), G26 (28 `initialWidth=` mounts). Open with the right owner: G17, G18, G19, G24 (V3.7), G25 (the probe, not the code), G28 (V4.1), G29, G30, G31 and G32. Counts re-run by the lead: tsc 0, lint 3, tests 240/180/0/60, orphans 0, reach-in total 21 failures [], fixtures 3/3, api-compat 9. Wave 4 is ticked; what remains before 7.5 is the 7.4 refactor commit and the gate rows themselves. | This session. |

## D574 — 7.4 refactor triage: the G31 shells are not free deletes

The 7.4 inventory audit ran read-only over `showcase/migrated/charts/**` at HEAD
`665a9ad` and reported dead code, duplicated logic, leftover scaffolding and import
hygiene. I re-measured every row before triaging it into
`research/phase-7/11-refactor.md`. Three of its claims were wrong and two more rows
were rejected on measurement.

**Correction 1.** `chart-reveal-clip.tsx` cannot be deleted. It is barrel-exported at
`showcase/migrated/charts/index.ts:118-119`, it exists in legacy at
`repos/bklit-ui/packages/ui/src/charts/chart-reveal-clip.tsx:30`, and
`qa/api-compat/all.ts:75,356` asserts both the component and its props type against
legacy. Deleting it would break claim 2. G31's count is therefore 7 modules and 773
lines, not 8 and 905.

**Correction 2.** `sankey-animation.ts` is not caller-free. `sankey-chart.tsx:20,21,323,502`
imports `runSankeyReveal` and `stampSankeyLinkPathLength`. The audit's importer probe
matched only the `./sankey-animation` form and missed the `./internal/` form.

**Correction 3.** The remaining shells are neutralised, not inert, and every one has
live importers. `reveal-wipe.ts:10` stamps `data-bkm-revealed` and clears inline
`clipPath`, and `use-line-reveal.ts:41` latches replay on that stamp.
`sunburst-label-reveal.ts:30` stamps `data-bkm-labels-revealed` and clears inline label
opacity. `composed-reveal.ts:27-45` schedules the reveal-deadline timeout that drives
`onPhaseChange("ready")`. Deleting these modules without re-homing that work is a
behaviour change, which is exactly what 7.4 is not allowed to be.

**Rejected rows.** `internal/index.ts` is not unimported: `area-chart-loading.tsx:19`
reads `ChartMargin` from it. The "child-flatten duplicated four times" row is not
duplicated logic — the shared part is the one-line idiom `[node].flat(Infinity)` and
the four loop bodies differ entirely, so extracting it saves no lines and adds a hop.
The `MS_PER_SECOND` dedupe across 22 files is deferred as churn. The comment sweep is
cut down to one line, `chart-host.tsx:106` ("mounts the `/core` entry until V3.5", a
regime D567 closed); the `V1.2/G6` and `D521b` tags are provenance on live code and stay.

**Ruling.** 7.4 lands as two commits, not one. The PLAN's "one refactor commit" is a
default, and principle 6 (always shippable) beats it here because the two halves carry
different risk. **7.4a** is dead code and one duplicate collapse with no call-site
change, no DOM change and no barrel change: ten rows, about 165 lines and 2 files. The
confirmed-dead symbols are `createPieHoverCoordinator` with its `PieHoverCoordinator`
interface, `clearRevealed`, `buildLoadingSkeletonSeries`, `loadingSkeletonBarHeights`,
the two `line-loading-sweep.ts` constants, radar's four re-exports, `LoadingLabel`'s
`exiting`, and the `animate` prop threaded into three leaf indicators that never read
it. The duplicate collapse is real: `loading-chrome.ts:31-58` re-implements
`skeleton-data.ts:5-13,42-56` with identical constants (110/36/1.15/9, 95/28/1.05/7,
hash 43758.5453, salt 12.9898, heights 20..80); `skeleton-data.ts` survives as the
V3.4b verbatim parity source and `buildLoadingSkeletonRows` repoints at it.
**7.4b** is the G31 unwind, ordered `reveal-wipe` and `composed-reveal` first (shared
consumer), then sunburst, scatter, choropleth, sankey, then the ring track block, with
the reach-in ledger entries dropping in the same commit and a QA run before it lands,
because the stamps are read on the replay path.

**V5.3 answered: against.** `internal/` holds 407 files; about 180 are single-family
and about 227 are cross-cutting (`use-` 34, `chart-` 23, `pattern-` 18, `marker-` 13,
`tooltip-` 12, `legend-` 10, `brush-` 10, plus `parity/`). Family directories would
home under half the tree while the entangled half still needs a shared home, and it
moves neither claim. Recommend dropping V5.3 or reducing it to `parity/`, already a
directory.

## D575 — 7.4b merged: the G31 reveal shells are gone

`7b113a9` deletes the seven V3.5-neutralised reveal writers and re-homes what each
still did. Removed: `reveal-wipe.ts` 57, `composed-reveal.ts` 48,
`sunburst-label-reveal.ts` 52, `scatter-reveal.ts` 108, `choropleth-reveal.ts` 109,
`sankey-animation.ts` 134, and the ring track expand block in `ring-chart-model.ts` 46.
The commit reads 333 insertions against 700 deletions over 15 files.

**Lead correction on review.** The executor revived the composed bar-stagger deadline,
on the strength of my own prompt telling it to preserve that timer. Tracing the old
code showed the timer was unreachable: `runRevealWipe` ended in `applyStillReveal`,
which always returned `false`, so `if (!runRevealWipe(...)) {return;}` returned before
`startBarReveal` on every commit. Arming it would have introduced an
`onPhaseChange("ready")` firing that never happened before, which is exactly the
behaviour change 7.4 forbids. I deleted the deadline with the shell, matching how the
same executor correctly handled the two other cases: the line marker stagger and the
composed wipe gate were both dead behind the same always-false return, and both went.
My prompt was wrong, not the code; the fix is recorded here rather than re-dispatched.

**Kept deliberately.** `chart-reveal-clip.tsx` stays under correction 1 of D574.
`sankey-reveal-specs.ts` (211 lines) stays whole: the re-homed reveal frame reads every
one of its exports, so trimming it to `stampSankeyLinkPathLength` would drop the
`transformOrigin` write and the deadline window, which is a behaviour change.
`pendingBarsRevealRef` stays as an always-false guard, exactly as it behaved before.

**Ledger.** The `scatter-reveal.ts` entry moves to `scatter-reveal-setup.ts` (same
reach-in, same max of 1, D433); the choropleth and sankey notes re-point off the deleted
files. Total stays 21 over 12 files, `failures: []`.

**Gates.** Both 7.4 commits were gated in frozen worktrees while work continued.

| Commit | runs | cells | gateFail | ruled FAIL | unruled |
|---|---|---|---|---|---|
| `3efc9f1` (7.4a) | 43 | 190 | 0 | 2 | 0 |
| `7b113a9` (7.4b) | 43 | 190 | 0 | 2 | 0 |

The two ruled cells are the standing ones: radar/6 hover-50 at 6452 px against the 7000
bound (D535) and sankey/33 hover-30 at 10040 px against the 11017 bound (D498). Every
chart 7.4b touched — area, line, composed, scatter, choropleth, sankey, sunburst, ring —
passes on all four states, and the pixel counts move by single digits against the 7.4a
run, which is run-to-run noise, not a change in what is drawn. Floor at `7b113a9`: tsc 0,
oxlint 3, tests 240/180/0/60, orphans 0, reach-in 21 with no failures.

7.4 is complete. What remains before the phase closes is the 7.5 gate itself.

## D576 — V5.4: the migrated tree lints clean; the floor drops to 0

The three residual oxlint errors are gone and `LINT_FLOOR` in `qa/gate/run-checks.mjs` is 0,
so any new error now fails the gate instead of hiding under a pinned count.

Two of the three could not be fixed by deletion. `heatmapCssVars` carries `@deprecated` in
bklit (`repos/bklit-ui/packages/ui/src/charts/heatmap/heatmap-context.tsx:211`) and is still
publicly exported there, so parity requires the migrated re-export *with the tag*, and every
spelling of that re-export is a use of a deprecated symbol. Four restructurings were tried and
each traded the error for another: `export const` at the declaration site breaks
`import/group-exports` and `import/exports-last`; `export *` in the barrel breaks
`oxc/no-barrel-file` and `sonarjs/no-wildcard-import`; a leading-line `oxlint-disable-next-line`
breaks `capitalized-comments` (the directive itself is prose to that rule) and, with a parity
note above it, `comments/max-lines`. What works is the trailing form, which
`capitalized-comments` treats as an inline comment: `// oxlint-disable-line typescript/no-deprecated
-- parity: bklit deprecates and still exports it`, on `css-var-maps.ts:100` and `index.ts:114`.
This is the first inline disable in `showcase/migrated/charts`; both are single-rule,
single-line, and carry the parity reason on the same line.

The third, `sonarjs(variable-name)` on the `declare global var __qaSetMarkerFan`, takes the same
trailing directive. The alternative — dropping the `var` and reading through `window` — costs
more than it buys: `typeof window !== "undefined"` trips `anti-slop/no-runtime-typeof` and
`typescript/prefer-optional-chain`, and `globalThis.window?.` trips
`typescript/no-unnecessary-condition` because the DOM lib types `window` as non-nullish. The
`globalThis` read stays exactly as it was, so SSR behaviour is unchanged.

Floor at this commit: tsc 0, oxlint **0**, tests 240/180/0/60, orphans 0, reach-in 21 over 12
files with no failures. `research/phase-7/12-census.md` §lint updated to read 0.

## D577 — V5.1: the bundle gate gets its second column, and it reads red

The bundle stage only ever compared `migrated/<cell>` against a *pin* of
itself (`bench/results/bundle-gate.json`, 3% tolerance), so it could only
catch self-regression. `08-synthesis.md:130` asks for a second, independent
column: `migrated/<cell>` against the `bklit/<cell>` control at a hard
ratio of ≤ 1.10, no allowances. That column now exists and the stage exits
non-zero when any cell is over.

**It reads 21 of 43 cells over, worst `arealoading` 1.408.** That is the
honest first measurement, not a regression: the column had never been
computed before. The failures are not 21 independent problems — they are
one shape. Every cartesian cell sits at 1.23–1.29 with a near-constant
31–39 kB absolute delta (`line` 166.4 vs 133.1, `area` 164.1 vs 133.3,
`projection` 169.4 vs 135.4, `markers` 177.6 vs 141.9). The non-cartesian
families are already under: `sankey` 1.033, `choropleth` 0.996,
`radar` 0.969, `pie` 0.952, `heatmap` 0.854. So one shared cartesian import
chain carries the whole overshoot, which is what V5.2 has to find.

For scale: `tanstack/line` is 84.6 kB against `migrated/line` 166.4 kB, so
the ~82 kB above the raw package is the parity layer, not the package.

**Two defects found in the gate itself while doing this.**

1. `run-checks.mjs:110` summarised `scripts/bundle-gate.mjs` with
   `/^ok /gm` and `/^FAIL /gm`, but that script indents its lines
   (`"  ok    migrated/line ..."`). The checks stage has therefore been
   reporting `{"ok":0,"fail":0}` — reading as "nothing measured" — while
   all 43 pins were in fact passing. Now reads 43/0.
2. `bench/results/bundle-sizes.json` is stale: measured Sep 5 13:15,
   before V3.9's loading sweep landed on Sep 6. It is why
   `migrated/barloading` reads 2.4 kB gzip against bklit's 68.4 kB — a
   number that cannot contain a chart host, and which flatters us rather
   than warning us. The ratios above are directionally right but **V5.2
   may not be judged until the table is re-measured at the final HEAD.**

**CSS column** (`bench/measure-css.mjs` → `bench/results/css-sizes.json`):
report-only, and it must stay that way. Every migrated cell ships exactly
2087 B gzip and every bklit and tanstack cell ships 0, because legacy
styles its charts with Tailwind utility classes resolved in the host
application's global stylesheet while the migrated tree imports its own
`styles.css`. The two sides are not measuring the same thing, so a ratio
would be meaningless. The constant 2087 across all 43 cells is itself a
finding: the stylesheet is not split per family, so every chart pays for
all of them.

Landed `c58df20`. V5.1 is merged; V5.2 stays open on the re-measure.

## D578 — G24: four brush props ruled, four props wired, two were never broken

G24 said "legacy props restored as types only, behaviour not wired; the
parity harness reads them green because `Eq` is type-level". An audit
(`ses_f895ac099ffeTlqBQstDXMrhCd`) traced every named prop from its
declaration to a real read, against legacy and against the 0.16.0 `.d.ts`.
The gap was right in kind and wrong in detail: two of the props it named
are in fact wired, and the rest split three ways.

**Already wired — G24 was stale.** `initialSelection` reaches the
definition (`brush-layer.ts:59` → `use-line-brush-range.ts:24` →
`brushX({range: controlledSignal(...)})` → `controls:` in
`use-line-chart-spec.ts:152` and `area-chart-definition.ts:590`).
`BarDepthProvider.groundShadow` reaches the gradient stops
(`use-bar-definition.ts:158` → `buildPosBarStops`/`buildNegBarStops` →
`buildNativeDepthGradients`). No ruling needed for either.

**Ruled vestigial — the prop exists so callers type-check, and ignoring
it is the correct behaviour.** Each now says so at its declaration in
`internal/chart-brush.ts`:
- `host`: legacy has **no `host` prop at all** (`grep "host?:" ` across
  the legacy chart tree is empty). There is nothing to be unfaithful to.
- `selection`: legacy destructures it as `selection: _selection`
  (`chart-brush.tsx:262`) and never references it again. Ignoring it *is*
  parity; wiring it would be the divergence.
- `brushDirection`: the package `brushX` is X-only —
  `BrushXBaseOptions` (`dist/interaction-brush.d.ts:17-36`) has no
  direction key. Legacy forwards it to visx to control the drag axes, so
  `"vertical"`/`"both"` are genuinely unavailable at 0.16.0.

**Ruled accepted divergence.** `useWindowMoveEvents`: legacy forwards it
to visx and zeroes the margin when false (`chart-brush.tsx:239-248`),
which re-anchors coordinates inside a transformed container. No package
surface exists; the host owns pointer events. No visible difference in
normal layouts. Accepted rather than reimplemented, per principle 2.

**Wired — real divergences with a real surface, so no ruling was
available.** These were the honest half of G24:
- candlestick `xDomain` / `xDomainSlotCount`: declared at `:98`/`:100`
  and never even destructured. Legacy clamps the x scale to the passed
  range (`:141-145`) and pads by `slotWidth/2` off a slot count of
  `xDomain && xDomainSlotCount != null ? xDomainSlotCount : data.length`
  (`:138`, `:152`); migrated auto-fit the data extent and always used
  `renderData.length`. The package can carry it — migrated already builds
  a custom scale (`candlestick-chart-scales.ts:154`) and `ChartScale`
  takes any domain. → G24a.
- `BarDepthProvider.segmentsAccessor` / `minBarHeight`: declared in
  `series-config-types.ts:183,185` and read nowhere. Legacy splits the 3D
  side faces per segment (`bar-depth.tsx:417,557,633`) and floors short
  bars with `Math.max(rawHeight, minBarHeight)` (`:395,:438`), so short
  bars stay visible; migrated rendered single-face sides and let them
  collapse. No native surface (`dist/bar.d.ts` has no depth keys), but
  both are expressible through the custom depth marks already in use.
  → G24b.

The lesson for the board: a type-level parity harness cannot tell a wired
prop from an unwired one, so `Eq` green is not evidence that a prop
works. Where a prop is deliberately inert, the declaration now carries the
ruling, so the next reader does not re-derive this.

## D579 — heatmap six-month display range is host-timezone-sensitive in legacy (G29 follow-up)

`getHeatmapWeekCount(startSunday, endDate)` divides an absolute ms difference by a
fixed `MS_PER_WEEK`. Any span crossing a spring-forward transition is one hour
short, so `Math.floor` drops a whole week. For the six-month grid the effect is
year-round in a DST timezone: the grid ends the Saturday *before* today's week,
`resolveInferredHeatmapDisplayRange`'s `extentEnd >= today` gate does not hold and
the range correctly resolves to `{start: null, end: null}`.

Measured 2026-09-06 for `today = Sun Sep 06 2026`, six-month window from
`Sun Mar 01 2026`:

| TZ | weekCount | gridEnd | reaches today |
|---|---|---|---|
| UTC | 28 | Sat Sep 12 2026 | yes |
| Asia/Tokyo | 28 | Sat Sep 12 2026 | yes |
| Europe/Lisbon | 27 | Sat Sep 05 2026 | no |
| America/New_York | 27 | Sat Sep 05 2026 | no |

Verified identical in legacy `repos/bklit-ui/packages/ui/src/charts/heatmap/heatmap-utils.ts:41-46`
(`endSunday = getHeatmapWeekStartSunday(endDate); Math.floor((endSunday - startSunday) / MS_PER_WEEK) + 1`),
so legacy's own `heatmap-ghost.test.ts:90` fails in the same timezones. **Parity is
preserved by reproducing the arithmetic**, so under principle 1 this is not a
migration defect and under principle 2 it is not fixed here — a divergent (correct)
week count would render a column legacy does not render.

Ruling: **ACCEPT** under D555 (stale/date-sensitive legacy tests). The six-month
case in `qa/unit/legacy-heatmap-ghost.test.mjs` stays `test.todo` with the legacy
body verbatim. The executor's first pass added a top-up loop that grew `weekCount`
until the grid reached today; that made the suite green by reshaping the input
rather than by matching legacy, and was removed. The year-grid case is unaffected —
`resolveHeatmapWeekRange` takes the weeks-based branch (`heatmap-utils.ts:135-137`)
which never calls the DST-sensitive count — and stays enabled.

Net: `pnpm test` 240 tests, pass 182, fail 0, todo 58 (baseline 240/180/0/60).

## D580 — G28: the sunburst role was already at parity; only the tab stop was real

G28's prescription in the gap table read "FOLD into V4.1: host `role="img"` + label
on every mount, tab stop deleted". Both halves were wrong, for opposite reasons.

**`role="img"` — already correct, and adding it is a regression.** The audit read
`role="img"` 0 across families, but that grep saw hand-written source, not rendered
output. `qa/unit/probes.test.mjs` has measured `roleImg: 1` for all 16 families since
2026-09-05: the package's own chart svg carries the role. Legacy carries `role="img"`
exactly once, on the sunburst `<motion.svg>` (`sunburst-chart.tsx:455-470`) — the same
role on the same kind of element. **Migrated sunburst already matched legacy.**

The executor implemented the prescription as an opt-in `role?: string` on `ChartHost`,
set only by sunburst, and measured the result honestly rather than loosening the pin:
`{roleImg: 2, tabStops: 1}` against a pinned `roleImg: 1`. Two roles is a divergence
from legacy's one and an a11y regression on its own terms — `role="img"` on a wrapping
div hides its whole subtree from assistive technology, so the marks inside stop being
reachable. Ruling: **reverted**, both `chart-host.tsx` and `sunburst-chart.tsx` restored.
The label half needed nothing either; `ariaLabel ?? \`Sunburst chart of ${data.name}\``
was already byte-identical to legacy's string.

**The tab stop — real, and invisible to the probe.** `sunburst-center-overlay.tsx`
gave the centre control `tabIndex={isClickable ? 0 : -1}` plus an `aria-label`.
Legacy's centre is a plain non-focusable `<circle>` with an `onClick` and no
tabIndex or label anywhere (`sunburst-center.tsx`). Kept: `tabIndex={-1}`, label
deleted. The `<button>` element stays — with no accessible name and no tab stop it
has legacy's failure modes, and swapping in a `<circle>` would need an SVG wrapper
around an HTML overlay for identical visuals (principle 2: no second implementation).

**Correction to the record.** The old comment in `probes.test.mjs` named
`sunburst-center-overlay.tsx:68` as the remaining tab stop. It never was: the overlay
renders no `tabindex` in any state, and every family reads exactly 1 — the package
svg's own, which we do not own. P-23's "zero tab stops" target is therefore not
reachable without an upstream change, and the todos stay todo for that reason rather
than as pending migration work. Comment corrected; no pin loosened.

Net: `qa/unit/probes.test.mjs` 64 tests, 48 pass, 0 fail, 16 todo (was 46 pass with
the role change in the tree).

## D581 — 7.5: §6 counts re-run from a fresh clone, three deltas, no new violation

Re-derived every `08` §6 count in a throwaway `git clone --no-hardlinks` at HEAD
`eb7c3f8`, so no untracked or ignored file could influence a number, and every
command reads `HEAD` so only committed content is counted. Written up as
`research/phase-7/12-census.md` §1.0.

Unchanged: `setAttribute` 3, `createElementNS` 0, `spatialIndex` 1, `focusDisabled`
0 in code, `use-container-size` 3, `renderer={` 28, `svgAnimation` 23 literals with
0 non-false, `initialWidth=` 28, `idPrefix=` 53, `createPortal` 13/6, and every d3
import count. Census table 1a is unchanged file-for-file and count-for-count.

Three moved:
- raw svg 89 in 36 files → 93 in 37. Entirely `internal/resource-host.tsx` 1 → 4,
  from V3.9's `LoadingSweepMask` (`<pattern>` + two `<rect>`). That file is the R10
  seam host and is the one the headline already subtracts, so raw SVG outside the
  seam did not move.
- `styles.css` `animation:` and `@keyframes` 1 → 2: V3.9's travelling loading sweep
  beside the loading pulse, under the D566 sanction. Loading chrome, not marks.
- `styles.css` transforms 0 → 2 (`:707`, `:710`): the sweep keyframes translate
  `.ts-bkm-loading-sweep-band`, a `<rect>` inside a `patternContentUnits="objectBoundingBox"`
  pattern in the seam host. Checked rather than assumed — the comment says
  objectBoundingBox units while the CSS says `px`, which reads like a unit bug; in SVG
  a transform `px` is one local user unit, so `-1 → +2` travels three tile widths,
  matching legacy `loading-sweep.tsx`. §6's target is transforms on *package nodes*,
  and the band is neither a package node nor a mark, so the target holds.

Also noted for the next re-run: `styles.css` and `sunburst-architecture.md` match the
raw-svg proxy (2 hits each) without being chart code, since the grep matches any
`<g `/`<path` text.

## D582 — G25: the `spatialIndex` grep was the wrong probe; §6 counts chart-owned pointer resolution instead

**Ruling.** `08` §6's "`spatialIndex` ≥ 5" cannot be satisfied and never described
the claim it was written for. `docs/reference/focus-and-interaction.md:963` and
`dist/interaction.js:3-11` resolve a definition `focus` strategy *before*
`spatialIndex.findNearest`, so a cartesian family that supplies a strategy would
carry an index that is never consulted — exactly why V2.5 deleted its
`d3-delaunay` factory as consultation-dead (D544) and why D534 stamped the focus
strategy as the honoured seam for choropleth after `renderer.js:350` proved the
index unreachable under mark states. Adding the literal key back to reach ≥ 5
would be a second implementation kept for a probe (principle 2), so the probe is
what changes, not the code. **G25 is not a code change and lands as one.**

**Corrected probe** (`research/phase-7/12-census.md` §6 row, §5 reading, and
`08-synthesis.md:155`): count what the definition actually owns for pointer
resolution — a focus strategy, a focus factory, a built-in named strategy, or a
spatial index. Measured at HEAD from `git grep HEAD` (committed content only):

| kind | probe | sites |
|---|---|---|
| strategy / factory | `git grep -nE 'focus: (create[A-Z][A-Za-z]*Focus\|[a-zA-Z.]*[fF]ocusStrategy\|focusGroupAngle)' HEAD -- showcase/migrated/charts` | **9** over 8 files |
| built-in named | `git grep -nE 'focus: "(group-x\|nearest-x)"' HEAD -- showcase/migrated/charts` | **5** |
| spatial index | `git grep -n 'spatialIndex' HEAD -- showcase/migrated/charts` | **1** |
| | | **15 ≥ 5 → PASS** |

The 9: `candlestick-chart.tsx:244` (`candlestickFocusStrategy`),
`choropleth-chart.tsx:377` (`createChoroplethFocus`, D534),
`internal/bar-chart-series-marks.ts:666,755` (`barFocusStrategy`,
`params.barFocusStrategy`), `internal/scatter-definition-assemble.ts:72`
(`scatterFocusStrategy`), `internal/use-sunburst-definition.ts:229`
(`createSunburstFocus`), `pie-chart.tsx:356` and `ring-chart.tsx:240`
(`focusGroupAngle`), `radar-chart.tsx:371` (`createRadarFocus`). The 5:
`composed-chart.tsx:266`, `internal/area-chart-definition.ts:137,591`,
`internal/use-line-chart-spec.ts:153`, `live-line-chart.tsx:533`. The 1:
`sankey-chart.tsx:609` (D533's pick-order index, which survives because sankey
supplies no focus strategy).

**Excluded, deliberately.** `when: { focus: "unmatched" | "primary" | "group" }`
mark-state predicates (choropleth, funnel, bar, scatter, pie, sunburst,
heatmap's `when` callbacks) — those are paint conditions, not resolution;
`readonly focus:` type declarations and destructured parameters
(`sunburst-context.tsx`, `sunburst-hint.ts`, `scatter-chart-view.tsx`,
`sankey-mark.ts`, `parity/sunburst-geometry.ts`); and
`internal/loading-definitions.ts:18` (`focus: false`) — the loading shell has no
data to resolve, and it is the one deliberate opt-out. `styles.css` and
`sunburst-architecture.md` are prose and never counted.

**What this does not claim.** 15 is a count of sites, not of families: heatmap,
funnel and gauge supply no focus option at all and resolve through the package
default, which is parity-correct for all three (no legacy hover pick order to
reproduce). §6's number was always a floor, not a per-family requirement.

G25 closed. G26 (D571) and G28 (D580) closed the same way — the census's job was
to find which §6 numbers measured the wrong thing.

## D583 — G32: the migrated-side reduction is the D567 cardinality gate, already landed; the residual is one boundary cell

**Ruling.** G32's disposition was "reduce the reconciles per pointer move on the
migrated side; not upstream-filable (D568)." Measured at HEAD `f9580df`, that
reduction is already in the tree and is what the counts read. G32 closes as a
ruling, no code change.

**What the migrated side actually owns here.** Two levers, and only two: which
package renderer a mount takes, and how many primitives the scene emits. The
four whole-scene `applyStateFocus` → `animateSvg` passes per pointer move are
reached through package-internal `paintFocus`, which no migrated module calls
(D568), and D568 already proved the cost does not reproduce on a package-only
control, so there is nothing to file and nothing to patch inside the package.

**Lever 1 — renderer selection (D567), live at HEAD.**
`NATIVE_MOTION_MAX_POINTS = 200` (`internal/design-tokens.ts:22`);
`chartRendererFor` in `internal/motion-renderer.ts` returns the package *static*
renderer above the token and `chartMotionRenderer()` at or below it, latched once
per mount through `useChartRenderer`. Six mounts ride it: `bar-chart.tsx:286`,
`candlestick-chart.tsx:374`, `composed-chart.tsx:384`,
`internal/scatter-selection-setup.ts:105`, `internal/use-area-layer-props.ts:42`,
`line-chart.tsx:389`. There is still exactly one `motion()` factory and no second
renderer implementation — `motion(` call sites = 2 at HEAD (`stillInstance`,
`resizeInstance`), re-run by the lead.

**Lever 2 — the estimate counts emitted primitives, not rows.**
`bar-chart.tsx:273-286` (`motionPrimitiveEstimate`) adds square primitives and
depth back/front nodes to `rows × series`, so bardepth's 2,073 elements clear the
200 token and take the static renderer. That is why the ~1.2 s / 8,544-timing-
context profile in D567 no longer appears anywhere in the gate.

**Evidence at HEAD `f9580df` (gate run `2026-09-06T13-02-53-709Z`).**

| probe | reading |
|---|---|
| bardepth-toggle | **0 flags**; migrated 100/476 elements off/on vs bklit 103/525; settle 56/0/53 ms |
| no-rereveal | **0 flagged rows** over 8 rows |
| hover-lag | **4 flags, down from 5** at the previous full gate |
| QA matrix | 189 gated cells, **gateFail 0** — no hover cell diverges in pixels |

Three hover-lag flags closed since the previous full gate and one opened:
sankey/33 lost `settles-after-700ms-capture` (migrated last change 1298 → 204 ms),
scatter/1000 lost `dim-lag>200ms` (571 → 235 ms), candlestick/1000 lost
`tooltip-lag>200ms`; liveline/100 gained `dim-presence-mismatch`, which is a
dim-timestamp capture artifact — its dimmed counts (bklit 4, migrated 0) are
unchanged from the previous run, where the same row carried no flag.

**The one residual, named exactly.** `bar/100` still reads
`settles-after-700ms-capture`: migrated last change 1131 ms against bklit 234 ms.
The scenario is 100 rows × 2 series (`bench/app/src/scenarios/migrated-bar.tsx:36-37`)
= 200 primitives, and the gate is `pointCount > NATIVE_MOTION_MAX_POINTS`, so 200
is *not* greater than 200 and this cell sits exactly on the boundary — it is the
one cartesian cell still on the motion renderer at hover.

**Why the token stays at 200.** Lowering it to catch this cell would move every
bar mount to the static renderer and drop the enter/exit and stagger motion the
seamless-swap claim requires bar to keep. That trades a claim for a settle-time
tail the pixel gate does not see (gateFail 0 on every bar cell). Under principle 1
that moves one claim away without moving the other closer, so the token holds and
the residual is stamped, not chased.

**What this does not claim.** It does not claim the four reconciles are gone —
they are package-internal and still run for any mount at or below the token. It
claims the migrated side has no remaining lever it is not already pulling, and
that the measured blast radius is now one boundary cell whose only symptom is a
settle past the harness's 700 ms capture.

## D584 — 7.5 bench: 29 cells, 9 flags, none of them a regression this phase caused

Run `docs/phase-7/gate/runs/2026-09-06T13-02-53-709Z/bench.{json,md}`, cells
`--all` plus the five paired migrated cells, 7 measured runs each after a
warm-up, wall-clock 44m19s. Summary
`{"cells":29,"skipped":0,"flags":9,"consoleErrors":0,"tooltipMissing":0,"failedInvocations":0}`.
Console errors 0 and tooltip-missing 0 mean the two D500 inherited-behaviour
channels stayed at their baselines. The `bench baseline predates tree-hash
(pre-V4.4) — continuing` line in the log is sanctioned by the comment at
`qa/gate/run-bench.mjs:143`: `bench-baseline.json` is deliberately kept at the
phase-5 medians without a tree hash, and the runner warns rather than refuses.

D273's rule is symmetric ±20%, so a flag means "moved", not "got worse". The
nine columns, explained (V4.5):

**Three are improvements.** `bklit/line/10000 m1c` 99.56 vs 126.71 (−21.4%),
`tanstack/line/1000 m1b` 53.6 vs 70.6 (−24.1%), `migrated/composed/1000 m1b`
1194.8 vs 1664.8 (−28.2%). The composed one is ours: the settle that D551's
crosshair and D564's stylesheet work were expected to shorten, measured.

**One is a void metric, not a regression.** `migrated/scatter/1000 m1b` reads
2504.6 ms against a 1258.6 ms baseline (+99%), and the seven raw values are
2504.1 / 2504.5 / 2504.6 / 2504.6 / 2504.9 / 2505.0 / 2505.4 — zero spread
around `FALLBACK_MS = 2500` in `bench/app/src/bench/settle.ts:26`. That arm
resolves on "saw a non-ready phase, then ready again"; migrated scatter at
n=1000 carries 2 series × 1000 points, clears `NATIVE_MOTION_MAX_POINTS = 200`,
takes the package static renderer under D567 and therefore never emits a
non-ready phase at all. The promise falls through to the safety net, so the
number measures the timer, not the chart. What the same run does measure is
`m1a` mount-to-paint 124.8 ms (p95 137) against `bklit/scatter/1000` settle
1269.7 ms: the reveal is gone because D567 removed it, which is the regime
working, not a slowdown. The paired `m3a` flag on the same cell is 35.8 vs 28.8
ms — a 7 ms move on a metric whose vsync floor is 32.6 ms, sitting one
millisecond off the `tanstack/scatter/1000` control at 34.8 ms.

**Four are migrated mount scripting, +24.5% to +47.1%, against a baseline from
a different machine-day.** `migrated/line/1000 m1c` 112.81 (base 76.7),
`migrated/area/1000` 123.8 (88), `migrated/composed/1000` 154.14 (123.8),
`migrated/bar/100` 92.62 (72). Two facts bound them. First, m1c drifted upward
tree-wide in this run: every non-migrated cell at small n moved the same way —
`bklit/line/100` +12.0%, `bklit/area/100` +12.4%, `tanstack/area/100` +12.4%,
`tanstack/scatter/100` +10.8%, `tanstack/bar/100` +9.1%, `bklit/scatter/100`
+6.9% — so roughly half of each migrated percentage is the machine, amplified
because the migrated baselines (72–124 ms, `docs/phase-5/BASELINE.md` §3b,
P6.4 2026-08-26) are smaller numbers than the controls'. Second, in absolute
terms migrated mount scripting sits about 30 ms above the pure-package control
on every cell and below legacy where legacy is expensive: line 112.81 vs
tanstack 82.53 vs bklit 85.63; area 123.8 vs 93.66 vs 87.2; bar/100 92.62 vs
73.72 vs **202.91**. That ~30 ms is the compat layer's mount cost and it moves
neither claim.

**Ruling.** No cell is refused. The scatter settle column is marked void for
this metric under D567 rather than chased, in the same way `m1a` is a void
channel on this machine per BASELINE §3b; the m1c flags are recorded as a
watch, not a fault, because the baseline they move against predates the
machine-day and the absolute numbers are between the package and legacy. The
baseline is not regenerated — that needs its own D-entry per the runner's own
note.

## D585 — V5.2: the bundle is measured, the ≤ 1.10 column fails 41/43, and the whole overshoot is the barrel import, not the charts

D577 left V5.2 open with "V5.2 may not be judged until the table is re-measured
at the final HEAD". The final gate re-measured it: `bundle.{json,md}` in run
`2026-09-06T13-02-53-709Z`, `measured: true`, `measureExit 0`, 12.2 s, 104
bundles. Both columns moved, and the second one inverts D577's reading.

**Column 1 — drift against our own pins: 30 FAIL of 43.** Σgzip 6,589,104 vs
Σpin 5,605,143 (+17.55%), tolerance 3%, pins stamped 2026-09-05 at `61d6179`.
The largest delta is `migrated/barloading` +3323% (83,837 vs a 2,449 B pin) and
the second is `migrated/arealoading` **−32.63%** — the two loading cells D577
already named as impossible numbers from the stale Sep-5 `bundle-sizes.json`.
The pins are pre-V3.9 and are what is wrong here; re-pinning is a formal
adoption and belongs to its own D-entry, not to this one.

**Column 2 — parity against `bklit/<cell>`: 41 over 1.10 of 43.** `ratioCells`
43, `ratioOver` 41, `ratioNoControl` 0, worst `migrated/sunburst` 1.608, then
sunchrome 1.606, gauge 1.439, sankey 1.424, funnel 1.411, ring 1.362; only
`migrated/legend` 1.08 and `migrated/arealoading` 0.949 pass. D577's claim that
the overshoot was one cartesian import chain and that non-cartesian was already
≤ 1.03 was an artefact of the stale table: measured, the polar and hierarchy
families are the **worst**, not the best.

**The overshoot is a constant, not a slope.** Per-cell `migrated − bklit` gzip
runs 27–53 kB with a median of 36.5 kB across families that differ by 5× in
chart complexity: sunburst +53.2 kB, line +36.5 kB, scatter +29.0 kB, heatmap
+18.2 kB, and `migrated/legend` — the one cell that mounts no chart — +0.9 kB.
A constant offset that appears the moment a chart is mounted is a shared import,
not per-chart code.

**It is not the package.** The gate measures a third column the parity gate
ignores: `tanstack/<cell>`, the same chart written straight against
`@tanstack/charts`. Every one of those is *smaller* than legacy — line 0.636 of
bklit, heatmap 0.605, sunburst 0.842, funnel 0.913 — so the package core is a
saving, not a cost. The ratio that matters is migrated ÷ tanstack: 1.80–2.00
everywhere.

**It is the barrel.** esbuild metafiles for the same scenarios, built through
`bench/measure-bundle.mjs`'s own alias plugin, attribute `migrated/line`'s 492.8
kB minified as `@tanstack/charts` 163.2 / `migrated/charts` 137.0 / scenario
105.8 / d3 86.8, against `tanstack/line`'s 235.6 kB as scenario 105.8 /
`@tanstack/charts` 90.3 / d3 39.5. The extra `migrated/charts` bytes are not
line-chart code: the import graph shows `migrated-line.tsx → @migrated/charts
(index.ts) → sankey-chart.tsx / pie-chart.tsx / choropleth-chart.tsx`, and 33
of the retained modules import d3 directly — d3-geo through choropleth, d3-zoom
and d3-selection through `choropleth-zoom.ts`, d3-shape through sankey, pie,
radar and profit-loss. That is why every migrated bundle carries d3-color,
d3-selection, d3-transition, d3-brush and d3-time-format (91.0 kB minified in
`migrated/sunburst`) while `tanstack/sunburst` carries d3-shape and d3-path only
(5.8 kB). Legacy does not pay this: `bklit/sunburst` retains 14.5 kB of
`bklit-ui/charts` in total, because its barrel shakes.

**Measured directly.** A probe scenario identical to `migrated-line.tsx` but
importing `LineChart` from `@migrated/charts/line-chart` and the four children
from their `internal/*-child` modules, built by the same script: **129.2 kB
gzip against the barrel version's 168.8 kB**. The barrel costs 39.6 kB gzip and
retains 272 extra `migrated/charts` modules. At 129.2 kB against `bklit/line`'s
136.3 kB the deep-import shape reads **0.95** — under the 1.10 limit. The
charts are not bigger than legacy; the import shape is.

**Two hypotheses tested and falsified**, so the cause is stated no further than
the evidence goes: (1) the per-family `import "./styles.css"` — stubbing CSS to
a side-effect-free JS module changed the size by 0 bytes; (2) the
`sideEffects: ["**/*.css"]` field of D517 — flipping it to `false` changed the
size by 0 bytes, alone and combined with (1). Whatever defeats the shake is
module-level code in the family entries, and naming it is not this item's work.

**Ruling.** V5.2 closes as measured-and-stamped, not fixed. Under R7 bundle
size ranks after both claims, and the two shapes that would close the column
both cost a claim: changing the bench scenarios to deep imports would move the
measurement rather than the tree, and deleting the root barrel would break the
seamless-swap contract, which is a legacy-shaped `@bklitui/ui/charts` barrel
import (D517's export map already ships the 18 family subpaths beside it, so
the escape hatch exists for a consumer who wants it). The `08` §6 note that
"the stylesheet is not split per family, so every chart pays for all of them"
now has a JS twin, recorded here for the phase-8 vector: **the barrel is not
tree-shakeable, it costs ~40 kB gzip per mount, and with it removed the parity
column passes**. Nothing in the phase-7 tree is changed on account of it.

## D586 — G18: composed and candlestick now read the measured box, the last two width/aspect latches are gone

**Executor** `ses_f88e40e8dffeb4tIjqeb6vnBmg` (G18), lead-verified.

G18 was the residue of D541. That ruling said the scene height comes from the **measured
container box** and that `width / aspectRatio` is only the fallback, because the package derives
`height = options.height ?? width / aspectRatio ?? 320` (`dist/renderer.js:720`) and its
ResizeObserver (`:187-191`) schedules a render only when the **width** changes — so a container
that is CSS-sized in height alone never re-renders and the scene stays latched at the aspect
height. D541 landed the fix on line, area and bar-loading. Composed and candlestick kept the
latch:

- `composed-chart.tsx:192` — `heightPxComp = phaseAndReveal.width / parseAspectRatio(aspectRatio)`,
  consumed at `:229`, `:371`, `:394`, `:405`.
- `internal/candlestick-chart-chrome.ts:485` — `heightPxCandle = width > EMPTY_CONTAINER_PX ? width / parseAspectRatio(aspectRatio) : COLLAPSED_GEOMETRY_PX`,
  returned at `:509`.

**No second implementation** (principle 2). Both families reuse a resolver that already exists and
is already the landed D541 pattern; nothing new was authored and `internal/use-container-size.ts`
was not touched:

- composed takes the line entry pattern — `useDebouncedContainerSize(phaseAndReveal.containerRef)`
  + `resolveChartHeightPx(width, measured, aspectRatio)`, both re-exported from
  `internal/line-chart-support.tsx` (`:46`).
- candlestick takes the area setup-hook pattern — `useMeasuredRect(containerRef)` +
  `resolveHeightPx` from `internal/area-chart-model.ts` (`:111`), inside `useCandleSelection`,
  which already held the `containerRef`. The dead `parse-aspect-ratio` import went with it.

Both resolvers are byte-identical in shape: `width <= 0 → 0`; `measured > 0.5 px → measured`;
otherwise `width / parseAspectRatio(aspectRatio)`.

**One real behaviour addition beyond the two latches.** `candlestick-chart.tsx` never passed
`height` to `ChartHost` at all, so fixing the chrome alone would have been dead code — the scene
would have stayed width/aspect-only. `:413` now passes
`height={heightPxCandle > EMPTY_CONTAINER_PX ? heightPxCandle : undefined}`, the same shape line
uses: when the box is unmeasured the prop is `undefined` and the package falls back exactly as
before, so SSR and first paint are unchanged.

**Proof.** Headless old-vs-new against the real resolvers (esbuild-bundled, temp files removed):
a zero-height container gives old 320 = new 320 on both paths — byte-identical, so nothing that
already relied on the aspect height moves; a 640×200 CSS-sized container gives old 320 → new 200
on both paths, which is the latch being released. Lead re-ran all three static gates rather than
taking the report (principle 5): `cd showcase && npx tsc --noEmit` exit 0 with no output;
`npx oxlint --type-aware` on the three files exit 0, zero findings; `pnpm test` at the floor
exactly — `tests 240 / suites 47 / pass 182 / fail 0 / todo 58`.

**A third latch, found by re-running the count instead of trusting the item (principle 5).**
G18 named two files; the vector count says three. `grep -rn parseAspectRatio showcase/migrated/charts`
after the two fixes still returned `bar-chart.tsx:168`, `heightPxBar = width / parseAspectRatio(aspectRatio)`,
consumed at `:278`, `:292` and passed as `height={heightPxBar}` to `ChartHost` at `:339`, with a
`containerRef` already in scope at `:91` — the identical shape, and legacy `bar-chart.tsx:701-711`
takes its height from `ParentSize`, i.e. the measured box. Filed as **G33** and fixed in this same
commit rather than left open: principle 4 says a problem is routed to its vector, and principle 6
forbids a half-landed vector, so V1 lands whole or not at all. The fix is the same three lines as
composed's, reusing the same resolver.

The other `parseAspectRatio` sites are not latches and stay: every `aspectRatio={parseAspectRatio(…)}`
is the package's own input; `internal/scatter-selection-setup.ts:160` passes `parsedAspectRatio`
through to `ChartHost` as that same prop; `choropleth-chart.tsx:1055` puts `aspectRatio` on the
container's own CSS box, so the measured height *is* width/aspect by construction and there is
nothing to release. `internal/line-chart-support.tsx:49` and `internal/area-chart-model.ts:114` are
the two resolvers' documented fallback.

**Isolated QA, lead-run (executors are forbidden to).** Eight cells, 32 comparisons, gate 0.5%,
all PASS, and — the point of the run — none of them moved against the 7.5 gate matrix
(`2026-09-06T13-02-53-709Z/qa-matrix.md`), because every QA container is already width/aspect-shaped
so the resolver returns the same number it did before:

| cell | settled | hover-30 / 50 / 70 (px) | 7.5 gate hover row |
|---|---|---|---|
| composed/1000 | 0.0845% | 1787 / 2090 / 2572 | 1787 / 1963 / 2515 |
| composedmultiaxis/1000 | 0.0889% | 2590 / 2458 / 3115 | 2590 / 2462 / 3117 |
| composedstacked/100 | 0.0406% | 2150 / 2572 / 2403 | 2150 / 2572 / 2403 |
| candlestick/1000 | 0.3399% | 1675 / 1480 / 1418 | 1675 / 1480 / 1418 |
| bar/100 | 0.0000% | 3418 / 3311 / 3142 | 3413 / 3311 / 3142 |
| bardepth/100 | 0.0000% | 2047 / 2094 / 1960 | — |
| barsquares/100 | 0.0056% | 2375 / 2656 / 2632 | — |
| barmultiaxis/100 | 0.0000% | 3048 / 3131 / 2711 | — |

Three of the four G18-named cells reproduce the gate row to the pixel; composed/1000's hover-50 and
hover-70 move by 127 and 57 px, inside the tooltip-antialias band D543 measured. bar, bardepth and
barmultiaxis settle at **0.0000%** — exact against legacy — which is the strongest available
evidence that G33's fix changed nothing for a container that was already aspect-shaped, and
released the latch only for one that is not.

**Disposition.** G18 `open` → closed by this commit; G33 filed and closed by the same commit.
Vector V1 (one chart host) — the count that moves is "chart-owned scene-height derivations from
width/aspect": composed, candlestick and bar were the last three, so the tree-wide figure now reads
0 and V1's claim that the package owns sizing holds without exception. Verified after the third
fix: `tsc` exit 0, oxlint exit 0 on the four files, `pnpm test` 240/47/182/0/58.

## D587 — G19: the label fade *is* a hover-driven definition rebuild, 0.16.0 cannot express it, so it is stamped and filed as I8

**Audit** `ses_f88e39bfeffeKsWdo6U22F2qKm` (read-only, HEAD `14c9b2c`), lead-verified against the
installed 0.16.0 `.d.ts` and `dist/`.

G19 filed two things under one row: composed lost the x-tick label fade, the area-fill hover dim
and the highlight band; and line/area still thread `labelFade` through their definitions. They get
one disposition each.

**Half 1 — the threading is real, and it is the shape V2.2 forbids.** Five families hold a
pointer-driven `labelFade` state and feed it into a definition memo: area
(`use-area-series.ts:84` → `area-chart.tsx:190`, deps `:216`), line (`line-chart.tsx:191` → `:249`,
deps `use-line-chart-spec.ts:173`), candlestick (`:217` → `buildFadeXAxisOptions` at `:253-258`,
deps `:300`), scatter (`scatter-definition-setup.ts:195` → `:206`, deps `:221`) and bar
(`use-bar-definition.ts:181` → `:186`), all through the shared builder
`internal/axis-scale-options.ts:92-111`. The audit's headless proof bundles the *real* modules and
compares an unset `labelFade` against a hovered one: the differing key path is
`scales.x.axis.tickLabels.opacity`, which is the number `1` unset and a **fresh closure** capturing
`{primaryX, hoveredLabel}` when hovered — a new object per pointer move, so the memo misses and
`defineChart` runs again. D535 ruling 1 says nothing derived from hovered or focused state may be
an input of a builder. This violates it, measurably.

**But 0.16.0 offers no surface, and principle 2 forbids a second implementation "for now" without
a ruling.** Lead-re-read, not taken on report: `ChartAxisTickLabelContext` is
`{ value, index, position, bandwidth }` (`dist/types.d.ts:193-202`) with no focus member, and
`opacity` resolves only over that context (`ChartAxisTickLabelValue`, `:204`). The crosshair x
label (`crosshair.d.ts`) owns the pill text and takes a static `opacity: number` — it is not a
tick channel. So the fade cannot move into the spec. **Disposition: UPSTREAM.** The threading is
kept — deleting it would delete legacy behaviour the parity contract requires (legacy
`x-axis.tsx:41-90`: `fadeBuffer = 20`, exact hovered-label text match → 0, ramp otherwise,
`transition: opacity 0.4s`) and would move every cartesian hover cell against legacy. Filed as
**I8** in `07-upstream-issues.md`, candidate/unfiled on the same gate as I7, with the headless
repro as its evidence.

**Half 2 — composed's three absences are deliberate and already replaced.** At HEAD composed has
no `labelFade` anywhere: `composed-definition.ts:326` sets `xTickLabelOpacity: 1` as a constant
(lead-verified), `composed-series-marks.ts:90-91` records the hover dim dropped with the legend dim
kept, `composed-marks.ts:44` records the band dropped. The replacements are the package crosshair
with its x date label (`composed-marks.ts:46-58`) and mark states on bars and the boundary `lineY`
(`composed-series-marks.ts:69,103,129`). The area-fill dim cannot come back either:
`applyStateStyle` handles `dot`, `rect` and `label` only (`dist/mark-state.js:123,131,158`) and
state matching resolves through point lookup (`:11-16`) while `areaFill` emits `points: []`
(`area-fill-mark.ts:85`). **Disposition: RULE (stamped divergence).** Composed's tick fade,
area-fill hover dim and highlight band stay absent; its hover chrome is the package crosshair
x-label plus mark states (D543, D551); the composed hover-cell residuals in the 7.5 matrix are
carried, not fixed. Half 2's second gap rides the same I8.

**Why not fix it now.** Both halves are the package refusing, not the migration cutting a corner.
Wiring either would mean a second implementation of something the package is expected to own,
which is exactly what principle 2 and R7 rule out. Composed is the family where the ruling was
already taken and it is the one that is *more* TanStack-native, not less: it is the only cartesian
family whose definition takes no hover input at all. The other five are the debt, and I8 is the
receipt.

**Disposition.** G19 `open` → closed by this entry: half 1 UPSTREAM (I8, code kept), half 2 RULE
(stamped, no code change). No code changed for G19.

## D588 — The 7.5 gate re-run at `3e8092d`: what it says, the one unruled QA cell that is a parallelism flake, and why the checks stage's bundle verdict moved without the tree moving

The recorded 7.5 gate ran at `f9580df`. `76dbbf3` then changed five source files
(G18 + G33 + the candlestick `height` prop), so that gate no longer described the
tree and could not be pasted as proof. This entry records the re-run.

**Setup.** Detached worktree at `3e8092d`, `docs/phase-7/gate/runs/2026-09-06T15-28-46-624Z`,
label `7.5 final gate at 3e8092d (G18+G33+G19 closed)`, invoked as
`pnpm gate:all -- --bench all --probes --issues`. The bare `pnpm gate:all` defaults
are `--bench paired` and no probes stage: 10 bench cells and no probe evidence.
Those defaults do not run the 7.5 gate, and any run that used them is not the gate.
`tree-hash` reads `3e8092d… dirty`; the dirt is the gate's own output
(`bench/results/`, `qa/gate/latest/`, `docs/phase-7/gate/`) and nothing else —
`git status` filtered of those three prefixes is empty, so no source file differed
from the commit.

**Result.** All six stages exit ok in 67m44s: checks 20.7s, qa 2m54s, probes 19m38s,
bench 44m39s, bundle 11.9s, summary 40ms. 67 issues, all of them classifications of
already-stamped conditions.

- **checks** — tsc 0, oxlint `{"problems":0,"errors":0,"warnings":0}` against a floor of 0,
  bench-tsc 0, build ok, unit `{"pass":182,"fail":0}`, census `{"total":21,"files":12,"failures":0}`,
  bundle-gate exit 1 `{"ok":13,"fail":30}`.
- **qa** — 43 runs / 190 cells, gateFail 1, ruled 3, harnessFail 4, outOfRange 36,
  tooltipFailures 0, errors 0.
- **probes** — `{"hover-lag":4,"legend-hover-dim":4,"bardepth-toggle":0,"no-rereveal":0}`,
  errors 0. Cell for cell the same as the recorded 7.5 gate: the sizing fix moved no probe.
- **bench** — 29 cells, 0 skipped, 8 flagged at ±20%, consoleErrors 0, tooltipMissing 0,
  failedInvocations 0.
- **bundle** — 43 pinned, 30 FAIL, 0 missing, Σgzip 6,594,929 vs Σpin 5,605,143 (+17.66%),
  ratioOver 41/43, worst `migrated/sunburst` 1.608.

**The one unruled QA cell is a parallelism flake, and it does not get a ruling.**
`arealoading/1000 hover-50` read 24,407 px against history `[378, 3683]`. Re-run
isolated in the same worktree, `node qa/screenshot.mjs --chart arealoading --n 1000`:
settled 0.0754%, hover-30 0.0729%, **hover-50 0.0445%** (≈427 px), hover-70 0.0505%
— overall PASS, and the hover-50 value lands inside the history it "failed". Under
four workers the loading pulse is captured at a different animation phase; this is
the same class as the `choropleth/100` flake re-verified earlier this window, and the
same physics D498 stamped for `barloading`. It is *not* the same disposition. The
`barloading` rulings in `qa/gate/rulings.json` exist because those cells fail
*consistently*, at a stable magnitude, with no isolated-run that passes. `arealoading`
passes isolated. Adding a bound of 24,407 to a cell that normally reads ~400 px would
blind the gate to a two-order-of-magnitude regression on that cell forever, to buy a
cosmetically clean verdict for one run. Under principle 5 the evidence is the isolated
re-run, not the bound. No ruling is added; the standing defect is the harness — loading
cells should not be scheduled against three siblings — and that belongs to the QA
harness, not to the parity claims.

So the QA verdict for this gate reads: **gateFail 1, of which 0 are parity defects
and 0 are unexplained** — three ruled (radar/6 D535, sankey/33 D498, barloading/100
D498) plus one demonstrated harness flake.

**The checks stage's bundle verdict moved without the tree moving, and that is an
ordering artifact.** In the recorded gate the checks stage reported bundle-gate ok;
here it reports exit 1, 30 FAIL. Nothing regressed between the two. `scripts/bundle-gate.mjs`
compares `bench/results/bundle-sizes.json` against the pins in `bench/results/bundle-gate.json`,
and `bundle-sizes.json` is a *working file the bundle stage rewrites*, not an input —
`git status` in the gate worktree lists it as modified after every run. Stage order in
`qa/gate/run-all.mjs` is checks → qa → probes → bench → bundle → summary, so the checks
stage always reads whatever the *previous* run left behind. In the recorded gate that
was the git-tracked, pre-V3.9, Sep-5 file whose values match its own pins by construction,
so checks read ok; the bundle stage then re-measured and read 30 FAIL. Here a prior run
in the same worktree had already left real measurements, so checks read the 30 FAIL up
front. One fact, two pipeline positions. The fact is D585's, unchanged and already
stamped: the pins are pre-V3.9 and re-pinning is a formal adoption owed its own D-entry.
The honest statement of this gate's checks stage is therefore "tsc, lint, bench-tsc,
build, unit and census all clean; bundle-gate fails against stale pins per D585" — not
"checks all ok". A gate whose verdict depends on which run went before it is a defect in
the gate; it is recorded here rather than fixed, because fixing it means re-pinning, and
re-pinning is the adoption D585 deferred.

**Disposition.** The 7.5 gate has run at `3e8092d` with the correct flags. Every failing
cell in it is a stamped condition (D498, D535, D585) or a demonstrated harness flake.
No new parity defect, in any of the 190 QA cells, 4 probe suites, 29 bench cells or the
census, is attributable to the code that changed since the recorded gate.

## D589 — The virtual-clock probe rewrite: the pie stall was arithmetic, the "lost latency" was harness noise, and a stable flag count hid a changed finding

**The stall.** The virtual-clock probe rewrite left one hard error: `openScene …chart=pie&n=1000
never settled after 20000 virtual ms (armed=true settled=false paint=true)`. The cause is
arithmetic, not the fake clock. Pie has no `onPhaseChange`, so `bench/app/src/scenarios/bklit-pie.tsx:31-36`
arms a *manual* settle timer sized from the source stagger: `pieSettleMs(1000) = 100 + 999*80 + 1100
= 81120`, plus a 250ms reveal margin = **81370ms**, and `armManualSettle(settleMs + 3000)` = **84370ms**.
`settle.ts:150-161` takes the caller's fallback — the shared `FALLBACK_MS = 2500` at `settle.ts:25`
applies only to the `armBklitSettle`/`armTanstackSettle` cartesian arms and never to pie. Against a
20000ms cap neither the real timer nor its fallback can fire. `paint=true` was honest (double-rAF,
driven by the fake clock); only the settle signal was out of reach. The fix is a per-chart cap
override in `qa/gate/probes/lib-probe.mjs` (`SETTLE_CAP_OVERRIDE`), not a shorter reveal: shortening
it would hover mid-stagger and measure a chart that is still animating.

**Two corrections to the record, both mine.** First, `stepVirtual` does not "seek animations to
completion" — it advances `clock.runFor(ms)` and adds exactly `ms` to each paused player
(`lib-probe.mjs:107-119`). Second, the failing run produced **no hover-lag rows at all** (the probe
threw), so the comparison of "27–371ms collapsing to exactly 16" was drawn from legend-hover-dim
alone and did not describe hover-lag.

**The latency reading was wrong, and the evidence overturned it.** The hypothesis was that virtual
time destroys latency assertions. It does not. With the cap fixed, hover-lag reproduces the
wall-clock baseline (`…15-28-46-624Z`) row for row: the same 4 flags on the same cells
(bar `settles-after-700ms-capture`; pie, sankey, liveline `dim-presence-mismatch`), the same dimmed
counts on 12 of 13 rows, and first-dim latencies in the same 54–203ms band with no quantization —
because hover-lag times *inside the page* on rAF against a faked `performance.now()`
(`installSampler`, `lib-probe.mjs:132`). legend-hover-dim's `16`s come from its Node-side poll, and
under a fake clock rAF is 16ms-quantized by construction. The old 41/92/114/253/371 were frame
boundaries dithered by evaluate round-trip and compositor lag — they measured the harness, not the
chart. No sampler port is owed: the `>300ms` band still fires where a real difference exists
(markers 288 vs 112) and stops firing on noise (barsquares 371-vs-119 became 16-vs-16). The
`bklit does not fully undim` entries that vanished on legendhover and barsquares were false
positives from sampling an unfinished undim, and legend-hover-dim is now byte-identical across runs.

**Residual, recorded not fixed.** hover-lag is not fully deterministic: candlestick bklit `finalDim`
read 0 in `…23-24-39-356Z` and 999 in `…23-26-15-000Z` (baseline 999), across `repeats: 3` medians.
This is the wall leak `stepVirtual` documents at `lib-probe.mjs:101-106` — the real ms between an
animation's start and the next sweep. It moved no flag in either run.

**Cost.** 61.6s against 19m38s, errors 1 → 0. hover-lag alone 38.6s against 1049s.

**The near-miss, and the fix it earned.** Across the two broken runs the printed flag *counts* were
`legend-hover-dim: 4` and `4` while the flags underneath changed materially. The gate summary reports
counts, and `mergeLedger` in `qa/gate/summarize.mjs` did `cur.cells = esc(...)` — silently
overwriting the previous content and stamping `open (last seen <run>)`. An issue id could survive
every run while every finding under it changed, and the ledger diff showed nothing. Only a manual
diff of the two probe tables caught it. `mergeLedger` now emits
`open, CONTENT CHANGED in <run> (was: …)` when an open row's content moves. A count is not a finding.

## D590 — The migrated BarPulse wave never animates: a parked rect where bklit sweeps a 2.4s loop

**Found while landing P2's phase-freeze hook, not by the gate.** `__qaSetBarPulsePhase` was added to
`bench/app/src/scenarios/bklit-bardepth.tsx` so `qa/screenshot.mjs` could capture the sweep at fixed
phases. The migrated twin has no such hook, so the capture skips that side
(`qa/screenshot.mjs:1047-1067` guard) and no comparison is ever made — the vector is one-sided as it
stands. Tracing why the hook was never wired on migrated turned up the reason: **there is nothing to
seek.**

**Static reading.** `showcase/migrated/charts/internal/bar-pulse-mark.ts:189` emits the wave node with
the comment "Wave parked at sweep start (bar bottom); clipped + animated imperatively post-reveal."
No such code exists. Nothing in `showcase/migrated/charts/` references the `bkm-chart__bar-pulse`
group class or the `${id}:wave` node key outside the file that emits them.

**Runtime proof** (`bardepth`, `n=24`, both impls, pulse unpaused via `__qaSetBarPulsePaused(false)`,
sampled 900ms apart):

- bklit — group `bar-pulse` present, rect filled `url(#bar-pulse-grad-…)`, and it moves:
  `transform: translateY(378.027px)` -> `translateY(56.1702px)`. 1 of 74 rects changed.
- migrated — group `bkm-chart__bar-pulse` present, rect filled `url(#…-bar-pulse-wave-gr…)`,
  **0 of 49 rects changed.** The wave is rendered and never moves.

So the geometry, the gradient, the clip source and the group all port correctly; only the motion is
missing. `bardepth-toggle` reports 0 flags because it compares element counts and toggle-driven
geometry, never the wave's travel — the pulse's one observable behaviour is unguarded by any probe or
QA cell.

**Method note worth keeping.** bklit drives the wave through `style: transform: translateY(...)`, not
the `y` attribute. Two diagnostic passes that sampled SVG attributes only (`y`/`height`) reported
"no movement" for *both* impls and would have cleared the defect. An attribute-only probe cannot see
this animation; the third pass sampled `style` and separated them immediately.

**Disposition.** Recorded, not fixed. Implementing it is its own vector and re-opens exactly the
ownership question D589's sibling settled for the line-loading pulse: whether the sweep can be
renderer-owned or needs a React-owned exception. P2's bklit-side hook lands as-is — it is correct work
and it is the instrument that exposed this — but the phase-freeze capture stays one-sided and must not
be read as parity evidence until the migrated wave moves.

## D591 — The loading-phase vector does not fix D588: neither half reaches the animation it targets

Two mechanisms were written to make the `arealoading`/`barloading` captures deterministic and kill the
D588 flake (arealoading/1000 hover-50: 427px isolated vs 24,407px in-gate, same code, same build).
Run at runtime for the first time, **both fail on their own terms.**

**The virtual-time budget wedges.** `Emulation.setVirtualTimePolicy` with
`PRESET_VIRTUAL_BUDGET_MS = 30000` is installed before `goto` so both engines share one timeline. But
once a virtual budget expires, rAF halts permanently — so if paint has not landed by then, it never
will, `__benchPaintDone` is never set, and the wait at `qa/screenshot.mjs:397` burns its full 30s
timeout. `arealoading --self-test` reproduces it every run:
`page.waitForFunction: Timeout 30000ms exceeded`. The code's own comment predicted this exact wedge
("a pre-paint expiry would wedge the paint wait below into its 30s timeout — loud, not silent"); the
budget is simply mis-sized, and sizing it correctly is guesswork against module-load virtual burn.

**The phase pin has nothing to pin.** `pinAnimationPhase` seeks every infinite-iteration player from
`document.getAnimations()`. Self-test reports `pinned 0/0` for **both** impls on both loading presets —
bklit *and* migrated, settled and all three hover captures. The reason is structural: bklit drives its
loading loop through motion's JS rAF frameloop on SVG, and migrated now drives its own through the
TanStack reconciler's rAF (`reconcileChartSvgFragment`). Neither is a CSS Animation, CSS Transition or
WAAPI player, so `getAnimations()` returns an empty set and there is nothing to seek or pause. The
premise that the migrated side runs `ts-bkm-loading-pulse 1.6s` CSS keyframes is stale — V3.9 moved it.

**Consequence for the four `pulse-phase-*` cells.** With nothing pinned they would not be four sampled
phases; they would be four more *phase-random* captures, added to the one chart already known to flake
under gate load. They are gated off with the rest of the vector behind
`QA_LOADING_PHASE_VECTOR=1` rather than fed to the gate.

**What stays on, deliberately.** The settled and hover `pinAnimationPhase` calls remain live for the
two loading presets. They add no cells and no flake, they pin nothing today, and their
`phase pin incomplete (pinned 0/0)` warning is the signal that found this — it now fires on every run
for as long as D588 is unfixed. Loud, not silent, and not suppressed just because it is inconvenient.

**Disposition.** D588 stands unfixed. A working fix has to reach a JS-rAF loop, which means either a
per-impl hook (the `__qaSetBarPulsePhase` precedent, and note D590 — the migrated side may have no loop
to hook) or a clock the rAF driver itself honours (`page.clock` + manual timing, as the probes now do).
The self-tests pass on a quiet machine either way, so a green self-test must not be read as evidence
the flake is gone.

## D592 — The line loading pulse lands; three corrections to the first cut

`loadingStyle` on `LineChartLoading` / `AreaChartLoading` was accepted-but-inert:
both values rendered the R10 sweep paint. It now routes as bklit does — `"pulse"` (default)
draws the traveling pulse over a transparent anchor series, `"sweep"` keeps the shimmer. The
pulse clip window is driven by `reconcileChartSvgFragment` on a keyed rect inside a `clipPath`,
with React owning only the cycle boundary; the geometry is a pure port in
`internal/line-loading-pulse-window.ts` so `qa/unit` can assert it headlessly.

Three divergences from bklit were found while verifying the first cut and are fixed here.

**1. The easing was applied over the wrong domain — the pulse was ~7x too wide a quarter into
the cycle.** Bklit runs ONE `animate(progress, 1, { duration: CYCLE, ease })` across the whole
loop and derives a piecewise-linear geometry from that single value
(`line-loading-pulse.tsx:54-72,99-105`). The port split the cycle into two reconciler segments
and gave each the plain `bezierEasing` — restarting the curve at the midpoint. At t = cycle/4
bklit's clip is at `e(0.25)/0.5 ≈ 0.07` of full width; the first cut sat at `e(0.5) = 0.5`. The
endpoints agreed, so nothing downstream noticed. Fixed with composed per-segment eases
(`u => e(u/2)/0.5` and `u => (e(0.5 + u/2) - 0.5)/0.5`), which reproduce bklit exactly because
cubic-bezier(.85,0,.15,1) is symmetric and eased progress therefore crosses 0.5 at the midpoint.
`enter` and `exit` keep the plain ease — bklit issues a fresh `animate` for each, so those legs
genuinely do restart the curve. The distinction is per-mode, not global.

**2. `mode="exit"` restarted the pass at zero width.** Bklit reads the live `progress.get()` and
finishes from there, shortening the remaining legs in proportion (`:112-134`). The first cut
returned the loop segments from 0, so an exit re-opened a clip the viewer had just watched close.
`LineLoadingPulseStroke` is a public export (`index.ts:266`) with `mode` in its props, so "no
in-repo caller switches mid-flight" does not cover it. Now tracked via the running leg's start
timestamp, resolved inside the effect — `performance.now()` in a `useMemo` is a render-purity
violation and oxlint says so.

**3. The fade gradient stroke was dropped.** Bklit strokes the pulse path with
`url(#gradient)` — a viewport fade with 0/15/85/100 stops — so the pass dissolves at the plot
edges (`:189-208`). The port stroked a flat colour. Restored using the already-ported
`fade-mask.ts` helpers, offset by the plot origin because this overlay draws in scene coordinates
rather than bklit's plot-local group.

**The spike test asserted the defect.** `qa/unit/line-loading-pulse-reconcile.test.mjs` compared
each frame against `pulseClipWindow(eased/2)` — the per-half reading, i.e. the bug restated as the
expectation. It now checks every reconciled frame against
`pulseClipWindow(bezierEasing(t / PULSE_CYCLE_MS))`, the only reference bklit's own code supports,
plus a guard that the per-half ease diverges by more than 3x and an exit-resumption case. A test
derived from the implementation cannot falsify it; this one now comes from the legacy source.

**Not changed, deliberately.** `internal/line-loading-pulse.tsx` had its reduced-motion guard
stripped in the first cut. That component is dead — nothing imports it, only the
`LineLoadingPulseMode` type travels through `loading-chrome.ts`, and it is absent from `index.ts`
— and its bklit analogue is the sweep (`loading-sweep.tsx:218,437`), which *does* honour
`useReducedMotion`. Reverted rather than argued. Its deletion is a separate vector; see item 10.

The pulse itself ignores `prefers-reduced-motion`, matching bklit, whose
`LineLoadingPulseStroke` is the one component in that family without the guard. That asymmetry is
the drafted upstream issue and stays a legacy-fidelity match here, not a local fix.

Verification: tsc clean; oxlint back to the HEAD baseline of 137 (all pre-existing, all in
`oxlint-plugins/comments.js`), `migrated/charts` clean; `pnpm test` 246 tests / 48 suites /
188 pass / 0 fail / 58 todo (was 244/186 — the two new cases). No gate cell guards the new pulse
pixels yet; that gap is unchanged and still open.

## D593 — The 7.5 gate on `4ee2ef6`: one real regression, everything else pre-existing

The full gate ran green-exit (47m44s, run `2026-09-06T23-56-04-812Z`, all stages ok) and reported
58 issues. Attributing them, not reading the headline:

**New, and a real defect — `arealoading/1000`, all four cells.** 24836 / 25142 / 24863 / 24984 px
against a historical mode of 228–630. A systematic shift across every cell of one chart is not the
single-cell signature a flake leaves, and `arealoading` is exactly what the pulse vector touched.
The diff image settled it: migrated drew the full skeleton area — silhouette, stroke and gradient
wash — where bklit draws a near-blank placeholder. Cause: `area-chart-loading.tsx` handed
`washColor: stroke` to *both* branches. While `loadingStyle` was inert every render was a sweep,
and the sweep's CSS mask hid the wash down to a shimmer band; routing `"pulse"` for real removed
the mask and left the wash painting at full opacity. Bklit's pulse area is
`fill="transparent" fillOpacity={0}` (`area-chart-loading.tsx:99-100`) — no wash at all. Fixed by
passing `washColor: "transparent"` on the pulse branch. Re-shot: settled 0.1040%, hover-30 0.1355%,
hover-50 0.1068%, hover-70 0.1196% — all PASS against the 0.5% gate, and the residual diff is the
pulse stroke at two unpinnable phases (D588/D591), not geometry. `line-chart-loading.tsx` was never
affected: `buildLineLoadingDefinition` has no wash.

**New, and mine, but not a defect — census FAIL(1).** `reach-in-guard` flagged
`internal/loading-entries.tsx: 2 site(s) — file is not in the ledger`. Neither site is a DOM query;
both are the `data-ts-key` attribute the package's own reconciler matches on, one on the
React-rendered rect and one in the reconciled fragment. The guard's pattern catches `data-ts-key`
as an addressing signal, which is right — the ledger is the place to record it, so
`scripts/reach-in-ledger.json` gains the file at `max: 2` citing this entry. Guard back to OK,
23 sites / 13 files, no pin exceeded.

**Not attributable — the other seven QA failures.** `radar/6/hover-50` 6452 (hist 755–6547),
`sankey/33/hover-30` 9987 (hist 3302–31888), `barloading/100/settled` 21785 and `hover-70` 10735
(hist 0–51852 and 0–164456, bimodal). Every one lands inside its own recorded range;
`bar-chart-loading.tsx` is not in `4ee2ef6`'s diffstat at all. These are D588/D590, unchanged.

**Not attributable — 30 bundle FAILs.** Row-for-row identical to `2026-09-06T15-28-46-624Z`: same
30 scenarios, same verdicts, same `maxDelta` (`migrated/barloading +3323.32%`). Only `sumGzip`
moves, by 2621 bytes — the pulse module and its call sites. Σ 17.66% → 17.71%.

**Not attributable — the `migrated/line/1000` 30m19s bench outlier.** Six of eight runs took
~10.9s; runs 5 and 8 took 939102ms and 814159ms. The in-page measurements are unmoved from the
previous gate (m1a 53.3 → 52.5, m1b 1163.1 → 1162.7, m1c script 109.6 → 109.84, m3c per-move
23.17 → 23.2), so the stall sits outside the measured window — the harness lost the machine, not
the chart. Eight runs at the honest ~10.9s is 87s, which is what `migrated/area/1000` cost. No
code change indicated; noted so the next reader does not chase it.

Verification after the fix: tsc clean; oxlint 137, the exact HEAD baseline, `migrated/charts`
clean; reach-in-guard OK; `arealoading/1000` PASS on all four cells.

## D594 — A1–A4, A9 and A11: the gate instrument, fixed before it is trusted again

POST-PHASE-7 §7 says A1–A4 and A9 "are cheap and should land before Gate 1, so the first
measurement through the fixed instrument is not itself stale." Gate 1 ran first, at `4ee2ef6`.
This is that work, landing late; the run it should have preceded has to be repeated before its
bench and bundle numbers can be adopted by items 7 and 8.

**A1 — bench M2c read the previous run's bundle bytes.** `bench/run.mjs` loads
`bench/results/bundle-sizes.json` at module load for `m2c_bundleCost`, and `run-all.mjs` ran bench
at stage 4 while the bundle stage rewrites that file at stage 5. Every M2c cell was therefore
judged against the last run's bytes, silently — the D585 shape one stage later. The bundle stage
now runs before bench. Under `--bench-parallel` it cannot: bench has already started, and moving
104 esbuild bundles onto its CPU would trade a stale number for a corrupted one, so that path
keeps the old order (A5 owns the flag). Either way `bench/run.mjs` now records `m2cSource` — the
path, mtime and scenario count behind the column — so the ordering can never break silently again.

**A2 — the CSS column was never measured.** Nothing under `qa/gate/` invoked
`bench/measure-css.mjs`; `run-bundle.mjs` read `css-sizes.json` with a `null` fallback, so the
table was whatever file happened to be on disk. The bundle stage now measures CSS alongside the
bundles. This was not theoretical: running `measure-css.mjs` by hand moved **43 of 104 rows — every
migrated cell — by −1.8%** (Σ 89741 → 88150 gzip). The stale file predated `4ee2ef6`, whose
`styles.css` change never reached the column. 11.8s, 0 failed.

**A3 — `pnpm gate:bundle` exited 0 with holes in the table.** The exit expression covered
`gateExit`, `fail` and `ratioOver` only; `summary.missing` and `summary.measureFailed` never
reached it, so a run that measured nothing reported green standalone. Both now count, and so does
a non-zero `measureExit` or the new `cssMeasureExit` — if the measurement failed, the bytes behind
every row are unknown, which is not a pass.

**A4 — `--skip-checks` gave bench and probes an unknown dist.** `noBuild: true` asserts "checks
already built dist". With checks skipped nothing built it, and the assertion skipped the freshness
check too. The flag is now `!opts.skipChecks`, so when checks do not run the consuming stages test
staleness themselves. QA was already correct — it honours its own `--no-build` and rebuilds when
stale — and is unchanged.

**A9 — unparsable lint output passed.** `summarizeOxlint` returns `{parseError: true}`, leaving
`errs`, `warns` and `files` all `null`; the floor comparison short-circuits and the `files === 0`
guard cannot fire on `null`. That is precisely the green-for-the-wrong-reason mode that guard was
written to close, one branch over. Output we cannot read is now a failure, logged as
`FAIL (unparsable lint output)`.

**A11 — a ruling wide enough to blind its cell.** `barloading/100/hover-30` is ruled under
161,310 px, 16.8% of the viewport: the cell cannot fail. §7 asks for a D-entry rather than a patch,
so this is the disposition, and it is a correction, not a ratification. The existing note claims
"animation phase, not a regression". That is unproven and probably wrong — D590 records that the
migrated `BarPulse` wave renders but never animates, a live defect against the phase's first claim
that a bound this wide would hide completely. Removing the bound is not the answer either: D591
established that neither impl's loading loop is a WAAPI or CSS player, so `pinAnimationPhase`
reports `pinned 0/0` and the phase genuinely cannot be fixed at capture time. An unrulable cell
failing every run teaches readers to skip it, which is the same blindness by a different route.

So the three barloading bounds stand, re-cited to D591 for why they exist and to D590 for what they
are currently masking, and **they expire when D590 lands** rather than standing as accepted
deviations. That makes the mask temporary and names its owner, which is what D588 asked for when it
refused a 24,407 px bound for `arealoading`.

Not touched here: A5–A8, A10, A12, A13. A5 (`--bench-parallel` runs bench beside QA under a
re-entrant lock) is the one that matters most of those, and it is a behaviour change to a flag
rather than a cheap correction.

## D595 — The 7.6 gate through the fixed instrument: one misattribution corrected, one cell recovered

The re-run D594 said had to happen. `pnpm gate:all -- --bench all --probes --issues` at `30c0e1a`,
49m42s, exit 0, all stages green: checks 29.4s, qa 3m08s, probes 63.2s, bundle 24.3s, bench 44m37s.
**52 issues, against 58 at `4ee2ef6`.** Run: `docs/phase-7/gate/runs/2026-09-07T09-01-26-415Z/`.

**A1 and A2 verified in flight, not just in review.** `latest.json` carries
`m2cSource.mtime = 09:06:19.904Z` — the bundle measurement from *this* run, read by a bench that
started at 09:06:32. The stage order is now proven by the artefact rather than by the source. The
bundle record carries `cssMeasured: true`, `cssMeasureExit: 0`, 43 CSS rows.

**Ten issues resolved.** `qa:arealoading/1000:motion/reveal` — the D593 wash fix, confirmed at gate
level. `census` — the D593 ledger entry. And eight QA cells (sunburst ×3, scatter ×2, radar, brush,
sankey) that D593 filed as "pre-existing, within historical range" **did not reproduce**. That
upgrades the D593 verdict: they were not standing deviations, they were flake, and the record should
say so.

**The correction.** D593 attributed `migrated/scatter/1000` m1b to the D588 harness signature —
"the harness lost the machine, not the chart." That was wrong. It reproduces:

| | m1b settle |
|---|---|
| bklit/scatter/1000 (same run, same machine) | 1266.3 |
| migrated/scatter/1000 | **2505.3** |

1.98× the legacy control, with `p95` 2506 against a value of 2505.3 over 7 samples. A harness that
has lost the machine produces spread; this is deterministic. It ran +99.0% in the 23-56 run and
+99.1% here, two independent runs agreeing to a tenth of a point. The in-run controls settle the
question the stale baseline could not: `migrated/line/1000` is 1163.7 against bklit's 1157.7
(+0.5%) and `migrated/area/1000` is 1173.6 against 1160.0 (+1.2%) — parity. Only scatter doubles,
and 2505 is almost exactly twice the ~1250ms reveal every other cell shows, which reads as scatter
revealing twice. **Item 7 must not adopt this cell's m1b**: pinning 2505 as the new baseline would
enshrine a 2× regression, which is the precise failure the D594 sequencing argument exists to
prevent. Held, and the flag stands until the double reveal is found.

**Four new issues, none of them a chart defect.** Two are bench cells that got *faster* than the
phase-5 baseline (`bklit/line/10000` m1c −20.1%, `tanstack/scatter/1000` m1b −35.4%) — stale-baseline
artefacts, item 7's territory. Two are `out-of-range` **low**: `candlestick/1000` hover-30 at 1662 px
against a 58-run floor of 1675, and `ring/4` hover-30/50 likewise just under. These are the best
those cells have ever measured; the band check is two-sided, so a new best trips it. Worth knowing,
not worth fixing.

**Candlestick's probe flag is structural.** `probe:hover-lag:candlestick/1000` is new
(`tooltip-lag>200ms`: bklit 67ms, migrated 270ms). The same row shows migrated dimming **2998**
elements where bklit dims **999** — exactly 3×, migrated giving body and two wicks separate
dimmable nodes where bklit dims one group. Dimming 3× the nodes is a sufficient explanation for a
4× tooltip lag, and the probes ran before bench so the machine was quiet. Not noise; a composition
difference with a measurable cost.

**A14 — an asymmetric capture destroyed a whole QA cell.** `bardepth/100` produced no report at
all: `TypeError: Cannot read properties of undefined (reading 'buffer')` at `qa/screenshot.mjs:1144`.
The hover loop indexes `capA.hovers` and assumes `capB` matches. It no longer does —
`bench/app/src/scenarios/bklit-bardepth.tsx:67` now wires `__qaSetBarPulsePhase`, so bklit captures
four extra `pulse-phase-*` frames and migrated captures none, **because its BarPulse never animates
(D590) and there is no phase to seek**. The comment at the capture site still claimed the hook was
"NOT implemented on EITHER scenario side"; that premise went stale when bklit wired it, which is
why no guard was ever written. D590 had quietly taken out the one QA cell able to observe it.

Fixed the way the file already handles this class — collect, then fold into `overallPass`, as
`tooltipFailures` does. The cell now yields data instead of an exception:

    bklit=9 migrated=5; comparing 5 paired state(s), 4 unpaired
      settled  PASS 0.0000%   hover-30/50/70, depth-off, depth-on  PASS 0.15-0.22%
    overall: FAIL

Six comparisons recovered, `settled` pixel-perfect, and the report still fails because four states
are unmeasured. An asymmetric capture is not a pass — the same rule A3 applied to the bundle stage.

Standing after this run: 30 bundle pins (item 8) and 7 of 9 bench flags (item 7) are stale-instrument
debt, not defects. The live defects are the scatter double reveal, D590, and the candlestick dim
fan-out.

## D596 — Items 7 and 8: the baseline and the pins adopted, with one cell held back

POST-PHASE-7 items 7 and 8, taken together from the 7.6 run
(`docs/phase-7/gate/runs/2026-09-07T09-01-26-415Z`) because they are one question: what does this
tree actually cost, measured through an instrument that works. D594 established the ordering —
adopting numbers from a stale instrument would enshrine the defect — and D595 supplied the run.

**Item 8 — 43 pins, all 43 moved. Bundle gate 30 FAIL → 0**, `sumDeltaPct` 17.71 → 0. The old pins
were stamped 2026-09-05 at `61d6179`, before V3.9; every migrated scenario had drifted past its
3% tolerance. One pin was never valid rather than merely stale: `migrated/barloading` was pinned at
**2449 bytes**, which is not a bundle. That scenario's measurement was broken when the pins were
stamped, and the row read as passing only because nothing can be smaller than it. It is 83837 now.

`ratioOver` stays at **41 of 43**. Re-pinning deliberately does not touch the ≤1.10 parity limit —
that is item 9, a separate claim, and a re-pin that had quietly moved it would have been a re-pin
that concealed it.

**Item 7 — 30 cells adopted, two not from this run.** `bklit/composed/1000` was not in the run's
cell set and keeps its phase-5 §3b medians. And `migrated/scatter/1000.m1b_settleMs` is **held** at
1258.6 though the run measured 2505.3, for the reason D595 gives: 1.98× the same-run bklit control,
p95 2506 over 7 samples, reproduced across two independent runs. Adopting it would pin the defect
as the expectation and silence the only flag pointing at it. Recomputing the gate against the new
baseline gives the intended shape:

    gated flags: 9 -> 1   (the survivor is migrated/scatter/1000 m1b, +99.1%)

The hold expires when the scatter double reveal is found.

**One reading note recorded in the baseline's own `note`.** Every control cell — bklit and tanstack
alike, all four families — rose 11–19% on `m1c_scriptMs` between the phase-5 run and this one. That
is a uniform machine/browser shift, not a chart change, so migrated's +36–47% is roughly +25–35%
net of it. The raw deltas overstate the gap and a later reader would otherwise draw the wrong
conclusion from them.

Both files carry hand-written provenance rather than generated prose: a `note` and a `pinnedAt` that
still described the old source would make the artefact lie about where its numbers came from, which
is the same failure mode as a stale measurement.

## D597 — Item 9: the ≤1.10 bundle target is not reachable at 0.16.0, and the reason is upstream

POST-PHASE-7 §5 asks item 9 for "the surviving over-1.10 count, whatever it is, against re-pinned
values — a measured number, not a target." Against D596's pins that number is **41 of 43**,
unchanged from before the re-pin, which is the first thing worth stating: re-pinning moved every
one of the 43 pins and moved the parity count by zero. The two claims are independent, and the
gate keeps them that way.

**The Wave C audit premise was wrong, and the run already disproved it.** §3 expected "the 41/43
count drops sharply once the showcase stops pulling the package in twice", and made that the audit
four executors would wait on. G4 landed at `8d615fa`. The count is still 41. The audit was worth
running exactly as §3 argued; it just answers in the negative, and it did not need five agents.

**Where the bytes actually are.** From esbuild metafiles over all 104 scenario bundles
(`BUNDLE_METAFILE_DIR=`, opt-in and off by default so no gate run writes them), sunburst:

| bucket | bklit | migrated |
|---|---|---|
| chart layer | `bklit-ui` 134.8kB | `@tanstack/charts` 143.2kB |
| d3-* | — | **91.0kB** |
| adapter | — | `showcase/migrated` 43.7kB |
| shared | 106.3kB | 106.4kB |

The TanStack core is not the outlier — it is within 9kB of bklit's own chart layer. The excess is
d3, which bklit's sunburst does not pull at all.

**And most of that d3 is unconditional.** Pie, funnel and sunburst — three structurally unrelated
charts — emit an *identical* d3 payload; only the chart-specific pieces vary. The fixed part is
44.3kB min (~15.9kB gzip): `d3-selection` 12.4, `d3-transition` 10.7, `d3-brush` 8.9,
`d3-time-format` 8.8, plus dispatch/timer/drag. **A pie chart ships d3-brush and d3-time-format** —
it has neither a brush nor a time axis. The importer is the package: in `migrated-pie`,
`@tanstack/charts` is what pulls `d3-brush/src/index.js` and `d3-selection/src/index.js`. The
consuming code's own d3 imports are small, chart-specific, and several are `import type` with no
runtime cost.

**Which settles the disposition.** Four executors partitioned by chart family, as §3 planned, would
have been optimising `showcase/migrated` — 43.7kB of a 389kB bundle — against a cost they cannot
reach. Under principle 2 this is a stamped ruling and an upstream issue, not a second
implementation. Drafted as **I9** in `research/phase-7/07-upstream-issues.md`; **not filed**, because
I7 and I8 went out under items 2 and 3, which gate them on the owner's GitHub account, and item 9
is gated "phase 8" instead. That is the owner's call, not mine to take on their behalf.

**The ruling.** ≤1.10 is unreachable at 0.16.0 and should not be carried as an open target. Removing
the entire unconditional tail still leaves funnel 1.411 → 1.236, pie 1.358 → 1.194, sunburst
1.608 → 1.427. No arrangement of the consuming code closes a gap that survives deleting the largest
upstream defect. Item 9 is therefore **done as specified** — the count is measured and reported
against re-pinned values — and the target itself is stamped unreachable pending upstream
granularity. What replaces it is the parity ratio as a *recorded* number that must not silently
grow, which is what `ratioOver` already does.

---

### D598 — Gate 2 caught two defects in my own item 7 adoption; both repaired

Gate 2 (`docs/phase-7/gate/runs/2026-09-07T10-05-45-465Z`) was run to check the item 7/8
adoption rather than to go green. It did its job: three of its sixteen issues were mine, and a
fourth reading exposed a methodological error behind three more.

**(a) The adoption deleted three baseline keys.** `wave-b-adopt.mjs` rebuilt each cell by walking
`[...gatedMetrics, ...informationalMetrics]`. That is not the cell key set: `consoleErrorCount` and
`m3c_tooltipAppeared` live in cells and in neither list. Rebuilding from METRICS alone dropped
`bklit/bar/1000.consoleErrorCount` (514742), `bklit/bar/10000.consoleErrorCount` (1540000) and
`bklit/line/1000.m3c_tooltipAppeared` (false) — three key-instances — which then re-flagged against
an implicit 0/true. The `note` describing these special cases survived; the data it described did
not. This is the failure D596 named, inverted: *"a `note` that still described the old source would
make the artefact lie about where its numbers came from."* Restored from `c7d52d0~1`, keeping the
**old** `consoleErrorCount` values rather than the measured 503196, because the note documents them
as inherited-legacy ceilings gated on increase only (D500), so the higher figure is the
intent-preserving one. `wave-b-adopt.mjs` now carries forward every key present in the old cell that
METRICS does not cover, so the class cannot recur.

**(b) Three cells were adopted from a single run when a single run cannot describe them.** Across
the phase-5, 7.6 and Gate 2 observations, three of 87 gated cell/metric pairs move by more than the
±20% flag band: `tanstack/scatter/1000` m1b (152 / 98.2 / 153.8, spread 56.6%), `tanstack/bar/100`
m1b (48.8 / 52.2 / 38.5, 26.2%), `tanstack/scatter/1000` m1c (117.78 / 101.27 / 125.76, 24.2%).
Pinning either extreme guarantees a false flag on the next run. All three now carry the **median** of
the three observations, which in each case is the phase-5 value — phase-5 was itself median-derived.
The `note` says so, and says which three.

**Residual, deliberately not tuned away.** With medians in place each run still flags one of these
cells (7.6: `tanstack/scatter/1000` m1b −35.4%; Gate 2: `tanstack/bar/100` m1b −21.1%). That is not
a defect in the baseline, it is the cells reporting honestly that their spread exceeds a ±20% band.
`flagPct` is global, so there is no per-cell widening available and inventing one is a second
implementation. Both are `tanstack/*` harness controls, not `migrated/*`, so neither touches a
parity claim.

**Verification** is offline recomputation against both run artefacts, not a re-bench — the repair
changes baseline values only, and both runs' `bench.json` are on disk. Gated bench issues with the
repaired baseline: 7.6 run 2, Gate 2 run 2 (from 7). The three key-drop issues are gone from both.
`migrated/scatter/1000` m1b still flags +99.1% / +99.0% in the two runs, which is the held cell doing
exactly what the hold was for.

---

### D599 — the scatter +99% is a phase-ordering defect, not a slow chart; my own magnitude claim was wrong

Executor `ses_f84779d9dffeOe5x6LLNA4Igbt` (one file, `internal/scatter-reveal-setup.ts`, +28/−8).
I gave it the double-reveal hypothesis as a lead and told it to disprove it if the evidence said
otherwise. It did.

**Mechanism.** `handleRender` called `setPhase("ready")` synchronously on the first render. That
render runs inside the package controller's *layout* effect (`react/Chart.tsx` creates the
controller in `useLayoutEffect`; `core/controller.ts` calls `onRender` from the initial
`performRender`), which flushes before the wrapper's *passive* mount effect that emits
`onPhaseChange("revealing")`. The bench arm `armBklitSettle` resolves on a `ready` that follows a
non-ready, so it saw `ready` first (ignored, `sawNonReady` false), then `revealing`, then nothing —
and `window.__benchSettled` fell through to `FALLBACK_MS`.

**`FALLBACK_MS` is 2500** (`bench/app/src/bench/settle.ts:25`), and its own comment says it "is not
expected to fire for any of the four pilot charts". The three observations were 2505.3, 2505.0,
2504.7 — a fixed timeout plus mount overhead. That is why they clustered within 0.6 ms, which I had
read as proof of a reproducible 2× slowdown.

**Correcting myself.** D595 corrected D593 from "the harness lost the machine" to "a real chart
defect". That direction was right and stands: the ordering bug is in `showcase/migrated`, it is not
machine noise, and every consumer passing `onPhaseChange` got `ready` before `revealing`. But the
**magnitude was never real**. There was no 2× reveal and no double reveal; there was a wasted
`ready` and a stopwatch left running into its safety net. "+99% slower" was my inference from a
number that was measuring the fallback, not the chart. The defect is a signalling defect with no
established performance cost.

**Fix.** Converge on the bar chart's bookkeeping (`bar-chart-overlays.ts`), which was already
correct: first sight of a reveal key records it, emits `revealing`, and arms
`revealDeadlineTimerRef` with `window.setTimeout(→ ready, revealDurationMs)`; same-key re-renders
early-return so later data swaps snap; a genuine signature bump re-opens exactly one window;
`animationDuration <= 0` resolves ready at once. No mark, scale, definition or motion code touched,
so settled pixels are unchanged by construction.

**Vector check (principle 4).** Confined to scatter. Of the eight `setPhase("ready")` sites, bar and
sunburst (`sunburst-chart.tsx:539`) already arm a deadline inside an effect; scatter was the only
one resolving synchronously from a render callback. Across all 29 benched cells only
`migrated/scatter/1000` sits at the fallback — `bklit/bar/10000` (7215) and `bklit/scatter/10000`
(3127.5) are genuinely slow large-*n* cells, not 2500.

**Lead-verified**: tsc 0, oxlint on `showcase/migrated` 0 findings, `npm test` 246 / 48 / 188 / 0 /
58, exit 0, `^not ok` 0 — the exact baseline. Not re-benched here; the item 7 hold on
`migrated/scatter/1000` m1b stays at 1258.6 until a serial gate run measures the cell, which is the
only thing that can retire it.

### D600 — BarPulse restored to bklit geometry: root-to-tip sweep, silhouette crop, negative bars

**Defect (D590).** The migrated BarPulse rendered a wave that did not move and did not match
bklit. Three separate faults, found by reading `showcase/repos/bklit-ui/.../charts/bar-depth.tsx`
(:1024-1075) as ground truth rather than by reasoning about the port:

1. **No motion.** The wave had no animation at all — the pulse-check probe measured
   `changed over 900ms after unpause: 0` for migrated against `1` for bklit.
2. **Amplitude ~3× short and direction wrong.** bklit sweeps root-to-tip across the full bar plus
   the wave height; the port swept a fixed short distance in the wrong direction.
3. **Crop missing.** bklit clips the wave to the bar silhouette (`clipPath`); the port let it paint
   outside the bar.

**Fix.** Geometry now derives exactly as bklit does:
`waveHeight = max(barHeight * PULSE_WAVE_HEIGHT_RATIO, PULSE_WAVE_HEIGHT_MIN_PX)`,
`yAboveLid = topY - perspectiveRise - waveHeight`, and the sweep runs floor→lid for positives,
lid→floor for negatives. `resolvePulseBarFrame` now derives `topY = min(baseline, valuePos)` /
`bottomY = max(...)` and carries `isNegative`. One helper (`resolveBarPulseSweep`) feeds **both**
the mark and the seam, so scene and CSS cannot drift apart.

**Motion is CSS keyframes, never WAAPI (G14).** `@keyframes ts-bkm-bar-pulse-sweep` runs
`translateY(0)` → `translateY(var(--bkm-bar-pulse-travel))`; `bar-chart.tsx` publishes
`--bkm-bar-pulse-travel` and `--bkm-bar-pulse-mask` on the chart root. The crop is a `<mask>` in
`resource-host.tsx` following the D570 precedent (explicit region per D559, white = keep).

**Behaviour change, stamped.** The guard `yValue <= 0` became `yValue === 0`. Negative bars
previously did not pulse at all; in bklit they do, sweeping lid→floor. This is a parity repair, not
a feature: the old guard was the reason the negative direction had never been exercised.

**Divergence, stamped (principle 2).** The `prefers-reduced-motion: reduce` block that stops the
sweep is a **deliberate divergence** — bklit's `bar-depth.tsx` has no reduced-motion handling. It is
kept because an infinite loop is exactly the motion that guard exists for, and bklit itself uses
`useReducedMotion` for the equivalent loop in `loading-sweep.tsx` (:218, :437), so this follows
bklit's own practice even where `bar-depth.tsx` forgot it. Ruled: keep, and do not "fix" it back.

**Known limit, not a defect.** `resolveBarPulseOverlay` returns the first rendering pulse's mask and
travel only, so a chart configuring several pulses gets one crop. No showcase chart does; recorded
here so the next reader does not mistake it for an oversight.

**New finding, separate vector — RETRACTED, see D602.** I wrote here that migrated's
`.ts-bkm-loading-sweep-band` has no reduced-motion guard while bklit's `loading-sweep.tsx` does, and
that migrated therefore drops an accessibility behaviour. **That is false.** I checked the CSS for an
`@media (prefers-reduced-motion)` block, found none, and stopped there without checking whether the
guarded node is rendered at all. It is not: see D602. No defect, nothing to fix.

**Process.** Two executors timed out on this item (2700s watchdog, ~90 min total) leaving unverified
edits with lint findings; I finished it as lead rather than dispatch a third time. The first
attempt's geometry was rejected outright after reading bklit.

**Lead-verified**: tsc 0, oxlint on `showcase/migrated` 0 findings, `npm test` 246 / 48 / 188 / 0 /
58, exit 0, `^not ok` 0 — the exact baseline. Pixel parity is **not** claimed here: an infinite
sweep is not settle-stable, so only a serial gate run with the phase-freeze hook can verify it.

### D601 — deleted the dead `LineLoadingPulse` component; one declaration for its mode type

**What it looked like.** `internal/line-loading-pulse.tsx` (113 lines) was on my list as "dead code to
delete". It was not dead as stated, and the correction matters: nothing imported the **component**
`LineLoadingPulse`, but `loading-chrome.ts:2` imported its **type** `LineLoadingPulseMode`, which
`index.ts:45` re-exports as public surface with an api-compat assertion behind it
(`qa/api-compat/all.ts:413`). Deleting the file naively would have broken a legacy export — exactly
the failure mode claim 2 (seamless swap) exists to prevent.

**Owned twice (principle 1).** `type LineLoadingPulseMode = "loop" | "exit" | "enter"` was declared
character-for-character in two files: the dead component (:24) and `loading-entries.tsx` (:232),
which hosts the *live* component `LineLoadingPulseStroke`. Two declarations of one public type is
the duplication the phase is meant to remove, not a harmless copy.

**Fix.** The type now lives in `loading-chrome.ts`, the module owning `resolveLineLoadingPulseMode`
— the function whose codomain it is — and which already re-exported it. `loading-entries.tsx`
imports it instead of redeclaring it; the dead component file is deleted. No import cycle:
`loading-entries.tsx` did not import `loading-chrome.ts` before this change, and `loading-chrome.ts`
does not import `loading-entries.tsx`.

**Not touched.** The comment at `qa/unit/line-loading-pulse-reconcile.test.mjs:238` cites
`line-loading-pulse.tsx:112-134` — that is **bklit's** file ("Bklit reads the live progress"), not
the deleted migrated one. Left alone. The phase-6/7 census entries flagging this file as "not in the
ledger" are historical records and stay as written.

**Lead-verified**: tsc 0, oxlint on `showcase/migrated` 0 findings, `npm test` 246 / 48 / 188 / 0 /
58, exit 0, `^not ok` 0. `npm run api-compat` gives byte-identical output before and after (9
pre-existing errors, all Sankey/unmigrated surface, none at the `LineLoadingPulse` assertions on
lines 157, 158, 413, 414) — the public type survived the move.

### D602 — retraction: the loading sweep's reduced-motion guard exists, in JS, not CSS

**Correcting my own D600 finding.** I recorded a "new finding, separate vector" in D600: that
`.ts-bkm-loading-sweep-band` animates `2s linear infinite` (`styles.css:696`) with no
`prefers-reduced-motion` block, while bklit's `loading-sweep.tsx` guards the same loop with
`useReducedMotion` (:218, :437) — concluding migrated had dropped an accessibility behaviour.

**Why it was wrong.** The guard is there; it is just not in the stylesheet. `LineLoadingSweep`
(`loading-entries.tsx:88`) and `BarLoadingSkeleton` (:182) both call `usePrefersReducedMotion()`, and
under reduced motion each returns `undefined` from **both** the `resources` memo (:122-127, :201-206)
and the `maskStyle` memo (:128-133, :207-212). So `LoadingSweepResources` is never mounted, the
`<rect className="ts-bkm-loading-sweep-band">` (`resource-host.tsx:128`) never exists, and the mask
referencing it is never applied. A CSS rule for a node that is not rendered has nothing to guard.

**This is stricter than bklit, not weaker.** bklit keeps the element and stops its motion; migrated
omits the element and its mask entirely. Same user-visible outcome for the motion itself, less work.

**Method note, which is the point of writing this down.** I searched the stylesheet for the guard,
found no `@media` block, and reported a defect. Absence of the mechanism I expected is not evidence
of absence of the behaviour — the render path decides what the stylesheet ever gets to apply to. The
same mistake would have been caught by asking "is this node rendered?" before "is this rule guarded?"

**No code changed.** D600's `prefers-reduced-motion` block for the BarPulse stays exactly as ruled
there: the pulse wave *is* rendered under reduced motion (it is part of the settled scene, not a
loading overlay), so it needs the CSS guard that the loading sweep does not.

### D603 — candlestick dim fans out 3x per candle; the engine cannot state a group, so it holds

**Measured.** `hover-lag` probe, candlestick n=1000 (run `2026-09-07T10-05-45-465Z`): bklit
`finalDim` 999, migrated `finalDim` 2998 — one dimmed element per candle against three, plus one.
Hover cost tracks it: bklit `dim` 167ms, migrated 265ms. The probe carries **no flag** for this pair,
so nothing is failing today; this is a fidelity and efficiency gap, recorded before it is forgotten.

**Why 3x.** bklit wraps each candle's wick and body in one `<g opacity>`
(`showcase/repos/bklit-ui/.../candlestick.tsx:209-223`) — one element carries the dim. Migrated emits
two marks, `wicks` and `bodies`, both carrying `candlestickDimStates`
(`candlestick-chart-marks.ts:85-95,237,296`), which under the default config is three leaves per
candle (upper wick, lower wick, body), each resolving the state and each running its own WAAPI
opacity tween per hover. The probe counts **computed** opacity per element over `rect,path,circle,g`
(`qa/gate/probes/lib-probe.mjs:153-160`), and computed opacity ignores ancestors — so bklit's one
group counts once and migrated's three leaves count three times.

**The obvious fix does not work, and I verified that myself rather than taking it on report.**
Grouping each candle and putting the state on the group changes nothing, because the engine never
resolves state for a group. `@tanstack/charts@0.16.0/dist/mark-state.js:17`, the single path used by
the motion, SVG, canvas and native renderers:

```js
const state = node.kind === "group" ? node.states : void 0;
...
const resolved = node.kind !== "group" && nodeDefinitions && nodeData && candidates.length
  ? resolveNodeState(node, candidates, nodeData, nodeDefinitions, focus, pointer)
  : { node };
```

A group's `states` only *supply* definitions and points to its descendants; the group itself falls to
`{ node }`, unresolved. And the descendants still each resolve, because ownership strips key
prefixes: `sceneKeyOwnedPoints` walks `while (candidate.includes(":"))` back through the last `:`
(`scene-point-ownership-internal.js:40-58`), so `candles:5:body` matches point `candles:5`. Regrouped
or not, three leaves resolve three times. Count unchanged, lag unchanged.

**No precedent to borrow.** Nothing in this codebase states a group, because the concept does not
exist in the engine: bar-depth dims per leaf (`BAR_DEPTH_BACK_NODES_PER_ROW = 6`), sankey uses
mark-level `withStates`, and `with-states.ts` only ever sets mark-level states.

**Ruling (principle 2).** Hold. The only mechanism that gives 1x is bklit's own — a baked
`style.opacity` on a per-candle `<g>` — which means deleting the mark states and plumbing hover
through React state to re-render, plus a replacement fade for the 150ms WAAPI tween that dies with
them. That is a **second dim implementation** with focus, markId, tooltip and reveal blast radius,
kept "for now" for a probe count that is not currently flagged. Explicitly rejected. The item is
parked until the engine can resolve state on a group, or the phase authorizes replacing states with
baked group opacity as a deliberate divergence.

**Upstream.** Drafted as I10 (state-on-group, or an opt-out from per-leaf ownership fallback).
**Not filed** — filing is outward-facing and item 9 remains gated to phase 8, same as I9.

**Executor note.** The executor hit the task's stop condition and made **no edit** rather than
improvise a dim replacement, which is the right call and the reason this entry can be written as a
ruling instead of a revert. Tree untouched: tsc 0, oxlint 0, tests 246 / 48 / 188 / 0 / 58, exit 0.

### D604 — nine gate-instrument defects (A5-A13): the harness could report a verdict it had not earned

**Vector, not items (principle 4).** Every one of these is the same shape: the gate produced a
*confident* verdict from evidence it did not have — a lock that did not exclude, a stage that failed
silently, a crashed cell that vanished, a mixed-build matrix presented as one build. None of them
changes a chart; all of them change what the gate is entitled to claim. That is why they land as one
commit: A8's throw is only safe because A12 renders the resulting failure as FAILED rather than
"not run", and A10's failed rows are only legible because A12 shows the stage failed at all.

**A5 — the QA lock did not exclude.** `acquireQaLock` had a re-entrant depth counter: a second
acquisition in the same process silently succeeded. That is the mechanism `--bench-parallel` used to
share the machine, which is the literal cause of D588. The counter is gone; a nested acquire now
throws. `--bench-parallel` is refused outright (`runAll` throws before any run dir exists) rather
than removed, so an old invocation fails loudly instead of quietly running a serial gate. run-all's
umbrella lock is also gone — required, now that nesting throws — and each server-using stage
(`run-qa`, `run-probes`, `run-bench`) takes the lock itself in turn.

**A6 — a probe run was invisible.** `waitForQuietProcessTable`'s pgrep pattern did not match
`run-probes.mjs`. Added. Deliberately *not* added: the gate drivers themselves — a stage would see
its own `run-all` parent as a foreign process and stall forever.

**A7 — the stale-lock breaker could break a live run.** It required only `QA_PORT` (5198) to be
quiet before declaring a lock dead, so a bench run holding the lock behind its own preview on
`BENCH_PORT` (5199) was invisible and could have its lock broken underneath it. Now both ports must
be quiet.

**A8 — a mixed-build matrix presented as a single-build verdict.** `bench/app/dist` changing during
a pass was a warning; it is now a throw, and the pass builds no matrix.

**A10 — crashed bench cells vanished.** A non-zero-exit cell simply did not appear in the table, so
the report looked complete. Failed cells now keep their rows (`failed`, `exit`, values null, no
spurious flags) and render as `**FAILED (exit N)**`, with the header counting them. The
`bench:invocation:*` issue already existed; the row is what was missing.

**A12 — a stage that threw rendered as "not run".** run-all now writes an interim `run-all.json`
before the summary stage, and `summarize` renders a missing artefact from a failed stage as
`FAILED — <error>` and raises `stage:<name>-failed`. Run dirs without `run-all.json` keep the old
rendering, so old artefacts still read correctly.

**A13 — a crashed capture still earned pixel verdicts.** A non-zero harness exit means the PNGs are
whatever it managed before dying, so no cell from that run gets PASS/FAIL; the gate is `ERROR`.

**Follow-on I folded in.** `summarize.mjs:50` printed `no report` for every ERROR row. After A13,
ERROR also means "crashed with partial output", so it now prints the recorded reason
(`r.error ?? "no report"`) and the two stay distinguishable.

**Lead-verified, not taken on report (principle 5).** I re-ran the load-bearing proofs myself against
the real functions: nested `acquireQaLock` throws and — the check the executor did not report —
**release resets the depth**, so the second sequential stage still acquires (without that, every gate
run would throw at stage two). `--bench-parallel` refuses before creating a run dir (latest run dir
unchanged). `summarize` on a failed-stage fixture gives `- QA: FAILED — Error: sweep blew up on
bardepth/100` + `stage:qa-failed`, and on a fixture without `run-all.json` gives `- QA: not run` with
0 stage issues. `compareBench` on a failed stub carries `failed=true exit=1` with `value=null` and
`flag=false` on every metric. `node --check` OK on all six files; `npm test` 246 / 48 / 188 / 0 / 58,
exit 0. No gate stage was run by me or by any executor — `qa/gate/latest`, `docs/phase-7/gate` and
`bench/results/latest.json` are all clean in `git status`.

**Not verified here.** None of this is proven end-to-end; it is proven function-by-function. Gate 3
is the first run under the new locking, and it is the run that exercises A5's per-stage acquisition
for real.

### D605 — A16: any `summarize` call could overwrite `qa/gate/latest`

**Found by causing it.** While verifying A12 (D604) I ran `summarize()` against a fixture run dir in
the scratchpad. It rewrote `qa/gate/latest/SUMMARY.md` and `issues.json` — the gate's own record of
the newest real run — from a two-stage fake. I restored both from HEAD. The A8/A13 executor did the
same thing earlier and restored the same way. Three incidents, same cause, so it is a defect in the
instrument and not three cases of carelessness.

**Cause.** `summarize()` called `publishLatest([...])` unconditionally (`summarize.mjs:217`),
ignoring which directory it had just summarized. `qa/gate/latest` is supposed to mean "the newest
real gate run"; nothing enforced that. Same family as D604: an artefact claiming more authority than
the evidence behind it.

**Fix.** Publish only when the run dir is under `RUNS_DIR` (or is `LATEST_DIR` itself); otherwise log
`not publishing to qa/gate/latest: <dir> is not a gate run dir` and skip. Real gate runs are
unaffected — they always write under `RUNS_DIR`.

**Verified.** Fixture dir: refusal logged, `qa/gate/latest/SUMMARY.md` md5 unchanged. Real run dir
(`docs/phase-7/gate/runs/2026-09-07T10-05-45-465Z`): publishes as before, and the rewrite is
byte-identical to the committed artefacts — `git status` on `qa/gate/latest` and `docs/phase-7/gate`
is empty afterwards, which also confirms summarize is deterministic over a fixed run.

**Remaining sharp edge, not fixed.** Re-summarizing an *older* run under `RUNS_DIR` still republishes
it as `latest`. That is pre-existing behaviour and arguably intended for re-rulings; narrowing it
further would change how `applyRulings` re-publishing works, which is not this item's business.
Recorded so the next person does not rediscover it as a surprise.
