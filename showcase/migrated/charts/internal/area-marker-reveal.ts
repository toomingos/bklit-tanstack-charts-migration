// Area marker-reveal-wipe gating plus the series-marker stagger.
// Hook call order is unchanged; logic moved verbatim.
import { useCallback, useEffect, useRef } from "react";
import type { RefObject } from "react";
import type { ChartRendererRenderContext } from "@tanstack/charts";
import { runRevealWipe, snapRevealWipe } from "./reveal-wipe";
import type { RevealWipeEpochRef } from "./reveal-wipe";
import { SERIES_MARKER_ENTER_MS } from "./design-tokens";
import type { MarkerSeriesConfig } from "./series-marker-mark";
import type { ChartDatum, SeriesPointMarkerStyle } from "./types";
import type { ChartPhase } from "./chart-phase";

// Series-marker default radius when a marker config omits one.
const DEFAULT_SERIES_MARKER_RADIUS_PX = 5;
// Series-marker default stroke width when a marker config omits one.
const DEFAULT_SERIES_MARKER_STROKE_WIDTH_PX = 2;
// Series-marker default ring gap when a marker config omits one.
const DEFAULT_SERIES_MARKER_RING_GAP_PX = 2;
// Active-highlight halo padding as a fraction of the marker radius.
const MARKER_HIGHLIGHT_PAD_RATIO = 0.35;
const MS_PER_SECOND = 1000;

const isAnimationFrameScheduler = <Value,>(value: Value): value is Value & typeof globalThis.requestAnimationFrame => typeof value === "function";

// Marker visibility is opt-in; an absent flag reads as hidden.
const isMarkerConfigShown = (config: Readonly<{ showMarkers?: boolean | undefined }>): boolean =>
  config.showMarkers ?? false;

interface AreaRevealContainerRef {
  readonly current: HTMLDivElement | null;
}

interface AreaRevealStateInput {
  readonly animationDuration: number;
  readonly chartPhase: ChartPhase;
  readonly containerRef: AreaRevealContainerRef;
  readonly durationMs: number;
  readonly easingCss: string;
  readonly epoch: number;
  readonly epochRef: RevealWipeEpochRef;
  readonly prefersReducedMotion: boolean;
}

interface AreaRevealState {
  readonly marks: SVGGElement | null | undefined;
  readonly shouldAnimate: boolean;
}

// Queries the marks layer and runs the reveal wipe; extracted so the render callback stays short.
const resolveAreaRevealState = (input: Readonly<AreaRevealStateInput>): AreaRevealState => {
  const marks = input.containerRef.current?.querySelector<SVGGElement>(".ts-chart__marks");
  const shouldAnimate = runRevealWipe({
    active: input.chartPhase === "revealing",
    animationDuration: input.animationDuration,
    durationMs: input.durationMs,
    easingCss: input.easingCss,
    epoch: input.epoch,
    epochRef: input.epochRef,
    marks,
    prefersReducedMotion: input.prefersReducedMotion,
  });
  return { marks, shouldAnimate };
};

interface AreaMarkerAnimsRef {
  current: Animation[];
}

interface AreaMarkerRevealCancelRef {
  current: (() => void) | null;
}

// Settled animations reject on cancel; the list is rebuilt by the reveal below.
const cancelAreaMarkerAnims = (animsRef: AreaMarkerAnimsRef): void => {
  for (const anim of animsRef.current) {
    try {
      anim.cancel();
    } catch {
      // Cancel rejects for settled animations; ignoring it is intentional.
    }
  }
  animsRef.current = [];
};

// Visual extent of one marker config; mirrors the bklit series-marker stagger inputs.
const resolveAreaMarkerVisualExtent = (markers: Readonly<SeriesPointMarkerStyle> | undefined): number => {
  const radius = markers?.radius ?? DEFAULT_SERIES_MARKER_RADIUS_PX;
  const strokeWidth = markers?.strokeWidth ?? DEFAULT_SERIES_MARKER_STROKE_WIDTH_PX;
  const ringGap = markers?.ringGap ?? DEFAULT_SERIES_MARKER_RING_GAP_PX;
  const outlineWidth = markers?.outlineWidth ?? 0;
  const showActiveHighlight = markers?.showActiveHighlight ?? true;
  const ring = strokeWidth > 0 ? ringGap + strokeWidth : 0;
  const outline = Math.max(outlineWidth, 0);
  const highlightPad = showActiveHighlight ? radius * MARKER_HIGHLIGHT_PAD_RATIO : 0;
  return radius + ring + outline + highlightPad + 2;
};

interface AreaMarkerCircleFrame {
  readonly animationEasing: string;
  readonly durationSec: number;
  readonly innerWidth: number;
  readonly visualExtent: number;
}

// Staggers one marker circle with the reveal sweep; extracted so the group walk stays short.
const animateAreaMarkerCircle = (circle: SVGCircleElement, frame: Readonly<AreaMarkerCircleFrame>): Animation => {
  const cx = Number(circle.getAttribute("cx") ?? "0");
  const leadingEdge = Math.max(0, cx - frame.visualExtent);
  const delaySec = frame.innerWidth > 0 ? (leadingEdge / frame.innerWidth) * frame.durationSec : 0;
  return circle.animate(
    [{ filter: "blur(2px)", opacity: 0 }, { filter: "blur(0px)", opacity: 1 }],
    { delay: delaySec * MS_PER_SECOND, duration: SERIES_MARKER_ENTER_MS, easing: frame.animationEasing, fill: "backwards" },
  );
};

interface AreaMarkerStaggerFrame {
  readonly animationEasing: string;
  readonly durationSec: number;
  readonly innerWidth: number;
}

interface AreaMarkerGroupInput {
  readonly config: Readonly<MarkerSeriesConfig>;
  readonly frame: Readonly<AreaMarkerStaggerFrame>;
  readonly marks: SVGGElement;
}

// Reveal animations for one marker config; empty when its dot group is absent.
const revealAreaMarkerGroup = (input: Readonly<AreaMarkerGroupInput>): Animation[] => {
  const visualExtent = resolveAreaMarkerVisualExtent(input.config.markers);
  const escaped = `${input.config.dataKey}__marker`.replaceAll('"', String.raw`\"`);
  const group = input.marks.querySelector<SVGGElement>(`.ts-chart__dot[data-ts-key="${escaped}"]`);
  if (!group) {return [];}
  const anims: Animation[] = [];
  const circles = group.querySelectorAll<SVGCircleElement>("circle");
  for (const circle of circles) {
    anims.push(animateAreaMarkerCircle(circle, { ...input.frame, visualExtent }));
  }
  return anims;
};

interface AreaMarkerCollectInput {
  readonly animsRef: AreaMarkerAnimsRef;
  readonly configs: readonly Readonly<MarkerSeriesConfig>[];
  readonly frame: Readonly<AreaMarkerStaggerFrame>;
  readonly marks: SVGGElement;
}

// Runs the marker stagger for every opted-in config; extracted so the reveal runner stays short.
const collectAreaMarkerAnims = (input: Readonly<AreaMarkerCollectInput>): void => {
  for (const cfg of input.configs.filter((candidate) => isMarkerConfigShown(candidate))) {
    input.animsRef.current.push(...revealAreaMarkerGroup({ config: cfg, frame: input.frame, marks: input.marks }));
  }
};

interface AreaMarkerRevealState {
  cancelled: boolean;
  readonly raf1: number;
  raf2: number;
  tId: ReturnType<typeof globalThis.setTimeout> | 0;
}

interface AreaMarkerRevealSchedule {
  readonly animationEasing: string;
  readonly animsRef: AreaMarkerAnimsRef;
  readonly cancelRef: AreaMarkerRevealCancelRef;
  readonly configs: readonly Readonly<MarkerSeriesConfig>[];
  readonly durationMs: number;
  readonly innerWidth: number;
  readonly marks: SVGGElement;
}

// Defers the marker stagger by two frames so the clip sweep has started; reuses the prior cancel.
const scheduleAreaMarkerReveal = (schedule: Readonly<AreaMarkerRevealSchedule>): void => {
  schedule.cancelRef.current?.();
  // Marker stagger spans the clip reveal's duration (bklit series-markers.tsx:102).
  const durationSec = schedule.durationMs / MS_PER_SECOND;
  const frame: AreaMarkerStaggerFrame = { animationEasing: schedule.animationEasing, durationSec, innerWidth: schedule.innerWidth };
  if (!isAnimationFrameScheduler(globalThis.requestAnimationFrame)) {
    collectAreaMarkerAnims({ animsRef: schedule.animsRef, configs: schedule.configs, frame, marks: schedule.marks });
    return;
  }
  const state: AreaMarkerRevealState = { cancelled: false, raf1: 0, raf2: 0, tId: 0 };
  const doReveal = (): void => {
    collectAreaMarkerAnims({ animsRef: schedule.animsRef, configs: schedule.configs, frame, marks: schedule.marks });
  };
  schedule.cancelRef.current = (): void => {
    state.cancelled = true;
    if (state.raf1) {cancelAnimationFrame(state.raf1);}
    if (state.raf2) {cancelAnimationFrame(state.raf2);}
    if (state.tId !== 0) {globalThis.clearTimeout(state.tId);}
  };
  globalThis.requestAnimationFrame(() => {
    state.raf2 = globalThis.requestAnimationFrame(() => {
      state.tId = globalThis.setTimeout(() => {
        if (!state.cancelled) {doReveal();}
      }, 0);
    });
  });
};

interface AreaRevealParams {
  readonly animationDuration: number;
  readonly animationEasing: string;
  readonly areaMarkerConfigs: readonly Readonly<MarkerSeriesConfig>[];
  readonly captureRenderContext: (context: ChartRendererRenderContext<ChartDatum, Date, number>) => void;
  readonly chartPhase: ChartPhase;
  readonly containerRef: RefObject<HTMLDivElement | null>;
  readonly innerWidth: number;
  readonly prefersReducedMotion: boolean;
  readonly revealDurationMs: number;
  readonly revealEasingCss: string;
  readonly revealEpoch: number;
}

interface AreaReveal {
  readonly handleRender: (context: ChartRendererRenderContext<ChartDatum, Date, number>) => void;
}

const useAreaReveal = (params: Readonly<AreaRevealParams>): AreaReveal => {
  const {
    animationDuration,
    animationEasing,
    areaMarkerConfigs,
    captureRenderContext,
    chartPhase,
    containerRef,
    innerWidth,
    prefersReducedMotion,
    revealDurationMs,
    revealEasingCss,
    revealEpoch,
  } = params;
  const areaMarkerRevealAnimsRef = useRef<Animation[]>([]);
  const areaMarkerRevealCancelRef = useRef<(() => void) | null>(null);
  // Replay key re-opens a reveal window the bkmRevealed latch closed (signature bumps replay).
  const revealedEpochRef = useRef<number | null>(null);
  // Reveal sweep lives in internal/reveal-wipe.ts; its return gates the marker stagger.
  const handleRender = useCallback((context: ChartRendererRenderContext<ChartDatum, Date, number>) => {
    captureRenderContext(context);
    const reveal = resolveAreaRevealState({
      animationDuration,
      chartPhase,
      containerRef,
      durationMs: revealDurationMs,
      easingCss: revealEasingCss,
      epoch: revealEpoch,
      epochRef: revealedEpochRef,
      prefersReducedMotion,
    });
    const { marks } = reveal;
    if (!marks || !reveal.shouldAnimate) {return;}
    if (!areaMarkerConfigs.some((cfg: Readonly<MarkerSeriesConfig>) => cfg.showMarkers ?? false)) {return;}
    cancelAreaMarkerAnims(areaMarkerRevealAnimsRef);
    scheduleAreaMarkerReveal({
      animationEasing,
      animsRef: areaMarkerRevealAnimsRef,
      cancelRef: areaMarkerRevealCancelRef,
      configs: areaMarkerConfigs,
      durationMs: revealDurationMs,
      innerWidth,
      marks,
    });
  }, [animationDuration, animationEasing, revealDurationMs, revealEasingCss, revealEpoch, chartPhase, areaMarkerConfigs, innerWidth, prefersReducedMotion, captureRenderContext, containerRef]);

  useEffect(() => {
    if (chartPhase !== "revealing") {return;}
    snapRevealWipe({
      active: true,
      animationDuration,
      marks: containerRef.current?.querySelector<SVGGElement>(".ts-chart__marks"),
      prefersReducedMotion,
    });
  }, [chartPhase, animationDuration, prefersReducedMotion, containerRef]);
  useEffect((): () => void => (): void => {
    // Settled animations reject on cancel; unmount discards them.
    for (const anim of areaMarkerRevealAnimsRef.current) {
      try {
        anim.cancel();
      } catch {
        // Cancel rejects for settled animations; ignoring it is intentional.
      }
    }
    areaMarkerRevealCancelRef.current?.();
  }, []);

  return { handleRender };
};

export { useAreaReveal };
export type { AreaReveal, AreaRevealParams };
