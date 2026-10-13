# Segment selection

> Adapted from the [bklit-ui documentation](https://github.com/bklit/bklit-ui) (MIT, © uixmat) for bklit-tanstack-charts.

Click-and-drag (or touch-drag) selection of a range on a line or area chart. `SegmentBackground`, `SegmentLineFrom` and `SegmentLineTo` draw the selected region and its two boundaries; you can use any of them on its own.

```tsx
import {
  ChartTooltip,
  Grid,
  Line,
  LineChart,
  SegmentBackground,
  SegmentLineFrom,
  SegmentLineTo,
  XAxis,
} from "bklit-tanstack-charts";

const data = Array.from({ length: 40 }, (_, i) => ({
  date: new Date(2024, 0, 1 + i),
  value: 300 + Math.round(90 * Math.sin(i / 5)) + i * 3,
}));

export function Example() {
  return (
    <LineChart data={data}>
      <Grid horizontal />
      <SegmentBackground />
      <SegmentLineFrom />
      <SegmentLineTo />
      <Line dataKey="value" />
      <XAxis />
      <ChartTooltip />
    </LineChart>
  );
}
```

## Data shape

The selection is described by `ChartSelection`, which you read with `useChart()` from a component placed inside the chart:

```ts
interface ChartSelection {
  startX: number; // x position (px) where the drag started
  endX: number; // x position (px) where the drag currently ends
  startIndex: number; // data index where the selection starts
  endIndex: number; // data index where the selection ends
  active: boolean; // whether a drag is in progress
}
```

- The selection is `null` until a drag begins. `clearSelection()` from `useChart()` clears it.
- Do not assume `startIndex` is smaller than `endIndex`: dragging to the left may reverse them, so take the minimum and maximum before using them.
- The three Segment components draw nothing until there is a selection, so they are safe to leave in the chart.
- While a selection exists, the line highlights the selected stretch.

## Props

### SegmentBackground

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `fill` | `string` | `"var(--chart-segment-background)"` | Fill color of the selected area. |

### SegmentLineFrom and SegmentLineTo

`SegmentLineFrom` draws the line at the start of the selection and `SegmentLineTo` the line at the end. They take the same props.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `stroke` | `string` | `"var(--chart-segment-line)"` | Line color. |
| `strokeWidth` | `number` | `1` | Line width in px. |
| `variant` | `"dashed" \| "solid" \| "gradient"` | `"dashed"` | Line style: dashed, solid, or a gradient that fades out. |

## Examples

### Read the selection

A component placed inside the chart reads the selection with `useChart()`.

```tsx
import { useEffect } from "react";
import { Line, LineChart, SegmentBackground, SegmentLineFrom, SegmentLineTo, XAxis, useChart } from "bklit-tanstack-charts";

type Row = {
  date: Date;
  value: number;
};

const data: Row[] = Array.from({ length: 40 }, (_, i) => ({
  date: new Date(2024, 0, 1 + i),
  value: 200 + Math.round(70 * Math.cos(i / 6)) + i * 2,
}));

function SegmentReader({ onChange }: { onChange: (change: number | null) => void }) {
  const { selection, data: rows } = useChart();
  useEffect(() => {
    if (!selection?.active) {
      onChange(null);
      return;
    }
    const from = Math.min(selection.startIndex, selection.endIndex);
    const to = Math.max(selection.startIndex, selection.endIndex);
    const start = rows[from]?.value;
    const end = rows[to]?.value;
    onChange(typeof start === "number" && typeof end === "number" ? end - start : null);
  }, [selection, rows, onChange]);
  return null;
}

export function Example() {
  return (
    <LineChart data={data}>
      <SegmentBackground fill="var(--chart-1)" />
      <SegmentLineFrom variant="solid" />
      <SegmentLineTo variant="gradient" />
      <Line dataKey="value" />
      <SegmentReader onChange={(change) => console.log(change)} />
      <XAxis />
    </LineChart>
  );
}
```

## Notes

- **Server rendering.** The chart server-renders and replays its entrance after hydration; selection is available once the chart is interactive.
- **Pointer and touch.** Drag across the plot to select.
- **Theming.** `--chart-segment-background` and `--chart-segment-line` set the default colors.

## Differences from bklit-ui

None known. The props and defaults are the same.

## Related

- [Line chart](./line-chart.md)
- [Area chart](./area-chart.md)
- [Brush](./brush.md)
