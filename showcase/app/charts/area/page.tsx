"use client";

import { ChartDetailPage } from "@/components/chart-detail";
import { doc } from "@/lib/chart-docs/area";

export default function AreaChartPage() {
  return <ChartDetailPage route="area" doc={doc} />;
}
