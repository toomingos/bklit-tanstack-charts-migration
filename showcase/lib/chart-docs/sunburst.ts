import type { ChartDoc } from "./types";

const data = `const data = {
  name: "Revenue",
  children: [
    {
      name: "Product",
      children: [
        { name: "Enterprise", value: 160 },
        { name: "Pro", children: [{ name: "Teams", value: 90 }, { name: "Solo", value: 55 }] },
        { name: "Starter", value: 95 },
      ],
    },
    {
      name: "Services",
      children: [
        { name: "Consulting", value: 160 },
        { name: "Training", value: 55 },
      ],
    },
    // ...
  ],
};`;

export const doc: ChartDoc = {
  description: "Shows hierarchical data as nested rings; click a segment to zoom into it.",
  code: `import { useState } from "react";
import {
  buildArcs,
  SunburstCenter,
  SunburstChart,
  SunburstHint,
  SunburstLabels,
  SunburstSegment,
} from "bklit-tanstack-charts";

${data}

const { arcs, rootId } = buildArcs(data);

export function RevenueSunburst() {
  const [focusId, setFocusId] = useState(rootId);

  return (
    <SunburstChart data={data} focusId={focusId} onFocusChange={setFocusId} size={440}>
      {arcs.map((arc) => (
        <SunburstSegment index={arc.arcIndex} key={arc.id} />
      ))}
      <SunburstCenter />
      <SunburstLabels />
      <SunburstHint />
    </SunburstChart>
  );
}
`,
  usage: `import { buildArcs, SunburstCenter, SunburstChart, SunburstSegment } from "bklit-tanstack-charts";

const data = {
  name: "Files",
  children: [
    { name: "src", children: [{ name: "app", value: 40 }, { name: "lib", value: 25 }] },
    { name: "docs", value: 20 },
  ],
};

const { arcs } = buildArcs(data);

export function FileSizes() {
  return (
    <SunburstChart data={data}>
      {arcs.map((arc) => (
        <SunburstSegment index={arc.arcIndex} key={arc.id} />
      ))}
      <SunburstCenter />
    </SunburstChart>
  );
}
`,
  api: [
    {
      name: "SunburstChart",
      description: "The root. Holds the tree. buildArcs(data) lists the arcs to render a SunburstSegment for.",
      props: [
        { name: "data", type: "SunburstNode", description: "Root node. Leaves carry a value; parents carry children." },
        { name: "size", type: "number", default: "520", description: "Width and height in px." },
        { name: "focusId", type: "string", description: "Controlled id of the zoomed node. Defaults to the root." },
        { name: "onFocusChange", type: "(focusId: string) => void", description: "Called when a segment is clicked or the center zooms out." },
        { name: "hoveredIndex", type: "number | null", description: "Controlled hovered arc index." },
        { name: "onHoverChange", type: "(index: number | null) => void", description: "Called when the hovered arc changes." },
        { name: "hoverPop", type: "number", default: "8", description: "How far a hovered segment grows outward, in px." },
        { name: "playKey", type: "number", default: "0", description: "Change to replay the entrance animation." },
        { name: "className", type: "string", description: "Class on the chart container." },
      ],
    },
    {
      name: "SunburstSegment",
      description: "One arc.",
      props: [
        { name: "index", type: "number", description: "The arcIndex of an arc from buildArcs." },
        { name: "color", type: "string", description: "Overrides the arc color." },
        { name: "fill", type: "string", description: "Overrides the arc fill with a plain color." },
        { name: "fillOpacity", type: "number", description: "Overrides the arc fill opacity." },
      ],
    },
    {
      name: "SunburstCenter",
      description: "Name and total of the zoomed node. Click to zoom out.",
      props: [{ name: "className", type: "string", description: "Class on the center." }],
    },
    {
      name: "SunburstLabels",
      description: "Names on the segments.",
      props: [
        { name: "fontSize", type: "number", description: "Font size in px." },
        { name: "fill", type: "string", description: "Text color." },
        { name: "stroke", type: "string", description: "Color of the halo behind the text." },
        { name: "strokeWidth", type: "number", description: "Width of the halo." },
      ],
    },
    {
      name: "SunburstHint",
      description: "Line of text showing the hovered path, or how to navigate.",
      props: [
        { name: "children", type: "ReactNode | (context) => ReactNode", description: "Replaces the text." },
        { name: "className", type: "string", description: "Class on the hint." },
      ],
    },
  ],
};
