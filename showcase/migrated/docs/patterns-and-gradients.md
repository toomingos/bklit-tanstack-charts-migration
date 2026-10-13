# Patterns and gradients

> Adapted from the [bklit-ui documentation](https://github.com/bklit/bklit-ui) (MIT, © uixmat) for bklit-tanstack-charts.

Gradient and pattern components declare reusable fills. Place one as a child of a chart, give it an `id`, and point a `fill` at it with `url(#id)`.

```tsx
import { Bar, BarChart, BarXAxis, ChartTooltip, Grid, LinearGradient, PatternLines } from "bklit-tanstack-charts";

const data = [
  { month: "Jan", revenue: 120, cost: 80 },
  { month: "Feb", revenue: 150, cost: 95 },
  { month: "Mar", revenue: 135, cost: 110 },
  { month: "Apr", revenue: 170, cost: 100 },
];

export function Example() {
  return (
    <BarChart data={data} xDataKey="month">
      <LinearGradient id="revenue-fill" from="var(--chart-3)" to="transparent" />
      <PatternLines id="cost-fill" width={6} height={6} stroke="var(--chart-4)" strokeWidth={1.5} orientation={["diagonal"]} />
      <Grid horizontal />
      <Bar dataKey="revenue" fill="url(#revenue-fill)" stroke="var(--chart-3)" />
      <Bar dataKey="cost" fill="url(#cost-fill)" stroke="var(--chart-4)" />
      <BarXAxis />
      <ChartTooltip />
    </BarChart>
  );
}
```

## Gotchas

- Ids are global to the page. Use a unique `id` per chart when you render several charts that define fills with the same name.
- `LinearGradient` and `RadialGradient` render nothing themselves; the chart reads their props and defines the gradient. They must be direct children of the chart.
- Pattern components are drawn as children of the chart and referenced by `url(#id)`.
- `Line`, `Area`, `Bar` and the other marks accept `url(#id)` wherever they take a `fill` or `stroke` color.

## Gradients

### LinearGradient

A gradient between two colors. It runs top to bottom by default.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `id` | `string` | required | Id of the gradient, referenced as `url(#id)`. |
| `from` | `string` | `"currentColor"` | Color at the start of the gradient. |
| `to` | `string` | `"currentColor"` | Color at the end of the gradient. |
| `fromOffset` | `number \| string` | `0` | Position of the start color, as a fraction (`0.2`) or a percentage (`"20%"`). |
| `toOffset` | `number \| string` | `1` | Position of the end color, as a fraction or a percentage. |
| `fromOpacity` | `number \| string` | `1` | Opacity of the start color from 0 to 1. |
| `toOpacity` | `number \| string` | `1` | Opacity of the end color from 0 to 1. |
| `vertical` | `boolean` | `true` | Run the gradient from top to bottom. Ignored when any of `x1`, `y1`, `x2`, `y2` is set to a non-zero value. |
| `x1` | `number \| string` | `0` | Start x of the gradient vector, as a fraction or a percentage. |
| `y1` | `number \| string` | `0` | Start y of the gradient vector. |
| `x2` | `number \| string` | `1` | End x of the gradient vector. |
| `y2` | `number \| string` | `0` | End y of the gradient vector. |
| `rotate` | `string \| number` | - | Rotates the gradient direction by this many degrees. |
| `transform` | `string` | - | An SVG transform string. Only `rotate(angle)` is applied, and it takes precedence over `rotate`. |
| `children` | `ReactNode` | - | `<stop>` elements. When present they replace `from` and `to`. |

### RadialGradient

A gradient that radiates from a center. It takes `id`, `from`, `to`, `fromOffset`, `toOffset`, `fromOpacity`, `toOpacity`, `rotate`, `transform` and `children` like `LinearGradient`, plus:

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `cx` | `number \| string` | `0.5` | Center x of the outer circle, as a fraction or a percentage. |
| `cy` | `number \| string` | `0.5` | Center y of the outer circle. |
| `r` | `number \| string` | `0.5` | Radius of the outer circle. |
| `fx` | `number \| string` | - | Focal point x. The focal point is the center when omitted. |
| `fy` | `number \| string` | - | Focal point y. The focal point is the center when omitted. |

### Gradient presets

Nine ready-made two-stop linear gradients: `GradientDarkgreenGreen`, `GradientLightgreenGreen`, `GradientOrangeRed`, `GradientPinkBlue`, `GradientPinkRed`, `GradientPurpleOrange`, `GradientPurpleTeal`, `GradientSteelPurple` and `GradientTealBlue`. Each takes the `LinearGradient` props; `from` and `to` override the preset colors.

```tsx
import { Area, AreaChart, GradientPurpleTeal, Grid, XAxis } from "bklit-tanstack-charts";

const data = Array.from({ length: 20 }, (_, i) => ({
  date: new Date(2024, 0, 1 + i),
  value: 40 + i * 2 + Math.round(10 * Math.sin(i / 2)),
}));

export function Example() {
  return (
    <AreaChart data={data}>
      <GradientPurpleTeal id="teal-fill" />
      <Grid horizontal />
      <Area dataKey="value" fill="url(#teal-fill)" />
      <XAxis />
    </AreaChart>
  );
}
```

### Custom stops

Pass `<stop>` children for more than two colors. They replace `from` and `to`.

```tsx
import { Bar, BarChart, BarXAxis, LinearGradient } from "bklit-tanstack-charts";

const data = [
  { label: "A", value: 30 },
  { label: "B", value: 55 },
  { label: "C", value: 42 },
];

export function Example() {
  return (
    <BarChart data={data} xDataKey="label">
      <LinearGradient id="three-stops">
        <stop offset="0%" stopColor="var(--chart-1)" />
        <stop offset="50%" stopColor="var(--chart-2)" />
        <stop offset="100%" stopColor="var(--chart-3)" />
      </LinearGradient>
      <Bar dataKey="value" fill="url(#three-stops)" />
      <BarXAxis />
    </BarChart>
  );
}
```

## Patterns

All pattern components render a repeating tile. Common props: `id` (required), `width` and `height` (tile size in px), `background`, `stroke`, `strokeWidth`, `strokeDasharray`, `className`, `shapeRendering` (default `"auto"`).

### PatternLines

Straight lines in one or more directions.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `id` | `string` | required | Id of the pattern, referenced as `url(#id)` in a fill. |
| `width` | `number` | required | Width of the pattern tile in px. |
| `height` | `number` | required | Height of the pattern tile in px. |
| `orientation` | `("vertical" \| "horizontal" \| "diagonal" \| "diagonalRightToLeft")[]` | `["vertical"]` | Directions of the lines. |
| `background` | `string` | - | Background color of the tile. No background is drawn when omitted. |
| `stroke` | `string` | - | Stroke color of the lines. |
| `strokeWidth` | `number \| string` | - | Stroke width of the lines. |
| `strokeDasharray` | `string \| number` | - | SVG dash pattern of the stroke. |
| `strokeLinecap` | `"square" \| "butt" \| "round" \| "inherit"` | `"square"` | Line cap of the stroke. |
| `shapeRendering` | `string \| number` | `"auto"` | SVG `shape-rendering` of the shapes. |
| `className` | `string` | - | Class name added to the drawn shapes. |

### PatternCircles

One circle per tile.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `id` | `string` | required | Id of the pattern, referenced as `url(#id)` in a fill. |
| `width` | `number` | required | Width of the pattern tile in px. |
| `height` | `number` | required | Height of the pattern tile in px. |
| `radius` | `number` | `2` | Radius of the circle in px. |
| `fill` | `string` | - | Fill color of the circle. |
| `stroke` | `string` | - | Stroke color of the circle. |
| `strokeWidth` | `number \| string` | - | Stroke width of the circle. |
| `strokeDasharray` | `number \| string` | - | SVG dash pattern of the stroke. |
| `complement` | `boolean` | `false` | Also draw circles at the four tile corners. |
| `background` | `string` | - | Background color of the tile. |
| `className` | `string` | - | Class name added to the drawn shapes. |

### PatternWaves

Wavy lines. It takes `id`, `width`, `height`, `background`, `stroke`, `strokeWidth`, `strokeDasharray`, `strokeLinecap` (default `"square"`), `shapeRendering` and `className` like `PatternLines`, plus:

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `fill` | `string` | `"transparent"` | Fill color of the wave path. |

### PatternHexagons

A hexagonal grid. The tile width follows `size`, so there is no `width` prop.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `id` | `string` | required | Id of the pattern, referenced as `url(#id)` in a fill. |
| `height` | `number` | required | Height of the pattern tile in px. |
| `size` | `number` | `3` | Relative size of the hexagon cell. |
| `fill` | `string` | `"transparent"` | Fill color of the hexagon path. |

It also takes `background`, `stroke`, `strokeWidth`, `strokeDasharray`, `strokeLinecap` (default `"square"`), `shapeRendering` and `className` like `PatternLines`.

```tsx
import { Bar, BarChart, BarXAxis, PatternCircles, PatternHexagons, PatternWaves } from "bklit-tanstack-charts";

const data = [
  { label: "A", a: 30, b: 50, c: 20 },
  { label: "B", a: 45, b: 35, c: 40 },
  { label: "C", a: 25, b: 60, c: 30 },
];

export function Example() {
  return (
    <BarChart data={data} xDataKey="label">
      <PatternCircles id="dots" width={8} height={8} radius={1.5} fill="var(--chart-1)" />
      <PatternWaves id="waves" width={10} height={10} stroke="var(--chart-2)" strokeWidth={1} />
      <PatternHexagons id="hex" height={8} stroke="var(--chart-3)" strokeWidth={1} />
      <Bar dataKey="a" fill="url(#dots)" stroke="var(--chart-1)" />
      <Bar dataKey="b" fill="url(#waves)" stroke="var(--chart-2)" />
      <Bar dataKey="c" fill="url(#hex)" stroke="var(--chart-3)" />
      <BarXAxis />
    </BarChart>
  );
}
```

### Pattern presets

`Background` (`pattern`), `PatternArea` (`patternPreset`) and `ChartBrush` (`selectionPattern.preset`) take a `PatternPresetId` instead of a component: `"none"` (solid), `"diagonal"`, `"horizontal"`, `"vertical"`, `"cross"`, `"dots"`, `"circles"` or `"accent"`. `PatternPresetOptions` tunes the preset.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `color` | `string` | - | Color of the pattern lines or dots. |
| `scale` | `number` | `1` | Scales the tile size. `2` doubles it. |
| `strokeWidth` | `number` | - | Stroke width of the lines, or of the ring around circles. |
| `radius` | `number` | - | Radius of the dots or circles in px. |
| `complement` | `boolean` | - | Also draw circles at the tile corners so the pattern reads as a staggered grid. |
| `fill` | `string` | - | Fill color of dots or circles. |
| `dotFill` | `boolean` | - | Fill the dots of the `"dots"` preset. Set to `false` to draw outlined dots. |
| `tileBackground` | `string` | - | Background color behind the pattern tile. |

Unset options use the preset's own values.

## Notes

- **Server rendering.** The chart server-renders and replays its entrance after hydration; fills are part of the chart.
- **Theming.** Use `var(--chart-1)` to `var(--chart-5)` or any other CSS variable as colors so fills follow light and dark mode.

## Differences from bklit-ui

None in behavior.

## Related

- [Area chart](./area-chart.md)
- [Brush](./brush.md)
- [Background](./background.md)
- [Chart config](./chart-config.md)
