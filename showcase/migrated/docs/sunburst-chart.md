# SunburstChart

> Adapted from the [bklit-ui documentation](https://github.com/bklit/bklit-ui) (MIT, © uixmat) for bklit-tanstack-charts.

A hierarchical chart of concentric rings. Each segment is sized by its value; click a branch to zoom into it, and use the centre hub or a breadcrumb to zoom back out. Hovering a segment grows it along its path from the root and dims unrelated branches.

```tsx
import {
  SunburstBreadcrumb,
  SunburstCenter,
  SunburstChart,
  SunburstHint,
  SunburstLabels,
  useSunburstBreadcrumbItems,
} from "bklit-tanstack-charts";
import type { SunburstNode } from "bklit-tanstack-charts";

const data: SunburstNode = {
  name: "Revenue",
  children: [
    {
      name: "Product",
      children: [
        { name: "Enterprise", value: 198 },
        { name: "Pro", value: 145 },
      ],
    },
    {
      name: "Services",
      children: [
        { name: "Consulting", value: 160 },
        { name: "Support", value: 90 },
      ],
    },
  ],
};

function Trail() {
  const { items, zoomTo } = useSunburstBreadcrumbItems();
  return (
    <ol style={{ display: "flex", gap: 8, listStyle: "none", margin: 0, padding: 0 }}>
      {items.map((item) => (
        <li key={item.id}>
          {item.isCurrent ? (
            <strong>{item.label}</strong>
          ) : (
            <button type="button" onClick={() => zoomTo(item.id)}>
              {item.label}
            </button>
          )}
        </li>
      ))}
    </ol>
  );
}

export function Example() {
  return (
    <SunburstChart data={data} size={440}>
      <SunburstBreadcrumb>
        <Trail />
      </SunburstBreadcrumb>
      <SunburstCenter />
      <SunburstLabels />
      <SunburstHint />
    </SunburstChart>
  );
}
```

Click a segment with children to zoom in. Click the centre hub, press Escape, or click a breadcrumb to zoom back out.

## Data shape

```ts
interface SunburstNode {
  name: string;
  value?: number; // leaf value; parent values are summed from their children
  color?: string; // colour of the node and its descendants
  fill?: string; // plain fill colour override
  children?: SunburstNode[];
}
```

- `SunburstChart` needs `data` and `children`. `children` is required by the type; the segments themselves are always drawn, so the children only add chrome (`SunburstCenter`, `SunburstLabels`, `SunburstBreadcrumb`, `SunburstHint`) or per-segment overrides (`SunburstSegment`).
- Only leaves need a `value`. A branch gets the sum of its children, and any `value` you set on it is ignored. Negative or non-finite leaves take no angle.
- A node's id is its name path from the root joined with `" / "` (for example `"Revenue / Product / Pro"`), so sibling names should be unique. The root id is the root name. Use ids with `focusId`, `onFocusChange` and `zoomTo`.
- `SunburstSegment` takes an `index`, the position of the arc in the `arcs` array that `buildArcs(data)` returns. Use `buildArcs(data).arcs` to render one `SunburstSegment` per arc (see below).
- Without `color`, top-level branches take `--chart-1` to `--chart-5` in order; inner rings are fully opaque and outer rings step down in opacity.

## Props

### SunburstChart

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `data` | `SunburstNode` | required | Hierarchical data tree. Parent values are summed from their children. |
| `size` | `number` | `520` | Chart diameter in pixels. The chart shrinks to fit narrower containers. |
| `playKey` | `number` | `0` | Change this number to replay the enter animation. |
| `className` | `string` | - | Additional class name for the chart wrapper. |
| `focusId` | `string` | - | Controlled drill-down focus: the id of the focused node (names from the root joined with `" / "`). Omit for uncontrolled drill-down. |
| `onFocusChange` | `(focusId: string) => void` | - | Called with the new node id when the focus changes through a segment click, the center hub, a keyboard zoom or a breadcrumb. |
| `hoveredIndex` | `number \| null` | - | Controlled hover: the index of the hovered arc in the `arcs` array returned by `buildArcs`, or `null` for none. |
| `onHoverChange` | `(index: number \| null) => void` | - | Called with the arc index (or `null`) when the hovered arc changes. |
| `hoverPop` | `number` | `8` | How far in pixels the hovered segment grows outward. |
| `padding` | `number` | derived from the tree depth, size and hoverPop | Inset in pixels reserved inside the chart for hover growth, relative to `size`. |
| `enterTransition` | `SunburstEnterTransition` | `{ duration: 1.1 }` | Overrides the enter animation. Only `duration` (in seconds) is used. |
| `enterStaggerScale` | `number` | `1` | Scales the stagger between rings and segments during the enter animation. |
| `children` | `ReactNode` | required | `SunburstSegment`, `SunburstCenter`, `SunburstLabels`, `SunburstBreadcrumb` and `SunburstHint` children. Render one `SunburstSegment` per arc index to customize individual segments. |

### SunburstSegment

Customizes one segment. It renders nothing itself; `SunburstChart` reads its props.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `index` | `number` | required | Arc index to customize, from the `arcs` array returned by `buildArcs`. |
| `color` | `string` | - | Color override for this segment. |
| `fill` | `string` | - | Plain fill color override. Patterns and gradients are not supported. |
| `fillOpacity` | `number` | `1 for the innermost visible ring, then fading with depth down to 0.45` | Fill opacity override (0 to 1). |

### SunburstCenter

Enables the centre hub. After you zoom in, click it (or press Enter on it) to zoom out to the parent. Renders nothing itself.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Accepted for bklit compatibility; it has no effect. |

### SunburstLabels

Segment names at the segment centres. Each label fades in once its segment has finished the enter sweep.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `fontSize` | `number` | `11` | Label font size in pixels. |
| `fill` | `string` | `"var(--chart-label)"` | Label text color. |
| `stroke` | `string` | `"var(--chart-background)"` | Color of the halo behind the label text. |
| `strokeWidth` | `number` | `2.5` | Width in pixels of the halo behind the label text. Use `0` to disable it. |
| `className` | `string` | - | Accepted for bklit compatibility; it has no effect. |

### SunburstBreadcrumb

A slot above the chart for drill-down navigation. Render your own trail inside it and read the items with `useSunburstBreadcrumbItems()`.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Class name of the wrapping `nav` element. |
| `children` | `ReactNode` | required | Breadcrumb UI, usually built from `useSunburstBreadcrumbItems`. |

`useSunburstBreadcrumbItems()` returns `{ items, zoomTo }`. Each item is:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `id` | `string` | required | Node id to pass to `zoomTo`. |
| `label` | `string` | required | Display name of the node (the root uses the name of `data`). |
| `isCurrent` | `boolean` | required | `true` for the node currently focused, which is the last crumb. |

`zoomTo(id)` zooms to the node with that id.

### SunburstHint

Hint text below the chart: the hovered path, or zoom instructions.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Class name of the hint element. |
| `children` | `ReactNode \| ((context: SunburstHintContext) => ReactNode)` | - | Custom hint content, or a function receiving the hint context. Defaults to the hovered path or zoom instructions. |

A function child receives `{ hintText, hoveredArc, focus }`:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `hintText` | `string` | required | The default hint text for the current state. |
| `hoveredArc` | `ArcDatum \| null` | required | The hovered arc, or `null`. |
| `focus` | `Focus` | required | The currently focused node. |

### Hooks and helpers

- `useSunburstHover()` returns `{ hoveredArc, hoveredArcIndex, setHoveredArc, setHoveredArcIndex }`; call it in a component inside `SunburstChart`. It throws elsewhere. `useSunburstStable()` returns the layout state that does not change on hover.
- `buildArcs(data)` returns the flat `arcs` array, `maxDepth`, `total`, `rootId` and a `focusById` map, for controlled drill-down and legend wiring.
- `defaultSunburstColors` are the default branch colours.

## More examples

### One segment per arc, with overrides

```tsx
import { buildArcs, SunburstChart, SunburstSegment } from "bklit-tanstack-charts";
import type { SunburstNode } from "bklit-tanstack-charts";

const data: SunburstNode = {
  name: "Traffic",
  children: [
    { name: "Search", value: 120 },
    { name: "Social", value: 80 },
    { name: "Direct", value: 60 },
  ],
};

export function Example() {
  const { arcs } = buildArcs(data);
  return (
    <SunburstChart data={data} size={360}>
      {arcs.map((arc) => (
        <SunburstSegment
          index={arc.arcIndex}
          key={arc.id}
          color={arc.name === "Direct" ? "var(--chart-4)" : undefined}
        />
      ))}
    </SunburstChart>
  );
}
```

### Controlled drill-down and hover

```tsx
import { useState } from "react";
import { SunburstCenter, SunburstChart } from "bklit-tanstack-charts";
import type { SunburstNode } from "bklit-tanstack-charts";

const data: SunburstNode = {
  name: "Files",
  children: [
    { name: "Code", children: [{ name: "src", value: 40 }, { name: "tests", value: 25 }] },
    { name: "Assets", children: [{ name: "images", value: 30 }, { name: "fonts", value: 10 }] },
  ],
};

export function Example() {
  const [focusId, setFocusId] = useState("Files");
  const [hovered, setHovered] = useState<number | null>(null);
  return (
    <div>
      <p>
        Focus: {focusId}, hovered arc: {hovered ?? "none"}
      </p>
      <SunburstChart
        data={data}
        focusId={focusId}
        onFocusChange={setFocusId}
        hoveredIndex={hovered}
        onHoverChange={setHovered}
      >
        <SunburstCenter />
      </SunburstChart>
    </div>
  );
}
```

### Custom hint

```tsx
import { SunburstChart, SunburstHint } from "bklit-tanstack-charts";
import type { SunburstNode } from "bklit-tanstack-charts";

const data: SunburstNode = {
  name: "Budget",
  children: [
    { name: "Rent", value: 50 },
    { name: "Food", value: 30 },
    { name: "Travel", value: 20 },
  ],
};

export function Example() {
  return (
    <SunburstChart data={data}>
      <SunburstHint>
        {({ hintText, hoveredArc }) =>
          hoveredArc ? <strong>{hintText}</strong> : <span>Explore the breakdown</span>
        }
      </SunburstHint>
    </SunburstChart>
  );
}
```

## Notes

### Server rendering

`SunburstChart` server-renders its rings and replays the enter sweep after hydration. Charts that are client-only (Pie, Ring, Radar, Heatmap) render an empty shell on the server instead. Change `playKey` to replay the sweep at any time.

### Keyboard and hover

Focus the chart with Tab. Arrow keys move between segments, Enter or Space zooms into a branch, and Escape zooms out; you can also arrow to the centre disc and press Enter or Space. Pointer hover and keyboard focus share the same state, reported through `onHoverChange`. Hovering grows the segments on the path from the root to the hovered one by `hoverPop` pixels and fades unrelated segments. Animations respect `prefers-reduced-motion`.

### Theming

Branch colours default to `--chart-1` to `--chart-5`, in order. Label text uses `--chart-label` with a `--chart-background` halo. Override a branch with `color` on its `SunburstNode`.

```css
:root {
  --chart-1: oklch(0.646 0.222 41.116);
  --chart-2: oklch(0.6 0.118 184.704);
}
```

### Differences from bklit-ui

- `className` on `SunburstCenter` and `SunburstLabels` is accepted but has no effect.
- `fill` on a node or a `SunburstSegment` is a plain colour. Pattern and gradient fills (`url(#id)`) are not supported.
- `enterTransition` only uses `duration` (in seconds).
- Sunburst has no built-in `Legend` integration here; use `hoveredIndex`, `onHoverChange`, `focusId` and `buildArcs(data).focusById` to drive your own legend.

## Related

- [PieChart](./pie-chart.md)
- [RingChart](./ring-chart.md)
- [HeatmapChart](./heatmap-chart.md)
- [SankeyChart](./sankey-chart.md)
