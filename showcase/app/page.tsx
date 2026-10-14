import type { Metadata } from "next";
import Link from "next/link";
import { InstallCommand } from "@/components/docs/code-block";
import { ChartGallery } from "@/components/home/chart-gallery";
import { pct } from "@/components/live-perf/headline-cards";
import { summaryHeadlines } from "@/components/live-perf/summary-headlines";
import { SiteHeader } from "@/components/site-header";
import { allCharts } from "@/lib/chart-data";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: { absolute: "Bklit TanStack Charts" } };

const primary =
  "inline-flex h-10 items-center rounded-md bg-foreground px-5 font-medium text-background text-sm no-underline transition-opacity hover:opacity-90";
const secondary =
  "inline-flex h-10 items-center rounded-md border border-border px-5 font-medium text-sm no-underline transition-colors hover:bg-muted";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pt-14 sm:px-8">
        <section className="py-20 sm:py-28">
          <p className="font-mono text-muted-foreground text-xs uppercase tracking-widest">React · TanStack Charts 1.1</p>
          <h1 className="mt-4 max-w-3xl text-balance font-semibold text-4xl tracking-tight sm:text-6xl">
            Bklit UI&apos;s charts, now on TanStack.
          </h1>
          <p className="mt-6 max-w-2xl text-pretty text-lg text-muted-foreground">
            {allCharts.length} charts and utilities with Bklit UI&apos;s design, motion and interaction, built on TanStack Charts.
            Pick a chart, copy the code, ship it.
          </p>
          <InstallCommand className="mt-10 max-w-md" />
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link className={primary} href="/charts/installation">
              Get started
            </Link>
            <a className={secondary} href="#gallery">
              Browse charts
            </a>
          </div>
        </section>

        <section className="scroll-mt-20 pb-24" id="gallery">
          <ChartGallery />
        </section>

        <section className="mb-24 grid gap-8 rounded-xl border border-border p-6 sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <h2 className="font-semibold text-2xl tracking-tight">Coming from Bklit UI?</h2>
            <p className="mt-3 max-w-xl text-pretty text-muted-foreground">
              Same components and props, installed from npm instead of copied in. Charts render faster and do less work on hover.
              Bundles are currently larger.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link className={primary} href="/charts/migration">
                Migration guide
              </Link>
              <Link className={secondary} href="/charts/benchmarks">
                Benchmarks
              </Link>
            </div>
          </div>
          <dl className="grid grid-cols-3 divide-x divide-border">
            {summaryHeadlines.map((h) => {
              const r = h.ratio ?? (h.bklit && h.migrated ? h.migrated / h.bklit : null);
              return (
                <div className="px-4 first:pl-0 last:pr-0 sm:px-6" key={h.label}>
                  <dt className="text-muted-foreground text-xs sm:text-sm">{h.label}</dt>
                  <dd
                    className={cn(
                      "mt-1 font-semibold text-2xl tabular-nums tracking-tight sm:text-3xl",
                      r !== null && Math.round((r - 1) * 100) < 0 && "text-emerald-700 dark:text-emerald-400"
                    )}
                  >
                    {r === null ? "—" : pct(r)}
                  </dd>
                </div>
              );
            })}
          </dl>
        </section>
      </main>
      <footer className="border-border border-t">
        <div className="mx-auto flex max-w-7xl flex-wrap justify-between gap-2 px-4 py-6 text-muted-foreground text-xs sm:px-8">
          <span>
            Design and API from{" "}
            <a className="text-foreground no-underline hover:underline" href="https://ui.bklit.com">
              Bklit UI
            </a>{" "}
            (MIT). Rendered by TanStack Charts 1.1.0.
          </span>
          <Link className="no-underline hover:text-foreground" href="/charts/benchmarks">
            Benchmarks
          </Link>
        </div>
      </footer>
    </div>
  );
}
