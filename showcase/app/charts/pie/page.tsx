"use client";
import { ChartDetailPage } from "@/components/chart-detail";
import { doc } from "@/lib/chart-docs/pie";
export default function Page() { return <ChartDetailPage route="pie" doc={doc} />; }
