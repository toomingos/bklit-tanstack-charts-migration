import type { ChartDoc } from "./types";

const data = `const data = [
  { label: "Electronics", value: 4250, color: "#0ea5e9" },
  { label: "Clothing", value: 3120, color: "#a855f7" },
  { label: "Food", value: 2100, color: "#f59e0b" },
  { label: "Home", value: 1580, color: "#10b981" },
  { label: "Other", value: 1050, color: "#ef4444" },
];`;

export const doc: ChartDoc = {
  description: "Shows parts of a whole as slices, with a hover effect and an optional donut center.",
  code: `import { PieChart, PieSlice } from "bklit-tanstack-charts";

${data}

export function SalesPie() {
  return (
    <PieChart data={data} size={280}>
      {data.map((item, i) => (
        <PieSlice index={i} key={item.label} />
      ))}
    </PieChart>
  );
}
`,
  usage: `import { PieChart, PieSlice } from "bklit-tanstack-charts";

const data = [
  { label: "Desktop", value: 620 },
  { label: "Mobile", value: 380 },
];

export function DeviceSplit() {
  return (
    <PieChart data={data}>
      {data.map((item, i) => (
        <PieSlice index={i} key={item.label} />
      ))}
    </PieChart>
  );
}
`,
  api: [
    {
      name: "PieChart",
      description: "The root. Holds the data. Add one PieSlice per item.",
      props: [
        { name: "data", type: "PieData[]", description: "One slice per item: label, value and an optional color." },
        { name: "size", type: "number", description: "Width and height in px. Omit to fill the container." },
        { name: "innerRadius", type: "number", default: "0", description: "Hole radius in px. Above 0 makes a donut." },
        { name: "padAngle", type: "number", default: "0", description: "Gap between slices in radians." },
        { name: "cornerRadius", type: "number", default: "0", description: "Rounding of slice corners in px." },
        { name: "startAngle", type: "number", default: "-Math.PI / 2", description: "Start angle in radians." },
        { name: "endAngle", type: "number", description: "End angle in radians. Defaults to a full circle." },
        { name: "hoverOffset", type: "number", default: "10", description: "How far a hovered slice moves out, in px." },
        { name: "hoveredIndex", type: "number | null", description: "Controlled hovered slice index." },
        { name: "onHoverChange", type: "(index: number | null) => void", description: "Called when the hovered slice changes." },
        { name: "ariaLabel", type: "string", default: '"Pie chart"', description: "Accessible label." },
        { name: "className", type: "string", description: "Class on the chart container." },
        { name: "style", type: "CSSProperties", description: "Inline styles on the chart container." },
      ],
    },
    {
      name: "PieSlice",
      description: "One slice.",
      props: [
        { name: "index", type: "number", description: "Index of the item in data." },
        { name: "color", type: "string", description: "Overrides the item color." },
        { name: "hoverEffect", type: '"translate" | "grow" | "none"', default: '"translate"', description: "How a hovered slice reacts." },
        { name: "hoverOffset", type: "number", description: "Overrides the chart's hoverOffset for this slice." },
        { name: "animate", type: "boolean", description: "Animate this slice on load." },
      ],
    },
    {
      name: "PieCenter",
      description: "Value and label in the hole of a donut. Shows the hovered slice, or the total.",
      props: [
        { name: "defaultLabel", type: "string", default: '"Total"', description: "Label when no slice is hovered." },
        { name: "formatOptions", type: "Intl.NumberFormatOptions", default: "{ maximumFractionDigits: 0 }", description: "Number format for the value." },
        { name: "prefix", type: "string", description: "Text before the value." },
        { name: "suffix", type: "string", description: "Text after the value." },
        { name: "children", type: "(props) => ReactNode", description: "Replaces the content." },
      ],
    },
  ],
};
