import * as React from "react";
import type { RefObject } from "react";
import type { ChartPhase } from "./chart-phase";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";
import { isYDomainTweenPhase, resolveAnimatedYDestinationDomains } from './y-domain';
import type { YDomain } from './y-domain';
import { snapDomains, tweenDomains } from "./animated-y-tween";
import type { TweenControl } from "./animated-y-tween";

export interface UseAnimatedYDomainsOptions {
  enabled: boolean;
  durationMs: number;
  chartPhase: ChartPhase;
  skeletonByAxis: Record<string, YDomain>;
  targetByAxis: Record<string, YDomain>;
  onSettled?: () => void;
  tweenOnTargetChange?: boolean;
}

interface TweenInputRefs {
  readonly destinationRef: RefObject<Record<string, YDomain>>;
  readonly skeletonRef: RefObject<Record<string, YDomain>>;
  readonly targetRef: RefObject<Record<string, YDomain>>;
  readonly onSettledRef: RefObject<(() => void) | undefined>;
}

interface TweenInputRefsArgs {
  readonly destinationByAxis: Record<string, YDomain>;
  readonly skeletonByAxis: Record<string, YDomain>;
  readonly targetByAxis: Record<string, YDomain>;
  readonly onSettled?: () => void;
}

// Render-time ref mirror for the tween inputs; one hook so the main hook stays short.
const useTweenInputRefs = (args: Readonly<TweenInputRefsArgs>): TweenInputRefs => {
  const destinationRef = React.useRef(args.destinationByAxis);
  destinationRef.current = args.destinationByAxis;
  const skeletonRef = React.useRef(args.skeletonByAxis);
  skeletonRef.current = args.skeletonByAxis;
  const targetRef = React.useRef(args.targetByAxis);
  targetRef.current = args.targetByAxis;
  const onSettledRef = React.useRef(args.onSettled);
  onSettledRef.current = args.onSettled;
  return { destinationRef, onSettledRef, skeletonRef, targetRef };
};

interface SettledForwarder {
  readonly onSettledRef: RefObject<(() => void) | undefined>;
}

// Hoisted so effect runners contain no nested functions.
const forwardSettled = (forwarder: Readonly<SettledForwarder>): (() => void) => (): void => {
  forwarder.onSettledRef.current?.();
};

// Hoisted so effect runners contain no nested functions.
const stopControl = (control: Readonly<TweenControl> | undefined): (() => void) | undefined => {
  if (control === undefined) {return undefined;}
  return (): void => { control.stop(); };
};

interface PhaseTweenRun {
  readonly chartPhase: ChartPhase;
  readonly durationMs: number;
  readonly enabled: boolean;
  readonly reducedMotion: boolean;
  readonly animatedRef: RefObject<Record<string, YDomain>>;
  readonly setAnimatedByAxis: (next: Record<string, YDomain>) => void;
  readonly refs: Readonly<TweenInputRefs>;
}

// Snap branch of the phase effect; true when the phase was fully handled by a snap.
const snapForPhase = (run: Readonly<PhaseTweenRun>): boolean => {
  if (run.chartPhase === "exiting" || run.chartPhase === "loading") {
    snapDomains(run.refs.skeletonRef.current, run.setAnimatedByAxis, run.animatedRef);
    return true;
  }
  if (run.chartPhase === "exitingReady" || run.chartPhase === "revealing" || run.chartPhase === "ready") {
    snapDomains(run.refs.targetRef.current, run.setAnimatedByAxis, run.animatedRef);
    return true;
  }
  return false;
};

// Effect body for phase transitions; called unconditionally from the effect so hook order is unchanged.
const runPhaseTween = (run: Readonly<PhaseTweenRun>, prevPhaseRef: RefObject<ChartPhase>): (() => void) | undefined => {
  if (prevPhaseRef.current === run.chartPhase) {return undefined;}
  prevPhaseRef.current = run.chartPhase;
  if (snapForPhase(run)) {return undefined;}
  if (!isYDomainTweenPhase(run.chartPhase)) {return undefined;}
  const control = tweenDomains({
    animatedRef: run.animatedRef,
    destination: run.refs.destinationRef.current,
    durationMs: run.durationMs,
    enabled: run.enabled,
    onSettled: forwardSettled(run.refs),
    reducedMotion: run.reducedMotion,
    setAnimatedByAxis: run.setAnimatedByAxis,
  });
  return stopControl(control);
};

interface PhaseEffectArgs {
  readonly chartPhase: ChartPhase;
  readonly durationMs: number;
  readonly enabled: boolean;
  readonly reducedMotion: boolean;
  readonly animatedRef: RefObject<Record<string, YDomain>>;
  readonly setAnimatedByAxis: (next: Record<string, YDomain>) => void;
  readonly refs: Readonly<TweenInputRefs>;
}

// Owns the phase-transition effect (plus its phase ref) so the main hook stays short.
const usePhaseTweenEffect = (args: Readonly<PhaseEffectArgs>): void => {
  const prevPhaseRef = React.useRef(args.chartPhase);
  React.useEffect(() => runPhaseTween(args, prevPhaseRef), [args.chartPhase, args.durationMs, args.enabled, args.reducedMotion]);
};

interface TargetEffectArgs {
  readonly chartPhase: ChartPhase;
  readonly durationMs: number;
  readonly enabled: boolean;
  readonly reducedMotion: boolean;
  readonly tweenOnTargetChange: boolean;
  readonly targetByAxis: Record<string, YDomain>;
  readonly animatedRef: RefObject<Record<string, YDomain>>;
  readonly setAnimatedByAxis: (next: Record<string, YDomain>) => void;
  readonly refs: Readonly<TweenInputRefs>;
}

// Animated branch of the live-target effect; hoisted so runTargetTween stays short.
const tweenForTargetChange = (run: Readonly<TargetEffectArgs>): (() => void) | undefined => {
  const control = tweenDomains({
    animatedRef: run.animatedRef,
    destination: run.refs.targetRef.current,
    durationMs: run.durationMs,
    enabled: run.enabled,
    onSettled: forwardSettled(run.refs),
    reducedMotion: run.reducedMotion,
    setAnimatedByAxis: run.setAnimatedByAxis,
  });
  return stopControl(control);
};

// Signature guard for the live-target effect; true means "nothing to do".
const shouldSkipTargetTween = (run: Readonly<TargetEffectArgs>, targetSignature: string, prevTargetSignatureRef: RefObject<string>): boolean => {
  const inLivePhase = run.chartPhase === "ready" || run.chartPhase === "revealing";
  if (!inLivePhase) {
    prevTargetSignatureRef.current = targetSignature;
    return true;
  }
  if (prevTargetSignatureRef.current === targetSignature) {return true;}
  prevTargetSignatureRef.current = targetSignature;
  return false;
};

// Effect body for live target updates; called unconditionally from the effect so hook order is unchanged.
const runTargetTween = (run: Readonly<TargetEffectArgs>, targetSignature: string, prevTargetSignatureRef: RefObject<string>): (() => void) | undefined => {
  if (shouldSkipTargetTween(run, targetSignature, prevTargetSignatureRef)) {return undefined;}
  if (run.tweenOnTargetChange && run.chartPhase === "ready") {
    return tweenForTargetChange(run);
  }
  snapDomains(run.refs.targetRef.current, run.setAnimatedByAxis, run.animatedRef);
  return undefined;
};

// Owns the target-signature ref and the live-target effect so the main hook stays short.
const useTargetTweenEffect = (args: Readonly<TargetEffectArgs>): void => {
  const targetSignature = JSON.stringify(args.targetByAxis);
  const prevTargetSignatureRef = React.useRef(targetSignature);
  React.useEffect(() => runTargetTween(args, targetSignature, prevTargetSignatureRef), [args.chartPhase, args.durationMs, args.enabled, args.reducedMotion, args.tweenOnTargetChange, args.targetByAxis, targetSignature]);
};

export const useAnimatedYDomains = (options: UseAnimatedYDomainsOptions): Record<string, YDomain> => {
  const reducedMotion = usePrefersReducedMotion();
  const destinationByAxis = resolveAnimatedYDestinationDomains(
    options.chartPhase,
    options.skeletonByAxis,
    options.targetByAxis,
  );
  const refs = useTweenInputRefs({ destinationByAxis, onSettled: options.onSettled, skeletonByAxis: options.skeletonByAxis, targetByAxis: options.targetByAxis });
  const [animatedByAxis, setAnimatedByAxis] = React.useState(destinationByAxis);
  const animatedRef = React.useRef(animatedByAxis);
  React.useEffect(() => {
    animatedRef.current = animatedByAxis;
  }, [animatedByAxis]);
  usePhaseTweenEffect({ animatedRef, chartPhase: options.chartPhase, durationMs: options.durationMs, enabled: options.enabled, reducedMotion, refs, setAnimatedByAxis });
  useTargetTweenEffect({ animatedRef, chartPhase: options.chartPhase, durationMs: options.durationMs, enabled: options.enabled, reducedMotion, refs, setAnimatedByAxis, targetByAxis: options.targetByAxis, tweenOnTargetChange: options.tweenOnTargetChange ?? false });
  return animatedByAxis;
};
