# ChartBrush

> Adapted from the [bklit-ui documentation](https://github.com/bklit/bklit-ui) (MIT, © uixmat) for bklit-tanstack-charts.

A range selector for time-series charts. Put `ChartBrush` in a small second chart (the brush strip) below the main chart; dragging or resizing its window zooms the main chart to that range. `ChartBrushLayout` ties the two charts together.

```tsx
import { Area, AreaChart, ChartBrush, ChartBrushLayout, ChartTooltip, Grid, XAxis } from "bklit-tanstack-charts";

const data = Array.from({ length: 90 }, (_, i) => ({
  date: new Date(2024, 0, 1 + i),
  value: 200 + Math.round(80 * Math.sin(i / 6) + i),
}));

export function Example() {
  return (
    <div style={{ height: 360 }}>
      <ChartBrushLayout
        brushStrip={(layout) => (
          <AreaChart animationDuration={0} data={data} status="ready" style={{ aspectRatio: "unset", height: "100%" }}>
            <Area animate={false} dataKey="value" fillOpacity={0.15} showHighlight={false} />
            <ChartBrush
              initialSelection={layout.brushSelection ?? undefined}
              onSelectionChange={layout.onBrushSelectionChange}
            />
          </AreaChart>
        )}
        data={data}
        enabled
        height={72}
      >
        {(layout) => (
          <AreaChart
            data={data}
            style={{ aspectRatio: "unset", height: "100%" }}
            xDomain={layout.xDomain}
            xDomainSlotCount={layout.xDomainSlotCount}
          >
            <Grid horizontal />
            <Area dataKey="value" fillOpacity={0.35} />
            <XAxis />
            <ChartTooltip />
          </AreaChart>
        )}
      </ChartBrushLayout>
    </div>
  );
}
```

## Data shape

The brush works on the same rows as the chart: objects with a `Date` under `xDataKey` (default `"date"`) and numbers for each series.

- `ChartBrushLayout` needs `data`, `enabled`, `height` and a `children` render function.
- Give the layout a height (a parent with a fixed height, or `className`/`style` on the main chart); the main chart fills the space above the strip.
- Both charts get the same `data`. The strip is a normal chart with the brush as a child, so style it like any other (hide the tooltip, turn off animation).
- Pass `xDomain` and `xDomainSlotCount` from the layout to the main chart. Without them the main chart does not zoom.
- `onSelectionChange` reports `null` when the window collapses to nothing; the layout then resets to the full range.

## Props

### ChartBrushLayout

Owns the brush selection and derives the visible x range of the main chart.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `data` | `Record<string, unknown>[]` | required | The full dataset. The brushed range starts as its extent and resets when this changes. |
| `xDataKey` | `string` | `"date"` | Key of the date field in each row. |
| `xExtentMax` | `Date` | - | Extends the brushable range past the last data point to this date. |
| `enabled` | `boolean` | required | Turn the brush on. When `false`, the main chart shows all data and the strip is not rendered. |
| `height` | `number` | required | Height of the brush strip in px. |
| `fitMainContent` | `boolean` | `false` | Pack the main chart and strip tightly at the top instead of stretching the main chart to fill the height. |
| `className` | `string` | - | Class names added to the layout container. |
| `children` | `(layout) => ReactNode` | required | Render function for the main chart. Receives the layout state. |
| `brushStrip` | `(layout) => ReactNode` | - | Render function for the brush strip, shown below the main chart when `enabled`. Receives the layout state. |

The `layout` argument (`ChartBrushLayoutState`) has these fields:

| Field | Type | Description |
| --- | --- | --- |
| `xDomain` | `[Date, Date] \| undefined` | Visible x range for the main chart. |
| `xDomainSlotCount` | `number \| undefined` | Number of rows in the full dataset, for x-scale padding. |
| `brushSelection` | `{ start: Date; end: Date } \| null` | Current brush window. |
| `onBrushSelectionChange` | `(selection) => void` | Pass it to `ChartBrush` as `onSelectionChange`. |

### ChartBrush

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `onSelectionChange` | `(selection: { start: Date; end: Date } \| null) => void` | - | Called while the window is dragged or resized, with the selected range, or `null` when the selection collapses to nothing. Escape cancels a drag and reports the previous range. |
| `initialSelection` | `{ start: Date; end: Date } \| null` | - | Window shown on mount. Changing it later does not move the window; it resets when the chart's data changes. |
| `selectionPattern` | `{ preset; color; opacity? }` | - | Styles the brushed window. Only `color` is applied by `ChartBrush`; use `ChartBrushSelectionOverlay` to draw a full pattern. |
| `blurPx` | `number` | `1.5` | Blur applied to the dimmed area outside the window, in px (clamped to 0-5). |
| `fadeOuterEdges` | `boolean` | `true` | Fade the dimmed area out toward the outer edges of the strip. |

`brushDirection`, `selection`, `useWindowMoveEvents` and `selectedBoxStyle` are accepted so bklit-ui code compiles but have no effect. The brush is always horizontal.

### Main chart props

When the brush zooms a `LineChart` or `AreaChart`, pass these to it:

| Prop | Type | Description |
| --- | --- | --- |
| `xDomain` | `[Date, Date]` | Visible x range, from `layout.xDomain`. |
| `xDomainSlotCount` | `number` | Number of rows in the full data, from `layout.xDomainSlotCount`. |
| `yDomainTween` | `boolean` | Animate the y domain when the data or `status` changes (default `true`), so the y scale glides as the visible range changes. |

### Overlays

`ChartBrushSelectionOverlay` and `ChartBrushTrackOverlay` draw the pattern inside the window and the dimmed area outside it, from pixel positions you supply. Most apps only need `ChartBrush`.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `innerWidth` | `number` | required | Plot width in px. |
| `innerHeight` | `number` | required | Plot height in px. |
| `selectionX0` | `number` | required | Pixel x of the selection start within the plot area. |
| `selectionX1` | `number` | required | Pixel x of the selection end within the plot area. |
| `pattern` | `ChartBrushSelectionPattern` | - | Selection overlay only: pattern to draw inside the window. Nothing is drawn when omitted or `"none"`. |
| `blurPx` | `number` | `1.5` | Track overlay only: blur of the dimmed area, in px (clamped to 0-5). |
| `fadeOuterEdges` | `boolean` | `true` | Track overlay only: fade the dimmed area toward the strip edges. |

## Examples

### Brush on a line chart with a pattern color

```tsx
import { ChartBrush, ChartBrushLayout, ChartTooltip, Grid, Line, LineChart, XAxis } from "bklit-tanstack-charts";

const data = Array.from({ length: 120 }, (_, i) => ({
  date: new Date(2024, 0, 1 + i),
  users: 1000 + Math.round(300 * Math.cos(i / 9) + i * 4),
}));

export function Example() {
  return (
    <div style={{ height: 380 }}>
      <ChartBrushLayout
        brushStrip={(layout) => (
          <LineChart
            animationDuration={0}
            data={data}
            margin={{ top: 4, right: 40, bottom: 4, left: 40 }}
            status="ready"
            style={{ aspectRatio: "unset", height: "100%" }}
          >
            <Line animate={false} dataKey="users" showHighlight={false} strokeWidth={2} />
            <ChartBrush
              initialSelection={layout.brushSelection ?? undefined}
              onSelectionChange={layout.onBrushSelectionChange}
              selectionPattern={{ color: "var(--chart-1)", preset: "diagonal" }}
            />
          </LineChart>
        )}
        data={data}
        enabled
        height={72}
      >
        {(layout) => (
          <LineChart
            data={data}
            style={{ aspectRatio: "unset", height: "100%" }}
            xDomain={layout.xDomain}
            xDomainSlotCount={layout.xDomainSlotCount}
          >
            <Grid horizontal />
            <Line dataKey="users" strokeWidth={2} />
            <XAxis />
            <ChartTooltip />
          </LineChart>
        )}
      </ChartBrushLayout>
    </div>
  );
}
```

### Start with a window

```tsx
import { Area, AreaChart, ChartBrush, ChartBrushLayout } from "bklit-tanstack-charts";

const data = Array.from({ length: 60 }, (_, i) => ({
  date: new Date(2024, 0, 1 + i),
  value: 100 + ((i * 37) % 90),
}));

export function Example() {
  return (
    <div style={{ height: 320 }}>
      <ChartBrushLayout
        brushStrip={(layout) => (
          <AreaChart animationDuration={0} data={data} status="ready" style={{ aspectRatio: "unset", height: "100%" }}>
            <Area animate={false} dataKey="value" showHighlight={false} />
            <ChartBrush
              blurPx={3}
              fadeOuterEdges={false}
              initialSelection={layout.brushSelection ?? { start: data[0]!.date, end: data[29]!.date }}
              onSelectionChange={layout.onBrushSelectionChange}
            />
          </AreaChart>
        )}
        data={data}
        enabled
        height={64}
      >
        {(layout) => (
          <AreaChart
            data={data}
            style={{ aspectRatio: "unset", height: "100%" }}
            xDomain={layout.xDomain}
            xDomainSlotCount={layout.xDomainSlotCount}
          >
            <Area dataKey="value" />
          </AreaChart>
        )}
      </ChartBrushLayout>
    </div>
  );
}
```

## Notes

- **Server rendering.** The layout and both charts server-render and replay their entrance after hydration. The brush window is interactive once the strip has mounted.
- **Pointer and keyboard.** Drag the window to pan it, and drag its edges to resize it. Escape during a drag cancels it and restores the previous range.
- **Theming.** The window outline uses `--chart-brush-border` (default `var(--chart-grid)`). The pattern color comes from `selectionPattern.color`.
- Projections are not supported together with brush zoom.

## Differences from bklit-ui

- `brushDirection`, `selection`, `useWindowMoveEvents` and `selectedBoxStyle` have no effect. Use `initialSelection` instead of a controlled `selection`.
- `tweenYDomainOnXDomainChange` on the main chart is accepted but has no effect; the y scale animates through `yDomainTween`, which is on by default.
- `selectionPattern` on `ChartBrush` applies only its `color`. Use `ChartBrushSelectionOverlay` to draw a full pattern.

## Related

- [Line chart](./line-chart.md)
- [Area chart](./area-chart.md)
