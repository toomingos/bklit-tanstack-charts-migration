"use client";

import { ChartDetailPage } from "@/components/chart-detail";
import { doc } from "@/lib/chart-docs/markers";

export default function MarkersChartPage() {
  return <ChartDetailPage route="markers" doc={doc} />;
}
