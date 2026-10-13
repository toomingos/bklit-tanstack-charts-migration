"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { allCharts } from "@/lib/chart-data";
import { FixedHeadlines } from "@/components/live-perf/fixed-headlines";
import { LiveHeadlines, LivePerfPanel } from "@/components/live-perf/live-perf-panel";
import { ChartPreview } from "@/components/chart-preview";
import { defaultDemoControls, PHONE_WIDTH, type DemoControls, type LoadingMode, type StageWidth } from "@/components/demo-controls";

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

// The 390px toggle and the Notes section are dev tools, hidden unless NEXT_PUBLIC_SHOW_DEV_TOOLS=1.
const showDevTools = process.env.NEXT_PUBLIC_SHOW_DEV_TOOLS === "1";

type AvailableControls = { loading?: true; sweep?: true; pulse?: true };

const loadingModes: { mode: LoadingMode; label: string }[] = [
  { mode: "off", label: "Data" },
  { mode: "status", label: "Loading (status)" },
  { mode: "component", label: "Loading (component)" },
];

// Which toggles a route's demo reads; a route absent here has no loading surface in bklit.
const routeControls: Record<string, AvailableControls> = {
  area: { loading: true, sweep: true },
  line: { loading: true, sweep: true },
  bar: { loading: true },
  heatmap: { loading: true },
  bardepth: { pulse: true },
};

function DemoControlsBar({
  available,
  controls,
  onChange,
  width,
  onWidthChange,
}: {
  available: AvailableControls | undefined;
  controls: DemoControls;
  onChange: (next: DemoControls) => void;
  width: StageWidth;
  onWidthChange: (next: StageWidth) => void;
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {showDevTools && (
        <button
          type="button"
          aria-pressed={width === "phone"}
          className={`rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted ${width === "phone" ? "bg-muted" : "bg-background"}`}
          onClick={() => onWidthChange(width === "phone" ? "auto" : "phone")}
        >
          {PHONE_WIDTH}px
        </button>
      )}
      {available?.loading &&
        loadingModes.map(({ mode, label }) => (
          <button
            key={mode}
            type="button"
            aria-pressed={controls.loading === mode}
            className={`rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted ${controls.loading === mode ? "bg-muted" : "bg-background"}`}
            onClick={() => onChange({ ...controls, loading: mode })}
          >
            {label}
          </button>
        ))}
      {available?.sweep && (
        <label className="flex items-center gap-1.5 text-xs font-medium">
          <input
            type="checkbox"
            checked={controls.sweep}
            onChange={(event) => onChange({ ...controls, sweep: event.target.checked })}
          />
          Sweep
        </label>
      )}
      {available?.pulse && (
        <label className="flex items-center gap-1.5 text-xs font-medium">
          <input
            type="checkbox"
            checked={controls.pulse}
            onChange={(event) => onChange({ ...controls, pulse: event.target.checked })}
          />
          Pulse
        </label>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                    */
/* ------------------------------------------------------------------ */

export function ChartDetailPage({ route }: { route: string }) {
  const info = allCharts.find((c) => c.route === route);
  const [controls, setControls] = useState(defaultDemoControls);
  const available = routeControls[route];
  const params = useSearchParams();
  const pathname = usePathname();
  const width: StageWidth = params.get("w") === String(PHONE_WIDTH) ? "phone" : "auto";

  // replaceState keeps the toggle out of the history stack; Next syncs useSearchParams with it.
  const setWidth = (next: StageWidth) => {
    const query = new URLSearchParams(params);
    if (next === "phone") query.set("w", String(PHONE_WIDTH));
    else query.delete("w");
    window.history.replaceState(null, "", query.size ? `${pathname}?${query}` : pathname);
  };

  // Live Perf switches: `only` renders one side (`only=none`: no chart, the bench's control page for page and
  // machine load), `order=migrated` mounts the migrated chart first.
  const only = params.get("only");
  const live = params.get("live") === "1";
  const impls = (params.get("order") === "migrated" ? (["migrated", "bklit"] as const) : (["bklit", "migrated"] as const)).filter(
    (i) => (only !== "bklit" && only !== "migrated" && only !== "none") || i === only,
  );

  if (!info) {
    return (
      <div>
        <h1 className="text-2xl font-semibold">Chart not found</h1>
        <p className="mt-2 text-muted-foreground">No data for &quot;{route}&quot;.</p>
      </div>
    );
  }

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">{info.name}</h1>
      </header>

      <section className="mb-10">
        <div className="flex flex-col gap-4">
          {impls.map((impl) => (
            <ChartPreview key={impl} impl={impl} chart={route} n={info.defaultN} controls={controls} width={width} />
          ))}
        </div>
        <DemoControlsBar
          available={available}
          controls={controls}
          onChange={setControls}
          width={width}
          onWidthChange={setWidth}
        />
      </section>

      <section className="mb-10">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold tracking-tight">{live ? "Live performance" : "Performance"}</h2>
          {/* A full load, not a client navigation: the probe is decided once per page load (collector.ts LIVE). */}
          <a href={live ? pathname : `${pathname}?live=1`} className="text-sm text-muted-foreground hover:underline">
            {live ? "Show the production results" : "Measure live in this browser"}
          </a>
        </div>
        {live ? (
          <>
            <div className="mb-4">
              <LiveHeadlines chart={route} name={info.name} />
            </div>
            <LivePerfPanel chart={route} />
          </>
        ) : (
          <FixedHeadlines route={route} name={info.name} />
        )}
      </section>

      {showDevTools && info.notes && (
        <section className="mb-10">
          <h2 className="mb-3 text-lg font-semibold tracking-tight">Notes</h2>
          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <p className="text-sm text-muted-foreground leading-relaxed">{info.notes}</p>
          </div>
        </section>
      )}
    </div>
  );
}
