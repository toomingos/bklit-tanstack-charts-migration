# Grid

> Adapted from the [bklit-ui documentation](https://github.com/bklit/bklit-ui) (MIT, © uixmat) for bklit-tanstack-charts.

`Grid` draws horizontal and vertical guide lines behind the series of a cartesian chart. It is a configuration child: it renders nothing by itself and is read by the chart that contains it.

```tsx
import { ChartTooltip, Grid, Line, LineChart, XAxis } from "bklit-tanstack-charts";

const data = [
  { date: new Date("2025-01-01"), value: 12 },
  { date: new Date("2025-01-02"), value: 18 },
  { date: new Date("2025-01-03"), value: 15 },
  { date: new Date("2025-01-04"), value: 24 },
];

export function Example() {
  return (
    <LineChart data={data}>
      <Grid horizontal />
      <Line dataKey="value" />
      <XAxis />
      <ChartTooltip />
    </LineChart>
  );
}
```

`Grid` works inside `LineChart`, `AreaChart`, `ScatterChart`, `BarChart`, `CandlestickChart`, `ComposedChart` and `LiveLineChart`. Without a `Grid` child the chart draws no grid lines.

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `horizontal` | `boolean` | `true` | Show horizontal grid lines. |
| `vertical` | `boolean` | `false` | Show vertical grid lines. |
| `numTicksRows` | `number` | `5` | Number of horizontal grid lines. Ignored when `rowTickValues` is set. |
| `numTicksColumns` | `number` | `10` | Number of vertical grid lines. |
| `rowTickValues` | `number[]` | - | Explicit y values for the horizontal grid lines. Overrides `numTicksRows`. |
| `stroke` | `string` | `"var(--chart-grid)"` | Color of the grid lines. |
| `loadingStroke` | `string` | - | Grid color while the chart is loading. Falls back to `stroke`. |
| `strokeOpacity` | `number` | `1` | Opacity of the grid lines. |
| `strokeWidth` | `number` | `1` | Width of the grid lines in px. |
| `strokeDasharray` | `string` | `"4,4"` | Dash pattern of the grid lines. |
| `highlightRowValues` | `number[]` | - | Y values of horizontal lines drawn with the highlight styling, for example a zero baseline. |
| `highlightRowStroke` | `string` | `"var(--chart-foreground-muted)"` | Color of the highlighted rows. |
| `highlightRowStrokeOpacity` | `number` | `1` | Opacity of the highlighted rows. |
| `highlightRowStrokeWidth` | `number` | `1` | Width of the highlighted rows in px. |
| `highlightRowStrokeDasharray` | `string` | `"0"` | Dash pattern of the highlighted rows. |
| `fadeHorizontal` | `boolean` | `true` | Fade the horizontal lines toward transparent at the left and right edges. |
| `fadeVertical` | `boolean` | `false` | Fade the vertical lines toward transparent at the top and bottom edges. |
| `hideHorizontalEdgeLines` | `boolean` | `false` | Drop the first and last horizontal line (kept when two or fewer remain). |
| `hideVerticalEdgeLines` | `boolean` | `false` | Drop the first and last vertical line (kept when two or fewer remain). |
| `yAxisId` | `string \| number` | - | Accepted for bklit-ui compatibility. It has no effect in bklit-tanstack-charts. The grid follows the primary (left) y scale. |
| `shimmer` | `boolean` | `false` | While the chart is loading, sweep a bright band across the grid. |
| `shimmerStroke` | `string` | `"color-mix(in oklch, var(--foreground) 68%, transparent)"` | Color of the shimmer band. |
| `shimmerLength` | `number` | - | Accepted for bklit-ui compatibility. It has no effect in bklit-tanstack-charts. |
| `shimmerSpeed` | `number` | `1` | Speed multiplier of the shimmer sweep. `2` is twice as fast. |
| `shimmerSync` | `boolean` | - | Accepted for bklit-ui compatibility. It has no effect in bklit-tanstack-charts. |

## Gotchas

- Only horizontal lines are on by default. Set `vertical` to add vertical ones.
- Horizontal lines follow the primary (left) y axis ticks. `YAxis numTicks` on the primary axis also sets the number of horizontal lines.
- The grid fades toward transparent at the edges (`fadeHorizontal`). Turn the fade off for solid full-width lines.
- `loadingStroke` and `shimmer` only matter while the chart `status` is `"loading"`.

## Examples

### Vertical and horizontal lines

```tsx
import { ChartTooltip, Grid, Line, LineChart, XAxis } from "bklit-tanstack-charts";

const data = [
  { date: new Date("2025-01-01"), value: 12 },
  { date: new Date("2025-01-02"), value: 18 },
  { date: new Date("2025-01-03"), value: 15 },
  { date: new Date("2025-01-04"), value: 24 },
];

export function Example() {
  return (
    <LineChart data={data}>
      <Grid horizontal vertical numTicksColumns={4} strokeDasharray="2,4" />
      <Line dataKey="value" />
      <XAxis />
      <ChartTooltip />
    </LineChart>
  );
}
```

### Highlighted baseline

`highlightRowValues` draws chosen horizontal lines with the `highlightRow*` styling, for example a zero baseline for data that crosses zero.

```tsx
import { ChartTooltip, Grid, Line, LineChart, XAxis } from "bklit-tanstack-charts";

const data = [
  { date: new Date("2025-01-01"), pnl: -40 },
  { date: new Date("2025-01-02"), pnl: 25 },
  { date: new Date("2025-01-03"), pnl: -10 },
  { date: new Date("2025-01-04"), pnl: 60 },
];

export function Example() {
  return (
    <LineChart data={data}>
      <Grid horizontal highlightRowValues={[0]} highlightRowStrokeDasharray="0" />
      <Line dataKey="pnl" />
      <XAxis />
      <ChartTooltip />
    </LineChart>
  );
}
```

### Explicit row values

```tsx
import { ChartTooltip, Grid, Line, LineChart, XAxis, YAxis } from "bklit-tanstack-charts";

const data = [
  { date: new Date("2025-01-01"), value: 12 },
  { date: new Date("2025-01-02"), value: 18 },
  { date: new Date("2025-01-03"), value: 15 },
  { date: new Date("2025-01-04"), value: 24 },
];

export function Example() {
  return (
    <LineChart data={data}>
      <Grid horizontal rowTickValues={[0, 10, 20, 30]} hideHorizontalEdgeLines />
      <Line dataKey="value" />
      <YAxis />
      <XAxis />
      <ChartTooltip />
    </LineChart>
  );
}
```

## Notes

### Theming

The lines use `--chart-grid`; highlighted rows use `--chart-foreground-muted`. Override the variables on an ancestor or pass `stroke` and `highlightRowStroke`.

### Server rendering

The grid server-renders with its chart.

### Differences from bklit-ui

- `yAxisId`, `shimmerLength` and `shimmerSync` are accepted for compatibility and have no effect. The grid always follows the primary y scale.

## Related

- [Axes](./axes.md)
- [LineChart](./line-chart.md)
- [Background](./background.md)
