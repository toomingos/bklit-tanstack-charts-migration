# Custom indicators and tooltip pieces

> Adapted from the [bklit-ui documentation](https://github.com/bklit/bklit-ui) (MIT, © uixmat) for bklit-tanstack-charts.

`ChartTooltip` draws a crosshair, dots, a date pill and a panel. Style them with `TooltipIndicator` and `TooltipDot`, replace the panel with `content` or `rows`, or turn the defaults off and draw your own indicator as a chart child that reads `useChart()`.

```tsx
import { ChartTooltip, Grid, Line, LineChart, TooltipDot, TooltipIndicator, XAxis } from "bklit-tanstack-charts";

const data = Array.from({ length: 20 }, (_, i) => ({
  date: new Date(2024, 0, 1 + i),
  value: 40 + i * 2 + Math.round(9 * Math.sin(i / 2)),
}));

export function Example() {
  return (
    <LineChart data={data}>
      <Grid horizontal />
      <Line dataKey="value" />
      <XAxis />
      <ChartTooltip />
      <TooltipIndicator width="thin" colorEdge="var(--chart-1)" strokeDasharray="4 4" />
      <TooltipDot size={6} strokeWidth={3} />
    </LineChart>
  );
}
```

`TooltipIndicator` and `TooltipDot` render nothing themselves. The chart merges their props into the `ChartTooltip` options, and an explicit prop on `ChartTooltip` wins.

## TooltipIndicator

Styles the vertical crosshair. Equivalent to the `indicator*` props of `ChartTooltip`.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `visible` | `boolean` | `true` | Show the crosshair. Same as `showCrosshair` on `ChartTooltip`. |
| `width` | `number \| "line" \| "thin" \| "medium" \| "thick"` | `"line"` | Thickness of the crosshair: a width in px, or `"line"` (1px), `"thin"` (2px), `"medium"` (4px) or `"thick"` (8px). |
| `colorEdge` | `string` | `"var(--chart-crosshair)"` | Color of the crosshair. Same as `indicatorColor`. |
| `strokeDasharray` | `string` | - | Dash pattern of the crosshair. Omit for a solid line. |

`x`, `height`, `span`, `columnWidth`, `colorMid`, `fadeEdges`, `fadeLength`, `animate`, `gradientId` and `springConfig` are accepted so bklit-ui code compiles but have no effect. The crosshair is solid.

## TooltipDot

Styles the dots drawn on each series at the hovered position. Equivalent to the `dot*` props of `ChartTooltip`.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `visible` | `boolean` | `true` | Show the dots. Same as `showDots`. |
| `color` | `string` | series color | Fill color of the dots. |
| `size` | `number` | `5` | Dot radius in px. Same as `dotSize`. |
| `strokeWidth` | `number` | `2` | Stroke width of the dots in px. Same as `dotStrokeWidth`. |
| `variant` | `"dot" \| "ring"` | `"dot"` | Filled dot or transparent ring square. Read by `BarChart` only. |

`x`, `y`, `strokeColor`, `cornerRadiusFraction`, `springConfig` and `animate` are accepted but have no effect.

## Custom tooltip panel

Pass `content` to `ChartTooltip` to replace the panel body. Build it from the tooltip pieces:

- `TooltipContent` shows a `title` and a list of `rows` (`{ color, label, value }`), plus `children` below them.
- `TooltipBox` is the floating panel container. Its placement props are accepted but the chart places the tooltip itself; `className`, `panelStyle`, `backgroundColor` and `visible` (default `true`) apply.
- `DateTicker` is the date pill: `currentIndex`, `labels` and `visible` are required.
- `MarkerTooltipContent` renders marker details (see [Markers](./markers.md)).

```tsx
import { ChartTooltip, Grid, Line, LineChart, TooltipContent, XAxis } from "bklit-tanstack-charts";

const data = Array.from({ length: 12 }, (_, i) => ({
  date: new Date(2024, 0, 1 + i),
  users: 100 + i * 8,
  sessions: 160 + i * 11,
}));

export function Example() {
  return (
    <LineChart data={data}>
      <Grid horizontal />
      <Line dataKey="users" />
      <Line dataKey="sessions" />
      <XAxis />
      <ChartTooltip
        content={({ point }) => (
          <TooltipContent
            title={String(point.date instanceof Date ? point.date.toDateString() : point.date)}
            rows={[
              { color: "var(--chart-1)", label: "Users", value: Number(point.users) },
              { color: "var(--chart-2)", label: "Sessions", value: Number(point.sessions) },
            ]}
          />
        )}
      />
    </LineChart>
  );
}
```

### TooltipContent

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `rows` | `TooltipRow[]` | required | The rows to show, one per series. |
| `title` | `string` | - | Heading above the rows, for example the formatted date. |
| `children` | `ReactNode` | - | Extra content rendered below the rows. |
| `className` | `string` | - | Class names added to the content wrapper. |

### TooltipRow

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `color` | `string` | required | Color of the dot before the label. |
| `label` | `string` | required | Row label, usually the series name. |
| `value` | `string \| number` | required | Row value. Numbers use the en-US number format; strings are shown as given. |

### MarkerTooltipContent

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `markers` | `MarkerTooltipItem[]` | required | The markers at the hovered date. |

## Drawing your own indicator

To replace the built-in indicator, switch off the crosshair and dots, then add a child component that reads `useChart()`. Children that are not chart layers are drawn in an SVG over the plot area, in plot coordinates, so you do not need a portal. This example draws a bar under the hovered column of a `BarChart`.

```tsx
import { Bar, BarChart, BarXAxis, ChartTooltip, Grid, useChart } from "bklit-tanstack-charts";

const data = [
  { month: "Jan", revenue: 120 },
  { month: "Feb", revenue: 150 },
  { month: "Mar", revenue: 135 },
  { month: "Apr", revenue: 170 },
];

function HoverBase() {
  const { barScale, bandWidth, innerHeight, hoveredBarIndex } = useChart();
  if (hoveredBarIndex === null || hoveredBarIndex === undefined || !barScale || bandWidth === undefined) {
    return null;
  }
  const label = data[hoveredBarIndex]?.month ?? "";
  return (
    <rect
      x={barScale(label) ?? 0}
      y={innerHeight - 3}
      width={bandWidth}
      height={3}
      fill="var(--chart-indicator-color)"
    />
  );
}

export function Example() {
  return (
    <BarChart data={data} xDataKey="month">
      <Grid horizontal />
      <Bar dataKey="revenue" />
      <BarXAxis />
      <ChartTooltip showCrosshair={false} showDots={false} />
      <HoverBase />
    </BarChart>
  );
}
```

### Useful useChart values

| Value | Type | Description |
| --- | --- | --- |
| `hoveredBarIndex` | `number \| null` | Index of the hovered bar group (`BarChart`). |
| `barScale` | `ScaleBand<string>` | Band scale from category to x position (`BarChart`). |
| `bandWidth` | `number` | Width of each bar band (`BarChart`). |
| `innerHeight` | `number` | Plot height, excluding margins. |
| `margin` | `Margin` | Chart margins `{ top, right, bottom, left }`. |
| `tooltipData` | `TooltipData \| null` | Current tooltip data, including position. |

See [useChart](./use-chart.md) for the full list.

## Notes

- **Server rendering.** The chart server-renders and replays its entrance after hydration. Indicators appear on hover.
- **Keyboard.** Arrow keys move the focused row, so indicators driven by `hoveredBarIndex` or `tooltipData` follow the keyboard too.
- **Theming.** `--chart-crosshair` colors the crosshair. `--chart-indicator-color` and `--chart-indicator-secondary-color` are available for custom indicators.

## Differences from bklit-ui

- bklit-ui draws a custom indicator through a portal into `containerRef` and animates it with `motion/react` springs. Here custom children are drawn directly in the plot's SVG, so no portal is needed; animate with CSS transitions or your own library.
- `TooltipIndicator` fade options and the `TooltipDot` and `TooltipBox` spring and position props are accepted but not used.

## Related

- [ChartTooltip](./tooltip.md)
- [useChart](./use-chart.md)
- [Markers](./markers.md)
- [Chart config](./chart-config.md)
