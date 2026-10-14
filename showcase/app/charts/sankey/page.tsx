"use client";
import { ChartDetailPage } from "@/components/chart-detail";
import { doc } from "@/lib/chart-docs/sankey";
export default function Page() { return <ChartDetailPage route="sankey" doc={doc} />; }
