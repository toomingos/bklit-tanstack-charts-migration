"use client";

// P4.3 resize lab (executor tool; companion to research/phase-4/tools/).
// Fluid-mode (NO `size` prop) pie/ring/radar mounts — the ONLY surface in
// either app that exercises the 10ms measurement debounce window, since
// every bench scenario and showcase demo passes a fixed size. Probed by
// research/phase-4/tools/temp-resize-probe.mjs across viewport resizes.
import * as BklitCharts from "@showcase/bklit-charts";
import * as MigratedCharts from "@showcase/migrated-charts";
import { pieDocsData, radarDocsData, radarDocsMetrics, ringDocsData } from "@/lib/docs-data";

type Impl = "bklit" | "migrated";

function RingLab({ impl }: { impl: Impl }) {
  const Charts = impl === "bklit" ? BklitCharts : MigratedCharts;
  return (
    <div className="w-full aspect-square">
      <Charts.RingChart data={ringDocsData}>
        {ringDocsData.map((item, i) => (
          <Charts.Ring index={i} key={item.label} />
        ))}
        <Charts.RingCenter defaultLabel="Total Sessions" />
      </Charts.RingChart>
    </div>
  );
}

function PieLab({ impl }: { impl: Impl }) {
  const Charts = impl === "bklit" ? BklitCharts : MigratedCharts;
  return (
    <div className="w-full aspect-square">
      <Charts.PieChart data={pieDocsData}>
        {pieDocsData.map((item, i) => (
          <Charts.PieSlice index={i} key={item.label} />
        ))}
      </Charts.PieChart>
    </div>
  );
}

function RadarLab({ impl }: { impl: Impl }) {
  const Charts = impl === "bklit" ? BklitCharts : MigratedCharts;
  return (
    <div className="w-full aspect-square">
      <Charts.RadarChart data={radarDocsData} metrics={radarDocsMetrics}>
        <Charts.RadarGrid />
        <Charts.RadarAxis />
        <Charts.RadarLabels />
        {radarDocsData.map((item, index) => (
          <Charts.RadarArea index={index} key={item.label} />
        ))}
      </Charts.RadarChart>
    </div>
  );
}

const SECTIONS: Array<[string, (props: { impl: Impl }) => React.ReactElement]> = [
  ["pie", PieLab],
  ["radar", RadarLab],
  ["ring", RingLab],
];

export default function ResizeLabPage() {
  return (
    <main className="mx-auto max-w-5xl space-y-10 p-8">
      {(["bklit", "migrated"] as const).map((impl) => (
        <section key={impl} className="space-y-6">
          <h1 className="text-xl font-semibold">{impl} resize lab</h1>
          {SECTIONS.map(([name, Lab]) => (
            <div
              key={name}
              data-resize-lab={`${impl}:${name}`}
              style={{ width: "100%", maxWidth: 640 }}
            >
              <Lab impl={impl} />
            </div>
          ))}
        </section>
      ))}
    </main>
  );
}
