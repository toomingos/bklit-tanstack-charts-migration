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
  description: "Event markers pinned to dates on a time chart, with a fan-out for several events on the same day.",
  code: `import { useState } from "react";
import { ChartLegend, ChartLegendHoverProvider, ChartMarkers, ChartTooltip, Grid, Line, LineChart, XAxis } from "bklit-tanstack-charts";
import type { ChartMarker } from "bklit-tanstack-charts";

${data}

const launchDay = new Date("2025-01-13");

// Three markers on one date fan out on hover.
const markers: ChartMarker[] = [
  { date: launchDay, icon: "🚀", title: "Launch", description: "Release shipped" },
  { date: launchDay, icon: "⚠️", title: "Alert", description: "Threshold breached" },
  { date: launchDay, icon: "🔧", title: "Fix", description: "Hotfix deployed" },
  { date: new Date("2025-01-07"), icon: "🎉", title: "Milestone", description: "100k users" },
  { date: new Date("2025-01-22"), icon: "📈", title: "Growth", description: "Quarterly peak" },
];

const legendItems = [
  { label: "Users", value: 100, color: "var(--chart-line-primary)" },
  { label: "Pageviews", value: 100, color: "var(--chart-line-secondary)" },
];

export function UsersChart() {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <div style={{ display: "flex", gap: 32, alignItems: "flex-start" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <ChartLegendHoverProvider hoveredIndex={hoveredIndex} onHoverChange={setHoveredIndex}>
          <LineChart data={data} aspectRatio="2/1">
            <Grid horizontal />
            <Line
              dataKey="users"
              stroke="var(--chart-line-primary)"
              showMarkers
              markers={{ radius: 5, fill: "var(--chart-line-primary)" }}
              dashFromIndex={3}
              dashArray="6,4"
            />
            <Line dataKey="pageviews" stroke="var(--chart-line-secondary)" />
            <XAxis />
            <ChartTooltip />
            <ChartMarkers items={markers} />
          </LineChart>
        </ChartLegendHoverProvider>
      </div>
      <div style={{ width: 200 }}>
        <ChartLegend hoveredIndex={hoveredIndex} items={legendItems} onHover={setHoveredIndex} title="Series" />
      </div>
    </div>
  );
}
`,
  usage: `import { ChartMarkers, ChartTooltip, Line, LineChart, XAxis } from "bklit-tanstack-charts";

${data}

const markers = [
  { date: new Date("2025-01-03"), icon: "🚀", title: "Launch", description: "Release shipped" },
];

export function UsersChart() {
  return (
    <LineChart data={data}>
      <Line dataKey="users" />
      <XAxis />
      <ChartTooltip />
      <ChartMarkers items={markers} />
    </LineChart>
  );
}
`,
  api: [
    {
      name: "ChartMarkers",
      description: "Draws a marker for each item. Render it as a child of a time chart.",
      props: [
        { name: "items", type: "ChartMarker[]", description: "The markers. Items with the same date are grouped." },
        { name: "size", type: "number", default: "28", description: "Marker diameter in px." },
        { name: "showLines", type: "boolean", default: "true", description: "Vertical guide line under each marker." },
        { name: "animate", type: "boolean", description: "Turn the entrance animation off with false." },
        { name: "maxFanned", type: "number", description: "Most markers shown when a group fans out. The badge keeps the full count." },
      ],
    },
    {
      name: "ChartMarker",
      description: "One item of items.",
      props: [
        { name: "date", type: "Date", description: "Where the marker sits on the x axis." },
        { name: "icon", type: "ReactNode", description: "Emoji or element shown in the marker." },
        { name: "title", type: "string", description: "Heading in the marker tooltip." },
        { name: "description", type: "string", description: "Text under the title." },
        { name: "content", type: "ReactNode", description: "Extra content in the tooltip." },
        { name: "color", type: "string", description: "Marker background color." },
        { name: "href", type: "string", description: "Makes the marker a link." },
        { name: "target", type: '"_blank" | "_self"', description: "Link target when href is set." },
        { name: "onClick", type: "() => void", description: "Called when the marker is clicked." },
      ],
    },
    {
      name: "Line",
      description: "Point markers and dashes on a series. See the Line chart page for all props.",
      props: [
        { name: "showMarkers", type: "boolean", default: "false", description: "Draw a marker at each point." },
        { name: "markers", type: "{ radius?: number; fill?: string; stroke?: string; strokeWidth?: number }", description: "Marker style." },
        { name: "dashFromIndex", type: "number", description: "Dash the line from this data index on." },
        { name: "dashArray", type: "string", description: "Dash pattern used from dashFromIndex." },
      ],
    },
  ],
};
