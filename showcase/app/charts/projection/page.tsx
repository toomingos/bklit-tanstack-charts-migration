"use client";

import { ChartDetailPage } from "@/components/chart-detail";
import { doc } from "@/lib/chart-docs/projection";

export default function ProjectionChartPage() {
  return <ChartDetailPage route="projection" doc={doc} />;
}
