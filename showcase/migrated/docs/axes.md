# Axes

> Adapted from the [bklit-ui documentation](https://github.com/bklit/bklit-ui) (MIT, © uixmat) for bklit-tanstack-charts.

`XAxis` and `YAxis` label the time and value axes of the cartesian charts. `BarXAxis` and `BarYAxis` label the category and value axes of `BarChart`. All are configuration children: they render nothing by themselves and are read by the chart that contains them. Without them the chart draws no axis labels.

```tsx
import { ChartTooltip, Grid, Line, LineChart, XAxis, YAxis } from "bklit-tanstack-charts";

const data = [
  { date: new Date("2025-01-01"), revenue: 1200 },
  { date: new Date("2025-01-02"), revenue: 1800 },
  { date: new Date("2025-01-03"), revenue: 1500 },
  { date: new Date("2025-01-04"), revenue: 2400 },
];

export function Example() {
  return (
    <LineChart data={data}>
      <Grid horizontal />
      <Line dataKey="revenue" />
      <XAxis />
      <YAxis />
      <ChartTooltip />
    </LineChart>
  );
}
```

Axis labels sit in the chart margin. Increase `margin` on the chart if labels are clipped, especially for a second `YAxis` or long value labels.

## XAxis

Date labels along the bottom of `LineChart`, `AreaChart`, `ScatterChart`, `CandlestickChart` and `ComposedChart`. When the tooltip is visible, labels near the date pill fade out so they do not collide with it.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `numTicks` | `number` | `5` | Target number of tick labels along the x axis. |
| `tickerHalfWidth` | `number` | `50` | Half-width in px of the zone around the date pill inside which tick labels are hidden. Only `BarChart` reads it. |
| `tickMode` | `"domain" \| "data"` | `"data"` | Where ticks fall: `"data"` places them on evenly spaced data rows, `"domain"` places them at evenly spaced time values across the x domain. |
| `formatValue` | `((value: Readonly<Date>) => string)` | - | Formats a tick date into its label. Defaults to a short month and day such as "Jan 5". |

- By default ticks sit on evenly spaced data rows, so each label lines up with a row the crosshair can land on. `tickMode="domain"` spaces labels evenly across the time range instead.
- The default label is a short month and day such as "Jan 5". Pass `formatValue` for anything else.

```tsx
import { ChartTooltip, Grid, Line, LineChart, XAxis } from "bklit-tanstack-charts";

const data = [
  { date: new Date("2025-01-01"), value: 12 },
  { date: new Date("2025-01-08"), value: 18 },
  { date: new Date("2025-01-15"), value: 15 },
  { date: new Date("2025-01-22"), value: 24 },
];

export function Example() {
  return (
    <LineChart data={data}>
      <Grid horizontal />
      <Line dataKey="value" />
      <XAxis
        numTicks={4}
        tickMode="domain"
        formatValue={(date) => date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
      />
      <ChartTooltip />
    </LineChart>
  );
}
```

## YAxis

Value labels on the left or right of the plot. The axis without a `yAxisId` is the primary axis; the primary axis also sets how many horizontal grid lines `Grid` draws unless `Grid` overrides it.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `yAxisId` | `string \| number` | `"left"` | Id of the y scale this axis labels. Must match the `yAxisId` of the series that use it. |
| `orientation` | `"left" \| "right"` | `"left"` | Side of the plot the axis sits on. The primary axis is on the left; additional axes default to the right. |
| `numTicks` | `number` | `5` | Target number of tick labels. The primary axis also sets the number of horizontal grid lines. |
| `formatLargeNumbers` | `boolean` | `true` | Abbreviate values of 1000 and above as thousands, for example `2k`. |
| `formatValue` | `((value: number) => string)` | - | Formats a tick value into its label. Overrides `formatLargeNumbers`. |

- Values of 1000 and above are abbreviated (`2k`) unless you set `formatLargeNumbers={false}` or pass `formatValue`.
- For two scales, give each series a `yAxisId` and add a `YAxis` with the same id. Additional axes default to the right side. See [dual axes](./line-chart.md#multiple-series-and-dual-axes).

```tsx
import { ChartTooltip, Grid, Line, LineChart, XAxis, YAxis } from "bklit-tanstack-charts";

const data = [
  { date: new Date("2025-01-01"), revenue: 1200 },
  { date: new Date("2025-01-02"), revenue: 1800 },
  { date: new Date("2025-01-03"), revenue: 1500 },
  { date: new Date("2025-01-04"), revenue: 2400 },
];

export function Example() {
  return (
    <LineChart data={data}>
      <Grid horizontal />
      <Line dataKey="revenue" />
      <XAxis />
      <YAxis numTicks={4} formatValue={(value) => `$${value}`} />
      <ChartTooltip />
    </LineChart>
  );
}
```

## BarXAxis and BarYAxis

In a vertical `BarChart` (the default), `BarXAxis` labels the categories along the bottom and `BarYAxis` labels the values on the left. In a horizontal chart (`orientation="horizontal"`) `BarYAxis` labels the categories, its category options (`showAllLabels`, `maxLabels`) apply, the value axis has no labels, and `BarXAxis` is not used.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `tickerHalfWidth` | `number` | `50` | Half-width in px of the zone around the date pill inside which tick labels are hidden. |
| `showAllLabels` | `boolean` | `false` | Show every category label instead of thinning to `maxLabels`. |
| `maxLabels` | `number` | `12` | Maximum number of category labels when `showAllLabels` is off. |

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `showAllLabels` | `boolean` | `true` | Horizontal charts: show every category label instead of thinning to `maxLabels`. |
| `maxLabels` | `number` | `20` | Horizontal charts: maximum number of category labels when `showAllLabels` is off. |
| `numTicks` | `number` | `5` | Vertical charts: target number of value ticks. Grid settings take precedence. |
| `formatLargeNumbers` | `boolean` | `true` | Vertical charts: abbreviate values of 1000 and above as thousands, for example `2k`. |
| `formatValue` | `((value: number) => string)` | - | Vertical charts: formats a value tick into its label. Overrides `formatLargeNumbers`. |
| `orientation` | `"left" \| "right"` | - | Accepted for bklit-ui compatibility. It has no effect in bklit-tanstack-charts. The value axis is always on the left. |

```tsx
import { Bar, BarChart, BarXAxis, BarYAxis, ChartTooltip, Grid } from "bklit-tanstack-charts";

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
      <BarYAxis />
      <ChartTooltip />
    </BarChart>
  );
}
```

## LiveXAxis and LiveYAxis

`LiveLineChart` has its own time and value axes, documented with the chart: see [LiveLineChart](./live-line-chart.md#livexaxis-props).

## Notes

### Theming

Labels use the `--chart-label` color. Override it on any ancestor to restyle every axis.

### Server rendering

Axes server-render with their chart (except for `LiveLineChart`, which draws after mount).

### Differences from bklit-ui

- `BarYAxis` accepts `orientation` for compatibility; it has no effect. The value axis is always on the left.
- `tickerHalfWidth` is read by `BarChart` only; on the other charts it has no effect.

## Related

- [Grid](./grid.md)
- [ChartTooltip](./tooltip.md)
- [LineChart](./line-chart.md), [BarChart](./bar-chart.md)
