"use client";

import { ChartDetailPage } from "@/components/chart-detail";
import { doc } from "@/lib/chart-docs/bar";

export default function BarChartPage() {
  return <ChartDetailPage route="bar" doc={doc} />;
}
