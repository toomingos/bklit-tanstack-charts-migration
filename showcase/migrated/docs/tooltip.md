# ChartTooltip

> Adapted from the [bklit-ui documentation](https://github.com/bklit/bklit-ui) (MIT, © uixmat) for bklit-tanstack-charts.

`ChartTooltip` adds the hover and keyboard readout to a chart: a vertical crosshair, a dot on each series, a date pill and a floating panel with one row per series. It is a configuration child: it renders nothing by itself and is read by the chart that contains it.

```tsx
import { ChartTooltip, Grid, Line, LineChart, XAxis } from "bklit-tanstack-charts";

const data = [
  { date: new Date("2025-01-01"), users: 120, pageviews: 340 },
  { date: new Date("2025-01-02"), users: 180, pageviews: 420 },
  { date: new Date("2025-01-03"), users: 150, pageviews: 390 },
  { date: new Date("2025-01-04"), users: 240, pageviews: 510 },
];

export function Example() {
  return (
    <LineChart data={data}>
      <Grid horizontal />
      <Line dataKey="users" stroke="var(--chart-line-primary)" />
      <Line dataKey="pageviews" stroke="var(--chart-line-secondary)" />
      <XAxis />
      <ChartTooltip />
    </LineChart>
  );
}
```

`ChartTooltip` works in `LineChart`, `AreaChart`, `ScatterChart`, `BarChart`, `CandlestickChart`, `ComposedChart` and `LiveLineChart`. Without it the chart has no tooltip, crosshair or date pill.

## Anatomy

1. Crosshair: a vertical line at the hovered x position.
2. Dots: a dot on each series at that position.
3. Panel: the floating box with a title (the formatted date) and one row per series.
4. Date pill: an animated date label at the bottom of the plot.

Each part can be turned off on its own.

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `showDatePill` | `boolean` | `true` | Show the date pill that rides along the bottom of the plot. |
| `showCrosshair` | `boolean` | `true` | Show the vertical crosshair line. |
| `showDots` | `boolean` | `true` | Show a dot on every series at the hovered position. |
| `dotVariant` | `"dot" \| "ring"` | `"dot"` | Dot style: a filled `"dot"` or a transparent `"ring"` square. Read by `BarChart` only. |
| `dotSize` | `number` | `5` | Dot radius in px. |
| `dotRadiusFraction` | `number` | `0.25` | Corner radius of the `"ring"` variant as a fraction of its side (0 is square, 0.5 is a circle). Read by `BarChart` only. |
| `dotScale` | `number` | `1` | Multiplier applied to the dot or ring size. Read by `BarChart` and `LiveLineChart`. |
| `dotStrokeWidth` | `number` | `2` | Stroke width of the dots in px. |
| `indicatorColor` | `string \| ((point: Record<string, unknown>) => string)` | `"var(--chart-crosshair)"` | Color of the crosshair. Only a string is applied; the function form that bklit-ui accepts is ignored and the default is used. |
| `content` | `((props: { point: Record<string, unknown>; index: number; }) => ReactNode)` | - | Replaces the default tooltip panel body. Receives the hovered data row and its index. |
| `rows` | `((point: Record<string, unknown>) => { readonly color: string; readonly label: string; ...` | - | Replaces the default rows (one per series) with your own list of `{ color, label, value }`. |
| `dotColor` | `string \| ((point: Record<string, unknown>, line: ChartLineConfig) => string)` | - | Fill of the tooltip dots. A function receives the hovered row and the series config. Defaults to each series' color. |
| `children` | `ReactNode` | - | Extra content rendered below the rows in the default panel, for example marker details. |
| `className` | `string` | - | Extra class name for the tooltip panel. |
| `springConfig` | `SpringConfig` | - | Spring for the floating panel when `matchCrosshair` is on. Defaults to the chart's tooltip spring. |
| `matchCrosshair` | `boolean` | `false` | Make the floating panel follow the pointer with the same spring as the crosshair instead of `damping`. |
| `damping` | `number` | `20` | Spring damping for the floating panel when `matchCrosshair` is off. `0` moves the panel instantly. |
| `indicatorDasharray` | `string` | - | Dash pattern of the crosshair. Omit for a solid line. |
| `indicatorFadeEdges` | `IndicatorFadeEdges` | - | Accepted for bklit-ui compatibility. It has no effect in bklit-tanstack-charts. The crosshair in this package is solid. |
| `indicatorFadeLength` | `number` | - | Accepted for bklit-ui compatibility. It has no effect in bklit-tanstack-charts. |
| `boxSpringConfig` | `SpringConfig` | - | Spring for the floating panel. Takes priority over `matchCrosshair` and `damping`. |
| `panelStyle` | `CSSProperties` | - | Accepted for bklit-ui compatibility. It has no effect in bklit-tanstack-charts. Style the panel with `className` or the `--chart-tooltip-*` CSS variables instead. |
| `backgroundColor` | `string` | - | Accepted for bklit-ui compatibility. It has no effect in bklit-tanstack-charts. Set `--chart-tooltip-background` instead. |
| `indicatorWidth` | `IndicatorWidth` | `"line"` | Thickness of the crosshair: a width in px, or `"line"` (1px), `"thin"` (2px), `"medium"` (4px) or `"thick"` (8px). |
| `columnWidth` | `number` | - | Accepted for bklit-ui compatibility. It has no effect in bklit-tanstack-charts. |

Row shape for `rows` and `TooltipContent`:

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `color` (required) | `string` | - | Color of the dot before the label. |
| `label` (required) | `string` | - | Row label, usually the series name. |
| `value` (required) | `string \| number` | - | Row value. Numbers are formatted in the en-US number format; strings are shown as given. |

## Examples

### Crosshair only

```tsx
import { ChartTooltip, Grid, Line, LineChart, XAxis } from "bklit-tanstack-charts";

const data = [
  { date: new Date("2025-01-01"), users: 120 },
  { date: new Date("2025-01-02"), users: 180 },
  { date: new Date("2025-01-03"), users: 150 },
  { date: new Date("2025-01-04"), users: 240 },
];

export function Example() {
  return (
    <LineChart data={data}>
      <Grid horizontal />
      <Line dataKey="users" />
      <XAxis />
      <ChartTooltip showDots={false} showDatePill={false} indicatorColor="var(--chart-2)" indicatorDasharray="6,4" />
    </LineChart>
  );
}
```

### Panel motion

By default the panel eases toward the pointer with `damping={20}`. Raise `damping` for more lag, set `damping={0}` to follow instantly, or set `matchCrosshair` to move the panel with the same spring as the crosshair.

```tsx
import { ChartTooltip, Grid, Line, LineChart, XAxis } from "bklit-tanstack-charts";

const data = [
  { date: new Date("2025-01-01"), users: 120 },
  { date: new Date("2025-01-02"), users: 180 },
  { date: new Date("2025-01-03"), users: 150 },
  { date: new Date("2025-01-04"), users: 240 },
];

export function Example() {
  return (
    <LineChart data={data}>
      <Grid horizontal />
      <Line dataKey="users" />
      <XAxis />
      <ChartTooltip matchCrosshair />
    </LineChart>
  );
}
```

### Custom rows

`rows` receives the hovered data row and returns the rows to show, replacing the default one-per-series list. The panel keeps its title and styling.

```tsx
import { ChartTooltip, Grid, Line, LineChart, XAxis } from "bklit-tanstack-charts";

const data = [
  { date: new Date("2025-01-01"), users: 120, pageviews: 340 },
  { date: new Date("2025-01-02"), users: 180, pageviews: 420 },
  { date: new Date("2025-01-03"), users: 150, pageviews: 390 },
  { date: new Date("2025-01-04"), users: 240, pageviews: 510 },
];

export function Example() {
  return (
    <LineChart data={data}>
      <Grid horizontal />
      <Line dataKey="users" />
      <Line dataKey="pageviews" />
      <XAxis />
      <ChartTooltip
        rows={(point) => [
          { color: "var(--chart-1)", label: "Users", value: Number(point.users) },
          { color: "var(--chart-2)", label: "Pages per user", value: (Number(point.pageviews) / Number(point.users)).toFixed(1) },
        ]}
      />
    </LineChart>
  );
}
```

### Custom content

`content` replaces the panel body. It receives the hovered data row and its index. Build it from your own markup, or reuse `TooltipBox` and `TooltipContent` to keep the default look.

```tsx
import { ChartTooltip, Grid, Line, LineChart, TooltipBox, TooltipContent, XAxis } from "bklit-tanstack-charts";

const data = [
  { date: new Date("2025-01-01"), users: 120 },
  { date: new Date("2025-01-02"), users: 180 },
  { date: new Date("2025-01-03"), users: 150 },
  { date: new Date("2025-01-04"), users: 240 },
];

export function Example() {
  return (
    <LineChart data={data}>
      <Grid horizontal />
      <Line dataKey="users" />
      <XAxis />
      <ChartTooltip
        content={({ point, index }) => (
          <TooltipBox>
            <TooltipContent
              rows={[{ color: "var(--chart-1)", label: `Day ${index + 1}`, value: Number(point.users) }]}
              title="Users"
            />
          </TooltipBox>
        )}
      />
    </LineChart>
  );
}
```

### Tooltip in a bar chart

In `BarChart`, `dotVariant="ring"` draws a ring around the hovered bar position instead of a dot, and `dotRadiusFraction` and `dotScale` shape it.

```tsx
import { Bar, BarChart, BarXAxis, ChartTooltip, Grid } from "bklit-tanstack-charts";

const data = [
  { name: "Jan", sales: 120 },
  { name: "Feb", sales: 180 },
  { name: "Mar", sales: 150 },
];

export function Example() {
  return (
    <BarChart data={data}>
      <Grid horizontal />
      <Bar dataKey="sales" />
      <BarXAxis />
      <ChartTooltip dotVariant="ring" dotRadiusFraction={0.25} />
    </BarChart>
  );
}
```

## Carrier components

`TooltipDot` and `TooltipIndicator` are alternative children that set the same options as the `dot*` and `indicator*` props of `ChartTooltip` (explicit `ChartTooltip` props win). They render nothing themselves.

```tsx
import { ChartTooltip, Grid, Line, LineChart, TooltipDot, TooltipIndicator, XAxis } from "bklit-tanstack-charts";

const data = [
  { date: new Date("2025-01-01"), users: 120 },
  { date: new Date("2025-01-02"), users: 180 },
  { date: new Date("2025-01-03"), users: 150 },
  { date: new Date("2025-01-04"), users: 240 },
];

export function Example() {
  return (
    <LineChart data={data}>
      <Grid horizontal />
      <Line dataKey="users" />
      <XAxis />
      <ChartTooltip />
      <TooltipIndicator colorEdge="var(--chart-2)" width="thin" />
      <TooltipDot size={6} />
    </LineChart>
  );
}
```

### TooltipDot props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `x` | `number` | - | Accepted so bklit-ui code compiles. Has no effect. |
| `y` | `number` | - | Accepted so bklit-ui code compiles. Has no effect. |
| `visible` | `boolean` | `true` | Show the dots. Same as `showDots` on `ChartTooltip`. |
| `color` | `string` | - | Fill color of the dots. Defaults to each series' color. |
| `size` | `number` | `5` | Dot radius in px. Same as `dotSize`. |
| `strokeColor` | `string` | - | Accepted so bklit-ui code compiles. Has no effect. |
| `strokeWidth` | `number` | `2` | Stroke width of the dots in px. Same as `dotStrokeWidth`. |
| `variant` | `"dot" \| "ring"` | `"dot"` | `"dot"` or `"ring"`. Same as `dotVariant`; read by `BarChart` only. |
| `cornerRadiusFraction` | `number` | - | Accepted so bklit-ui code compiles. Has no effect. |
| `springConfig` | `{ readonly stiffness: number; readonly damping: number; }` | - | Accepted so bklit-ui code compiles. Has no effect. |
| `animate` | `boolean` | - | Accepted so bklit-ui code compiles. Has no effect. |

### TooltipIndicator props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `x` | `number` | - | Accepted so bklit-ui code compiles. Has no effect. |
| `height` | `number` | - | Accepted so bklit-ui code compiles. Has no effect. |
| `visible` | `boolean` | `true` | Show the crosshair. Same as `showCrosshair` on `ChartTooltip`. |
| `width` | `IndicatorWidth` | `"line"` | Thickness of the crosshair: a width in px, or `"line"` (1px), `"thin"` (2px), `"medium"` (4px) or `"thick"` (8px). |
| `span` | `number` | - | Accepted so bklit-ui code compiles. Has no effect. |
| `columnWidth` | `number` | - | Accepted so bklit-ui code compiles. Has no effect. |
| `colorEdge` | `string` | `"var(--chart-crosshair)"` | Color of the crosshair. Same as `indicatorColor`. |
| `colorMid` | `string` | - | Accepted so bklit-ui code compiles. Has no effect. |
| `fadeEdges` | `boolean \| IndicatorFadeEdges` | - | Accepted so bklit-ui code compiles. Has no effect. The crosshair is solid. |
| `fadeLength` | `number` | - | Accepted so bklit-ui code compiles. Has no effect. |
| `animate` | `boolean` | - | Accepted so bklit-ui code compiles. Has no effect. |
| `gradientId` | `string` | - | Accepted so bklit-ui code compiles. Has no effect. |
| `springConfig` | `{ readonly stiffness: number; readonly damping: number; }` | - | Accepted so bklit-ui code compiles. Has no effect. |
| `strokeDasharray` | `string` | - | Dash pattern of the crosshair. Omit for a solid line. Same as `indicatorDasharray`. |

## TooltipBox and TooltipContent

`TooltipBox` wraps custom panel content with a minimum width and optional style overrides; the chart positions and animates the panel itself. `TooltipContent` is the default body: a title and the dot, label and value rows.

### TooltipBox props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `x` | `number` | - | Accepted so bklit-ui code compiles. Has no effect; the chart places the tooltip itself. |
| `y` | `number` | - | Accepted so bklit-ui code compiles. Has no effect; the chart places the tooltip itself. |
| `visible` | `boolean` | `true` | Render the box. Nothing is rendered when false. |
| `containerRef` | `unknown` | - | Accepted so bklit-ui code compiles. Has no effect; the chart places the tooltip itself. |
| `containerWidth` | `number` | - | Accepted so bklit-ui code compiles. Has no effect; the chart places the tooltip itself. |
| `containerHeight` | `number` | - | Accepted so bklit-ui code compiles. Has no effect; the chart places the tooltip itself. |
| `offset` | `number` | - | Accepted so bklit-ui code compiles. Has no effect; the chart places the tooltip itself. |
| `className` | `string` | - | Class names added to the box. |
| `children` | `ReactNode` | - | Content of the box. |
| `left` | `unknown` | - | Accepted so bklit-ui code compiles. Has no effect; the chart places the tooltip itself. |
| `top` | `unknown` | - | Accepted so bklit-ui code compiles. Has no effect; the chart places the tooltip itself. |
| `flipped` | `boolean` | - | Accepted so bklit-ui code compiles. Has no effect; the chart places the tooltip itself. |
| `springConfig` | `{ readonly stiffness: number; readonly damping: number; }` | - | Accepted so bklit-ui code compiles. Has no effect; the chart places the tooltip itself. |
| `animate` | `boolean` | - | Accepted so bklit-ui code compiles. Has no effect; the chart places the tooltip itself. |
| `entrance` | `boolean` | - | Accepted so bklit-ui code compiles. Has no effect; the chart places the tooltip itself. |
| `panelStyle` | `CSSProperties` | - | Inline styles merged into the box, after the defaults. |
| `backgroundColor` | `string` | - | Background color of the box (a color or a CSS variable). |

### TooltipContent props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `title` | `string` | - | Heading above the rows, for example the formatted date. |
| `rows` (required) | `readonly TooltipRow[]` | - | The rows to show, one per series. |
| `children` | `ReactNode` | - | Extra content rendered below the rows, for example marker details. |
| `className` | `string` | - | Class names added to the content wrapper. |

## Notes

### Keyboard and hover

Hovering moves the crosshair to the nearest row. With keyboard focus on the chart, the arrow keys move the crosshair and the tooltip follows; Home and End jump to the first and last row. Hover and focus use the same tooltip.

### Theming

The panel uses `--chart-tooltip-background`, `--chart-tooltip-foreground` and `--chart-tooltip-muted`; the crosshair uses `--chart-crosshair`; the date pill uses `--chart-date-pill-background` and `--chart-date-pill-foreground`.

### Server rendering

The tooltip only exists while hovering or focused, so it does not appear in server output.

### Differences from bklit-ui

- `indicatorFadeEdges`, `indicatorFadeLength`, `panelStyle`, `backgroundColor` and `columnWidth` on `ChartTooltip` are accepted for compatibility and have no effect. The crosshair is solid.
- `indicatorColor` accepts a string only; the function form is ignored.
- Most `TooltipDot` and `TooltipIndicator` props (positions, springs, gradient options) are accepted so bklit-ui code compiles and have no effect; the tables above name the ones that work.

## Related

- [useChart](./use-chart.md)
- [LineChart](./line-chart.md), [BarChart](./bar-chart.md)
- [Axes](./axes.md)
