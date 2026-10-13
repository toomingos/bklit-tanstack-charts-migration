# ChoroplethChart

> Adapted from the [bklit-ui documentation](https://github.com/bklit/bklit-ui) (MIT, © uixmat) for bklit-tanstack-charts.

A map that fills regions by data, drawn from GeoJSON features with a Mercator projection. It supports hover and keyboard focus, tooltips, an optional graticule, pattern fills and zoom and pan.

```tsx
import {
  ChoroplethChart,
  ChoroplethFeatureComponent,
  ChoroplethGraticule,
  ChoroplethTooltip,
} from "bklit-tanstack-charts";
import type { ChoroplethChartProps } from "bklit-tanstack-charts";

const data = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { name: "West" },
      geometry: { type: "Polygon", coordinates: [[[-40, 0], [0, 0], [0, 40], [-40, 40], [-40, 0]]] },
    },
    {
      type: "Feature",
      properties: { name: "East" },
      geometry: { type: "Polygon", coordinates: [[[0, 0], [40, 0], [40, 40], [0, 40], [0, 0]]] },
    },
  ],
} satisfies ChoroplethChartProps["data"];

export function Example() {
  return (
    <ChoroplethChart data={data} aspectRatio="16 / 9">
      <ChoroplethGraticule />
      <ChoroplethFeatureComponent />
      <ChoroplethTooltip />
    </ChoroplethChart>
  );
}
```

## Data shape

`data` is a GeoJSON `FeatureCollection`: the object itself, not a URL and not a TopoJSON topology.

```ts
interface FeatureCollection {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    geometry: Geometry; // Polygon, MultiPolygon, ...
    properties: {
      name?: string; // shown in the default tooltip and used to key features
      id?: string | number;
      [key: string]: unknown; // anything else, passed to your callbacks
    } | null;
  }>;
}
```

- The chart reads GeoJSON only. If your source is TopoJSON, convert it first with [`topojson-client`](https://github.com/topojson/topojson-client); the package does not do this for you:

  ```ts
  import * as topojson from "topojson-client";

  // topology: your parsed TopoJSON, for example a world-atlas file
  const geojson = topojson.feature(topology, topology.objects.countries);
  ```

- Load the data yourself (import it, fetch it, or inline it) and pass the resulting object as `data`. Fetch it once and keep the reference stable, because a new `data` object rebuilds the map.
- Coordinates are `[longitude, latitude]` in degrees (WGS84), the GeoJSON standard.
- Features are keyed by `properties.name`, falling back to `id`. Give every feature a unique `name` so hover and the tooltip resolve the right region.
- Fills go by feature index. Use `getFeatureColor` on `ChoroplethFeatureComponent` to colour by your own data (look the value up by `feature.properties.name` or `id`).
- `children` is required by the type; pass at least one of `ChoroplethFeatureComponent`, `ChoroplethGraticule` or `ChoroplethTooltip`. Without a `ChoroplethTooltip` no tooltip is shown.

## Props

### ChoroplethChart

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `data` | `FeatureCollection<Geometry, ChoroplethFeatureProperties>` | required | GeoJSON `FeatureCollection` to draw, with one feature per region. Pass GeoJSON objects: TopoJSON is not read, so convert it first (for example with `topojson-client`'s `feature()`). |
| `margin` | `Partial<Margin>` | `{ top: 0, right: 0, bottom: 0, left: 0 }` | Chart margins in pixels. Any side you omit keeps its default. |
| `animationDuration` | `number` | `800` | Duration of the enter animation in milliseconds. |
| `enterTransition` | `EnterTransition` | `a tween of animationDuration on the reveal curve` | Enter transition (a spring or a cubic-bezier tween), in seconds. |
| `revealSignature` | `string` | `""` | Changing this value replays the enter animation. |
| `aspectRatio` | `string` | `"16 / 9"` | Aspect ratio of the chart as "width / height". |
| `scale` | `number` | - | Projection scale of the Mercator projection. When omitted it follows the chart width. |
| `center` | `[number, number]` | `[0, 20]` | Geographic center of the map as `[longitude, latitude]`. |
| `translate` | `[number, number]` | - | Pixel offset of the projection center as `[x, y]`. When omitted the map is centered in the chart. |
| `zoomEnabled` | `boolean` | `false` | Enable zoom and pan with the mouse wheel, pinch, and drag. |
| `zoomMin` | `number` | `0.5` | Minimum zoom scale. |
| `zoomMax` | `number` | `4` | Maximum zoom scale. |
| `initialZoom` | `TransformMatrix` | the identity transform (no zoom, no pan) | Initial zoom transform. |
| `className` | `string` | `""` | Additional class name for the chart container. |
| `children` | `ReactNode` | required | `ChoroplethFeatureComponent`, `ChoroplethGraticule` and `ChoroplethTooltip` to configure the map, plus any elements that call `useChoropleth()` or `useChoroplethZoom()`. |
| `ariaLabel` | `string` | `"Choropleth chart"` | Accessible label of the chart. |
| `ariaDescription` | `string` | - | Longer accessible description of the chart. |

### ChoroplethFeatureComponent

Configures how features are filled, stroked and dimmed. Renders nothing itself.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `fill` | `string` | `a cycle of the --chart-scale-01 to --chart-scale-05 variables, by feature index` | Solid fill color for every feature. Takes precedence over `getFeatureColor`. |
| `stroke` | `string` | `"var(--background)"` | Border color of the features. |
| `strokeWidth` | `number` | `0.5` | Border width of the features in pixels. |
| `fadedOpacity` | `number` | `0.4` | Opacity of the other features while one is hovered or focused. |
| `getFeatureColor` | `(feature: ChoroplethFeature, index: number) => string` | - | Returns a fill color per feature. Used when `fill` is not set. |
| `patterns` | `ReactNode` | - | Pattern definitions (SVG `<pattern>` elements) that features can reference by id through `getFeaturePattern`. |
| `getFeaturePattern` | `(feature: ChoroplethFeature, index: number) => string \| null \| undefined` | - | Returns the id of a pattern to fill a feature with, or `null`/`undefined` to use the color. A pattern wins over `fill` and `getFeatureColor`. |

The fill of a feature is the first that applies: the pattern from `getFeaturePattern`, then `fill`, then `getFeatureColor`, then the default scale colours.

### ChoroplethGraticule

Adds latitude and longitude lines behind the features.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `stroke` | `string` | `"rgba(255,255,255,0.1)"` | Color of the graticule lines. |
| `strokeWidth` | `number` | `0.5` | Width of the graticule lines in pixels. |
| `step` | `[number, number]` | `[10, 10]` | Spacing of the lines as `[longitude, latitude]` in degrees. |

### ChoroplethTooltip

Enables the tooltip shown on hover or keyboard focus.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `content` | `(props: { feature: ChoroplethFeature; index: number }) => ReactNode` | - | Custom tooltip content for a feature. Replaces the default name and value. |
| `formatValue` | `(value: number) => string` | integer formatting | Formats the value in the default tooltip. |
| `getFeatureName` | `(feature: ChoroplethFeature, index: number) => string` | the feature's properties.name, or "Feature <index>" | Returns the tooltip title of a feature. |
| `getFeatureValue` | `(feature: ChoroplethFeature, index: number) => number \| undefined` | - | Returns the value shown for a feature. When it returns `undefined` the value row is hidden. |
| `valueLabel` | `string` | `"Value"` | Label of the value row. |
| `className` | `string` | - | Additional class name for the tooltip panel. |
| `panelStyle` | `CSSProperties` | - | Inline styles for the tooltip panel, for example a blur or border. |
| `backgroundColor` | `string` | - | Background color of the tooltip panel (a CSS variable or a color). |

### Hooks and types

- `useChoropleth()` returns the map state (`ChoroplethContextValue`): `features`, `featurePaths`, `projectPoint`, `unprojectPoint`, `pathGenerator`, `rawPathGenerator`, `width`, `height`, `hoveredFeatureIndex`, `setHoveredFeatureIndex`, `tooltipData`, `isLoaded` and more. Call it in a component rendered as a child of `ChoroplethChart`; outside one it returns empty defaults.
- `useChoroplethZoom()` returns `{ zoom }`. `zoom` is `null` unless `zoomEnabled` is set, otherwise the controls (`scale`, `translate`, `reset`, `center`, `clear`, `transformMatrix`, `isDragging`).
- `TransformMatrix` is the zoom state `{ scaleX, scaleY, translateX, translateY, skewX, skewY }`, used by `initialZoom`.
- `defaultChoroplethColors` are the five default fills (`--chart-scale-01` to `--chart-scale-05`).
- Types: `ChoroplethFeature`, `ChoroplethFeatureProperties`, `ChoroplethTooltipData`.

## More examples

### Colour by data

```tsx
import { ChoroplethChart, ChoroplethFeatureComponent, ChoroplethTooltip } from "bklit-tanstack-charts";
import type { ChoroplethChartProps } from "bklit-tanstack-charts";

const data = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { name: "North" },
      geometry: { type: "Polygon", coordinates: [[[-30, 20], [30, 20], [30, 50], [-30, 50], [-30, 20]]] },
    },
    {
      type: "Feature",
      properties: { name: "South" },
      geometry: { type: "Polygon", coordinates: [[[-30, -20], [30, -20], [30, 20], [-30, 20], [-30, -20]]] },
    },
  ],
} satisfies ChoroplethChartProps["data"];

const visits: Record<string, number> = { North: 1200, South: 340 };

const colorFor = (value: number | undefined): string => {
  if (value === undefined) {
    return "var(--muted)";
  }
  return value > 1000 ? "var(--chart-scale-05)" : "var(--chart-scale-02)";
};

export function Example() {
  return (
    <ChoroplethChart data={data}>
      <ChoroplethFeatureComponent getFeatureColor={(feature) => colorFor(visits[feature.properties?.name ?? ""])} />
      <ChoroplethTooltip
        getFeatureValue={(feature) => visits[feature.properties?.name ?? ""]}
        valueLabel="Visits"
        formatValue={(value) => value.toLocaleString()}
      />
    </ChoroplethChart>
  );
}
```

### Zoom and pan with custom controls

Set `zoomEnabled` to zoom with the wheel or a pinch and pan by dragging. `useChoroplethZoom` gives you the controls for buttons.

```tsx
import {
  ChoroplethChart,
  ChoroplethFeatureComponent,
  useChoroplethZoom,
} from "bklit-tanstack-charts";
import type { ChoroplethChartProps } from "bklit-tanstack-charts";

const data = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { name: "Block" },
      geometry: { type: "Polygon", coordinates: [[[-20, -10], [20, -10], [20, 30], [-20, 30], [-20, -10]]] },
    },
  ],
} satisfies ChoroplethChartProps["data"];

function ZoomButtons() {
  const { zoom } = useChoroplethZoom();
  if (zoom === null) {
    return null;
  }
  return (
    <div>
      <button type="button" onClick={() => zoom.scale({ scaleX: 1.2, scaleY: 1.2 })}>
        Zoom in
      </button>
      <button type="button" onClick={() => zoom.scale({ scaleX: 0.8, scaleY: 0.8 })}>
        Zoom out
      </button>
      <button type="button" onClick={() => zoom.reset()}>
        Reset
      </button>
    </div>
  );
}

export function Example() {
  return (
    <ChoroplethChart data={data} zoomEnabled zoomMin={0.5} zoomMax={6}>
      <ChoroplethFeatureComponent />
      <ZoomButtons />
    </ChoroplethChart>
  );
}
```

## Notes

### Server rendering

`ChoroplethChart` server-renders the map and replays its enter animation after hydration. Client-only charts (Pie, Ring, Radar, Heatmap) render an empty shell on the server instead. Change `revealSignature` to replay the animation at any time.

### Keyboard and hover

Pointer hover and keyboard focus share the same state. Tab into the map and step between regions with the arrow keys, in west to east order; the tooltip follows the focus. While a region is hovered or focused the others fade to `fadedOpacity`. When zoomed in, only regions at least 2 screen pixels wide are keyboard stops.

### Theming

Default fills cycle through `--chart-scale-01` to `--chart-scale-05` by feature index. Borders default to `--background`, and the graticule to a faint white line. Use `var(--muted)` for regions without data.

### Differences from bklit-ui

- Keyboard stepping between regions is an addition: bklit-ui's map is pointer only.
- `data` must be GeoJSON; TopoJSON is not read (the same as bklit-ui, whose docs convert with `topojson-client`).

## Related

- [SankeyChart](./sankey-chart.md)
- [HeatmapChart](./heatmap-chart.md)
- [SunburstChart](./sunburst-chart.md)
