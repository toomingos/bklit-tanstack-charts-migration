"use client";

import { ChartDetailPage } from "@/components/chart-detail";
import { doc } from "@/lib/chart-docs/line";

export default function LineChartPage() {
  return <ChartDetailPage route="line" doc={doc} />;
}
