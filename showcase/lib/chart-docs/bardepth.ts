import type { ChartDoc } from "./types";

const data = `const data = [
  { month: "Jan", revenue: 12000 },
  { month: "Feb", revenue: 15500 },
  { month: "Mar", revenue: 11000 },
  { month: "Apr", revenue: 18500 },
  { month: "May", revenue: 16800 },
  // ...
];`;

export const doc: ChartDoc = {
  description: "Bars with a head-on 3D look: side and top faces, a glass front and a contact shadow, plus an optional pulse on one bar.",
  code: `import { Bar, BarChart, BarDepthBack, BarDepthFront, BarDepthProvider, BarPulse, BarXAxis, ChartTooltip, Grid } from "bklit-tanstack-charts";

${data}

export function RevenueChart() {
  return (
    <BarChart data={data} xDataKey="month" aspectRatio="2/1">
      <Grid horizontal />
      <BarDepthProvider groundShadow={0.26}>
        <BarDepthBack dataKey="revenue" color="var(--chart-1)" />
        <Bar dataKey="revenue" fill="var(--chart-1)" />
        <BarDepthFront dataKey="revenue" />
        <BarPulse dataKey="revenue" activeIndex={data.length - 1} pulsePaused />
      </BarDepthProvider>
      <BarXAxis />
      <ChartTooltip />
    </BarChart>
  );
}
`,
  usage: `import { Bar, BarChart, BarDepthBack, BarDepthFront, BarDepthProvider, BarXAxis, ChartTooltip } from "bklit-tanstack-charts";

${data}

export function RevenueChart() {
  return (
    <BarChart data={data} xDataKey="month">
      <BarDepthProvider>
        <BarDepthBack dataKey="revenue" />
        <Bar dataKey="revenue" />
        <BarDepthFront dataKey="revenue" />
      </BarDepthProvider>
      <BarXAxis />
      <ChartTooltip />
    </BarChart>
  );
}
`,
  examples: [
    {
      title: "Pulse",
      description: "BarPulse loops a light sweep over one bar, such as the latest value. Set pulsePaused to hold it still.",
      controls: { pulse: true },
      code: `import { Bar, BarChart, BarDepthBack, BarDepthFront, BarDepthProvider, BarPulse, BarXAxis } from "bklit-tanstack-charts";

export function RevenueChart({ data }: { data: Record<string, unknown>[] }) {
  return (
    <BarChart data={data} xDataKey="month">
      <BarDepthProvider>
        <BarDepthBack dataKey="revenue" />
        <Bar dataKey="revenue" />
        <BarDepthFront dataKey="revenue" />
        <BarPulse dataKey="revenue" activeIndex={data.length - 1} />
      </BarDepthProvider>
      <BarXAxis />
    </BarChart>
  );
}
`,
    },
  ],
  api: [
    {
      name: "BarDepthProvider",
      description: "Wraps the depth layers and the Bar. Turns on the depth geometry and holds the shared settings.",
      props: [
        { name: "groundShadow", type: "number", default: "0.26", description: "Opacity (0 to 1) of the contact shadow at the baseline. 0 removes it." },
        { name: "minBarHeight", type: "number", default: "0", description: "Smallest bar height in px, so short or zero bars stay visible." },
        { name: "segmentsAccessor", type: "(datum) => { value: number; color?: string }[] | null", description: "Segments of a stacked bar, bottom to top." },
      ],
    },
    {
      name: "BarDepthBack",
      description: "The side and top faces. Place it before Bar.",
      props: [
        { name: "dataKey", type: "string", description: "Key of the matching Bar." },
        { name: "color", type: "string", description: "Color of the side and top faces." },
        { name: "colorAccessor", type: "(datum, index) => string | undefined", description: "Per-bar color; wins over color." },
      ],
    },
    {
      name: "BarDepthFront",
      description: "The glass sheen over the bar. Place it after Bar.",
      props: [{ name: "dataKey", type: "string", description: "Key of the matching Bar." }],
    },
    {
      name: "BarPulse",
      description: "A looping sweep over one bar. Place it after BarDepthFront.",
      props: [
        { name: "dataKey", type: "string", description: "Key of the matching Bar." },
        { name: "activeIndex", type: "number", description: "Index in data of the bar to pulse." },
        { name: "pulsePaused", type: "boolean", default: "false", description: "Hold the sweep still and keep the 3D look." },
      ],
    },
    {
      name: "Bar",
      description: "The bar between the back and front layers. See the Bar chart page for all props.",
      props: [
        { name: "dataKey", type: "string", description: "Key holding the value." },
        { name: "fill", type: "string", default: "var(--chart-line-primary)", description: "Fill color." },
      ],
    },
  ],
};
