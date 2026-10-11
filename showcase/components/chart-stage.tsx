"use client";

import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import type { DemoControls } from "@/components/demo-controls";
import type { ImplCharts } from "@/components/demos/impl-charts";
import { timedImport } from "@/components/live-perf/collector";

const migratedEntries: Record<string, () => Promise<object>> = {
  area: () => import("./demos/migrated-entries/area"),
  bar: () => import("./demos/migrated-entries/bar"),
  bardepth: () => import("./demos/migrated-entries/bardepth"),
  barsquares: () => import("./demos/migrated-entries/barsquares"),
  brush: () => import("./demos/migrated-entries/brush"),
  candlestick: () => import("./demos/migrated-entries/candlestick"),
  choropleth: () => import("./demos/migrated-entries/choropleth"),
  composed: () => import("./demos/migrated-entries/composed"),
  composition: () => import("./demos/migrated-entries/composition"),
  funnel: () => import("./demos/migrated-entries/funnel"),
  gauge: () => import("./demos/migrated-entries/gauge"),
  heatmap: () => import("./demos/migrated-entries/heatmap"),
  line: () => import("./demos/migrated-entries/line"),
  liveline: () => import("./demos/migrated-entries/liveline"),
  markers: () => import("./demos/migrated-entries/markers"),
  patternarea: () => import("./demos/migrated-entries/patternarea"),
  pie: () => import("./demos/migrated-entries/pie"),
  projection: () => import("./demos/migrated-entries/projection"),
  radar: () => import("./demos/migrated-entries/radar"),
  "reference-area": () => import("./demos/migrated-entries/reference-area"),
  ring: () => import("./demos/migrated-entries/ring"),
  sankey: () => import("./demos/migrated-entries/sankey"),
  scatter: () => import("./demos/migrated-entries/scatter"),
  segment: () => import("./demos/migrated-entries/segment"),
  sunburst: () => import("./demos/migrated-entries/sunburst"),
};

const bklitEntries: Record<string, () => Promise<object>> = {
  area: () => import("./demos/bklit-entries/area"),
  bar: () => import("./demos/bklit-entries/bar"),
  bardepth: () => import("./demos/bklit-entries/bardepth"),
  barsquares: () => import("./demos/bklit-entries/barsquares"),
  brush: () => import("./demos/bklit-entries/brush"),
  candlestick: () => import("./demos/bklit-entries/candlestick"),
  choropleth: () => import("./demos/bklit-entries/choropleth"),
  composed: () => import("./demos/bklit-entries/composed"),
  composition: () => import("./demos/bklit-entries/composition"),
  funnel: () => import("./demos/bklit-entries/funnel"),
  gauge: () => import("./demos/bklit-entries/gauge"),
  heatmap: () => import("./demos/bklit-entries/heatmap"),
  line: () => import("./demos/bklit-entries/line"),
  liveline: () => import("./demos/bklit-entries/liveline"),
  markers: () => import("./demos/bklit-entries/markers"),
  patternarea: () => import("./demos/bklit-entries/patternarea"),
  pie: () => import("./demos/bklit-entries/pie"),
  projection: () => import("./demos/bklit-entries/projection"),
  radar: () => import("./demos/bklit-entries/radar"),
  "reference-area": () => import("./demos/bklit-entries/reference-area"),
  ring: () => import("./demos/bklit-entries/ring"),
  sankey: () => import("./demos/bklit-entries/sankey"),
  scatter: () => import("./demos/bklit-entries/scatter"),
  segment: () => import("./demos/bklit-entries/segment"),
  sunburst: () => import("./demos/bklit-entries/sunburst"),
};

type Impl = "bklit" | "migrated";
interface DemoProps { impl: Impl; n: number; controls?: DemoControls }
type DemoModule = { default: ComponentType<DemoProps & { charts: ImplCharts }> };

// Each side loads a per-chart entry (demos/{bklit,migrated}-entries/<chart>.ts: the exports that demo uses), so webpack drops the rest of its barrel from the card's chunks.
// Each card loads only its own implementation's chart module next to the demo chunk, so a card never waits on (or ships) the other library.
const loadCharts: Record<Impl, (chart: string) => Promise<ImplCharts>> = {
  bklit: (chart) => bklitEntries[chart]() as Promise<ImplCharts>,
  migrated: (chart) => migratedEntries[chart]() as Promise<ImplCharts>,
};

// Client-only lazy component without Suspense: a revealed Suspense fallback holds the content back for 300ms (React's fallback throttle) even when the chunk is cached.
function clientOnly(load: () => Promise<{ default: ComponentType<DemoProps> }>): ComponentType<DemoProps> {
  let loaded: ComponentType<DemoProps> | null = null;
  let pending: Promise<void> | null = null;
  const start = (): Promise<void> => (pending ??= load().then((m) => { loaded = m.default; }));
  return function ClientOnly(props: DemoProps) {
    const [Demo, setDemo] = useState<ComponentType<DemoProps> | null>(() => loaded);
    useEffect(() => {
      if (loaded) { setDemo(() => loaded); return; }
      let live = true;
      void start().then(() => { if (live) { setDemo(() => loaded); } });
      return () => { live = false; };
    }, []);
    return Demo ? <Demo {...props} /> : null;
  };
}

function lazyDemo(chart: string, load: () => Promise<DemoModule>): Record<Impl, ComponentType<DemoProps>> {
  const make = (impl: Impl) =>
    clientOnly(
      timedImport(chart, async () => {
        const [demo, charts] = await Promise.all([load(), loadCharts[impl](chart)]);
        const Demo = demo.default;
        return { default: (props: DemoProps) => <Demo {...props} charts={charts} /> };
      }),
    );
  return { bklit: make("bklit"), migrated: make("migrated") };
}

// Lazy-loaded unified demo components — one per chart, 16 total.
// ssr: false — chart demos are client-only (DOM measurement, WAAPI, canvas).
const AreaDemo = lazyDemo("area", () => import("./demos/area"));
const BarDemo = lazyDemo("bar", () => import("./demos/bar"));
const BarDepthDemo = lazyDemo("bardepth", () => import("./demos/bardepth"));
const BarSquaresDemo = lazyDemo("barsquares", () => import("./demos/barsquares"));
const BrushDemo = lazyDemo("brush", () => import("./demos/brush"));
const CandlestickDemo = lazyDemo("candlestick", () => import("./demos/candlestick"));
const ChoroplethDemo = lazyDemo("choropleth", () => import("./demos/choropleth"));
const ComposedDemo = lazyDemo("composed", () => import("./demos/composed"));
const FunnelDemo = lazyDemo("funnel", () => import("./demos/funnel"));
const GaugeDemo = lazyDemo("gauge", () => import("./demos/gauge"));
const HeatmapDemo = lazyDemo("heatmap", () => import("./demos/heatmap"));
const LineDemo = lazyDemo("line", () => import("./demos/line"));
const LivelineDemo = lazyDemo("liveline", () => import("./demos/liveline"));
const MarkersDemo = lazyDemo("markers", () => import("./demos/markers"));
const PatternAreaDemo = lazyDemo("patternarea", () => import("./demos/patternarea"));
const PieDemo = lazyDemo("pie", () => import("./demos/pie"));
const ProjectionDemo = lazyDemo("projection", () => import("./demos/projection"));
const RadarDemo = lazyDemo("radar", () => import("./demos/radar"));
const CompositionDemo = lazyDemo("composition", () => import("./demos/composition"));
const ReferenceAreaDemo = lazyDemo("reference-area", () => import("./demos/reference-area"));
const RingDemo = lazyDemo("ring", () => import("./demos/ring"));
const SankeyDemo = lazyDemo("sankey", () => import("./demos/sankey"));
const ScatterDemo = lazyDemo("scatter", () => import("./demos/scatter"));
const SegmentDemo = lazyDemo("segment", () => import("./demos/segment"));
const SunburstDemo = lazyDemo("sunburst", () => import("./demos/sunburst"));

const registry: Record<string, Record<Impl, ComponentType<DemoProps>>> = {
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
  composition: CompositionDemo,
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
  // Two 2/1 charts and a 24px gap.
  composition: "calc(100% + 24px)",
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
  const Demo = registry[chart]?.[impl];
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
