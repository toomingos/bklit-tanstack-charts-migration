# ScatterChart

> Adapted from the [bklit-ui documentation](https://github.com/bklit/bklit-ui) (MIT, © uixmat) for bklit-tanstack-charts.

A time-series scatter chart: one dot per row for each `Scatter` series, with an offset ring, hover dimming and an animated entrance. It shares `Grid`, `XAxis`, `YAxis` and `ChartTooltip` with the other cartesian charts.

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

## Data shape

```ts
interface Row {
  date: Date; // the x value, under the key given by xDataKey
  users: number; // one number per Scatter, under that Scatter's dataKey
}
```

- The x value is read from `xDataKey`, which defaults to `"date"`. It must be a `Date`, or something `new Date()` accepts. The x axis is a time scale, not a numeric one.
- Each `Scatter` reads its y values from the field named by its `dataKey`.
- `data` and `children` are required.
- Series colors default to the chart palette (`--chart-1` to `--chart-5`) in child order.

## ScatterChart props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `data` (required) | `readonly Row[]` | - | The rows to plot. Each row holds the x value under `xDataKey` and one number per `Scatter` series under that series' `dataKey`. |
| `xDataKey` | `string` | `"date"` | Key of the x value in each row. The value must be a `Date` (or something `new Date()` accepts, such as a timestamp). |
| `animationDuration` | `number` | `1100` | Duration of the entrance reveal in milliseconds. `0` skips the animation. `enterTransition.duration` overrides it. |
| `margin` | `Partial<ChartMargin>` | `{ top: 40, right: 40, bottom: 40, left: 40 }` | Space around the plot area in pixels. Missing sides use the default. |
| `aspectRatio` | `string` | `"2 / 1"` | CSS aspect ratio of the chart (`"width / height"` or a number), applied to the container width. |
| `className` | `string` | - | Extra CSS class name for the chart container. |
| `style` | `CSSProperties` | - | Inline styles for the chart container. |
| `onPhaseChange` | `((phase: ScatterChartPhase) => void)` | - | Called with `"revealing"` when the entrance starts and `"ready"` when the chart becomes interactive. |
| `animationEasing` | `string` | - | CSS easing for the per-point entrance, for example `"cubic-bezier(0.85, 0, 0.15, 1)"`. When unset, `enterTransition.ease` or the default reveal easing is used. |
| `enterTransition` | `{ readonly duration?: number; readonly ease?: unknown; }` | - | Entrance timing: `duration` (in seconds) sets the length of the reveal and `ease` (a four-number cubic bezier) the easing. |
| `revealSignature` | `string` | - | Changing this string replays the entrance animation. |
| `children` (required) | `ReactNode` | - | The layers to draw: `Grid`, one or more `Scatter`, `XAxis`, `YAxis`, `ChartTooltip` and the other chart children. |
| `ariaLabel` | `string` | `"Scatter chart"` | Accessible name of the chart. |
| `ariaDescription` | `string` | - | Longer accessible description of the chart, exposed as `aria-description`. |

## Scatter props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `dataKey` (required) | `string` | - | Key of the data field that holds this series' y values. |
| `yAxisId` | `string \| number` | `"left"` | Id of the y scale this series is plotted against. |
| `animate` | `boolean` | `true` | Whether the dots animate in on entrance. |
| `fill` | `string` | - | Fill color of the dots. Defaults to `stroke`, then to a color from the chart palette. |
| `stroke` | `string` | - | Color of the ring around each dot. Defaults to the resolved fill. |
| `strokeWidth` | `number` | `2` | Width of the ring around each dot in px. |
| `ringGap` | `number` | `2` | Gap between the dot and its ring in px. |
| `radius` | `number` | `5` | Radius of the dot in px. |
| `yGradient` | `boolean \| Readonly<{ from?: string; to?: string; }>` | - | Fills the dots with a color that ends at `to` (or a default accent color when `true`). Overrides `fill`; the ring follows unless `stroke` is set. |
| `fadeOnHover` | `boolean` | `true` | Dim the dots that are not hovered while the chart is hovered. |
| `inactiveOpacity` | `number` | `0.5` | Opacity of the dimmed dots when `fadeOnHover` is on. |
| `inactiveBlur` | `number` | `2` | Blur in px of the dimmed dots when `fadeOnHover` is on. |
| `enterBlur` | `number` | `2` | Blur in px the dots start from while they fade in on entrance. |
| `showActiveHighlight` | `boolean` | `true` | Draw the hovered dot 1.35 times larger. |
| `outlineWidth` | `number` | `0` | Width in px of an optional outline drawn outside the ring. `0` draws none. |
| `outlineColor` | `string` | - | Color of the outline. Defaults to the ring color. |

## Multiple series

```tsx
import { ChartTooltip, Grid, Scatter, ScatterChart, XAxis } from "bklit-tanstack-charts";

const data = [
  { date: new Date("2025-01-01"), sessions: 320, conversions: 40 },
  { date: new Date("2025-02-01"), sessions: 410, conversions: 55 },
  { date: new Date("2025-03-01"), sessions: 380, conversions: 48 },
  { date: new Date("2025-04-01"), sessions: 520, conversions: 70 },
];

export function Example() {
  return (
    <ScatterChart data={data}>
      <Grid horizontal />
      <Scatter dataKey="sessions" />
      <Scatter dataKey="conversions" />
      <XAxis />
      <ChartTooltip />
    </ScatterChart>
  );
}
```

## Offset ring and hover

Each dot is a fill plus an outer ring separated by `ringGap`. While the chart is hovered, the other dots dim and blur (`fadeOnHover`, `inactiveOpacity`, `inactiveBlur`) and the active dot scales up (`showActiveHighlight`).

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
      <Scatter dataKey="users" radius={6} strokeWidth={2} ringGap={3} inactiveOpacity={0.4} />
      <XAxis />
      <ChartTooltip />
    </ScatterChart>
  );
}
```

## Y gradient

`yGradient` colors the dots by vertical position. Set `strokeWidth={0}` for solid dots without rings. Pass `{ from, to }` for custom colors.

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
      <Scatter
        dataKey="users"
        strokeWidth={0}
        yGradient={{ from: "var(--color-red-500)", to: "var(--color-emerald-500)" }}
      />
      <XAxis />
      <ChartTooltip />
    </ScatterChart>
  );
}
```

## Notes

### Server rendering

`ScatterChart` server-renders and replays its entrance after hydration. Pie, Ring, Radar, Heatmap and LiveLine charts are the ones that draw only after mount.

### Keyboard and hover

Hovering moves the crosshair to the nearest x position and shows the tooltip with one row per series. Focus the chart with Tab and move between positions with the arrow keys; Home and End jump to the first and last. `onPhaseChange` reports `"revealing"` and then `"ready"`.

### Theming

Dots use `--chart-1` to `--chart-5` unless `fill` or `stroke` is set. The grid uses `--chart-grid` and the crosshair `--chart-crosshair`.

### Differences from bklit-ui

- `animationEasing` takes a CSS easing string. `enterTransition` takes `{ duration, ease }` with `duration` in seconds and `ease` as a four-number cubic bezier.
- Animations run on TanStack Charts' own motion instead of `motion`.

## Related

- [LineChart](./line-chart.md)
- [Grid](./grid.md), [Axes](./axes.md), [ChartTooltip](./tooltip.md)
- [useChart](./use-chart.md)
