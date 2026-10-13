# LiveLineChart

> Adapted from the [bklit-ui documentation](https://github.com/bklit/bklit-ui) (MIT, © uixmat) for bklit-tanstack-charts.

`LiveLineChart` shows streaming time-series data: a sliding time window, a smoothly eased line, a pulsing live dot at the latest value and an interactive crosshair. Use it for tickers and real-time metrics.

```tsx
import { useEffect, useState } from "react";
import { ChartTooltip, LiveLine, LiveLineChart, LiveXAxis, LiveYAxis } from "bklit-tanstack-charts";

interface Point {
  readonly time: number;
  readonly value: number;
}

export function Example() {
  const [data, setData] = useState<Point[]>([]);
  const [value, setValue] = useState(100);

  useEffect(() => {
    const id = setInterval(() => {
      const next = { time: Date.now() / 1000, value: 100 + Math.random() * 10 };
      setData((prev) => [...prev.slice(-500), next]);
      setValue(next.value);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <LiveLineChart data={data} value={value} window={30} style={{ height: 240 }}>
      <LiveLine dataKey="value" stroke="var(--chart-line-primary)" formatValue={(v) => `$${v.toFixed(2)}`} />
      <ChartTooltip showDatePill={false} />
      <LiveXAxis />
      <LiveYAxis position="left" />
    </LiveLineChart>
  );
}
```

## Data shape

```ts
interface LiveLinePoint {
  time: number; // Unix seconds
  value: number;
}
```

- `time` is in Unix seconds, not milliseconds. Append new points as they arrive, oldest first.
- Pass the latest value separately as `value`; the chart eases its display toward it between samples.
- Use `dataKey` if the value field has another name.
- Keep the array bounded (for example the last few hundred points); points older than `window` scroll off to the left.

## LiveLineChart props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `data` (required) | `LiveLinePoint[]` | - | The streaming samples, oldest first. Append new points as they arrive. |
| `value` (required) | `number` | - | The latest value. The chart eases its display toward it. |
| `dataKey` | `string` | `"value"` | Key used for the value field. |
| `window` | `number` | `30` | Visible time window in seconds. |
| `numXTicks` | `number` | `5` | Number of x axis labels; also sizes the leading offset. |
| `nowOffsetUnits` | `number` | `0` | Leading offset in x tick units. `0` puts "now" at the right edge. |
| `exaggerate` | `boolean` | `false` | Use a tight y range around the data instead of the default padded one. |
| `lerpSpeed` | `number` | `0.08` | How fast the displayed value and y range ease toward their targets (0 to 1). |
| `margin` | `Partial<ChartMargin>` | `{ top: 24, right: 16, bottom: 32, left: 16 }` | Space around the plot area in pixels. Missing sides use the default. |
| `paused` | `boolean` | `false` | Freeze the scrolling. |
| `children` (required) | `ReactNode` | - | The layers to draw: `LiveLine`, `Grid`, `LiveXAxis`, `LiveYAxis`, `ChartTooltip`. |
| `className` | `string` | - | Extra CSS class name for the chart container. |
| `style` | `CSSProperties` | - | Inline styles for the chart container. Set `height` to size the chart. |
| `ariaLabel` | `string` | `"Live line chart"` | Accessible name of the chart. |
| `ariaDescription` | `string` | - | Longer accessible description of the chart, exposed as `aria-description`. |

## LiveLine props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `dataKey` (required) | `string` | - | Key of the data field that holds the y values. |
| `stroke` | `string` | `"var(--chart-line-primary)"` | Stroke color of the line. |
| `strokeWidth` | `number` | `2` | Stroke width of the line in px. |
| `curve` | `CurveFactory` | - | Accepted for bklit-ui compatibility and ignored. The line is always drawn with bklit's default `curveMonotoneX`. |
| `fill` | `boolean` | `true` | Show the gradient fill under the line. |
| `pulse` | `boolean` | `true` | Show the pulsing live dot at the right edge. |
| `dotSize` | `number` | `4` | Radius of the live dot in px. |
| `badge` | `boolean` | `true` | Show the value badge at the live tip. |
| `formatValue` | `((value: number) => string)` | - | Formats a value for the badge, the tooltip and the y axis labels. Defaults to two decimals. |
| `momentumColors` | `MomentumColors` | - | Colors the line, fill and dot by momentum direction. Overrides `stroke` for the line. |

## LiveXAxis props

Time labels along the bottom, plus a time pill that follows the crosshair.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `numTicks` | `number` | - | Number of time labels. Defaults to the chart's `numXTicks`. |
| `formatTime` | `((time: number) => string)` | - | Formats a time (in milliseconds since the epoch) into its label. Defaults to `HH:MM:SS`. |

## LiveYAxis props

Animated value labels beside the plot.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `minGap` | `number` | `36` | Minimum gap in px between labels. |
| `position` | `"left" \| "right"` | `"left"` | Side of the plot the labels sit on. |
| `formatValue` | `((value: number) => string)` | - | Formats a tick value into its label. Defaults to the `LiveLine` `formatValue`. |
| `allowDecimals` | `boolean` | `true` | Allow fractional tick values. |

## Examples

### Momentum colors

`momentumColors` colors the line, fill and dot by the short-term trend: up, down or flat. `detectMomentum(data, dataKey, lookback?)` returns the trend (`"up"`, `"down"` or `"flat"`) for your own use. It looks at the last `lookback` points (default 20) and returns `"flat"` when there are fewer than 5.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `up` (required) | `string` | - | Color while the value is rising. |
| `down` (required) | `string` | - | Color while the value is falling. |
| `flat` (required) | `string` | - | Color while the value is steady. |

```tsx
import { ChartTooltip, LiveLine, LiveLineChart, LiveXAxis, LiveYAxis } from "bklit-tanstack-charts";

const now = Date.now() / 1000;
const data = Array.from({ length: 40 }, (_, i) => ({ time: now - (40 - i), value: 100 + Math.sin(i / 4) * 5 + i * 0.1 }));

export function Example() {
  return (
    <LiveLineChart data={data} value={104} style={{ height: 240 }} paused>
      <LiveLine
        dataKey="value"
        momentumColors={{ up: "var(--color-emerald-500)", down: "var(--color-red-500)", flat: "var(--color-zinc-400)" }}
      />
      <ChartTooltip showDatePill={false} />
      <LiveXAxis />
      <LiveYAxis />
    </LiveLineChart>
  );
}
```

### Pausing and the leading gap

Set `paused` to freeze the scrolling while the user inspects the chart; new data can still be appended. `nowOffsetUnits={1}` leaves one x tick of space between the live dot and the right edge.

### Loading

`LiveLineChart` has no loading status. Render a `LineChartLoading` while the stream connects, then swap in the live chart. See [LineChart](./line-chart.md#loading-state).

## Notes

### Keyboard and hover

Hovering moves the crosshair along the visible window and the tooltip follows.

### Theming

The chart uses the same variables as [LineChart](./line-chart.md): `--chart-line-primary`, `--chart-grid`, `--chart-label`, `--chart-tooltip-*`. The live dot and badge use the line color, or `momentumColors` when given.

### Server rendering

`LiveLineChart` renders an empty shell on the server and draws after mount.

### Differences from bklit-ui

- The line is always drawn with bklit's default monotone curve; `curve` on `LiveLine` is accepted for compatibility and other curve factories are ignored.

## Related

- [LineChart](./line-chart.md), [Grid](./grid.md), [ChartTooltip](./tooltip.md)
