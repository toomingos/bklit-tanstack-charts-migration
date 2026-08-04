"use client";

import * as BklitCharts from "@showcase/bklit-charts";
import * as MigratedCharts from "@showcase/migrated-charts";
import { gaugeDocsProps } from "@/lib/docs-data";

interface GaugeDemoProps {
  impl: "bklit" | "migrated";
  n: number;
}

export default function GaugeDemo({ impl, n: _n }: GaugeDemoProps) {
  const Charts = impl === "bklit" ? BklitCharts : MigratedCharts;

  return (
    <div className="mx-auto w-full min-w-[300px] max-w-lg py-4">
      <Charts.Gauge
        centerValue={gaugeDocsProps.centerValue}
        defaultLabel={gaugeDocsProps.defaultLabel}
        formatOptions={gaugeDocsProps.formatOptions}
        inactiveFillOpacity={gaugeDocsProps.inactiveFillOpacity}
        spacing={gaugeDocsProps.spacing}
        value={gaugeDocsProps.value}
      />
    </div>
  );
}
