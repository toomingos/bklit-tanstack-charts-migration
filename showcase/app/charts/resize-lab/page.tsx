"use client";

// Fluid-mode pie, ring and radar mounts (no `size` prop) for checking resize behaviour.
import * as BklitCharts from "@showcase/bklit-charts";
import * as MigratedCharts from "@showcase/migrated-charts";
import { useSyncExternalStore, type ReactNode } from "react";
import { LivePerfPanel } from "@/components/live-perf/live-perf-panel";
import { PerfProbe } from "@/components/live-perf/perf-probe";
import { perfStore } from "@/components/live-perf/collector";
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

function Probed({ impl, name, children }: { impl: Impl; name: string; children: ReactNode }) {
  const chart = `resize-lab-${name}`;
  const run = useSyncExternalStore(perfStore.subscribe, () => perfStore.getRun(chart), () => 0);
  return (
    <PerfProbe key={run} impl={impl} chart={chart}>
      {children}
    </PerfProbe>
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
          <h1 className="text-xl font-semibold">{impl === "bklit" ? "Bklit UI" : "Bklit TanStack Charts"}</h1>
          {SECTIONS.map(([name, Lab]) => (
            <div
              key={name}
              data-resize-lab={`${impl}:${name}`}
              style={{ width: "100%", maxWidth: 640 }}
            >
              <Probed impl={impl} name={name}>
                <Lab impl={impl} />
              </Probed>
            </div>
          ))}
        </section>
      ))}
      <section className="space-y-6">
        <h1 className="text-xl font-semibold">Live performance</h1>
        {SECTIONS.map(([name]) => (
          <div key={name}>
            <h2 className="mb-2 text-sm font-medium">{name}</h2>
            <LivePerfPanel chart={`resize-lab-${name}`} />
          </div>
        ))}
      </section>
    </main>
  );
}
