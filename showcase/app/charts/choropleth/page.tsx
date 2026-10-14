"use client";
import { ChartDetailPage } from "@/components/chart-detail";
import { doc } from "@/lib/chart-docs/choropleth";
export default function Page() { return <ChartDetailPage route="choropleth" doc={doc} />; }
