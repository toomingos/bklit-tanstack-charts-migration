# LineChart

> Adapted from the [bklit-ui documentation](https://github.com/bklit/bklit-ui) (MIT, © uixmat) for bklit-tanstack-charts.

A time-series line chart with an animated entrance, hover crosshair, tooltip and keyboard navigation. Compose it from `Line`, `Grid`, `XAxis`, `YAxis` and `ChartTooltip` children.

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

## Data shape

```ts
type ChartDatum = Record<string, unknown>;

// One row per x position. This example plots two series.
interface Row {
  date: Date; // the x value, under the key given by xDataKey
  revenue: number; // one number per Line, under that Line's dataKey
  cost: number;
}
```

- The x value is read from `xDataKey`, which defaults to `"date"`. It must be a `Date`, or something `new Date()` accepts (such as a timestamp). Strings that `new Date()` cannot parse are not valid.
- Each `Line` reads its y values from the field named by its `dataKey`. Rows should be in ascending date order.
- `data` and `children` are required.
- The chart fills the width of its container. Give it a height with `aspectRatio` (default `"2 / 1"`) or with `style={{ height: 320, aspectRatio: "unset" }}`.
- Without a `Grid`, `XAxis` or `ChartTooltip` child the chart draws no grid, labels or tooltip: each layer is opt-in.

## LineChart props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `data` (required) | `ChartDatum[]` | - | The rows to plot. Each row is an object holding the x value under `xDataKey` and one number per series under that series' `dataKey`. |
| `xDataKey` | `string` | `"date"` | Key of the x value in each row. The value must be a `Date` (or something `new Date()` accepts, such as a timestamp). |
| `status` | `ChartStatus` | `"ready"` | `"loading"` shows the loading state (skeleton line, grid shimmer, optional label) and ignores the pointer; switching to `"ready"` reveals the real data on the same chart instance. |
| `animationDuration` | `number` | `1100` | Duration of the entrance reveal in milliseconds. `0` skips the animation. |
| `margin` | `Partial<ChartMargin>` | `{ top: 40, right: 40, bottom: 40, left: 40 }` | Space around the plot area in pixels, for axis labels and the tooltip. Missing sides use the default. |
| `aspectRatio` | `string` | `"2 / 1"` | CSS aspect ratio of the chart (`"width / height"` or a number), applied to the container width. |
| `className` | `string` | - | Extra CSS class name for the chart container. |
| `onPhaseChange` | `((phase: ChartPhase) => void)` | - | Called with `"loading"` or `"ready"` when `status` changes (and once on mount). |
| `children` (required) | `ReactNode` | - | The layers to draw: `Grid`, `Line`, `XAxis`, `YAxis`, `ChartTooltip` and the other chart children. |
| `loadingLabel` | `string` | - | Text shown centered over the chart, with a shimmer, while `status` is `"loading"`. Nothing is shown when it is unset or empty. |
| `style` | `CSSProperties` | - | Inline styles for the chart container, for example a fixed height for a brush strip. |
| `animationEasing` | `string` | - | Accepted for bklit-ui compatibility. It has no effect: the entrance always uses the default reveal easing. |
| `yDomainTween` | `boolean` | `true` | Animate the y domain when the data or `status` changes instead of jumping to the new scale. |
| `yDomainTweenDuration` | `number` | - | Accepted for bklit-ui compatibility. It has no effect: the y-domain tween always lasts 500 ms. |
| `xDomain` | `[Date, Date]` | - | Visible x range as `[start, end]`, used for brush zoom. The chart plots only this range of `data`. |
| `xDomainSlotCount` | `number` | - | Length of the full dataset while `xDomain` zooms into part of it. It keeps the x spacing consistent with the unzoomed chart. |
| `tweenYDomainOnXDomainChange` | `boolean` | - | Accepted for bklit-ui compatibility. It has no effect. |
| `enterTransition` | `Transition` | - | Accepted for bklit-ui compatibility. It has no effect: set the entrance length with `animationDuration`. |
| `revealSignature` | `string` | - | Changing this string replays the entrance animation. Do not change it when only the data changes. |
| `ariaLabel` | `string` | `"Line chart"` | Accessible name of the chart. |
| `ariaDescription` | `string` | - | Longer accessible description of the chart, exposed as `aria-description`. |

## Line props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `dataKey` (required) | `string` | - | Key of the data field that holds this line's y values. |
| `stroke` | `string` | `"var(--chart-line-primary)"` | Stroke color of the line. |
| `strokeWidth` | `number` | `2.5` | Stroke width of the line in px. |
| `curve` | `CurveFactory` | `curveNatural` | d3-shape curve factory used to interpolate between points. |
| `yAxisId` | `string \| number` | `"left"` | Id of the y scale this line is plotted against. Use it with a matching `YAxis` to give a series its own scale. |
| `fadeEdges` | `FadeEdges` | `true` | Fade the line toward transparent at the chart edges. `true` fades both ends, `"left"` or `"right"` fades one side, `false` turns the fade off. |
| `showHighlight` | `boolean` | `true` | Draw a highlighted segment of the line around the hovered point. |
| `showMarkers` | `boolean` | `false` | Draw a circle marker at every data point. |
| `markers` | `Readonly<SeriesPointMarkerStyle>` | - | Styling of the point markers drawn by `showMarkers`. See `SeriesPointMarkerStyle`. |
| `dashFromIndex` | `number` | - | Data index from which the line is drawn dashed (inclusive). Useful for marking an incomplete or projected period. |
| `dashArray` | `string` | `"6,4"` | Dash pattern of the dashed tail when `dashFromIndex` is set. |
| `loadingStroke` | `string` | `"var(--chart-foreground)"` | Stroke color of the loading pulse overlay. |
| `loadingStrokeOpacity` | `number` | `0.5` | Stroke opacity of the loading pulse overlay. |
| `animate` | `boolean` | `true` | Whether the point markers animate in. The line itself always enters with the chart's `animationDuration`. |
| `loading` | `boolean` | - | Show the loading pulse overlay on this line. When unset, the pulse follows the chart's `status`. Set `false` to disable it even while the chart is loading. |
| `loadingPulseMode` | `LineLoadingPulseMode` | `"loop"` | Phase of the loading pulse: `"loop"` repeats, `"exit"` plays the loading to ready transition, `"enter"` plays ready to loading. |
| `loadingStyle` | `LoadingStyle` | `"pulse"` | Loading animation: a travelling `"pulse"` or a diagonal `"sweep"` shimmer across the skeleton line. |
| `onLoadingPulseCycleComplete` | `(() => void)` | - | Called each time a `"loop"` pulse cycle completes. |

`Grid`, `XAxis`, `YAxis` and `ChartTooltip` are documented in [Grid](./grid.md), [Axes](./axes.md) and [ChartTooltip](./tooltip.md). `Background` (a pattern fill for the plot area) is in [Background](./background.md).

## Multiple series and dual axes

Add one `Line` per series. To give a series its own scale, set the same `yAxisId` on the `Line` and on a matching `YAxis`. Widen the margin on the side that holds the second axis so its labels fit.

```tsx
import { ChartTooltip, Grid, Line, LineChart, XAxis, YAxis } from "bklit-tanstack-charts";

const data = [
  { date: new Date("2025-01-01"), revenue: 1200, visitors: 90 },
  { date: new Date("2025-01-02"), revenue: 1800, visitors: 140 },
  { date: new Date("2025-01-03"), revenue: 1500, visitors: 120 },
  { date: new Date("2025-01-04"), revenue: 2400, visitors: 210 },
  { date: new Date("2025-01-05"), revenue: 2100, visitors: 180 },
];

export function Example() {
  return (
    <LineChart data={data} margin={{ top: 40, right: 60, bottom: 40, left: 60 }}>
      <Grid horizontal />
      <Line dataKey="revenue" stroke="var(--chart-1)" yAxisId="left" />
      <Line dataKey="visitors" stroke="var(--chart-2)" yAxisId="right" />
      <YAxis yAxisId="left" />
      <YAxis yAxisId="right" orientation="right" />
      <XAxis />
      <ChartTooltip />
    </LineChart>
  );
}
```

## Dashed tail

Set `dashFromIndex` on a `Line` to draw a solid stroke up to that data index and a dashed stroke from it to the end, for a period that is still in progress. The index is inclusive. `dashArray` changes the dash pattern.

```tsx
import { ChartTooltip, Grid, Line, LineChart, XAxis } from "bklit-tanstack-charts";

const data = [
  { date: new Date("2025-01-01"), visitors: 320 },
  { date: new Date("2025-01-02"), visitors: 410 },
  { date: new Date("2025-01-03"), visitors: 380 },
  { date: new Date("2025-01-04"), visitors: 520 },
  { date: new Date("2025-01-05"), visitors: 470 },
  { date: new Date("2025-01-06"), visitors: 300 },
];

export function Example() {
  return (
    <LineChart data={data}>
      <Grid horizontal />
      <Line dataKey="visitors" dashFromIndex={4} dashArray="6,4" />
      <XAxis />
      <ChartTooltip />
    </LineChart>
  );
}
```

## Point markers

`showMarkers` draws a circle at every data point. Style them with `markers` (see `SeriesPointMarkerStyle`). Hover highlights are on by default (`showHighlight`).

```tsx
import { ChartTooltip, Grid, Line, LineChart, XAxis } from "bklit-tanstack-charts";

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
      <Line dataKey="revenue" showMarkers />
      <XAxis />
      <ChartTooltip />
    </LineChart>
  );
}
```

## Updating data

When `data` changes, the chart updates in place without replaying the entrance, and the y scale tweens to the new range (`yDomainTween`, on by default). Do not change `revealSignature` for data updates: it exists to replay the entrance on purpose.

```tsx
import { useMemo, useState } from "react";
import { ChartTooltip, Grid, Line, LineChart, XAxis } from "bklit-tanstack-charts";

const full = Array.from({ length: 30 }, (_, i) => ({
  date: new Date(2025, 0, i + 1),
  revenue: 1000 + Math.round(Math.sin(i / 3) * 400 + i * 30),
}));

export function Example() {
  const [days, setDays] = useState(30);
  const data = useMemo(() => full.slice(-days), [days]);
  return (
    <div>
      <button onClick={() => setDays(7)} type="button">7d</button>
      <button onClick={() => setDays(30)} type="button">30d</button>
      <LineChart data={data}>
        <Grid horizontal />
        <Line dataKey="revenue" />
        <XAxis />
        <ChartTooltip />
      </LineChart>
    </div>
  );
}
```

## Loading state

Set `status="loading"` while data is fetching and `"ready"` when it arrives. The same chart instance shows a skeleton line with a grid shimmer, ignores the pointer, and reveals the real data when `status` flips. `loadingLabel` shows text over the skeleton. Choose the animation per `Line` with `loadingStyle` (`"pulse"` or `"sweep"`).

```tsx
import { useEffect, useState } from "react";
import { ChartTooltip, Grid, Line, LineChart, XAxis } from "bklit-tanstack-charts";
import type { ChartStatus } from "bklit-tanstack-charts";

const data = [
  { date: new Date("2025-01-01"), revenue: 1200 },
  { date: new Date("2025-01-02"), revenue: 1800 },
  { date: new Date("2025-01-03"), revenue: 1500 },
  { date: new Date("2025-01-04"), revenue: 2400 },
];

export function Example() {
  const [status, setStatus] = useState<ChartStatus>("loading");
  useEffect(() => {
    const id = setTimeout(() => setStatus("ready"), 2000);
    return () => clearTimeout(id);
  }, []);
  return (
    <LineChart data={data} status={status} loadingLabel="Loading revenue">
      <Grid horizontal shimmer />
      <Line dataKey="revenue" loadingStyle="pulse" />
      <XAxis />
      <ChartTooltip />
    </LineChart>
  );
}
```

### LineChartLoading

`LineChartLoading` is a standalone placeholder for when there is no chart to mount yet, for example during a route transition. It needs no data.

```tsx
import { LineChartLoading } from "bklit-tanstack-charts";

export function Example() {
  return <LineChartLoading label="Loading revenue" />;
}
```

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `margin` | `Partial<ChartMargin>` | `{ top: 40, right: 40, bottom: 40, left: 40 }` | Space around the plot area in pixels. Missing sides use the default. |
| `stroke` | `string` | `"var(--foreground)"` | Color of the traveling loading segment. |
| `strokeOpacity` | `number` | `0.5` | Opacity of the traveling loading segment. |
| `gridStroke` | `string` | `"color-mix(in oklch, var(--chart-grid) 50%, transparent)"` | Color of the grid lines while loading. Use `color-mix` or an oklch alpha to set the opacity. |
| `gridShimmerStroke` | `string` | `"color-mix(in oklch, var(--foreground) 68%, transparent)"` | Color of the shimmer band that travels across the grid. Use `color-mix` or an oklch alpha to set the opacity. |
| `gridShimmer` | `boolean` | `true` | Animate a shimmer band across the grid lines. Always off when `loadingStyle` is `"sweep"`. |
| `gridShimmerLength` | `number` | - | Accepted for bklit-ui compatibility. It has no effect: the shimmer band has a fixed width. |
| `gridShimmerSpeed` | `number` | `1` | Shimmer speed multiplier; higher is faster. |
| `gridShimmerSync` | `boolean` | - | Accepted for bklit-ui compatibility. It has no effect: the shimmer always loops on the same period as the line pulse. |
| `loadingStyle` | `LoadingStyle` | `"pulse"` | Loading animation: `"pulse"` sends a bright segment along the line, `"sweep"` sweeps a soft diagonal shimmer across it. |
| `label` | `string` | `"Loading"` | Text shown centered over the placeholder, with a shimmer. An empty string hides it. |
| `aspectRatio` | `string` | `"2 / 1"` | CSS aspect ratio of the placeholder, as `"width / height"`. |
| `className` | `string` | `""` | Extra CSS class name for the placeholder container. |

## Notes

### Server rendering

`LineChart` server-renders its container, grid, axes and line, and replays the entrance after hydration. The loading placeholder renders the same way. Pie, Ring, Radar, Heatmap and LiveLine charts are the ones that draw only after mount.

### Keyboard and hover

Pointer hover moves the crosshair to the nearest data row and shows the tooltip. The chart is a keyboard stop: focus it with Tab and move between rows with the arrow keys; Home and End jump to the first and last row. Hover and focus drive the same state, and `useChartHover` reports it to your own children (see [useChart](./use-chart.md)).

### Custom children

Children that are not chart layers (a component that calls `useChart`, an SVG overlay) are drawn in an SVG over the plot area, in plot coordinates, above the chart marks. They are not interleaved with the layers in JSX order.

### Theming

Colors come from CSS variables: `--chart-line-primary` (default line color), `--chart-1` to `--chart-5` (series palette), `--chart-grid`, `--chart-crosshair`, `--chart-foreground` and `--chart-tooltip-*`. Override them on any ancestor to restyle a chart; see the theming section of the package README.

### Differences from bklit-ui

- `enterTransition`, `animationEasing`, `yDomainTweenDuration` and `tweenYDomainOnXDomainChange` are accepted so bklit-ui code compiles, but have no effect. Set the entrance length with `animationDuration`.
- `LineChartLoading` draws its traveling segment with `var(--foreground)` by default.
- Entrance and loading animations run on TanStack Charts' own motion instead of `motion`, so spring options map onto tweens.

## Related

- [AreaChart](./area-chart.md)
- [Grid](./grid.md), [Axes](./axes.md), [ChartTooltip](./tooltip.md), [Background](./background.md)
- [useChart](./use-chart.md)
