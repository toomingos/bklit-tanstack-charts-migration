# Gauge

> Adapted from the [bklit-ui documentation](https://github.com/bklit/bklit-ui) (MIT, © uixmat) for bklit-tanstack-charts.

A notch gauge that shows a 0 to 100 value as an arc or as a horizontal track, with an optional animated number label.

```tsx
import { Gauge } from "bklit-tanstack-charts";

export function Example() {
  return <Gauge centerValue={72} defaultLabel="Health" suffix="%" value={72} />;
}
```

## Data shape and gotchas

- `value` is the only required prop. It is a number from 0 to 100: the share of notches drawn in the active colour.
- `centerValue` is independent of `value`. The label is drawn only when `centerValue` is set, so it can show a related figure (revenue, a count) next to a percentage fill.
- Omit `width` and `height` to fill the parent. An arc gauge has a fixed size only when both `width` and `height` are set. For a linear gauge, `height` is the track thickness.
- `children`, `geometryScrubbing` and custom SVG definitions are not supported: patterns cannot be referenced by `activeFill` or `inactiveFill`.
- A gauge has no per-notch data, so there is no hover or tooltip and the gauge is not a keyboard stop. It is exposed as one image with the label `Gauge: <value>%`.

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `value` | `number` | required | Fill level, 0 to 100. |
| `orientation` | `"arc" \| "linear"` | `"arc"` | Notches around an arc, or along a horizontal track. |
| `totalNotches` | `number` | `40` | Number of notches. |
| `spacing` | `number` | `25` | Share of the track, in percent, reserved for gaps between notches. |
| `notchCornerRadius` | `number` | `0` | Corner radius of each notch in pixels. |
| `uniformWidth` | `boolean` | `false` for arc, `true` for linear | `true` draws parallel-sided notches; `false` tapers them. |
| `startAngle` | `number` | `135` | Angle where the arc starts, in degrees. Arc only. |
| `endAngle` | `number` | `405` | Angle where the arc ends, in degrees. Arc only. |
| `useGradient` | `boolean` | `false` | Colour the notches along a gradient. |
| `activeGradient` | `readonly [string, string]` | `--chart-1` to `--chart-5` | `[from, to]` colours for active notches, used with `useGradient`. |
| `inactiveGradient` | `readonly [string, string]` | `activeGradient` | `[from, to]` colours for inactive notches, used with `useGradient`. |
| `activeFill` | `string` | `--chart-1` | Colour of active notches. Wins over the gradient options. |
| `inactiveFill` | `string` | `--border` | Colour of inactive notches. |
| `activeFillOpacity` | `number` | `1` | Opacity of active notches. |
| `inactiveFillOpacity` | `number` | `0.8` | Opacity of inactive notches. |
| `centerValue` | `number` | none | Number shown in the label. The label is drawn only when set. |
| `defaultLabel` | `string` | `"Total"` | Caption under (arc) or next to (linear) the number. |
| `prefix` | `string` | none | Text before the number. |
| `suffix` | `string` | none | Text after the number. |
| `formatOptions` | `GaugeStatFormat` | `{ maximumFractionDigits: 0, notation: "standard" }` | Number format, in `Intl.NumberFormat` terms. |
| `labelPlacement` | `"top" \| "bottom" \| "left" \| "right"` | `"top"` | Label position relative to a linear track. Arc gauges always centre it. |
| `labelAlign` | `"start" \| "center" \| "end"` | `"start"` | Label alignment across a linear track. |
| `notchLengthPercent` | `number` | `100` | Notch length as a percentage of full length, clamped to 5 to 100. |
| `notchWidthPercent` | `number` | `80` | Notch width as a percentage of its slot. Linear only. |
| `linearHeight` | `number` | `24` | Track thickness in pixels when `height` is not set. Linear only. |
| `width` | `number` | fills the parent | Fixed width in pixels. |
| `height` | `number` | none | Fixed height in pixels. For linear, the track thickness. |
| `minWidth` | `number` | `300` arc, `200` linear | Minimum width in pixels when filling the parent. |
| `enterTransition` | `Transition` | reveal tween | Transition for each notch's entrance (`motion` shape, seconds). |
| `enterStaggerScale` | `number` | `1` | Multiplier for the delay between notches, limited to 0.25 to 2.5. |
| `className` | `string` | none | Class name for the root element. |
| `children` | `ReactNode` | none | Accepted for compatibility; ignored. |
| `geometryScrubbing` | `boolean` | none | Accepted for compatibility; ignored. |

## More examples

### Linear gauge

```tsx
import { Gauge } from "bklit-tanstack-charts";

export function Example() {
  return (
    <Gauge
      centerValue={4200}
      defaultLabel="Downloads"
      formatOptions={{ maximumFractionDigits: 1, notation: "compact" }}
      labelAlign="start"
      labelPlacement="top"
      orientation="linear"
      totalNotches={30}
      value={42}
    />
  );
}
```

### Gradient and rounded notches

```tsx
import { Gauge } from "bklit-tanstack-charts";

export function Example() {
  return (
    <Gauge
      activeGradient={["#22c55e", "#ef4444"]}
      centerValue={64}
      defaultLabel="Load"
      notchCornerRadius={3}
      startAngle={180}
      endAngle={360}
      suffix="%"
      useGradient
      value={64}
    />
  );
}
```

### A fixed-size gauge

```tsx
import { Gauge } from "bklit-tanstack-charts";

export function Example() {
  return <Gauge centerValue={88} height={220} suffix="%" value={88} width={220} />;
}
```

## Notes

### Server rendering

The gauge is server-rendered and plays its entrance after hydration.

### Theming

Active notches use `--chart-1` (or `--chart-1` to `--chart-5` with `useGradient`), inactive notches use `--border`, and the label uses `--chart-foreground` and `--chart-foreground-muted`.

```css
:root {
  --chart-1: oklch(0.55 0.2 260);
  --border: oklch(0.9 0 0);
}
```

### Differences from bklit-ui

- Custom SVG definitions passed as `children` cannot be used for `activeFill` or `inactiveFill`; `children` is ignored.
- `geometryScrubbing` is accepted but ignored.

## Related

- [PieChart](./pie-chart.md)
- [RingChart](./ring-chart.md)
- [FunnelChart](./funnel-chart.md)
