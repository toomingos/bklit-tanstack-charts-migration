"use client";
import { ChartDetailPage } from "@/components/chart-detail";
import { doc } from "@/lib/chart-docs/gauge";
export default function Page() { return <ChartDetailPage route="gauge" doc={doc} />; }
