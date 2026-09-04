"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { resolveRestingChartPhase } from './chart-phase';
import type { ChartPhase, ChartStatus } from './chart-phase';
import type { ChartDatum } from './types';

// A non-positive stage duration means that animation stage is disabled.
const DISABLED_STAGE_DURATION = 0;

// Epoch counters start at zero and bump by one per transition.
const INITIAL_EPOCH = 0;
const EPOCH_STEP = 1;

interface UseChartPhaseOrchestratorOptions {
  chartStatus: ChartStatus;
  targetData: ChartDatum[];
  skeletonData: ChartDatum[];
  animationDuration: number;
  yDomainTweenDuration: number;
  revealSignature?: string;
  skipEnterReveal?: boolean;
}

interface StatusTransition {
  readonly phase: ChartPhase;
  readonly plotData: "target" | "skeleton" | undefined;
  readonly bumpConceal: boolean;
}

interface StatusTransitionParams {
  readonly chartStatus: ChartStatus;
  readonly prevStatus: ChartStatus;
  readonly animationDuration: number;
  readonly yDomainTweenDuration: number;
}

const resolveReadyTransition = (params: Readonly<StatusTransitionParams>): StatusTransition => {
  if (params.animationDuration <= DISABLED_STAGE_DURATION) {
    if (params.yDomainTweenDuration <= DISABLED_STAGE_DURATION) {return { bumpConceal: false, phase: "revealing", plotData: "target" };}
    return { bumpConceal: false, phase: "gridTweenReady", plotData: undefined };
  }
  return { bumpConceal: false, phase: "exiting", plotData: undefined };
}

const resolveLoadingTransition = (params: Readonly<StatusTransitionParams>): StatusTransition => {
  if (params.animationDuration <= DISABLED_STAGE_DURATION) {
    if (params.yDomainTweenDuration <= DISABLED_STAGE_DURATION) {return { bumpConceal: false, phase: "loading", plotData: "skeleton" };}
    return { bumpConceal: false, phase: "gridTweenLoading", plotData: undefined };
  }
  return { bumpConceal: true, phase: "exitingReady", plotData: undefined };
}

const resolveStatusTransition = (params: Readonly<StatusTransitionParams>): StatusTransition | undefined => {
  if (params.chartStatus === "ready" && params.prevStatus === "loading") {return resolveReadyTransition(params);}
  if (params.chartStatus === "loading" && params.prevStatus === "ready") {return resolveLoadingTransition(params);}
  return undefined;
}

interface TransitionCommit {
  readonly targetData: ChartDatum[];
  readonly skeletonData: ChartDatum[];
  readonly setPlotData: (data: ChartDatum[]) => void;
  readonly setChartPhase: (phase: ChartPhase) => void;
  readonly setIsLoaded: (loaded: boolean) => void;
  readonly setConcealEpoch: (update: number | ((prev: number) => number)) => void;
}

const commitStatusTransition = (transition: Readonly<StatusTransition>, commit: Readonly<TransitionCommit>): void => {
  commit.setIsLoaded(false);
  const plotDataByKind = { skeleton: commit.skeletonData, target: commit.targetData };
  const nextPlotData = transition.plotData === undefined ? undefined : plotDataByKind[transition.plotData];
  if (nextPlotData !== undefined) {commit.setPlotData(nextPlotData);}
  if (transition.bumpConceal) {commit.setConcealEpoch((epoch) => epoch + EPOCH_STEP);}
  commit.setChartPhase(transition.phase);
}

interface ApplyStatusTransitionParams {
  readonly chartStatus: ChartStatus;
  readonly animationDuration: number;
  readonly yDomainTweenDuration: number;
  readonly prevStatusRef: { current: ChartStatus };
  readonly commit: Readonly<TransitionCommit>;
}

const applyStatusTransition = (params: Readonly<ApplyStatusTransitionParams>): void => {
  const prevStatus = params.prevStatusRef.current;
  if (prevStatus === params.chartStatus) {return;}
  params.prevStatusRef.current = params.chartStatus;
  const transition = resolveStatusTransition({ animationDuration: params.animationDuration, chartStatus: params.chartStatus, prevStatus, yDomainTweenDuration: params.yDomainTweenDuration });
  if (transition === undefined) {return;}
  commitStatusTransition(transition, params.commit);
}

const resolvePlotDataSource = (chartPhase: ChartPhase, chartStatus: ChartStatus): "skeleton" | "target" | undefined => {
  switch (chartPhase) {
    case "loading": {
      return chartStatus === "loading" ? "skeleton" : undefined;
    }
    case "exiting": {
      return "skeleton";
    }
    case "exitingReady":
    case "gridTweenLoading":
    case "gridTweenReady":
    case "revealing":
    case "revealingLoading":
    case "ready": {
      return "target";
    }
    default: {
      return undefined;
    }
  }
}

interface RevealTimerParams {
  readonly chartPhase: ChartPhase;
  readonly animationDuration: number;
  readonly setChartPhase: (phase: ChartPhase) => void;
  readonly setIsLoaded: (loaded: boolean) => void;
  readonly setRevealEpoch: (update: number | ((prev: number) => number)) => void;
}

const useRevealTimerEffect = (params: Readonly<RevealTimerParams>): void => {
  const { animationDuration, chartPhase, setChartPhase, setIsLoaded, setRevealEpoch } = params;
  useEffect(() => {
    if (chartPhase !== "revealing") {return undefined;}
    setRevealEpoch((epoch) => epoch + EPOCH_STEP);
    if (animationDuration <= DISABLED_STAGE_DURATION) {
      setChartPhase("ready");
      setIsLoaded(true);
      return undefined;
    }
    const timer = globalThis.setTimeout(() => {
      setChartPhase("ready");
      setIsLoaded(true);
    }, animationDuration);
    return (): void => {  globalThis.clearTimeout(timer); };
  }, [animationDuration, chartPhase, setChartPhase, setIsLoaded, setRevealEpoch]);
}

interface ChartPhaseEffectsParams {
  readonly chartStatus: ChartStatus;
  readonly targetData: ChartDatum[];
  readonly skeletonData: ChartDatum[];
  readonly animationDuration: number;
  readonly yDomainTweenDuration: number;
  readonly revealSignature: string;
  readonly skipEnterReveal: boolean;
  readonly chartPhase: ChartPhase;
  readonly prevStatusRef: { current: ChartStatus };
  readonly phaseRef: { current: ChartPhase };
  readonly setChartPhase: (phase: ChartPhase) => void;
  readonly setPlotData: (data: ChartDatum[]) => void;
  readonly setIsLoaded: (loaded: boolean) => void;
  readonly setConcealEpoch: (update: number | ((prev: number) => number)) => void;
  readonly setRevealEpoch: (update: number | ((prev: number) => number)) => void;
}

const useChartPhaseEffects = (params: Readonly<ChartPhaseEffectsParams>): void => {
  const { animationDuration, chartPhase, chartStatus, prevStatusRef, phaseRef, revealSignature, setChartPhase, setConcealEpoch, setIsLoaded, setPlotData, setRevealEpoch, skeletonData, skipEnterReveal, targetData, yDomainTweenDuration } = params;
  // Keeps notifier guards fresh; declared first so the effects below observe the current phase.
  useEffect(() => {
    phaseRef.current = chartPhase;
  }, [chartPhase, phaseRef]);

  useEffect(() => {
    applyStatusTransition({
      animationDuration,
      chartStatus,
      commit: {
        setChartPhase,
        setConcealEpoch,
        setIsLoaded,
        setPlotData,
        skeletonData,
        targetData,
      },
      prevStatusRef,
      yDomainTweenDuration,
    });
  }, [animationDuration, chartStatus, prevStatusRef, setChartPhase, setConcealEpoch, setIsLoaded, setPlotData, skeletonData, targetData, yDomainTweenDuration]);

  useEffect(() => {
    if (skipEnterReveal) {return;}
    if (chartStatus !== "ready") {return;}
    if (phaseRef.current !== "ready") {return;}
    setChartPhase("revealing");
    setIsLoaded(false);
  }, [chartStatus, phaseRef, revealSignature, setChartPhase, setIsLoaded, skipEnterReveal]);

  useEffect(() => {
    const source = resolvePlotDataSource(chartPhase, chartStatus);
    if (source === "skeleton") {setPlotData(skeletonData);}
    else if (source === "target") {setPlotData(targetData);}
    else {
      // No source for this phase, so the current plot data stays.
    }
  }, [chartPhase, chartStatus, setPlotData, skeletonData, targetData]);

  useRevealTimerEffect({
    animationDuration,
    chartPhase,
    setChartPhase,
    setIsLoaded,
    setRevealEpoch,
  });
}

interface PhaseNotifiers {
  readonly notifyLoadingPulseComplete: () => void;
  readonly notifyRevealConcealComplete: () => void;
  readonly notifyYDomainTweenComplete: () => void;
}

const usePhaseNotifiers = (phaseRef: { readonly current: ChartPhase }, setChartPhase: (phase: ChartPhase) => void): PhaseNotifiers => {
  const notifyLoadingPulseComplete = useCallback(() => {
    if (phaseRef.current !== "exiting") {return;}
    setChartPhase("gridTweenReady");
  }, [phaseRef, setChartPhase]);

  const notifyRevealConcealComplete = useCallback(() => {
    if (phaseRef.current !== "exitingReady") {return;}
    setChartPhase("gridTweenLoading");
  }, [phaseRef, setChartPhase]);

  const notifyYDomainTweenComplete = useCallback(() => {
    if (phaseRef.current === "gridTweenLoading") {
      setChartPhase("loading");
      return;
    }
    if (phaseRef.current === "gridTweenReady") {setChartPhase("revealing");}
  }, [phaseRef, setChartPhase]);

  return { notifyLoadingPulseComplete, notifyRevealConcealComplete, notifyYDomainTweenComplete };
}

interface ChartPhaseOrchestratorResult {
  readonly chartPhase: ChartPhase;
  readonly concealEpoch: number;
  readonly isLoaded: boolean;
  readonly notifyLoadingPulseComplete: () => void;
  readonly notifyRevealConcealComplete: () => void;
  readonly notifyYDomainTweenComplete: () => void;
  readonly plotData: ChartDatum[];
  readonly revealEpoch: number;
}

export const useChartPhaseOrchestrator = ({
  chartStatus,
  targetData,
  skeletonData,
  animationDuration,
  yDomainTweenDuration,
  revealSignature = "",
  skipEnterReveal = false,
}: Readonly<UseChartPhaseOrchestratorOptions>): ChartPhaseOrchestratorResult => {
  const [chartPhase, setChartPhase] = useState<ChartPhase>(() => resolveRestingChartPhase(chartStatus));
  const [plotData, setPlotData] = useState<ChartDatum[]>(() => chartStatus === "loading" ? skeletonData : targetData
  );
  const [revealEpoch, setRevealEpoch] = useState(INITIAL_EPOCH);
  const [concealEpoch, setConcealEpoch] = useState(INITIAL_EPOCH);
  const [isLoaded, setIsLoaded] = useState(() => chartStatus === "ready");
  const prevStatusRef = useRef(chartStatus);
  const phaseRef = useRef(chartPhase);

  useChartPhaseEffects({
    animationDuration,
    chartPhase,
    chartStatus,
    phaseRef,
    prevStatusRef,
    revealSignature,
    setChartPhase,
    setConcealEpoch,
    setIsLoaded,
    setPlotData,
    setRevealEpoch,
    skeletonData,
    skipEnterReveal,
    targetData,
    yDomainTweenDuration,
  });

  const { notifyLoadingPulseComplete, notifyRevealConcealComplete, notifyYDomainTweenComplete } = usePhaseNotifiers(phaseRef, setChartPhase);

  return {
    chartPhase,
    concealEpoch,
    isLoaded,
    notifyLoadingPulseComplete,
    notifyRevealConcealComplete,
    notifyYDomainTweenComplete,
    plotData,
    revealEpoch,
  };
}

export type { UseChartPhaseOrchestratorOptions };
