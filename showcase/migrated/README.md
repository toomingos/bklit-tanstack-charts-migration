# bklit-tanstack-charts

TanStack Bklit UI Charts: the chart components of [bklit-ui](https://github.com/bklit/bklit-ui), rebuilt natively on
[TanStack Charts](https://tanstack.com/charts) 1.1. The component API, design, animation and hover behaviour follow bklit-ui, so
code written for bklit-ui's charts moves over by changing the import path. Under the hood every chart is a `defineChart` definition
rendered by `@tanstack/react-charts`.

- Line, Area, Scatter, Bar, Candlestick, Composed, Live line, Pie, Ring, Radar, Gauge, Funnel, Heatmap, Sunburst, Sankey and Choropleth charts.
- Composable layers: `Grid`, `XAxis`, `YAxis`, `ChartTooltip`, `Legend`, `ChartBrush`, `ReferenceArea`, `ProjectionLine`, markers, patterns and gradients.
- Styled with plain CSS variables (`--chart-*`); no Tailwind or shadcn needed.
- Server rendering works in Next.js (App Router) and TanStack Start.

## Install

```bash
pnpm add bklit-tanstack-charts @tanstack/charts @tanstack/react-charts
```

`@tanstack/charts` and `@tanstack/react-charts` are peer dependencies pinned to `~1.1.0`: the charts depend on TanStack's DOM output,
so a different minor version is not supported. npm and yarn work the same way (`npm install ...`).

Then import the stylesheet **once**, at the root of your app. The JavaScript never imports CSS itself:

```tsx skip
import "bklit-tanstack-charts/styles.css";
```

Without the stylesheet the charts render but are unstyled.

## A first chart

```tsx
import { ChartTooltip, Grid, Line, LineChart, XAxis, YAxis } from "bklit-tanstack-charts";
import "bklit-tanstack-charts/styles.css";

const data = [
  { date: new Date("2026-01-01"), users: 1200, pageviews: 4500 },
  { date: new Date("2026-01-02"), users: 1350, pageviews: 4800 },
  { date: new Date("2026-01-03"), users: 1100, pageviews: 4300 },
  { date: new Date("2026-01-04"), users: 1600, pageviews: 5200 },
];

export function Traffic() {
  return (
    <LineChart data={data} aspectRatio="2 / 1">
      <Grid horizontal />
      <Line dataKey="users" />
      <Line dataKey="pageviews" />
      <XAxis />
      <YAxis />
      <ChartTooltip />
    </LineChart>
  );
}
```

Things to know about the data:

- The time axis reads `date` from each row by default. Pass `xDataKey="day"` to use another key; values must be `Date` objects.
- `Bar` charts use a category axis instead: `<BarChart data={rows} xDataKey="month">` with string categories, and `BarXAxis` for the labels.
- A chart fills the width of its container. Give it a height with `aspectRatio` (for example `"2 / 1"`) or size the parent.
- Series colours come from `--chart-1` to `--chart-5` unless a layer sets `stroke` or `fill`.

## Theming

Everything is styled through CSS custom properties, so the charts follow your design system with or without Tailwind. Override the
variables in your own stylesheet; later rules win:

```css
:root {
  --chart-background: oklch(1 0 0);
  --chart-foreground: oklch(0.145 0.004 285);
  --chart-grid: oklch(0.9 0 0);
  --chart-crosshair: oklch(0.4 0.18 274);
  --chart-1: oklch(0.55 0.2 260);
  --chart-2: oklch(0.7 0.15 160);
}

.dark {
  --chart-background: oklch(0.145 0 0);
  --chart-foreground: oklch(0.7 0 0);
  --chart-grid: oklch(0.25 0 0);
}
```

Dark mode switches when an ancestor has the `.dark` class or `data-theme="dark"` (what `next-themes`, shadcn and most theme
toggles set). Set the variables under both selectors if you use `data-theme`.

| Group | Variables |
| --- | --- |
| Surface and text | `--chart-background`, `--chart-foreground`, `--chart-foreground-muted`, `--chart-label` |
| Lines and grid | `--chart-line-primary`, `--chart-line-secondary`, `--chart-grid`, `--chart-crosshair` |
| Indicators and markers | `--chart-indicator-color`, `--chart-indicator-secondary-color`, `--chart-marker-background`, `--chart-marker-border`, `--chart-marker-foreground`, `--chart-marker-badge-background`, `--chart-marker-badge-foreground` |
| Tooltip and selection | `--chart-tooltip-background`, `--chart-tooltip-foreground`, `--chart-tooltip-muted`, `--chart-segment-background`, `--chart-segment-line`, `--chart-brush-border`, `--chart-date-pill-background`, `--chart-date-pill-foreground` |
| Series palette | `--chart-1` ... `--chart-5` |
| Sequential scale (Heatmap, Choropleth) | `--chart-scale-01` ... `--chart-scale-05`, `--chart-scale-pattern-color` |
| Ring, Gauge and Radar tracks | `--border` |

`chartCssVars`, `chartScaleCssVars`, `pieCssVars` and the other `*CssVars` objects map names to `var(--chart-...)` strings if you
draw your own children.

## Server rendering

- **Next.js App Router**: the package entry is marked `"use client"`, so charts can be imported from Server Components; they run on the client boundary and are rendered to HTML on the server. Import the stylesheet in your root layout.
- **TanStack Start** (and any Vite SSR setup): works as is. Link the stylesheet from the root route's `head`, the way Start links its own CSS. Start's CLI scaffold needs pnpm 10.

  ```tsx skip
  // src/routes/__root.tsx
  import chartsCss from "bklit-tanstack-charts/styles.css?url";

  export const Route = createRootRoute({
    head: () => ({ links: [{ rel: "stylesheet", href: chartsCss }] }),
    // ...
  });
  ```

- Line, Area, Scatter, Bar, Candlestick, Composed, Gauge, Funnel, Sunburst, Sankey and Choropleth charts **server-render** their SVG and replay their entrance animation after hydration.
- Pie, Ring, Radar, Heatmap and Live line charts are **client-only**: the server renders an empty shell at the right size and the chart draws after mount.

## Requirements

- React 19 and `react-dom` 19.
- A runtime with ES2023 (the code uses `Array.prototype.toSorted` and friends): current evergreen browsers and Node 20+.
- The package ships ESM only, with types.

## Charts

Each page has a basic example, the data shape, every prop with its default, and notes.

| Chart | Docs |
| --- | --- |
| Line | [LineChart](docs/line-chart.md) |
| Area | [AreaChart](docs/area-chart.md) |
| Scatter | [ScatterChart](docs/scatter-chart.md) |
| Bar | [BarChart](docs/bar-chart.md) |
| Candlestick | [CandlestickChart](docs/candlestick-chart.md) |
| Composed (line, area and bars on one time axis) | [ComposedChart](docs/composed-chart.md) |
| Live line (streaming) | [LiveLineChart](docs/live-line-chart.md) |
| Pie | [PieChart](docs/pie-chart.md) |
| Ring | [RingChart](docs/ring-chart.md) |
| Radar | [RadarChart](docs/radar-chart.md) |
| Gauge | [Gauge](docs/gauge.md) |
| Funnel | [FunnelChart](docs/funnel-chart.md) |
| Heatmap | [HeatmapChart](docs/heatmap-chart.md) |
| Sunburst | [SunburstChart](docs/sunburst-chart.md) |
| Sankey | [SankeyChart](docs/sankey-chart.md) |
| Choropleth | [ChoroplethChart](docs/choropleth-chart.md) |

Layers and utilities:

| Topic | Docs |
| --- | --- |
| Grid | [Grid](docs/grid.md) |
| X and Y axes | [Axes](docs/axes.md) |
| Tooltips | [ChartTooltip](docs/tooltip.md) |
| Legends | [Legend](docs/legend.md) |
| Brush | [ChartBrush](docs/brush.md) |
| Reference areas | [ReferenceArea](docs/reference-area.md) |
| Projections | [ProjectionLine](docs/projection-line.md) |
| Profit and loss | [ProfitLossLine](docs/profit-loss-line.md) |
| Markers | [Markers](docs/markers.md) |
| Segments | [Segment selection](docs/segment.md) |
| Background | [Background](docs/background.md) |
| Patterns and gradients | [Fills](docs/patterns-and-gradients.md) |
| Shared configuration | [Chart config](docs/chart-config.md) |
| Hooks | [useChart](docs/use-chart.md) |

## Coming from bklit-ui

Swap the import path (`@bklitui/ui/charts` to `bklit-tanstack-charts`) and add the stylesheet import; props, children and the
exported names are the same. Exports marked `@internal` in the type definitions exist only so that code importing them from
bklit-ui keeps compiling; they are not part of the documented API.

### Differences from bklit-ui

- No Tailwind, shadcn or `motion` is required. Charts animate with TanStack Charts' own motion, so spring and transition props are mapped onto tweens (a spring `enterTransition` becomes a tween of its duration).
- Gradients (`LinearGradient`, `Gradient*`) and patterns (`Pattern*`) are our own implementations with the same names and props instead of re-exports of `@visx/gradient` and `@visx/pattern`.
- Not exported, because they depend on bklit-ui's React-tree and visx internals rather than on chart data:
  - `useAnimatedYDomains`: y-domain tweens run inside the chart definition (see the `yDomainTween` props).
  - `useChartInteraction`: pointer and keyboard interaction is owned by TanStack's interaction controller. Use `ChartSelection` with `ChartBrush`, `onSelectionChange`-style props and `useChartHover` to observe it.
  - `CHART_CLIP_PASSTHROUGH` and `extractProjectionLineConfigs`: these classify and scan bklit-ui's child elements by wrapper marker or component name; chart children here are collected by role.
- The pure helpers bklit-ui exports (`splitProfitLossSegments`, `computeReferenceAreaRect`, `buildSunburstEnterTiming`, `geometryFor`, `arcPath`, `mergeProjectionYDomain`, ...) are ported unchanged and behave the same. The Sunburst ones are not used to draw (the native sunburst mark computes its own geometry), so they only serve code that calls them directly.
- Pie shows the hovered slice's value in its centre (`PieCenter`) as bklit-ui does; it has no floating tooltip.
- Pie, Ring, Radar, Heatmap and Live line render after mount (see Server rendering).

## License

MIT. The component API, visual design and interaction behaviour derive from bklit-ui (MIT, Copyright (c) 2026 uixmat); the
charts render with TanStack Charts (MIT, Copyright (c) 2026-present Tanner Linsley). See `LICENSE` and `NOTICE`.
