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
  description: "Click and drag across a chart to select a range, with a highlighted band and boundary lines.",
  code: `import { useEffect, useState } from "react";
import {
  ChartTooltip,
  Grid,
  Line,
  LineChart,
  SegmentBackground,
  SegmentLineFrom,
  SegmentLineTo,
  useChart,
  XAxis,
} from "bklit-tanstack-charts";

${data}

type Range = { from: Date; to: Date; change: number };

// Reports the selected range to the parent. It must render inside the chart.
function SelectionReader({ onChange }: { onChange: (range: Range | null) => void }) {
  const { selection, data, xAccessor } = useChart();

  useEffect(() => {
    const start = selection?.active ? data[selection.startIndex] : undefined;
    const end = selection?.active ? data[selection.endIndex] : undefined;
    if (!(start && end) || selection!.startIndex >= selection!.endIndex) {
      onChange(null);
      return;
    }
    onChange({
      from: xAccessor(start),
      to: xAccessor(end),
      change: Number(end.users) - Number(start.users),
    });
  }, [selection, data, xAccessor, onChange]);

  return null;
}

export function TrafficChart() {
  const [range, setRange] = useState<Range | null>(null);

  return (
    <div>
      <p>{range ? \`\${range.from.toDateString()} to \${range.to.toDateString()}: \${range.change} users\` : "Drag to select a range"}</p>
      <LineChart data={data} aspectRatio="2/1">
        <Grid horizontal />
        <Line dataKey="users" stroke="var(--chart-line-primary)" />
        <XAxis />
        <ChartTooltip />
        <SegmentBackground />
        <SegmentLineFrom />
        <SegmentLineTo />
        <SelectionReader onChange={setRange} />
      </LineChart>
    </div>
  );
}
`,
  usage: `import { Line, LineChart, SegmentBackground, SegmentLineFrom, SegmentLineTo, XAxis } from "bklit-tanstack-charts";

${data}

export function TrafficChart() {
  return (
    <LineChart data={data}>
      <Line dataKey="users" />
      <SegmentBackground />
      <SegmentLineFrom />
      <SegmentLineTo />
      <XAxis />
    </LineChart>
  );
}
`,
  api: [
    {
      name: "SegmentBackground",
      description: "The shaded band over the selected range. Use any of the three Segment components on its own.",
      props: [
        { name: "fill", type: "string", default: "var(--chart-segment-background)", description: "Band color." },
      ],
    },
    {
      name: "SegmentLineFrom",
      description: "The boundary line at the start of the selection.",
      props: [
        { name: "stroke", type: "string", default: "var(--chart-segment-line)", description: "Line color." },
        { name: "strokeWidth", type: "number", default: "1", description: "Line width." },
        { name: "variant", type: '"dashed" | "solid" | "gradient"', default: '"dashed"', description: "Line style. Gradient fades out at the top and bottom." },
      ],
    },
    {
      name: "SegmentLineTo",
      description: "The boundary line at the end of the selection. Same props as SegmentLineFrom.",
      props: [
        { name: "stroke", type: "string", default: "var(--chart-segment-line)", description: "Line color." },
        { name: "strokeWidth", type: "number", default: "1", description: "Line width." },
        { name: "variant", type: '"dashed" | "solid" | "gradient"', default: '"dashed"', description: "Line style." },
      ],
    },
    {
      name: "useChart",
      description: "Hook for components rendered inside the chart. selection holds the drag range; the full return also includes the chart's data, scales and size.",
      props: [
        { name: "selection", type: "{ startIndex: number; endIndex: number; startX: number; endX: number; active: boolean } | null", description: "Current selection. active is true while a range is selected." },
        { name: "clearSelection", type: "() => void", description: "Clears the selection." },
        { name: "data", type: "Record<string, unknown>[]", description: "The chart rows." },
        { name: "xAccessor", type: "(row) => Date", description: "Reads the x value of a row." },
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
