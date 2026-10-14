"use client";

import { ChartDetailPage } from "@/components/chart-detail";
import { doc } from "@/lib/chart-docs/barsquares";

export default function BarSquaresChartPage() {
  return <ChartDetailPage route="barsquares" doc={doc} />;
}
