"use client";

import { ChartDetailPage } from "@/components/chart-detail";
import { doc } from "@/lib/chart-docs/bardepth";

export default function BarDepthChartPage() {
  return <ChartDetailPage route="bardepth" doc={doc} />;
}
