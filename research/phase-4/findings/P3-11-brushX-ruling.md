# P3.11 / T-D9 — brushX mechanics ruling

**RULING: T-D9 is NON-VIABLE as chartered.** The lead's pre-ruling (§1 of the dispatch wrapper) is **UPHELD**. No code changed; this document is the deliverable (outcome (a) per wrapper §1). Close skipped-with-reason, D264/D272 precedent.

## 1. Establishing citations (all clone source, read directly)

| Claim | Evidence |
|---|---|
| `brushX` returns a `ChartControl`, not a hook | `showcase/repos/tanstack-charts/packages/charts-core/src/interaction-brush.ts:101-107` (both overloads declare `ChartControl<TValue, any>`); body returns `{ id, resolve(context) }` (`:120-179`) |
| `resolve` needs a scene-supplied context | `interaction-brush.ts:122-134` reads `options.range.value`, then `context.scales.x`, `[context.chart.x, context.chart.x + context.chart.width]`, `context.theme.palette`. Context contract: `types.ts:493-500` (`ChartControlContext` = chart bounds, scales, colors, theme, width, height) |
| Control materializes only via the render pipeline | Resolved control carries `extension: brushXControlExtension` (`interaction-brush.ts:153,232-235`) whose `create({container, surface})` builds the real d3-brush SVG (`:237-306`). Repo-wide grep for `extension.create` / `.controls`: **every** consumer is `renderer.ts:889-902` (+ `:1026` tooltip) and test files. Nothing else instantiates controls |
| Migrated brush mounts OUTSIDE any `<Chart>` host | `showcase/migrated/charts/line-chart.tsx:998-1002`: brushes render as plain children of a `<div style="display:contents">` inside `BrushHostContext.Provider`, a **sibling** of the `<Chart>` element (`:1016-1023`). Same shape in `area-chart.tsx`. Consumer resolves the host from React context, not scene: `internal/chart-brush.tsx:26` (`useContext(BrushHostContext)`), mechanics at `:42` (`useBrushDrag`) |

## 2. Falsifier outcome — stated plainly

**No.** Two-part answer, both settled:

1. **No Chart host in the brush's ancestry.** Verified by reading `line-chart.tsx`'s render return: the brush layer is a DOM sibling positioned off `containerRef` + `margin` + `trackExtent`; no `<Chart>` wraps or contains it. Wrapper §1's claim holds.
2. **No documented/runtime standalone resolution path exists.** Searched:
   - `export (function|const) \w*(Host|headless|Headless|mount|Mount|attach|Attach)\w*` across all clone packages → only `mountChart` (`charts-core/src/dom.ts:12`), `mountCanvasChart` (`canvas.ts:388`), `mountChartRenderer` (`renderer.ts:57`) — **all require a full chart `definition`**, i.e. option (b).
   - `export …\w*(Resolve|Context)\w*` → many `resolve*` helpers, **none** synthesize a `ChartControlContext`.
   - `index.ts:298` exports `ChartControlContext` as a **type only** — no runtime factory anywhere.
   - Library's own intended usage: `interaction-brush.test.ts:22-41` (`createChartScene(definition(...))`), `:43-52` (`mountChart(container, {definition})`); docs `docs/reference/focus-and-interaction.md:559` ("place it in [the definition]"); conformance cases 83/89 all definition-hosted.
   - **Near-miss honestly recorded:** the `extension.create({container, surface})` factory IS a DOM-materializing entry point reachable on the resolved control object. But driving it by hand means fabricating the renderer's instance lifecycle (`update`/`contains`/`destroy`, `renderer.ts:884-905`) plus a synthetic context — undocumented, unsupported surface, and still needs a resolved control first (chicken-and-egg with `resolve`). Not a sanctioned standalone path; would be a fork of renderer internals, worse than option (b).

Decisive corroboration: bklit's brush-over-track UX (independent full-extent scale under a zoomed plot) maps exactly to the library's own overview+detail pattern, and TanStack's sanctioned implementation of it (**conformance case 83**) uses **two chart hosts** — i.e., the library itself answers this need with precisely what the charter forbids (wrapper §1(b)).

## 3. What was NOT changed (all confirmed untouched)

- 2-finger touch gesture — see §5 correction: it is not where the brief says, but wherever it lives it was untouched.
- Pill-knob handle chrome (`brush-chrome.tsx` handle rendering ~180-207) — permanent compensating chrome, intact.
- `DEFAULT_SELECTED_BOX_STYLE` + full `BrushBorderChrome` visual styling — intact.
- P3.13 property: `filterDataByXDomain` (`brush-selection.ts:36`), `createXAccessor` (`:99`), `useBrushSelection` module scope — byte-untouched; no barrel edit made at all.
- `brush-layout.tsx` (P3.13, row 11) — left alone.
- Clones, `qa/`, `bench/`, barrels — untouched. Zero files modified repo-wide.

## 4. `HANDLE_HIT_PX` location

**Confirmed:** `brush-drag.ts:167` (declared inside the pointer-handling effect; consumed at `:193,198`). Brief correct, tanstack.md row grouping wrong as briefed.

## 5. Contradictions found (brief vs tree)

1. **The 2-finger gesture is NOT in `brush-drag.ts:120-163`.** That file has zero touch handlers — lines 120-163 are refs plus the initial-extent effect. The actual 2-finger gesture (`touches.length === 2` start/move/end) lives in **`internal/chart-selection.ts:120-163`**, inside `useChartSelection`, a different component outside this package's column. Consequence: T-D9's "2-finger stays custom" clause was protecting a different file than named. It is safe regardless (I did not touch either file), but the brief's citation is wrong and should be corrected before any future executor edits `brush-drag.ts` believing touch logic is there.
2. **`useBrushSelection` (`brush-selection.ts:110-175`) contains no drag/selection mechanics at all** — it is pure state semantics (extent resolution, null→full-extent reset, layout gating). Every pointer mechanic lives in `useBrushDrag` (`brush-drag.ts`). Row 10's "drag/selection/resize mechanics across brush-drag + brush-selection" overstates the selection file's role; there was never anything mechanical there for `brushX` to replace. This strengthens the non-viability: even hypothetically, only `useBrushDrag` was swappable.
3. `research/phase-4/internal-brush.md:3` labels `chart-brush.tsx` "(orphan)" — wrong per the brief's own correction; it is live via CHART_ROLE composition (`chart-brush.tsx:37`, consumed through `children.tsx:339` role extraction). Recorded so the stale doc doesn't mislead a later deletion pass.

## 6. Orphans noticed (report only — D216 forbids deletion)

- `internal/brush-layout.tsx` (88 LOC) — known, row 11, P3.13's to report. Unchanged.
- No new orphans surfaced. Note for the lead's sweep: since this package edited nothing, any diff appearing in brush files came from a sibling, not me.

## 7. If the lead ever wants this native

Only path is wrapper §1(b): relocate brush into a second `<Chart>` host fed a full-extent definition with `brushX` in its controls (case-83 shape), keeping `brush-chrome.tsx` pills portaled over the native handles. That is a feature-sized rework of `line-chart`/`area-chart` brush wiring plus QA re-baselining of every line/area capture — a go-to-plan amendment, not a wave task.
