# BKLIT-UI Native Chart Stack — TL;DR

> Scope: `repos/bklit-ui` — `packages/ui/src/charts/*` (~204 files). All paths relative to `repos/bklit-ui`.

| Aspect | Summary |
|--------|---------|
| **Entry** | `LineChart`/`AreaChart`/`BarChart`/`ScatterChart`/`CandlestickChart`/`ComposedChart` (see `packages/ui/src/charts/index.ts:22-320`) wrap `ParentSize` → `ChartInner` → `TimeSeriesChartShell` or bespoke core |
| **Sizing gate** | `@visx/responsive.ParentSize` `debounceTime={10}` (`line-chart.tsx:265`, `bar-chart.tsx:701`, `scatter-chart.tsx:154`); early-return `null` if `width<10 \|\| height<10` (`time-series-chart-shell.tsx:172`, `bar-chart.tsx:170`) |
| **State container** | `ChartProvider` splits into `ChartStableContext` + `ChartHoverContext` (`chart-context.tsx:230-368`); `useChartStable` skips hover re-renders |
| **Lifecycle** | `ChartPhase` 8 states (`chart-phase.ts:12-20`) orchestrated by `useChartPhaseOrchestrator` (`use-chart-phase-orchestrator.ts:22`) — skeleton ↔ y-tween ↔ clip-reveal |
| **Render target** | `<div.relative>` (containerRef) → `<svg overflow-visible>` → `<g translate(margin)>` (`time-series-chart-shell.tsx:650-693`, `bar-chart.tsx:625-667`); axes/tooltip via `createPortal` to container (`x-axis.tsx:646`, `chart-tooltip.tsx:356`) |
| **SVG production** | `@visx/shape` (`LinePath`, `AreaClosed`), `@visx/scale`, `@visx/grid`, `motion/react` for reveals — see `02-render.md` |
| **Interaction** | `useChartInteraction` (`use-chart-interaction.ts:54`) : `localPoint` → `xScale.invert` → `bisector.left` → `scheduleTooltip` (rAF deduped in `use-scheduled-tooltip.ts:29`) → `ChartHoverContext` |
| **Animation** | Clip `<motion.rect>` width reveal (`chart-reveal-clip.tsx:30`), `useAnimatedYDomains` (`use-animated-y-domains.ts:124`), `useAnimatedSeriesPath` (`use-animated-series-path.ts:30`) — all via `motion` `animate()` |
| **Brush/zoom** | `@visx/brush` in `ChartBrush` (`chart-brush.tsx:233`) → parent `xDomain` prop → `filterDataByXDomain` + xScale domain merge |
| **Stack** | React 19 (`package.json:75`), `visx/*@4.0.1`, `d3-*@3-4`, `motion@12.27`, `react-use-measure@2.1`, Tailwind 4 — see `05-stack.md` |

## File Map (charts/)

```
packages/ui/src/charts/
├── index.ts                          # public barrel (all re-exports)
├── chart-context.tsx                 # ChartProvider + useChart* (stable/hover split)
├── chart-phase.ts                    # ChartStatus/ChartPhase + phase helpers
├── time-series-chart-shell.tsx       # shared shell: scales, decimation, y-domains, clip
├── line-chart.tsx / area-chart.tsx   # entry wrappers (ParentSize gate)
├── bar-chart.tsx / candlestick-chart.tsx / scatter-chart.tsx
├── chart-child-passthrough.ts        # layer classification (clip-excluded / post-overlay)
├── use-chart-interaction.ts          # pointer → tooltip pipeline
├── use-scheduled-tooltip.ts          # rAF + dedupeKey gate
├── use-chart-phase-orchestrator.ts   # loading↔ready state machine
├── use-animated-y-domains.ts / use-animated-series-path.ts
├── line.tsx / area.tsx / bar.tsx / scatter.tsx / candlestick.tsx
├── chart-brush*.tsx / grid.tsx / x-axis.tsx / y-axis.tsx
└── tooltip/chart-tooltip.tsx (+ dot/box/indicator/date-ticker)
```

## Index

| File | Covers |
|------|--------|
| `01-load.md` | Entry → mount gate → context bootstrap → data injection → phase machine → SSR |
| `02-render.md` | DOM target → SVG pipeline → per-datum fan-out → layer order → portals |
| `03-hooks-and-updates.md` | Hook subscriptions, rAF dedupe, resize & data propagation, animation ticks |
| `04-interactivity.md` | Pointer pipeline, per-chart hit-testing, crosshair/dim/highlight, brush/zoom |
| `05-stack.md` | Dependency table with versions, roles, and usage sites |

> Cross-ref convention: `→ 01` / `→ 02` etc. No duplicated sections — follow the index for depth.
