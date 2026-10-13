---
name: getting-started
description: >
  Install and use bklit-tanstack-charts (TanStack Bklit UI Charts, the bklit-ui chart components on TanStack Charts 1.1) in a React 19 app:
  install the package and the two TanStack peers, import the stylesheet once, render a first LineChart, theme it with --chart-* CSS
  variables and dark mode, and know which charts server-render in Next.js App Router or TanStack Start and which are client-only.
  Use when adding charts to a project, when a chart renders unstyled, empty or without a height, or when moving bklit-ui chart code over.
metadata:
  type: core
  library: bklit-tanstack-charts
  library_version: "0.1.0"
sources:
  - "bklit-tanstack-charts:README.md"
  - "bklit-tanstack-charts:docs/line-chart.md"
---

# Getting started with bklit-tanstack-charts

## Install

```bash
pnpm add bklit-tanstack-charts @tanstack/charts @tanstack/react-charts
```

Peers: React 19, `@tanstack/charts` and `@tanstack/react-charts` at `~1.1.0`. The runtime must support ES2023. The package is ESM only.

## Import the stylesheet once

At the app root (Next.js `app/layout.tsx`, TanStack Start root route, or the client entry):

```tsx skip
import "bklit-tanstack-charts/styles.css";
```

Forgetting it is the most common problem: charts render, but unstyled and without hover styling.

## First chart

```tsx
import { ChartTooltip, Grid, Line, LineChart, XAxis, YAxis } from "bklit-tanstack-charts";

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

Rules that cause most mistakes:

- Charts are composed from children (`Grid`, `Line`, `XAxis`, `ChartTooltip`, ...). A layer that is not a child does nothing.
- The x key defaults to `"date"` and its values must be `Date` objects; pass `xDataKey` for another key. Bar charts use string categories.
- A chart fills its container's width. Set the height with `aspectRatio` (such as `"2 / 1"`) or a sized parent; a chart in a zero-height parent is invisible.
- Colours default to `--chart-1` ... `--chart-5`; a layer's `stroke` or `fill` overrides.

## Theming

Override the CSS variables; there is nothing to configure in JavaScript:

```css
:root {
  --chart-grid: oklch(0.9 0 0);
  --chart-crosshair: oklch(0.4 0.18 274);
  --chart-1: oklch(0.55 0.2 260);
  --chart-2: oklch(0.7 0.15 160);
}

.dark {
  --chart-grid: oklch(0.25 0 0);
}
```

Dark mode follows an ancestor `.dark` class or `data-theme="dark"`. Heatmap and Choropleth use `--chart-scale-01` ... `--chart-scale-05`;
Ring, Gauge and Radar tracks use `--border`. Works with or without Tailwind and shadcn.

## Server rendering

- Next.js App Router: the entry is `"use client"`; import charts anywhere, they render to HTML on the server. TanStack Start also works. (The TanStack CLI scaffold needs pnpm 10.)
- Server-rendered, entrance replays after hydration: Line, Area, Scatter, Bar, Candlestick, Composed, Gauge, Funnel, Sunburst, Sankey, Choropleth.
- Client-only (empty shell on the server, draws after mount): Pie, Ring, Radar, Heatmap, LiveLine. Do not expect them in the server HTML.

## Next

See the `chart-recipes` skill for one example per chart family, and `docs/<chart>.md` in the package for every prop and its default.
