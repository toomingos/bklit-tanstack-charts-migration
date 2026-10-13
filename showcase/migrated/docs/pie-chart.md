# PieChart

> Adapted from the [bklit-ui documentation](https://github.com/bklit/bklit-ui) (MIT, © uixmat) for bklit-tanstack-charts.

A composable pie and donut chart with animated slices, hover effects, pattern fills and an optional centre readout. Hovering a slice pops it out, dims the others and, on a donut, shows that slice's label and value in the centre.

```tsx
import { PieChart, PieSlice } from "bklit-tanstack-charts";

const data = [
  { label: "Electronics", value: 4250 },
  { label: "Clothing", value: 3120 },
  { label: "Food", value: 2100 },
];

export function Example() {
  return (
    <PieChart data={data} size={280}>
      {data.map((item, index) => (
        <PieSlice index={index} key={item.label} />
      ))}
    </PieChart>
  );
}
```

## Data shape

```ts
interface PieData {
  label: string; // shown in the centre while the slice is hovered
  value: number; // the slice's share of the total
  color?: string; // defaults to --chart-1 ... --chart-5, in order
  fill?: string; // e.g. "url(#pattern-id)"; wins over color
}
```

- `PieChart` needs `data` and `children`. `children` is required by the type, even if it only holds a `PieCenter`.
- A slice's angle is `value` divided by the sum of all values. Negative values are not supported.
- `PieSlice` elements are configuration only: they draw nothing themselves, and `index` is the position of the data item they configure. A slice without a `PieSlice` still draws, with default options.
- Children other than `PieSlice`, `PieCenter` and pattern or gradient definitions (components whose name contains `Pattern` or `Gradient`) are not rendered.
- Without `size` the pie fills the width of its parent and stays square. Give the parent a width.
- Pie, Ring and Radar charts are client-only: the server renders an empty, correctly sized shell and the pie is drawn after mount (see [Server rendering](#server-rendering)).

## The centre readout (no tooltip)

A pie reports values in its centre, not in a tooltip. `PieCenter` shows the total of all slices (labelled "Total") until a slice is hovered or keyboard-focused, then shows that slice's `value` and `label`. The number rolls from one value to the next.

- `PieCenter` renders only when the chart has a positive `innerRadius`, because it sits in the hole of a donut. On a solid pie (`innerRadius` 0) it renders nothing, and there is no other hover readout.
- Change the default text with `defaultLabel`, `prefix`, `suffix` and `formatOptions` (an `Intl.NumberFormat`-style object).
- Pass a `children` render function to replace the content shown while a slice is hovered. It receives `{ value, label, isHovered, data }`, where `data` is the hovered `PieData` item. The default total view is still shown when nothing is hovered.
- To show values somewhere else, such as a legend or a side panel, use `onHoverChange` or `hoveredIndex` (see [Controlled hover](#controlled-hover-and-a-legend)).

```tsx
import { PieCenter, PieChart, PieSlice } from "bklit-tanstack-charts";

const data = [
  { label: "Electronics", value: 4250 },
  { label: "Clothing", value: 3120 },
  { label: "Food", value: 2100 },
];

export function Example() {
  return (
    <PieChart data={data} innerRadius={80} size={280}>
      {data.map((item, index) => (
        <PieSlice index={index} key={item.label} />
      ))}
      <PieCenter
        defaultLabel="Revenue"
        formatOptions={{ currency: "USD", maximumFractionDigits: 0, style: "currency" }}
      />
    </PieChart>
  );
}
```

Custom content while a slice is hovered:

```tsx
import { PieCenter, PieChart, PieSlice } from "bklit-tanstack-charts";

const data = [
  { label: "Electronics", value: 4250 },
  { label: "Clothing", value: 3120 },
  { label: "Food", value: 2100 },
];

export function Example() {
  return (
    <PieChart data={data} innerRadius={80} size={280}>
      {data.map((item, index) => (
        <PieSlice index={index} key={item.label} />
      ))}
      <PieCenter>
        {({ label, value }) => (
          <span style={{ textAlign: "center" }}>
            <strong>{value.toLocaleString()}</strong>
            <br />
            {label} units sold
          </span>
        )}
      </PieCenter>
    </PieChart>
  );
}
```

## Props

### PieChart

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `data` | `PieData[]` | required | The slices to draw, in order. |
| `children` | `ReactNode` | required | `PieSlice` elements, an optional `PieCenter`, and pattern or gradient definitions. |
| `size` | `number` | fills the parent | Width and height in pixels. |
| `innerRadius` | `number` | `0` | Inner radius in pixels. `0` is a solid pie; positive values draw a donut. |
| `padAngle` | `number` | `0` | Gap between slices, in radians. |
| `cornerRadius` | `number` | `0` | Slice corner radius in pixels. |
| `startAngle` | `number` | `-Math.PI / 2` | Start angle in radians (12 o'clock). |
| `endAngle` | `number` | `(3 * Math.PI) / 2` | End angle in radians (full circle). |
| `hoverOffset` | `number` | `10` | Pixels a hovered slice moves out or grows by. Also padding reserved around the pie. |
| `hoveredIndex` | `number \| null` | uncontrolled | Controlled hovered slice. |
| `onHoverChange` | `(index: number \| null) => void` | none | Called when the hovered or focused slice changes. |
| `enterTransition` | `Transition` | 1.1 s reveal tween | Entrance transition (`motion` shape, seconds). |
| `enterStaggerScale` | `number` | `1` | Multiplier for the delay between slices. |
| `geometryScrubbing` | `boolean` | `false` | Turns off hover effects and `PieSlice` overrides, for live editors. |
| `className` | `string` | none | Class name for the container. |
| `style` | `CSSProperties` | none | Inline styles for the container. |
| `ariaLabel` | `string` | `"Pie chart"` | Accessible name. |
| `ariaDescription` | `string` | none | Accessible description. |

### PieSlice

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `index` | `number` | required | Index of the data item this element configures. |
| `fill` | `string` | none | Paint override, e.g. `url(#patternId)`. Wins over the data item's `color` and `fill`. |
| `animate` | `boolean` | `true` | Play the entrance animation for this slice. |
| `hoverEffect` | `"translate" \| "grow" \| "none"` | `"translate"` | `"translate"` moves the slice out, `"grow"` extends its outer radius, `"none"` leaves it in place. |
| `hoverOffset` | `number` | the chart's `hoverOffset` | Distance in pixels for the hover effect. |
| `color` | `string` | none | Has no effect in bklit-tanstack-charts. Set `color` on the `PieData` item instead. |
| `showGlow` | `boolean` | none | Accepted for compatibility; no glow is drawn. |
| `className` | `string` | none | Accepted for compatibility; no effect. |

### PieCenter

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `defaultLabel` | `string` | `"Total"` | Label under the total while no slice is hovered. |
| `formatOptions` | `CenterStatFormat` | `{ maximumFractionDigits: 0, notation: "standard" }` | Number format, in `Intl.NumberFormat` terms. |
| `prefix` | `string` | none | Text before the value. |
| `suffix` | `string` | none | Text after the value. |
| `children` | `(props: { value: number; label: string; isHovered: boolean; data: PieData }) => ReactNode` | none | Custom content shown while a slice is hovered. |
| `className` | `string` | none | Class name for the centre container. |
| `valueClassName` | `string` | none | Class name for the value text. |
| `labelClassName` | `string` | none | Class name for the label text. |

### PieCenterShell

The same centre layout without slices, for other charts that want a donut-style readout. It accepts the `PieCenter` props except `children`, plus:

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `centerValue` | `number` | required | The value to show. |
| `contextSize` | `number` | required | Square reference size in pixels. |
| `innerRadiusPx` | `number` | required | Inner radius in pixels; must be greater than 0. |
| `animateEntrance` | `boolean` | `true` | Roll the number in from 0 on mount. |

### Hooks and constants

| Export | Description |
| --- | --- |
| `usePie()` | Geometry and data (`PieContextValue`) plus `hoveredIndex` and `setHoveredIndex`. |
| `usePieStable()` | The same without the hovered index, so it does not re-render on hover. |
| `usePieHover()` | Only `hoveredIndex` and `setHoveredIndex`. |
| `defaultPieColors` | The default slice colours, `--chart-1` to `--chart-5`. |
| `DEFAULT_HOVER_OFFSET` | `10`, the default `hoverOffset`. |

The hooks must run inside a `PieChart`. The chart renders only its slices, centre and definitions, so the practical place to use them is a component returned from a `PieCenter` `children` function.

## More examples

### Controlled hover and a legend

`hoveredIndex` and `onHoverChange` link the pie to other UI. Here a `ChartLegend` highlights the same slice as the pie.

```tsx
import { useState } from "react";
import { ChartLegend, PieCenter, PieChart, PieSlice } from "bklit-tanstack-charts";

const data = [
  { color: "var(--chart-1)", label: "Electronics", value: 4250 },
  { color: "var(--chart-2)", label: "Clothing", value: 3120 },
  { color: "var(--chart-3)", label: "Food", value: 2100 },
];

export function Example() {
  const [hovered, setHovered] = useState<number | null>(null);
  return (
    <div style={{ alignItems: "center", display: "flex", gap: 32 }}>
      <PieChart data={data} hoveredIndex={hovered} innerRadius={70} onHoverChange={setHovered} size={240}>
        {data.map((item, index) => (
          <PieSlice index={index} key={item.label} />
        ))}
        <PieCenter />
      </PieChart>
      <ChartLegend hoveredIndex={hovered} items={data} onHover={setHovered} showPercentage title="Sales" />
    </div>
  );
}
```

### Hover effects and a half donut

`hoverEffect="grow"` extends the hovered slice outwards instead of moving it. `startAngle` and `endAngle` limit the sweep.

```tsx
import { PieChart, PieSlice } from "bklit-tanstack-charts";

const data = [
  { label: "Direct", value: 40 },
  { label: "Search", value: 35 },
  { label: "Social", value: 25 },
];

export function Example() {
  return (
    <PieChart
      cornerRadius={4}
      data={data}
      endAngle={Math.PI / 2}
      innerRadius={70}
      padAngle={0.03}
      size={300}
      startAngle={-Math.PI / 2}
    >
      {data.map((item, index) => (
        <PieSlice hoverEffect="grow" index={index} key={item.label} />
      ))}
    </PieChart>
  );
}
```

### Patterns

Render a pattern component as a child of the chart and point a slice's `fill` at its id.

```tsx
import { PatternLines, PieChart, PieSlice } from "bklit-tanstack-charts";

const data = [
  { label: "Electronics", value: 4250 },
  { label: "Clothing", value: 3120 },
  { label: "Food", value: 2100 },
];

export function Example() {
  return (
    <PieChart data={data} size={280}>
      <PatternLines
        height={8}
        id="pie-stripes"
        orientation={["diagonal"]}
        stroke="var(--chart-1)"
        strokeWidth={2}
        width={8}
      />
      <PieSlice fill="url(#pie-stripes)" index={0} />
      <PieSlice index={1} />
      <PieSlice index={2} />
    </PieChart>
  );
}
```

## Notes

### Server rendering

`PieChart` is client-only. On the server (and in the first client render) it renders its container at the right size but no slices; the slices are drawn after mount and then play their entrance. Use a fixed `size` to avoid a layout shift. Charts that do server-render, such as the bar or line charts, replay their entrance after hydration instead.

### Keyboard and hover

Pointer hover and keyboard focus drive the same state. Focus the chart with Tab and move between slices with the arrow keys, Home and End. Hover and focus pop the slice out, dim the other slices and update `PieCenter`. Hover is also reported through `onHoverChange`.

### Theming

Slice colours default to `--chart-1` to `--chart-5`, in order, then repeat. Set them in your CSS:

```css
:root {
  --chart-1: oklch(0.55 0.2 260);
  --chart-2: oklch(0.7 0.15 160);
}
```

Override a single slice with `color` on its `PieData` item. The centre text uses `--chart-foreground` and `--chart-foreground-muted`.

### Differences from bklit-ui

- `PieSlice` `color` has no effect; set `color` on the `PieData` item. `showGlow` and `className` are accepted but do nothing.

## Related

- [RingChart](./ring-chart.md)
- [Gauge](./gauge.md)
- [RadarChart](./radar-chart.md)
- [FunnelChart](./funnel-chart.md)
