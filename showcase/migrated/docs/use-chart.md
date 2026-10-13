# useChart

> Adapted from the [bklit-ui documentation](https://github.com/bklit/bklit-ui) (MIT, © uixmat) for bklit-tanstack-charts.

`useChart` gives a custom component inside a chart access to its dimensions, scales and hover state. Use it to draw your own SVG on top of the chart in plot coordinates, such as a threshold line or a custom marker.

```tsx
import { Line, LineChart, useChart, useYScale } from "bklit-tanstack-charts";

const data = [
  { date: new Date("2025-01-01"), value: 120 },
  { date: new Date("2025-01-02"), value: 180 },
  { date: new Date("2025-01-03"), value: 150 },
  { date: new Date("2025-01-04"), value: 240 },
];

function Threshold({ at }: { readonly at: number }) {
  const { innerWidth } = useChart();
  const yScale = useYScale();
  const y = yScale(at);
  return <line x1={0} x2={innerWidth} y1={y} y2={y} stroke="var(--chart-grid)" strokeDasharray="4 4" />;
}

export function Example() {
  return (
    <LineChart data={data}>
      <Line dataKey="value" />
      <Threshold at={200} />
    </LineChart>
  );
}
```

## Requirements

- Call the hooks only from a component rendered inside a chart, either as a child of the chart or inside tooltip `content`. Outside a chart they throw an error.
- Children that are not chart configuration components (`Line`, `Grid`, ...) are drawn in an SVG layer above the series. Their coordinate origin is the top-left corner of the plot area, inside the margin, so use `xScale` and `yScale` results directly.
- Return SVG elements from such children.

## Hooks

| Hook | Returns | Re-renders |
| --- | --- | --- |
| `useChart()` | `ChartContextValue`: everything below, merged | On every hover or focus move |
| `useChartStable()` | `ChartStableContextValue`: dimensions, scales and data | Only when the chart's layout or data changes |
| `useChartHover()` | `ChartHoverContextValue`: tooltip data and hover indexes | On every hover or focus move |
| `useYScale(yAxisId?)` | The y scale of one axis. Without an id it returns the primary scale. | Like `useChartStable` |

Prefer `useChartStable` in components that do not need hover state, so they do not re-render while the pointer moves.

## ChartStableContextValue

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `data` (required) | `Record<string, unknown>[]` | - | The chart's data rows. |
| `renderData` (required) | `Record<string, unknown>[]` | - | The rows that are drawn. Currently the same rows as `data`. |
| `xScale` (required) | `ScaleTime<number, number, never>` | - | Maps a date to an x pixel inside the plot area. |
| `yScale` (required) | `ScaleLinear<number, number, never>` | - | Scale of the primary (`"left"`) y axis. |
| `yScales` (required) | `Record<string, ScaleLinear<number, number, never>>` | - | Y scale of every axis, keyed by `yAxisId`. |
| `width` (required) | `number` | - | Chart width in px. |
| `height` (required) | `number` | - | Chart height in px. |
| `innerWidth` (required) | `number` | - | Plot area width in px (chart width minus the left and right margins). |
| `innerHeight` (required) | `number` | - | Plot area height in px (chart height minus the top and bottom margins). |
| `margin` (required) | `Margin` | - | Space around the plot area in px. |
| `containerRef` (required) | `RefObject<HTMLDivElement \| null>` | - | Ref to the chart's container element. Use it to portal custom overlays into the chart. |
| `lines` (required) | `LineConfig[]` | - | The registered line series. |
| `animationDuration` (required) | `number` | - | Entrance animation duration in ms. |
| `isLoaded` (required) | `boolean` | - | `true` once the entrance has finished and the chart accepts input. |
| `chartPhase` (required) | `ChartPhase` | - | `"revealing"` until the entrance finishes, then `"ready"`. |
| `chartStatus` (required) | `ChartStatus` | - | The chart's `status`: `"loading"` or `"ready"`. |
| `yDomainTargetByAxis` (required) | `Record<string, [number, number]>` | - | Resolved y domain `[min, max]` per `yAxisId`. |
| `referenceAreas` (required) | `ReferenceAreaConfig[]` | - | The `ReferenceArea` bands, in the order they appear in the chart. |
| `xAccessor` (required) | `(d: Record<string, unknown>) => Date` | - | Reads the x date from a data row. |
| `dateLabels` (required) | `string[]` | - | Formatted x labels, one per data row. |
| `xDomain` | `[Date, Date]` | - | Visible x range when the chart is zoomed, for example by a brush. |
| `xDomainSlotCount` | `number` | - | Number of rows in the full dataset while the chart is zoomed. |
| `columnWidth` | `number` | - | Width in px of the slot for one data row (bar and candlestick charts). |
| `bandWidth` | `number` | - | Width in px of a candle body (`CandlestickChart`) or a bar band. |
| `barScale` | `ScaleBand<string>` | - | Band scale for the categories of a `BarChart`. |
| `barXAccessor` | `((d: Record<string, unknown>) => string)` | - | Reads the category from a data row (`BarChart`). |
| `orientation` | `"horizontal" \| "vertical"` | - | Bar direction: `"vertical"` or `"horizontal"` (`BarChart`). |
| `stacked` | `boolean` | - | Whether bars are stacked (`BarChart`). |
| `stackOffsets` | `Map<number, Map<string, number>>` | - | Cumulative offsets for stacked bars: data index, then `dataKey`. |
| `composedBarDataKeys` | `string[]` | - | `dataKey`s of the `SeriesBar` series, in order (`ComposedChart`). |
| `composedBarSize` | `number` | - | Bar width in px (`ComposedChart`). |
| `composedMaxBarSize` | `number` | - | Maximum bar width in px (`ComposedChart`). |
| `composedBarGap` | `number` | - | Gap between bars of the same row in px (`ComposedChart`). |
| `composedStacked` | `boolean` | - | Whether the `SeriesBar` series are stacked (`ComposedChart`). |
| `composedStackGap` | `number` | - | Gap between stacked bar segments in px (`ComposedChart`). |

## ChartHoverContextValue

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `tooltipData` (required) | `TooltipData \| null` | - | The hovered or focused row, or `null` when nothing is hovered. |
| `setTooltipData` (required) | `Dispatch<SetStateAction<TooltipData \| null>>` | - | Moves the hover (crosshair and tooltip) to `data.index`. Pass `null` to clear it. |
| `selection` | `ChartSelection \| null` | - | Current drag selection, or `null`. Read by `SegmentBackground` and the `SegmentLine*` children. |
| `clearSelection` | `(() => void)` | - | Clears the current drag selection. |
| `hoveredBarIndex` | `number \| null` | - | Index of the hovered bar in a `BarChart`, or `null`. |
| `setHoveredBarIndex` | `((index: number \| null) => void)` | - | Moves the hover to a bar in a vertical `BarChart`. Pass `null` to clear it. |
| `hoveredCandleIndex` | `number \| null` | - | Index of the hovered candle in a `CandlestickChart`, or `null`. |
| `setHoveredCandleIndex` | `((index: number \| null) => void)` | - | Moves the hover to a candle. Pass `null` to clear it. |

## ChartContextValue

`ChartContextValue` is `ChartStableContextValue` and `ChartHoverContextValue` combined.

## Types

### LineConfig

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `dataKey` (required) | `string` | - | Key of the series in the chart data. |
| `stroke` (required) | `string` | - | Stroke color of the line. |
| `strokeWidth` (required) | `number` | - | Stroke width of the line in px. |
| `yAxisId` | `string \| number` | `"left"` | Id of the y-scale group the line uses. |

### TooltipData

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `point` (required) | `Record<string, unknown>` | - | The data point being hovered |
| `index` (required) | `number` | - | Index in the data array |
| `x` (required) | `number` | - | X position in pixels (relative to chart area) |
| `yPositions` (required) | `Record<string, number>` | - | Y positions for each line, keyed by dataKey |
| `xPositions` | `Record<string, number>` | - | X positions for each series (for grouped bars), keyed by dataKey |

### Margin

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `top` (required) | `number` | - | Top margin in px. |
| `right` (required) | `number` | - | Right margin in px. |
| `bottom` (required) | `number` | - | Bottom margin in px. |
| `left` (required) | `number` | - | Left margin in px. |

## Notes

### Server rendering

Custom children render with the chart on the server; hover state is empty until the pointer moves.

### Differences from bklit-ui

None known; the hooks mirror bklit-ui's, and the context shapes are listed above.

## Related

- [ChartTooltip](./tooltip.md) (`content` receives the hovered row)
- [LineChart](./line-chart.md), [BarChart](./bar-chart.md)
