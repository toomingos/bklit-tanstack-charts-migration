import type { ChartDoc } from "./types";

export const doc: ChartDoc = {
  description: "A map with regions you can hover, shaded by a value, with optional pan and zoom.",
  code: `import { ChoroplethChart, ChoroplethFeatureComponent, ChoroplethTooltip } from "bklit-tanstack-charts";
import type { FeatureCollection, Geometry } from "geojson";

// Country shapes as GeoJSON. Convert world-atlas TopoJSON with topojson-client's feature().
export function WorldMap({ countries }: { countries: FeatureCollection<Geometry, { name: string }> }) {
  return (
    <ChoroplethChart aspectRatio="16 / 9" data={countries} zoomEnabled>
      <ChoroplethFeatureComponent fill="var(--chart-scale-03)" />
      <ChoroplethTooltip />
    </ChoroplethChart>
  );
}
`,
  usage: `import { ChoroplethChart, ChoroplethFeatureComponent, ChoroplethTooltip } from "bklit-tanstack-charts";
import type { FeatureCollection, Geometry } from "geojson";

// Color each region by value with getFeatureColor, and show the value in the tooltip.
const values: Record<string, number> = { France: 120, Brazil: 80, India: 200 };

export function WorldMap({ countries }: { countries: FeatureCollection<Geometry, { name: string }> }) {
  return (
    <ChoroplethChart data={countries}>
      <ChoroplethFeatureComponent
        fill="var(--chart-scale-01)"
        getFeatureColor={(feature) => ((values[feature.properties?.name ?? ""] ?? 0) > 100 ? "var(--chart-scale-05)" : "var(--chart-scale-03)")}
      />
      <ChoroplethTooltip
        getFeatureValue={(feature) => values[feature.properties?.name ?? ""]}
        valueLabel="Users"
      />
    </ChoroplethChart>
  );
}
`,
  api: [
    {
      name: "ChoroplethChart",
      description: "The root. Takes a GeoJSON FeatureCollection and projects it to fit.",
      props: [
        { name: "data", type: "FeatureCollection<Geometry, { name?: string }>", description: "GeoJSON regions. properties.name is shown in the tooltip." },
        { name: "aspectRatio", type: "string", default: '"16 / 9"', description: "CSS aspect ratio of the chart." },
        { name: "zoomEnabled", type: "boolean", default: "false", description: "Pan by dragging and zoom with the wheel or pinch." },
        { name: "zoomMin", type: "number", default: "0.5", description: "Smallest zoom scale." },
        { name: "zoomMax", type: "number", default: "4", description: "Largest zoom scale." },
        { name: "initialZoom", type: "TransformMatrix", description: "Starting zoom and pan." },
        { name: "center", type: "[number, number]", default: "[0, 20]", description: "[longitude, latitude] at the center of the map." },
        { name: "scale", type: "number", description: "Projection scale. By default the map fits the chart." },
        { name: "translate", type: "[number, number]", description: "Projection offset in px." },
        { name: "animationDuration", type: "number", default: "800", description: "Reveal duration in ms." },
        { name: "margin", type: "Partial<Margin>", default: "{ top: 0, right: 0, bottom: 0, left: 0 }", description: "Space around the map." },
        { name: "revealSignature", type: "string", description: "Changing it plays the reveal again." },
        { name: "className", type: "string", description: "Class on the chart container." },
      ],
    },
    {
      name: "ChoroplethFeatureComponent",
      description: "Styles the regions.",
      props: [
        { name: "fill", type: "string", description: "Fill for every region." },
        { name: "getFeatureColor", type: "(feature, index) => string", description: "Fill per region. Replaces fill." },
        { name: "stroke", type: "string", default: "var(--background)", description: "Border color." },
        { name: "strokeWidth", type: "number", default: "0.5", description: "Border width." },
        { name: "fadedOpacity", type: "number", default: "0.4", description: "Opacity of the other regions while one is hovered." },
        { name: "patterns", type: "ReactNode", description: "SVG pattern definitions that getFeaturePattern can refer to." },
        { name: "getFeaturePattern", type: "(feature, index) => string | null | undefined", description: "Id of a pattern to fill a region with." },
      ],
    },
    {
      name: "ChoroplethTooltip",
      props: [
        { name: "getFeatureName", type: "(feature, index) => string", description: "Title of the tooltip. Defaults to properties.name." },
        { name: "getFeatureValue", type: "(feature, index) => number | undefined", description: "Value row in the tooltip. No row when undefined." },
        { name: "valueLabel", type: "string", default: '"Value"', description: "Label of the value row." },
        { name: "formatValue", type: "(value: number) => string", description: "Value formatter. Defaults to a grouped integer." },
        { name: "content", type: "(props) => ReactNode", description: "Replaces the box content." },
      ],
    },
    {
      name: "ChoroplethGraticule",
      description: "Optional latitude and longitude lines under the regions.",
      props: [
        { name: "step", type: "[number, number]", description: "Degrees between lines, [longitude, latitude]." },
        { name: "stroke", type: "string", default: "rgba(255,255,255,0.1)", description: "Line color." },
        { name: "strokeWidth", type: "number", default: "0.5", description: "Line width." },
      ],
    },
  ],
};
