import type { ChartDoc } from "./types";

const data = `const data = [
  { label: "Visitors", value: 12400, displayValue: "12.4k" },
  { label: "Leads", value: 6800, displayValue: "6.8k" },
  { label: "Qualified", value: 3200, displayValue: "3.2k" },
  { label: "Proposals", value: 1500, displayValue: "1.5k" },
  { label: "Closed", value: 620, displayValue: "620" },
];`;

export const doc: ChartDoc = {
  description: "Shows how a value drops across ordered stages, such as a sales or signup flow.",
  code: `import { FunnelChart } from "bklit-tanstack-charts";

${data}

export function SalesFunnel() {
  return <FunnelChart color="var(--chart-1)" data={data} layers={3} />;
}
`,
  usage: `import { FunnelChart } from "bklit-tanstack-charts";

const data = [
  { label: "Visitors", value: 12400 },
  { label: "Signups", value: 3200 },
  { label: "Paid", value: 620 },
];

export function SignupFunnel() {
  return <FunnelChart data={data} />;
}
`,
  api: [
    {
      name: "FunnelChart",
      description: "A single component; stages come from data.",
      props: [
        { name: "data", type: "FunnelStage[]", description: "One item per stage: label, value, and optional displayValue, color or gradient." },
        { name: "orientation", type: '"horizontal" | "vertical"', default: '"horizontal"', description: "Direction of the funnel." },
        { name: "color", type: "string", default: '"var(--chart-1)"', description: "Base color of the stages." },
        { name: "layers", type: "number", default: "3", description: "Number of nested layers per stage." },
        { name: "gap", type: "number", default: "4", description: "Gap between stages in px." },
        { name: "edges", type: '"curved" | "straight"', default: '"curved"', description: "Shape of the edges between stages." },
        { name: "showLabels", type: "boolean", default: "true", description: "Show stage labels." },
        { name: "showValues", type: "boolean", default: "true", description: "Show stage values." },
        { name: "showPercentage", type: "boolean", default: "true", description: "Show a percentage badge on each stage." },
        { name: "formatValue", type: "(value: number) => string", description: "Value formatter. A stage's displayValue takes priority." },
        { name: "formatPercentage", type: "(pct: number) => string", description: "Percentage formatter." },
        { name: "labelLayout", type: '"spread" | "grouped"', default: '"spread"', description: "How labels are arranged within each stage." },
        { name: "labelOrientation", type: '"vertical" | "horizontal"', description: "Direction of the label text." },
        { name: "labelAlign", type: '"center" | "start" | "end"', default: '"center"', description: "Label alignment." },
        { name: "grid", type: "boolean | { bands?, lines?, ... }", default: "false", description: "Background bands and lines." },
        { name: "staggerDelay", type: "number", default: "0.12", description: "Seconds between stage entrances." },
        { name: "hoveredIndex", type: "number | null", description: "Controlled hovered stage index." },
        { name: "onHoverChange", type: "(index: number | null) => void", description: "Called when the hovered stage changes." },
        { name: "ariaLabel", type: "string", description: "Accessible label." },
        { name: "className", type: "string", description: "Class on the chart container." },
        { name: "style", type: "CSSProperties", description: "Inline styles on the chart container." },
      ],
    },
  ],
};
