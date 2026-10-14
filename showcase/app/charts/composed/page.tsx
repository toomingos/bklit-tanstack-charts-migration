"use client";
import { ChartDetailPage } from "@/components/chart-detail";
import { doc } from "@/lib/chart-docs/composed";
export default function Page() { return <ChartDetailPage route="composed" doc={doc} />; }
