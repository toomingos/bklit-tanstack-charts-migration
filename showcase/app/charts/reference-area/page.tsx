"use client";

import { ChartDetailPage } from "@/components/chart-detail";
import { doc } from "@/lib/chart-docs/reference-area";

export default function ReferenceAreaChartPage() {
  return <ChartDetailPage route="reference-area" doc={doc} />;
}
