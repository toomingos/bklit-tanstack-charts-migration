# BarChart

> Adapted from the [bklit-ui documentation](https://github.com/bklit/bklit-ui) (MIT, © uixmat) for bklit-tanstack-charts.

`BarChart` draws grouped, stacked, horizontal or square-stacked bars with hover focus, a tooltip and keyboard navigation. `Bar` and its companions (`BarSquares`, `BarColumnTrack`, `BarDepthProvider`, `BarPulse`) are configuration children: they render nothing by themselves and are read by the chart.

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

## Data shape

```ts
type Row = Record<string, unknown>; // { name: "Jan", sales: 120, profit: 40, ... }
```

- Each row holds the category label under `xDataKey` and one number per series under that series' `dataKey`. Unlike the other charts the default `xDataKey` is `"name"`, and the category is a string.
- Add one `Bar` per series. Series in a row are grouped side by side unless you set `stacked`.
- Negative values grow downward from the zero baseline.

## BarChart props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `data` (required) | `Row[]` | - | The rows to plot. Each row holds a category label under `xDataKey` and one number per series under that series' `dataKey`. |
| `xDataKey` | `string` | `"name"` | Key of the category label in each row. |
| `animationDuration` | `number` | `1100` | Duration of the entrance in milliseconds. Bars are staggered across 40% of this duration. |
| `animationEasing` | `string` | - | Accepted for bklit-ui compatibility. It has no effect in bklit-tanstack-charts. The entrance always uses the default reveal easing. |
| `enterTransition` | `Transition` | - | Accepted for bklit-ui compatibility. It has no effect in bklit-tanstack-charts. |
| `revealSignature` | `string` | - | Accepted for bklit-ui compatibility. It has no effect in bklit-tanstack-charts. |
| `margin` | `Partial<ChartMargin>` | `{ top: 40, right: 40, bottom: 40, left: 40 }` | Space around the plot area in pixels, for axis labels and the tooltip. Missing sides use the default. |
| `aspectRatio` | `string` | `"2 / 1"` | CSS aspect ratio of the chart, as `"width / height"`. |
| `className` | `string` | - | Extra CSS class name for the chart container. |
| `style` | `CSSProperties` | - | Inline styles for the chart container. Set `aspectRatio: "unset"` to let the chart fill the height of its parent. |
| `barGap` | `number` | `0.2` | Gap between bar groups as a fraction of the band width (0 to 1). |
| `barWidth` | `number` | - | Accepted for bklit-ui compatibility. It has no effect in bklit-tanstack-charts. Bars always fill their band; use `barGap` to change their width. |
| `orientation` | `BarOrientation` | `"vertical"` | Direction the bars grow. `"horizontal"` puts the categories on the y axis. |
| `stacked` | `boolean` | `false` | Stack the series on top of each other instead of grouping them side by side. |
| `stackGap` | `number` | `0` | Gap between stacked segments in px. |
| `squareSnap` | `{ squareGap: number; groupGap?: number; fit?: boolean; }` | - | Accepted for bklit-ui compatibility. It has no effect in bklit-tanstack-charts. Square snapping follows the `BarSquares` props. |
| `onPhaseChange` | `((phase: ChartPhase) => void)` | - | Accepted for bklit-ui compatibility. It has no effect in bklit-tanstack-charts. The bar chart does not report phases. |
| `children` | `ReactNode` | - | The layers to draw: `Bar`, `BarSquares`, `Grid`, `BarXAxis`, `BarYAxis`, `ChartTooltip` and the other chart children. Optional for a `status="loading"` skeleton. |
| `ariaLabel` | `string` | `"Bar chart"` | Accessible name of the chart. |
| `ariaDescription` | `string` | - | Longer accessible description of the chart, exposed as `aria-description`. |
| `status` | `ChartStatus` | `"ready"` | `"loading"` replaces the bars with a shimmering skeleton and ignores the pointer; switching to `"ready"` grows the real bars. |

`BarOrientation` is `"vertical" | "horizontal"`.

## Bar props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `dataKey` (required) | `string` | - | Key of the data field that holds this series' values. |
| `yAxisId` | `string \| number` | - | Accepted for bklit-ui compatibility. It has no effect in bklit-tanstack-charts. A bar chart has a single value scale. |
| `fill` | `string` | `"var(--chart-line-primary)"` | Fill color of the bars. Can be a color or a `url(#id)` reference to a gradient or pattern child. |
| `stroke` | `string` | - | Accepted for bklit-ui compatibility. It has no effect in bklit-tanstack-charts. |
| `lineCap` | `BarLineCap` | `"round"` | Bar end style: `"round"` rounds the outer corners, `"butt"` leaves them square. A number is treated like `"round"`. |
| `animate` | `boolean` | - | Accepted for bklit-ui compatibility. It has no effect in bklit-tanstack-charts. Bars always animate in with the chart's `animationDuration`. |
| `animationType` | `BarAnimationType` | - | Accepted for bklit-ui compatibility. It has no effect in bklit-tanstack-charts. Bars always grow from the baseline. |
| `fadedOpacity` | `number` | `0.3` | Opacity of the bars that are not hovered while another bar is hovered. Read from the first `Bar`. |
| `staggerDelay` | `number` | - | Accepted for bklit-ui compatibility. It has no effect in bklit-tanstack-charts. The stagger between bars is derived from `animationDuration`. |
| `stackGap` | `number` | - | Accepted for bklit-ui compatibility. It has no effect in bklit-tanstack-charts. Set `stackGap` on `BarChart` instead. |
| `groupGap` | `number` | `4` | Gap in px between the bars of a group. Read from the first `Bar`. |
| `perspective` | `boolean` | - | Accepted for bklit-ui compatibility. It has no effect in bklit-tanstack-charts. Depth surfaces trim the front face automatically. |
| `minBarHeight` | `number` | - | Accepted for bklit-ui compatibility. It has no effect in bklit-tanstack-charts. Set `minBarHeight` on `BarDepthProvider` for depth surfaces. |

`BarLineCap` is `"round" | "butt" | number`. `BarAnimationType` is `"grow" | "fade"` and is accepted only for compatibility.

## Examples

### Two series, grouped

```tsx
import { Bar, BarChart, BarXAxis, BarYAxis, ChartTooltip, Grid } from "bklit-tanstack-charts";

const data = [
  { name: "Jan", revenue: 120, profit: 40 },
  { name: "Feb", revenue: 180, profit: 70 },
  { name: "Mar", revenue: 150, profit: 55 },
  { name: "Apr", revenue: 240, profit: 110 },
];

export function Example() {
  return (
    <BarChart data={data} barGap={0.3}>
      <Grid horizontal />
      <Bar dataKey="revenue" fill="var(--chart-1)" groupGap={6} />
      <Bar dataKey="profit" fill="var(--chart-2)" />
      <BarXAxis />
      <BarYAxis />
      <ChartTooltip />
    </BarChart>
  );
}
```

### Stacked

```tsx
import { Bar, BarChart, BarXAxis, ChartTooltip, Grid } from "bklit-tanstack-charts";

const data = [
  { name: "Jan", organic: 80, paid: 40 },
  { name: "Feb", organic: 110, paid: 70 },
  { name: "Mar", organic: 90, paid: 60 },
];

export function Example() {
  return (
    <BarChart data={data} stacked stackGap={2}>
      <Grid horizontal />
      <Bar dataKey="organic" fill="var(--chart-1)" />
      <Bar dataKey="paid" fill="var(--chart-2)" />
      <BarXAxis />
      <ChartTooltip />
    </BarChart>
  );
}
```

### Horizontal

In a horizontal chart the categories sit on the y axis. Use `BarYAxis` for the category labels; see [Axes](./axes.md).

```tsx
import { Bar, BarChart, BarYAxis, ChartTooltip } from "bklit-tanstack-charts";

const data = [
  { name: "Organic", visits: 4250 },
  { name: "Paid", visits: 3120 },
  { name: "Direct", visits: 2100 },
];

export function Example() {
  return (
    <BarChart data={data} orientation="horizontal">
      <Bar dataKey="visits" />
      <BarYAxis />
      <ChartTooltip />
    </BarChart>
  );
}
```

### Loading

`status="loading"` swaps the bars for a shimmering skeleton and ignores the pointer. Switching to `"ready"` grows the real bars. `BarChartLoading` is a shortcut for the skeleton alone, for when there is no data yet.

```tsx
import { Bar, BarChart, BarChartLoading, BarXAxis } from "bklit-tanstack-charts";

const data = [
  { name: "Jan", sales: 120 },
  { name: "Feb", sales: 180 },
  { name: "Mar", sales: 150 },
];

export function Example({ loading }: { readonly loading: boolean }) {
  if (loading && data.length === 0) {
    return <BarChartLoading />;
  }
  return (
    <BarChart data={data} status={loading ? "loading" : "ready"}>
      <Bar dataKey="sales" />
      <BarXAxis />
    </BarChart>
  );
}
```

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `margin` | `Partial<Readonly<ChartMargin>>` | `{ top: 40, right: 40, bottom: 40, left: 40 }` | Space around the plot area in pixels. Missing sides use the default. |
| `aspectRatio` | `string` | `"2 / 1"` | CSS aspect ratio of the placeholder, as `"width / height"`. |
| `className` | `string` | `""` | Extra CSS class name for the placeholder container. |

## BarSquares

`BarSquares` draws each bar as a stack of rounded squares instead of a solid bar. Use it in place of `Bar`. `BarColumnTrack` draws faint empty squares behind the bars.

```tsx
import { BarChart, BarColumnTrack, BarSquares, BarXAxis, ChartTooltip, Grid } from "bklit-tanstack-charts";

const data = [
  { name: "Jan", revenue: 120 },
  { name: "Feb", revenue: 180 },
  { name: "Mar", revenue: 150 },
  { name: "Apr", revenue: 240 },
];

export function Example() {
  return (
    <BarChart data={data}>
      <Grid horizontal />
      <BarColumnTrack fill="var(--muted)" opacity={0.15} />
      <BarSquares
        dataKey="revenue"
        fill="var(--chart-1)"
        useGradient
        gradientStops={[
          { offset: 0, color: "var(--chart-1)" },
          { offset: 1, color: "var(--chart-2)" },
        ]}
      />
      <BarXAxis />
      <ChartTooltip />
    </BarChart>
  );
}
```

### BarSquares props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `dataKey` (required) | `string` | - | Key of the data field that holds this series' values. |
| `yAxisId` | `string \| number` | - | Accepted for bklit-ui compatibility. It has no effect in bklit-tanstack-charts. |
| `fill` | `string` | `"var(--chart-line-primary)"` | Fill color of the squares, or a `url(#id)` reference to a gradient or pattern child. |
| `stroke` | `string` | - | Accepted for bklit-ui compatibility. It has no effect in bklit-tanstack-charts. |
| `squareGap` | `number` | `3` | Gap between stacked squares in px. |
| `squareRadius` | `number` | `0.25` | Corner radius of each square as a fraction of its size (0 is flat, 0.5 is a circle). |
| `squareFit` | `boolean` | `false` | Redistribute the gap so the squares fill the bar height exactly. |
| `useGradient` | `boolean` | `false` | Paint the column with a gradient built from `gradientStops` (needs at least two stops). |
| `gradientStops` | `readonly GradientStop[]` | - | Color stops of the column gradient used when `useGradient` is on. |
| `patternPreset` | `string` | - | Accepted for bklit-ui compatibility. It has no effect in bklit-tanstack-charts. |
| `animate` | `boolean` | - | Accepted for bklit-ui compatibility. It has no effect in bklit-tanstack-charts. |
| `fadedOpacity` | `number` | `0.3` | Opacity of the squares that are not hovered while another bar is hovered. |
| `staggerDelay` | `number` | - | Accepted for bklit-ui compatibility. It has no effect in bklit-tanstack-charts. |
| `groupGap` | `number` | `4` | Gap in px between the columns of a group. |

### BarColumnTrack props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `fill` | `string` | `"var(--chart-grid)"` | Fill color of the track squares behind the bars. |
| `opacity` | `number` | `0.3` | Opacity of the track. |
| `squareGap` | `number` | `3` | Gap between track squares in px. Match the `BarSquares` value. |
| `squareRadius` | `number` | `0.25` | Corner radius of each track square as a fraction of its size. Match the `BarSquares` value. |
| `groupGap` | `number` | `4` | Gap in px between the track columns of a group. |
| `squareFit` | `boolean` | `false` | Redistribute the gap so the squares fill the column height exactly. |
| `staggerDelay` | `number` | - | Accepted for bklit-ui compatibility. It has no effect in bklit-tanstack-charts. |

## 3D depth

Wrap the depth layers in `BarDepthProvider`. `BarDepthBack` draws the side and top faces (put it before `Bar`) and `BarDepthFront` the glass front face (after `Bar`). The front face trims itself automatically; there is no `perspective` switch to set. Depth applies to vertical, non-stacked charts.

```tsx
import {
  Bar,
  BarChart,
  BarDepthBack,
  BarDepthFront,
  BarDepthProvider,
  BarPulse,
  BarXAxis,
  ChartTooltip,
  Grid,
} from "bklit-tanstack-charts";

const data = [
  { name: "Jan", revenue: 120 },
  { name: "Feb", revenue: 180 },
  { name: "Mar", revenue: 150 },
  { name: "Apr", revenue: 240 },
];

export function Example() {
  return (
    <BarChart data={data}>
      <Grid horizontal />
      <BarDepthProvider groundShadow={0.26}>
        <BarDepthBack dataKey="revenue" color="var(--chart-1)" />
        <Bar dataKey="revenue" fill="var(--chart-1)" />
        <BarDepthFront dataKey="revenue" />
        <BarPulse dataKey="revenue" />
      </BarDepthProvider>
      <BarXAxis />
      <ChartTooltip />
    </BarChart>
  );
}
```

### BarDepthProvider props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `children` | `ReactNode` | - | The chart children that use the shared depth settings. |
| `segmentsAccessor` | `((datum: Record<string, unknown>) => readonly BarDepthSegment[] \| null \| undefined)` | - | Splits a stacked bar into segments, bottom to top, so each gets its own side face. Return `null` or `undefined` for a single color. |
| `groundShadow` | `number` | `0.26` | Opacity of the contact shadow under the bars. `0` turns it off. |
| `minBarHeight` | `number` | `0` | Minimum rendered bar height in px, so short or zero-value bars stay visible. |

### BarDepthBack props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `dataKey` (required) | `string` | - | Key of the data field that holds the values drawn as the 3D side and top faces. |
| `color` | `string` | - | Color of the faces. Defaults to the series fill. |
| `colorAccessor` | `((datum: Record<string, unknown>, index: number) => string \| undefined)` | - | Picks a color per row (with its index). Return `undefined` to use `color`. |

### BarDepthFront props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `dataKey` (required) | `string` | - | Key of the data field that holds the values drawn as the glass front face. |

### BarPulse props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `dataKey` (required) | `string` | - | Key of the data field of the bar that pulses. |
| `activeIndex` | `number` | - | Index of the category whose bar pulses. Defaults to the last category. |
| `pulsePaused` | `boolean` | `false` | Pause the pulse animation. |

### BarDepthSegment

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `value` (required) | `number` | - | Size of this segment. The values of all segments should add up to the bar's value. |
| `color` | `string` | - | Color of this segment's side face. |

### useBarDepthEntries

`useBarDepthEntries(dataKey, activeIndex?)` returns the geometry of every bar (one entry per category) for custom SVG children that draw their own depth effect. Call it inside a child of `BarChart`.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `label` (required) | `string` | - | Category label of the bar. |
| `dataIndex` (required) | `number` | - | Index of the row in the original `data` array. |
| `datum` (required) | `Record<string, unknown>` | - | The data row this bar was built from. |
| `isActive` (required) | `boolean` | - | True when `dataIndex` equals the `activeIndex` passed to the hook. |
| `isNegative` (required) | `boolean` | - | True when the value is negative, so the bar extends downward from the baseline. |
| `baselineY` (required) | `number` | - | Pixel y of the baseline (`yScale(0)`). |
| `bandX` (required) | `number` | - | Left edge of the bar's band in px. |
| `bandWidth` (required) | `number` | - | Width of the bar's band in px. |
| `topY` (required) | `number` | - | Visual top of the bar in px (smaller is higher). |
| `bottomY` (required) | `number` | - | Visual bottom of the bar in px. |
| `barHeight` (required) | `number` | - | Rendered height of the bar in px. |
| `naturalHeight` (required) | `number` | - | Untrimmed pixel height of the bar. |
| `topYTrim` (required) | `number` | - | Pixels subtracted from the visual top so the lid's back edge lands on the value. |
| `depth` (required) | `number` | - | Thickness of the side face in px (`0` for a bar at the center or in a dense chart). |
| `perspectiveRise` (required) | `number` | - | Vertical rise of the lid and side face in px. |
| `isRightOfCenter` (required) | `boolean` | - | True when the bar is right of the chart center, which puts its side face on the left. |

## Notes

### Keyboard and hover

Hovering a bar fades the others to `fadedOpacity`. With keyboard focus on the chart, Tab enters it, the arrow keys move between categories, and Home and End jump to the first and last. Hover and focus use the same tooltip. A `ChartLegendHoverProvider` around the chart lets a [Legend](./legend.md) highlight bars as well.

### Theming

Bars use `--chart-line-primary` unless you pass `fill`. Series colors, grid lines and tooltip use the `--chart-*` variables: `--chart-1` ... `--chart-5`, `--chart-grid`, `--chart-label`, `--chart-tooltip-*`.

### Server rendering

`BarChart` server-renders and replays its entrance after hydration.

### Differences from bklit-ui

- Depth layers need a `BarDepthProvider` wrapper; `Bar` has no `perspective` prop (it is accepted and ignored).
- `barWidth`, `animationEasing`, `enterTransition`, `revealSignature`, `squareSnap` and `onPhaseChange` on `BarChart`, and `animate`, `animationType`, `staggerDelay`, `stackGap`, `minBarHeight` and `yAxisId` on `Bar`, are accepted for compatibility and have no effect. The entrance always grows bars from the baseline.

## Related

- [Axes](./axes.md) (`BarXAxis`, `BarYAxis`)
- [Grid](./grid.md), [ChartTooltip](./tooltip.md), [Legend](./legend.md)
- [ComposedChart](./composed-chart.md) for bars together with lines and areas
