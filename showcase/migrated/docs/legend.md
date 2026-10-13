# Legend

> Adapted from the [bklit-ui documentation](https://github.com/bklit/bklit-ui) (MIT, © uixmat) for bklit-tanstack-charts.

A composable legend: define the row layout once and it is repeated for every item. Rows highlight on hover and can show a marker, a label, a value, a percentage and a progress bar. `ChartLegend` is a ready-made version of the same thing for the common case.

```tsx
import { Legend, LegendItemComponent, LegendLabel, LegendMarker, LegendValue } from "bklit-tanstack-charts";

const items = [
  { label: "Organic", value: 4250, maxValue: 5000, color: "#0ea5e9" },
  { label: "Paid", value: 3120, maxValue: 5000, color: "#a855f7" },
];

export function Example() {
  return (
    <Legend items={items} title="Traffic sources">
      <LegendItemComponent>
        <LegendMarker />
        <LegendLabel />
        <LegendValue />
      </LegendItemComponent>
    </Legend>
  );
}
```

## Data shape

```ts
interface LegendItemData {
  label: string; // name shown for the item
  value: number; // current value
  maxValue?: number; // value that counts as 100%
  color: string; // marker and progress bar color
}
```

- `Legend` takes `items` and exactly one child element, which is rendered once per item. Use a `LegendItemComponent` as that child.
- `maxValue` drives both the percentage and `LegendProgress`. When it is missing or zero, the percentage and the progress bar are not shown.
- The legend is independent of any chart. To link it to a chart, share the hovered index (see [Linking a legend to a chart](#linking-a-legend-to-a-chart)).

## Props

### Legend

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `items` | `LegendItemData[]` | required | The items to list. |
| `hoveredIndex` | `number \| null` | - | Controlled hovered item index (`null` for none). The legend manages hover itself when this is left `undefined`. |
| `onHoverChange` | `(index: number \| null) => void` | - | Called with the hovered item index, or `null` when the pointer leaves. Only used when `hoveredIndex` is controlled. |
| `title` | `string` | - | Heading shown above the items. |
| `titleClassName` | `string` | - | Class names added to the title, on top of the default title style. |
| `className` | `string` | - | Class names added to the legend container. |
| `children` | `ReactElement` | required | A single element rendered once per item, usually a `LegendItemComponent`. |

### LegendItemComponent

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `className` | `string` | - | Class names added to the row, on top of the default row style. |
| `children` | `ReactNode` | required | Row content, for example `LegendMarker`, `LegendLabel`, `LegendValue` and `LegendProgress`. |

### LegendMarker

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `className` | `string` | - | Class names that replace the default marker size. |

### LegendLabel

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `className` | `string` | - | Class names that replace the default label text style. |

### LegendValue

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `className` | `string` | - | Class names that replace the default value text style. |
| `showPercentage` | `boolean` | `false` | Show the percentage of `maxValue` next to the value. Nothing is shown for items without a `maxValue`. |
| `percentageClassName` | `string` | - | Class names that replace the default percentage text style. |
| `formatValue` | `(value: number) => string` | en-US number format, for example `"1,234"` | Formats the value. |
| `formatPercentage` | `(percentage: number) => string` | percentage rounded to a whole number followed by `%` | Formats the percentage (a number from 0 to 100). |

### LegendProgress

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `trackClassName` | `string` | - | Class names added to the progress track. |
| `indicatorClassName` | `string` | - | Class names added to the filled bar. |
| `height` | `string` | - | Height of the progress track. Defaults to a thin bar. |

The progress bar reads the item's `value`, `maxValue` and `color`, and renders nothing for an item without a `maxValue`.

### ChartLegend

A ready-made legend. It covers the usual layouts through `show*` options; use `renderItem` for a fully custom row.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `items` | `LegendItem[]` | required | The items to list (same shape as `LegendItemData`). |
| `hoveredIndex` | `number \| null` | `null` | Hovered item index (`null` for none). Pair it with `onHover` to share hover with a chart. |
| `onHover` | `(index: number \| null) => void` | - | Called with the item index when the pointer enters a row, and `null` when it leaves. |
| `showProgress` | `boolean` | `false` | Show a progress bar under each item that has a `maxValue`. |
| `showMarker` | `boolean` | `true` | Show the colored dot before each label. |
| `showValue` | `boolean` | `true` | Show each item's value. |
| `showPercentage` | `boolean` | value of `showProgress` | Show each item's percentage of `maxValue`. |
| `formatValue` | `(value: number) => string` | en-US number format | Formats each value. |
| `title` | `string` | - | Heading shown above the items. |
| `className` | `string` | - | Class names added to the legend container. |
| `titleClassName` | `string` | - | Class names added to the title, on top of the default title style. |
| `itemClassName` | `string` | - | Class names added to each row. |
| `labelClassName` | `string` | - | Class names that replace the default label text style. |
| `valueClassName` | `string` | - | Class names that replace the default value text style. |
| `renderItem` | `(props) => ReactNode` | - | Renders a row yourself. Receives `{ item, index, isHovered, isFaded, percentage }`. When set, the `show*` options are ignored. |

## Examples

### Value, percentage and progress

```tsx
import {
  Legend,
  LegendItemComponent,
  LegendLabel,
  LegendMarker,
  LegendProgress,
  LegendValue,
} from "bklit-tanstack-charts";

const items = [
  { label: "Organic", value: 4250, maxValue: 5000, color: "var(--chart-1)" },
  { label: "Paid", value: 3120, maxValue: 5000, color: "var(--chart-2)" },
  { label: "Referral", value: 1480, maxValue: 5000, color: "var(--chart-3)" },
];

export function Example() {
  return (
    <Legend items={items} title="Sessions by channel">
      <LegendItemComponent>
        <LegendMarker />
        <LegendLabel />
        <LegendValue showPercentage />
        <LegendProgress />
      </LegendItemComponent>
    </Legend>
  );
}
```

### ChartLegend

```tsx
import { ChartLegend } from "bklit-tanstack-charts";

const items = [
  { label: "Desktop", value: 6200, maxValue: 8000, color: "var(--chart-1)" },
  { label: "Mobile", value: 4100, maxValue: 8000, color: "var(--chart-2)" },
  { label: "Tablet", value: 900, maxValue: 8000, color: "var(--chart-3)" },
];

export function Example() {
  return <ChartLegend items={items} showProgress title="Devices" />;
}
```

### Linking a legend to a chart

Hold the hovered index in state and pass it to both: the legend reports hover with `onHover`, and the chart reports it through its own hover callback.

```tsx
import { useState } from "react";
import { ChartLegend, PieChart, PieSlice } from "bklit-tanstack-charts";

const data = [
  { label: "Electronics", value: 4250 },
  { label: "Clothing", value: 3120 },
  { label: "Food", value: 2100 },
];

const colors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)"];

export function Example() {
  const [hovered, setHovered] = useState<number | null>(null);
  const items = data.map((d, i) => ({ label: d.label, value: d.value, color: colors[i] ?? "var(--chart-1)" }));
  return (
    <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
      <PieChart data={data} hoveredIndex={hovered} onHoverChange={setHovered} size={220}>
        {data.map((item, index) => (
          <PieSlice index={index} key={item.label} />
        ))}
      </PieChart>
      <ChartLegend hoveredIndex={hovered} items={items} onHover={setHovered} />
    </div>
  );
}
```

### Custom rows

```tsx
import { ChartLegend } from "bklit-tanstack-charts";

const items = [
  { label: "Organic", value: 4250, color: "var(--chart-1)" },
  { label: "Paid", value: 3120, color: "var(--chart-2)" },
];

export function Example() {
  return (
    <ChartLegend
      items={items}
      renderItem={({ item, isHovered, isFaded }) => (
        <div style={{ opacity: isFaded ? 0.4 : 1, fontWeight: isHovered ? 600 : 400 }}>
          <span style={{ color: item.color }}>{"●"}</span> {item.label}: {item.value}
        </div>
      )}
    />
  );
}
```

## Hover context

`Legend` shares hover with its parts through context. The hooks `useLegend()` and `useLegendItem()` return that context for custom parts. `ChartLegendHoverProvider` and `useChartLegendHover()` let a legend and a chart that are far apart in the tree share one hovered index; `ProfitLossLegend` (see [Profit/loss line](./profit-loss-line.md)) has its own pair.

## Theming

Legend text and the progress track use the page's foreground and muted colors. Override the look with `className` props or the `--chart-foreground` and `--chart-foreground-muted` variables.

## Differences from bklit-ui

None in behavior. The props and the data shape are the same.

## Related

- [Pie chart](./pie-chart.md)
- [Ring chart](./ring-chart.md)
- [Profit/loss line](./profit-loss-line.md)
