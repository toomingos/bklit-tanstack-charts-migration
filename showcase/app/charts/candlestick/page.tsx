"use client";

import { ChartDetailPage } from "@/components/chart-detail";
import { doc } from "@/lib/chart-docs/candlestick";

export default function CandlestickChartPage() {
  return <ChartDetailPage route="candlestick" doc={doc} />;
}
