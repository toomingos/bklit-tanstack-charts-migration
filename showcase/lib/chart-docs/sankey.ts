import type { ChartDoc } from "./types";

const data = `const data = {
  nodes: [
    { name: "Organic Search", category: "source" as const },
    { name: "Paid Search", category: "source" as const },
    { name: "Blog", category: "landing" as const },
    { name: "Pricing", category: "landing" as const },
    { name: "Converted", category: "outcome" as const },
    { name: "Bounced", category: "outcome" as const },
  ],
  // source and target are indexes into nodes.
  links: [
    { source: 0, target: 2, value: 4200 },
    { source: 0, target: 3, value: 1500 },
    { source: 1, target: 3, value: 3100 },
    { source: 2, target: 4, value: 2100 },
    { source: 2, target: 5, value: 3600 },
    { source: 3, target: 4, value: 4500 },
    { source: 3, target: 5, value: 1500 },
  ],
};`;

export const doc: ChartDoc = {
  description: "Flows between stages, with link width showing how much moves from one node to the next.",
  code: `import { SankeyChart, SankeyLink, SankeyNode, SankeyTooltip } from "bklit-tanstack-charts";

${data}

export function TrafficFlow() {
  return (
    <SankeyChart data={data} aspectRatio="16 / 9" nodeWidth={16} nodePadding={24}>
      <SankeyLink />
      <SankeyNode lineCap={4} labelOrientation="vertical" />
      <SankeyTooltip />
    </SankeyChart>
  );
}
`,
  usage: `import { SankeyChart, SankeyLink, SankeyNode, SankeyTooltip } from "bklit-tanstack-charts";

${data}

export function TrafficFlow() {
  return (
    <SankeyChart data={data}>
      <SankeyLink />
      <SankeyNode />
      <SankeyTooltip />
    </SankeyChart>
  );
}
`,
  api: [
    {
      name: "SankeyChart",
      description: "The root. Takes nodes and links and lays them out in columns.",
      props: [
        { name: "data", type: "{ nodes: SankeyNodeDatum[]; links: SankeyLinkDatum[] }", description: "Nodes with a name; links with source and target node indexes and a value." },
        { name: "aspectRatio", type: "string", default: '"2 / 1"', description: "CSS aspect ratio of the chart." },
        { name: "nodeWidth", type: "number", default: "16", description: "Node width in px." },
        { name: "nodePadding", type: "number", default: "24", description: "Vertical space between nodes in px." },
        { name: "margin", type: "Partial<Margin>", default: "{ top: 40, right: 180, bottom: 40, left: 180 }", description: "Space around the diagram, where labels sit." },
        { name: "animationDuration", type: "number", default: "1100", description: "Reveal duration in ms." },
        { name: "revealSignature", type: "string", description: "Changing it plays the reveal again." },
        { name: "hoveredNodeIndex", type: "number | null", description: "Controls which node is highlighted." },
        { name: "onNodeHoverChange", type: "(index: number | null) => void", description: "Called when the hovered node changes." },
        { name: "className", type: "string", description: "Class on the chart container." },
      ],
    },
    {
      name: "SankeyLink",
      description: "Styles the flows between nodes.",
      props: [
        { name: "stroke", type: "string", description: "One color for every link. Replaces the node gradient." },
        { name: "useGradient", type: "boolean", default: "true", description: "Blend from source node color to target node color." },
        { name: "strokeOpacity", type: "number", default: "0.5", description: "Link opacity." },
        { name: "fadedOpacity", type: "number", default: "0.1", description: "Opacity of unrelated links while one is hovered." },
        { name: "getLinkColor", type: "(link, index) => string", description: "Color per link." },
        { name: "getNodeColor", type: "(node, index) => string", description: "Node color used for the gradient." },
        { name: "patterns", type: "ReactNode", description: "SVG pattern definitions that getLinkPattern can refer to." },
        { name: "getLinkPattern", type: "(link, index) => string | null | undefined", description: "Id of a pattern to fill a link with." },
      ],
    },
    {
      name: "SankeyNode",
      description: "Styles the nodes and their labels.",
      props: [
        { name: "fill", type: "string", description: "One color for every node." },
        { name: "getNodeColor", type: "(node, index) => string", description: "Color per node." },
        { name: "lineCap", type: "number", default: "4", description: "Corner radius of the node bars." },
        { name: "showLabels", type: "boolean", default: "true", description: "Show node names." },
        { name: "showValueLabels", type: "boolean", default: "true", description: "Show node totals under the names." },
        { name: "labelOrientation", type: '"horizontal" | "vertical"', default: '"horizontal"', description: "Direction of the labels." },
        { name: "fadedOpacity", type: "number", default: "0.4", description: "Opacity of unrelated nodes while one is hovered." },
      ],
    },
    {
      name: "SankeyTooltip",
      props: [
        { name: "formatValue", type: "(value: number) => string", description: "Value formatter. Defaults to a grouped integer." },
        { name: "nodeContent", type: "(props: { node, index }) => ReactNode", description: "Replaces the box content for a node." },
        { name: "linkContent", type: "(props: { link, index }) => ReactNode", description: "Replaces the box content for a link." },
        { name: "className", type: "string", description: "Class on the tooltip box." },
      ],
    },
  ],
};
