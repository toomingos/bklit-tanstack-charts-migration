import type { ChartDoc } from "./types";

const data = `const data = [
  { date: new Date("2025-01-01"), users: 1200 },
  { date: new Date("2025-01-02"), users: 1350 },
  { date: new Date("2025-01-03"), users: 1100 },
  { date: new Date("2025-01-04"), users: 1450 },
  { date: new Date("2025-01-05"), users: 1380 },
  // ...
];`;

export const doc: ChartDoc = {
  description: "A draggable time-range brush on a small strip that zooms the main chart above it.",
  code: `import { ChartBrush, ChartBrushLayout, ChartTooltip, Grid, Line, LineChart, XAxis } from "bklit-tanstack-charts";

${data}

const stripMargin = { top: 4, right: 40, bottom: 4, left: 40 };

export function UsersChart() {
  return (
    <div style={{ height: 360, minHeight: 0 }}>
      <ChartBrushLayout
        data={data}
        enabled
        height={72}
        brushStrip={(layout) => (
          <LineChart
            animationDuration={0}
            className="size-full"
            data={data}
            margin={stripMargin}
            status="ready"
            style={{ aspectRatio: "unset", height: "100%" }}
          >
            <Line animate={false} dataKey="users" fadeEdges showHighlight={false} stroke="var(--chart-line-primary)" strokeWidth={2} />
            <ChartBrush
              initialSelection={layout.brushSelection ?? undefined}
              onSelectionChange={layout.onBrushSelectionChange}
              selectionPattern={{ color: "var(--chart-1)", preset: "diagonal" }}
            />
          </LineChart>
        )}
      >
        {(layout) => (
          <LineChart
            className="size-full"
            data={data}
            style={{ aspectRatio: "unset", height: "100%" }}
            tweenYDomainOnXDomainChange
            xDomain={layout.xDomain}
            xDomainSlotCount={layout.xDomainSlotCount}
            yDomainTween
          >
            <Grid horizontal stroke="var(--chart-grid)" />
            <Line dataKey="users" fadeEdges stroke="var(--chart-line-primary)" strokeWidth={2} />
            <XAxis />
            <ChartTooltip />
          </LineChart>
        )}
      </ChartBrushLayout>
    </div>
  );
}
`,
  usage: `import { ChartBrush, ChartBrushLayout, Line, LineChart } from "bklit-tanstack-charts";

${data}

export function UsersChart() {
  return (
    <ChartBrushLayout
      data={data}
      enabled
      height={72}
      brushStrip={(layout) => (
        <LineChart data={data} style={{ aspectRatio: "unset", height: "100%" }}>
          <Line dataKey="users" />
          <ChartBrush
            initialSelection={layout.brushSelection ?? undefined}
            onSelectionChange={layout.onBrushSelectionChange}
          />
        </LineChart>
      )}
    >
      {(layout) => (
        <LineChart data={data} xDomain={layout.xDomain} xDomainSlotCount={layout.xDomainSlotCount}>
          <Line dataKey="users" />
        </LineChart>
      )}
    </ChartBrushLayout>
  );
}
`,
  api: [
    {
      name: "ChartBrushLayout",
      description: "Holds the brush selection and lays out the main chart with the strip below it.",
      props: [
        { name: "data", type: "Record<string, unknown>[]", description: "Full dataset, used to find the full x range." },
        { name: "xDataKey", type: "string", default: '"date"', description: "Key holding the x value (a Date)." },
        { name: "enabled", type: "boolean", description: "When false, only the main chart renders, with no zoom." },
        { name: "height", type: "number", description: "Strip height in px." },
        { name: "children", type: "(layout) => ReactNode", description: "Renders the main chart." },
        { name: "brushStrip", type: "(layout) => ReactNode", description: "Renders the strip chart with a ChartBrush inside." },
        { name: "xExtentMax", type: "Date", description: "Stretches the full range to this date when it is later than the data." },
        { name: "fitMainContent", type: "boolean", default: "false", description: "Size the main area to its content instead of filling the space." },
        { name: "className", type: "string", description: "Class on the wrapper." },
      ],
    },
    {
      name: "layout",
      description: "The object passed to children and brushStrip.",
      props: [
        { name: "xDomain", type: "[Date, Date] | undefined", description: "Visible range for the main chart." },
        { name: "xDomainSlotCount", type: "number | undefined", description: "Length of the full dataset, so the zoomed x scale keeps its spacing." },
        { name: "brushSelection", type: "{ start: Date; end: Date } | null", description: "Current selection." },
        { name: "onBrushSelectionChange", type: "(selection) => void", description: "Pass to ChartBrush as onSelectionChange." },
      ],
    },
    {
      name: "ChartBrush",
      description: "The brush. Render it inside the strip chart.",
      props: [
        { name: "initialSelection", type: "{ start: Date; end: Date }", description: "Selection when the brush first appears." },
        { name: "onSelectionChange", type: "(selection) => void", description: "Called while dragging with the selected range, or null for an empty drag." },
        { name: "selectionPattern", type: "{ preset: string; color: string; opacity?: number }", description: "Pattern fill inside the selection." },
        { name: "blurPx", type: "number", default: "1.5", description: "Blur on the dimmed area outside the selection (0 to 5 px)." },
        { name: "fadeOuterEdges", type: "boolean", default: "true", description: "Fade the dimmed area at the outer edges." },
        { name: "selectedBoxStyle", type: "SVGProps<SVGRectElement>", description: "Style for the selection box." },
      ],
    },
    {
      name: "LineChart (main chart)",
      description: "Props the main chart takes to follow the brush.",
      props: [
        { name: "xDomain", type: "[Date, Date]", description: "Visible x range." },
        { name: "xDomainSlotCount", type: "number", description: "Full dataset length." },
        { name: "tweenYDomainOnXDomainChange", type: "boolean", description: "Animate the y range when the visible x range changes." },
        { name: "yDomainTween", type: "boolean", default: "true", description: "Animate the y range when it changes." },
      ],
    },
  ],
};
