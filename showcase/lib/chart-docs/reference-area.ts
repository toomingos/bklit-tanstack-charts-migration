import type { ChartDoc } from "./types";

const data = `const data = [
  { date: new Date("2025-01-01"), users: 1200, pageviews: 4500 },
  { date: new Date("2025-01-02"), users: 1350, pageviews: 4800 },
  { date: new Date("2025-01-03"), users: 1100, pageviews: 4200 },
  { date: new Date("2025-01-04"), users: 1450, pageviews: 5100 },
  { date: new Date("2025-01-05"), users: 1380, pageviews: 4900 },
  // ...
];`;

export const doc: ChartDoc = {
  description: "A shaded band marking a range on the y axis, the x axis or both.",
  code: `import { ChartTooltip, Grid, Line, LineChart, ReferenceArea, XAxis } from "bklit-tanstack-charts";

${data}

export function TrafficChart() {
  return (
    <LineChart data={data} aspectRatio="2/1">
      <Grid horizontal />
      <ReferenceArea y1={1200} y2={1800} showMarkers strokeStyle="dashed" />
      <Line dataKey="users" stroke="var(--chart-line-primary)" />
      <XAxis />
      <ChartTooltip />
    </LineChart>
  );
}
`,
  usage: `import { Line, LineChart, ReferenceArea, XAxis } from "bklit-tanstack-charts";

${data}

export function TrafficChart() {
  return (
    <LineChart data={data}>
      <ReferenceArea y1={1200} y2={1800} />
      <Line dataKey="users" />
      <XAxis />
    </LineChart>
  );
}
`,
  api: [
    {
      name: "ReferenceArea",
      description: "Bounds you leave out extend to the edge of the plot. Use y1/y2, x1/x2, or both for a box.",
      props: [
        { name: "y1", type: "number", description: "Lower y bound. Extends to the bottom when omitted." },
        { name: "y2", type: "number", description: "Upper y bound. Extends to the top when omitted." },
        { name: "x1", type: "Date | number", description: "Left x bound. Extends to the left edge when omitted." },
        { name: "x2", type: "Date | number", description: "Right x bound. Extends to the right edge when omitted." },
        { name: "yAxisId", type: "string | number", default: '"left"', description: "Y scale the bounds refer to." },
        { name: "fill", type: "string", default: "12% var(--chart-foreground-muted)", description: "Fill color." },
        { name: "fillOpacity", type: "number", default: "1", description: "Fill opacity." },
        { name: "pattern", type: "PatternPresetId", default: '"none"', description: "Pattern that fills the band instead of the solid fill." },
        { name: "patternColor", type: "string", default: "var(--chart-foreground-muted)", description: "Pattern line or dot color." },
        { name: "patternScale", type: "number", default: "1", description: "Scales the pattern tile." },
        { name: "stroke", type: "string", default: "var(--chart-foreground-muted)", description: "Edge line color." },
        { name: "strokeWidth", type: "number", default: "1", description: "Edge line width." },
        { name: "strokeStyle", type: '"solid" | "dashed"', default: '"dashed"', description: "Edge line style." },
        { name: "strokeDasharray", type: "string", default: '"4,4"', description: 'Dash pattern when strokeStyle is "dashed".' },
        { name: "fadeEdges", type: "boolean", default: "true", description: "Fade the edge lines at the left and right ends." },
        { name: "showMarkers", type: "boolean", default: "false", description: "Draw a bracket marker at the center of each edge." },
        { name: "markerColor", type: "string", default: "var(--chart-1)", description: "Marker color." },
        { name: "markerSize", type: "number", default: "6", description: "Marker size in px." },
        { name: "axisLabelColor", type: "string", description: "Color of y axis labels that fall inside the band." },
      ],
    },
    {
      name: "LineChart",
      description: "The host chart. Holds the data and lays out its children.",
      props: [
        { name: "data", type: "Record<string, unknown>[]", description: "One object per point." },
        { name: "xDataKey", type: "string", default: "\"date\"", description: "Key holding the x value (a Date)." },
        { name: "aspectRatio", type: "string", default: "\"2 / 1\"", description: "CSS aspect ratio of the chart." },
        { name: "margin", type: "Partial<Margin>", default: "{ top: 40, right: 40, bottom: 40, left: 40 }", description: "Space around the plot." },
      ],
    },
    {
      name: "Line",
      props: [
        { name: "dataKey", type: "string", description: "Key holding the y value." },
        { name: "stroke", type: "string", default: "var(--chart-line-primary)", description: "Line color." },
      ],
    },
    {
      name: "Grid",
      props: [
        { name: "horizontal", type: "boolean", default: "true", description: "Horizontal lines." },
        { name: "vertical", type: "boolean", default: "false", description: "Vertical lines." },
      ],
    },
    {
      name: "XAxis",
      props: [
        { name: "numTicks", type: "number", default: "5", description: "Number of labels." },
        { name: "formatValue", type: "(value: Date) => string", description: "Label formatter." },
      ],
    },
    {
      name: "ChartTooltip",
      description: "Crosshair, dots, date pill and tooltip box.",
      props: [
        { name: "showDatePill", type: "boolean", default: "true", description: "Date pill on the x axis." },
        { name: "showCrosshair", type: "boolean", default: "true", description: "Vertical crosshair." },
        { name: "showDots", type: "boolean", default: "true", description: "Dots on each series." },
        { name: "rows", type: "(point) => TooltipRow[]", description: "Rows shown in the box." },
        { name: "content", type: "(props) => ReactNode", description: "Replaces the box content." },
      ],
    },
  ],
};
