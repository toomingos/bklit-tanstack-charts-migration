# RadarChart

> Adapted from the [bklit-ui documentation](https://github.com/bklit/bklit-ui) (MIT, © uixmat) for bklit-tanstack-charts.

A radar (spider) chart that compares several series across the same set of metrics. Compose it from a grid, axes, labels and one `RadarArea` per series.

```tsx
import { RadarArea, RadarAxis, RadarChart, RadarGrid, RadarLabels } from "bklit-tanstack-charts";

const metrics = [
  { key: "speed", label: "Speed" },
  { key: "power", label: "Power" },
  { key: "range", label: "Range" },
  { key: "comfort", label: "Comfort" },
  { key: "safety", label: "Safety" },
];

const data = [
  { label: "Model A", values: { comfort: 55, power: 90, range: 60, safety: 80, speed: 75 } },
  { label: "Model B", values: { comfort: 85, power: 50, range: 80, safety: 70, speed: 65 } },
];

export function Example() {
  return (
    <RadarChart data={data} metrics={metrics} size={360}>
      <RadarGrid />
      <RadarAxis />
      <RadarLabels />
      <RadarArea index={0} />
      <RadarArea index={1} />
    </RadarChart>
  );
}
```

## Data shape: `metrics`, `data` and `index`

A radar chart has two arrays that work together.

```ts
interface RadarMetric {
  key: string; // unique; the series look up their value under this key
  label: string; // printed by RadarLabels
}

interface RadarData {
  label: string; // name of the series
  color?: string; // defaults to --chart-1 ... --chart-5 by series index
  values: Record<string, number>; // value per metric key, 0 to 100
}
```

- `metrics` defines the spokes. Each metric is one spoke, placed clockwise from 12 o'clock in array order.
- `data` defines the series. Each item is one polygon, and its `values` record holds one number per metric `key`. In the example above, `data[0].values.speed` is the distance of Model A's polygon from the centre along the "Speed" spoke.
- Values run from 0 to 100 and are clamped to that range. The outer grid ring is 100. A key missing from `values` counts as 0. Keys in `values` that match no metric are ignored.
- `RadarArea` elements choose what is drawn. `index` is the position of the series in `data` (the first item is `index={0}`), so there is one `RadarArea` per series you want shown. A series without a `RadarArea` is not drawn, and an index outside `data` is ignored.
- The same `index` is what `hoveredIndex` and `onHoverChange` use: it identifies a series, not a metric.
- Only the parts you include as children are drawn. Leave out `RadarGrid`, `RadarAxis` or `RadarLabels` for a simpler chart.
- Radar charts are client-only: the server renders an empty, correctly sized shell and the chart is drawn after mount (see [Server rendering](#server-rendering)).

## Props

### RadarChart

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `data` | `RadarData[]` | required | The series, one polygon each. |
| `metrics` | `RadarMetric[]` | required | The spokes, clockwise from 12 o'clock. |
| `children` | `ReactNode` | required | `RadarGrid`, `RadarAxis`, `RadarLabels` and `RadarArea` elements. |
| `size` | `number` | fills the parent | Width and height in pixels. |
| `levels` | `number` | `5` | Number of concentric grid rings. Ring `n` marks `n / levels` of the 0 to 100 scale. |
| `margin` | `number` | `60` | Space in pixels kept free around the chart for the labels. |
| `animate` | `boolean` | `true` | Play the entrance animation. |
| `enterDurationMs` | `number` | `1100` | Total time budget of the entrance in milliseconds. |
| `staggerScale` | `number` | `1` | Multiplier for the delays between grid rings, labels and series. `0` starts everything together. |
| `enterTransition` | `Transition` | 1.1 s reveal tween | Transition for the series entrance (`motion` shape, seconds). |
| `motionReplayKey` | `string` | `""` | Changing this string replays the entrance. |
| `hoveredIndex` | `number \| null` | uncontrolled | Controlled hovered series. |
| `onHoverChange` | `(index: number \| null) => void` | none | Called when the hovered or focused series changes. |
| `className` | `string` | none | Class name for the container. |
| `style` | `CSSProperties` | none | Inline styles for the container. |
| `ariaLabel` | `string` | `"Radar chart"` | Accessible name. |
| `ariaDescription` | `string` | none | Accessible description. |

### RadarArea

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `index` | `number` | required | Index of the series this element draws, in the chart's `data`. |
| `color` | `string` | none | Colour of the series. Wins over the data item's `color`, then the palette. |
| `showPoints` | `boolean` | `true` | Draw a dot at each metric value. |
| `showStroke` | `boolean` | `true` | Draw an outline around the polygon. |
| `showGlow` | `boolean` | `true` | Draw a glow behind the polygon while the series is hovered. |
| `className` | `string` | none | Class name for the polygon. |

### RadarGrid

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `showLabels` | `boolean` | `true` | Print the value of each grid ring along the first spoke. |
| `stroke` | `string` | `"var(--border)"` | Colour of the grid lines. |
| `strokeOpacity` | `number` | `0.6` | Opacity of the grid lines, 0 to 1. |
| `className` | `string` | none | Class name for the grid lines. |

### RadarAxis

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `stroke` | `string` | `"var(--border)"` | Colour of the axis lines. |
| `strokeOpacity` | `number` | `0.6` | Opacity of the axis lines, 0 to 1. |
| `className` | `string` | none | Class name for the axis lines. |

### RadarLabels

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `offset` | `number` | `24` | Distance in pixels between the outer grid ring and the labels. |
| `fontSize` | `number` | `11` | Font size of the labels in pixels. |
| `interactive` | `boolean` | `false` | Dim the labels at rest and brighten them while a series is hovered. |
| `className` | `string` | none | Class name for the labels. |

### Hooks and constants

| Export | Description |
| --- | --- |
| `useRadar()` | Geometry and data (`RadarContextValue`) plus `hoveredIndex` and `setHoveredIndex`. |
| `useRadarStable()` | The same without the hovered index, so it does not re-render on hover. |
| `useRadarHover()` | Only `hoveredIndex` and `setHoveredIndex`. |
| `defaultRadarColors` | The default series colours, `--chart-1` to `--chart-5`. |

The hooks must run inside a `RadarChart`.

## More examples

### Controlled hover

```tsx
import { useState } from "react";
import { RadarArea, RadarAxis, RadarChart, RadarGrid, RadarLabels } from "bklit-tanstack-charts";

const metrics = [
  { key: "html", label: "HTML" },
  { key: "css", label: "CSS" },
  { key: "js", label: "JavaScript" },
  { key: "ts", label: "TypeScript" },
  { key: "react", label: "React" },
  { key: "node", label: "Node" },
];

const data = [
  { label: "Alice", values: { css: 80, html: 90, js: 85, node: 40, react: 75, ts: 70 } },
  { label: "Bob", values: { css: 55, html: 60, js: 90, node: 85, react: 65, ts: 88 } },
];

export function Example() {
  const [hovered, setHovered] = useState<number | null>(null);
  return (
    <div>
      <RadarChart data={data} hoveredIndex={hovered} levels={4} metrics={metrics} onHoverChange={setHovered} size={380}>
        <RadarGrid showLabels={false} />
        <RadarAxis />
        <RadarLabels interactive />
        <RadarArea index={0} />
        <RadarArea color="var(--chart-3)" index={1} showPoints={false} />
      </RadarChart>
      <p>{hovered === null ? "Hover a series" : data[hovered]?.label}</p>
    </div>
  );
}
```

### A single series without a grid

```tsx
import { RadarArea, RadarChart, RadarLabels } from "bklit-tanstack-charts";

const metrics = [
  { key: "a", label: "Alpha" },
  { key: "b", label: "Beta" },
  { key: "c", label: "Gamma" },
  { key: "d", label: "Delta" },
];

const data = [{ label: "Score", values: { a: 70, b: 40, c: 85, d: 60 } }];

export function Example() {
  return (
    <RadarChart animate={false} data={data} margin={48} metrics={metrics} size={300}>
      <RadarLabels />
      <RadarArea index={0} showGlow={false} />
    </RadarChart>
  );
}
```

## Notes

### Server rendering

`RadarChart` is client-only. On the server (and in the first client render) it renders its container at the right size but nothing inside; the chart is drawn after mount and then plays its entrance. Use a fixed `size` to avoid a layout shift.

### Keyboard and hover

Pointer hover and keyboard focus drive the same state, and the unit is a series. Hovering or focusing a polygon enlarges it, shows its glow and dims the other series. Focus the chart with Tab and move between series with the arrow keys. Hover is also reported through `onHoverChange`. There is no tooltip.

### Theming

Series colours default to `--chart-1` to `--chart-5` by series index. The grid and axes use `--border`, and the labels use the chart foreground colours.

```css
:root {
  --chart-1: oklch(0.55 0.2 260);
  --chart-2: oklch(0.7 0.15 160);
  --border: oklch(0.9 0 0);
}
```

### Differences from bklit-ui

- `enterTransition` uses the `motion` library shape and defaults to a 1.1 second tween on the shared reveal curve.

## Related

- [PieChart](./pie-chart.md)
- [RingChart](./ring-chart.md)
- [Gauge](./gauge.md)
