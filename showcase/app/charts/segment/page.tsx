"use client";

import { ChartDetailPage } from "@/components/chart-detail";
import { doc } from "@/lib/chart-docs/segment";

export default function SegmentChartPage() {
  return <ChartDetailPage route="segment" doc={doc} />;
}
