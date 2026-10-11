# AGENTS.md

bklit-ui → TanStack Charts 1.1 migration. Native rewrite of bklit's charts, shown side by side with the originals on the showcase. Current phase: 8 — tracking `docs/phase-8/PROGRESS.md`, decisions `docs/phase-8/LOG.md`, rules for fixer agents `docs/phase-8/FIXER-RULES.md`, upstream limitations `docs/phase-8/UPSTREAM-GAPS.md`. The lead plans, reviews and commits; delegated agents edit or audit via `.agents/skills/opencode-subagents/run.sh`.

## Commands

All from `showcase/` (standalone Next 15 app, port 5200):

```bash
pnpm dev                       # dev server on :5200 (do not restart a server someone else is using)
npx tsc --noEmit -p . | grep error   # must print nothing
pnpm build                     # production build (prebuild clones repos and installs)
```

Serve anything extra (builds, previews) on a different port (≥ 5240) and kill only by port.

## Architecture

- **`showcase/migrated/charts/`** — the migrated charts (`@showcase/migrated-charts`, source-only, consumed via `transpilePackages`; exports `.` and `./styles.css` only). Each top-level file exports bklit-compatible components; `index.ts` is bklit's public API only. Implementation lives in `kit/` (family-agnostic): `cartesian/` (chart config, definition, carriers, focus layer, hover/loading CSS), `polar/`, `motion/` (easing, springs, phase), `entrance/` (entrance origin and alignment, `reveal-arm.tsx`), `size/`, `tooltip/`, `legend/`, `loading/`, `pattern/`, plus top-level helpers (`host-write.ts`, `css-hooks.ts`, `css-vars.ts`, `theme.ts`, `resource-host.tsx`, ...). One folder per chart family sits directly under `charts/` (bar, candlestick, choropleth, composed, funnel, gauge, heatmap, live-line, pie, radar, ring, sankey, scatter, sunburst).
- **Reuse, do not re-implement:** `useReadyGate` (`kit/entrance/reveal-arm.tsx`) for the interaction-ready gate; the `kit/host-write.ts` helpers for host writes; `useResizeBox` (`kit/size/use-resize-box.ts`) for size; `createChartSpring` springs via `kit/motion/spring-curve.ts`; `tooltipBoxMotion` (`kit/tooltip/box-motion.ts`) for tooltip motion.
- **`showcase/packages/bklit-charts/`** — re-exports bklit's own charts from `showcase/repos/bklit-ui` (`@showcase/bklit-charts`).
- **`showcase/app/charts/<route>/`** and **`showcase/components/demos/`** — one page and one dual-rendered demo per chart; `components/chart-stage.tsx` mounts bklit and migrated side by side.
- **`showcase/components/live-perf/`** — the Live Perf panel (collector, probe, panel): load, entrance, settle, React cost, hover and interaction latency per implementation.
- **`repos/`, `showcase/repos/`** — read-only clones (bklit-ui, tanstack-charts at v1.1.0). Never modify.
- **`docs/phase-8/`** — PROGRESS (status board), LOG (decision log, `D<num>` entries, newest last, continuous from phase 7), UPSTREAM-GAPS, FIXER-RULES. `archive/` (local, gitignored) holds earlier phases and research.

## Key conventions

- **QA is Chrome only.** Observe charts in Chrome (claude-in-chrome) on the showcase: both implementations, 1440 and 390 px, light and dark, hover, keyboard focus, resize. No headless/Playwright runs for QA. Performance is read from the Live Perf panel.
- **Native first.** Compose `defineChart` with built-in marks, layouts, `states`, `motion()` and the interaction controller. Custom code needs docs/source evidence that no native path exists (FIXER-RULES 1). Never write to or key on renderer-owned DOM, never touch private TanStack state.
- **Preserve bklit's behaviour** — design, animation timing, hover, focus and keyboard. Entrance timing is anchored on motion's clock (`kit/entrance/entrance-origin.ts`, `entrance-align.tsx`); change it only with a LOG entry.
- **Timers and frames** carry a comment citing the bklit `file:line` they reproduce.
- **Remove replaced code.** No dead exports, files or comments describing removed approaches.
- **Rulings and waivers** (accepted divergences, library floors) are logged in `docs/phase-8/LOG.md` by the lead. Agents omit failures in reports; the lead re-verifies in Chrome before committing.
- **Update `docs/phase-8/PROGRESS.md`** after every item.
- **Upstream drafts.** New or changed TanStack limits go to `docs/upstream-issues/` as drafts (FIXER-RULES rule 10). Nothing is posted to GitHub until the user reviews them.

## DO NOT

- Modify files in `repos/` or `showcase/repos/`.
- Restart or touch the :5200 dev server, or `pkill`; kill only by port.
- Commit symlinks (including `node_modules`; the root `.gitignore` matches them), `.next/`, local alias overrides, or scratch files.
- Add chart-specific workarounds that exist only to make a measurement look better.
- Call `element.getAnimations()` per element after bulk CSS mutations (forces quadratic animation-state flushes).
