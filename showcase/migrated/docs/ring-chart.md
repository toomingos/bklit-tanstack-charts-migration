# RingChart

> Adapted from the [bklit-ui documentation](https://github.com/bklit/bklit-ui) (MIT, © uixmat) for bklit-tanstack-charts.

Concentric progress rings, like an activity tracker. Each ring fills `value / maxValue` of its track, and the centre shows the total or the hovered ring's value instead of a tooltip.

```tsx
import { Ring, RingCenter, RingChart } from "bklit-tanstack-charts";

const data = [
  { label: "Move", maxValue: 100, value: 85 },
  { label: "Exercise", maxValue: 100, value: 62 },
  { label: "Stand", maxValue: 100, value: 45 },
];

export function Example() {
  return (
    <RingChart data={data} size={280}>
      {data.map((item, index) => (
        <Ring index={index} key={item.label} />
      ))}
      <RingCenter defaultLabel="Activity" />
    </RingChart>
  );
}
```

## Data shape

```ts
interface RingData {
  label: string; // shown in the centre while the ring is hovered
  value: number; // current value
  maxValue: number; // value at which the ring is full
  color?: string; // defaults to --chart-1 ... --chart-5, in order
}
```

- `data`, `children` are required. Rings are drawn from the innermost outwards, in `data` order.
- A ring fills `value / maxValue`, limited to 0 to 1. Each ring has its own `maxValue`, so rings can use different scales.
- `Ring` elements are configuration only: they draw nothing, and `index` is the position of the data item they configure. A ring without a `Ring` element still draws, with default options.
- Without `size` the chart fills the width of its parent and stays square.
- The centre total (`RingCenter`) is the sum of all `value`s, not of `maxValue`s.
- Ring charts are client-only: the server renders an empty, correctly sized shell and the rings are drawn after mount (see [Server rendering](#server-rendering)).

## The centre readout (no tooltip)

Rings do not show a tooltip. `RingCenter` shows the total until a ring is hovered or keyboard-focused, then that ring's `value` and `label`. Customise the text with `defaultLabel`, `prefix`, `suffix` and `formatOptions`, or replace what is shown for a hovered ring with a `children` render function receiving `{ value, label, isHovered, data }`.

```tsx
import { Ring, RingCenter, RingChart } from "bklit-tanstack-charts";

const data = [
  { label: "Revenue", maxValue: 50000, value: 38000 },
  { label: "Profit", maxValue: 20000, value: 12500 },
];

export function Example() {
  return (
    <RingChart data={data} size={260}>
      {data.map((item, index) => (
        <Ring index={index} key={item.label} />
      ))}
      <RingCenter formatOptions={{ currency: "USD", maximumFractionDigits: 0, notation: "compact", style: "currency" }}>
        {({ label, value, data: ring }) => (
          <span style={{ textAlign: "center" }}>
            <strong>{Math.round((value / ring.maxValue) * 100)}%</strong>
            <br />
            {label}
          </span>
        )}
      </RingCenter>
    </RingChart>
  );
}
```

## Props

### RingChart

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `data` | `RingData[]` | required | The rings, from the innermost outwards. |
| `children` | `ReactNode` | required | `Ring` elements and an optional `RingCenter`. |
| `size` | `number` | fills the parent | Width and height in pixels. |
| `strokeWidth` | `number` | `12` | Thickness of each ring in pixels. |
| `ringGap` | `number` | `6` | Gap between rings in pixels. |
| `baseInnerRadius` | `number` | `60` | Inner radius of the innermost ring in pixels. Also sets the space available to `RingCenter`. |
| `startAngle` | `number` | `-Math.PI / 2` | Angle where every ring starts, in radians (12 o'clock). |
| `endAngle` | `number` | `(3 * Math.PI) / 2` | Angle where a full ring ends, in radians. |
| `hoveredIndex` | `number \| null` | uncontrolled | Controlled hovered ring. |
| `onHoverChange` | `(index: number \| null) => void` | none | Called when the hovered or focused ring changes. |
| `enterTransition` | `Transition` | 1.1 s reveal tween | Entrance transition (`motion` shape, seconds). |
| `enterStaggerScale` | `number` | `1` | Multiplier for the delay between rings. `0` starts all rings together. |
| `geometryScrubbing` | `boolean` | `false` | Turns off hover effects and `Ring` overrides, for live editors. |
| `animationDuration` | `number` | none | Accepted for compatibility; no effect. Use `enterTransition`. |
| `className` | `string` | none | Class name for the container. |
| `style` | `CSSProperties` | none | Inline styles for the container. |
| `ariaLabel` | `string` | `"Ring chart"` | Accessible name. |
| `ariaDescription` | `string` | none | Accessible description. |

### Ring

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `index` | `number` | required | Index of the data item this element configures. |
| `color` | `string` | none | Colour override. Wins over the data item's `color`. |
| `animate` | `boolean` | `true` | Play the entrance animation for this ring. |
| `lineCap` | `"round" \| "butt"` | `"round"` | Shape of the ring's leading end. |
| `showGlow` | `boolean` | none | Accepted for compatibility; no glow is drawn. |

### RingCenter

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `defaultLabel` | `string` | `"Total"` | Label under the total while no ring is hovered. |
| `formatOptions` | `CenterStatFormat` | `{ maximumFractionDigits: 0, notation: "standard" }` | Number format, in `Intl.NumberFormat` terms. |
| `prefix` | `string` | none | Text before the value. |
| `suffix` | `string` | none | Text after the value. |
| `children` | `(props: { value: number; label: string; isHovered: boolean; data: RingData }) => ReactNode` | none | Custom content shown while a ring is hovered. |
| `className` | `string` | none | Class name for the centre container. |
| `valueClassName` | `string` | none | Class name for the value text. |
| `labelClassName` | `string` | none | Class name for the label text. |

### Hooks and constants

| Export | Description |
| --- | --- |
| `useRing()` | Geometry and data (`RingContextValue`) plus `hoveredIndex` and `setHoveredIndex`. |
| `useRingStable()` | The same without the hovered index, so it does not re-render on hover. |
| `useRingHover()` | Only `hoveredIndex` and `setHoveredIndex`. |
| `defaultRingColors` | The default ring colours, `--chart-1` to `--chart-5`. |

The hooks must run inside a `RingChart`, for example in a component rendered by a `RingCenter` `children` function.

## More examples

### Arc, line caps and colours

`startAngle` and `endAngle` limit the sweep, and `lineCap="butt"` squares the ring ends.

```tsx
import { Ring, RingCenter, RingChart } from "bklit-tanstack-charts";

const data = [
  { color: "var(--chart-1)", label: "CPU", maxValue: 100, value: 72 },
  { color: "var(--chart-2)", label: "Memory", maxValue: 100, value: 48 },
  { color: "var(--chart-3)", label: "Disk", maxValue: 100, value: 91 },
];

export function Example() {
  return (
    <RingChart
      baseInnerRadius={50}
      data={data}
      endAngle={(3 * Math.PI) / 4}
      ringGap={4}
      size={300}
      startAngle={-(3 * Math.PI) / 4}
      strokeWidth={16}
    >
      {data.map((item, index) => (
        <Ring index={index} key={item.label} lineCap="butt" />
      ))}
      <RingCenter suffix="%" />
    </RingChart>
  );
}
```

### Controlled hover

```tsx
import { useState } from "react";
import { Ring, RingCenter, RingChart } from "bklit-tanstack-charts";

const data = [
  { label: "Move", maxValue: 100, value: 85 },
  { label: "Exercise", maxValue: 100, value: 62 },
  { label: "Stand", maxValue: 100, value: 45 },
];

export function Example() {
  const [hovered, setHovered] = useState<number | null>(null);
  return (
    <div style={{ alignItems: "center", display: "flex", gap: 24 }}>
      <RingChart data={data} hoveredIndex={hovered} onHoverChange={setHovered} size={240}>
        {data.map((item, index) => (
          <Ring index={index} key={item.label} />
        ))}
        <RingCenter />
      </RingChart>
      <p>{hovered === null ? "Hover a ring" : data[hovered]?.label}</p>
    </div>
  );
}
```

## Notes

### Server rendering

`RingChart` is client-only. On the server (and in the first client render) it renders its container at the right size but no rings; they are drawn after mount and then play their entrance. Use a fixed `size` to avoid a layout shift.

### Keyboard and hover

Pointer hover and keyboard focus drive the same state. Focus the chart with Tab and move between rings with the arrow keys, Home and End. Hover and focus highlight the ring, dim the others and update `RingCenter`. Hover is also reported through `onHoverChange`.

### Theming

Ring colours default to `--chart-1` to `--chart-5`, in order, then repeat. The unfilled track uses `--border`. The centre text uses `--chart-foreground` and `--chart-foreground-muted`.

```css
:root {
  --chart-1: oklch(0.55 0.2 260);
  --border: oklch(0.9 0 0);
}
```

### Differences from bklit-ui

- `animationDuration` is accepted but has no effect; use `enterTransition` (`motion` shape, seconds) to change the entrance timing.
- `Ring` `showGlow` is accepted but nothing is drawn.

## Related

- [PieChart](./pie-chart.md)
- [Gauge](./gauge.md)
- [RadarChart](./radar-chart.md)
