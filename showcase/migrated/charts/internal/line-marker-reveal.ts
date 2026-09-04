// Series-marker reveal animations and post-paint reveal scheduling.
import { SERIES_MARKER_ENTER_MS } from "./design-tokens";
import type { SeriesPointMarkerStyle } from "./types";

const MS_PER_SECOND = 1000;
// Active-highlight glow padding is 35% of the marker radius (bklit series-markers.tsx).
const MARKER_HIGHLIGHT_PAD_RATIO = 0.35;
// `radius` default on series/terminal/end markers (distinct field from projection `endpointRadius`).
const DEFAULT_MARKER_RADIUS_PX = 5;

const isFunction = <Subject,>(value: Subject): value is Subject & ((...args: readonly never[]) => void) => typeof value === "function";

interface MarkerRevealSeriesConfig {
  readonly dataKey: string;
  readonly markers: Readonly<SeriesPointMarkerStyle> | undefined;
  readonly showMarkers: boolean | undefined;
  readonly stroke: string;
}

const hasVisibleMarkerSeries = (series: readonly Readonly<MarkerRevealSeriesConfig>[]): boolean =>
  series.some((entry) => entry.showMarkers ?? false);

const resolveMarkerVisualExtent = (markers: Readonly<SeriesPointMarkerStyle> | undefined): number => {
  const radius = markers?.radius ?? DEFAULT_MARKER_RADIUS_PX;
  const strokeWidth = markers?.strokeWidth ?? 2;
  const ringGap = markers?.ringGap ?? 2;
  const outlineWidth = markers?.outlineWidth ?? 0;
  const showActiveHighlight = markers?.showActiveHighlight ?? true;
  const ring = strokeWidth > 0 ? ringGap + strokeWidth : 0;
  const outline = Math.max(outlineWidth, 0);
  const highlightPad = showActiveHighlight ? radius * MARKER_HIGHLIGHT_PAD_RATIO : 0;
  return radius + ring + outline + highlightPad + 2;
};

interface MarkerCircleRevealParams {
  readonly animationEasing: string;
  readonly durationSec: number;
  readonly innerWidth: number;
  readonly visualExtent: number;
}

const playMarkerCircleReveal = (circle: SVGCircleElement, params: Readonly<MarkerCircleRevealParams>): Animation => {
  const cx = Number(circle.getAttribute("cx") ?? "0");
  const leadingEdge = Math.max(0, cx - params.visualExtent);
  const delaySec = params.innerWidth > 0 ? (leadingEdge / params.innerWidth) * params.durationSec : 0;
  return circle.animate(
    [{ filter: "blur(2px)", opacity: 0 }, { filter: "blur(0px)", opacity: 1 }],
    { delay: delaySec * MS_PER_SECOND, duration: SERIES_MARKER_ENTER_MS, easing: params.animationEasing, fill: "backwards" },
  );
};

interface SeriesMarkerRevealParams {
  readonly animationEasing: string;
  readonly durationSec: number;
  readonly innerWidth: number;
  readonly marksGroup: SVGGElement;
  readonly markerSeriesConfigs: readonly Readonly<MarkerRevealSeriesConfig>[];
}

const collectMarkerRevealAnimations = (params: Readonly<SeriesMarkerRevealParams>): Animation[] => {
  const animations: Animation[] = [];
  for (const seriesConfig of params.markerSeriesConfigs.filter((entry) => entry.showMarkers ?? false)) {
    const visualExtent = resolveMarkerVisualExtent(seriesConfig.markers);
    const escaped = `${seriesConfig.dataKey}__marker`.replaceAll('"', String.raw`\"`);
    const group = params.marksGroup.querySelector<SVGGElement>(`.ts-chart__dot[data-ts-key="${escaped}"]`);
    if (group) {
      for (const circle of group.querySelectorAll<SVGCircleElement>("circle")) {
        animations.push(playMarkerCircleReveal(circle, { animationEasing: params.animationEasing, durationSec: params.durationSec, innerWidth: params.innerWidth, visualExtent }));
      }
    }
  }
  return animations;
};

const cancelPendingMarkerReveal = (animationsRef: { current: Animation[] }, cancelRef: { current: (() => void) | null }): void => {
  for (const anim of animationsRef.current) {
    try {
      anim.cancel();
    } catch {
      // Animation already settled — nothing to cancel.
    }
  }
  animationsRef.current = [];
  cancelRef.current?.();
};

// Two post-paint frames plus a macrotask settle before running the callback.
const scheduleAfterTwoFrames = (callback: () => void): (() => void) => {
  let raf1 = 0;
  let raf2 = 0;
  let tId: ReturnType<typeof globalThis.setTimeout> | undefined = undefined;
  let cancelled = false;
  raf1 = globalThis.requestAnimationFrame(() => {
    raf2 = globalThis.requestAnimationFrame(() => {
      tId = globalThis.setTimeout(() => {
        if (!cancelled) {callback();}
      }, 0);
    });
  });
  return (): void => {
    cancelled = true;
    if (raf1) {cancelAnimationFrame(raf1);}
    if (raf2) {cancelAnimationFrame(raf2);}
    if (tId) {globalThis.clearTimeout(tId);}
  };
};

const scheduleMarkerReveal = (doReveal: () => void, cancelRef: { current: (() => void) | null }): void => {
  if (isFunction(globalThis.requestAnimationFrame)) {
    cancelRef.current = scheduleAfterTwoFrames(doReveal);
  } else {
    doReveal();
  }
};

export {
  DEFAULT_MARKER_RADIUS_PX,
  cancelPendingMarkerReveal,
  collectMarkerRevealAnimations,
  hasVisibleMarkerSeries,
  scheduleMarkerReveal,
};
export type { MarkerRevealSeriesConfig };
