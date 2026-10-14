import type { ChartDoc } from "./types";

const build = `// One column per week (Sunday first), seven days per column.
function buildData(weeks: number): HeatmapColumn[] {
  const start = new Date("2025-01-05");
  return Array.from({ length: weeks }, (_, week) => ({
    bin: week,
    bins: Array.from({ length: 7 }, (_, day) => ({
      bin: day,
      count: (week * 7 + day * 3) % 9,
      date: new Date(start.getTime() + (week * 7 + day) * 86_400_000),
    })),
  }));
}`;

export const doc: ChartDoc = {
  description: "A calendar grid of cells colored by count, for activity over weeks and days.",
  code: `import {
  HeatmapCells,
  HeatmapChart,
  HeatmapInteractionBoundary,
  HeatmapInteractionProvider,
  HeatmapLegend,
  HeatmapTooltip,
  HeatmapXAxis,
  HeatmapYAxis,
  type HeatmapColumn,
} from "bklit-tanstack-charts";

${build}

const data = buildData(52);

export function ActivityChart() {
  return (
    <HeatmapInteractionProvider>
      <HeatmapInteractionBoundary>
        <div className="flex w-full flex-col items-stretch gap-3">
          <HeatmapChart className="w-full" data={data} layout="fluid">
            <HeatmapCells inactiveOpacity={1} inactiveScale={1} />
            <HeatmapXAxis />
            <HeatmapYAxis />
            <HeatmapTooltip instant />
          </HeatmapChart>
          <HeatmapLegend inactiveOpacity={1} inactiveScale={1} />
        </div>
      </HeatmapInteractionBoundary>
    </HeatmapInteractionProvider>
  );
}
`,
  usage: `import { HeatmapCells, HeatmapChart, HeatmapTooltip, HeatmapXAxis, HeatmapYAxis, type HeatmapColumn } from "bklit-tanstack-charts";

${build}

const data = buildData(26);

export function ActivityChart() {
  return (
    <HeatmapChart data={data}>
      <HeatmapCells />
      <HeatmapXAxis />
      <HeatmapYAxis />
      <HeatmapTooltip />
    </HeatmapChart>
  );
}
`,
  examples: [
    {
      title: "Loading state",
      description: "Set status to \"loading\" while data is on its way. Switching to \"ready\" plays the reveal on the same chart.",
      controls: { loading: "status" },
      code: `import { HeatmapCells, HeatmapChart, HeatmapXAxis, HeatmapYAxis, type HeatmapColumn } from "bklit-tanstack-charts";

export function ActivityChart({ data, loading }: { data: HeatmapColumn[]; loading: boolean }) {
  return (
    <HeatmapChart data={data} status={loading ? "loading" : "ready"}>
      <HeatmapCells />
      <HeatmapXAxis />
      <HeatmapYAxis />
    </HeatmapChart>
  );
}
`,
    },
    {
      title: "Loading placeholder",
      description: "HeatmapChartLoading is a standalone placeholder shaped like the data you will pass later.",
      controls: { loading: "component" },
      code: `import { HeatmapChartLoading, type HeatmapColumn } from "bklit-tanstack-charts";

export function ActivityChartPlaceholder({ data }: { data: HeatmapColumn[] }) {
  return <HeatmapChartLoading className="w-full" data={data} />;
}
`,
    },
  ],
  api: [
    {
      name: "HeatmapChart",
      description: "The root. Holds the data and lays out its children.",
      props: [
        { name: "data", type: "HeatmapColumn[]", description: "One column per week; each has seven bins of { bin, count, date }." },
        { name: "layout", type: '"fluid" | "fill"', default: '"fluid"', description: '"fluid" sizes cells to the width; "fill" fills the available height too.' },
        { name: "binSize", type: "number", description: "Fixed cell size in px. By default cells fit the width." },
        { name: "gap", type: "number", default: "2", description: "Space between cells in px." },
        { name: "weekStartDay", type: "0 | 1 | 2 | 3 | 4 | 5 | 6", default: "0", description: "First row of each column, 0 for Sunday." },
        { name: "xDomain", type: "[Date, Date]", description: "Date range to show." },
        { name: "levelColors", type: "[string, string, string, string, string]", description: "Colors for the five levels, empty first." },
        { name: "colorScale", type: "(count: number | null | undefined) => string", description: "Maps a count to a color. Replaces levelColors." },
        { name: "status", type: '"loading" | "ready"', default: '"ready"', description: "Loading state; switching to ready plays the reveal." },
        { name: "loadingLabel", type: "string", description: "Label shown while loading." },
        { name: "animate", type: "boolean", default: "true", description: "Animate the reveal." },
        { name: "animationDuration", type: "number", default: "1600", description: "Reveal duration in ms." },
        { name: "margin", type: "Partial<Margin>", default: "{ top: 28, right: 16, bottom: 0, left: 40 }", description: "Space around the grid." },
        { name: "aspectRatio", type: "string", description: "CSS aspect ratio of the chart." },
        { name: "className", type: "string", description: "Class on the chart container." },
      ],
    },
    {
      name: "HeatmapCells",
      description: "Draws the cells.",
      props: [
        { name: "cornerRadius", type: "number", default: "2", description: "Cell corner radius." },
        { name: "colorScale", type: "(count: number | null | undefined) => string", description: "Maps a count to a color." },
        { name: "activeScale", type: "number", default: "1", description: "Scale of the hovered cell." },
        { name: "inactiveOpacity", type: "number", default: "0.3", description: "Opacity of the other cells while one is hovered." },
        { name: "inactiveScale", type: "number", default: "1", description: "Scale of the other cells while one is hovered." },
        { name: "hideGhostCells", type: "boolean", description: "Hide cells that fall outside the data's date range." },
        { name: "interactive", type: "boolean", description: "Set to false to turn off hover." },
      ],
    },
    {
      name: "HeatmapXAxis",
      description: "Month labels above the grid.",
      props: [{ name: "className", type: "string", description: "Class on the labels." }],
    },
    {
      name: "HeatmapYAxis",
      description: "Day labels beside the grid.",
      props: [
        { name: "tickFilter", type: '"all" | "odd" | "even"', default: '"odd"', description: "Which rows get a label." },
        { name: "labelFormat", type: '"full" | "initial"', default: '"full"', description: "Full day name or its first letter." },
        { name: "className", type: "string", description: "Class on the labels." },
      ],
    },
    {
      name: "HeatmapTooltip",
      props: [
        { name: "formatLabel", type: "(count: number, date: Date) => string", description: "Text shown for a cell." },
        { name: "instant", type: "boolean", default: "false", description: "Skip the enter and leave motion." },
        { name: "showDelay", type: "number", default: "0", description: "Delay in ms before the tooltip first appears." },
        { name: "hideDelay", type: "number", default: "120", description: "Hold in ms after the pointer leaves a cell. Applies with instant." },
      ],
    },
    {
      name: "HeatmapLegend",
      description: "Less to more scale. Hovering a level highlights its cells.",
      props: [
        { name: "variant", type: '"swatches" | "gradient"', default: '"swatches"', description: "Five swatches or a gradient bar." },
        { name: "lessLabel", type: "string", default: '"Less"', description: "Label at the low end." },
        { name: "moreLabel", type: "string", default: '"More"', description: "Label at the high end." },
        { name: "align", type: '"start" | "center" | "end"', default: '"end"', description: "Horizontal alignment." },
        { name: "cellSize", type: "number", default: "11", description: "Swatch size." },
        { name: "gap", type: "number", default: "2", description: "Space between swatches." },
        { name: "inactiveOpacity", type: "number", default: "0.3", description: "Opacity of the other levels on hover." },
      ],
    },
    {
      name: "HeatmapInteractionProvider",
      description: "Wrap the chart and legend so hovering a legend level highlights matching cells. Wrap their shared parent in HeatmapInteractionBoundary.",
      props: [],
    },
  ],
};
