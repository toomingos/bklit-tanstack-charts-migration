import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { useEffectEvent } from "./use-effect-event";
import type { ChartPhase } from "./chart-phase";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";
import { isYDomainTweenPhase, resolveAnimatedYDestinationDomains } from './y-domain';
import type { YDomain } from './y-domain';
import { snapDomains, tweenDomains } from "./animated-y-tween";
import type { TweenControl } from "./animated-y-tween";

interface UseAnimatedYDomainsOptions {
  readonly enabled: boolean;
  readonly durationMs: number;
  readonly chartPhase: ChartPhase;
  readonly skeletonByAxis: Record<string, YDomain>;
  readonly targetByAxis: Record<string, YDomain>;
  readonly onSettled?: () => void;
  readonly tweenOnTargetChange?: boolean;
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

// Writes land in an effect so the body stays pure.
// Declared before the tween effects so it always runs first.
const useTweenInputRefs = (args: Readonly<TweenInputRefsArgs>): TweenInputRefs => {
  const destinationRef = useRef(args.destinationByAxis);
  const skeletonRef = useRef(args.skeletonByAxis);
  const targetRef = useRef(args.targetByAxis);
  const onSettledRef = useRef(args.onSettled);
  useEffect(() => {
    destinationRef.current = args.destinationByAxis;
    skeletonRef.current = args.skeletonByAxis;
    targetRef.current = args.targetByAxis;
    onSettledRef.current = args.onSettled;
  });
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

// Trigger subset for the phase-transition effect; passed as one EffectEvent argument.
interface PhaseTrigger {
  readonly chartPhase: ChartPhase;
  readonly durationMs: number;
  readonly enabled: boolean;
  readonly reducedMotion: boolean;
}

// Triggers travel as an EffectEvent argument so the dependency list stays honest.
// Inputs stay latest-but-non-reactive so the reveal fires once per transition.
const usePhaseTweenEffect = (args: Readonly<PhaseEffectArgs>): void => {
  const prevPhaseRef = useRef(args.chartPhase);
  const runEffectForPhase = useEffectEvent(
    (trigger: Readonly<PhaseTrigger>): (() => void) | undefined =>
      runPhaseTween({ ...args, ...trigger }, prevPhaseRef),
  );
  useEffect(
    () =>
      runEffectForPhase({
        chartPhase: args.chartPhase,
        durationMs: args.durationMs,
        enabled: args.enabled,
        reducedMotion: args.reducedMotion,
      }),
    [args.chartPhase, args.durationMs, args.enabled, args.reducedMotion],
  );
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

// Read-only view of the target, sufficient for dep honesty.
// The tween consumes the refs mirror, so the mutable record never flows here.
interface TargetTrigger {
  readonly chartPhase: ChartPhase;
  readonly durationMs: number;
  readonly enabled: boolean;
  readonly reducedMotion: boolean;
  readonly signature: string;
  readonly targetByAxis: Readonly<Record<string, Readonly<YDomain>>>;
  readonly tweenOnTargetChange: boolean;
}

// Triggers travel as an EffectEvent argument so the dependency list stays honest.
// Inputs stay latest-but-non-reactive without breaking the signature-guarded update.
const useTargetTweenEffect = (args: Readonly<TargetEffectArgs>): void => {
  const targetSignature = JSON.stringify(args.targetByAxis);
  const prevTargetSignatureRef = useRef(targetSignature);
  const runEffectForTarget = useEffectEvent(
    (trigger: Readonly<TargetTrigger>): (() => void) | undefined =>
      runTargetTween(
        {
          ...args,
          chartPhase: trigger.chartPhase,
          durationMs: trigger.durationMs,
          enabled: trigger.enabled,
          reducedMotion: trigger.reducedMotion,
          tweenOnTargetChange: trigger.tweenOnTargetChange,
        },
        trigger.signature,
        prevTargetSignatureRef,
      ),
  );
  useEffect(
    () =>
      runEffectForTarget({
        chartPhase: args.chartPhase,
        durationMs: args.durationMs,
        enabled: args.enabled,
        reducedMotion: args.reducedMotion,
        signature: targetSignature,
        targetByAxis: args.targetByAxis,
        tweenOnTargetChange: args.tweenOnTargetChange,
      }),
    [args.chartPhase, args.durationMs, args.enabled, args.reducedMotion, args.tweenOnTargetChange, args.targetByAxis, targetSignature],
  );
};

const useAnimatedYDomains = (options: UseAnimatedYDomainsOptions): Record<string, YDomain> => {
  const reducedMotion = usePrefersReducedMotion();
  const destinationByAxis = resolveAnimatedYDestinationDomains(
    options.chartPhase,
    options.skeletonByAxis,
    options.targetByAxis,
  );
  const refs = useTweenInputRefs({ destinationByAxis, onSettled: options.onSettled, skeletonByAxis: options.skeletonByAxis, targetByAxis: options.targetByAxis });
  const [animatedByAxis, setAnimatedByAxis] = useState(destinationByAxis);
  const animatedRef = useRef(animatedByAxis);
  useEffect(() => {
    animatedRef.current = animatedByAxis;
  }, [animatedByAxis]);
  usePhaseTweenEffect({ animatedRef, chartPhase: options.chartPhase, durationMs: options.durationMs, enabled: options.enabled, reducedMotion, refs, setAnimatedByAxis });
  useTargetTweenEffect({ animatedRef, chartPhase: options.chartPhase, durationMs: options.durationMs, enabled: options.enabled, reducedMotion, refs, setAnimatedByAxis, targetByAxis: options.targetByAxis, tweenOnTargetChange: options.tweenOnTargetChange ?? false });
  return animatedByAxis;
};

export { useAnimatedYDomains };
export type { UseAnimatedYDomainsOptions };
