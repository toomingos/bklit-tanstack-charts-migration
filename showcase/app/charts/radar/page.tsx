"use client";
import { ChartDetailPage } from "@/components/chart-detail";
import { doc } from "@/lib/chart-docs/radar";
export default function Page() { return <ChartDetailPage route="radar" doc={doc} />; }
