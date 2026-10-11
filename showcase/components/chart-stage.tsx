"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { DemoControls } from "@/components/demo-controls";
import { timedImport } from "@/components/live-perf/collector";

// Lazy-loaded unified demo components — one per chart, 16 total.
// ssr: false — chart demos are client-only (DOM measurement, WAAPI, canvas).
const AreaDemo = dynamic(timedImport("area", () => import("./demos/area")), { ssr: false });
const BarDemo = dynamic(timedImport("bar", () => import("./demos/bar")), { ssr: false });
const BarDepthDemo = dynamic(timedImport("bardepth", () => import("./demos/bardepth")), { ssr: false });
const BarSquaresDemo = dynamic(timedImport("barsquares", () => import("./demos/barsquares")), { ssr: false });
const BrushDemo = dynamic(timedImport("brush", () => import("./demos/brush")), { ssr: false });
const CandlestickDemo = dynamic(timedImport("candlestick", () => import("./demos/candlestick")), { ssr: false });
const ChoroplethDemo = dynamic(timedImport("choropleth", () => import("./demos/choropleth")), { ssr: false });
const ComposedDemo = dynamic(timedImport("composed", () => import("./demos/composed")), { ssr: false });
const FunnelDemo = dynamic(timedImport("funnel", () => import("./demos/funnel")), { ssr: false });
const GaugeDemo = dynamic(timedImport("gauge", () => import("./demos/gauge")), { ssr: false });
const HeatmapDemo = dynamic(timedImport("heatmap", () => import("./demos/heatmap")), { ssr: false });
const LineDemo = dynamic(timedImport("line", () => import("./demos/line")), { ssr: false });
const LivelineDemo = dynamic(timedImport("liveline", () => import("./demos/liveline")), { ssr: false });
const MarkersDemo = dynamic(timedImport("markers", () => import("./demos/markers")), { ssr: false });
const PatternAreaDemo = dynamic(timedImport("patternarea", () => import("./demos/patternarea")), { ssr: false });
const PieDemo = dynamic(timedImport("pie", () => import("./demos/pie")), { ssr: false });
const ProjectionDemo = dynamic(timedImport("projection", () => import("./demos/projection")), { ssr: false });
const RadarDemo = dynamic(timedImport("radar", () => import("./demos/radar")), { ssr: false });
const ReferenceAreaDemo = dynamic(timedImport("reference-area", () => import("./demos/reference-area")), { ssr: false });
const RingDemo = dynamic(timedImport("ring", () => import("./demos/ring")), { ssr: false });
const SankeyDemo = dynamic(timedImport("sankey", () => import("./demos/sankey")), { ssr: false });
const ScatterDemo = dynamic(timedImport("scatter", () => import("./demos/scatter")), { ssr: false });
const SegmentDemo = dynamic(timedImport("segment", () => import("./demos/segment")), { ssr: false });
const SunburstDemo = dynamic(timedImport("sunburst", () => import("./demos/sunburst")), { ssr: false });

// `controls` is optional so demos without a loading surface need not declare it.
type DemoComponent = ComponentType<{ impl: "bklit" | "migrated"; n: number; controls?: DemoControls }>;

const registry: Record<string, DemoComponent> = {
  area: AreaDemo,
  bar: BarDemo,
  bardepth: BarDepthDemo,
  barsquares: BarSquaresDemo,
  brush: BrushDemo,
  candlestick: CandlestickDemo,
  choropleth: ChoroplethDemo,
  composed: ComposedDemo,
  funnel: FunnelDemo,
  gauge: GaugeDemo,
  heatmap: HeatmapDemo,
  line: LineDemo,
  liveline: LivelineDemo,
  markers: MarkersDemo,
  patternarea: PatternAreaDemo,
  pie: PieDemo,
  projection: ProjectionDemo,
  radar: RadarDemo,
  "reference-area": ReferenceAreaDemo,
  ring: RingDemo,
  sankey: SankeyDemo,
  scatter: ScatterDemo,
  segment: SegmentDemo,
  sunburst: SunburstDemo,
};

// Height each demo settles at, as a function of the card's content width (percent padding resolves against it), so the server
// render reserves the card before the client-only demo chunk loads and the chart measures itself: no layout shift when it arrives.
// Taken from each demo's own layout (aspectRatio, fixed heights, legend columns) and checked against the rendered card heights at
// viewport widths 360-1440; bklit and migrated settle at the same height. A demo that changes its layout must update its entry.
const ASPECT_2_1 = "50%";
const reserve: Record<string, string> = {
  area: ASPECT_2_1,
  bar: ASPECT_2_1,
  bardepth: ASPECT_2_1,
  // 2/1 chart beside a 200px legend column (gap 32); the legend's own height is the floor.
  barsquares: "max(calc(50% - 116px), 104px)",
  brush: "360px",
  candlestick: "320px",
  choropleth: "56.25%",
  composed: ASPECT_2_1,
  funnel: "calc(100% / 2.2)",
  // max-w-lg / min-w-[300px] column: gauge, linear track and label rows.
  gauge: "calc(clamp(300px, 100%, 512px) * 16 / 21 + 262px)",
  // Fluid layout: 7 rows over 26 columns plus the legend row.
  heatmap: "calc(100% * 7 / 26 + 40.9px)",
  line: ASPECT_2_1,
  liveline: "260px",
  markers: "max(calc(50% - 116px), 104px)",
  patternarea: ASPECT_2_1,
  pie: "280px",
  projection: ASPECT_2_1,
  radar: "400px",
  "reference-area": ASPECT_2_1,
  ring: "320px",
  sankey: "56.25%",
  scatter: ASPECT_2_1,
  // Value header (72px) above a 2/1 chart.
  segment: "calc(50% + 72px)",
  sunburst: "472px",
};

interface ChartStageProps {
  impl: "bklit" | "migrated";
  chart: string;
  n: number;
  controls: DemoControls;
}

export function ChartStage({ impl, chart, n, controls }: ChartStageProps) {
  const Demo = registry[chart];
  if (!Demo) return null;
  // The spacer and the demo share one grid cell, so the cell is never shorter than the reserve.
  return (
    <div className="grid w-full">
      <div aria-hidden="true" style={{ gridArea: "1 / 1", paddingTop: reserve[chart] }} />
      <div className="w-full min-w-0" style={{ gridArea: "1 / 1" }}>
        <Demo impl={impl} n={n} controls={controls} />
      </div>
    </div>
  );
}
