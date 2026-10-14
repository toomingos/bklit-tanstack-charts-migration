"use client";

import { ChartDetailPage } from "@/components/chart-detail";
import { doc } from "@/lib/chart-docs/brush";

export default function BrushChartPage() {
  return <ChartDetailPage route="brush" doc={doc} />;
}
