# SankeyChart

> Adapted from the [bklit-ui documentation](https://github.com/bklit/bklit-ui) (MIT, © uixmat) for bklit-tanstack-charts.

A flow diagram: nodes arranged in columns and joined by links whose width is the flow value. Hovering a node or a link keeps what is connected to it at full strength and fades the rest.

```tsx
import { SankeyChart, SankeyLink, SankeyNode, SankeyTooltip } from "bklit-tanstack-charts";
import type { SankeyData } from "bklit-tanstack-charts";

const data: SankeyData = {
  nodes: [
    { name: "Organic Search", category: "source" },
    { name: "Paid Search", category: "source" },
    { name: "Homepage", category: "landing" },
    { name: "Pricing", category: "landing" },
    { name: "Converted", category: "outcome" },
    { name: "Bounced", category: "outcome" },
  ],
  links: [
    { source: 0, target: 2, value: 4200 },
    { source: 0, target: 3, value: 1500 },
    { source: 1, target: 3, value: 3100 },
    { source: 1, target: 2, value: 800 },
    { source: 2, target: 4, value: 2100 },
    { source: 2, target: 5, value: 2900 },
    { source: 3, target: 4, value: 4500 },
    { source: 3, target: 5, value: 100 },
  ],
};

export function Example() {
  return (
    <SankeyChart data={data} aspectRatio="16 / 9">
      <SankeyLink />
      <SankeyNode lineCap={4} labelOrientation="vertical" />
      <SankeyTooltip />
    </SankeyChart>
  );
}
```

## Data shape

```ts
interface SankeyData {
  nodes: Array<{
    name: string;
    category?: "source" | "landing" | "outcome";
    [key: string]: unknown;
  }>;
  links: Array<{
    source: number; // index into nodes
    target: number; // index into nodes
    value: number; // flow value
  }>;
}
```

- `SankeyChart` needs `data`. `children` is optional; without `SankeyLink`, `SankeyNode` and `SankeyTooltip` the defaults apply (links painted with a gradient, labels shown, no tooltip).
- Links refer to nodes by their index in `nodes`, not by name.
- Only links with a positive, finite `value` are drawn. A bad value is treated as `0`, and when no link is positive the chart renders empty.
- Columns are placed by d3-sankey, so the data should be acyclic: flows run from left to right.
- `category` is free-form metadata for your own callbacks (`getNodeColor`, `nodeContent`); the chart does not read it.
- The default margins leave 180 px on each side for node labels. Narrow containers need smaller `margin.left` and `margin.right`.

## Props

### SankeyChart

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `data` | `SankeyData` | required | Nodes and links to draw. Links reference nodes by index; links with a non-positive or non-finite value are ignored, and the chart is empty when no positive link remains. |
| `margin` | `Partial<Margin>` | `{ top: 40, right: 180, bottom: 40, left: 180 }` | Chart margins in pixels. Any side you omit keeps its default; the wide left and right defaults leave room for node labels. |
| `animationDuration` | `number` | `1100` | Duration of the enter animation in milliseconds. |
| `enterTransition` | `Transition` | `a 1.1s tween on the reveal curve` | Enter transition (a spring or a cubic-bezier tween), in seconds. Overrides `animationDuration` when it sets a `duration`. |
| `revealSignature` | `string` | `""` | Changing this value replays the enter animation. |
| `aspectRatio` | `string` | `"2 / 1"` | Aspect ratio of the chart as "width / height". |
| `nodeWidth` | `number` | `16` | Width of the node bars in pixels. |
| `nodePadding` | `number` | `24` | Vertical gap between nodes of the same column in pixels. |
| `className` | `string` | - | Additional class name for the chart container. |
| `children` | `ReactNode` | - | `SankeyNode`, `SankeyLink` and `SankeyTooltip` to configure the chart, plus any elements that call `useSankey()`. |
| `hoveredNodeIndex` | `number \| null` | - | Controlled hovered node index, for example from a legend. Overrides hover from the chart surface; `null` clears it. |
| `onNodeHoverChange` | `(index: number \| null) => void` | - | Called with the hovered node index (or `null`) when hover changes on the chart surface. |
| `ariaLabel` | `string` | `"Sankey chart"` | Accessible label of the chart. |
| `ariaDescription` | `string` | - | Longer accessible description of the chart. |

### SankeyNode

Configures the node bars and their labels. Renders nothing itself; `SankeyChart` reads its props.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `fill` | `string` | the theme chart colors, by node | Fill color of the nodes. |
| `lineCap` | `number` | `4` | Corner radius of the nodes in pixels. |
| `fadedOpacity` | `number` | `0.4` | Opacity of nodes not connected to the hovered node or link. |
| `showLabels` | `boolean` | `true` | Show node names. |
| `showValueLabels` | `boolean` | `true` | Show node values under the names. |
| `labelOrientation` | `SankeyLabelOrientation` | `"horizontal"` | Reading direction of the labels outside the nodes. |
| `getNodeColor` | `(node: SankeyPropNode, index: number) => string` | - | Returns the color of a node. Overrides `fill`. |

`labelOrientation` is `"horizontal"` (labels left or right of the nodes) or `"vertical"` (labels rotated 90 degrees along the node edge).

### SankeyLink

Configures how links are painted. Renders nothing itself.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `stroke` | `string` | - | Solid color for all links. Overrides the gradient. |
| `strokeOpacity` | `number` | `0.5` | Opacity of the links. |
| `fadedOpacity` | `number` | `0.1` | Opacity of links not connected to the hovered node or link. |
| `useGradient` | `boolean` | `true` | Paint each link with a gradient from its source color to its target color. |
| `getNodeColor` | `(node: SankeyPropNode, index: number) => string` | - | Returns the color of a node, used for the gradient ends. |
| `getLinkColor` | `(link: SankeyPropLink, index: number) => string` | - | Returns a solid color per link. Overrides the gradient. |
| `patterns` | `ReactNode` | - | Pattern definitions (SVG `<pattern>` elements) that links can reference by id through `getLinkPattern`. |
| `getLinkPattern` | `(link: SankeyPropLink, index: number) => string \| null \| undefined` | - | Returns the id of a pattern to fill a link with, or `null`/`undefined` to use the gradient or solid color. A pattern wins over `stroke` and `getLinkColor`. |

### SankeyTooltip

Enables the tooltip shown on hover or keyboard focus. Without it no tooltip appears.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `nodeContent` | `(props: { node: SankeyPropNode; index: number }) => ReactNode` | - | Custom tooltip content for a node. Receives the node and its index. |
| `linkContent` | `(props: { link: SankeyPropLink; index: number }) => ReactNode` | - | Custom tooltip content for a link. Receives the link and its index. |
| `formatValue` | `(value: number) => string` | integer formatting | Formats the values in the default tooltip. |
| `className` | `string` | - | Additional class name for the tooltip. |

### useSankey

`useSankey()` returns the chart state and layout (`SankeyContextValue`): `nodes`, `links`, `graph`, `width`, `height`, `innerWidth`, `innerHeight`, `margin`, `hoveredNodeIndex`, `hoveredLinkIndex`, `setHoveredNodeIndex`, `setHoveredLinkIndex`, `tooltipData`, `setTooltipData`, `isLoaded`, `revealEpoch` and `createPath(link)`. Call it in a component rendered as a child of `SankeyChart`; it throws elsewhere. The `SankeyTooltipData` it exposes is `{ type: "node" | "link", nodeIndex?, linkIndex?, x, y, data }`.

## More examples

### Vertical labels with narrower margins

Rotated labels need less side room; keep the margins wide enough that they are not clipped.

```tsx
import { SankeyChart, SankeyLink, SankeyNode, SankeyTooltip } from "bklit-tanstack-charts";

const data = {
  nodes: [{ name: "Organic" }, { name: "Paid" }, { name: "Site" }, { name: "Converted" }],
  links: [
    { source: 0, target: 2, value: 120 },
    { source: 1, target: 2, value: 80 },
    { source: 2, target: 3, value: 60 },
  ],
};

export function Example() {
  return (
    <SankeyChart data={data} margin={{ top: 40, right: 80, bottom: 40, left: 80 }}>
      <SankeyLink />
      <SankeyNode labelOrientation="vertical" />
      <SankeyTooltip />
    </SankeyChart>
  );
}
```

### Custom colors and tooltip

```tsx
import { SankeyChart, SankeyLink, SankeyNode, SankeyTooltip } from "bklit-tanstack-charts";

const data = {
  nodes: [
    { name: "Email", category: "source" as const },
    { name: "Direct", category: "source" as const },
    { name: "Checkout", category: "landing" as const },
    { name: "Paid", category: "outcome" as const },
  ],
  links: [
    { source: 0, target: 2, value: 300 },
    { source: 1, target: 2, value: 500 },
    { source: 2, target: 3, value: 450 },
  ],
};

const colorOf = (category: string | undefined): string =>
  category === "source" ? "var(--chart-1)" : category === "landing" ? "var(--chart-2)" : "var(--chart-3)";

export function Example() {
  return (
    <SankeyChart data={data}>
      <SankeyLink strokeOpacity={0.6} getNodeColor={(node) => colorOf(data.nodes[node.index ?? 0]?.category)} />
      <SankeyNode getNodeColor={(node) => colorOf(data.nodes[node.index ?? 0]?.category)} />
      <SankeyTooltip
        formatValue={(value) => `${value.toLocaleString()} sessions`}
        linkContent={({ link }) => <span>Flow of {link.value}</span>}
      />
    </SankeyChart>
  );
}
```

### Controlled node hover

```tsx
import { useState } from "react";
import { SankeyChart, SankeyLink, SankeyNode } from "bklit-tanstack-charts";

const data = {
  nodes: [{ name: "A" }, { name: "B" }, { name: "C" }],
  links: [
    { source: 0, target: 1, value: 10 },
    { source: 0, target: 2, value: 6 },
  ],
};

export function Example() {
  const [hovered, setHovered] = useState<number | null>(null);
  return (
    <div>
      <button type="button" onMouseEnter={() => setHovered(0)} onMouseLeave={() => setHovered(null)}>
        Highlight A
      </button>
      <SankeyChart data={data} hoveredNodeIndex={hovered} onNodeHoverChange={setHovered}>
        <SankeyLink />
        <SankeyNode />
      </SankeyChart>
    </div>
  );
}
```

## Notes

### Server rendering

`SankeyChart` server-renders the diagram and replays its enter animation after hydration: nodes scale and fade in, then the links grow from source to target. Client-only charts (Pie, Ring, Radar, Heatmap) render an empty shell on the server instead. Change `revealSignature` to replay the animation at any time.

### Keyboard and hover

Pointer hover and keyboard focus share the same state. Tab into the chart and step with the arrow keys through the nodes, column by column, then the links; the tooltip follows the focus. Hovering or focusing a node or a link keeps it and what connects to it at full opacity and fades the rest to `fadedOpacity`. Hover is reported through `onNodeHoverChange`.

### Theming

Nodes and gradients use the `--chart-line-primary` and `--chart-line-secondary` variables by default, and links fall back to `--chart-foreground-muted`. Pass `getNodeColor`, `getLinkColor` or `stroke` to use your own colours.

### Differences from bklit-ui

- None known in behaviour. Documented defaults are taken from this package: link `strokeOpacity` is `0.5`.
- `useSankey().mousePos` is always `null`; the tooltip follows the pointer on its own.

## Related

- [SunburstChart](./sunburst-chart.md)
- [ChoroplethChart](./choropleth-chart.md)
- [HeatmapChart](./heatmap-chart.md)
