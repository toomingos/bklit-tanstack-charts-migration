import type { ChartDoc } from "./types";

const data = `const data = [
  { label: "Organic", value: 4250, maxValue: 5000, color: "#0ea5e9" },
  { label: "Paid", value: 3120, maxValue: 5000, color: "#a855f7" },
  { label: "Email", value: 2100, maxValue: 5000, color: "#f59e0b" },
  { label: "Social", value: 1580, maxValue: 5000, color: "#10b981" },
  // ...
];`;

export const doc: ChartDoc = {
  description: "Concentric progress rings that compare several values against their own maximum.",
  code: `import { Ring, RingCenter, RingChart } from "bklit-tanstack-charts";

${data}

export function SessionsRings() {
  return (
    <RingChart data={data} size={320}>
      {data.map((item, i) => (
        <Ring index={i} key={item.label} />
      ))}
      <RingCenter defaultLabel="Total Sessions" />
    </RingChart>
  );
}
`,
  usage: `import { Ring, RingChart } from "bklit-tanstack-charts";

const data = [
  { label: "Move", value: 420, maxValue: 600 },
  { label: "Exercise", value: 25, maxValue: 30 },
];

export function ActivityRings() {
  return (
    <RingChart data={data}>
      {data.map((item, i) => (
        <Ring index={i} key={item.label} />
      ))}
    </RingChart>
  );
}
`,
  api: [
    {
      name: "RingChart",
      description: "The root. Holds the data. Add one Ring per item.",
      props: [
        { name: "data", type: "RingData[]", description: "One ring per item: label, value, maxValue and an optional color." },
        { name: "size", type: "number", description: "Width and height in px. Omit to fill the container." },
        { name: "strokeWidth", type: "number", default: "12", description: "Ring thickness in px." },
        { name: "ringGap", type: "number", default: "6", description: "Gap between rings in px." },
        { name: "baseInnerRadius", type: "number", default: "60", description: "Radius of the innermost ring in px." },
        { name: "startAngle", type: "number", default: "-Math.PI / 2", description: "Start angle in radians." },
        { name: "endAngle", type: "number", default: "(3 * Math.PI) / 2", description: "End angle in radians." },
        { name: "hoveredIndex", type: "number | null", description: "Controlled hovered ring index." },
        { name: "onHoverChange", type: "(index: number | null) => void", description: "Called when the hovered ring changes." },
        { name: "ariaLabel", type: "string", default: '"Ring chart"', description: "Accessible label." },
        { name: "className", type: "string", description: "Class on the chart container." },
        { name: "style", type: "CSSProperties", description: "Inline styles on the chart container." },
      ],
    },
    {
      name: "Ring",
      description: "One progress ring.",
      props: [
        { name: "index", type: "number", description: "Index of the item in data." },
        { name: "color", type: "string", description: "Overrides the item color." },
        { name: "animate", type: "boolean", default: "true", description: "Animate this ring on load." },
        { name: "lineCap", type: '"round" | "butt"', default: '"round"', description: "Shape of the ring ends." },
      ],
    },
    {
      name: "RingCenter",
      description: "Value and label in the middle. Shows the hovered ring, or the total.",
      props: [
        { name: "defaultLabel", type: "string", description: "Label when no ring is hovered." },
        { name: "formatOptions", type: "Intl.NumberFormatOptions", default: "{ maximumFractionDigits: 0 }", description: "Number format for the value." },
        { name: "prefix", type: "string", description: "Text before the value." },
        { name: "suffix", type: "string", description: "Text after the value." },
        { name: "children", type: "(props) => ReactNode", description: "Replaces the content." },
      ],
    },
  ],
};
