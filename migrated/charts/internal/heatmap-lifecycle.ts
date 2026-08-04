import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";
import { HEATMAP_LOADING_CONCEAL_MS } from "./heatmap-animation";
import type { ChartStatus } from "./types";

export type HeatmapChartPhase = "loading" | "revealing" | "ready" | "exitingReady";

export type HeatmapRevealMode = "enter" | "fromLoading" | null;

function resolveRestingChartPhase(status: ChartStatus): HeatmapChartPhase {
  return status === "loading" ? "loading" : "ready";
}

export interface HeatmapLifecycleState {
  chartPhase: HeatmapChartPhase;
  revealEpoch: number;
  isLoaded: boolean;
  revealMode: HeatmapRevealMode;
  animateCells: boolean;
}

export function useHeatmapChartLifecycle(
  status: ChartStatus,
  revealSignature: string | number | undefined,
  animationDurationMs: number,
  animate: boolean,
): HeatmapLifecycleState {
  const reducedMotion = usePrefersReducedMotion();
  const animateCells = animate && !reducedMotion;
  const animateEnter = animateCells && animationDurationMs > 0;

  const [chartPhase, setChartPhase] = useState<HeatmapChartPhase>(() => resolveRestingChartPhase(status));
  const [isLoaded, setIsLoaded] = useState(() => status === "ready" && (!animate || animationDurationMs <= 0));
  const [revealEpoch, setRevealEpoch] = useState(0);
  const [revealMode, setRevealMode] = useState<HeatmapRevealMode>(null);
  const prevStatusRef = useRef(status);
  const phaseRef = useRef(chartPhase);
  phaseRef.current = chartPhase;
  const concealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useLayoutEffect(() => {
    const prevStatus = prevStatusRef.current;
    prevStatusRef.current = status;
    if (prevStatus === status) return;

    if (status === "ready" && prevStatus === "loading") {
      if (concealTimerRef.current) {
        clearTimeout(concealTimerRef.current);
        concealTimerRef.current = null;
      }
      setRevealMode("fromLoading");
      setIsLoaded(false);
      setChartPhase("revealing");
      setRevealEpoch((epoch) => epoch + 1);
      return;
    }

    if (status === "loading" && prevStatus === "ready") {
      setRevealMode(null);
      setIsLoaded(false);
      setChartPhase("exitingReady");
      concealTimerRef.current = setTimeout(() => {
        setChartPhase("loading");
        concealTimerRef.current = null;
      }, HEATMAP_LOADING_CONCEAL_MS);
    }
  }, [status]);

  useEffect(() => {
    if (!animateEnter) {
      setIsLoaded(true);
      setChartPhase(resolveRestingChartPhase(status));
      return;
    }
    if (status !== "ready") return;
    if (phaseRef.current !== "ready") return;

    setRevealMode("enter");
    setRevealEpoch((epoch) => epoch + 1);
    setIsLoaded(false);
    setChartPhase("revealing");
  }, [animateEnter, animationDurationMs, status, revealSignature]);

  useEffect(() => {
    if (!animateEnter || chartPhase !== "revealing") return;
    finishTimerRef.current = setTimeout(() => {
      setIsLoaded(true);
      setChartPhase("ready");
      setRevealMode(null);
      finishTimerRef.current = null;
    }, animationDurationMs);
    return () => {
      if (finishTimerRef.current) {
        clearTimeout(finishTimerRef.current);
        finishTimerRef.current = null;
      }
    };
  }, [animateEnter, chartPhase, animationDurationMs, revealEpoch]);

  useEffect(() => {
    return () => {
      if (concealTimerRef.current) clearTimeout(concealTimerRef.current);
      if (finishTimerRef.current) clearTimeout(finishTimerRef.current);
    };
  }, []);

  return { chartPhase, revealEpoch, isLoaded, revealMode, animateCells };
}
