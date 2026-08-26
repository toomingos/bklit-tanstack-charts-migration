import * as React from "react";
import type { ChartPhase } from "./chart-phase";
import {
  LINE_LOADING_PULSE_CYCLE_S,
  LINE_LOADING_LOOP_PAUSE_MS,
} from "./design-tokens";
import { fadeGradientStops, resolveFadeSides, viewportFadeGradientAttrs } from "./fade-mask";
import { useSanitizedId } from "./use-sanitized-id";

const CLIP_PADDING = 10;

/** P5.7 FD6 — bklit `line-loading-pulse.tsx:19`. The pulse's three animation
    shapes: a full grow→shrink `loop` while loading, a `exit` that finishes
    whatever half-cycle is in flight, and a grow-only `enter`. Was previously
    an inline union on the component's own `mode` prop, which meant callers had
    no name to import and `resolveLineLoadingPulseMode` had no return type. */
export type LineLoadingPulseMode = "loop" | "exit" | "enter";

/**
 * P5.7 FD6 — bklit `line-loading-pulse.tsx:21-34`, ported verbatim including
 * the `default: null` branch. Maps a chart lifecycle phase onto the pulse mode
 * it should run, or `null` for the phases that draw no pulse at all
 * (`ready`, `revealing`, `exitingReady`, and the two grid-tween phases).
 *
 * Legacy's own unit test (`__tests__/line-loading-pulse.test.ts`) pins exactly
 * these six cases; migrated's `ChartPhase` union (`chart-phase.ts:3-11`) is
 * member-for-member identical to legacy's, so the mapping ports 1:1 with no
 * phase left unaccounted.
 */
export function resolveLineLoadingPulseMode(
  phase: ChartPhase,
): LineLoadingPulseMode | null {
  switch (phase) {
    case "loading":
      return "loop";
    case "exiting":
      return "exit";
    case "revealingLoading":
      return "enter";
    default:
      return null;
  }
}

/** P5.7 — the placeholder series bklit draws while `status="loading"`, ported
    from `generate-chart-skeleton-data.ts:26`. This is the SHAPE only, kept
    internal on purpose: DOC-10/FD7 accepts the public `generateChartSkeletonData`
    surface as deleted, but the values themselves are load-bearing geometry —
    they set the loading y-domain, and therefore the y-gridline positions
    (P5.7 Strand 5 / D257 §4 difference #3). `line-chart.tsx` already inlined
    this exact expression for the pulse path; both callers now share it. */
export const LOADING_SKELETON_POINT_COUNT = 7;

/** bklit `generate-chart-skeleton-data.ts:26` — used when the caller supplies
    no data at all. */
export function loadingSkeletonValue(index: number): number {
  return Math.round(110 + Math.sin(index * 1.15) * 36 + index * 9);
}

/** bklit `generate-chart-skeleton-data.ts:38` (`generateChartSkeletonFromTarget`)
    — lower-magnitude mirror used when real data exists, so the y-domain has
    somewhere to tween FROM. */
export function loadingSkeletonValueFromTarget(index: number): number {
  return Math.round(95 + Math.sin(index * 1.05) * 28 + index * 7);
}

/**
 * The placeholder rows bklit lays out while loading
 * (`time-series-chart-shell.tsx:228-234`): the standalone 7-point series when
 * the caller passed no data, otherwise a lower-magnitude mirror of the real
 * rows so the y-domain has somewhere to tween FROM.
 *
 * Only `dataKey` is populated — callers feed this to `resolveTimeSeriesYDomain`,
 * which reads nothing else. Deliberately NOT the public
 * `generateChartSkeletonData`: DOC-10/FD7 keeps that surface deleted, and
 * these values are needed here as geometry, not as an export.
 */
export function buildLoadingSkeletonRows(
  rowCount: number,
  dataKey: string,
): Record<string, number>[] {
  const fromTarget = rowCount > 0;
  const count = fromTarget ? rowCount : LOADING_SKELETON_POINT_COUNT;
  const value = fromTarget ? loadingSkeletonValueFromTarget : loadingSkeletonValue;
  return Array.from({ length: count }, (_, index) => ({ [dataKey]: value(index) }));
}

/** P5.7 B14 — bklit `loading-sweep.tsx:56` (`hashFract`). A deterministic
    0..1 hash so the placeholder silhouette is stable across renders and across
    QA captures; there is no RNG anywhere in the loading chrome. */
function hashFract(n: number): number {
  const x = Math.sin(n) * 43_758.5453;
  return x - Math.floor(x);
}

/** bklit `loading-sweep.tsx:40-45`. */
const SKELETON_HEIGHT_MIN_PCT = 20;
const SKELETON_HEIGHT_MAX_PCT = 80;

/**
 * P5.7 B14 — bklit `loading-sweep.tsx:62-72` (`getSkeletonHeights`), the bar
 * heights the legacy `BarLoadingSkeleton` draws, as percentages of the plot
 * height. Ported as GEOMETRY and kept internal, on exactly the doctrine
 * `buildLoadingSkeletonRows` above records: DOC-10/FD7 accepts the public
 * `getSkeletonHeights` surface as deleted, but the numbers themselves are what
 * the placeholder looks like, and re-deriving a different silhouette would be
 * a visible divergence rather than a deleted export.
 *
 * The one thing that does NOT carry over is the absolute scale. bklit paints
 * `barH = innerHeight * value/100` with no axis in the way; migrated composes a
 * real `<BarChart>`, whose y-domain is `[0, max*1.1]` put through d3 `.nice()`
 * (`y-domain.ts`) — for this 12-bar set that lands on `[0, 90]`, so every bar
 * renders 100/90 taller than legacy's. There is no fixed point that removes it
 * (`nice()` always overshoots to a step multiple, so no input scaling makes the
 * niced max equal 100×scale), and `BarChart` exposes no y-domain seam in either
 * codebase. The RELATIVE silhouette is exact; the uniform vertical stretch is
 * the measured cost of composing the real chart instead of resurrecting the
 * deleted skeleton — see D341.
 */
export function loadingSkeletonBarHeights(
  count: number,
  seed = 0,
): number[] {
  const range = SKELETON_HEIGHT_MAX_PCT - SKELETON_HEIGHT_MIN_PCT;
  return Array.from(
    { length: count },
    (_, index) =>
      SKELETON_HEIGHT_MIN_PCT +
      Math.floor(hashFract((index + 1) * 12.9898 + seed) * range),
  );
}

/** bklit `generate-chart-skeleton-data.ts:19` — the standalone skeleton's
    x-axis starts here, so the loading state's tick labels are stable and do
    not leak "today". */
const LOADING_SKELETON_BASE_DATE = "2025-01-01";

/**
 * The full standalone skeleton series — dated rows, not just values — for the
 * `*ChartLoading` presets, which have no caller data to mirror.
 * `generateChartSkeletonData({ dataKey })` in bklit terms.
 */
export function buildLoadingSkeletonSeries(
  dataKey: string,
  pointCount: number = LOADING_SKELETON_POINT_COUNT,
): Record<string, unknown>[] {
  const baseDate = new Date(LOADING_SKELETON_BASE_DATE);
  return Array.from({ length: pointCount }, (_, index) => {
    const date = new Date(baseDate);
    date.setDate(baseDate.getDate() + index);
    return { date, [dataKey]: loadingSkeletonValue(index) };
  });
}

export function LoadingLabel({ text, exiting }: { text: string; exiting?: boolean }) {
  if (!text.trim()) return null;
  return (
    <div
      className="ts-bkm-loading-label-wrap"
      data-bkm-loading-exiting={exiting ? "" : undefined}
      aria-live="polite"
      role="status"
    >
      <span className="ts-bkm-loading-label-text">{text}</span>
    </div>
  );
}

export function LineLoadingPulse({
  pathD,
  width,
  height,
  stroke = "var(--foreground)",
  strokeOpacity = 0.5,
  strokeWidth = 2.5,
  mode = "loop",
  loopEpoch = 0,
  onCycleComplete,
}: {
  pathD: string;
  width: number;
  height: number;
  stroke?: string;
  strokeOpacity?: number;
  strokeWidth?: number;
  mode?: LineLoadingPulseMode;
  loopEpoch?: number;
  onCycleComplete?: () => void;
}) {
  const id = useSanitizedId();
  const clipId = `bkm-pulse-clip-${id}`;
  const gradId = `bkm-pulse-grad-${id}`;
  const clipHeight = height + CLIP_PADDING * 2;
  const fadeStops = fadeGradientStops(resolveFadeSides(true));

  const [progress, setProgress] = React.useState(0);
  const animRef = React.useRef<Animation | null>(null);

  React.useEffect(() => {
    const el = document.getElementById(`${clipId}-rect`) as unknown as SVGRectElement | null;
    if (!el || width <= 0) return;
    const half = LINE_LOADING_PULSE_CYCLE_S / 2;
    let cancelled = false;
    const run = (from: number, to: number, dur: number, done?: () => void) => {
      try { animRef.current?.cancel(); } catch { void 0; }
      let start: number | null = null;
      const step = (now: number) => {
        if (cancelled) return;
        if (start === null) start = now;
        const t = Math.min(1, (now - start) / (dur * 1000));
        const cur = from + (to - from) * t;
        setProgress(cur);
        if (t < 1) requestAnimationFrame(step);
        else done?.();
      };
      requestAnimationFrame(step);
    };
    if (mode === "loop") {
      setProgress(0);
      run(0, 1, LINE_LOADING_PULSE_CYCLE_S, () => {
        if (!cancelled) {
          window.setTimeout(() => onCycleComplete?.(), LINE_LOADING_LOOP_PAUSE_MS);
        }
      });
    } else if (mode === "enter") {
      setProgress(0);
      run(0, 0.5, half, () => { if (!cancelled) onCycleComplete?.(); });
    } else if (mode === "exit") {
      const cur = progress;
      if (cur < 0.5) {
        run(cur, 0.5, half * ((0.5 - cur) / 0.5), () => {
          if (!cancelled) run(0.5, 1, half, () => { if (!cancelled) onCycleComplete?.(); });
        });
      } else {
        run(cur, 1, half * ((1 - cur) / 0.5), () => { if (!cancelled) onCycleComplete?.(); });
      }
    }
    return () => { cancelled = true; };
  }, [width, loopEpoch, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const paddedW = width + CLIP_PADDING * 2;
  const rightEdge = width + CLIP_PADDING;
  const clipW = progress <= 0.5 ? (progress / 0.5) * paddedW : (1 - (progress - 0.5) / 0.5) * paddedW;
  const clipX = progress <= 0.5 ? -CLIP_PADDING : rightEdge - clipW;

  if (width <= 0 || !pathD) return null;

  return (
    <>
      <defs>
        <clipPath id={clipId}>
          <rect id={`${clipId}-rect`} height={clipHeight} width={clipW} x={clipX} y={-CLIP_PADDING} />
        </clipPath>
        <linearGradient id={gradId} {...viewportFadeGradientAttrs(width)}>
          {fadeStops.map((s) => (
            <stop key={s.offset} offset={s.offset} stopColor={stroke} stopOpacity={s.opacity} />
          ))}
        </linearGradient>
      </defs>
      <path
        d={pathD}
        fill="none"
        clipPath={`url(#${clipId})`}
        stroke={`url(#${gradId})`}
        strokeLinecap="round"
        strokeWidth={strokeWidth}
        opacity={strokeOpacity}
      />
    </>
  );
}
