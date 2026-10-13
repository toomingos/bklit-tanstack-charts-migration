# CandlestickChart

> Adapted from the [bklit-ui documentation](https://github.com/bklit/bklit-ui) (MIT, © uixmat) for bklit-tanstack-charts.

`CandlestickChart` draws open, high, low and close data as candles: a body between open and close and a wick from low to high. Rising candles and falling candles use different colors.

```tsx
import { Candlestick, CandlestickChart, ChartTooltip, Grid, XAxis, YAxis } from "bklit-tanstack-charts";

const data = [
  { date: new Date("2025-01-01"), open: 100, high: 112, low: 96, close: 108 },
  { date: new Date("2025-01-02"), open: 108, high: 115, low: 104, close: 106 },
  { date: new Date("2025-01-03"), open: 106, high: 118, low: 105, close: 117 },
  { date: new Date("2025-01-04"), open: 117, high: 120, low: 109, close: 111 },
];

export function Example() {
  return (
    <CandlestickChart data={data}>
      <Grid horizontal />
      <Candlestick />
      <XAxis />
      <YAxis />
      <ChartTooltip />
    </CandlestickChart>
  );
}
```

## Data shape

```ts
interface OHLCDataPoint {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
}
```

- The time value lives under `xDataKey` (default `"date"`) and must be a `Date`.
- A candle with `close >= open` is positive; otherwise it is negative.
- The y domain covers every low and high.

## CandlestickChart props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `data` (required) | `OHLCDataPoint[]` | - | The candles to plot, one row per period. |
| `xDataKey` | `string` | `"date"` | Key of the time value in each row. The value must be a `Date` or something `new Date()` accepts. |
| `margin` | `Partial<ChartMargin>` | `{ top: 40, right: 40, bottom: 40, left: 40 }` | Space around the plot area in pixels. Missing sides use the default. |
| `animationDuration` | `number` | `1100` | Duration of the entrance in milliseconds. |
| `enterTransition` | `Transition` | - | Customizes the entrance: a spring, or a cubic-bezier tween with a `duration` in seconds. See `EnterTransition`. |
| `revealSignature` | `string` | - | Changing this string replays the entrance animation. |
| `aspectRatio` | `string` | `"2 / 1"` | CSS aspect ratio of the chart, as `"width / height"`. |
| `className` | `string` | - | Extra CSS class name for the chart container. |
| `style` | `CSSProperties` | - | Inline styles for the chart container. `aspectRatio: "unset"` or an explicit `height` makes the chart fill the container height. |
| `candleGap` | `number` | `0.2` | Gap between candle slots as a fraction of the slot width (0-1). Ignored when `candleWidth` is set. A gap below the default cannot widen candles past 80% of their spacing. |
| `candleWidth` | `number` | - | Fixed candle body width in px. When unset, candles size to the spacing between them. |
| `xDomain` | `[Date, Date]` | - | Visible x range as `[start, end]`, used for brush zoom. The chart plots only this range of `data`. |
| `xDomainSlotCount` | `number` | - | Length of the full dataset while `xDomain` zooms into part of it. It keeps candle spacing consistent with the unzoomed chart. |
| `children` (required) | `ReactNode` | - | The layers to draw: `Candlestick`, `Grid`, `XAxis`, `YAxis`, `ChartTooltip` and the other chart children. |
| `ariaLabel` | `string` | `"Candlestick chart"` | Accessible name of the chart. |
| `ariaDescription` | `string` | - | Longer accessible description of the chart, exposed as `aria-description`. |

## Candlestick props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `animate` | `boolean` | `true` | Animate the candles in on entrance. |
| `positiveFill` | `string` | `"var(--color-emerald-500)"` | Fill color of candles that closed at or above their open. |
| `negativeFill` | `string` | `"var(--color-red-500)"` | Fill color of candles that closed below their open. |
| `bodyPatternPositive` | `string` | - | Accepted for bklit-ui compatibility. It has no effect in bklit-tanstack-charts. |
| `bodyPatternNegative` | `string` | - | Accepted for bklit-ui compatibility. It has no effect in bklit-tanstack-charts. |
| `insideStrokeWidth` | `number` | - | Accepted for bklit-ui compatibility. It has no effect in bklit-tanstack-charts. |
| `fadedOpacity` | `number` | `0.3` | Opacity of the candles that are not hovered while another candle is hovered. |
| `showHoverFade` | `boolean` | `true` | Dim the candles that are not hovered. |

## Examples

### Custom colors and fixed width

```tsx
import { Candlestick, CandlestickChart, ChartTooltip, Grid, XAxis, YAxis } from "bklit-tanstack-charts";

const data = [
  { date: new Date("2025-01-01"), open: 100, high: 112, low: 96, close: 108 },
  { date: new Date("2025-01-02"), open: 108, high: 115, low: 104, close: 106 },
  { date: new Date("2025-01-03"), open: 106, high: 118, low: 105, close: 117 },
  { date: new Date("2025-01-04"), open: 117, high: 120, low: 109, close: 111 },
];

export function Example() {
  return (
    <CandlestickChart data={data} candleWidth={18}>
      <Grid horizontal />
      <Candlestick positiveFill="var(--chart-2)" negativeFill="var(--chart-5)" />
      <XAxis />
      <YAxis />
      <ChartTooltip />
    </CandlestickChart>
  );
}
```

### Zoomed range

`xDomain` plots only part of `data`; pass `xDomainSlotCount` with the full length so candle spacing stays the same as in the unzoomed chart. See [Brush](./brush.md) for a control that drives it.

```tsx
import { Candlestick, CandlestickChart, XAxis, YAxis } from "bklit-tanstack-charts";

const data = [
  { date: new Date("2025-01-01"), open: 100, high: 112, low: 96, close: 108 },
  { date: new Date("2025-01-02"), open: 108, high: 115, low: 104, close: 106 },
  { date: new Date("2025-01-03"), open: 106, high: 118, low: 105, close: 117 },
  { date: new Date("2025-01-04"), open: 117, high: 120, low: 109, close: 111 },
];

export function Example() {
  return (
    <CandlestickChart
      data={data}
      xDomain={[new Date("2025-01-02"), new Date("2025-01-04")]}
      xDomainSlotCount={data.length}
    >
      <Candlestick />
      <XAxis />
      <YAxis />
    </CandlestickChart>
  );
}
```

## Notes

### Keyboard and hover

Hovering a candle dims the others to `fadedOpacity` (turn this off with `showHoverFade={false}`). With keyboard focus on the chart, the arrow keys move between candles and Home and End jump to the first and last.

### Theming

Candle colors default to the emerald and red palette colors. Override them with `positiveFill` and `negativeFill`. Grid, axes and tooltip use the `--chart-*` variables.

### Server rendering

`CandlestickChart` server-renders and replays its entrance after hydration.

### Differences from bklit-ui

- `bodyPatternPositive`, `bodyPatternNegative` and `insideStrokeWidth` on `Candlestick` are accepted for compatibility and have no effect.

## Related

- [Axes](./axes.md), [Grid](./grid.md), [ChartTooltip](./tooltip.md)
- [Brush](./brush.md)
