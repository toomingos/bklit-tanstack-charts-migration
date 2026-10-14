import type { ChartDoc } from "./types";

const data = `const metrics = [
  { key: "engagement", label: "Engagement" },
  { key: "pagesPerSession", label: "Pages/Session" },
  { key: "sessionDuration", label: "Session Duration" },
  { key: "conversionRate", label: "Conversion" },
  { key: "bounceInverse", label: "Retention" },
];

const data = [
  {
    label: "Google Search",
    color: "#3b82f6",
    values: { engagement: 72, pagesPerSession: 68, sessionDuration: 70, conversionRate: 75, bounceInverse: 65 },
  },
  {
    label: "Display Ads",
    color: "#f59e0b",
    values: { engagement: 85, pagesPerSession: 45, sessionDuration: 40, conversionRate: 30, bounceInverse: 88 },
  },
  // ...
];`;

export const doc: ChartDoc = {
  description: "Compares several series across a shared set of metrics on a radial grid.",
  code: `import { useState } from "react";
import { RadarArea, RadarAxis, RadarChart, RadarGrid, RadarLabels } from "bklit-tanstack-charts";

${data}

export function ChannelRadar() {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <RadarChart
      data={data}
      metrics={metrics}
      size={400}
      hoveredIndex={hoveredIndex}
      onHoverChange={setHoveredIndex}
    >
      <RadarGrid />
      <RadarAxis />
      <RadarLabels interactive />
      {data.map((item, index) => (
        <RadarArea index={index} key={item.label} />
      ))}
    </RadarChart>
  );
}
`,
  usage: `import { RadarArea, RadarAxis, RadarChart, RadarGrid, RadarLabels } from "bklit-tanstack-charts";

const metrics = [
  { key: "speed", label: "Speed" },
  { key: "reliability", label: "Reliability" },
  { key: "comfort", label: "Comfort" },
];

const data = [{ label: "Model A", values: { speed: 80, reliability: 65, comfort: 90 } }];

export function ModelRadar() {
  return (
    <RadarChart data={data} metrics={metrics}>
      <RadarGrid />
      <RadarAxis />
      <RadarLabels />
      <RadarArea index={0} />
    </RadarChart>
  );
}
`,
  api: [
    {
      name: "RadarChart",
      description: "The root. Holds the data and metrics. Add one RadarArea per series.",
      props: [
        { name: "data", type: "RadarData[]", description: "One series per item: label, optional color, and values keyed by metric (0 to 100)." },
        { name: "metrics", type: "RadarMetric[]", description: "The axes: a key matching the series values, and a label." },
        { name: "size", type: "number", default: "400", description: "Width and height in px. Omit to fill the container." },
        { name: "levels", type: "number", default: "5", description: "Number of grid rings." },
        { name: "margin", type: "number", default: "60", description: "Space around the plot in px, for the labels." },
        { name: "animate", type: "boolean", default: "true", description: "Play the entrance animation." },
        { name: "enterDurationMs", type: "number", default: "1100", description: "Entrance duration in ms." },
        { name: "hoveredIndex", type: "number | null", description: "Controlled hovered series index." },
        { name: "onHoverChange", type: "(index: number | null) => void", description: "Called when the hovered series changes." },
        { name: "ariaLabel", type: "string", default: '"Radar chart"', description: "Accessible label." },
        { name: "className", type: "string", description: "Class on the chart container." },
        { name: "style", type: "CSSProperties", description: "Inline styles on the chart container." },
      ],
    },
    {
      name: "RadarGrid",
      description: "Concentric rings and their value labels.",
      props: [
        { name: "showLabels", type: "boolean", default: "true", description: "Show the value label on each ring." },
        { name: "stroke", type: "string", description: "Line color." },
        { name: "strokeOpacity", type: "number", default: "0.6", description: "Line opacity." },
      ],
    },
    {
      name: "RadarAxis",
      description: "Lines from the center to each metric.",
      props: [
        { name: "stroke", type: "string", description: "Line color." },
        { name: "strokeOpacity", type: "number", default: "0.6", description: "Line opacity." },
      ],
    },
    {
      name: "RadarLabels",
      description: "Metric labels around the edge.",
      props: [
        { name: "offset", type: "number", default: "24", description: "Distance from the outer ring in px." },
        { name: "fontSize", type: "number", default: "11", description: "Font size in px." },
        { name: "interactive", type: "boolean", description: "Hovering a label highlights the metric." },
      ],
    },
    {
      name: "RadarArea",
      description: "One series as a filled shape.",
      props: [
        { name: "index", type: "number", description: "Index of the series in data." },
        { name: "color", type: "string", description: "Overrides the series color." },
        { name: "showPoints", type: "boolean", default: "true", description: "Draw a point at each metric." },
        { name: "showStroke", type: "boolean", default: "true", description: "Draw the outline." },
        { name: "showGlow", type: "boolean", default: "true", description: "Glow on hover." },
      ],
    },
  ],
};
