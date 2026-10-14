"use client";
import { ChartDetailPage } from "@/components/chart-detail";
import { doc } from "@/lib/chart-docs/sunburst";
export default function Page() { return <ChartDetailPage route="sunburst" doc={doc} />; }
