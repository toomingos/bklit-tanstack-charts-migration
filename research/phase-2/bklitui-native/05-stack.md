# 05 — Stack & Libraries

## Dependency table (from `packages/ui/package.json:51-80` + `pnpm-workspace.yaml:1`)

| Package | Version | Kind | Role | Where used |
|---------|---------|------|------|------------|
| `react` | `^19.2.0` | dep + peer `^18\|\|^19` | UI runtime; hooks, context, portals, memo | Every chart file (`"use client"`); `createPortal` in `x-axis.tsx:646`, `tooltip/chart-tooltip.tsx:356` |
| `react-dom` | `^19.2.0` | dep + peer | Portal host | `tooltip/chart-tooltip.tsx:4`, `x-axis.tsx:4` |
| `@visx/responsive` | `4.0.1-alpha.0` | dep | `ParentSize` ResizeObserver wrapper | `line-chart.tsx:3`, `bar-chart.tsx:4`, `candlestick-chart.tsx:3` |
| `@visx/scale` | `4.0.1-alpha.0` | dep | `scaleTime`/`scaleLinear`/`scaleBand` factories | `time-series-chart-shell.tsx:3`, `bar-chart.tsx:5`, `y-axis-scales.ts:1` |
| `@visx/shape` | `4.0.1-alpha.0` | dep | `LinePath`, `AreaClosed`, arc/pie shapes | `line.tsx:4`, `area.tsx:4`, `pie-chart.tsx` |
| `@visx/grid` | `4.0.1-alpha.0` | dep | `GridRows`/`GridColumns` | `grid.tsx:3` |
| `@visx/group` | `4.0.1-alpha.0` | dep | `<Group>` wrapper (re-exported) | `index.ts` consumers |
| `@visx/event` | `4.0.1-alpha.0` | dep | `localPoint(svg, event)` pointer math | `use-chart-interaction.ts:3`, `bar-chart.tsx:3` |
| `@visx/brush` | `3.12.0` | dep | `<Brush>` drag-to-select | `chart-brush.tsx:3,233` |
| `@visx/zoom` | `4.0.1-alpha.0` | dep | Zoom transform (installed, not wired in shells) | Available for consumer composition |
| `@visx/curve` | `4.0.1-alpha.0` | dep | `curveNatural`, `curveMonotoneX` | `line.tsx:3`, `area.tsx:3` |
| `@visx/gradient` | `4.0.1-alpha.0` | dep | `LinearGradient`/`RadialGradient` + presets, re-exported | `chart-context` index `15`, `bar.tsx` gradients |
| `@visx/pattern` | `4.0.1-alpha.0` | dep | `PatternLines` etc. | `visx-pattern.tsx`, `pattern-area.tsx` |
| `@visx/sankey` | `4.0.1-alpha.0` | dep | Sankey layout | `sankey/sankey-chart.tsx` |
| `@visx/heatmap` | `4.0.1-alpha.0` | dep | Heatmap layout | `heatmap/*` |
| `@visx/geo` | `4.0.1-alpha.0` | dep | Choropleth projection | `choropleth/*` |
| `d3-array` | `3.2.4` | dep | `bisector`, `extent` | `time-series-chart-shell.tsx:4`, `use-chart-interaction.ts:81` |
| `d3-scale` | `4.0.2` | dep | Scale types (also via visx) | Types in `use-scatter-chart-interaction.ts:3` |
| `d3-shape` | `^3.2.0` | dep | Curve/area generators (peer of visx/shape) | Indirect via visx |
| `d3-geo` | `3.1.0` | dep | Geo path | `choropleth/*` |
| `motion` | `^12.27.0` | dep | `motion.*`, `animate()`, `useSpring`, `useReducedMotion` | `chart-reveal-clip.tsx:3`, `line.tsx`, `use-animated-*.ts` |
| `react-use-measure` | `^2.1.7` | dep | `useMeasure` for `ScatterChart` | `scatter-chart.tsx:12` |
| `clsx` + `tailwind-merge` | `^2.1.1` / `^2.6.0` | dep | `cn()` class merging | `line-chart.tsx:16`, `bar-chart.tsx:17` |
| `@base-ui/react` | `^1.0.0-alpha.8` | dep | Base UI primitives (tabs, dialog) | Non-chart UI; not in `charts/*` |
| `@number-flow/react` | `^0.5.4` | dep | Animated number ticks | `chart-stat-flow.tsx` |
| `topojson-client` | `3.1.0` | dep | TopoJSON → GeoJSON | `choropleth/*` |
| `@bklitui/icons` | `workspace:*` | dep | Icon set | Chart markers/legends |
| `tailwindcss` | `^4.1.8` | devDep | Styling (utility classes) | `className` across charts |
| `typescript` | `5.9.2` | devDep | Types | `tsc --noEmit` |

Dev-only / types: `@types/d3-*`, `@types/react@19.2.2`, `eslint`, `shadcn`, `tsx` (`packages/ui/package.json:27-45`).

### Version notes

- `visx/*` are mostly `4.0.1-alpha.0` (next major) except `@visx/brush@3.12.0` lagging (`package.json:55-68`) — Brush still on v3 API (`chart-brush.tsx:33` `Brush()` cast).
- `react@19.2.0` with peer `^18||^19` — charts use `useId`, `createPortal`, `memo`, `use*` stable since 18; `motion` compatible.
- `@base-ui/react` alpha — not imported by any `charts/*` file (grep returns 0 hits inside `charts/`).
- `topojson-client` + `d3-geo` + `@visx/geo` only for choropleth; `sankey`/`heatmap` similarly isolated.

## Roles in charts

```
React 19 ──► rendering, hooks (useState/Effect/Memo/Ref), context split, memo, portals
visx Responsive ──► ParentSize ResizeObserver (mount gate)
visx Scale ──► x/y scales (time, linear, band) + invert()
visx Shape/Event/Grid/Curve ──► SVG path, coordinate lookup, grid lines, interpolation
visx Gradient/Pattern ──► fills (area gradients, bar patterns)
visx Brush ──► drag selection rectangle (time window)
d3-array ──► bisector + extent (data indexing)
motion ──► clip reveal, spring highlight, shimmer, hover dim
react-use-measure ──► alternate measure for ScatterChart
clsx/tailwind-merge ──► cn() for container class composition
```

## Peer vs dep

| Field | Content | Implication |
|-------|---------|-------------|
| `peerDependencies` | `react ^18\|\|^19`, `react-dom ^18\|\|^19` (`package.json:47`) | Host app provides React; `@bklitui/ui` does not bundle it. Allows embedding in Next.js 14/15. |
| `dependencies.react` | `^19.2.0` (`package.json:75`) | Workspace installs React 19 for local dev/build; `sideEffects:false` (`package.json:6`) enables tree-shaking per chart entry (`exports` map `package.json:7`). |
| `workspace:*` | `@bklitui/icons`, `@bklitui/eslint-config`, `@bklitui/typescript-config` | Monorepo links, not external. |
| `pnpm.overrides` | `esm-env → esm-env-runtime@^0.1.1` (`package.json:33`) | SvelteKit compat shim for `motion` ESM env detection. |

No chart code imports from `apps/*` or `packages/studio` — `packages/ui/src/charts/*` is self-contained (only `react`, `visx/*`, `d3-*`, `motion`, `clsx`).

## Build/packaging

- `sideEffects:false` + `exports: "./charts": "./src/charts/index.ts"` (`package.json:6-8`) — bundler can tree-shake per chart.
- `registry:build` (`package.json:24`) generates shadcn registry from `packages/ui/src` sources.
- `turbo run build` at root (`package.json:5`) builds all packages; `check-types` runs `tsc --noEmit` (`packages/ui/package.json:22`).

→ Load `01`, render `02`, hooks `03`, interactivity `04`.
