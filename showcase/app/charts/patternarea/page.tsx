"use client";

import { ChartDetailPage } from "@/components/chart-detail";
import { doc } from "@/lib/chart-docs/patternarea";

export default function PatternAreaChartPage() {
  return <ChartDetailPage route="patternarea" doc={doc} />;
}
