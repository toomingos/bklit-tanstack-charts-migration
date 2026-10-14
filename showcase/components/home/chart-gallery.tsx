"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChartStage } from "@/components/chart-stage";
import { defaultDemoControls } from "@/components/demo-controls";
import { allCharts, chartCategories, type ChartInfo } from "@/lib/chart-data";
import { cn } from "@/lib/utils";

type CategoryId = (typeof chartCategories)[number]["id"];

/** Gallery order: neighbours on a row settle at similar heights, so neither card is mostly empty. */
const galleryOrder: Record<CategoryId, readonly string[]> = {
  components: [
    "area", "line", "composed", "bar", "bardepth", "barsquares", "patternarea", "scatter", "candlestick",
    "radar", "ring", "pie", "liveline", "heatmap", "gauge", "sunburst", "funnel", "choropleth", "sankey",
  ],
  utility: ["reference-area", "projection", "brush", "segment", "markers", "composition"],
};

/** Full-row charts: wide layouts, a legend column beside the plot, or labels that collide at half width. */
const wide = new Set(["composed", "barsquares", "candlestick", "heatmap", "funnel", "choropleth", "sankey", "markers", "composition"]);

/** Composition stacks two 2/1 charts: at full width it is taller than a screen, so its stage is capped and centred. */
const stageWidth: Record<string, string> = { composition: "mx-auto max-w-3xl" };

/** One live Bklit TanStack Charts chart; it mounts when it nears the viewport, so each entrance plays where it is seen. */
function GalleryTile({ chart, full }: { chart: ChartInfo; full: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <article className={cn("flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-background", full && "md:col-span-2")}>
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h3 className="font-medium text-sm">{chart.name}</h3>
        <Link
          className="group/link inline-flex items-center gap-1 text-muted-foreground text-xs no-underline transition-colors hover:text-foreground"
          href={`/charts/${chart.route}`}
        >
          Code and docs
          <span aria-hidden="true" className="transition-transform group-hover/link:translate-x-0.5">
            →
          </span>
        </Link>
      </header>
      {/* Rows stretch to the taller tile; the shorter chart sits centred in its card. */}
      <div className="flex flex-1 items-center p-3" ref={ref}>
        <div className={cn("w-full", stageWidth[chart.route])}>
          <ChartStage chart={chart.route} controls={defaultDemoControls} deferred={!inView} impl="migrated" n={chart.defaultN} />
        </div>
      </div>
    </article>
  );
}

export function ChartGallery() {
  return (
    <div className="space-y-16">
      {chartCategories.map((category) => (
        <section aria-labelledby={`gallery-${category.id}`} key={category.id}>
          <div className="mb-6 flex items-baseline justify-between gap-4">
            <h2 className="font-semibold text-lg tracking-tight" id={`gallery-${category.id}`}>
              {category.label}
            </h2>
            <span className="text-muted-foreground text-sm tabular-nums">{category.order.length}</span>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {galleryOrder[category.id].map((route) => {
              const chart = allCharts.find((c) => c.route === route);
              return chart ? <GalleryTile chart={chart} full={wide.has(route)} key={route} /> : null;
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
