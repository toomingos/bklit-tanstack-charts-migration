# ReferenceArea

> Adapted from the [bklit-ui documentation](https://github.com/bklit/bklit-ui) (MIT, © uixmat) for bklit-tanstack-charts.

A shaded band between two y values, for target ranges and thresholds. Place it as a child of a cartesian chart; it is drawn behind the series and above the grid.

```tsx
import { ChartTooltip, Grid, Line, LineChart, ReferenceArea, XAxis } from "bklit-tanstack-charts";

const data = Array.from({ length: 30 }, (_, i) => ({
  date: new Date(2024, 0, 1 + i),
  value: 150 + Math.round(60 * Math.sin(i / 4)) + i * 2,
}));

export function Example() {
  return (
    <LineChart data={data}>
      <Grid horizontal />
      <ReferenceArea showMarkers strokeStyle="dashed" y1={160} y2={220} />
      <Line dataKey="value" />
      <XAxis />
      <ChartTooltip />
    </LineChart>
  );
}
```

## Data shape

`ReferenceArea` has no data of its own. Its bounds are values in the chart's data space: y bounds are numbers on the y scale, x bounds are `Date` or number values on the x scale.

- Omit `y1` or `y2` to extend the band to the top or bottom of the plot. Omit `x1` or `x2` to extend it to the left or right edge.
- Use `yAxisId` when the chart has more than one y-scale group, so the bounds refer to the right axis.
- The band is always clipped to the plot area.
- The component renders nothing by itself: it is read by the chart. Keep it a direct child of the chart.

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `y1` | `number` | - | Lower y data bound. The band extends to the plot top when omitted. |
| `y2` | `number` | - | Upper y data bound. The band extends to the plot bottom when omitted. |
| `x1` | `Date \| number` | - | Starting x data coordinate. The band extends to the plot left when omitted. |
| `x2` | `Date \| number` | - | Ending x data coordinate. The band extends to the plot right when omitted. |
| `yAxisId` | `string \| number` | `"left"` | Id of the y-scale group the y bounds refer to. |
| `fill` | `string` | `color-mix(in oklch, var(--chart-foreground-muted) 12%, transparent)` | Fill color of the band. |
| `fillOpacity` | `number` | `1` | Opacity of the fill. |
| `pattern` | `PatternPresetId` | `"none"` | Pattern that fills the band instead of the solid `fill` (`"diagonal"`, `"dots"`, `"cross"`, ...). |
| `patternColor` | `string` | `"var(--chart-foreground-muted)"` | Color of the pattern lines or dots. |
| `patternScale` | `number` | `1` | Scales the pattern tile. |
| `patternStrokeWidth` | `number` | - | Stroke width of the pattern lines, or of the ring around circles. |
| `patternRadius` | `number` | - | Radius of the pattern dots or circles in px. |
| `patternComplement` | `boolean` | - | Also draw circles at the tile corners. |
| `patternFill` | `string` | - | Fill color of the pattern dots or circles. |
| `patternDotFill` | `boolean` | - | Fill the pattern dots (`false` draws rings). |
| `patternTileBackground` | `string` | - | Background color painted under each pattern tile. |
| `stroke` | `string` | `"var(--chart-foreground-muted)"` | Color of the band's top and bottom edge lines. |
| `strokeWidth` | `number` | `1` | Edge line width in px. |
| `strokeStyle` | `"solid" \| "dashed"` | `"dashed"` | Edge line style. |
| `strokeDasharray` | `string` | `"4,4"` | Dash pattern of the edge lines when `strokeStyle` is `"dashed"`. |
| `fadeEdges` | `boolean` | `true` | Fade the fill and edge lines out over the outer 10% of the band at the left and right. |
| `showMarkers` | `boolean` | `false` | Draw inward triangle markers at the horizontal center of the band's top and bottom edges. |
| `markerColor` | `string` | `"var(--chart-1)"` | Color of the center markers. |
| `markerSize` | `number` | `6` | Size of the center markers in px. |

These props are accepted so bklit-ui code compiles but are not applied: `fadeEdgesLength`, `axisLabelColor`, `ifOverflow` and `className`. See [Differences from bklit-ui](#differences-from-bklit-ui).

## Examples

### A target range on a bounded axis

```tsx
import { ChartTooltip, Grid, Line, LineChart, ReferenceArea, XAxis } from "bklit-tanstack-charts";

const data = Array.from({ length: 24 }, (_, i) => ({
  date: new Date(2024, 0, 1 + i),
  temperature: 20 + Math.round(6 * Math.sin(i / 3)),
}));

export function Example() {
  return (
    <LineChart data={data}>
      <Grid horizontal />
      <ReferenceArea fill="var(--chart-2)" fillOpacity={0.12} stroke="var(--chart-2)" y1={18} y2={24} />
      <Line dataKey="temperature" />
      <XAxis />
      <ChartTooltip />
    </LineChart>
  );
}
```

### A band over part of the x range

```tsx
import { Area, AreaChart, Grid, ReferenceArea, XAxis } from "bklit-tanstack-charts";

const data = Array.from({ length: 30 }, (_, i) => ({
  date: new Date(2024, 0, 1 + i),
  value: 100 + ((i * 17) % 60),
}));

export function Example() {
  return (
    <AreaChart data={data}>
      <Grid horizontal />
      <ReferenceArea
        fadeEdges={false}
        strokeStyle="solid"
        x1={new Date(2024, 0, 10)}
        x2={new Date(2024, 0, 20)}
      />
      <Area dataKey="value" />
      <XAxis />
    </AreaChart>
  );
}
```

## Notes

- **Server rendering.** Charts with a reference area server-render and replay their entrance after hydration.
- **Cartesian charts.** Use it inside `LineChart`, `AreaChart`, `BarChart`, `ScatterChart`, `CandlestickChart`, and `ComposedChart`.
- **Theming.** The default fill and edge use `--chart-foreground-muted`; markers use `--chart-1`.

## Differences from bklit-ui

- `axisLabelColor` does not tint y-axis tick labels inside the band.
- `fadeEdgesLength` has no effect: the fade zone is fixed at 10% of the band per side.
- `ifOverflow` has no effect: the band is always clipped to the plot.
- Marker defaults: `markerColor` is `var(--chart-1)` and `markerSize` is `6`; bklit-ui leaves both unset.

## Related

- [Line chart](./line-chart.md)
- [Projection line](./projection-line.md)
- [Patterns and gradients](./patterns-and-gradients.md)
