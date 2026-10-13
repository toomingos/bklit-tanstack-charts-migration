# HeatmapChart

> Adapted from the [bklit-ui documentation](https://github.com/bklit/bklit-ui) (MIT, © uixmat) for bklit-tanstack-charts.

A contribution heatmap: a grid of day cells in week columns, coloured by activity level, with month and weekday axes, a tooltip and an interactive legend. Hovering a cell or a legend level dims the rest.

```tsx
import {
  HeatmapCells,
  HeatmapChart,
  HeatmapInteractionBoundary,
  HeatmapInteractionProvider,
  HeatmapLegend,
  HeatmapTooltip,
  HeatmapXAxis,
  HeatmapYAxis,
} from "bklit-tanstack-charts";
import type { HeatmapColumn } from "bklit-tanstack-charts";

// 26 week columns of 7 day cells, starting on Sunday 7 January 2024.
const data: HeatmapColumn[] = Array.from({ length: 26 }, (_, week) => ({
  bin: week,
  bins: Array.from({ length: 7 }, (_, day) => ({
    bin: day,
    count: (week * 3 + day * 2) % 5,
    date: new Date(2024, 0, 7 + week * 7 + day),
  })),
}));

export function Example() {
  return (
    <HeatmapInteractionProvider>
      <HeatmapInteractionBoundary>
        <HeatmapChart data={data} layout="fluid">
          <HeatmapCells />
          <HeatmapXAxis />
          <HeatmapYAxis />
          <HeatmapTooltip />
        </HeatmapChart>
        <HeatmapLegend />
      </HeatmapInteractionBoundary>
    </HeatmapInteractionProvider>
  );
}
```

## Data shape

```ts
interface HeatmapBin {
  bin: number; // row index in the column (0 to 6 for the days of a Sunday-first week)
  count: number; // activity level, see below
  date: Date; // must be a Date object
}

interface HeatmapColumn {
  bin: number; // column index (the week number)
  bins: HeatmapBin[]; // the day cells, Sunday first
}
```

- `HeatmapChart` needs `data`. The grid only draws when a `HeatmapCells` child is present.
- `count` is a level, not a raw total: `0` or less is the empty level, `1` to `3` are levels 1 to 3, and `4` or more is level 4. Bucket your raw counts before passing them, or pass your own `colorScale`.
- `date` must be a `Date` object. The month labels and the tooltip read it, and `xDomain` filters columns by it.
- Source data stays Sunday-first. Use `weekStartDay` to rotate the rows for display.
- Heatmap is client-only: the server renders an empty, correctly sized shell and the grid is drawn after mount (see [Server rendering](#server-rendering)).

## Props

### HeatmapChart

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `data` | `HeatmapColumn[]` | required | Column data: one entry per week (or category) with the row bins inside. |
| `xDomain` | `[Date, Date]` | - | Visible time range. Only week columns that overlap the domain are drawn. |
| `sizingColumnCount` | `number` | - | Accepted for bklit compatibility; it has no effect. |
| `layout` | `"fluid" \| "fill"` | `"fluid"` | `"fluid"`: the width drives square cells and the chart height hugs the grid (GitHub style). `"fill"`: cells expand to fill the parent. |
| `margin` | `Readonly<Partial<HeatmapMargin>>` | `{ top: 28, right: 16, bottom: 0, left: 40 }` | Chart margins in pixels. Omitted sides keep their default. |
| `binSize` | `number` | `0` | Fixed cell size in pixels. When `0`, cells are square and sized to fit the available width. |
| `gap` | `number` | `2` | Gap between cells in pixels. |
| `colorScale` | `(count: number \| null \| undefined) => string` | - | Replaces the default level color scale. Receives a count and returns a CSS color. |
| `levelColors` | `HeatmapLevelColors` | the --chart-scale-01 to --chart-scale-05 CSS variables | Colors for the five levels of the Less to More scale (empty plus four activity levels). |
| `levelStyles` | `HeatmapLevelStyles` | - | Per-level fill styles (color and optional pattern). Takes precedence over `levelColors`. |
| `aspectRatio` | `string` | - | CSS aspect ratio of the outer container, for example `"2 / 1"`. Omit to fill the parent. |
| `className` | `string` | - | Additional class name for the chart container. |
| `status` | `ChartStatus` | `"ready"` | Data status. `"loading"` draws the shimmering skeleton cells. |
| `loadingLabel` | `string` | - | Centered label shown while `status` is `"loading"`. |
| `animationDuration` | `number` | `1600` | Enter animation duration in milliseconds. `0` disables the cell entrance. |
| `enterTransition` | `HeatmapEnterTransition` | `{ type: "tween", duration: 1.6, ease: [0.85, 0, 0.916, 0.282] }` | Enter transition. `duration` is in seconds and `ease` a cubic-bezier tuple. |
| `revealSignature` | `string` | `""` | Changing this string replays the enter animation. |
| `enterStaggerScale` | `number` | `1` | Scales the wave stagger between cells (`1` is the default pacing). |
| `animate` | `boolean` | `true` | Plays the enter fade-in and the loading shimmer. Set to `false` for no motion. |
| `loadingOpacity` | `number` | `1` | Chart opacity while loading. Ours is `1`; bklit-ui uses `0.5`. |
| `showLoadingCells` | `boolean` | `true` | Shows the shimmering skeleton cells while loading. |
| `loadingCellMaxOpacity` | `number` | `0.85` | Highest opacity (0 to 1) the loading cells animate toward. Ours is `0.85`; bklit-ui uses `0.5`. |
| `loadingCellRandomness` | `number` | `1` | Share of cells (0 to 1) that take part in the loading shimmer. Ours is `1`; bklit-ui uses `0.65`. |
| `columnSeparators` | `HeatmapSeparatorParsedConfig` | - | Inserts horizontal gaps between groups of columns. A `HeatmapSeparator` child overrides it. |
| `weekStartDay` | `HeatmapWeekStartDay` | `0` | First row of the grid: `0` is Sunday (GitHub default), `1` Monday, and so on. Rotates the rows for display without reshaping your data. |
| `children` | `ReactNode` | - | `HeatmapCells`, `HeatmapXAxis`, `HeatmapYAxis`, `HeatmapTooltip` and `HeatmapSeparator` configuration children. `HeatmapCells` is required for the grid to draw. |
| `ariaLabel` | `string` | `"Heatmap chart"` | Accessible name of the chart. |
| `ariaDescription` | `string` | - | Accessible description of the chart. Falls back to the `ariaDescription` of `HeatmapCells`. |

### HeatmapChartLoading

A skeleton of the grid with a shimmering label, for use while the data is loading.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `data` | `HeatmapColumn[]` | required | Target column data. Only its shape is used to size the skeleton grid; counts are zeroed. |
| `xDomain` | `[Date, Date]` | - | Visible time range. Only week columns that overlap the domain are drawn. |
| `margin` | `Readonly<Partial<HeatmapMargin>>` | `{ top: 28, right: 16, bottom: 0, left: 40 }` | Chart margins in pixels. Omitted sides keep their default. |
| `gap` | `number` | `2` | Gap between cells in pixels. |
| `cornerRadius` | `number` | `2` | Corner radius of each cell in pixels. |
| `label` | `string` | `"Loading"` | Centered shimmer label. |
| `className` | `string` | `""` | Additional class name for the container. |

### HeatmapCells

Draws the grid of cells with the enter animation and hover dimming. When `inactiveOpacity`, `inactiveScale` and `activeScale` are all `1`, hover dimming is off.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `cornerRadius` | `number` | `2` | Corner radius of each cell in pixels. |
| `colorScale` | `(count: number \| null \| undefined) => string` | - | Overrides the chart color scale for the cells. Receives a count and returns a CSS color. |
| `inactiveOpacity` | `number` | `0.3` | Opacity of the cells that are not highlighted while hovering a cell or a legend level. |
| `inactiveScale` | `number` | `1` | Scale of the cells that are not highlighted while hovering. |
| `activeScale` | `number` | `1` | Scale of the highlighted cell while hovering. |
| `rowOpacity` | `number \| readonly number[]` | `1` | Opacity per display row (row `0` is the top row after `weekStartDay` rotation). A single number applies to every row; an array gives one value per row. Pass the same value to `HeatmapYAxis` to keep labels aligned. |
| `interactive` | `boolean` | `true` | Enables pointer hover, dimming, tooltip and keyboard focus on the cells. |
| `hideGhostCells` | `boolean` | `true` | Hides the out-of-range cells at the start and end of the grid (GitHub style). |
| `ariaLabel` | `string` | - | Accessible name of the chart. `HeatmapChart` `ariaLabel` takes precedence. |
| `ariaDescription` | `string` | - | Accessible description of the chart. `HeatmapChart` `ariaDescription` takes precedence. |

### HeatmapXAxis

Month labels along the top of the grid. Takes no effective props.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Accepted for bklit compatibility; it has no effect. |

### HeatmapYAxis

Weekday labels along the left of the grid. The labels follow `weekStartDay` on `HeatmapChart`.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Accepted for bklit compatibility; it has no effect. |
| `tickFilter` | `HeatmapYAxisTickFilter` | `"odd"` | Which rows get a weekday label: every row, odd rows (Mon, Wed, Fri with a Sunday start) or even rows. |
| `labelFormat` | `HeatmapYAxisLabelFormat` | `"full"` | `"full"` shows the abbreviated weekday (Mon); `"initial"` shows its first letter (M). |
| `rowOpacity` | `number \| readonly number[]` | - | Opacity per display row for the labels. Pass the same value as `HeatmapCells` so faded rows and their labels stay aligned. |

### HeatmapTooltip

Shows the count and date of the hovered or focused cell.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `formatLabel` | `(count: number, date: Readonly<Date>) => string` | `N contribution(s)` | Custom text for the contribution line of the tooltip. Receives the count and the cell date. |
| `className` | `string` | - | Additional class name for the tooltip panel. |
| `panelStyle` | `Readonly<CSSProperties>` | - | Inline styles for the tooltip panel. |
| `backgroundColor` | `string` | - | Background of the tooltip panel (a CSS color or variable). |
| `instant` | `boolean` | `false` | Shows and hides the tooltip without enter or exit motion; the hide is still held for `hideDelay`. |
| `showDelay` | `number` | `0` | Delay in milliseconds before the tooltip first appears. Moving between cells updates it immediately. |
| `hideDelay` | `number` | `120` | Hold in milliseconds after the pointer leaves a cell before the tooltip hides. Reduces flicker between adjacent cells. |

### HeatmapSeparator

Vertical lines between groups of columns, with optional quarter labels.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `every` | `number` | - | Inserts a separator before every Nth column when `groupBy` is `"every"`. |
| `groupBy` | `HeatmapSeparatorGroupBy` | `"every"` | Groups columns by a fixed interval (`"every"`) or by calendar quarter (`"quarter"`). |
| `className` | `string` | - | Accepted for bklit compatibility; it has no effect. |
| `spacing` | `number` | `0` | Extra horizontal gap between column groups in pixels. |
| `paddingX` | `number` | - | Accepted for bklit compatibility; it has no effect. |
| `paddingY` | `number` | `0` | Inset of the line from the bottom of the plot in pixels. |
| `startOffset` | `number` | the top of the plot | Distance from the container top to the start of the line in pixels. Use it to align the line with the month labels. |
| `labelOffset` | `number` | `0` | Distance below the top of the line at which quarter labels sit; `0` aligns them with the line top. |
| `showLabels` | `boolean` | `false` | Draws a label at the start of each quarter group. |
| `labelFormat` | `(quarter: number, startDate: Readonly<Date>) => string` | `Q{n}` | Formats the quarter labels. Receives the quarter (1 to 4) and the start date of the group. |
| `labelClassName` | `string` | - | Accepted for bklit compatibility; it has no effect. |
| `strokeStyle` | `HeatmapSeparatorStrokeStyle` | `"solid"` | Solid or dashed line. |
| `strokeDasharray` | `string` | `"4,4"` | Dash pattern used when `strokeStyle` is `"dashed"`. |
| `stroke` | `string` | `"var(--border)"` | Line color, used when `gradient` is omitted. |
| `gradient` | `Readonly<HeatmapSeparatorGradient>` | - | Vertical gradient along each line, for fading the ends. Omit for a flat stroke. |
| `strokeWidth` | `number` | `1` | Line width in pixels. |
| `strokeOpacity` | `number` | `1` | Opacity multiplier for a solid stroke or for the gradient stops. |

### HeatmapLegend

The Less to More scale. Pass the same `levelStyles` as the chart so the swatches match.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `lessLabel` | `string` | `"Less"` | Label before the swatches. |
| `moreLabel` | `string` | `"More"` | Label after the swatches. |
| `cellSize` | `number` | `11` | Swatch size in pixels. |
| `gap` | `number` | `2` | Gap between swatches in pixels. |
| `cornerRadius` | `number` | `2` | Corner radius of the swatches in pixels. |
| `align` | `"start" \| "center" \| "end"` | `"end"` | Horizontal alignment of the legend. |
| `variant` | `HeatmapLegendVariant` | `"swatches"` | Discrete swatches or a continuous gradient bar. The gradient uses solid colors only; patterns are ignored. |
| `gradientSpan` | `number` | `5` | Width of the gradient bar in swatch units when `variant` is `"gradient"`. |
| `fontSize` | `number` | `12` | Font size in pixels of the Less and More labels. |
| `labelClassName` | `string` | - | Additional class name for the Less and More labels. |
| `levelStyles` | `HeatmapLevelStyles` | - | Level colors and patterns. Pass the same value as the chart so swatches match the cells. |
| `colorScale` | `(count: number \| null \| undefined) => string` | the default level colors | Color scale used when `levelStyles` is omitted. |
| `inactiveOpacity` | `number` | `0.3` | Opacity of the swatches that are not highlighted while hovering. |
| `inactiveScale` | `number` | `1` | Scale of the swatches that are not highlighted while hovering. |
| `activeScale` | `number` | `1` | Scale of the highlighted swatch while hovering. |
| `interactive` | `boolean` | `true` inside a `HeatmapInteractionProvider`, otherwise `false` | Syncs the swatch dimming with the chart hover. |
| `className` | `string` | - | Additional class name for the legend container. |

### HeatmapInteractionProvider and HeatmapInteractionBoundary

`HeatmapInteractionProvider` shares hover state between a chart and a `HeatmapLegend` rendered outside it, so hovering a legend level dims the cells of that level and hovering a cell highlights its legend level. `HeatmapChart` creates its own provider when none surrounds it, so you only need one to link a separate legend. `HeatmapInteractionBoundary` is a wrapper element (props `className`, `style`, `children`) that clears the legend hover when the pointer leaves it; it throws outside a provider.

### Hooks and constants

- `useHeatmap()` returns the chart's layout, scales and settings (`HeatmapContextValue`). Call it in a component inside `HeatmapChart`; it throws elsewhere.
- `HEATMAP_DEFAULT_LEVEL_COLORS` are the five default level colours (`--chart-scale-01` to `--chart-scale-05`), `HEATMAP_DEFAULT_LEVEL_STYLES` the matching solid `levelStyles`, `HEATMAP_LEGEND_LEVELS` the legend's level count, and `HEATMAP_DAY_LABELS` the weekday names.
- Types: `HeatmapLevelColors` (five colours), `HeatmapLevelStyle` and `HeatmapLevelStyles` (five styles), `HeatmapYAxisTickFilter` (`"all" | "odd" | "even"`), `HeatmapYAxisLabelFormat` (`"full" | "initial"`), `HeatmapWeekStartDay` (`0` to `6`) and `HeatmapLayout` (`"fluid" | "fill"`).

## More examples

### Level styles and patterns

Pass `levelStyles` (five entries: the empty level and levels 1 to 4) to control both the cell fills and the legend swatches. Each level is solid or uses a pattern preset.

```tsx
import {
  HeatmapCells,
  HeatmapChart,
  HeatmapInteractionProvider,
  HeatmapLegend,
} from "bklit-tanstack-charts";
import type { HeatmapColumn, HeatmapLevelStyles } from "bklit-tanstack-charts";

const levelStyles: HeatmapLevelStyles = [
  { color: "var(--chart-scale-01)", fillMode: "solid" },
  { color: "var(--chart-scale-02)", fillMode: "solid" },
  { color: "var(--chart-scale-03)", fillMode: "pattern", pattern: "diagonal" },
  { color: "var(--chart-scale-04)", fillMode: "solid" },
  { color: "var(--chart-scale-05)", fillMode: "solid" },
];

const data: HeatmapColumn[] = Array.from({ length: 20 }, (_, week) => ({
  bin: week,
  bins: Array.from({ length: 7 }, (_, day) => ({
    bin: day,
    count: (week + day) % 5,
    date: new Date(2024, 0, 7 + week * 7 + day),
  })),
}));

export function Example() {
  return (
    <HeatmapInteractionProvider>
      <HeatmapChart data={data} levelStyles={levelStyles}>
        <HeatmapCells />
      </HeatmapChart>
      <HeatmapLegend levelStyles={levelStyles} />
    </HeatmapInteractionProvider>
  );
}
```

### Monday-first grid with faded weekends

`rowOpacity` on `HeatmapCells` and `HeatmapYAxis` sets the opacity per display row, the row index after the `weekStartDay` rotation (`0` is the top row). With `weekStartDay={1}` rows 5 and 6 are Saturday and Sunday. Pass the same value to both so faded rows and their labels stay aligned.

```tsx
import { HeatmapCells, HeatmapChart, HeatmapXAxis, HeatmapYAxis } from "bklit-tanstack-charts";
import type { HeatmapColumn } from "bklit-tanstack-charts";

const data: HeatmapColumn[] = Array.from({ length: 20 }, (_, week) => ({
  bin: week,
  bins: Array.from({ length: 7 }, (_, day) => ({
    bin: day,
    count: (week * 2 + day) % 5,
    date: new Date(2024, 0, 7 + week * 7 + day),
  })),
}));

const rowOpacity = [1, 1, 1, 1, 1, 0.35, 0.35];

export function Example() {
  return (
    <HeatmapChart data={data} weekStartDay={1}>
      <HeatmapCells rowOpacity={rowOpacity} />
      <HeatmapXAxis />
      <HeatmapYAxis tickFilter="all" labelFormat="initial" rowOpacity={rowOpacity} />
    </HeatmapChart>
  );
}
```

### Quarter separators

```tsx
import { HeatmapCells, HeatmapChart, HeatmapSeparator, HeatmapXAxis } from "bklit-tanstack-charts";
import type { HeatmapColumn } from "bklit-tanstack-charts";

const data: HeatmapColumn[] = Array.from({ length: 52 }, (_, week) => ({
  bin: week,
  bins: Array.from({ length: 7 }, (_, day) => ({
    bin: day,
    count: (week + day * 2) % 5,
    date: new Date(2024, 0, 7 + week * 7 + day),
  })),
}));

export function Example() {
  return (
    <HeatmapChart data={data}>
      <HeatmapCells />
      <HeatmapXAxis />
      <HeatmapSeparator
        groupBy="quarter"
        showLabels
        stroke="var(--muted)"
        gradient={{ from: "var(--muted)", via: "var(--muted)", to: "var(--muted)", fromOpacity: 0, viaOpacity: 1, toOpacity: 0 }}
      />
    </HeatmapChart>
  );
}
```

### Loading state

Set `status="loading"` to show the shimmering skeleton cells, optionally with a `loadingLabel`. Changing back to `"ready"` plays the cell entrance.

```tsx
import { useState } from "react";
import { HeatmapCells, HeatmapChart } from "bklit-tanstack-charts";
import type { HeatmapColumn } from "bklit-tanstack-charts";

const data: HeatmapColumn[] = Array.from({ length: 20 }, (_, week) => ({
  bin: week,
  bins: Array.from({ length: 7 }, (_, day) => ({
    bin: day,
    count: (week + day) % 5,
    date: new Date(2024, 0, 7 + week * 7 + day),
  })),
}));

export function Example() {
  const [loading, setLoading] = useState(true);
  return (
    <div>
      <button type="button" onClick={() => setLoading((value) => !value)}>
        Toggle loading
      </button>
      <HeatmapChart data={data} status={loading ? "loading" : "ready"} loadingLabel="Loading">
        <HeatmapCells />
      </HeatmapChart>
    </div>
  );
}
```

## Notes

### Server rendering

`HeatmapChart` is client-only. On the server (and in the first client render) it renders its container as an empty shell; the grid is measured and drawn after mount and then plays its entrance. Give the parent a width, or set `aspectRatio`, to limit layout shift. Charts that do server-render, such as Sunburst, Sankey and Choropleth, replay their entrance after hydration instead.

### Keyboard and hover

Pointer hover and keyboard focus drive the same state. Focus the grid with Tab and move between cells with the arrow keys; the tooltip follows the focused cell. Hovering a cell dims the others according to `inactiveOpacity` and `inactiveScale` on `HeatmapCells` (both `1` by default, which leaves dimming off for cells), while hovering a legend level dims the cells of other levels.

### Theming

The default level colours are the `--chart-scale-01` to `--chart-scale-05` variables. Set them in your CSS, or pass `levelColors` or `levelStyles` for one chart:

```css
:root {
  --chart-scale-01: oklch(0.96 0.01 260);
  --chart-scale-05: oklch(0.45 0.18 260);
}
```

### Differences from bklit-ui

- The loading defaults differ: `loadingOpacity` is `1` (bklit-ui `0.5`), `loadingCellMaxOpacity` is `0.85` (bklit-ui `0.5`) and `loadingCellRandomness` is `1` (bklit-ui `0.65`).
- `sizingColumnCount`, `className` on `HeatmapXAxis`, `HeatmapYAxis` and `HeatmapSeparator`, and `paddingX` and `labelClassName` on `HeatmapSeparator` are accepted but have no effect.
- `getHeatmapContributionLevel` is not exported; the count-to-level mapping is described under [Data shape](#data-shape).
- `HeatmapChart` provides its own `HeatmapInteractionProvider`, so a chart without an outside legend needs no provider.

## Related

- [PieChart](./pie-chart.md)
- [RingChart](./ring-chart.md)
- [SunburstChart](./sunburst-chart.md)
