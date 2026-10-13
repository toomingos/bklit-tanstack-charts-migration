# ComposedChart

> Adapted from the [bklit-ui documentation](https://github.com/bklit/bklit-ui) (MIT, © uixmat) for bklit-tanstack-charts.

`ComposedChart` mixes bars, lines and areas on one shared x axis and y scale. Use `SeriesBar` for the bars and the regular `Line` and `Area` children for the rest.

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

## Data shape

- Each row holds the x value under `xDataKey` (default `"date"`, a `Date`) and one number per series under its `dataKey`.
- All series share one y scale. Areas are drawn from the bottom of the y domain and overlap rather than stack.
- Children are drawn in the order you write them.

## ComposedChart props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `data` (required) | `ChartDatum[]` | - | The rows to plot. Each row holds the x value under `xDataKey` and one number per series under that series' `dataKey`. |
| `xDataKey` | `string` | `"date"` | Key of the x value in each row. The value must be a `Date` (or something `new Date()` accepts). |
| `animationDuration` | `number` | `1100` | Duration of the entrance in milliseconds. `enterTransition.duration` overrides it. |
| `margin` | `Partial<ChartMargin>` | `{ top: 40, right: 40, bottom: 40, left: 40 }` | Space around the plot area in pixels. Missing sides use the default. |
| `aspectRatio` | `string` | `"2 / 1"` | CSS aspect ratio of the chart, as `"width / height"`. |
| `className` | `string` | - | Extra CSS class name for the chart container. |
| `onPhaseChange` | `((phase: ChartPhase) => void)` | - | Called with `"ready"` when the chart mounts. |
| `barSize` | `number` | - | Target `SeriesBar` width in px. When unset, bars size to the available space. |
| `maxBarSize` | `number` | - | Maximum `SeriesBar` width in px. |
| `barGap` | `number` | `4` | Gap between the grouped `SeriesBar` columns in px. |
| `stacked` | `boolean` | `false` | Stack the `SeriesBar` segments in child order instead of grouping them. |
| `stackGap` | `number` | `0` | Vertical gap between stacked segments in px. |
| `animationEasing` | `string` | - | Accepted for bklit-ui compatibility. It has no effect in bklit-tanstack-charts. The entrance always uses the default tween ease. |
| `enterTransition` | `Transition` | - | Overrides the entrance duration (`duration` is in seconds, as in bklit-ui). Springs are treated as the default tween. |
| `revealSignature` | `string` | - | Changing this string replays the entrance animation. |
| `children` (required) | `ReactNode` | - | The layers to draw: `SeriesBar`, `Line`, `Area`, `Grid`, `XAxis`, `YAxis`, `ChartTooltip` and the other chart children. |
| `ariaLabel` | `string` | `"Composed chart"` | Accessible name of the chart. |
| `ariaDescription` | `string` | - | Longer accessible description of the chart, exposed as `aria-description`. |

## SeriesBar props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `dataKey` (required) | `string` | - | Key of the data field that holds the bar heights. |
| `fill` | `string` | `"var(--chart-line-primary)"` | Fill color of the bars. |
| `stroke` | `string` | - | Color of the tooltip dot, for when `fill` is a gradient or pattern. Defaults to `fill`. |
| `radius` | `number` | `0` | Corner radius of the bars in px. |
| `animate` | `boolean` | `true` | Grow the bars from the baseline on entrance. |
| `fadedOpacity` | `number` | `0.3` | Opacity of the bars that are not hovered while another x position is focused. |

`Line` and `Area` take the same props as in [LineChart](./line-chart.md#line-props) and [AreaChart](./area-chart.md#area-props).

## Examples

### Stacked bars

```tsx
import { ChartTooltip, ComposedChart, Grid, SeriesBar, XAxis, YAxis } from "bklit-tanstack-charts";

const data = [
  { date: new Date("2025-01-01"), organic: 80, paid: 40 },
  { date: new Date("2025-01-02"), organic: 110, paid: 70 },
  { date: new Date("2025-01-03"), organic: 90, paid: 60 },
];

export function Example() {
  return (
    <ComposedChart data={data} stacked stackGap={2} maxBarSize={48}>
      <Grid horizontal />
      <SeriesBar dataKey="organic" fill="var(--chart-1)" />
      <SeriesBar dataKey="paid" fill="var(--chart-2)" />
      <XAxis />
      <YAxis />
      <ChartTooltip />
    </ComposedChart>
  );
}
```

## Notes

### Keyboard and hover

Hovering moves the crosshair to the nearest x position and fades the bars at other positions. With keyboard focus on the chart, the arrow keys move between positions and Home and End jump to the first and last.

### Theming

Series colors come from the `fill` and `stroke` props, which accept `--chart-*` variables. Grid, axes and tooltip use the shared chart variables.

### Server rendering

`ComposedChart` server-renders and replays its entrance after hydration.

### Differences from bklit-ui

- `animationEasing` is accepted for compatibility and has no effect. `enterTransition` only changes the entrance duration; springs are treated as the default tween.

## Related

- [LineChart](./line-chart.md), [AreaChart](./area-chart.md), [BarChart](./bar-chart.md)
- [Axes](./axes.md), [Grid](./grid.md), [ChartTooltip](./tooltip.md)
