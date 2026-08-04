"use client";

import { ChartStage } from "@/components/chart-stage";

interface ChartPreviewProps {
  impl: "bklit" | "migrated";
  chart: string;
  n: number;
}

const implLabel: Record<ChartPreviewProps["impl"], string> = {
  bklit: "bklit-ui original",
  migrated: "migrated",
};

export function ChartPreview({ impl, chart, n }: ChartPreviewProps) {
  return (
    <div className="w-full">
      <div className="mb-1.5 text-xs font-medium text-muted-foreground">
        {implLabel[impl]}
      </div>
      <div className="relative w-full rounded-lg border border-border overflow-hidden bg-background">
        <ChartStage impl={impl} chart={chart} n={n} />
      </div>
    </div>
  );
}
