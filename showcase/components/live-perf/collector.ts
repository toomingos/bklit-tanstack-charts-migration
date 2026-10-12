/* Live perf collector.
 *
 * All hot-path data lives in plain fields (no React state); a throttled flush (<= 4Hz, silent while the pointer moves)
 * snapshots into window.__livePerf. Every metric has a scope, shown in the panel:
 *  - card:   measured on this card's own DOM subtree / React Profiler / its own event dispatches.
 *  - window: page-wide data (frames, long tasks, LoAF) restricted to the times the pointer was inside this card. The
 *            pointer is in one card at a time, so this separates the cards unless the other one animates on its own
 *            (live line ticks) -- frames are always shared by everything on the page.
 *  - page:   one value for the whole page (both cards load at the same time, so load-time windows coincide).
 *
 * Per-move main-thread work (the hover headline, measured identically for both impls) is the sum of three parts the card
 * owns: the synchronous pointermove dispatch (window capture -> window bubble, React render inside it excluded), the
 * callbacks of requestAnimationFrame requests made from inside that dispatch (and from those callbacks: bklit commits
 * its tooltip in a rAF, use-scheduled-tooltip.ts:55-67), and the React Profiler render time of commits while the card is
 * actively hovered. LoAF / Event Timing cannot do this: both only report work above 50ms / 16ms.
 *
 * Whole-main-thread busy time per move (the fair cross-implementation number): a MessageChannel ping-pong runs only while
 * a card is actively hovered and sums every gap > 1ms between consecutive tasks (script, style, layout, paint of any
 * origin). Gaps are attributed to the hovered card; slices of 10 moves give a median and spread.
 *
 * Sources: Event Timing (interactionId grouping, like INP), Long Animation Frames (blocking + script time), Long Tasks,
 * React <Profiler> actualDuration, rAF + MessageChannel "after next paint", MutationObserver + document.getAnimations()
 * for settle. */

import { entranceBudget } from "./entrance-budget";

export type Impl = "bklit" | "migrated";

export interface PerfSnapshot {
  key: string;
  runAt: number;
  /* ---- load ---- */
  firstPaintMs: number | null;
  settledMs: number | null;
  settledCapped: boolean;
  /** max(first paint, settled - the demo's designed entrance): first paint plus any time the entrance ran past its design; null without a budget or when capped */
  renderMs: number | null;
  /** first paint / settled of every run of this card in this session (Re-run adds one) */
  firstPaintRuns: number[];
  settledRuns: number[];
  loadCommits: number;
  loadRenderMs: number;
  /** whole-main-thread busy ms (task gaps > 1ms, any origin) from probe mount to first paint / to settled. Production-valid
   * (no Profiler). Needs ?loadbusy=1. Page-wide: with both cards rendered it includes the other card's load, so compare with ?only=. */
  paintBusyMs: number | null;
  loadBusyMs: number | null;
  /** this card's lazy import, request to resolved (first load only; cached imports resolve in ~0). */
  chunkMs: number | null;
  /** first paint measured from this card's import resolving: chart render + layout + paint, without the code download
   * that firstPaintMs includes. On one page both imports usually resolve in the same task, so the card rendered second
   * also waits for the first card's render (compare with ?only=). */
  chartPaintMs: number | null;
  loadLongTasks: number;
  loadLongTaskMs: number;
  loadLoafBlockMs: number;
  loadFps: number | null;
  loadDropped: number;
  loadWorstFrameMs: number | null;
  /* ---- React after settle ---- */
  interCommits: number;
  interRenderMs: number;
  steadyCommitsPerSec: number;
  steadyCommitMs: number | null;
  steadyRenderMsPerSec: number;
  /* ---- discrete interactions (Event Timing, grouped by interactionId) ---- */
  interactions: number;
  /** interactions that produced an Event Timing entry (>= 16ms); the rest ran under the reporting threshold */
  interactionsTimed: number;
  intP50: number | null;
  intP95: number | null;
  intMax: number | null;
  /** event-handler processing of the worst interaction (processingEnd - processingStart, summed over its events) */
  intWorstProcessingMs: number | null;
  intWorstInputDelayMs: number | null;
  intWorstPresentationMs: number | null;
  slowInt50: number;
  slowInt200: number;
  /* ---- hover ---- */
  /** real pointermoves counted (synthesised re-dispatches at a resting pointer excluded) */
  moves: number;
  /** active hover time only: each window ends REST_MS after its last real move */
  hoverSec: number;
  /** main-thread work per real move: syncDispatch + rafCallbacks + reactRender (null below MIN_MOVES moves) */
  moveWorkMs: number | null;
  /** p95 of the work done per painted frame (moves coalesced into the same frame are summed), up to that paint */
  moveWorkFrameP95: number | null;
  /** synchronous pointermove dispatch (window capture -> window bubble), React render inside it excluded */
  moveDispatchMs: number | null;
  /** callbacks of requestAnimationFrame requests made inside that dispatch or by those callbacks, React render excluded */
  moveRafMs: number | null;
  /** React Profiler actualDuration of commits while the card is actively hovered (a live chart's own ticks included) */
  moveRenderMs: number | null;
  hoverCommitsPer100: number | null;
  /** whole-main-thread busy ms per real move: all gaps > 1ms while hovered / moves (null below MIN_MOVES or probe off) */
  busyPerMove: number | null;
  /** per-slice (10 moves) busy ms per move: median and range, and the slice count */
  busyMedian: number | null;
  busyLo: number | null;
  busyHi: number | null;
  busySlices: number;
  /** pointermove event.timeStamp -> after the next paint (rAF + MessageChannel) */
  moveLatP50: number | null;
  moveLatP95: number | null;
  moveLatCount: number;
  /** keydown (Tab onto the card, arrows/Home/End inside it) -> after the next paint */
  keyLatP50: number | null;
  keyLatP95: number | null;
  keyLatCount: number;
  /** wheel, pointerdown and pointermove with a button held -> after the next paint */
  dragLatP50: number | null;
  dragLatP95: number | null;
  dragLatCount: number;
  hoverFirstWorstMs: number | null;
  hoverSteadyP95Ms: number | null;
  hoverSteadyWorstMs: number | null;
  hoverSteadyFps: number | null;
  hoverDroppedPer100: number | null;
  hoverWindows: number;
  hoverLongTasks: number;
  hoverLongTaskMs: number;
  hoverLoafs: number;
  hoverLoafBlockMs: number;
  /** LoAF script entries (each >= 5ms) whose start falls in this card's hover windows */
  hoverLoafScriptMs: number;
  /** Event Timing entries without an interactionId (pointer/mouse over/out/enter/leave...) whose duration
   * (event -> next paint, 8ms-rounded) is >= 16ms, per 100 moves. Not a latency metric: it counts boundary events. */
  boundaryEntriesPer100: number | null;
  /** Event Timing entries of this card reported with a null target (node detached, or an enter/leave event Chrome
   * did not dispatch for lack of listeners), attributed by event timestamp instead */
  targetlessEntries: number;
  /* ---- size ---- */
  domNodes: number;
  svgNodes: number;
  heapMB: number | null;
  heapDeltaMB: number | null;
}

/** Page-wide navigation / vitals (shared by both impls, one page load). */
export interface PageVitals {
  ttfbMs: number | null;
  fcpMs: number | null;
  lcpMs: number | null;
  dclMs: number | null;
  loadMs: number | null;
  cls: number | null;
  inpMs: number | null;
  interactions: number;
  longTasks: number;
  longTaskMs: number;
  tbtMs: number | null;
  jsKB: number | null;
  jsCount: number;
  heapMB: number | null;
}

declare global {
  interface Window {
    __livePerf?: Record<string, PerfSnapshot>;
    __pageVitals?: () => PageVitals;
  }
}

interface EventTimingEntry extends PerformanceEntry {
  interactionId?: number;
  processingStart: number;
  processingEnd: number;
  target?: Node | null;
}
interface LoafScript { startTime: number; duration: number }
interface LoafEntry extends PerformanceEntry {
  blockingDuration?: number;
  scripts?: LoafScript[];
}

/** Slow-interaction thresholds: 50ms is the long-task budget (RAIL / Long Tasks API); 200ms is INP's "good" limit
 * (web.dev/articles/inp: good <= 200ms, needs improvement <= 500ms, poor > 500ms). */
export const SLOW_INT_MS = 50;
export const INP_GOOD_MS = 200;

/* ---------------- shared helpers ---------------- */

const r1 = (x: number) => Math.round(x * 10) / 10;
const r2 = (x: number) => Math.round(x * 100) / 100;
function pq(arr: number[], p: number): number | null {
  if (!arr.length) return null;
  const so = [...arr].sort((a, b) => a - b);
  return r1(so[Math.min(so.length - 1, Math.floor(p * so.length))]);
}
function cap(arr: unknown[], max: number) {
  if (arr.length > max) arr.splice(0, arr.length - (max * 3) / 4);
}

/** `?spin=0` turns the whole-thread probe off so move latency can be compared with and without it. */
export const SPIN_ON = typeof window === "undefined" || new URLSearchParams(window.location.search).get("spin") !== "0";
/** `?probe=off` mounts the cards with no collector, observers or Profiler (only the mount mark), so the probe's own
 * cost (MutationObserver records, getAnimations flushes, Profiler timing) can be measured from outside. */
export const PROBE_ON = typeof window === "undefined" || new URLSearchParams(window.location.search).get("probe") !== "off";
/** `?loadbusy=1`: spin the ping-pong during load too, for the "Main thread busy" load rows. Opt-in: measured on the prod
 * build (bar, ?only=, 8 alternating rounds) the load spin delays the migrated card's first paint by ~5 ms (42.65 [36.6-45.8]
 * vs 37.45 [33.4-42.2] with spin=0; bklit 42.95 vs 43.70, settled unchanged), so first paint must come from runs without it. */
const LOAD_BUSY_ON = SPIN_ON && typeof window !== "undefined" && new URLSearchParams(window.location.search).get("loadbusy") === "1";
/** moves per busy-time slice (each slice gives one per-move sample for the median and spread) */
const SLICE_MOVES = 10;
/** gaps at or below this are scheduling jitter of the ping-pong itself, not work (idle control: 2.7ms busy in 1024ms) */
const SPIN_GAP_MS = 1;
let spinChannel: MessageChannel | null = null;
let spinOn = false;
let spinLast = 0;
function activeCard(): Collector | null {
  for (const c of hovering) if (c.isActive()) return c;
  return null;
}
function spinTick() {
  const now = performance.now();
  const gap = now - spinLast;
  spinLast = now;
  const c = activeCard();
  let loading = false;
  if (LOAD_BUSY_ON) for (const l of collectors) if (l.addLoadGap(now, gap)) loading = true;
  if (!c && !loading) {
    spinOn = false;
    return;
  }
  if (c && gap > SPIN_GAP_MS) c.addBusy(gap);
  spinChannel!.port2.postMessage(0);
}
/** Start the ping-pong if a card is loading or hovered; it stops itself when none is. */
function ensureSpin() {
  if (!SPIN_ON || spinOn) return;
  spinOn = true;
  if (!spinChannel) {
    spinChannel = new MessageChannel();
    spinChannel.port1.onmessage = spinTick;
  }
  spinLast = performance.now();
  spinChannel.port2.postMessage(0);
}

/** Load-time samples across Re-runs in this page session (module state survives the probe remount). */
const loadRuns = new Map<string, { fp: number[]; st: number[] }>();

/** Runs callbacks after the next frame is presented: rAF fires before style/layout/paint, the posted message runs as
 * the first task after that rendering update. One rAF + one message per frame, shared by every collector. */
const afterPaintQueue: Array<(t: number) => void> = [];
let afterPaintScheduled = false;
let afterPaintChannel: MessageChannel | null = null;
function afterNextPaint(cb: (t: number) => void) {
  afterPaintQueue.push(cb);
  if (afterPaintScheduled) return;
  afterPaintScheduled = true;
  if (!afterPaintChannel) {
    afterPaintChannel = new MessageChannel();
    afterPaintChannel.port1.onmessage = () => {
      afterPaintScheduled = false;
      const now = performance.now();
      const q = afterPaintQueue.splice(0);
      for (const f of q) f(now);
    };
  }
  nativeRaf(() => afterPaintChannel!.port2.postMessage(0));
}

/* ---------------- global observers (page-wide, shared) ---------------- */

interface Span { s: number; d: number; b: number; sc: number }
const longTasks: Span[] = [];
const loafs: Span[] = [];
let observersStarted = false;
const vit = { fcp: null as number | null, lcp: null as number | null, cls: 0, clsSeen: false };
// CLS = largest session window (shifts < 1s apart, window <= 5s), per web.dev/articles/cls.
const clsWin = { start: -1, last: -1, value: 0 };
/** page-wide worst duration per interactionId (INP input) */
const pageInteractions = new Map<number, number>();
const collectors = new Set<Collector>();

/** Event timestamps recorded by each card's capture listeners, so an Event Timing entry with a null target (detached
 * by the time it is reported, or an enter/leave event Chrome never dispatched) can still be attributed:
 * entry.startTime is the event's timeStamp. */
const stamps = new Map<string, Array<{ t: number; c: Collector }>>();
function recordStamp(type: string, t: number, c: Collector) {
  let a = stamps.get(type);
  if (!a) stamps.set(type, (a = []));
  a.push({ t, c });
  if (a.length > 512) a.splice(0, 128);
}
function lookupStamp(type: string, t: number): Collector | null {
  const a = stamps.get(type);
  if (!a) return null;
  for (let i = a.length - 1; i >= 0; i--) {
    const d = a[i].t - t;
    if (Math.abs(d) < 0.5) return a[i].c;
    if (d < -1000) break;
  }
  return null;
}
function ownerOf(node: Node | null | undefined): Collector | null {
  if (!node) return null;
  for (const c of collectors) if (c.owns(node)) return c;
  return null;
}

// Synchronous pointermove dispatch cost: window capture runs first on the path, window bubble last (React's root
// listeners and the charts' own element listeners sit in between). A handler that stops propagation drops the sample.
let moveStart = 0;
let moveTarget: EventTarget | null = null;
/** card owning the real pointermove now dispatching (null outside one) */
let moveOwner: Collector | null = null;
/** a dispatch whose bubble listener never ran (stopPropagation) is stale after this long */
const DISPATCH_STALE_MS = 50;
/** the unwrapped requestAnimationFrame: the collector's own frame callbacks must not be attributed to a card */
let rafNative: ((cb: FrameRequestCallback) => number) | null = null;
const nativeRaf = (cb: FrameRequestCallback) => (rafNative ?? requestAnimationFrame)(cb);
/** card that owns the rAF callback now running (inherited by rAF requests it makes, e.g. a motion loop) */
let rafOwner: Collector | null = null;
/** React render that ran inside the current rAF callback (counted by the render row, not twice) */
let rafRender = 0;
/** React render (Profiler actualDuration) that ran inside the current dispatch, e.g. a flushSync or a microtask
 * flush: subtracted so the handler row and the React render row do not count the same work twice. */
let moveRender = 0;
/** Last pointer position seen by any pointermove on the page, and whether the event now dispatching moved it.
 * Chrome re-dispatches a trusted pointermove at the unchanged pointer position whenever layout, scroll or the element
 * under the pointer changes while the pointer rests (a page reload, a reveal animation, the hover chrome itself).
 * Those are not the user moving: an input device never reports the same position twice, so an event that neither
 * changes clientX/Y nor carries movement is browser-synthesised and counts as nothing. */
let lastPtrX = NaN;
let lastPtrY = NaN;
let moveReal = false;

function onEventEntries(list: PerformanceObserverEntryList) {
  for (const raw of list.getEntries()) {
    const e = raw as EventTimingEntry;
    const id = e.interactionId ?? 0;
    if (id) {
      const prev = pageInteractions.get(id);
      if (prev === undefined || e.duration > prev) pageInteractions.set(id, e.duration);
    }
    // Only null targets fall back to timestamps (a connected target outside every card is page-level, e.g.
    // pointerleave on <body>, even when it shares a card's timestamp).
    let c = ownerOf(e.target);
    let targetless = false;
    if (!c && !e.target) {
      c = lookupStamp(e.name, e.startTime) ?? (BOUNDARY.has(e.name) ? lookupStamp("pointermove", e.startTime) : null);
      targetless = c !== null;
    }
    c?.addEventEntry(e, id, targetless);
  }
}

function startObservers() {
  if (observersStarted || typeof PerformanceObserver === "undefined") return;
  observersStarted = true;
  const push = (arr: Span[], s: Span) => {
    arr.push(s);
    cap(arr, 1000);
  };
  const tryObs = (type: string, cb: (l: PerformanceObserverEntryList) => void, extra: object = {}) => {
    try {
      new PerformanceObserver(cb).observe({ type, buffered: true, ...extra } as PerformanceObserverInit);
    } catch {
      /* unsupported */
    }
  };
  tryObs("longtask", (l) =>
    l.getEntries().forEach((e) => push(longTasks, { s: e.startTime, d: e.duration, b: Math.max(0, e.duration - 50), sc: 0 })),
  );
  tryObs("long-animation-frame", (l) =>
    l.getEntries().forEach((raw) => {
      const e = raw as LoafEntry;
      let sc = 0;
      for (const s of e.scripts ?? []) sc += s.duration;
      push(loafs, { s: e.startTime, d: e.duration, b: e.blockingDuration ?? 0, sc });
    }),
  );
  // 16ms is the smallest durationThreshold the API accepts; shorter events are never reported.
  tryObs("event", onEventEntries, { durationThreshold: 16 });
  tryObs("paint", (l) =>
    l.getEntries().forEach((e) => {
      if (e.name === "first-contentful-paint") vit.fcp = e.startTime;
    }),
  );
  tryObs("largest-contentful-paint", (l) =>
    l.getEntries().forEach((e) => {
      vit.lcp = e.startTime;
    }),
  );
  tryObs("layout-shift", (l) =>
    l.getEntries().forEach((e) => {
      const ls = e as unknown as { value: number; hadRecentInput: boolean };
      vit.clsSeen = true;
      if (ls.hadRecentInput) return;
      if (clsWin.start >= 0 && e.startTime - clsWin.last < 1000 && e.startTime - clsWin.start < 5000) {
        clsWin.value += ls.value;
      } else {
        clsWin.start = e.startTime;
        clsWin.value = ls.value;
      }
      clsWin.last = e.startTime;
      if (clsWin.value > vit.cls) vit.cls = clsWin.value;
    }),
  );
  window.addEventListener(
    "pointermove",
    (e) => {
      moveReal = e.clientX !== lastPtrX || e.clientY !== lastPtrY || e.movementX !== 0 || e.movementY !== 0;
      // The first move has no earlier position to compare with, so it counts as real (a single move onto a card still publishes hover data).
      lastPtrX = e.clientX;
      lastPtrY = e.clientY;
      moveStart = moveReal ? performance.now() : 0;
      moveTarget = e.target;
      moveOwner = moveReal ? ownerOf(e.target as Node) : null;
      moveRender = 0;
    },
    { capture: true, passive: true },
  );
  window.addEventListener(
    "pointermove",
    (e) => {
      if (moveTarget !== e.target || !moveStart) return;
      const dt = Math.max(0, performance.now() - moveStart - moveRender);
      moveStart = 0;
      moveOwner?.addDispatch(dt);
      moveOwner = null;
    },
    { passive: true },
  );
}

let rafPatched: typeof window.requestAnimationFrame | null = null;

// Attribute rAF callbacks to the card whose real move requested them (or whose rAF callback did): bklit commits its
// tooltip state in a rAF requested from the pointermove handler (use-scheduled-tooltip.ts:55-67), which runs outside
// the dispatch window. Applies to both impls alike; unattributed requests pass through untouched.
function installRafPatch() {
  if (rafPatched) return;
  rafNative = ((window as unknown as { __perfNativeRaf?: typeof nativeRaf }).__perfNativeRaf ??= window.requestAnimationFrame.bind(window));
  rafPatched = (cb: FrameRequestCallback) => {
    const owner = rafOwner ?? (moveStart && performance.now() - moveStart < DISPATCH_STALE_MS ? moveOwner : null);
    if (!owner) return rafNative!(cb);
    return rafNative!((t) => {
      const s = performance.now();
      rafRender = 0;
      rafOwner = owner;
      try {
        cb(t);
      } finally {
        rafOwner = null;
        owner.addRaf(Math.max(0, performance.now() - s - rafRender));
      }
    });
  };
  window.requestAnimationFrame = rafPatched;
}

/** Put the page's own requestAnimationFrame back once no card is collecting (only if nothing wrapped ours since). */
function removeRafPatch() {
  if (rafPatched && window.requestAnimationFrame === rafPatched && rafNative) window.requestAnimationFrame = rafNative;
  rafPatched = null;
}

export function getPageVitals(): PageVitals {
  startObservers();
  const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  const ok = (x: number | undefined) => (x !== undefined && x > 0 ? r1(x) : null);
  let lt = 0;
  let ltMs = 0;
  let tbt = 0;
  for (const t of longTasks) {
    lt++;
    ltMs += t.d;
    if (vit.fcp !== null && t.s >= vit.fcp && t.d > 50) tbt += t.d - 50;
  }
  let jsBytes = 0;
  let jsCount = 0;
  for (const e of performance.getEntriesByType("resource") as PerformanceResourceTiming[]) {
    if (e.initiatorType === "script" || /\.js(\?|$)/.test(e.name)) {
      jsCount++;
      jsBytes += e.transferSize || e.encodedBodySize || 0;
    }
  }
  // INP: worst interaction, ignoring one per 50 interactions (web.dev/articles/inp). Interactions under the 16ms
  // reporting threshold have no entry; performance.interactionCount (where supported) still counts them.
  const durs = [...pageInteractions.values()].sort((a, b) => b - a);
  const count = Math.max(durs.length, (performance as unknown as { interactionCount?: number }).interactionCount ?? 0);
  const inp = durs.length ? durs[Math.min(durs.length - 1, Math.floor(count / 50))] : null;
  const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
  return {
    ttfbMs: nav ? ok(nav.responseStart) : null,
    fcpMs: vit.fcp === null ? null : r1(vit.fcp),
    lcpMs: vit.lcp === null ? null : r1(vit.lcp),
    dclMs: nav ? ok(nav.domContentLoadedEventEnd) : null,
    loadMs: nav ? ok(nav.loadEventEnd) : null,
    cls: vit.clsSeen || vit.fcp !== null ? Math.round(vit.cls * 10000) / 10000 : null,
    inpMs: inp === null ? null : r1(inp),
    interactions: count,
    longTasks: lt,
    longTaskMs: r1(ltMs),
    tbtMs: vit.fcp === null ? null : r1(tbt),
    jsKB: jsCount ? r1(jsBytes / 1024) : null,
    jsCount,
    heapMB: mem ? r1(mem.usedJSHeapSize / 1048576) : null,
  };
}
if (typeof window !== "undefined" && PROBE_ON) {
  window.__pageVitals = getPageVitals;
  startObservers();
}

function sumSpans(arr: Span[], from: number, to: number) {
  let n = 0;
  let d = 0;
  let b = 0;
  let sc = 0;
  for (const x of arr) {
    if (x.s >= from && x.s <= to) {
      n++;
      d += x.d;
      b += x.b;
      sc += x.sc;
    }
  }
  return { n, d, b, sc };
}

/* ---------------- chunk-load timing (per card) ---------------- */

/** Keyed `${chart}:${impl}`: each card's own lazy import (shared demo module + that side's charts), so the chart's own
 * paint can be timed from its code being ready instead of from the probe mount. */
export const chunkTimes: Record<string, { start: number; end: number | null }> = {};
export function timedImport<T>(key: string, loader: () => Promise<T>): () => Promise<T> {
  return () => {
    if (!chunkTimes[key]) chunkTimes[key] = { start: performance.now(), end: null };
    const c = chunkTimes[key];
    return loader().then((m) => {
      c.end = performance.now();
      return m;
    });
  };
}

/* ---------------- run ids (Re-run remount) + store ---------------- */

const runIds: Record<string, number> = {};
const subs = new Set<() => void>();
/** bumped on every collector flush; the panel polls it (<= 4Hz) instead of rendering per flush */
let version = 0;
/** collectors with the pointer inside and recent input: the panel stays quiet while any is active */
const hovering = new Set<Collector>();
/** A card is hovered AND the pointer moved within REST_MS; a resting pointer is not active, so the panel may publish. */
export const isHoverActive = () => {
  for (const c of hovering) if (c.isMoving()) return true;
  return false;
};
/** any card still loading (not settled): the panel holds its updates so it does not add work to the load it measures */
export const isLoading = () => {
  for (const c of collectors) if (!c.isSettled()) return true;
  return false;
};
export const perfStore = {
  subscribe(f: () => void) {
    subs.add(f);
    return () => void subs.delete(f);
  },
  version: () => version,
  getRun(chart: string) {
    return runIds[chart] ?? 0;
  },
  rerun(chart: string) {
    runIds[chart] = (runIds[chart] ?? 0) + 1;
    version++;
    subs.forEach((f) => f());
  },
};

/* ---------------- collector ---------------- */

// One document.getAnimations() flush per ~40ms tick, shared by every collector
// on the page (it forces a style recalc; per-collector calls would double it).
let animsAt = -1e9;
let animsCache: Animation[] = [];
function sharedAnimations(): Animation[] {
  const now = performance.now();
  if (now - animsAt > 40) {
    animsAt = now;
    animsCache = document.getAnimations();
  }
  return animsCache;
}

const CONTENT_SEL = "svg path, svg rect, svg circle, svg line, svg polygon, svg text, canvas";
const SETTLE_IDLE_MS = 150;
const LIVE_ENTRANCE_WINDOW_MS = 500;
const SETTLE_CAP_MS = 5000;
/** a frame gap over 20ms missed at least one 60Hz vsync */
const DROP_MS = 20;
/** frames / renders count as hover only within this long after the last pointer input */
const ACTIVE_MS = 200;
/** pointer counts as resting (snapshot + panel may publish) this long after its last move */
const REST_MS = 400;
/** per-move rows show "—" until this many real moves are counted (a handful of 0.1ms-quantised samples is noise) */
export const MIN_MOVES = 50;
/** samples before the key and wheel/drag latency rows show */
export const MIN_INPUT_LAT = 3;
const FOCUS_KEYS = new Set(["Tab", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown"]);
/** a Tab keydown outside the card counts for a focusin into it within this long */
const TAB_FOCUS_MS = 300;
/** event types Event Timing reports that a card's capture listeners stamp for null-target attribution */
// Only types React's root already listens to: no capture listeners on non-bubbling enter/leave (extra dispatch work);
// their null-target entries fall back to the causing pointermove's stamp.
const STAMPED = [
  "pointerdown", "pointerup", "pointercancel", "click", "dblclick", "contextmenu", "auxclick", "mousedown", "mouseup",
  "keydown", "keyup", "keypress", "pointerover", "pointerout", "mouseover", "mouseout",
  "gotpointercapture", "lostpointercapture",
] as const;
const BOUNDARY = new Set([
  "pointerover", "pointerout", "pointerenter", "pointerleave", "mouseover", "mouseout", "mouseenter", "mouseleave",
]);

interface FrameBucket { frames: number; sum: number; dropped: number; worst: number; dts: number[] }
const newBucket = (): FrameBucket => ({ frames: 0, sum: 0, dropped: 0, worst: 0, dts: [] });
const fps = (b: FrameBucket) => (b.sum > 0 ? Math.round((b.frames / b.sum) * 10000) / 10 : null);

interface Interaction { dur: number; proc: number; delay: number; pres: number }

export class Collector {
  key: string;
  t0 = performance.now();
  private el: HTMLElement | null = null;
  private mo: MutationObserver | null = null;
  private lastBusy = this.t0;
  private firstPaint: number | null = null;
  // Live line: animations that start within LIVE_ENTRANCE_WINDOW_MS of first paint are its entrance; later ones are
  // per-tick roll motion. Same rule for both impls (bklit fades in by WAAPI, ours by CSS transitions).
  private liveFirstSeen: WeakMap<Animation, number> | null = null;
  // In-card finite animations seen running, with their true end (timeline ms): a CSS/WAAPI one ends between 50ms polls,
  // so crediting its end removes the 0-50ms early bias against the exact MutationObserver stamps of JS animations.
  private runningEnds = new Map<Animation, number>();
  private paintPending = false;
  private settled: number | null = null;
  private capped = false;
  private settleTimer: ReturnType<typeof setInterval> | null = null;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private dirty = true;
  private loadCommits = 0;
  private loadRender = 0;
  private interCommits = 0;
  private interRender = 0;
  private hoverCommits = 0;
  private hoverRender = 0;
  /* per-move main-thread work: dispatch + rAF callbacks (+ hoverRender above) */
  private workDispatch = 0;
  private workRaf = 0;
  /** work and moves since the last presented frame; a frame with moves becomes one workFrames sample */
  private frameWork = 0;
  private busyTotal = 0;
  private sliceBusy = 0;
  private sliceMoves = 0;
  private slices: number[] = [];
  private frameMoves = 0;
  private workFrames: number[] = [];
  private commitLog: number[] = []; // [t, actual, t, actual, ...]
  /* discrete interactions */
  private taps = 0;
  private keys = 0;
  private inter = new Map<number, Interaction>();
  /* hover */
  private moves = 0;
  private boundary = 0;
  private targetless = 0;
  /** hover windows: s = open, last = last real move (or open), closed = explicit close. Counted time ends at
   * min(last + REST_MS, closed): resting inside the card is not hover. */
  private windows: { s: number; last: number; closed: number | null }[] = [];
  /** totals of windows already folded out of `windows` (kept bounded), so the hover metrics stay exact over long sessions */
  private folded = { n: 0, ms: 0, lt: { n: 0, d: 0 }, lf: { n: 0, b: 0, sc: 0 } };
  private enters = 0;
  private inside = false;
  private lastInput = -1e9;
  private lastRealMove = -1e9;
  private raf = 0;
  private lastFrame = 0;
  private loadFps = newBucket();
  private hoverFps = newBucket();
  private firstWorst: number | null = null;
  private steady = newBucket();
  private winStart = 0;
  private moveLat: number[] = [];
  private keyLat: number[] = [];
  private dragLat: number[] = [];
  private keyPending: number[] = [];
  private dragPending: number[] = [];
  private lastTab = -Infinity;
  private movePending: number[] = [];
  private flushAt = 0;
  private dom = 0;
  private svg = 0;
  private domAt = 0;
  private heap0: number | null = (() => {
    const m = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
    return m ? m.usedJSHeapSize : null;
  })();

  /** whole-thread gaps > SPIN_GAP_MS since mount while loading: [end, length, end, length, ...] */
  private loadGaps: number[] = [];

  constructor(public chart: string, public impl: Impl) {
    this.key = `${chart}:${impl}`;
    // mount mark at t0 for outside tools (bench2.js times load work from it, also with ?probe=off)
    if (typeof performance !== "undefined" && performance.mark) performance.mark(`perf-probe:${this.key}`, { startTime: this.t0 });
  }

  /** Record a whole-thread gap while this card is loading; returns whether it still is. */
  addLoadGap(now: number, gap: number) {
    if (this.settled !== null || !this.el) return false;
    if (gap > SPIN_GAP_MS && now > this.t0) this.loadGaps.push(now, gap);
    return true;
  }
  /** busy ms of the recorded gaps overlapping [t0, end] */
  private busyIn(end: number) {
    let b = 0;
    for (let i = 0; i < this.loadGaps.length; i += 2) {
      const e = this.loadGaps[i];
      const s = e - this.loadGaps[i + 1];
      b += Math.max(0, Math.min(e, end) - Math.max(s, this.t0));
    }
    return b;
  }

  isSettled() {
    return this.settled !== null;
  }

  owns(n: Node) {
    return this.el !== null && this.el.contains(n);
  }

  onRender = (_id: string, _phase: string, actual: number) => {
    if (moveStart) moveRender += actual;
    if (rafOwner) rafRender += actual;
    if (this.settled === null) {
      this.loadCommits++;
      this.loadRender += actual;
    } else {
      this.interCommits++;
      this.interRender += actual;
      if (this.isActive()) {
        this.hoverCommits++;
        this.hoverRender += actual;
        this.frameWork += actual;
      }
    }
    this.commitLog.push(performance.now(), actual);
    if (this.commitLog.length > 4000) this.commitLog.splice(0, 1000);
    this.dirty = true;
  };

  start(el: HTMLElement) {
    startObservers();
    this.el = el;
    collectors.add(this);
    installRafPatch();
    if (LOAD_BUSY_ON) ensureSpin();
    if (window.__livePerf) delete window.__livePerf[this.key];
    // Charts that update forever (live line) never go DOM-quiet; for them only
    // finite animations already running at first paint count as "busy" afterwards.
    const live = this.chart === "liveline";
    this.mo = new MutationObserver(() => {
      if (live && this.firstPaint !== null) {
        this.mo?.disconnect(); // a live chart only needs DOM activity until first paint; later records were ignored
        return;
      }
      this.lastBusy = performance.now();
      this.checkPaint();
    });
    this.mo.observe(el, { childList: true, subtree: true, attributes: true, characterData: true });
    this.checkPaint();
    this.beginLoop();
    this.settleTimer = setInterval(() => this.pollSettle(), 50);
    this.flushTimer = setInterval(() => this.flush(), 250);
    el.addEventListener("pointerenter", this.onEnter);
    el.addEventListener("pointerleave", this.onLeave);
    el.addEventListener("pointermove", this.onMove, { passive: true });
    el.addEventListener("pointermove", this.onDragMove, { capture: true, passive: true });
    el.addEventListener("wheel", this.onWheel, { capture: true, passive: true });
    el.addEventListener("focusin", this.onFocusIn, { passive: true });
    document.addEventListener("keydown", this.onDocKey, { capture: true, passive: true });
    for (const t of STAMPED) el.addEventListener(t, this.onStamp, { capture: true, passive: true });
    window.addEventListener("blur", this.onAway);
    document.addEventListener("visibilitychange", this.onVisibility);
    this.flush();
  }

  stop() {
    this.mo?.disconnect();
    if (this.settleTimer) clearInterval(this.settleTimer);
    if (this.flushTimer) clearInterval(this.flushTimer);
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.closeWindow(performance.now());
    collectors.delete(this);
    if (!collectors.size) removeRafPatch();
    window.removeEventListener("blur", this.onAway);
    document.removeEventListener("visibilitychange", this.onVisibility);
    const el = this.el;
    if (el) {
      el.removeEventListener("pointerenter", this.onEnter);
      el.removeEventListener("pointerleave", this.onLeave);
      el.removeEventListener("pointermove", this.onMove);
      el.removeEventListener("pointermove", this.onDragMove, { capture: true });
      el.removeEventListener("wheel", this.onWheel, { capture: true });
      el.removeEventListener("focusin", this.onFocusIn);
      document.removeEventListener("keydown", this.onDocKey, { capture: true });
      for (const t of STAMPED) el.removeEventListener(t, this.onStamp, { capture: true });
    }
    this.el = null;
  }

  /* ---- load ---- */
  private checkPaint() {
    if (this.firstPaint !== null || this.paintPending || !this.el) return;
    if (!this.el.querySelector(CONTENT_SEL)) return;
    this.paintPending = true;
    // content is in the DOM (MutationObserver microtask); stop the clock once the frame that shows it is presented
    afterNextPaint((now) => {
      this.firstPaint = now - this.t0;
      if (this.chart === "liveline") this.liveFirstSeen = new WeakMap();
      this.dirty = true;
    });
  }

  private busyAnimations(now: number): boolean {
    const el = this.el;
    if (!el) return false;
    const seenNow = new Set<Animation>();
    let busy = false;
    for (const a of sharedAnimations()) {
      if (a.playState !== "running" && !a.pending) continue;
      if (this.liveFirstSeen) {
        let seen = this.liveFirstSeen.get(a);
        if (seen === undefined) this.liveFirstSeen.set(a, (seen = performance.now() - this.t0));
        if (seen - (this.firstPaint ?? 0) > LIVE_ENTRANCE_WINDOW_MS) continue;
      }
      const t = (a.effect as KeyframeEffect | null)?.target;
      if (!t || !el.contains(t)) continue;
      const end = a.effect?.getComputedTiming().endTime;
      if (end === Infinity) continue; // infinite loops never "settle"
      busy = true;
      const start = a.startTime;
      if (typeof start === "number" && typeof end === "number" && a.playbackRate > 0) {
        this.runningEnds.set(a, start + end / a.playbackRate);
        seenNow.add(a);
      }
    }
    // gone from the list: finished by itself if its end has passed (credit the end), else cancelled (drop)
    for (const [a, end] of this.runningEnds) {
      if (seenNow.has(a)) continue;
      this.runningEnds.delete(a);
      if (end <= now && end > this.lastBusy) this.lastBusy = end;
    }
    return busy;
  }

  private pollSettle() {
    if (this.settled !== null) return;
    const now = performance.now();
    if (this.firstPaint !== null && this.busyAnimations(now)) this.lastBusy = now;
    if (now - this.t0 >= SETTLE_CAP_MS) {
      this.finishSettle(SETTLE_CAP_MS, true);
    } else if (this.firstPaint !== null && now - this.lastBusy >= SETTLE_IDLE_MS) {
      this.finishSettle(Math.max(this.lastBusy - this.t0, this.firstPaint), false);
    }
  }

  private finishSettle(ms: number, capped: boolean) {
    this.settled = ms;
    this.capped = capped;
    if (this.firstPaint !== null && !capped) {
      let h = loadRuns.get(this.key);
      if (!h) loadRuns.set(this.key, (h = { fp: [], st: [] }));
      h.fp.push(r1(this.firstPaint));
      h.st.push(r1(ms));
    }
    this.mo?.disconnect();
    if (this.settleTimer) clearInterval(this.settleTimer);
    this.settleTimer = null;
    this.measureDom(true);
    this.dirty = true;
  }

  /* ---- interaction ---- */
  private onStamp = (e: Event) => {
    recordStamp(e.type, e.timeStamp, this);
    if (e.type === "pointerout") {
      // leaving to nothing (window edge) or to a node outside the card ends the hover even if pointerleave never comes
      const to = (e as PointerEvent).relatedTarget as Node | null;
      if (this.inside && (!to || !this.el?.contains(to))) this.closeWindow(performance.now());
      return;
    }
    if (e.type === "pointerdown") {
      this.taps++;
      this.stampLat(this.dragPending, this.dragLat, e.timeStamp);
    } else if (e.type === "keydown" && !(e as KeyboardEvent).repeat) {
      this.keys++;
      if (FOCUS_KEYS.has((e as KeyboardEvent).key)) this.stampLat(this.keyPending, this.keyLat, e.timeStamp);
    }
    else return;
    this.lastInput = performance.now();
    this.dirty = true;
  };

  /** input timestamp -> after the next presented frame, same rAF + MessageChannel stop as the move latency */
  private stampLat(pending: number[], out: number[], ts: number) {
    if (pending.length >= 64) return;
    if (!pending.length) {
      afterNextPaint((now) => {
        for (const t of pending) out.push(Math.max(0, now - t));
        pending.length = 0;
        cap(out, 600);
        this.dirty = true;
      });
    }
    pending.push(ts);
  }
  private onWheel = (e: Event) => this.stampLat(this.dragPending, this.dragLat, e.timeStamp);
  /** Tab keydown lands on the previous element, outside the card: remember it for the focusin that follows */
  private onDocKey = (e: KeyboardEvent) => {
    if (e.key === "Tab" && !e.repeat) this.lastTab = e.timeStamp;
  };
  private onFocusIn = (e: Event) => {
    if (e.timeStamp - this.lastTab <= TAB_FOCUS_MS) {
      this.stampLat(this.keyPending, this.keyLat, this.lastTab);
      this.lastTab = -Infinity;
    }
  };

  /** Event Timing entry whose target is in this card (or, for a null target, whose timestamp one of our listeners saw). */
  addEventEntry(e: EventTimingEntry, id: number, targetless: boolean) {
    if (targetless) this.targetless++;
    this.dirty = true;
    if (!id) {
      this.boundary++;
      return;
    }
    // INP-style grouping: an interaction's latency is its longest event (pointerdown/up/click share one id);
    // processing sums the handlers of all its events.
    const proc = Math.max(0, e.processingEnd - e.processingStart);
    const cur = this.inter.get(id);
    if (!cur) {
      this.inter.set(id, {
        dur: e.duration,
        proc,
        delay: Math.max(0, e.processingStart - e.startTime),
        pres: Math.max(0, e.startTime + e.duration - e.processingEnd),
      });
      if (this.inter.size > 1000) this.inter.delete(this.inter.keys().next().value!);
    } else {
      cur.proc += proc;
      if (e.duration > cur.dur) {
        cur.dur = e.duration;
        cur.delay = Math.max(0, e.processingStart - e.startTime);
        cur.pres = Math.max(0, e.startTime + e.duration - e.processingEnd);
      }
    }
  }

  /** the card is inside and a real move happened within ACTIVE_MS: work now is hover work */
  isActive() {
    return this.inside && performance.now() - this.lastRealMove < ACTIVE_MS;
  }

  addDispatch(dt: number) {
    this.workDispatch += dt;
    this.frameWork += dt;
  }

  addBusy(dt: number) {
    this.busyTotal += dt;
    this.sliceBusy += dt;
  }

  addRaf(dt: number) {
    if (!this.isActive()) return;
    this.workRaf += dt;
    this.frameWork += dt;
  }

  /** Sum hover ms and long-task/LoAF spans over `ws`; with no `into`, add the sums to `this.folded` instead (the windows are being dropped). */
  private foldWindows(ws: { s: number; last: number; closed: number | null }[], t: number, intoLt?: { n: number; d: number }, intoLf?: { n: number; b: number; sc: number }) {
    const lt = intoLt ?? this.folded.lt;
    const lf = intoLf ?? this.folded.lf;
    let ms = 0;
    for (const w of ws) {
      const e = Math.min(w.last + REST_MS, w.closed ?? Infinity, t);
      ms += Math.max(0, e - w.s);
      const a = sumSpans(longTasks, w.s, e);
      const b = sumSpans(loafs, w.s, e);
      lt.n += a.n;
      lt.d += a.d;
      lf.n += b.n;
      lf.b += b.b;
      lf.sc += b.sc;
    }
    if (!intoLt) {
      this.folded.ms += ms;
      this.folded.n += ws.length;
    }
    return ms;
  }

  private openWindow(now: number) {
    this.inside = true;
    this.dirty = true; // the open hover window is data too: publish it once the pointer rests
    hovering.add(this);
    this.windows.push({ s: now, last: now, closed: null });
    if (this.windows.length > 200) this.foldWindows(this.windows.splice(0, 50), now);
    if (!this.enters++) this.winStart = now;
    if (!this.raf) {
      this.beginLoop();
      this.lastFrame = now; // count the first frame after enter
    }
  }
  /** Close the hover window (pointerleave, pointerout to outside, window blur, tab hidden, teardown). */
  private closeWindow(now: number) {
    const was = this.inside;
    this.inside = false;
    hovering.delete(this);
    const w = this.windows[this.windows.length - 1];
    if (w && w.closed === null) w.closed = now;
    if (!was) return;
    this.dirty = true;
    if (this.el) setTimeout(() => this.flush(), 120); // one flush after the window closes
  }
  private onEnter = () => {
    if (!this.inside) this.openWindow(performance.now());
  };
  private onLeave = () => this.closeWindow(performance.now());
  private onAway = () => this.closeWindow(performance.now());
  private onVisibility = () => {
    if (document.visibilityState === "hidden") this.closeWindow(performance.now());
  };
  /** Capture phase: a chart that stops propagation of a drag's moves (bubble `onMove` never runs) still gets its drag latency counted. */
  private onDragMove = (e: Event) => {
    if (moveReal && (e as PointerEvent).buttons) this.stampLat(this.dragPending, this.dragLat, e.timeStamp);
  };
  isMoving() {
    return performance.now() - this.lastInput < REST_MS;
  }
  private onMove = (e: Event) => {
    // Only a real move proves the pointer is in the card (pointerenter may not have reached it: the probe remounted
    // under a resting pointer). A browser-synthesised re-dispatch at a resting pointer never opens or extends a window.
    if (!moveReal) return;
    const now = performance.now();
    if (!this.inside) this.openWindow(now);
    const w = this.windows[this.windows.length - 1];
    // a move after resting longer than REST_MS starts a new segment: the rest in between is not hover time
    if (now - w.last > REST_MS) this.windows.push({ s: now, last: now, closed: null });
    else w.last = now;
    this.moves++;
    if (++this.sliceMoves === SLICE_MOVES) {
      this.slices.push(this.sliceBusy / SLICE_MOVES);
      cap(this.slices, 600);
      this.sliceBusy = 0;
      this.sliceMoves = 0;
    }
    ensureSpin();
    this.dirty = true; // moves since the last snapshot: publish once the pointer rests
    recordStamp("pointermove", e.timeStamp, this);
    this.lastInput = now;
    this.lastRealMove = now;
    // pointermove -> next paint. A next-rAF stop would count synchronous handler work but miss work an
    // implementation defers past the rAF (React scheduler macrotasks), so the two impls would not be timed alike.
    this.frameMoves++;
    if (this.movePending.length < 64) {
      if (!this.movePending.length) afterNextPaint(this.afterPaint);
      this.movePending.push(e.timeStamp);
    }
  };
  private afterPaint = (now: number) => {
    for (const ts of this.movePending) this.moveLat.push(Math.max(0, now - ts));
    this.movePending.length = 0;
    cap(this.moveLat, 600);
    // the work of this frame's moves, up to its paint; work with no move yet (a late commit) carries to the next frame
    if (this.frameMoves) {
      this.workFrames.push(this.frameWork);
      cap(this.workFrames, 600);
      this.frameWork = 0;
      this.frameMoves = 0;
    }
  };

  /* ---- fps loop: only while loading or pointer inside ---- */
  private beginLoop() {
    if (this.raf) return;
    this.lastFrame = 0;
    const tick = (t: number) => {
      const loading = this.settled === null;
      if (!loading && !this.inside) {
        this.raf = 0;
        return;
      }
      if (this.lastFrame) {
        const dt = t - this.lastFrame;
        if (loading) this.addFrame(this.loadFps, dt);
        else if (t - this.lastInput < ACTIVE_MS && dt > 0) {
          this.addFrame(this.hoverFps, dt);
          if (this.enters === 1 && t - this.winStart < 300) {
            if (this.firstWorst === null || dt > this.firstWorst) this.firstWorst = dt;
          } else this.addFrame(this.steady, dt);
        }
      }
      this.lastFrame = t;
      this.raf = nativeRaf(tick);
    };
    this.raf = nativeRaf(tick);
  }
  private addFrame(b: FrameBucket, dt: number) {
    b.frames++;
    b.sum += dt;
    if (dt > DROP_MS) b.dropped++;
    if (dt > b.worst) b.worst = dt;
    b.dts.push(dt);
    cap(b.dts, 600);
    if (!this.inside) this.dirty = true;
  }

  /* ---- snapshot ---- */
  private measureDom(force = false) {
    const now = performance.now();
    if (!this.el || (!force && now - this.domAt < 1000)) return;
    this.domAt = now;
    this.dom = this.el.getElementsByTagName("*").length;
    this.svg = this.el.querySelectorAll("svg, svg *").length;
  }

  private flush() {
    if (!this.el) return; // stopped
    const t = performance.now();
    if (this.inside) {
      // active hover: stay silent; only a slow flush once the pointer rests
      if (t - this.lastInput < REST_MS) return;
      if (!this.dirty && t - this.flushAt < 2000) return;
    } else if (!this.dirty) return;
    this.flushAt = t;
    this.dirty = false;
    if (!this.inside) this.measureDom();
    const loadEnd = this.t0 + (this.settled ?? t - this.t0);
    const lt = sumSpans(longTasks, this.t0, loadEnd);
    const lf = sumSpans(loafs, this.t0, loadEnd);
    const iLt = { n: 0, d: 0 };
    const iLf = { n: 0, b: 0, sc: 0 };
    const hoverMs = this.foldWindows(this.windows, t, iLt, iLf) + this.folded.ms;
    iLt.n += this.folded.lt.n;
    iLt.d += this.folded.lt.d;
    iLf.n += this.folded.lf.n;
    iLf.b += this.folded.lf.b;
    iLf.sc += this.folded.lf.sc;
    // Interactions: the ones without an Event Timing entry finished under the 16ms threshold; they count as 16ms
    // (an upper bound) so percentiles cover every interaction, not only the slow ones.
    const durs: number[] = [];
    let worst: Interaction | null = null;
    let s50 = 0;
    let s200 = 0;
    for (const it of this.inter.values()) {
      durs.push(it.dur);
      if (!worst || it.dur > worst.dur) worst = it;
      if (it.dur > SLOW_INT_MS) s50++;
      if (it.dur > INP_GOOD_MS) s200++;
    }
    const total = Math.max(durs.length, this.taps + this.keys);
    for (let i = durs.length; i < total; i++) durs.push(16);
    const ready = this.moves >= MIN_MOVES;
    const per100 = (x: number) => (ready ? r1((x / this.moves) * 100) : null);
    const perMove = (x: number) => (ready ? Math.round((x / this.moves) * 1000) / 1000 : null);
    const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
    const WIN = 2000;
    let wN = 0;
    let wMs = 0;
    for (let i = this.commitLog.length - 2; i >= 0; i -= 2) {
      if (this.commitLog[i] < t - WIN) break;
      wN++;
      wMs += this.commitLog[i + 1];
    }
    const winSec = Math.min(WIN, t - this.t0) / 1000;
    if (wN > 0 && !this.inside) this.dirty = true; // keep decaying the rolling window until it empties
    const budget = entranceBudget[this.chart];
    const snap: PerfSnapshot = {
      key: this.key,
      runAt: this.t0,
      firstPaintMs: this.firstPaint === null ? null : r1(this.firstPaint),
      settledMs: this.settled === null ? null : r1(this.settled),
      settledCapped: this.capped,
      renderMs: this.settled !== null && this.firstPaint !== null && !this.capped && budget ? r1(Math.max(this.firstPaint, this.settled - budget.ms)) : null,
      firstPaintRuns: [...(loadRuns.get(this.key)?.fp ?? [])],
      settledRuns: [...(loadRuns.get(this.key)?.st ?? [])],
      loadCommits: this.loadCommits,
      loadRenderMs: r1(this.loadRender),
      paintBusyMs: this.firstPaint === null || !LOAD_BUSY_ON ? null : r1(this.busyIn(this.t0 + this.firstPaint)),
      loadBusyMs: this.settled === null || !LOAD_BUSY_ON ? null : r1(this.busyIn(this.t0 + this.settled)),
      chunkMs: chunkTimes[this.key]?.end != null ? r1(chunkTimes[this.key].end! - chunkTimes[this.key].start) : null,
      chartPaintMs:
        this.firstPaint !== null && chunkTimes[this.key]?.end != null ? r1(Math.max(0, this.t0 + this.firstPaint - chunkTimes[this.key].end!)) : null,
      loadLongTasks: lt.n,
      loadLongTaskMs: r1(lt.d),
      loadLoafBlockMs: r1(lf.b),
      loadFps: fps(this.loadFps),
      loadDropped: this.loadFps.dropped,
      loadWorstFrameMs: this.loadFps.frames ? r1(this.loadFps.worst) : null,
      interCommits: this.interCommits,
      interRenderMs: r1(this.interRender),
      steadyCommitsPerSec: r1(wN / Math.max(0.25, winSec)),
      steadyCommitMs: wN ? r1(wMs / wN) : null,
      steadyRenderMsPerSec: r1(wMs / Math.max(0.25, winSec)),
      interactions: total,
      interactionsTimed: this.inter.size,
      intP50: pq(durs, 0.5),
      intP95: pq(durs, 0.95),
      intMax: worst ? r1(worst.dur) : total ? 16 : null,
      intWorstProcessingMs: worst ? r1(worst.proc) : null,
      intWorstInputDelayMs: worst ? r1(worst.delay) : null,
      intWorstPresentationMs: worst ? r1(worst.pres) : null,
      slowInt50: s50,
      slowInt200: s200,
      moves: this.moves,
      hoverSec: r1(hoverMs / 1000),
      moveWorkMs: perMove(this.workDispatch + this.workRaf + this.hoverRender),
      moveWorkFrameP95: ready ? pq(this.workFrames, 0.95) : null,
      moveDispatchMs: perMove(this.workDispatch),
      moveRafMs: perMove(this.workRaf),
      moveRenderMs: perMove(this.hoverRender),
      hoverCommitsPer100: per100(this.hoverCommits),
      busyPerMove: SPIN_ON ? perMove(this.busyTotal) : null,
      busyMedian: this.slices.length ? r2([...this.slices].sort((a, b) => a - b)[Math.floor(this.slices.length / 2)]) : null,
      busyLo: this.slices.length ? r2(Math.min(...this.slices)) : null,
      busyHi: this.slices.length ? r2(Math.max(...this.slices)) : null,
      busySlices: this.slices.length,
      moveLatP50: this.moveLat.length >= MIN_MOVES ? pq(this.moveLat, 0.5) : null,
      moveLatP95: this.moveLat.length >= MIN_MOVES ? pq(this.moveLat, 0.95) : null,
      moveLatCount: this.moveLat.length,
      keyLatP50: this.keyLat.length >= MIN_INPUT_LAT ? pq(this.keyLat, 0.5) : null,
      keyLatP95: this.keyLat.length >= MIN_INPUT_LAT ? pq(this.keyLat, 0.95) : null,
      keyLatCount: this.keyLat.length,
      dragLatP50: this.dragLat.length >= MIN_INPUT_LAT ? pq(this.dragLat, 0.5) : null,
      dragLatP95: this.dragLat.length >= MIN_INPUT_LAT ? pq(this.dragLat, 0.95) : null,
      dragLatCount: this.dragLat.length,
      hoverFirstWorstMs: this.firstWorst === null ? null : r1(this.firstWorst),
      hoverSteadyP95Ms: pq(this.steady.dts, 0.95),
      hoverSteadyWorstMs: this.steady.frames ? r1(this.steady.worst) : null,
      hoverSteadyFps: fps(this.steady),
      hoverDroppedPer100: per100(this.hoverFps.dropped),
      hoverWindows: this.folded.n + this.windows.length,
      hoverLongTasks: iLt.n,
      hoverLongTaskMs: r1(iLt.d),
      hoverLoafs: iLf.n,
      hoverLoafBlockMs: r1(iLf.b),
      hoverLoafScriptMs: r1(iLf.sc),
      boundaryEntriesPer100: per100(this.boundary),
      targetlessEntries: this.targetless,
      domNodes: this.dom,
      svgNodes: this.svg,
      heapMB: mem ? r1(mem.usedJSHeapSize / 1048576) : null,
      heapDeltaMB: mem && this.heap0 !== null ? r1((mem.usedJSHeapSize - this.heap0) / 1048576) : null,
    };
    (window.__livePerf ??= {})[this.key] = snap;
    version++; // no React notification here: the panel polls the version at <= 4Hz
  }
}
