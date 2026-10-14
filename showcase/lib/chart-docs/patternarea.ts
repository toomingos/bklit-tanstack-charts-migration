import type { ChartDoc } from "./types";

const data = `const data = [
  { date: new Date("2025-01-01"), revenue: 12000, costs: 8500 },
  { date: new Date("2025-01-02"), revenue: 13500, costs: 9200 },
  { date: new Date("2025-01-03"), revenue: 11000, costs: 7800 },
  { date: new Date("2025-01-04"), revenue: 14500, costs: 10100 },
  { date: new Date("2025-01-05"), revenue: 13800, costs: 9400 },
  // ...
];`;

export const doc: ChartDoc = {
  description: "An area filled with a hatch or dot pattern instead of a gradient.",
  code: `import { Area, AreaChart, ChartTooltip, Grid, PatternArea, XAxis } from "bklit-tanstack-charts";

${data}

export function RevenueChart() {
  return (
    <AreaChart data={data} aspectRatio="2/1">
      <Grid horizontal />
      <PatternArea dataKey="revenue" patternPreset="diagonal" patternColor="var(--chart-1)" />
      <Area dataKey="revenue" fillOpacity={0} strokeWidth={2.5} />
      <XAxis />
      <ChartTooltip />
    </AreaChart>
  );
}
`,
  usage: `import { AreaChart, PatternArea, XAxis } from "bklit-tanstack-charts";

${data}

export function RevenueChart() {
  return (
    <AreaChart data={data}>
      <PatternArea dataKey="revenue" patternPreset="dots" />
      <XAxis />
    </AreaChart>
  );
}
`,
  api: [
    {
      name: "PatternArea",
      description: "A pattern-filled area. It draws no line, so pair it with an Area (fillOpacity={0}) for the stroke and hover.",
      props: [
        { name: "dataKey", type: "string", description: "Key holding the y value." },
        { name: "patternPreset", type: '"diagonal" | "horizontal" | "vertical" | "cross" | "dots" | "circles" | "accent"', default: '"diagonal"', description: "Pattern to fill with." },
        { name: "patternColor", type: "string", default: "fill", description: "Pattern color. Falls back to var(--chart-line-primary)." },
        { name: "fill", type: "string", description: "Used as the pattern color when patternColor is not set." },
        { name: "curve", type: "CurveFactory", default: "curveMonotoneX", description: "A d3-shape curve. Match it to the Area on top." },
      ],
    },
    {
      name: "AreaChart",
      description: "The host chart. Holds the data and lays out its children.",
      props: [
        { name: "data", type: "Record<string, unknown>[]", description: "One object per point." },
        { name: "xDataKey", type: "string", default: "\"date\"", description: "Key holding the x value (a Date)." },
        { name: "aspectRatio", type: "string", default: "\"2 / 1\"", description: "CSS aspect ratio of the chart." },
        { name: "margin", type: "Partial<Margin>", default: "{ top: 40, right: 40, bottom: 40, left: 40 }", description: "Space around the plot." },
      ],
    },
    {
      name: "Area",
      description: "Draws the line and hover state over the pattern.",
      props: [
        { name: "dataKey", type: "string", description: "Key holding the y value." },
        { name: "fillOpacity", type: "number", default: "0.4", description: "Set to 0 to show only the pattern." },
        { name: "strokeWidth", type: "number", default: "2", description: "Line width." },
      ],
    },
  ],
};
