"use client";

import type { ImplCharts } from "./impl-charts";
import { gaugeDocsProps } from "@/lib/docs-data";

interface GaugeDemoProps {
  impl: "bklit" | "migrated";
  charts: ImplCharts;
  n: number;
}

export default function GaugeDemo({ impl, charts, n: _n }: GaugeDemoProps) {
  const Charts = charts;

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
      <div className="mt-6 flex w-full items-center py-6" data-gauge-linear="track">
        <Charts.Gauge
          inactiveFillOpacity={0.4}
          notchCornerRadius={3}
          notchLengthPercent={38}
          orientation="linear"
          spacing={0}
          totalNotches={72}
          useGradient
          value={72}
        />
      </div>
      <div className="flex w-full items-center py-6" data-gauge-linear="label">
        <Charts.Gauge
          centerValue={gaugeDocsProps.centerValue}
          defaultLabel={gaugeDocsProps.defaultLabel}
          formatOptions={gaugeDocsProps.formatOptions}
          inactiveFillOpacity={0.4}
          labelAlign="center"
          labelPlacement="bottom"
          notchCornerRadius={3}
          orientation="linear"
          spacing={0}
          totalNotches={72}
          useGradient
          value={72}
        />
      </div>
    </div>
  );
}
