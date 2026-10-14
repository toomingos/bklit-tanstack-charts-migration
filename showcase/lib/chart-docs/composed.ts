import type { ChartDoc } from "./types";

const data = `const data = [
  { date: new Date("2025-01-01"), units: 52, revenue: 98, runRate: 84 },
  { date: new Date("2025-01-02"), units: 58, revenue: 104, runRate: 86 },
  { date: new Date("2025-01-03"), units: 49, revenue: 101, runRate: 88 },
  { date: new Date("2025-01-04"), units: 61, revenue: 110, runRate: 87 },
  { date: new Date("2025-01-05"), units: 55, revenue: 107, runRate: 90 },
  // ...
];`;

export const doc: ChartDoc = {
  description: "Bars, lines and areas on one time axis, for series that share an x but differ in kind.",
  code: `import { Area, ChartTooltip, ComposedChart, Grid, Line, SeriesBar, XAxis } from "bklit-tanstack-charts";
import { curveCatmullRom } from "d3-shape";

${data}

const smoothCurve = curveCatmullRom.alpha(0.42);

export function SalesChart() {
  return (
    <ComposedChart data={data} xDataKey="date" aspectRatio="2 / 1" barGap={0} maxBarSize={32}>
      <Grid horizontal />
      <Area curve={smoothCurve} dataKey="runRate" fill="var(--chart-4)" fillOpacity={0.32} />
      <SeriesBar dataKey="units" fill="var(--chart-3)" radius={4} />
      <Line curve={smoothCurve} dataKey="revenue" stroke="var(--chart-1)" strokeWidth={2.5} />
      <ChartTooltip showCrosshair={false} />
      <XAxis numTicks={8} />
    </ComposedChart>
  );
}
`,
  usage: `import { ChartTooltip, ComposedChart, Line, SeriesBar, XAxis } from "bklit-tanstack-charts";

${data}

export function SalesChart() {
  return (
    <ComposedChart data={data}>
      <SeriesBar dataKey="units" />
      <Line dataKey="revenue" />
      <XAxis />
      <ChartTooltip />
    </ComposedChart>
  );
}
`,
  api: [
    {
      name: "ComposedChart",
      description: "The root. Holds the data and lays out its children. Accepts Line, Area and SeriesBar.",
      props: [
        { name: "data", type: "Record<string, unknown>[]", description: "One object per x value." },
        { name: "xDataKey", type: "string", default: '"date"', description: "Key holding the x value (a Date)." },
        { name: "barSize", type: "number", description: "Bar width in px. Computed from the plot width when omitted." },
        { name: "maxBarSize", type: "number", description: "Maximum bar width in px." },
        { name: "barGap", type: "number", default: "4", description: "Gap in px between grouped bars." },
        { name: "stacked", type: "boolean", default: "false", description: "Stack the SeriesBar children instead of grouping them." },
        { name: "stackGap", type: "number", default: "0", description: "Vertical gap in px between stacked segments." },
        { name: "animationDuration", type: "number", default: "1100", description: "Reveal duration in ms." },
        { name: "margin", type: "Partial<Margin>", default: "{ top: 40, right: 40, bottom: 40, left: 40 }", description: "Space around the plot." },
        { name: "aspectRatio", type: "string", default: '"2 / 1"', description: "CSS aspect ratio of the chart." },
        { name: "className", type: "string", description: "Class on the chart container." },
      ],
    },
    {
      name: "SeriesBar",
      description: "A bar series.",
      props: [
        { name: "dataKey", type: "string", description: "Key holding the bar height." },
        { name: "fill", type: "string", default: "var(--chart-line-primary)", description: "Bar color." },
        { name: "stroke", type: "string", default: "fill", description: "Tooltip dot color, for when fill is a gradient or pattern." },
        { name: "radius", type: "number", default: "0", description: "Corner radius." },
        { name: "fadedOpacity", type: "number", default: "0.3", description: "Opacity of the other bars while one x is hovered." },
        { name: "animate", type: "boolean", default: "true", description: "Grow the bars from the baseline on load." },
      ],
    },
    {
      name: "Line",
      description: "A line series.",
      props: [
        { name: "dataKey", type: "string", description: "Key holding the y value." },
        { name: "stroke", type: "string", default: "var(--chart-line-primary)", description: "Line color." },
        { name: "strokeWidth", type: "number", default: "2.5", description: "Line width." },
        { name: "curve", type: "CurveFactory", default: "curveNatural", description: "A d3-shape curve." },
      ],
    },
    {
      name: "Area",
      description: "A filled series with a line on top.",
      props: [
        { name: "dataKey", type: "string", description: "Key holding the y value." },
        { name: "fill", type: "string", default: "var(--chart-line-primary)", description: "Fill color." },
        { name: "fillOpacity", type: "number", default: "0.4", description: "Fill opacity at the top of the gradient." },
        { name: "curve", type: "CurveFactory", default: "curveMonotoneX", description: "A d3-shape curve." },
        { name: "showLine", type: "boolean", default: "true", description: "Draw the line on top of the fill." },
      ],
    },
    {
      name: "Grid",
      props: [
        { name: "horizontal", type: "boolean", default: "true", description: "Horizontal lines." },
        { name: "vertical", type: "boolean", default: "false", description: "Vertical lines." },
        { name: "numTicksRows", type: "number", default: "5", description: "Number of horizontal lines." },
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
      description: "Date pill, dots and tooltip box.",
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
