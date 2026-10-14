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
  description: "A dashed forecast that continues a line past its last data point.",
  code: `import {
  buildProjectionPath,
  ChartTooltip,
  Grid,
  Line,
  LineChart,
  LineSeriesTerminalMarker,
  ProjectionLine,
  XAxis,
} from "bklit-tanstack-charts";

${data}

// Reach 301 at the end of the horizon.
const targetPath = buildProjectionPath({
  sourceData: data,
  seriesKey: "users",
  mode: "target",
  pathDensity: "endpoints",
  horizonPoints: 6,
  endValue: 301,
});

// Continue the slope of the last segment.
const autoPath = buildProjectionPath({
  sourceData: data,
  seriesKey: "users",
  mode: "auto",
  autoMethod: "lastSegment",
  pathDensity: "endpoints",
  horizonPoints: 6,
});

export function TrafficChart() {
  return (
    <LineChart data={data} aspectRatio="2/1">
      <Grid horizontal />
      <Line dataKey="users" stroke="var(--chart-line-primary)" />
      <LineSeriesTerminalMarker dataKey="users" ringGap={6} stroke="var(--chart-1)" />
      <ProjectionLine
        curveKind="bezier"
        data={targetPath}
        gradientEnd="var(--chart-5)"
        gradientStart="var(--chart-3)"
        showEndMarker
        stroke="var(--chart-3)"
        strokeDasharray="1,4"
        strokeStyle="gradient"
        strokeWidth={2}
      />
      <ProjectionLine
        curveKind="bezier"
        data={autoPath}
        gradientEnd="var(--chart-5)"
        gradientStart="var(--chart-3)"
        showEndMarker
        stroke="var(--chart-3)"
        strokeDasharray="1,4"
        strokeStyle="gradient"
        strokeWidth={2}
      />
      <XAxis />
      <ChartTooltip />
    </LineChart>
  );
}
`,
  usage: `import { buildProjectionPath, Line, LineChart, ProjectionLine, XAxis } from "bklit-tanstack-charts";

${data}

const projection = buildProjectionPath({
  sourceData: data,
  seriesKey: "users",
  mode: "auto",
  horizonPoints: 6,
});

export function TrafficChart() {
  return (
    <LineChart data={data}>
      <Line dataKey="users" />
      <ProjectionLine data={projection} strokeDasharray="6,4" />
      <XAxis />
    </LineChart>
  );
}
`,
  api: [
    {
      name: "ProjectionLine",
      description: "Draws a path of { date, value } points. The chart widens its x range to fit it. Not meant to be combined with brush zoom.",
      props: [
        { name: "data", type: "{ date: Date; value: number }[]", description: "Anchor and horizon points, usually from buildProjectionPath." },
        { name: "yAxisId", type: "string | number", default: '"left"', description: "Y scale to plot against." },
        { name: "stroke", type: "string", default: "var(--chart-3)", description: "Line color." },
        { name: "strokeStyle", type: '"solid" | "gradient"', default: '"solid"', description: "Solid, or a gradient along the path." },
        { name: "gradientStart", type: "string", default: "stroke", description: 'Gradient start color when strokeStyle is "gradient".' },
        { name: "gradientEnd", type: "string", default: "var(--chart-5)", description: 'Gradient end color when strokeStyle is "gradient".' },
        { name: "strokeWidth", type: "number", default: "2", description: "Line width." },
        { name: "strokeOpacity", type: "number", default: "1", description: "Line opacity." },
        { name: "strokeDasharray", type: "string", default: '"6,4"', description: 'Dash pattern. Pass "0" for a solid path.' },
        { name: "curveKind", type: '"linear" | "bezier"', default: '"linear"', description: "Straight segments, or a smooth S-curve." },
        { name: "showEndMarker", type: "boolean", default: "true", description: "Dot at the end of the horizon." },
        { name: "endpointRadius", type: "number", default: "5", description: "Radius of the end dot." },
      ],
    },
    {
      name: "buildProjectionPath",
      description: "Returns the points for a ProjectionLine, starting at a row of your data.",
      props: [
        { name: "sourceData", type: "Record<string, unknown>[]", description: "The chart rows." },
        { name: "seriesKey", type: "string", description: "Key holding the y value." },
        { name: "mode", type: '"auto" | "target" | "manual"', description: '"auto" extrapolates, "target" ends at endValue, "manual" uses points.' },
        { name: "autoMethod", type: '"linearRegression" | "lastSegment"', default: '"linearRegression"', description: 'How "auto" extrapolates: a fit over the series, or the slope of the last segment.' },
        { name: "endValue", type: "number", description: 'End value for "target" mode.' },
        { name: "points", type: "{ date: Date; value: number }[]", description: 'Points for "manual" mode. At least two.' },
        { name: "horizonPoints", type: "number", default: "6", description: "How many points to project past the start." },
        { name: "startIndex", type: "number", default: "last row", description: "Row the projection starts from." },
        { name: "pathDensity", type: '"stepped" | "endpoints"', default: '"endpoints"', description: '"endpoints" returns the start and the end; "stepped" returns every step.' },
        { name: "xDataKey", type: "string", default: '"date"', description: "Key holding the x value." },
      ],
    },
    {
      name: "LineSeriesTerminalMarker",
      description: "A ringed dot on the last point of a line, where the projection starts.",
      props: [
        { name: "dataKey", type: "string", description: "Key of the line to mark." },
        { name: "stroke", type: "string", default: "var(--chart-1)", description: "Ring color." },
        { name: "strokeWidth", type: "number", default: "1.5", description: "Ring width." },
        { name: "ringGap", type: "number", default: "0", description: "Gap in px between the dot and the ring." },
        { name: "radius", type: "number", default: "5", description: "Dot radius." },
        { name: "fill", type: "string", description: "Dot fill. Transparent when omitted." },
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
  ],
};
