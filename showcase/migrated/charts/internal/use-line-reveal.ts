// Line-chart reveal orchestration: clip wipe, marker stagger, and reveal cleanup.
import { useCallback, useEffect, useRef } from "react";
import type { RefObject } from "react";
import type { ChartRendererRenderContext } from "@tanstack/charts";
import { runRevealWipe, snapRevealWipe } from "./reveal-wipe";
import {
  cancelPendingMarkerReveal,
  collectMarkerRevealAnimations,
  hasVisibleMarkerSeries,
  scheduleMarkerReveal,
} from "./line-marker-reveal";
import type { MarkerRevealSeriesConfig } from "./line-marker-reveal";
import type { ChartPhase } from "./chart-phase";
import type { ChartDatum } from "./types";
import { MS_PER_SECOND } from "./line-chart-support";

interface LineRevealParams {
  readonly animationDuration: number;
  readonly animationEasing: string;
  readonly captureRenderContext: (context: Readonly<ChartRendererRenderContext<ChartDatum, Date, number>>) => void;
  readonly chartPhase: ChartPhase;
  readonly containerRef: RefObject<HTMLDivElement | null>;
  readonly marginLeft: number;
  readonly marginRight: number;
  readonly markerSeriesConfigs: readonly Readonly<MarkerRevealSeriesConfig>[];
  readonly prefersReducedMotion: boolean;
  readonly revealDurationMs: number;
  readonly revealEasingCss: string;
  readonly revealEpoch: number;
  readonly width: number;
}

interface LineReveal {
  readonly handleRender: (context: Readonly<ChartRendererRenderContext<ChartDatum, Date, number>>) => void;
}

const useLineReveal = (params: Readonly<LineRevealParams>): LineReveal => {
  const { animationDuration, animationEasing, captureRenderContext, chartPhase, containerRef, marginLeft, marginRight, markerSeriesConfigs, prefersReducedMotion, revealDurationMs, revealEasingCss, revealEpoch, width } = params;
  const markerRevealAnimsRef = useRef<Animation[]>([]);
  const markerRevealCancelRef = useRef<(() => void) | null>(null);
  // Replay key re-opens a reveal window the bkmRevealed latch closed (signature bumps replay).
  const revealedEpochRef = useRef<number | null>(null);
  const handleRender = useCallback((context: Readonly<ChartRendererRenderContext<ChartDatum, Date, number>>) => {
    captureRenderContext(context);
    const marksGroup = containerRef.current?.querySelector<SVGGElement>(".ts-chart__marks");
    // Reveal sweep lives in internal/reveal-wipe.ts; its return gates the marker stagger.
    const shouldAnimate = runRevealWipe({
      active: chartPhase === "revealing",
      animationDuration,
      durationMs: revealDurationMs,
      easingCss: revealEasingCss,
      epoch: revealEpoch,
      epochRef: revealedEpochRef,
      marks: marksGroup,
      prefersReducedMotion,
    });
    if (!marksGroup || !shouldAnimate) {return;}
    if (!hasVisibleMarkerSeries(markerSeriesConfigs)) {return;}
    cancelPendingMarkerReveal(markerRevealAnimsRef, markerRevealCancelRef);
    // Marker stagger spans the clip reveal's duration (bklit series-markers.tsx:102).
    const doMarkerReveal = (): void => {
      markerRevealAnimsRef.current.push(...collectMarkerRevealAnimations({
        animationEasing,
        durationSec: revealDurationMs / MS_PER_SECOND,
        innerWidth: Math.max(0, width - marginLeft - marginRight),
        markerSeriesConfigs,
        marksGroup,
      }));
    };
    scheduleMarkerReveal(doMarkerReveal, markerRevealCancelRef);
  }, [animationDuration, animationEasing, revealDurationMs, revealEasingCss, revealEpoch, chartPhase, markerSeriesConfigs, width, marginLeft, marginRight, prefersReducedMotion, captureRenderContext, containerRef]);

  useEffect(() => {
    if (chartPhase !== "revealing") {return;}
    snapRevealWipe({
      active: true,
      animationDuration,
      marks: containerRef.current?.querySelector<SVGGElement>(".ts-chart__marks"),
      prefersReducedMotion,
    });
  }, [chartPhase, animationDuration, prefersReducedMotion, containerRef]);
  useEffect((): (() => void) => () => {
    for (const pendingAnim of markerRevealAnimsRef.current) {
      try {
        pendingAnim.cancel();
      } catch {
        // Animation already settled — nothing to cancel.
      }
    }
    markerRevealAnimsRef.current = [];
    markerRevealCancelRef.current?.();
  }, []);
  return { handleRender };
};

export { useLineReveal };
export type { LineReveal, LineRevealParams };
