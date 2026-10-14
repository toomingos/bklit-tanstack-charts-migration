"use client";

import { useSyncExternalStore } from "react";
import { ChartStage } from "@/components/chart-stage";
import { PHONE_WIDTH, type DemoControls, type StageWidth } from "@/components/demo-controls";
import { PerfProbe } from "@/components/live-perf/perf-probe";
import { perfStore } from "@/components/live-perf/collector";

interface ChartPreviewProps {
  impl: "bklit" | "migrated";
  chart: string;
  n: number;
  controls: DemoControls;
  width: StageWidth;
}

const implLabel: Record<ChartPreviewProps["impl"], string> = {
  bklit: "Bklit UI",
  migrated: "Bklit TanStack Charts",
};

export function ChartPreview({ impl, chart, n, controls, width }: ChartPreviewProps) {
  const run = useSyncExternalStore(perfStore.subscribe, () => perfStore.getRun(chart), () => 0);
  return (
    <div className="w-full">
      <div className="mb-1.5 text-xs font-medium text-muted-foreground">
        {implLabel[impl]}
      </div>
      <div
        className="relative w-full rounded-lg border border-border overflow-hidden bg-background"
        // content-box so the chart container is exactly PHONE_WIDTH, borders outside it.
        style={width === "phone" ? { boxSizing: "content-box", width: PHONE_WIDTH } : undefined}
      >
        <PerfProbe key={run} impl={impl} chart={chart}>
          <ChartStage impl={impl} chart={chart} n={n} controls={controls} />
        </PerfProbe>
      </div>
    </div>
  );
}
