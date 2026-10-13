# ProfitLossLine

> Adapted from the [bklit-ui documentation](https://github.com/bklit/bklit-ui) (MIT, © uixmat) for bklit-tanstack-charts.

A single line that is green above zero and red below it, with the color switching where the line crosses zero. Use it inside `LineChart` for profit and loss, deltas and anything else that crosses a baseline.

```tsx
import { ChartTooltip, Grid, LineChart, ProfitLossLine, XAxis } from "bklit-tanstack-charts";

const data = [
  { date: new Date("2024-01-01"), pnl: 420 },
  { date: new Date("2024-01-02"), pnl: -180 },
  { date: new Date("2024-01-03"), pnl: 260 },
  { date: new Date("2024-01-04"), pnl: -90 },
  { date: new Date("2024-01-05"), pnl: 510 },
  { date: new Date("2024-01-06"), pnl: -340 },
];

export function Example() {
  return (
    <LineChart data={data}>
      <Grid highlightRowValues={[0]} horizontal />
      <ProfitLossLine dataKey="pnl" />
      <XAxis />
      <ChartTooltip />
    </LineChart>
  );
}
```

## Data shape

```ts
interface Row {
  date: Date; // x value (the chart's xDataKey)
  pnl: number; // the series; >= 0 is profit, < 0 is loss
}
```

- `dataKey` is required and names the numeric field. Values at or above zero use `positiveColor`; values below use `negativeColor`.
- `ProfitLossLine` registers its own series, so the y range and the tooltip include it. You do not need a hidden `Line` for the same `dataKey`.
- The line uses the chart's `xDataKey` (default `"date"`).
- Highlight the zero baseline with `Grid highlightRowValues={[0]}`.

## Props

### ProfitLossLine

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `dataKey` | `string` | required | Key of the numeric series in the chart data. Values at or above zero use `positiveColor`, values below use `negativeColor`. |
| `strokeWidth` | `number` | `2.5` | Stroke width in px. |
| `positiveColor` | `string` | `"var(--color-emerald-500)"` | Color above zero. |
| `negativeColor` | `string` | `"var(--color-red-500)"` | Color below zero. |
| `curve` | `CurveFactory` | `curveLinear` | d3 curve factory used to draw the line. |

`xDataKey` and `fadeEdges` are accepted so bklit-ui code compiles but are not read.

### ProfitLossLegend

An optional legend with Profit and Loss items. Hovering an item dims the opposite segments when the chart and the legend share the hovered index through `ProfitLossLegendHoverProvider` (see the example below).

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `hoveredIndex` | `number \| null` | `null` | Controlled hovered item: `0` is Profit, `1` is Loss, `null` is none. |
| `onHoverChange` | `(index: number \| null) => void` | - | Called with the hovered item index (`0` Profit, `1` Loss), or `null` when the pointer leaves. |
| `align` | `"start" \| "center" \| "end"` | `"start"` | Horizontal alignment of the legend. |
| `className` | `string` | - | Extra class names added to the legend wrapper. |

## Examples

### Custom colors and tooltip rows

```tsx
import { ChartTooltip, Grid, LineChart, ProfitLossLine, XAxis } from "bklit-tanstack-charts";

const data = Array.from({ length: 24 }, (_, i) => ({
  date: new Date(2024, 0, 1 + i),
  pnl: Math.round(400 * Math.sin(i / 3) - 40),
}));

export function Example() {
  return (
    <LineChart data={data}>
      <Grid highlightRowStroke="var(--foreground)" highlightRowStrokeOpacity={0.35} highlightRowValues={[0]} horizontal />
      <ProfitLossLine dataKey="pnl" negativeColor="#e11d48" positiveColor="#16a34a" />
      <XAxis />
      <ChartTooltip
        rows={(point) => {
          const value = typeof point.pnl === "number" ? point.pnl : 0;
          return [{ color: value >= 0 ? "#16a34a" : "#e11d48", label: "Profit/Loss", value }];
        }}
      />
    </LineChart>
  );
}
```

### With a legend

Hold the hovered index in state, pass it to the provider (which the chart reads) and to the legend.

```tsx
import { useState } from "react";
import {
  ChartTooltip,
  Grid,
  LineChart,
  ProfitLossLegend,
  ProfitLossLegendHoverProvider,
  ProfitLossLine,
  XAxis,
} from "bklit-tanstack-charts";

const data = Array.from({ length: 24 }, (_, i) => ({
  date: new Date(2024, 0, 1 + i),
  pnl: Math.round(300 * Math.cos(i / 4) + 20),
}));

export function Example() {
  const [hovered, setHovered] = useState<number | null>(null);
  return (
    <ProfitLossLegendHoverProvider hoveredIndex={hovered}>
      <LineChart data={data}>
        <Grid highlightRowValues={[0]} horizontal />
        <ProfitLossLine dataKey="pnl" />
        <XAxis />
        <ChartTooltip />
      </LineChart>
      <ProfitLossLegend hoveredIndex={hovered} onHoverChange={setHovered} />
    </ProfitLossLegendHoverProvider>
  );
}
```

## Notes

- **Server rendering.** The chart server-renders and replays its entrance after hydration.
- **Keyboard and hover.** The tooltip, crosshair and keyboard navigation work as on `LineChart`.
- **Theming.** The default colors are `--color-emerald-500` and `--color-red-500`. Define them, or pass `positiveColor` and `negativeColor`.

## Differences from bklit-ui

- No hidden `Line` is needed. bklit-ui asks you to pair `ProfitLossLine` with a transparent `Line` with the same `dataKey` so the chart registers the series.
- `xDataKey` and `fadeEdges` are accepted but ignored: the line uses the chart's x key and never fades its ends.
- The `profitLossColor` and `resolveProfitLossTooltipLabel` helpers are internal; build tooltip row colors yourself, as in the example above. `indicatorColor` on `ChartTooltip` ignores the function form.

## Related

- [Line chart](./line-chart.md)
- [Legend](./legend.md)
