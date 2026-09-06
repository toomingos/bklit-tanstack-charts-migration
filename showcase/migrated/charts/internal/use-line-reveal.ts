// Line-chart reveal orchestration: clip wipe, marker stagger, and reveal cleanup.
import { useCallback, useEffect, useRef } from "react";
import type { RefObject } from "react";
import type { ChartRendererRenderContext } from "@tanstack/charts";
import { markRevealed } from "./reveal-root";
import type { MarkerRevealSeriesConfig } from "./parity/animation";
import type { ChartPhase } from "./chart-phase";
import type { ChartDatum } from "./types";

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
  const { animationDuration, captureRenderContext, chartPhase, containerRef, prefersReducedMotion, revealEpoch } = params;
  const markerRevealAnimsRef = useRef<Animation[]>([]);
  const markerRevealCancelRef = useRef<(() => void) | null>(null);
  // Replay key re-opens a reveal window the bkmRevealed latch closed (signature bumps replay).
  const revealedEpochRef = useRef<number | null>(null);
  const handleRender = useCallback((context: Readonly<ChartRendererRenderContext<ChartDatum, Date, number>>) => {
    captureRenderContext(context);
    const marksGroup = containerRef.current?.querySelector<SVGGElement>(".ts-chart__marks");
    if (!marksGroup) {return;}
    // Renderer owns the entrance: stamp + clear stills the wipe; markers enter natively.
    revealedEpochRef.current = revealEpoch;
    markRevealed(marksGroup);
    marksGroup.style.clipPath = "";
  }, [revealEpoch, captureRenderContext, containerRef]);

  useEffect(() => {
    if (chartPhase !== "revealing") {return;}
    const marks = containerRef.current?.querySelector<SVGGElement>(".ts-chart__marks");
    if (!marks) {return;}
    if (prefersReducedMotion || animationDuration <= 0) {
      marks.style.clipPath = "";
      markRevealed(marks);
    }
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
