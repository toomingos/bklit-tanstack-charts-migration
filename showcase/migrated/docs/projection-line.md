# ProjectionLine

> Adapted from the [bklit-ui documentation](https://github.com/bklit/bklit-ui) (MIT, © uixmat) for bklit-tanstack-charts.

A forecast path that continues a line or area series past its last data point. Build the path with `buildProjectionPath`, or pass your own points, and pair it with `LineSeriesTerminalMarker` for a ring at the hand-off.

```tsx
import {
  buildProjectionPath,
  ChartTooltip,
  Grid,
  Line,
  LineChart,
  LineSeriesTerminalMarker,
  ProjectionLine,
  XAxis,
} from "bklit-tanstack-charts";

const data = Array.from({ length: 30 }, (_, i) => ({
  date: new Date(2024, 0, 1 + i),
  users: 1000 + i * 25 + Math.round(40 * Math.sin(i / 3)),
}));

const projection = buildProjectionPath({
  endValue: 2000,
  horizonPoints: 6,
  mode: "target",
  pathDensity: "endpoints",
  seriesKey: "users",
  sourceData: data,
});

export function Example() {
  return (
    <LineChart data={data}>
      <Grid horizontal />
      <Line dataKey="users" strokeWidth={2} />
      <LineSeriesTerminalMarker dataKey="users" />
      <ProjectionLine curveKind="bezier" data={projection} strokeDasharray="1,4" />
      <XAxis />
      <ChartTooltip />
    </LineChart>
  );
}
```

## Data shape

```ts
interface ProjectionPoint {
  date: Date; // x position
  value: number; // y value
}
```

- `ProjectionLine` needs `data`: the anchor point (usually the last data row) followed by the horizon end. It needs at least two points to draw.
- The chart widens its x and y ranges to fit the projection, so the horizon stays visible.
- Projections are meant for line and area charts without [brush zoom](./brush.md). The two are not supported together.
- `buildProjectionPath` reads `Date` values from `xDataKey` (default `"date"`) and numbers from `seriesKey`.

## Props

### ProjectionLine

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `data` | `ProjectionPoint[]` | required | Projection path points: the anchor followed by the horizon end. Needs at least two points to draw. |
| `yAxisId` | `string \| number` | `"left"` | Id of the y-scale group the path is drawn against. |
| `stroke` | `string` | `"var(--chart-3)"` | Stroke color of a solid path. |
| `strokeStyle` | `"solid" \| "gradient"` | `"solid"` | `"solid"` paints one color, `"gradient"` blends `gradientStart` into `gradientEnd` along the path. |
| `gradientStart` | `string` | `stroke` | Gradient start color when `strokeStyle` is `"gradient"`. |
| `gradientEnd` | `string` | `"var(--chart-5)"` | Gradient end color when `strokeStyle` is `"gradient"`. |
| `strokeWidth` | `number` | `2` | Stroke width in px. |
| `curveKind` | `"linear" \| "bezier"` | `"linear"` | `"linear"` draws straight segments, `"bezier"` draws a smooth S-curve with horizontal tangents. |
| `strokeDasharray` | `string` | `"6,4"` | SVG dash pattern of the path. Pass `"0"` for a solid path. |
| `strokeOpacity` | `number` | `1` | Stroke opacity of the path. |
| `showEndMarker` | `boolean` | `true` | Whether the horizon end reserves room for an end marker: the path stops short of the plot edge by the marker radius so it is not clipped. The marker dot itself is not drawn. |
| `endpointRadius` | `number` | `5` | Radius in px of the end marker, used to keep the path inside the plot. |

`curve`, `className` and the deprecated `showEndpoints` are accepted so bklit-ui code compiles; `curve` and `className` are not read, and `showEndpoints` is an alias of `showEndMarker`.

### LineSeriesTerminalMarker

A ring on the last data point of a series, the usual anchor for a projection.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `dataKey` | `string` | required | Key of the series in the chart data. The ring sits on the last row's value. |
| `yAxisId` | `string \| number` | `"left"` | Id of the y-scale group the series uses. |
| `fill` | `string` | - | Fill of the inner circle. No inner circle is drawn when omitted, `""` or `"transparent"`, which leaves a hollow ring. |
| `radius` | `number` | `5` | Radius of the inner circle in px. |
| `ringGap` | `number` | `0` | Gap between the inner circle and the ring in px. |
| `stroke` | `string` | `"var(--chart-1)"` | Ring color. |
| `strokeWidth` | `number` | `1.5` | Ring stroke width in px. |

### ProjectionLineEndMarker

Accepted so bklit-ui code compiles; the dot is not drawn.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `data` | `ProjectionPoint[]` | required | Projection path points; the marker sits on the last one. |
| `yAxisId` | `string \| number` | `"left"` | Id of the y-scale group the marker is drawn against. |
| `stroke` | `string` | `"var(--chart-3)"` | Marker color. |
| `strokeOpacity` | `number` | `1` | Marker opacity. |
| `radius` | `number` | `5` | Marker radius in px. |

### buildProjectionPath

Builds the `ProjectionPoint[]` for `ProjectionLine` from your data.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `sourceData` | `Record<string, unknown>[]` | required | The chart rows. |
| `seriesKey` | `string` | required | Key of the y value. |
| `xDataKey` | `string` | `"date"` | Key of the x value. |
| `mode` | `"auto" \| "target" \| "manual"` | required | How the future points are generated. |
| `autoMethod` | `"linearRegression" \| "lastSegment"` | `"linearRegression"` | Slope used by `mode: "auto"`. |
| `pathDensity` | `"stepped" \| "endpoints"` | `"endpoints"` | A point per future step, or only the anchor and the end. |
| `horizonPoints` | `number` | `6` | Number of future intervals for the auto and target modes. |
| `endValue` | `number` | - | Target y value for `mode: "target"`. |
| `points` | `ProjectionPoint[]` | - | Manual path for `mode: "manual"`. |
| `startIndex` | `number` | last row | Index of the anchor row. |

## Examples

### Automatic forecast with a gradient stroke

```tsx
import {
  buildProjectionPath,
  ChartTooltip,
  Grid,
  Line,
  LineChart,
  LineSeriesTerminalMarker,
  ProjectionLine,
  XAxis,
} from "bklit-tanstack-charts";

const data = Array.from({ length: 30 }, (_, i) => ({
  date: new Date(2024, 0, 1 + i),
  users: 800 + i * 30 + Math.round(50 * Math.cos(i / 4)),
}));

const projection = buildProjectionPath({
  autoMethod: "lastSegment",
  horizonPoints: 6,
  mode: "auto",
  pathDensity: "endpoints",
  seriesKey: "users",
  sourceData: data,
});

export function Example() {
  return (
    <LineChart data={data}>
      <Grid horizontal />
      <Line dataKey="users" strokeWidth={2} />
      <LineSeriesTerminalMarker dataKey="users" ringGap={6} />
      <ProjectionLine
        curveKind="bezier"
        data={projection}
        gradientEnd="var(--chart-5)"
        gradientStart="var(--chart-3)"
        strokeDasharray="1,4"
        strokeStyle="gradient"
      />
      <XAxis />
      <ChartTooltip />
    </LineChart>
  );
}
```

### Manual points

```tsx
import { ChartTooltip, Grid, Line, LineChart, ProjectionLine, XAxis } from "bklit-tanstack-charts";

const data = Array.from({ length: 20 }, (_, i) => ({
  date: new Date(2024, 0, 1 + i),
  revenue: 500 + i * 12,
}));

const projection = [
  { date: new Date(2024, 0, 20), value: 728 },
  { date: new Date(2024, 0, 27), value: 640 },
  { date: new Date(2024, 1, 3), value: 810 },
];

export function Example() {
  return (
    <LineChart data={data}>
      <Grid horizontal />
      <Line dataKey="revenue" />
      <ProjectionLine data={projection} stroke="var(--chart-2)" strokeDasharray="6,4" />
      <XAxis />
      <ChartTooltip />
    </LineChart>
  );
}
```

## Notes

- **Server rendering.** Charts with a projection server-render and replay their entrance after hydration.
- **Theming.** Default colors come from `--chart-1` (terminal marker) and `--chart-3` (projection).

## Differences from bklit-ui

- `ProjectionLineEndMarker` and `showEndMarker` only reserve room at the horizon end; the marker dot is not drawn.
- `LineSeriesTerminalMarker` draws no inner circle unless `fill` is set (a hollow ring), as in bklit-ui.

## Related

- [Line chart](./line-chart.md)
- [Reference area](./reference-area.md)
- [Markers](./markers.md)
