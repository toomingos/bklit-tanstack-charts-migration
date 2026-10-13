# FunnelChart

> Adapted from the [bklit-ui documentation](https://github.com/bklit/bklit-ui) (MIT, © uixmat) for bklit-tanstack-charts.

A funnel chart that shows how a value narrows across ordered stages, such as a sales pipeline. Each stage is a segment with halo rings, sized relative to the first stage.

```tsx
import { FunnelChart } from "bklit-tanstack-charts";

const data = [
  { label: "Visitors", value: 12000 },
  { label: "Signups", value: 6400 },
  { label: "Trials", value: 2800 },
  { label: "Customers", value: 900 },
];

export function Example() {
  return <FunnelChart data={data} />;
}
```

## Data shape

```ts
interface FunnelStage {
  label: string; // name of the stage
  value: number; // the first stage counts as 100%
  displayValue?: string; // shown instead of the formatted value
  color?: string; // overrides the chart-level color
  gradient?: { offset: string | number; color: string }[]; // overrides color for the innermost ring
}
```

- Order stages from widest to narrowest. Each segment is sized and labelled relative to the first stage's `value`.
- `data` is required; the chart renders nothing when it is empty.
- A stage's `gradient` takes precedence over its `color` for the innermost ring; the outer halo rings use the first gradient stop as a solid colour.
- Without `className`/`style` sizing, the chart fills the width of its parent.

## Props

### FunnelChart

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `data` | `FunnelStage[]` | required | The stages, widest first. |
| `orientation` | `"horizontal" \| "vertical"` | `"horizontal"` | Stages left to right, or top to bottom. |
| `color` | `string` | `"var(--chart-1)"` | Default stage colour. |
| `layers` | `number` | `3` | Number of concentric halo rings per stage. |
| `gap` | `number` | `4` | Gap between stages in pixels. |
| `edges` | `"curved" \| "straight"` | `"curved"` | Smooth curves or straight edges between stages. |
| `showPercentage` | `boolean` | `true` | Show each stage's share of the first stage as a badge. |
| `showValues` | `boolean` | `true` | Show each stage's value. |
| `showLabels` | `boolean` | `true` | Show each stage's name. |
| `labelLayout` | `"spread" \| "grouped"` | `"spread"` | Place value, percentage and name apart, or stack them together. |
| `labelOrientation` | `"vertical" \| "horizontal"` | `"vertical"` for horizontal funnels, `"horizontal"` for vertical | Stack direction of grouped labels. |
| `labelAlign` | `"center" \| "start" \| "end"` | `"center"` | Where grouped labels sit in their segment. |
| `formatValue` | `(value: number) => string` | whole number with grouping | Formats a stage value. |
| `formatPercentage` | `(pct: number) => string` | rounded, with `%` | Formats a percentage from 0 to 100. |
| `grid` | `boolean \| FunnelGrid` | `false` | Background bands and grid lines. |
| `renderPattern` | `(id: string, color: string) => ReactNode` | none | Returns a pattern definition for each stage; it paints the innermost ring. |
| `hoveredIndex` | `number \| null` | uncontrolled | Controlled hovered stage. |
| `onHoverChange` | `(index: number \| null) => void` | none | Called when the hovered or focused stage changes. |
| `staggerDelay` | `number` | `0.12` | Delay between one stage's entrance and the next, in seconds. |
| `enterTransition` | `Transition` | 1.1 s | Entrance transition. Only `duration` (seconds) and a four-number cubic-bezier `ease` are used. |
| `className` | `string` | none | Class name for the container. |
| `style` | `CSSProperties` | none | Inline styles for the container. |
| `ariaLabel` | `string` | `"Funnel chart"` | Accessible name. |
| `ariaDescription` | `string` | none | Accessible description. |

`FunnelGrid` is the object form of `grid`:

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `bands` | `boolean` | `true` | Show alternating background bands. |
| `bandColor` | `string` | `"var(--color-muted)"` | Colour of the bands. |
| `lines` | `boolean` | `true` | Show grid lines at each gap between stages. |
| `lineColor` | `string` | `"var(--chart-grid)"` | Colour of the lines. |
| `lineOpacity` | `number` | `1` | Opacity of the lines, 0 to 1. |
| `lineWidth` | `number` | `1` | Width of the lines in pixels. |

### FunnelStage and FunnelGradientStop

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `label` | `string` | required | Name of the stage. |
| `value` | `number` | required | Size of the stage. |
| `displayValue` | `string` | none | Text shown instead of the formatted `value`. |
| `color` | `string` | chart `color` | Colour of this stage. |
| `gradient` | `FunnelGradientStop[]` | none | Colour stops for a linear gradient on this stage. |

A `FunnelGradientStop` is `{ offset: string | number; color: string }`. `offset` is a percentage string such as `"50%"`, or a fraction from 0 to 1.

## More examples

### Vertical funnel with a grid and custom formats

```tsx
import { FunnelChart } from "bklit-tanstack-charts";

const data = [
  { displayValue: "12.0k", label: "Visitors", value: 12000 },
  { displayValue: "6.4k", label: "Signups", value: 6400 },
  { displayValue: "2.8k", label: "Trials", value: 2800 },
  { displayValue: "900", label: "Customers", value: 900 },
];

export function Example() {
  return (
    <FunnelChart
      data={data}
      edges="straight"
      formatPercentage={(pct) => `${pct.toFixed(1)}%`}
      grid
      orientation="vertical"
    />
  );
}
```

### Per-stage colours and gradients

```tsx
import { FunnelChart } from "bklit-tanstack-charts";

const data = [
  {
    gradient: [
      { color: "#8b5cf6", offset: "0%" },
      { color: "#3b82f6", offset: "100%" },
    ],
    label: "Leads",
    value: 5000,
  },
  { color: "var(--chart-2)", label: "Qualified", value: 3100 },
  { color: "var(--chart-3)", label: "Won", value: 1200 },
];

export function Example() {
  return <FunnelChart data={data} labelAlign="start" labelLayout="grouped" layers={2} />;
}
```

### Patterns

`renderPattern` is called once per stage with a unique id and the stage colour; return a `<pattern>` using that id.

```tsx
import { FunnelChart } from "bklit-tanstack-charts";

const data = [
  { label: "Visitors", value: 12000 },
  { label: "Signups", value: 6400 },
  { label: "Customers", value: 900 },
];

export function Example() {
  return (
    <FunnelChart
      data={data}
      renderPattern={(id, color) => (
        <pattern height={6} id={id} patternUnits="userSpaceOnUse" width={6}>
          <rect fill={color} fillOpacity={0.35} height={6} width={6} />
          <path d="M0 6 L6 0" stroke={color} strokeWidth={1.5} />
        </pattern>
      )}
    />
  );
}
```

### Controlled hover

```tsx
import { useState } from "react";
import { FunnelChart } from "bklit-tanstack-charts";

const data = [
  { label: "Visitors", value: 12000 },
  { label: "Signups", value: 6400 },
  { label: "Customers", value: 900 },
];

export function Example() {
  const [hovered, setHovered] = useState<number | null>(null);
  return (
    <div>
      <FunnelChart data={data} hoveredIndex={hovered} onHoverChange={setHovered} />
      <p>{hovered === null ? "Hover a stage" : data[hovered]?.label}</p>
    </div>
  );
}
```

## Notes

### Server rendering

`FunnelChart` is server-rendered; the entrance plays after hydration.

### Keyboard and hover

Pointer hover and keyboard focus drive the same state: the stage pops out and the others dim. Focus the chart with Tab and move between stages with the arrow keys. Hover is also reported through `onHoverChange`. There is no tooltip; each stage shows its own value, percentage and name.

### Theming

Stages use `color` (default `--chart-1`) unless a stage sets `color` or `gradient`. The optional grid uses `--color-muted` for the bands and `--chart-grid` for the lines.

```css
:root {
  --chart-1: oklch(0.55 0.2 260);
  --chart-grid: oklch(0.9 0 0);
}
```

### Differences from bklit-ui

- `enterTransition` uses only `duration` (seconds) and a four-number cubic-bezier `ease`; other transition fields are ignored.

## Related

- [PieChart](./pie-chart.md)
- [Gauge](./gauge.md)
- [RingChart](./ring-chart.md)
