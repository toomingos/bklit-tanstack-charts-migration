"use client";

import { ChartDetailPage } from "@/components/chart-detail";
import { doc } from "@/lib/chart-docs/composition";

export default function CompositionChartPage() {
  return <ChartDetailPage route="composition" doc={doc} />;
}
