---
name: chart-recipes
description: >
  One compact, type-checked example per chart family of bklit-tanstack-charts (TanStack Bklit UI Charts): Line, Area, Scatter, Bar,
  Candlestick, Composed, LiveLine, Pie, Ring, Radar, Gauge, Funnel, Heatmap, Sunburst, Sankey and Choropleth, with the data shape each
  one expects. Use when choosing a chart, shaping data for a chart, or when a chart renders empty because of wrong data keys,
  Date versus string x values, or Radar metrics and index.
metadata:
  type: core
  library: bklit-tanstack-charts
  library_version: "0.1.0"
sources:
  - "bklit-tanstack-charts:docs/line-chart.md"
  - "bklit-tanstack-charts:docs/radar-chart.md"
---

# Chart recipes

Import the stylesheet once (see `getting-started`). Every example is a standalone module; full prop tables with defaults are in
`docs/<chart>.md` of the package. Layers (`Grid`, `XAxis`, `ChartTooltip`, ...) are children of the chart.

## Line

Time series; layers are children. Multiple `Line`s share one y scale.

```tsx
import { ChartTooltip, Grid, Line, LineChart, XAxis } from "bklit-tanstack-charts";

const data = [
  { date: new Date("2025-01-01"), revenue: 1200 },
  { date: new Date("2025-01-02"), revenue: 1800 },
  { date: new Date("2025-01-03"), revenue: 1500 },
  { date: new Date("2025-01-04"), revenue: 2400 },
  { date: new Date("2025-01-05"), revenue: 2100 },
];

export function Example() {
  return (
    <LineChart data={data}>
      <Grid horizontal />
      <Line dataKey="revenue" />
      <XAxis />
      <ChartTooltip />
    </LineChart>
  );
}
```

## Area

Same data shape as Line.

```tsx
import { Area, AreaChart, ChartTooltip, Grid, XAxis } from "bklit-tanstack-charts";

const data = [
  { date: new Date("2025-01-01"), visitors: 320 },
  { date: new Date("2025-01-02"), visitors: 410 },
  { date: new Date("2025-01-03"), visitors: 380 },
  { date: new Date("2025-01-04"), visitors: 520 },
  { date: new Date("2025-01-05"), visitors: 470 },
];

export function Example() {
  return (
    <AreaChart data={data}>
      <Grid horizontal />
      <Area dataKey="visitors" />
      <XAxis />
      <ChartTooltip />
    </AreaChart>
  );
}
```

## Scatter

Points over a time axis.

```tsx
import { ChartTooltip, Grid, Scatter, ScatterChart, XAxis } from "bklit-tanstack-charts";

const data = [
  { date: new Date("2025-01-01"), users: 1200 },
  { date: new Date("2025-02-01"), users: 1350 },
  { date: new Date("2025-03-01"), users: 1100 },
  { date: new Date("2025-04-01"), users: 1500 },
];

export function Example() {
  return (
    <ScatterChart data={data}>
      <Grid horizontal />
      <Scatter dataKey="users" />
      <XAxis />
      <ChartTooltip />
    </ScatterChart>
  );
}
```

## Bar

Category axis: `xDataKey` defaults to `"name"` and values are strings; use `BarXAxis`.

```tsx
import { Bar, BarChart, BarXAxis, ChartTooltip, Grid } from "bklit-tanstack-charts";

const data = [
  { name: "Jan", sales: 120 },
  { name: "Feb", sales: 180 },
  { name: "Mar", sales: 150 },
  { name: "Apr", sales: 240 },
];

export function Example() {
  return (
    <BarChart data={data}>
      <Grid horizontal />
      <Bar dataKey="sales" />
      <BarXAxis />
      <ChartTooltip />
    </BarChart>
  );
}
```

## Candlestick

Rows hold `date`, `open`, `high`, `low`, `close`.

```tsx
import { Candlestick, CandlestickChart, ChartTooltip, Grid, XAxis, YAxis } from "bklit-tanstack-charts";

const data = [
  { date: new Date("2025-01-01"), open: 100, high: 112, low: 96, close: 108 },
  { date: new Date("2025-01-02"), open: 108, high: 115, low: 104, close: 106 },
  { date: new Date("2025-01-03"), open: 106, high: 118, low: 105, close: 117 },
  { date: new Date("2025-01-04"), open: 117, high: 120, low: 109, close: 111 },
];

export function Example() {
  return (
    <CandlestickChart data={data}>
      <Grid horizontal />
      <Candlestick />
      <XAxis />
      <YAxis />
      <ChartTooltip />
    </CandlestickChart>
  );
}
```

## Composed

Bars, lines and areas on one time axis and one y scale.

```tsx
import { Area, ChartTooltip, ComposedChart, Grid, Line, SeriesBar, XAxis, YAxis } from "bklit-tanstack-charts";

const data = [
  { date: new Date("2025-01-01"), revenue: 120, target: 100, trend: 90 },
  { date: new Date("2025-01-02"), revenue: 180, target: 110, trend: 120 },
  { date: new Date("2025-01-03"), revenue: 150, target: 120, trend: 140 },
  { date: new Date("2025-01-04"), revenue: 240, target: 130, trend: 170 },
];

export function Example() {
  return (
    <ComposedChart data={data}>
      <Grid horizontal />
      <Area dataKey="trend" fill="var(--chart-2)" />
      <SeriesBar dataKey="revenue" fill="var(--chart-1)" radius={4} />
      <Line dataKey="target" stroke="var(--chart-3)" />
      <XAxis />
      <YAxis />
      <ChartTooltip />
    </ComposedChart>
  );
}
```

## Live line

Streaming; `time` is Unix seconds. Client-only.

```tsx
import { useEffect, useState } from "react";
import { ChartTooltip, LiveLine, LiveLineChart, LiveXAxis, LiveYAxis } from "bklit-tanstack-charts";

interface Point {
  readonly time: number;
  readonly value: number;
}

export function Example() {
  const [data, setData] = useState<Point[]>([]);
  const [value, setValue] = useState(100);

  useEffect(() => {
    const id = setInterval(() => {
      const next = { time: Date.now() / 1000, value: 100 + Math.random() * 10 };
      setData((prev) => [...prev.slice(-500), next]);
      setValue(next.value);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <LiveLineChart data={data} value={value} window={30} style={{ height: 240 }}>
      <LiveLine dataKey="value" stroke="var(--chart-line-primary)" formatValue={(v) => `$${v.toFixed(2)}`} />
      <ChartTooltip showDatePill={false} />
      <LiveXAxis />
      <LiveYAxis position="left" />
    </LiveLineChart>
  );
}
```

## Pie

The hovered value shows in the centre, there is no tooltip. Client-only.

```tsx
import { PieChart, PieSlice } from "bklit-tanstack-charts";

const data = [
  { label: "Electronics", value: 4250 },
  { label: "Clothing", value: 3120 },
  { label: "Food", value: 2100 },
];

export function Example() {
  return (
    <PieChart data={data} size={280}>
      {data.map((item, index) => (
        <PieSlice index={index} key={item.label} />
      ))}
    </PieChart>
  );
}
```

## Ring

One ring per row, `value` out of `maxValue`. Client-only.

```tsx
import { Ring, RingCenter, RingChart } from "bklit-tanstack-charts";

const data = [
  { label: "Move", maxValue: 100, value: 85 },
  { label: "Exercise", maxValue: 100, value: 62 },
  { label: "Stand", maxValue: 100, value: 45 },
];

export function Example() {
  return (
    <RingChart data={data} size={280}>
      {data.map((item, index) => (
        <Ring index={index} key={item.label} />
      ))}
      <RingCenter defaultLabel="Activity" />
    </RingChart>
  );
}
```

## Radar

`metrics` are the axes; each `data` row is a series with `values` keyed by metric key (0 to 100), drawn by `<RadarArea index={n} />`. Client-only.

```tsx
import { RadarArea, RadarAxis, RadarChart, RadarGrid, RadarLabels } from "bklit-tanstack-charts";

const metrics = [
  { key: "speed", label: "Speed" },
  { key: "power", label: "Power" },
  { key: "range", label: "Range" },
  { key: "comfort", label: "Comfort" },
  { key: "safety", label: "Safety" },
];

const data = [
  { label: "Model A", values: { comfort: 55, power: 90, range: 60, safety: 80, speed: 75 } },
  { label: "Model B", values: { comfort: 85, power: 50, range: 80, safety: 70, speed: 65 } },
];

export function Example() {
  return (
    <RadarChart data={data} metrics={metrics} size={360}>
      <RadarGrid />
      <RadarAxis />
      <RadarLabels />
      <RadarArea index={0} />
      <RadarArea index={1} />
    </RadarChart>
  );
}
```

## Gauge

`value` is 0 to 100.

```tsx
import { Gauge } from "bklit-tanstack-charts";

export function Example() {
  return <Gauge centerValue={72} defaultLabel="Health" suffix="%" value={72} />;
}
```

## Funnel

The first stage counts as 100%.

```tsx
import { FunnelChart } from "bklit-tanstack-charts";

const data = [
  { label: "Visitors", value: 12000 },
  { label: "Signups", value: 6400 },
  { label: "Trials", value: 2800 },
  { label: "Customers", value: 900 },
];

export function Example() {
  return <FunnelChart data={data} />;
}
```

## Heatmap

Week columns of day cells. Client-only.

```tsx
import {
  HeatmapCells,
  HeatmapChart,
  HeatmapInteractionBoundary,
  HeatmapInteractionProvider,
  HeatmapLegend,
  HeatmapTooltip,
  HeatmapXAxis,
  HeatmapYAxis,
} from "bklit-tanstack-charts";
import type { HeatmapColumn } from "bklit-tanstack-charts";

// 26 week columns of 7 day cells, starting on Sunday 7 January 2024.
const data: HeatmapColumn[] = Array.from({ length: 26 }, (_, week) => ({
  bin: week,
  bins: Array.from({ length: 7 }, (_, day) => ({
    bin: day,
    count: (week * 3 + day * 2) % 5,
    date: new Date(2024, 0, 7 + week * 7 + day),
  })),
}));

export function Example() {
  return (
    <HeatmapInteractionProvider>
      <HeatmapInteractionBoundary>
        <HeatmapChart data={data} layout="fluid">
          <HeatmapCells />
          <HeatmapXAxis />
          <HeatmapYAxis />
          <HeatmapTooltip />
        </HeatmapChart>
        <HeatmapLegend />
      </HeatmapInteractionBoundary>
    </HeatmapInteractionProvider>
  );
}
```

## Sunburst

Hierarchical `data` tree; leaves carry `value`.

```tsx
import { SunburstCenter, SunburstChart, SunburstHint, SunburstLabels } from "bklit-tanstack-charts";
import type { SunburstNode } from "bklit-tanstack-charts";

const data: SunburstNode = {
  name: "Revenue",
  children: [
    { name: "Product", children: [{ name: "Enterprise", value: 198 }, { name: "Pro", value: 145 }] },
    { name: "Services", children: [{ name: "Consulting", value: 160 }, { name: "Support", value: 90 }] },
  ],
};

export function Example() {
  return (
    <SunburstChart data={data} size={440}>
      <SunburstCenter />
      <SunburstLabels />
      <SunburstHint />
    </SunburstChart>
  );
}
```

## Sankey

`links` reference `nodes` by index.

```tsx
import { SankeyChart, SankeyLink, SankeyNode, SankeyTooltip } from "bklit-tanstack-charts";
import type { SankeyData } from "bklit-tanstack-charts";

const data: SankeyData = {
  nodes: [
    { name: "Organic Search", category: "source" },
    { name: "Paid Search", category: "source" },
    { name: "Homepage", category: "landing" },
    { name: "Pricing", category: "landing" },
    { name: "Converted", category: "outcome" },
    { name: "Bounced", category: "outcome" },
  ],
  links: [
    { source: 0, target: 2, value: 4200 },
    { source: 0, target: 3, value: 1500 },
    { source: 1, target: 3, value: 3100 },
    { source: 1, target: 2, value: 800 },
    { source: 2, target: 4, value: 2100 },
    { source: 2, target: 5, value: 2900 },
    { source: 3, target: 4, value: 4500 },
    { source: 3, target: 5, value: 100 },
  ],
};

export function Example() {
  return (
    <SankeyChart data={data} aspectRatio="16 / 9">
      <SankeyLink />
      <SankeyNode lineCap={4} labelOrientation="vertical" />
      <SankeyTooltip />
    </SankeyChart>
  );
}
```

## Choropleth

`data` is a GeoJSON FeatureCollection object, not TopoJSON.

```tsx
import {
  ChoroplethChart,
  ChoroplethFeatureComponent,
  ChoroplethGraticule,
  ChoroplethTooltip,
} from "bklit-tanstack-charts";
import type { ChoroplethChartProps } from "bklit-tanstack-charts";

const data = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { name: "West" },
      geometry: { type: "Polygon", coordinates: [[[-40, 0], [0, 0], [0, 40], [-40, 40], [-40, 0]]] },
    },
    {
      type: "Feature",
      properties: { name: "East" },
      geometry: { type: "Polygon", coordinates: [[[0, 0], [40, 0], [40, 40], [0, 40], [0, 0]]] },
    },
  ],
} satisfies ChoroplethChartProps["data"];

export function Example() {
  return (
    <ChoroplethChart data={data} aspectRatio="16 / 9">
      <ChoroplethGraticule />
      <ChoroplethFeatureComponent />
      <ChoroplethTooltip />
    </ChoroplethChart>
  );
}
```
