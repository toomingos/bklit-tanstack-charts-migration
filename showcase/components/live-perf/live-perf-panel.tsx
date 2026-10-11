"use client";

import { memo, Profiler, useEffect, useReducer, useState } from "react";
import {
  chunkTimes,
  getPageVitals,
  INP_GOOD_MS,
  isHoverActive,
  isLoading,
  MIN_INPUT_LAT,
  MIN_MOVES,
  perfStore,
  SLOW_INT_MS,
  type PageVitals,
  type PerfSnapshot,
} from "./collector";
import { HeadlineCards, type Headline } from "./headline-cards";

/** card: this card's own DOM / React subtree / event dispatches. window: page-wide data limited to the times the
 * pointer was inside this card. page: one page-wide value (both cards load together, frames are shared). */
type Scope = "card" | "window" | "page";
type Get = (s: PerfSnapshot) => number | null;
interface Row {
  label: string;
  get: Get;
  scope: Scope;
  unit?: string;
  lower?: boolean; // lower is better; undefined = informational (no delta colouring)
  hint?: string;
  /** Fed by React's <Profiler onRender>, which fires only in dev and profiling builds. */
  profiler?: true;
  /** decimals when the value is not an integer (default 1) */
  digits?: number;
  /** sample size shown next to the value */
  n?: Get;
}
interface Group { title: string; rows: Row[] }

const groups: Group[] = [
  {
    title: "Load",
    rows: [
      { label: "First paint", get: (s) => s.firstPaintMs, scope: "card", unit: "ms", lower: true, hint: "probe mount → the frame showing the first svg/canvas content is presented (rAF + MessageChannel). Includes the shared demo chunk load." },
      { label: "Entrance (settled − first paint)", get: (s) => s.entranceMs, scope: "card", unit: "ms", lower: true },
      { label: "Settled", get: (s) => s.settledMs, scope: "card", unit: "ms", lower: true, hint: "no DOM mutation / finite animation in this card for 150ms (cap 5s, shown with +)" },
      { profiler: true, label: "React commits (load)", get: (s) => s.loadCommits, scope: "card", hint: "count only: commit cost differs per impl, compare render time" },
      { profiler: true, label: "React render time (load)", get: (s) => s.loadRenderMs, scope: "card", unit: "ms", lower: true, hint: "Profiler actualDuration sum (render phase; effects and browser style/layout/paint not included)" },
      { label: "Long tasks (load)", get: (s) => s.loadLongTasks, scope: "page", lower: true, hint: "both cards load in the same window, so this is the same page data for both" },
      { label: "Long task time (load)", get: (s) => s.loadLongTaskMs, scope: "page", unit: "ms", lower: true },
      { label: "LoAF blocking (load)", get: (s) => s.loadLoafBlockMs, scope: "page", unit: "ms", lower: true, hint: "Long Animation Frames blockingDuration sum" },
      { label: "FPS (load)", get: (s) => s.loadFps, scope: "page", lower: false },
      { label: "Dropped frames (load)", get: (s) => s.loadDropped, scope: "page", lower: true, hint: "frame gaps > 20ms" },
      { label: "Worst frame (load)", get: (s) => s.loadWorstFrameMs, scope: "page", unit: "ms", lower: true },
    ],
  },
  {
    title: "React after settle",
    rows: [
      { profiler: true, label: "Render time (total)", get: (s) => s.interRenderMs, scope: "card", unit: "ms", lower: true, hint: "Profiler actualDuration since settle: hover, clicks and live ticks" },
      { profiler: true, label: "Commits (total)", get: (s) => s.interCommits, scope: "card", hint: "count only: a migrated commit costs ~0.3ms, a bklit one ~3ms; compare render time" },
      { profiler: true, label: "Render ms / s (rolling 2s)", get: (s) => s.steadyRenderMsPerSec, scope: "card", unit: "ms", lower: true, hint: "0 when idle proves the probe causes no re-renders" },
      { profiler: true, label: "Render ms / commit (rolling 2s)", get: (s) => s.steadyCommitMs, scope: "card", unit: "ms", lower: true },
    ],
  },
  {
    title: "Clicks & keys (Event Timing, grouped by interactionId like INP)",
    rows: [
      { label: "Interactions", get: (s) => s.interactions, scope: "card", hint: "pointerdown or keydown inside this card (one interaction each)" },
      { label: "  with an Event Timing entry", get: (s) => s.interactionsTimed, scope: "card", hint: "the rest finished under the API's 16ms reporting floor and count as 16ms below" },
      { label: "Latency p50", get: (s) => s.intP50, scope: "card", unit: "ms", lower: true, hint: "input → next paint of the interaction (its longest event). The event dispatch is this card's; the frame it waits for is shared." },
      { label: "Latency p95", get: (s) => s.intP95, scope: "card", unit: "ms", lower: true },
      { label: "Latency max", get: (s) => s.intMax, scope: "card", unit: "ms", lower: true },
      { label: `Slow (> ${SLOW_INT_MS}ms)`, get: (s) => s.slowInt50, scope: "card", lower: true, hint: "50ms: the long-task budget" },
      { label: `Slow (> ${INP_GOOD_MS}ms)`, get: (s) => s.slowInt200, scope: "card", lower: true, hint: "200ms: above INP's 'good' limit (web.dev/articles/inp)" },
      { label: "Worst: handler processing", get: (s) => s.intWorstProcessingMs, scope: "card", unit: "ms", lower: true, hint: "processingEnd − processingStart, summed over the interaction's events: this card's handlers" },
      { label: "Worst: input delay", get: (s) => s.intWorstInputDelayMs, scope: "page", unit: "ms", lower: true, hint: "main thread busy before the handlers ran (any source)" },
      { label: "Worst: presentation delay", get: (s) => s.intWorstPresentationMs, scope: "page", unit: "ms", lower: true, hint: "handlers end → frame presented; style/layout/paint of the whole page" },
      { label: "Key → next paint p50", get: (s) => s.keyLatP50, scope: "window", unit: "ms", lower: true, n: (s) => s.keyLatCount, hint: `keydown (Tab onto the card, arrows/Home/End/Page keys inside) → after the next presented frame (rAF + MessageChannel). "—" below ${MIN_INPUT_LAT} samples.` },
      { label: "Key → next paint p95", get: (s) => s.keyLatP95, scope: "window", unit: "ms", lower: true, n: (s) => s.keyLatCount },
      { label: "Wheel / press / drag → next paint p50", get: (s) => s.dragLatP50, scope: "window", unit: "ms", lower: true, n: (s) => s.dragLatCount, hint: `wheel, pointerdown and pointermove with a button held → after the next presented frame (zoom, click-zoom, brush). "—" below ${MIN_INPUT_LAT} samples.` },
      { label: "Wheel / press / drag → next paint p95", get: (s) => s.dragLatP95, scope: "window", unit: "ms", lower: true, n: (s) => s.dragLatCount },
    ],
  },
  {
    title: `Hover (per real pointermove inside the card; shown from ${MIN_MOVES} moves)`,
    rows: [
      { label: "Real pointermoves counted", get: (s) => s.moves, scope: "card", hint: `moves that changed the pointer position; the browser's re-dispatches at a resting pointer are not counted. Every per-move row shows "—" until ${MIN_MOVES} are counted.` },
      { label: "Hover time (active)", get: (s) => s.hoverSec, scope: "card", unit: "s", hint: "each hover window ends 400ms after its last real move, on pointerleave, pointerout to outside, window blur or tab hidden: a resting or parked pointer adds nothing" },
      { label: "Main-thread work / move", get: (s) => s.moveWorkMs, scope: "card", unit: "ms", lower: true, digits: 2, n: (s) => s.moves, hint: `sum of the three rows below, per real move (mean). Same method for both columns, so bklit's rAF-deferred tooltip commit is included. "—" below ${MIN_MOVES} moves.` },
      { label: "  sync dispatch only", get: (s) => s.moveDispatchMs, scope: "card", unit: "ms", lower: true, digits: 2, n: (s) => s.moves, hint: "pointermove dispatch from window capture to window bubble (React's root listener and the chart's own listeners, incl. forced style/layout); React render inside it is excluded (render row). Misses work deferred to a frame: not a like-for-like figure on its own." },
      { label: "  rAF callbacks", get: (s) => s.moveRafMs, scope: "card", unit: "ms", lower: true, digits: 2, n: (s) => s.moves, hint: "callbacks of requestAnimationFrame requests made from inside the move dispatch (and by those callbacks), React render excluded. bklit's tooltip state commit runs here." },
      { profiler: true, label: "  React render", get: (s) => s.moveRenderMs, scope: "card", unit: "ms", lower: true, digits: 2, n: (s) => s.moves, hint: "Profiler actualDuration of commits within 200ms of a real move inside the card (a live chart's own ticks are included)" },
      { label: "Main-thread work p95 / painted frame", get: (s) => s.moveWorkFrameP95, scope: "card", unit: "ms", lower: true, digits: 2, n: (s) => s.moves, hint: "dispatch + rAF callbacks + render of the moves coalesced into one frame, up to its paint; p95 over frames" },
      { profiler: true, label: "React commits / 100 moves", get: (s) => s.hoverCommitsPer100, scope: "card", n: (s) => s.moves },
      { label: "Move → next paint p50", get: (s) => s.moveLatP50, scope: "window", unit: "ms", lower: true, n: (s) => s.moveLatCount, hint: `event.timeStamp → after the next presented frame (rAF + MessageChannel); the frame is shared by the page. "—" below ${MIN_MOVES} samples.` },
      { label: "Move → next paint p95", get: (s) => s.moveLatP95, scope: "window", unit: "ms", lower: true, n: (s) => s.moveLatCount },
      { label: "Frame gap p95 (steady)", get: (s) => s.hoverSteadyP95Ms, scope: "window", unit: "ms", lower: true, hint: "rAF gaps within 200ms of a move; excludes the first 300ms of the first hover" },
      { label: "Frame gap worst (steady)", get: (s) => s.hoverSteadyWorstMs, scope: "window", unit: "ms", lower: true },
      { label: "First hover: worst frame (300ms)", get: (s) => s.hoverFirstWorstMs, scope: "window", unit: "ms", lower: true, hint: "cold path of the first enter" },
      { label: "FPS (steady)", get: (s) => s.hoverSteadyFps, scope: "window", lower: false },
      { label: "Dropped frames / 100 moves", get: (s) => s.hoverDroppedPer100, scope: "window", lower: true, n: (s) => s.moves, hint: "frame gaps > 20ms" },
      { label: "LoAF blocking (hover)", get: (s) => s.hoverLoafBlockMs, scope: "window", unit: "ms", lower: true, hint: "Long Animation Frames (> 50ms) starting inside this card's hover windows" },
      { label: "LoAF script time (hover)", get: (s) => s.hoverLoafScriptMs, scope: "window", unit: "ms", lower: true, hint: "scripts (≥ 5ms each) inside those LoAFs" },
      { label: "Long tasks (hover)", get: (s) => s.hoverLongTasks, scope: "window", lower: true },
      { label: "Long task time (hover)", get: (s) => s.hoverLongTaskMs, scope: "window", unit: "ms", lower: true },
      { label: "Boundary events ≥ 16ms / 100 moves", get: (s) => s.boundaryEntriesPer100, scope: "card", n: (s) => s.moves, hint: "Event Timing entries without an interactionId (pointer/mouse over/out/enter/leave). Their duration runs to the next paint, so nearly all reach 16ms: this counts element-boundary crossings (DOM structure), not slowness." },
      { label: "  of which without a target", get: (s) => s.targetlessEntries, scope: "card", hint: "Event Timing reports a null target when the node was detached, or for an enter/leave event Chrome did not dispatch (no listener in its path); attributed to the card by event timestamp" },
    ],
  },
  {
    title: "Size",
    rows: [
      { label: "DOM elements", get: (s) => s.domNodes, scope: "card", lower: true },
      { label: "SVG nodes", get: (s) => s.svgNodes, scope: "card", lower: true },
      { label: "JS heap", get: (s) => s.heapMB, scope: "page", unit: "MB", hint: "Chromium only; includes both charts" },
      { label: "JS heap growth since mount", get: (s) => s.heapDeltaMB, scope: "page", unit: "MB", hint: "Chromium only; includes both charts, GC noise" },
    ],
  },
];

const scopeMark: Record<Scope, { mark: string; label: string; title: string }> = {
  card: { mark: "●", label: "per card", title: "per card: this card's own DOM, React Profiler or event dispatches" },
  window: { mark: "◐", label: "page data in the card's hover windows", title: "page-wide data restricted to the times the pointer was inside this card (frames are shared by the page)" },
  page: { mark: "○", label: "page-shared", title: "page-shared: the same window or frames for both cards" },
};

/** React does not call <Profiler onRender> in a production build, so the React rows would read zero there. */
const HAS_PROFILER = process.env.NODE_ENV !== "production";
const NO_PROFILER = "n/a (production build)";

const fmt = (v: number | null | undefined, unit?: string, digits = 1) =>
  v === null || v === undefined ? "—" : `${Number.isInteger(v) ? v : v.toFixed(digits)}${unit ? ` ${unit}` : ""}`;

function Delta({ a, b, lower }: { a: number | null; b: number | null; lower?: boolean }) {
  if (a === null || b === null || lower === undefined) return <span className="text-muted-foreground">—</span>;
  const diff = b - a;
  if (Math.abs(diff) < 1e-9) return <span className="text-muted-foreground">=</span>;
  const better = lower ? diff < 0 : diff > 0;
  const pct = a !== 0 ? `${diff > 0 ? "+" : "−"}${Math.abs((diff / a) * 100).toFixed(0)}%` : `${diff > 0 ? "+" : "−"}${Math.abs(diff).toFixed(1)}`;
  return (
    <span className={better ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>{pct}</span>
  );
}

const vitalRows: Array<[string, (v: PageVitals) => number | null, string?, string?]> = [
  ["TTFB", (v) => v.ttfbMs, "ms"],
  ["FCP", (v) => v.fcpMs, "ms"],
  ["LCP", (v) => v.lcpMs, "ms"],
  ["DOMContentLoaded", (v) => v.dclMs, "ms"],
  ["Load event", (v) => v.loadMs, "ms"],
  ["CLS", (v) => v.cls, undefined, "largest session window (shifts < 1s apart, ≤ 5s), excluding shifts after input"],
  ["INP (page)", (v) => v.inpMs, "ms", "worst interaction, ignoring one per 50; interactions under 16ms have no entry"],
  ["Interactions", (v) => v.interactions, undefined],
  ["Long tasks (page)", (v) => v.longTasks, undefined, "since navigation (buffered observer)"],
  ["Long task time (page)", (v) => v.longTaskMs, "ms"],
  ["TBT since FCP", (v) => v.tbtMs, "ms", "sum of (long task − 50ms) after FCP, including tasks caused by interaction"],
  ["JS transferred", (v) => v.jsKB, "KB", "dev server: unminified, uncompressed chunks"],
  ["JS files", (v) => v.jsCount, undefined],
];

const VitalCell = memo(function VitalCell({ label, value, unit, hint }: { label: string; value: number | null; unit?: string; hint?: string }) {
  return (
    <div className="flex justify-between gap-2 border-b border-border/50 py-1" title={hint}>
      <span className="min-w-0 truncate">{label}</span>
      <span className="whitespace-nowrap">{fmt(value, unit)}</span>
    </div>
  );
});

function PageVitalsTable({ v }: { v: PageVitals | null }) {
  // Reserve the final height before mount so the late-mounted block adds no layout shift (CLS).
  if (!v) return <div className="mb-4 h-[200px] sm:h-[150px]" aria-hidden />;
  return (
    <div className="mb-4 min-h-[200px] sm:min-h-[150px]">
      <div className="pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Page load (shared by both charts, one navigation)
      </div>
      <div className="grid grid-cols-2 gap-x-6 text-xs tabular-nums sm:grid-cols-3">
        {vitalRows.map(([label, get, unit, hint]) => (
          <VitalCell key={label} label={label} value={get(v)} unit={unit} hint={hint} />
        ))}
      </div>
    </div>
  );
}

/** Displayed vitals only (the heap moves every tick and is not shown in the vitals grid). */
const vitalsKey = (v: PageVitals) => vitalRows.map(([, get]) => get(v)).join("|");

/** One shared polling loop (4Hz) for every consumer on the page: re-render only when a collector flushed or a shown
 * page vital changed, and never while a card is still loading or the pointer moves inside a chart. */
const tickSubs = new Set<() => void>();
const seen = { ver: -1, vit: "" };
let tickTimer: ReturnType<typeof setInterval> | undefined;
function tick() {
  if (isHoverActive() || isLoading()) return;
  const ver = perfStore.version();
  const vit = vitalsKey(getPageVitals());
  if (ver === seen.ver && vit === seen.vit) return;
  seen.ver = ver;
  seen.vit = vit;
  for (const f of tickSubs) f();
}
function usePanelTick() {
  const [, bump] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    tickSubs.add(bump);
    tickTimer ??= setInterval(tick, 250);
    const unsub = perfStore.subscribe(bump);
    return () => {
      tickSubs.delete(bump);
      if (!tickSubs.size) {
        clearInterval(tickTimer);
        tickTimer = undefined;
        seen.ver = -1;
        seen.vit = "";
      }
      unsub();
    };
  }, []);
}

function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

/** The panel measures its own React render cost so it can be read against the charts' numbers. */
const self = { ms: 0, n: 0, since: 0, mountMs: 0 };
if (typeof window !== "undefined") (window as unknown as { __panelCost?: typeof self }).__panelCost = self;
const onPanelRender = (_id: string, phase: string, actual: number) => {
  if (phase === "mount") {
    self.mountMs += actual;
    self.since = performance.now();
    return;
  }
  self.ms += actual;
  self.n++;
};

/** Live headline cards from this chart's two collectors; per-move and interaction values wait for MIN_MOVES moves. */
export function LiveHeadlines({ chart }: { chart: string }) {
  usePanelTick();
  const mounted = useMounted();
  const a = mounted ? window.__livePerf?.[`${chart}:bklit`] : undefined;
  const b = mounted ? window.__livePerf?.[`${chart}:migrated`] : undefined;
  const hovered = !!a && !!b && Math.min(a.moves, b.moves) >= MIN_MOVES;
  const pick = (get: Get, ready: boolean, profiler = false): [number | null, number | null] =>
    a && b && ready && (HAS_PROFILER || !profiler) ? [get(a), get(b)] : [null, null];
  const [rb, rm] = pick((s) => s.loadRenderMs, true, true);
  const [ob, om] = pick((s) => s.interRenderMs, hovered, true);
  const [cb, cm] = pick((s) => s.moveWorkMs, hovered);
  const items: Headline[] = [
    { label: "Render time on load", kind: "faster", bklit: rb, migrated: rm, pending: HAS_PROFILER ? "Waiting for the charts" : NO_PROFILER },
    { label: "React render on hover", kind: "less", bklit: ob, migrated: om, pending: HAS_PROFILER ? "Hover the charts" : NO_PROFILER },
    { label: "Browser compute per pointer move", kind: "faster", bklit: cb, migrated: cm, digits: 2, pending: `Hover the charts (${MIN_MOVES} moves)` },
  ];
  return <HeadlineCards items={items} />;
}

export function LivePerfPanel({ chart }: { chart: string }) {
  return (
    <Profiler id="live-perf-panel" onRender={onPanelRender}>
      <LivePerfPanelBody chart={chart} />
    </Profiler>
  );
}

function LivePerfPanelBody({ chart }: { chart: string }) {
  usePanelTick();
  const mounted = useMounted();
  const a = mounted ? window.__livePerf?.[`${chart}:bklit`] : undefined;
  const b = mounted ? window.__livePerf?.[`${chart}:migrated`] : undefined;
  const ct = chunkTimes[chart];
  const chunk = ct?.end ? ct.end - ct.start : null;
  const selfSec = self.since ? (performance.now() - self.since) / 1000 : 0;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Measured live in this browser. Hover and click the charts to populate interaction metrics.
          {chunk !== null && <> Demo chunk load: {fmt(chunk, "ms")} (shared, first load only).</>}
          {HAS_PROFILER && selfSec > 1 && (
            <span title="React Profiler actualDuration of this panel's updates since mount (mount excluded). It re-renders at most 4Hz, only when a shown value changed, and not at all while a chart loads or the pointer moves in one.">
              {" "}Panel render cost: {fmt(Math.round((self.ms / selfSec) * 10) / 10, "ms/s")} (mount {fmt(Math.round(self.mountMs * 10) / 10, "ms")}).
            </span>
          )}
        </p>
        <button
          type="button"
          onClick={() => perfStore.rerun(chart)}
          className="rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium hover:bg-muted"
        >
          Re-run
        </button>
      </div>
      <PageVitalsTable v={mounted ? getPageVitals() : null} />
      <div className="overflow-x-auto">
        <table className="w-full text-xs tabular-nums">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="py-1.5 pr-3 font-medium">Metric</th>
              <th className="py-1.5 pr-3 text-right font-medium">Bklit UI</th>
              <th className="py-1.5 pr-3 text-right font-medium">TanStack Bklit UI</th>
              <th className="py-1.5 text-right font-medium">Change</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <GroupRows key={g.title} g={g} a={a} b={b} />
            ))}
          </tbody>
        </table>
      </div>
      <p className="mb-1 mt-4 text-[11px] text-muted-foreground">
        {(Object.keys(scopeMark) as Scope[]).map((k) => (
          <span key={k} className="mr-3" title={scopeMark[k].title}>
            {scopeMark[k].mark} {scopeMark[k].label}
          </span>
        ))}
        Hover a row for its definition.
      </p>
      <ul className="list-disc pl-4 text-[11px] text-muted-foreground">
        <li>Settle of the live line is capped at 5 s (a "+" marks a capped value); loading demos loop a shimmer and read as capped.</li>
        <li>Settle polls document.getAnimations() every 50 ms, which forces a style recalc and can add up to a frame to a measured settle.</li>
      </ul>
    </div>
  );
}

function GroupRows({ g, a, b }: { g: Group; a?: PerfSnapshot; b?: PerfSnapshot }) {
  return (
    <>
      <tr>
        <td colSpan={4} className="pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {g.title}
        </td>
      </tr>
      {g.rows.map((r) => (
        <MetricRow
          key={r.label}
          row={r}
          av={a ? r.get(a) : null}
          bv={b ? r.get(b) : null}
          an={a && r.n ? r.n(a) : null}
          bn={b && r.n ? r.n(b) : null}
          aCapped={!!a?.settledCapped && r.label === "Settled"}
          bCapped={!!b?.settledCapped && r.label === "Settled"}
        />
      ))}
    </>
  );
}

const N = ({ n }: { n: number }) => <span className="ml-1.5 text-[10px] text-muted-foreground" title="sample size: real moves counted">n={n}</span>;

/** Rows re-render only when their two values change (row definitions are static module objects). */
const MetricRow = memo(function MetricRow({ row: r, av, bv, an, bn, aCapped, bCapped }: { row: Row; av: number | null; bv: number | null; an: number | null; bn: number | null; aCapped: boolean; bCapped: boolean }) {
  const sm = scopeMark[r.scope];
  const na = r.profiler === true && !HAS_PROFILER;
  return (
    <tr className="border-b border-border/50 last:border-0" title={`${sm.title}${r.hint ? `\n${r.hint}` : ""}`}>
      <td className="py-1 pr-3">
        <span className="mr-1.5 text-muted-foreground" aria-label={r.scope}>{sm.mark}</span>
        {r.label}
      </td>
      {na ? (
        <td colSpan={3} className="py-1 text-right text-muted-foreground">{NO_PROFILER}</td>
      ) : (
        <>
          <td className="py-1 pr-3 text-right">{fmt(av, r.unit, r.digits)}{aCapped ? "+" : ""}{an !== null && <N n={an} />}</td>
          <td className="py-1 pr-3 text-right">{fmt(bv, r.unit, r.digits)}{bCapped ? "+" : ""}{bn !== null && <N n={bn} />}</td>
          <td className="py-1 text-right">
            <Delta a={av} b={bv} lower={r.lower} />
          </td>
        </>
      )}
    </tr>
  );
});
