"use client";

import { ChartDetailPage } from "@/components/chart-detail";
import { doc } from "@/lib/chart-docs/scatter";

export default function ScatterChartPage() {
  return <ChartDetailPage route="scatter" doc={doc} />;
}
