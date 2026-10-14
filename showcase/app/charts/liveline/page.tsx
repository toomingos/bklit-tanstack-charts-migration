"use client";

import { ChartDetailPage } from "@/components/chart-detail";
import { doc } from "@/lib/chart-docs/liveline";

export default function LiveLineChartPage() {
  return <ChartDetailPage route="liveline" doc={doc} />;
}
