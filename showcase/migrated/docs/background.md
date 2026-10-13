# Background

> Adapted from the [bklit-ui documentation](https://github.com/bklit/bklit-ui) (MIT, © uixmat) for bklit-tanstack-charts.

`Background` fills the plot area with a pattern, such as diagonal lines or dots, when you want a textured plot instead of grid lines. It is a configuration child: it renders nothing by itself and is read by the chart that contains it.

```tsx
import { Background, ChartTooltip, Line, LineChart, XAxis } from "bklit-tanstack-charts";

const data = [
  { date: new Date("2025-01-01"), value: 12 },
  { date: new Date("2025-01-02"), value: 18 },
  { date: new Date("2025-01-03"), value: 15 },
  { date: new Date("2025-01-04"), value: 24 },
];

export function Example() {
  return (
    <LineChart data={data}>
      <Background pattern="diagonal" />
      <Line dataKey="value" />
      <XAxis />
      <ChartTooltip />
    </LineChart>
  );
}
```

`Background` is drawn by `LineChart` and `AreaChart`. The other charts ignore it. It sits behind the series.

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `pattern` | `"none" \| "diagonal" \| "horizontal" \| "vertical" \| "cross" \| "dots" \| "circles" \| "accent"` | `"diagonal"` | Pattern preset. `"none"` draws nothing. |
| `color` | `string` | `"var(--chart-grid)"` | Color of the pattern strokes. |
| `showFill` | `boolean` | `true` | Draw the pattern over the plot area. |
| `opacity` | `number` | `1` | Opacity of the pattern. |
| `fadeHorizontal` | `boolean` | `true` | Fade the pattern out at the left and right edges. |
| `fadeVertical` | `boolean` | `true` | Fade the pattern out at the top and bottom edges. |
| `fadeHorizontalLength` | `number` | `10` | Width of the horizontal fade zone, as a percent of the plot width per edge (clamped to 0 to 45). |
| `fadeVerticalLength` | `number` | `10` | Height of the vertical fade zone, as a percent of the plot height per edge (clamped to 0 to 45). |
| `scale` | `number` | `1` | Scales the tile size. `2` doubles it. |
| `strokeWidth` | `number` | - | Stroke width of the lines, or of the ring around circles. |
| `radius` | `number` | - | Radius of the dots or circles in px. |
| `complement` | `boolean` | - | Also draw circles at the tile corners so the pattern reads as a staggered grid. |
| `fill` | `string` | - | Fill color of dots or circles. |
| `dotFill` | `boolean` | - | Fill the dots of the `"dots"` preset. Set to `false` to draw outlined dots. |
| `tileBackground` | `string` | - | Background color behind the pattern tile. |

## Examples

### Dots

```tsx
import { Background, ChartTooltip, Line, LineChart, XAxis } from "bklit-tanstack-charts";

const data = [
  { date: new Date("2025-01-01"), value: 12 },
  { date: new Date("2025-01-02"), value: 18 },
  { date: new Date("2025-01-03"), value: 15 },
  { date: new Date("2025-01-04"), value: 24 },
];

export function Example() {
  return (
    <LineChart data={data}>
      <Background pattern="dots" scale={1.5} />
      <Line dataKey="value" />
      <XAxis />
      <ChartTooltip />
    </LineChart>
  );
}
```

### Cross pattern without edge fade

```tsx
import { Background, ChartTooltip, Line, LineChart, XAxis } from "bklit-tanstack-charts";

const data = [
  { date: new Date("2025-01-01"), value: 12 },
  { date: new Date("2025-01-02"), value: 18 },
  { date: new Date("2025-01-03"), value: 15 },
  { date: new Date("2025-01-04"), value: 24 },
];

export function Example() {
  return (
    <LineChart data={data}>
      <Background pattern="cross" fadeHorizontal={false} fadeVertical={false} opacity={0.6} />
      <Line dataKey="value" />
      <XAxis />
      <ChartTooltip />
    </LineChart>
  );
}
```

## PatternArea

`PatternArea` fills the region under a series with a pattern. It is a child of `AreaChart` and is documented with it: see [PatternArea props](./area-chart.md#patternarea-props).

## Notes

### Theming

The pattern color is `--chart-grid` unless you pass `color`.

### Server rendering

`Background` server-renders with its chart.

### Differences from bklit-ui

- Presets are drawn by this package rather than by `@visx/pattern`; the preset names and props are the same.
- For custom patterns defined as SVG, see the pattern components exported from the package (`PatternLines`, `PatternCircles`, `PatternWaves`, `PatternHexagons`).

## Related

- [Grid](./grid.md)
- [AreaChart](./area-chart.md)
- [LineChart](./line-chart.md)
