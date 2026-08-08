# SankeyChart — Phase 2 Refactor Plan (1.1 synthesis)

> Inputs: `research/phase-2/audits/sankey-audit.md`, live `migrated/charts/sankey-chart.tsx` + `internal/sankey-{mark,hover-chrome,animation}`.

## Goal
Clamp Sankey's global `window mousemove` listener to the chart surface and tighten the remaining small cleanups, keeping the GAP `createSankeyMark` + `d3-sankey` pipeline but removing the whole-page re-render on every pixel move. Sankey is the last chart in the Phase 2 table.

## Distilled overhead
- Broken (§4): `window.addEventListener("mousemove", setMousePos)` fires on every window pixel regardless of chart hover — re-renders whole chart (table warns: no gate). Duel-layout `layout===null` first paint jump.
- Wrappers (§3): per-element `attachSankeyHoverListeners`, defensive fallback layout, `markConfig` side-channel, `parseAspectRatio` inline dup.

## Synthesis — Keep / Defer / Change

### Keep
- `K1` `createSankeyMark` via `createMark` + `d3-sankey computeSankeyLayout` + stroked Bezier centerlines `sankeyLinkHorizontal()`.
- `K2` Single sanctioned GAP mark — no stock Sankey mark exists (audit §1).
- `K3` Connectivity-aware hover `computeNodeHoverConnected` / `computeLinkHoverConnected` O(N) per hover.
- `K4` Labels / gradients / CSS via `onRender` injection (imperative but gate-blocked).

### Defer
- `D1` Emit `ChartPoint` per node/link + `ChartFocusStrategy` + `onFocusChange` tooltip (audit §6 #1, M — needs centroid wiring + grouping for 1-hop neighborhood; wrong slice to prove).
- `D2` Forward sizing to TanStack host (`defineChart((ctx)=>spec)` + `ResizeObserver`) (audit §6 #2, M).
- `D3` Labels/gradients as `SceneNode`s (audit §6 #3, M — rotated label anchor unproven).
- `D4` `displayName→CHART_ROLE` + `computeDisplayValue` dedup (audit §6 #5, L).

### Change — tight C this slice

**C1 — Scope `window mousemove` → `containerRef pointermove` + hover gate (audit §4 row2 + §6 #4, M).** Replace `window.addEventListener("mousemove", e => setMousePos({x:e.clientX,y:e.clientY}))` with `containerRef.current.addEventListener("pointermove", e => { if (hoveredNodeIndexRef.current===null && hoveredLinkIndexRef.current===null) return; setMousePos({x:e.clientX,y:e.clientY}) })`. So `mousePos` only updates while a node/link is actually hovered (topos inner refs), not on every window pixel outside the chart. Removes whole-page churn per the audit.

> Scope note: No focus strategy, no layout-forwarding, no label scene-node promotion this slice — all D. Slice fixes the only whole-window re-render regression with single-pixel repro.

## Execution
- Patch `migrated/charts/sankey-chart.tsx` single file: swap `window mousemove` for scoped `pointermove` + hover guard. Keep `bench/app` build PASS.

## Risks
- Low — hover refs are already the hot path's source of truth; clamp preserves tooltip `position:fixed` via `mousePos`.

## Questions open
- None — global listener is the only M-row repro this slice.
