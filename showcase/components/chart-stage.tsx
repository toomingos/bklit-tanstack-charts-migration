"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";

// Lazy-loaded unified demo components — one per chart, 16 total.
// ssr: false — chart demos are client-only (DOM measurement, WAAPI, canvas).
const AreaDemo = dynamic(() => import("./demos/area"), { ssr: false });
const BarDemo = dynamic(() => import("./demos/bar"), { ssr: false });
const CandlestickDemo = dynamic(() => import("./demos/candlestick"), { ssr: false });
const ChoroplethDemo = dynamic(() => import("./demos/choropleth"), { ssr: false });
const ComposedDemo = dynamic(() => import("./demos/composed"), { ssr: false });
const FunnelDemo = dynamic(() => import("./demos/funnel"), { ssr: false });
const GaugeDemo = dynamic(() => import("./demos/gauge"), { ssr: false });
const HeatmapDemo = dynamic(() => import("./demos/heatmap"), { ssr: false });
const LineDemo = dynamic(() => import("./demos/line"), { ssr: false });
const LivelineDemo = dynamic(() => import("./demos/liveline"), { ssr: false });
const PieDemo = dynamic(() => import("./demos/pie"), { ssr: false });
const RadarDemo = dynamic(() => import("./demos/radar"), { ssr: false });
const RingDemo = dynamic(() => import("./demos/ring"), { ssr: false });
const SankeyDemo = dynamic(() => import("./demos/sankey"), { ssr: false });
const ScatterDemo = dynamic(() => import("./demos/scatter"), { ssr: false });
const SunburstDemo = dynamic(() => import("./demos/sunburst"), { ssr: false });

type DemoComponent = ComponentType<{ impl: "bklit" | "migrated"; n: number }>;

const registry: Record<string, DemoComponent> = {
  area: AreaDemo,
  bar: BarDemo,
  candlestick: CandlestickDemo,
  choropleth: ChoroplethDemo,
  composed: ComposedDemo,
  funnel: FunnelDemo,
  gauge: GaugeDemo,
  heatmap: HeatmapDemo,
  line: LineDemo,
  liveline: LivelineDemo,
  pie: PieDemo,
  radar: RadarDemo,
  ring: RingDemo,
  sankey: SankeyDemo,
  scatter: ScatterDemo,
  sunburst: SunburstDemo,
};

interface ChartStageProps {
  impl: "bklit" | "migrated";
  chart: string;
  n: number;
}

export function ChartStage({ impl, chart, n }: ChartStageProps) {
  const Demo = registry[chart];
  if (!Demo) return null;
  return (
    <div className="w-full">
      <Demo impl={impl} n={n} />
    </div>
  );
}
