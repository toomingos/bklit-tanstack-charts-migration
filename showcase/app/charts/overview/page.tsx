"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { allCharts, summary, type ChartInfo } from "@/lib/chart-data";

type SortKey = keyof Pick<ChartInfo, "index" | "name" | "status" | "waivers">;
type SortDir = "asc" | "desc";

function fmtSpeed(v: string): string {
  if (!v || v === "N/A") return "—";
  const pct = parseInt(v.replace(/[−%]/g, ""), 10);
  if (isNaN(pct)) return v;
  if (pct <= 0) return "on par";
  const x = 100 / (100 - pct);
  return `${x >= 10 ? Math.round(x) : x.toFixed(1)}× faster`;
}

function fmtSpeedShort(v: string): string {
  if (!v || v === "N/A") return "—";
  const pct = parseInt(v.replace(/[−%]/g, ""), 10);
  if (isNaN(pct)) return v;
  if (pct <= 0) return "on par";
  const x = 100 / (100 - pct);
  return `${x >= 10 ? Math.round(x) : x.toFixed(1)}×`;
}

function fmtDiff(qa: string): string {
  if (!qa) return "—";
  const worst = qa.match(/worst\s+([\d.]+%)/i);
  if (worst) return worst[1];
  const any = qa.match(/([\d.]+%)/g);
  if (!any || any.length === 0) return "—";
  const nums = any.map((v) => parseFloat(v));
  return `${Math.max(...nums)}%`;
}

const statusBadge: Record<ChartInfo["status"], string> = {
  approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  migrating: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  "in research": "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  "not started": "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  blocked: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

export default function OverviewPage() {
  const [sortKey, setSortKey] = useState<SortKey>("index");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const sorted = useMemo(() => {
    const copy = [...allCharts];
    copy.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "index" || sortKey === "waivers") {
        cmp = a[sortKey] - b[sortKey];
      } else {
        cmp = a[sortKey].localeCompare(b[sortKey]);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sortIcon = (key: SortKey) => {
    if (sortKey !== key) return <span className="ml-1 opacity-30">↕</span>;
    return <span className="ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>;
  };

  const th =
    "px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer select-none hover:text-foreground transition-colors whitespace-nowrap";

  return (
    <div>
      <section className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight">Migration overview</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          {summary.totalCharts} charts migrated from bklit-ui to TanStack Charts.
          {summary.gapCount > 0
            ? ` ${summary.gapCount} required custom marks (gap charts).`
            : " Zero gaps."}{" "}
          All {summary.approvedCount} approved.
        </p>
      </section>

      {/* Stats */}
      <section className="mb-10 grid gap-4 sm:grid-cols-3">
        <StatCard label="Avg speedup" value={fmtSpeedShort(summary.aggregateM1aDelta)} />
        <StatCard label="Approved" value={String(summary.approvedCount)} />
        <StatCard label="Waivers" value={String(summary.waiversCount)} />
      </section>

      {/* Table */}
      <section>
        <h2 className="mb-4 text-lg font-semibold tracking-tight">All charts</h2>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className={th} onClick={() => toggleSort("index")}>
                  #{sortIcon("index")}
                </th>
                <th className={th} onClick={() => toggleSort("name")}>
                  Chart{sortIcon("name")}
                </th>
                <th className={th} onClick={() => toggleSort("status")}>
                  Status{sortIcon("status")}
                </th>
                <th className={th}>Speed</th>
                <th className={th}>Visual diff</th>
                <th className={th} onClick={() => toggleSort("waivers")}>
                  Waivers{sortIcon("waivers")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sorted.map((chart) => (
                <tr key={chart.index} className="transition-colors hover:bg-muted/30">
                  <td className="px-3 py-2.5 tabular-nums text-muted-foreground">{chart.index}</td>
                  <td className="px-3 py-2.5">
                    <Link
                      href={`/charts/${chart.route}`}
                      className="font-medium no-underline hover:underline"
                    >
                      {chart.name}
                    </Link>
                    {chart.gap && (
                      <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                        GAP
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${statusBadge[chart.status]}`}>
                      {chart.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 tabular-nums font-medium">{fmtSpeedShort(chart.aggregateM1a)}</td>
                  <td className="px-3 py-2.5 tabular-nums text-xs text-muted-foreground">
                    {fmtDiff(chart.qaResult)}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-muted-foreground">
                    {chart.waivers > 0 ? chart.waivers : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-1 text-3xl font-bold tabular-nums">{value}</div>
    </div>
  );
}
