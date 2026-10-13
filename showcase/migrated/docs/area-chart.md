# AreaChart

> Adapted from the [bklit-ui documentation](https://github.com/bklit/bklit-ui) (MIT, © uixmat) for bklit-tanstack-charts.

A time-series area chart: a filled region under a line, with the same animated entrance, crosshair, tooltip and keyboard navigation as [LineChart](./line-chart.md). Compose it from `Area`, `PatternArea`, `Grid`, `XAxis`, `YAxis` and `ChartTooltip` children.

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

## Data shape

```ts
interface Row {
  date: Date; // the x value, under the key given by xDataKey
  visitors: number; // one number per Area, under that Area's dataKey
}
```

- The x value is read from `xDataKey`, which defaults to `"date"`. It must be a `Date`, or something `new Date()` accepts (such as a timestamp).
- Each `Area` reads its values from the field named by its `dataKey`. Rows should be in ascending date order.
- `data` and `children` are required.
- The chart fills the width of its container; set its height with `aspectRatio` (default `"2 / 1"`) or `style`.
- Each layer is opt-in: without `Grid`, `XAxis` or `ChartTooltip` the chart draws no grid, labels or tooltip.
- An area is filled down to the bottom of the y domain. Several areas overlap each other; they are not stacked.

## AreaChart props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `data` (required) | `ChartDatum[]` | - | The rows to plot. Each row is an object holding the x value under `xDataKey` and one number per series under that series' `dataKey`. |
| `xDataKey` | `string` | `"date"` | Key of the x value in each row. The value must be a `Date` (or something `new Date()` accepts, such as a timestamp). |
| `status` | `ChartStatus` | `"ready"` | `"loading"` shows the loading state (skeleton area, grid shimmer, optional label) and ignores the pointer; switching to `"ready"` reveals the real data on the same chart instance. |
| `animationDuration` | `number` | `1100` | Duration of the entrance reveal in milliseconds. `0` skips the animation. |
| `margin` | `Partial<ChartMargin>` | `{ top: 40, right: 40, bottom: 40, left: 40 }` | Space around the plot area in pixels, for axis labels and the tooltip. Missing sides use the default. |
| `aspectRatio` | `string` | `"2 / 1"` | CSS aspect ratio of the chart (`"width / height"` or a number), applied to the container width. |
| `className` | `string` | - | Extra CSS class name for the chart container. |
| `onPhaseChange` | `((phase: ChartPhase) => void)` | - | Called with `"loading"` or `"ready"` when `status` changes (and once on mount). |
| `children` (required) | `ReactNode` | - | The layers to draw: `Grid`, `Area`, `XAxis`, `YAxis`, `ChartTooltip` and the other chart children. |
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
| `ariaLabel` | `string` | `"Area chart"` | Accessible name of the chart. |
| `ariaDescription` | `string` | - | Longer accessible description of the chart, exposed as `aria-description`. |

## Area props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `dataKey` (required) | `string` | - | Key of the data field that holds this area's y values. |
| `stroke` | `string` | `"var(--chart-line-primary)"` | Color of the area's top line. Falls back to `fill`, then to the default line color. |
| `strokeWidth` | `number` | `2` | Stroke width of the top line in px. |
| `fill` | `string` | - | Fill color of the area. Defaults to the resolved `stroke`. |
| `fillOpacity` | `number` | `0.4` | Opacity of the fill at the top of the area, before the gradient fades it toward `gradientToOpacity`. |
| `curve` | `CurveFactory` | `curveMonotoneX` | d3-shape curve factory used to interpolate between points. |
| `yAxisId` | `string \| number` | `"left"` | Id of the y scale this area is plotted against. |
| `showLine` | `boolean` | `true` | Draw the stroke line along the top of the area. |
| `gradientToOpacity` | `number` | `0` | Fill opacity at the bottom of the vertical gradient. |
| `gradientSpan` | `number` | - | Accepted for bklit-ui compatibility. It has no effect in bklit-tanstack-charts. |
| `fadeEdges` | `FadeEdges` | `false` | Fade the area toward transparent at the chart edges. `true` fades both ends, `"left"` or `"right"` fades one side. |
| `showMarkers` | `boolean` | `false` | Draw a circle marker at every data point. |
| `markers` | `Readonly<SeriesPointMarkerStyle>` | - | Styling of the point markers drawn by `showMarkers`. See `SeriesPointMarkerStyle`. |
| `showHighlight` | `boolean` | `true` | Draw a highlighted segment of the top line around the hovered point. |
| `dashFromIndex` | `number` | - | Data index from which the top line is drawn dashed (inclusive). |
| `dashArray` | `string` | `"6,4"` | Dash pattern of the dashed tail when `dashFromIndex` is set. |
| `animate` | `boolean` | `true` | Whether the point markers animate in. The area itself always enters with the chart's `animationDuration`. |
| `loading` | `boolean` | - | Show the loading pulse overlay on this area. When unset, the pulse follows the chart's `status`. Set `false` to disable it. |
| `loadingStroke` | `string` | `"var(--chart-foreground)"` | Stroke color of the loading pulse overlay. |
| `loadingStrokeOpacity` | `number` | `0.5` | Stroke opacity of the loading pulse overlay. |
| `loadingPulseMode` | `LineLoadingPulseMode` | `"loop"` | Phase of the loading pulse: `"loop"` repeats, `"exit"` plays the loading to ready transition, `"enter"` plays ready to loading. |
| `loadingStyle` | `LoadingStyle` | `"pulse"` | Loading animation: a travelling `"pulse"` or a diagonal `"sweep"` shimmer. |

## PatternArea props

`PatternArea` fills the region under a series with a pattern instead of a gradient. It draws no top line, so pair it with an `Area` (with `fillOpacity={0}`) or a `Line` on the same `dataKey` for the stroke.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `dataKey` (required) | `string` | - | Key of the data field that holds the y values filled with the pattern. |
| `patternPreset` | `"none" \| "diagonal" \| "horizontal" \| "vertical" \| "cross" \| "dots" \| "circles" \| "accent"` | `"diagonal"` | Pattern drawn inside the area (a `PatternPresetId`, for example `"diagonal"`, `"dots"` or `"cross"`). |
| `patternColor` | `string` | - | Color of the pattern strokes. Defaults to `fill`, then to the default line color. |
| `fill` | `string` | - | Fallback color for the pattern when `patternColor` is not set. |
| `curve` | `CurveFactory` | `curveMonotoneX` | d3-shape curve factory used to interpolate between points. |
| `animate` | `boolean` | - | Deprecated. The pattern fill does not animate, so this has no effect. |

## Multiple series and patterns

Add one `Area` per series. The areas overlap, so keep fills translucent. To fill a series with a pattern, add a `PatternArea` with the same `dataKey`.

```tsx
import { Area, AreaChart, ChartTooltip, Grid, PatternArea, XAxis } from "bklit-tanstack-charts";

const data = [
  { date: new Date("2025-01-01"), desktop: 320, mobile: 180 },
  { date: new Date("2025-01-02"), desktop: 410, mobile: 220 },
  { date: new Date("2025-01-03"), desktop: 380, mobile: 260 },
  { date: new Date("2025-01-04"), desktop: 520, mobile: 300 },
  { date: new Date("2025-01-05"), desktop: 470, mobile: 340 },
];

export function Example() {
  return (
    <AreaChart data={data}>
      <Grid horizontal />
      <Area dataKey="desktop" stroke="var(--chart-1)" />
      <PatternArea dataKey="mobile" patternPreset="dots" patternColor="var(--chart-2)" />
      <Area dataKey="mobile" stroke="var(--chart-2)" fillOpacity={0} />
      <XAxis />
      <ChartTooltip />
    </AreaChart>
  );
}
```

## Fill control

`fillOpacity` sets the fill at the top of the area and `gradientToOpacity` the fill at the bottom. `fadeEdges` fades the area toward transparent at the left and right edges. `showLine={false}` hides the top stroke.

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
      <Area dataKey="visitors" fadeEdges fillOpacity={0.6} gradientToOpacity={0.05} />
      <XAxis />
      <ChartTooltip />
    </AreaChart>
  );
}
```

## Dashed tail and markers

`dashFromIndex` draws the top line dashed from that data index (inclusive) to the end, and `showMarkers` draws a circle at every point. Both work as on [`Line`](./line-chart.md#line-props).

```tsx
import { Area, AreaChart, ChartTooltip, Grid, XAxis } from "bklit-tanstack-charts";

const data = [
  { date: new Date("2025-01-01"), visitors: 320 },
  { date: new Date("2025-01-02"), visitors: 410 },
  { date: new Date("2025-01-03"), visitors: 380 },
  { date: new Date("2025-01-04"), visitors: 520 },
  { date: new Date("2025-01-05"), visitors: 300 },
];

export function Example() {
  return (
    <AreaChart data={data}>
      <Grid horizontal />
      <Area dataKey="visitors" dashFromIndex={3} showMarkers />
      <XAxis />
      <ChartTooltip />
    </AreaChart>
  );
}
```

## Loading state

Set `status="loading"` while data is fetching and `"ready"` when it arrives. The chart shows a skeleton with a grid shimmer and ignores the pointer, then reveals the data on the same instance. `AreaChartLoading` is the standalone placeholder when there is no chart to mount yet.

```tsx
import { AreaChartLoading } from "bklit-tanstack-charts";

export function Example() {
  return <AreaChartLoading label="Loading visitors" />;
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

`AreaChart` server-renders and replays the entrance after hydration. Pie, Ring, Radar, Heatmap and LiveLine charts are the ones that draw only after mount.

### Keyboard and hover

Hovering moves the crosshair to the nearest data row. The chart is a keyboard stop: focus it with Tab, move between rows with the arrow keys, and use Home and End for the first and last row. Hover and focus drive the same state, which `useChartHover` exposes to custom children (see [useChart](./use-chart.md)).

### Theming

Colors come from CSS variables: `--chart-line-primary` (default stroke), `--chart-1` to `--chart-5`, `--chart-grid`, `--chart-crosshair` and `--chart-tooltip-*`. Override them on any ancestor.

### Differences from bklit-ui

- `gradientSpan` on `Area` is accepted for compatibility and has no effect.
- `enterTransition`, `animationEasing`, `yDomainTweenDuration` and `tweenYDomainOnXDomainChange` on `AreaChart` are accepted and have no effect. Use `animationDuration`.
- Animations run on TanStack Charts' own motion instead of `motion`.

## Related

- [LineChart](./line-chart.md)
- [Grid](./grid.md), [Axes](./axes.md), [ChartTooltip](./tooltip.md), [Background](./background.md)
- [useChart](./use-chart.md)
