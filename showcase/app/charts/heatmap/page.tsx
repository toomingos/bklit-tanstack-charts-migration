"use client";
import { ChartDetailPage } from "@/components/chart-detail";
import { doc } from "@/lib/chart-docs/heatmap";
export default function Page() { return <ChartDetailPage route="heatmap" doc={doc} />; }
