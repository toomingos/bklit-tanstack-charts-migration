# Markers

> Adapted from the [bklit-ui documentation](https://github.com/bklit/bklit-ui) (MIT, © uixmat) for bklit-tanstack-charts.

Two kinds of markers on cartesian charts. `ChartMarkers` annotates dates with event markers (a circle with an icon, a guide line and a tooltip). `SeriesMarkers` and the `showMarkers` option draw a dot on every data point of a series.

```tsx
import { ChartMarkers, ChartTooltip, Grid, Line, LineChart, XAxis } from "bklit-tanstack-charts";
import type { ChartMarker } from "bklit-tanstack-charts";

const data = Array.from({ length: 30 }, (_, i) => ({
  date: new Date(2024, 0, 1 + i),
  users: 1000 + i * 20 + Math.round(60 * Math.sin(i / 3)),
}));

const markers: ChartMarker[] = [
  { date: new Date(2024, 0, 8), icon: "L", title: "Launch", description: "Version 2.0 released" },
  { date: new Date(2024, 0, 20), icon: "!", title: "Incident", description: "Brief outage" },
];

export function Example() {
  return (
    <LineChart data={data}>
      <Grid horizontal />
      <Line dataKey="users" />
      <XAxis />
      <ChartTooltip />
      <ChartMarkers items={markers} />
    </LineChart>
  );
}
```

## Data shape

```ts
interface ChartMarker {
  date: Date; // where the marker sits on the x-axis
  icon: ReactNode; // shown inside the circle; only text (a string or number) is drawn
  title: string; // tooltip title
  description?: string; // shown under the title
  content?: ReactNode; // custom tooltip content; replaces title and description
  color?: string; // background of the marker circle
  onClick?: () => void; // called on click
  href?: string; // opened on click
  target?: "_blank" | "_self"; // where href opens
}
```

- `date` must be a `Date`. Markers on the same calendar date form one cluster with a count badge, and the cluster fans out on hover.
- `icon` is drawn as text. A single character or an emoji works; elements are not rendered.
- Keep `ChartMarkers` a direct child of the chart, usually after `ChartTooltip`.
- `ChartMarkers` renders nothing by itself: the chart reads its props.

## Props

### ChartMarkers

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `items` | `ChartMarker[]` | required | The markers to display. Markers on the same date are grouped. |
| `size` | `number` | `28` | Diameter of each marker circle in px. |
| `showLines` | `boolean` | `true` | Draw a dashed vertical guide line from each marker down the plot. |
| `maxFanned` | `number` | - | Cap on how many markers of a cluster fan out on hover. The count badge still shows the full cluster size. |

`animate` is accepted so bklit-ui code compiles but is not read: markers fade in with the chart entrance.

### MarkerGroup

One group of event markers at the dates of its `markers`. Prefer `ChartMarkers`, which takes all markers at once.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `markers` | `ChartMarker[]` | required | Markers in this group. Markers on the same date form one cluster. |
| `size` | `number` | `28` | Diameter of each marker circle in px. |
| `showLine` | `boolean` | `true` | Draw a dashed vertical guide line from each marker down the plot. |
| `forceOpen` | `boolean` | `false` | Keep clusters fanned out even when they are not hovered. |
| `isMuted` | `boolean` | `false` | Fade the markers to 40% opacity at rest, to spotlight another group. |
| `borderColor` | `string` | `--chart-marker-border` | Stroke color of the marker circle. |
| `borderWidth` | `number` | `1.5` | Stroke width of the marker circle in px. |
| `maxFanned` | `number` | - | Cap on how many markers of a cluster fan out on hover. |
| `marginLeft` | `number` | - | Horizontal offset from the chart container used to anchor the fan-out of a cluster. |
| `marginTop` | `number` | - | Vertical offset from the chart container used to anchor the fan-out of a cluster. |

`x`, `y`, `isActive`, `onHover`, `containerRef`, `animationDelay`, `animate`, `lineHeight` and `iconFill` are accepted so bklit-ui code compiles but are not read.

### SeriesMarkers

Draws a dot on every point of one series. It styles the markers of the `Line` or `Area` with the same `dataKey`, exactly like `showMarkers` plus `markers` on that series.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `dataKey` | `string` | required | Key of the series (a `Line` or `Area` `dataKey`) to draw markers on. |
| `animate` | `boolean` | `true` | Fade the markers in with the chart entrance. |

It also takes every option of `SeriesPointMarkerStyle` below.

### SeriesPointMarkerStyle

The appearance options shared by `SeriesMarkers`, the `markers` prop of `Line` and `Area`, and `SeriesPointMarker`.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `fill` | `string` | series stroke color | Fill color of the inner circle. |
| `stroke` | `string` | `fill` | Color of the outer ring. |
| `strokeWidth` | `number` | `2` | Outer ring stroke width in px. Set to `0` to remove the ring. |
| `ringGap` | `number` | `2` | Gap between the inner circle and the outer ring, in px. |
| `outlineWidth` | `number` | `0` | Width in px of an optional outline drawn outside the ring. `0` draws none. |
| `outlineColor` | `string` | `stroke` | Color of the outer outline. |
| `radius` | `number` | `5` | Radius of the inner circle in px. |
| `fadeOnHover` | `boolean` | `true` | Dim the markers that are not hovered while the chart is hovered. The enlarged active marker is drawn only while this is on. |
| `inactiveOpacity` | `number` | `0.5` | Opacity of the dimmed markers when `fadeOnHover` is on. |
| `inactiveBlur` | `number` | `2` | Blur in px of the dimmed markers when `fadeOnHover` is on. |
| `enterBlur` | `number` | `2` | Blur in px the markers start from while they fade in on entrance. |
| `showActiveHighlight` | `boolean` | `true` | Draw the hovered marker 1.35 times larger. |

### SeriesPointMarker

A single marker drawn at a pixel position `(cx, cy)` that fades and un-blurs in after `revealDelay` seconds. It is for custom chart children; `Line` and `Area` draw their own markers. It takes the `SeriesPointMarkerStyle` options plus these required props:

| Prop | Type | Description |
| --- | --- | --- |
| `dataKey` | `string` | Key of the series this marker belongs to. Part of the identity that replays the entrance. |
| `index` | `number` | Index of the data row this marker belongs to. |
| `cx` | `number` | Horizontal center in plot pixels. |
| `cy` | `number` | Vertical center in plot pixels. |
| `revealDelay` | `number` | Seconds to wait before the fade-in starts. |
| `revealEpoch` | `number` | Changes whenever the chart replays its entrance; a new value restarts the fade-in. |
| `enterDuration` | `number` | Duration of the fade-in in seconds. |

## Examples

### Marker details in the tooltip

`useActiveMarkers` returns the markers on the hovered date. Render them with `MarkerTooltipContent` as the tooltip's children.

```tsx
import { ChartMarkers, ChartTooltip, Grid, Line, LineChart, MarkerTooltipContent, XAxis, useActiveMarkers } from "bklit-tanstack-charts";
import type { ChartMarker } from "bklit-tanstack-charts";

const data = Array.from({ length: 30 }, (_, i) => ({
  date: new Date(2024, 0, 1 + i),
  users: 900 + i * 25 + Math.round(50 * Math.cos(i / 4)),
}));

const markers: ChartMarker[] = [
  { date: new Date(2024, 0, 10), icon: "R", title: "Release", description: "Version 2.1", color: "var(--chart-1)" },
  { date: new Date(2024, 0, 10), icon: "F", title: "Fix", description: "Hotfix deployed" },
  { date: new Date(2024, 0, 22), icon: "P", title: "Press", description: "Featured in the news" },
];

function MarkerDetails() {
  const active = useActiveMarkers(markers);
  return active.length === 0 ? null : <MarkerTooltipContent markers={active} />;
}

export function Example() {
  return (
    <LineChart data={data}>
      <Grid horizontal />
      <Line dataKey="users" />
      <XAxis />
      <ChartTooltip>
        <MarkerDetails />
      </ChartTooltip>
      <ChartMarkers items={markers} />
    </LineChart>
  );
}
```

### Point markers on a series

```tsx
import { ChartTooltip, Grid, Line, LineChart, SeriesMarkers, XAxis } from "bklit-tanstack-charts";

const data = Array.from({ length: 14 }, (_, i) => ({
  date: new Date(2024, 0, 1 + i),
  sales: 200 + ((i * 53) % 120),
}));

export function Example() {
  return (
    <LineChart data={data}>
      <Grid horizontal />
      <Line dataKey="sales" />
      <SeriesMarkers dataKey="sales" fill="var(--chart-1)" radius={4} ringGap={3} />
      <XAxis />
      <ChartTooltip />
    </LineChart>
  );
}
```

The same markers can be set on the series itself:

```tsx
import { Area, AreaChart } from "bklit-tanstack-charts";

const data = Array.from({ length: 14 }, (_, i) => ({
  date: new Date(2024, 0, 1 + i),
  sales: 200 + ((i * 53) % 120),
}));

export function Example() {
  return (
    <AreaChart data={data}>
      <Area dataKey="sales" markers={{ radius: 4, strokeWidth: 0 }} showMarkers />
    </AreaChart>
  );
}
```

### Clickable markers

```tsx
import { ChartMarkers, Line, LineChart } from "bklit-tanstack-charts";

const data = Array.from({ length: 20 }, (_, i) => ({
  date: new Date(2024, 0, 1 + i),
  value: 50 + i * 3,
}));

export function Example() {
  return (
    <LineChart data={data}>
      <Line dataKey="value" />
      <ChartMarkers
        items={[
          { date: new Date(2024, 0, 6), icon: "1", title: "Docs", href: "https://example.com/docs", target: "_blank" },
          { date: new Date(2024, 0, 15), icon: "2", title: "Alert", onClick: () => window.alert("Marker clicked") },
        ]}
        maxFanned={3}
        size={32}
      />
    </LineChart>
  );
}
```

## Notes

- **Server rendering.** The chart server-renders and replays its entrance after hydration. Markers fade in with the entrance.
- **Hover.** Hovering a cluster fans it out and shows its tooltip. With `fadeOnHover`, point markers that are not hovered dim while the chart is hovered.
- **Theming.** Event markers use `--chart-marker-background`, `--chart-marker-border`, `--chart-marker-foreground`, `--chart-marker-badge-background` and `--chart-marker-badge-foreground`.

## Differences from bklit-ui

- `ChartMarker.icon` draws only text (a string or number). React elements as icons are not rendered.
- Several `MarkerGroup` props (`x`, `y`, `isActive`, `onHover`, `containerRef`, `animationDelay`, `animate`, `lineHeight`, `iconFill`) and `ChartMarkers` `animate` are accepted but not read.
- Cluster fan-out is positioned from the date, so the group is placed automatically; there is no need to pass coordinates.

## Related

- [Line chart](./line-chart.md)
- [Area chart](./area-chart.md)
- [Projection line](./projection-line.md)
- [Custom tooltip pieces](./custom-indicator.md)
