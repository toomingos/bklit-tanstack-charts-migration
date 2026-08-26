# P3.8 / T-D6 + T-D7 — findNearestPoint & y-domain svgAnimation ruling

**Part A ruling: T-D6 is NON-VIABLE as chartered.** Not for the tie-break reason
the wrapper feared (the tie-breaks **match** — §1), but because the native API is
a scene-pixel 2D-Euclidean resolver over one global point set, while
`resolveNearestIndex` is a 1D x-only value-bisect over two different-length JS
arrays that no scene ever contains. Close skipped-with-reason (D264/D272/D280
precedent). Zero files modified repo-wide.

**Part B ruling: ALREADY LANDED — verified, not rebuilt.** Line/Area/Composed
populate native `svgAnimation` directly in their ChartDefinitions; the one open
item the brief named (reduced-motion snap) is satisfied **natively by default**
(`motion.ts:224`), enforced at renderer level (`motion.ts:951-961`). Zero files
modified.

Gate: `TSC_EXIT=2`, exactly one error: `migrated/charts/internal/spring.ts(18,35)
TS2307: Cannot find module '@tanstack/charts/spring'` — **P3.12's file, mid-edit**
(the subpath-import tsconfig entry its package must add per wrapper §0's stated
convention). Zero errors in P3.8's column. Do not attribute to P3.8; re-run tsc
after P3.12 lands its paths alias.

---

## 1. Part A — establishing citations (all clone source, read directly)

| # | Claim | Evidence |
|---|---|---|
| 1 | **Native tie-break MATCHES bklit's** | `charts-core/src/nearest.ts:45-55`: reverse traversal (`for (let index = points.length; index--;)`) accepting on `<=`, comment verbatim: *"Reverse traversal with <= preserves the historical first-point tie."* Equal distance → earliest array index wins. `bisect.ts:35` strict-`>` falls through to `return index - 1` on equality → also earlier-wins. Same winner on ties; the midpoint trap does not fire. |
| 2 | **Distance metric DIFFERS: 2D Euclidean vs 1D x-only** | `nearest.ts:47-49`: `dx = point.x - x; dy = point.y - y; distance = dx*dx + dy*dy` — full Euclidean over scene pixel coordinates. `bisect.ts:23-38` never reads y: bisects on `accessor(d)` values, compares `target - d0Val > d1Val - target`. bklit's `resolveTooltipFromX` semantics rank candidates by \|Δx\| alone regardless of pointer height. Any hover not exactly on a point's y can resolve differently (neighbor closer in x but farther in y flips the winner). This alone breaks "hover targeting identical". |
| 3 | **Root export is scene-only** | Root barrel `charts-core/src/index.ts:111-117` exports `findNearestPoint` from `./scene`; its signature (`scene.ts:627-638`, mirrored in `charts-core-d3/src/scene.ts:185-192`) is `findNearestPoint(scene, x, y, maxDistance?, points? = scene.points)`. The array-level primitive `nearestPoint(points, x, y, maxDistance)` (`nearest.ts:33-59`) is **module-private** — not exported from `nearest.ts` to any barrel. No array-only entry point exists on the public surface. |
| 4 | **No ChartScene exists anywhere in the migrated tree** | Repo-wide grep `findNearestPoint|createChartScene|ChartScene|viewportInteractionPoints` across `showcase/migrated/` → **zero hits**. Migrated hover is driven by our own d3-scale pointermove listeners (`composed-chart.tsx:1165-1239`), not by TanStack focus/scene machinery. To call `findNearestPoint` we would have to fabricate or obtain a live scene — the exact falsifier pattern D272/D280 established ("a native control/mark is inert materialized only by the render pipeline"). |
| 5 | **Composed's two arrays cannot both live in one scene** | `composed-chart.tsx:1200` resolves against RAW `data`; `:1205-1206` resolves against DECIMATED `renderData`. Bars render raw, line/area render decimated (dual-index architecture, wrapper-mandated). A scene's `points` is one flat set built from the rendered marks; there is no supported way to partition `findNearestPoint` candidates into raw-vs-decimated sets per call — `points` defaults to `scene.points` and passing subsets means hand-assembling point arrays we don't own (and §2's metric problem remains even then). |
| 6 | **Focus strategies are self-contained — NOT consumers of bisect.ts** | `internal/candlestick-focus-strategy.ts:33-41` and `internal/scatter-focus-strategy.ts:54-62`: each has its own nearest-point loop (`Math.abs(p.x - x)`, `if (d >= distance) continue`) — 1D-x like bklit, same strict tie-break, zero imports from `bisect.ts`. Only references to bisect there are comments (`candlestick-chart.tsx:28`). Brief's suspicion ("check those files") checked: nothing to swap, nothing touched. |

### Compensating-wrapper option (wrapper §3 asked which)

A viable variant exists but is a NEW abstraction, not the chartered swap:
export-adjacent use of private `nearestPoint` is impossible without patching the
clone (D232-forbidden); the only sanctioned path is calling root
`findNearestPoint` against a real scene, which composed doesn't have. Building a
fake scene object cast to `ChartScene` to reach `nearestPoint` through
`nearestScenePoint`'s empty-index fallback (`nearest.ts:75-77` →
`nearestPoint(points,...)` when `index.targets.length === 0 &&
!index.attachedPoints.size`) would work mechanically but is (a) undocumented
surface, (b) still 2D-Euclidean (§1 #2 — wrong metric), and (c) still one global
set (§1 #5 — dual-index collapse risk). **Not recommended. If the lead wants the
metric question re-opened, the correct scope is a lead-level ruling that 2D vs
1D resolution is acceptable drift — that is an interactivity-semantics decision,
not an implementation detail, and per D269 precedent it is mine to surface, not
to make.**

## 2. Part B — svgAnimation already landed; verification evidence

| # | Item | Evidence |
|---|---|---|
| 1 | Composed populates `svgAnimation` natively | `composed-chart.tsx:1039-1042`: `svgAnimation: isChartInteractionPhase(phaseRef.current) && isLoadedRef.current && yDomainChanged ? { duration: DATA_TWEEN_MS, easing: bezierEasing } : false`. Brief said lines 1014-1017 — drifted ~25 lines, identical shape. |
| 2 | Line populates it | `line-chart.tsx:486-489` (build `svgAnimation` const), consumed at `:510`. Gate: `isChartInteractionPhase(chartPhase) && isLoaded && yDomainChangedForTween`, duration `effectiveYDomainTweenDuration`. |
| 3 | Area populates it | `area-chart.tsx:734-737`, same gate shape with `yDomainChanged`. Brief said 727-730 — same drift class. |
| 4 | Real tween-fire gate is the exact-value compare | `internal/y-domain.ts:55-67` `useNicedYDomainChanged`: `changed = prevRef.current[0] !== niced[0] \|\| prevRef.current[1] !== niced[1]`. Unchanged from the brief's description. |
| 5 | Reduced-motion snap holds NATIVELY, default-on | `motion.ts:224`: `respectReducedMotion: options.respectReducedMotion ?? true` — the app passes no override, so it is active. Enforcement: renderer-level `motion.ts:951-961` computes `reduced` from `(prefers-reduced-motion: reduce)` and forces `animate = !reduced && ...`, falling to direct SVG reconcile (snap). Also gated per-transition at `motion.ts:894-902` and tooltip motion at `motion.ts:356-370`. No app-side wiring needed; OQ tanstack-5's runtime concern is satisfied by construction, and the lead's sweep can confirm behaviorally if desired. |
| 6 | `DATA_TWEEN_MS` present in all three | `composed-chart.tsx:135`, `line-chart.tsx:81`, `area-chart.tsx:90` (grep-verified literals `= 500`). |

## 3. Contradictions found (brief/wrapper vs tree) — all three verified at source

1. **The `0.02` threshold EXISTS now.** Brief §"What genuinely remains open":
   *"Do not invent or cite a 0.02 skip-threshold constant. A repo-wide grep …
   returns zero hits."* That was true when written and is false now:
   `internal/chart-phase.ts:17` declares `export const Y_DOMAIN_TWEEN_SKIP_THRESHOLD = 0.02;`,
   committed in `9b394f5` ("Phase 3: 8 new chart types…") — i.e., pre-existing
   committed code, **not** a concurrent sibling's edit (git log -S confirms).
   Consumer scan: only `internal/types.ts:12` re-exports it via the barrel;
   **zero functional consumers** — no chart branches on it, so the actual
   tween-fire gate REMAINS the exact-value compare (§2 #4). It is currently an
   inert constant + orphan re-export. Either it was landed ahead of a task that
   never shipped its consumer, or it is dead — flagging for the lead to rule
   (D216: I do not delete). The brief's *substance* survives: nobody invented a
   threshold to match a stale doc, because the live gate never used one.
2. **Line-number drift on every svgAnimation citation** (composed 1014→1039,
   area 727→734, line 481→486): Wave 1-3 edits shifted these regions. Shapes
   byte-equivalent to the brief's description. Staleness rule 4.4.4 applied —
   trusted the tree.
3. **`hover-reanchor.ts` carries its own private `bisectDateLeft` copy**
   (`internal/hover-reanchor.ts:16`, used at `:33`). The brief's consumer census
   missed this file entirely: it duplicates `bisectDateLeft` locally rather than
   importing from `bisect.ts`, so it is invisible to import-graph scans of
   `bisect.ts` consumers but IS a fourth copy of the leftmost-bisect logic in
   the tree. Out of my column (not listed in my ownership set), untouched,
   reported per D216/D280 convention.

## 4. Orphans (report only — nothing deleted)

- `bisect.ts` is **NOT fully orphaned** by this package's outcome (nothing was
  swapped). Its remaining live consumers: `composed-chart.tsx:128` (+ calls at
  `:1200`, `:1206`) and `internal/chart-selection.ts:4` (+ call at `:56`);
  barrel re-export `internal/index.ts:7`. Comments referencing it in
  candlestick/scatter strategy files are documentation only.
- `Y_DOMAIN_TWEEN_SKIP_THRESHOLD` (`chart-phase.ts:17`) — defined + barrel
  re-exported (`types.ts:12`), functionally unconsumed. See §3 #1.
- Pre-existing known orphan noted in passing: none new created by P3.8 (zero
  edits).

## 5. Gate instructions for the lead (per wrapper §5)

`tsc --noEmit` was run from `showcase/` (exit code captured unpiped):
`TSC_EXIT=2`, sole error `spring.ts(18,35)` — P3.12's in-flight file. After
P3.12 lands, expect `TSC_EXIT=0`; P3.8 contributes no type surface change.

Since P3.8 changed zero files, **no QA regression is attributable to this
package**, and the sweep should expect zero drift attributable to P3.8. For
completeness — the scenarios that WOULD have exercised the swapped code path
had the swap happened, verified to actually mount the relevant components:

- **Bar-chrome (raw-index) path**: `bench/app/src/scenarios/migrated-composed.tsx`
  mounts `ComposedChart` with `<ChartTooltip />` (`migrated-composed.tsx:60`) —
  hover targeting flows through `composed-chart.tsx:1200`'s `rawIndex` →
  `chromeRef.onFocusGroupChange(points, rawIndex)` (`:1230`). QA target
  `--chart composed --impl migrated` hover captures exercise it.
- **Line/area highlight-band (decimated-index) path**: same scenario —
  `datumIndex` picks `decimatedIndex >= 0 ? decimatedIndex : rawIndex`
  (`composed-chart.tsx:1224`), divergent from rawIndex whenever LTTB drops
  points (n=1000 fixtures guarantee divergence).

Both paths are in ONE scenario because composed is the only chart where both
resolutions coexist — consistent with the brief's warning not to assume they
split cleanly across charts.

## 6. Files touched

- Created: `research/phase-4/findings/P3-08-findNearestPoint-svgAnimation-ruling.md` (this file).
- Product code: **zero files modified. Barrel `internal/index.ts`: untouched.
  Clones: untouched (read-only reference only). `qa/`, `bench/`, `/tmp`: untouched.**
