"use client";
import { ChartDetailPage } from "@/components/chart-detail";
import { doc } from "@/lib/chart-docs/funnel";
export default function Page() { return <ChartDetailPage route="funnel" doc={doc} />; }
