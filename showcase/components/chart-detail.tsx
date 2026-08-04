"use client";

import { useState, type ReactNode } from "react";
import { allCharts, type ChartInfo } from "@/lib/chart-data";
import { benchmarkData, type ImplMetrics } from "@/lib/benchmark-data";
import { ChartPreview } from "@/components/chart-preview";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Parsing helpers                                                    */
/* ------------------------------------------------------------------ */

function extractDiff(s: string): string {
  const worst = s.match(/worst\s+([\d.]+%)/i);
  if (worst) return worst[1];
  const any = s.match(/([\d.]+%)/g);
  if (!any || any.length === 0) return "—";
  const nums = any.map((v) => parseFloat(v));
  const max = Math.max(...nums);
  return `${max}%`;
}

function fmtMemory(s: string): string {
  if (isWaived(s)) return "waived";
  if (!s || /N\/A/i.test(s)) return "—";
  const pctMatch = s.match(/heap\s*.*?(\d+(?:\.\d+)?)%/i);
  if (pctMatch) return `${pctMatch[1]}% of bklit`;
  const mbMatch = s.match(/heap\s+([\d.]+)\s*vs\s*([\d.]+)\s*MB/i);
  if (mbMatch) {
    const m = parseFloat(mbMatch[1]);
    const b = parseFloat(mbMatch[2]);
    const pct = Math.round((m / b) * 100);
    return `${pct}% of bklit`;
  }
  return s.replace(/^PASS\s*/i, "").trim() || "—";
}

function isWaived(s: string): boolean {
  return /waived/i.test(s) || /WAIVED/i.test(s);
}

function parseDeltaX(s: string): number | null {
  if (!s || s === "N/A") return null;
  const m = s.match(/[−-](\d+)%/);
  if (!m) return null;
  const pct = parseInt(m[1], 10);
  if (pct <= 0 || pct >= 100) return null;
  return 100 / (100 - pct);
}

function fmtSpeed(s: string): string {
  const x = parseDeltaX(s);
  if (x === null) {
    if (/waived/i.test(s)) return "waived";
    return s || "—";
  }
  return `${x >= 10 ? Math.round(x) : x.toFixed(1)}× faster`;
}

/* ------------------------------------------------------------------ */
/*  Benchmark helpers                                                  */
/* ------------------------------------------------------------------ */

type MetricKey = "m1a" | "m1c" | "m2a" | "m2b" | "m3a" | "m3c";

interface MetricDef {
  key: MetricKey;
  label: string;
  unit: string;
}

const METRICS: MetricDef[] = [
  { key: "m1a", label: "First render", unit: "ms" },
  { key: "m1c", label: "Mount scripting", unit: "ms" },
  { key: "m2a", label: "Idle CPU", unit: "ms per 5s" },
  { key: "m2b", label: "Memory", unit: "MB" },
  { key: "m3a", label: "Data update", unit: "ms" },
  { key: "m3c", label: "Hover frame", unit: "ms" },
];

const IMPLS = ["bklit", "migrated", "tanstack"] as const;

function valOrNull(m: ImplMetrics | undefined, key: MetricKey): number | null {
  if (!m) return null;
  const v = m[key];
  if (v === null || v === undefined) return null;
  return v;
}

function speedChip(bklitVal: number | null, migVal: number | null): { text: string; color: "emerald" | "muted" | "amber" } | null {
  if (bklitVal === null || migVal === null) return null;
  if (bklitVal === 0) return null;
  const ratio = bklitVal / migVal;
  const pctDiff = (bklitVal - migVal) / bklitVal;
  if (pctDiff > 0.05) {
    return { text: `${ratio >= 10 ? Math.round(ratio) : ratio.toFixed(1)}× faster`, color: "emerald" };
  }
  if (pctDiff < -0.05) {
    return { text: `${(1 / ratio) >= 10 ? Math.round(1 / ratio) : (1 / ratio).toFixed(1)}× slower`, color: "amber" };
  }
  return { text: "on par", color: "muted" };
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

const statusBadgeClass: Record<ChartInfo["status"], string> = {
  approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  migrating: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  "in research": "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  "not started": "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  blocked: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-1 text-3xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

function DocRefChip({ ref }: { ref: string }) {
  return (
    <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-mono text-muted-foreground">
      {ref}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Stacked line rows                                                   */
/* ------------------------------------------------------------------ */

const LINE_COLORS: Record<string, string> = {
  bklit: "bg-slate-400/70 dark:bg-slate-500/70",
  migrated: "bg-emerald-500/80",
  tanstack: "bg-sky-500/70",
};

const IMPL_LABEL: Record<string, string> = {
  bklit: "bklit",
  migrated: "Migrated",
  tanstack: "TanStack native",
};

function chipFor(impl: string, val: number | null, bklitVal: number | null) {
  if (impl !== "migrated") return null;
  if (bklitVal === null || val === null || bklitVal === 0) return null;
  const ratio = bklitVal / val;
  const pctDiff = (bklitVal - val) / bklitVal;
  if (pctDiff > 0.05) return { text: `${ratio.toFixed(1)}× faster`, color: "emerald" as const };
  if (pctDiff < -0.05) return { text: `${(1 / ratio).toFixed(1)}× slower`, color: "amber" as const };
  return { text: "on par", color: "muted" as const };
}

function StackedLines({
  values,
  maxVal,
  hasAnyMigrated,
}: {
  values: { impl: string; value: number | null }[];
  maxVal: number;
  hasAnyMigrated: boolean;
}) {
  const bklitVal = values.find((v) => v.impl === "bklit")?.value ?? null;

  return (
    <div className="flex flex-col gap-0.5">
      {values.map(({ impl, value }) => {
        if (value === null) {
          return (
            <div key={impl} className="flex items-center gap-2 h-5">
              <span className="w-[100px] flex-shrink-0 text-right text-[11px] text-muted-foreground">
                {IMPL_LABEL[impl]}
              </span>
              <span className="text-[11px] text-muted-foreground/50 italic">not recorded</span>
            </div>
          );
        }

        const pct = maxVal > 0 ? (value / maxVal) * 100 : 0;
        const chip = chipFor(impl, value, bklitVal);

        return (
          <div key={impl} className="flex items-center gap-2 h-5">
            <span className="w-[100px] flex-shrink-0 text-right text-[11px] text-muted-foreground tabular-nums">
              {IMPL_LABEL[impl]}
            </span>
            <div className="flex-1">
              <div className="h-1 rounded-full bg-slate-200 dark:bg-slate-800">
                <div className={cn("h-1 rounded-full", LINE_COLORS[impl])} style={{ width: `${Math.max(pct, 1)}%` }} />
              </div>
            </div>
            <span className="w-[52px] flex-shrink-0 text-right text-sm font-medium tabular-nums">
              {value.toFixed(1)}
            </span>
            {chip && (
              <span className={cn(
                "ml-0.5 rounded px-1 py-0 text-[10px] font-medium",
                chip.color === "emerald" && "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
                chip.color === "amber" && "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
                chip.color === "muted" && "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
              )}>
                {chip.text}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Performance table                                                  */
/* ------------------------------------------------------------------ */

function PerformanceTable({
  route,
  activeTab,
}: {
  route: string;
  activeTab: "average" | number;
}) {
  const bench = benchmarkData[route];
  if (!bench) {
    return (
      <p className="text-sm text-muted-foreground">No benchmark runs recorded yet.</p>
    );
  }

  const sizes = bench.sizes;
  const hasAnyMigrated = sizes.some((n) => bench.bySize[n]?.migrated);

  if (activeTab === "average") {
    return <AverageTable bench={bench} sizes={sizes} hasAnyMigrated={hasAnyMigrated} />;
  }

  const entry = bench.bySize[activeTab];
  if (!entry) {
    return <p className="text-sm text-muted-foreground">No data for n={activeTab}.</p>;
  }

  return <SingleSizeTable entry={entry} hasAnyMigrated={hasAnyMigrated} />;
}

function AverageTable({
  bench,
  sizes,
  hasAnyMigrated,
}: {
  bench: { bySize: Record<number, { bklit?: ImplMetrics; tanstack?: ImplMetrics; migrated?: ImplMetrics }> };
  sizes: number[];
  hasAnyMigrated: boolean;
}) {
  const avgBklit: Partial<Record<MetricKey, number>> = {};
  const avgMig: Partial<Record<MetricKey, number>> = {};
  const avgTs: Partial<Record<MetricKey, number>> = {};

  for (const key of METRICS.map((m) => m.key)) {
    let bSum = 0, bCount = 0, mSum = 0, mCount = 0, tSum = 0, tCount = 0;
    for (const n of sizes) {
      const e = bench.bySize[n];
      const bv = valOrNull(e?.bklit, key);
      const mv = valOrNull(e?.migrated, key);
      const tv = valOrNull(e?.tanstack, key);
      if (bv !== null && mv !== null) {
        bSum += bv; mSum += mv; bCount++; mCount++;
      }
      if (tv !== null) { tSum += tv; tCount++; }
    }
    if (bCount > 0) { avgBklit[key] = bSum / bCount; avgMig[key] = mSum / mCount; }
    if (tCount > 0) { avgTs[key] = tSum / tCount; }
  }

  return (
    <div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Metric
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Comparison
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {METRICS.map((m) => {
            const vals: Record<string, number | null> = {
              bklit: avgBklit[m.key] ?? null,
              migrated: avgMig[m.key] ?? null,
              tanstack: avgTs[m.key] ?? null,
            };
            const maxVal = Math.max(...Object.values(vals).filter((v) => v !== null).map(Number), 1);
            const values = IMPLS.map((impl) => ({ impl, value: vals[impl] }));

            return (
              <tr key={m.key}>
                <td className="px-4 py-3 text-sm font-medium align-top">
                  {m.label}
                  <span className="ml-1 text-xs text-muted-foreground">({m.unit})</span>
                </td>
                <td className="px-4 py-3">
                  <StackedLines values={values} maxVal={maxVal} hasAnyMigrated={hasAnyMigrated} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-muted-foreground">
        Numbers are medians from docs/BENCHMARKS.md (Chromium, 7 measured runs per cell). Lower is better. Average = mean across tested sizes.
      </p>
    </div>
  );
}

function SingleSizeTable({
  entry,
  hasAnyMigrated,
}: {
  entry: { bklit?: ImplMetrics; tanstack?: ImplMetrics; migrated?: ImplMetrics };
  hasAnyMigrated: boolean;
}) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border">
          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Metric
          </th>
          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Comparison
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {METRICS.map((m) => {
          const vals: Record<string, number | null> = {
            bklit: valOrNull(entry.bklit, m.key),
            migrated: valOrNull(entry.migrated, m.key),
            tanstack: valOrNull(entry.tanstack, m.key),
          };
          const maxVal = Math.max(...Object.values(vals).filter((v) => v !== null).map(Number), 1);
          const values = IMPLS.map((impl) => ({ impl, value: vals[impl] }));

          return (
            <tr key={m.key}>
              <td className="px-4 py-3 text-sm font-medium align-top">
                {m.label}
                <span className="ml-1 text-xs text-muted-foreground">({m.unit})</span>
              </td>
              <td className="px-4 py-3">
                <StackedLines values={values} maxVal={maxVal} hasAnyMigrated={hasAnyMigrated} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/* ------------------------------------------------------------------ */
/*  Tabs                                                               */
/* ------------------------------------------------------------------ */

function Tabs({
  labels,
  activeIndex,
  onChange,
}: {
  labels: string[];
  activeIndex: number;
  onChange: (i: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5 mb-4" role="tablist">
      {labels.map((label, i) => (
        <button
          key={label}
          role="tab"
          aria-selected={i === activeIndex}
          onClick={() => onChange(i)}
          className={cn(
            "rounded-md px-3 py-1 text-sm font-medium transition-colors",
            i === activeIndex
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function ChartDetailPage({ route }: { route: string }) {
  const info = allCharts.find((c) => c.route === route);

  if (!info) {
    return (
      <div>
        <h1 className="text-2xl font-semibold">Chart not found</h1>
        <p className="mt-2 text-muted-foreground">No data for &quot;{route}&quot;.</p>
      </div>
    );
  }

  const speed = fmtSpeed(info.aggregateM1a);
  const diff = extractDiff(info.qaResult);
  const mem = fmtMemory(info.benchG4);

  const bench = benchmarkData[route];
  const tabLabels = bench
    ? ["Average", ...bench.sizes.map((n) => `n=${n}`)]
    : ["Average"];
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const activeTab = activeTabIndex === 0
    ? "average"
    : (bench?.sizes[activeTabIndex - 1] ?? "average");

  return (
    <div>
      <header className="mb-8">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">{info.name}</h1>
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadgeClass[info.status]}`}>
            {info.status}
          </span>
          {info.gap && (
            <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
              GAP
            </span>
          )}
          {info.waivers > 0 && (
            <span className="text-xs text-muted-foreground">
              {info.waivers} waiver{info.waivers > 1 ? "s" : ""}
            </span>
          )}
        </div>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          {info.tanstackExpression}
        </p>
      </header>

      <section className="mb-10 grid gap-4 sm:grid-cols-3">
        <StatCard label="First render" value={speed} />
        <StatCard label="Pixel match" value={diff} />
        <StatCard label="Memory" value={mem} />
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-lg font-semibold tracking-tight">Live preview</h2>
        <div className="flex flex-col gap-4">
          <ChartPreview impl="bklit" chart={route} n={info.defaultN} />
          <ChartPreview impl="migrated" chart={route} n={info.defaultN} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          n={info.defaultN}. Renders directly in the showcase app.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-lg font-semibold tracking-tight">Performance</h2>
        <div className="rounded-xl border border-border bg-card p-5">
          <Tabs
            labels={tabLabels}
            activeIndex={activeTabIndex}
            onChange={setActiveTabIndex}
          />
          <PerformanceTable route={route} activeTab={activeTab as "average" | number} />
        </div>
      </section>

      {info.waiverDetails && info.waiverDetails.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-3 text-lg font-semibold tracking-tight">Waivers</h2>
          <div className="flex flex-col gap-3">
            {info.waiverDetails.map((w, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-4">
                <div className="font-medium text-sm">{w.title}</div>
                <div className="mt-1 text-sm">{w.what}</div>
                <div className="mt-1 text-sm text-muted-foreground">{w.why}</div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {w.refs.map((ref, j) => (
                    <DocRefChip key={j} ref={ref} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold tracking-tight">Notes</h2>
        <div className="rounded-xl border border-border bg-muted/30 p-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{info.notes}</p>
          {info.docRefs.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {info.docRefs.map((ref, i) => (
                <DocRefChip key={i} ref={ref} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
