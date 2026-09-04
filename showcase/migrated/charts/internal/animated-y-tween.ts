import { bezierEasing } from "./bezier-easing";
import type { RefObject } from "react";
import { domainsEqual, shouldTweenYDomain } from "./y-domain";
import type { YDomain } from "./y-domain";

// Pure Y-domain tween engine for useAnimatedYDomains: hosts the rAF loop and the
// Per-axis start/scan helpers so the hook file stays under the size limits.
// Nothing here calls hooks; the hook file owns all hook calls and effects.

// Upper bound of the fallback Y domain used when no axis domain is known yet.
const FALLBACK_DOMAIN_UPPER_BOUND = 100;

const FALLBACK_DOMAIN: YDomain = [0, FALLBACK_DOMAIN_UPPER_BOUND];

// Axis-keyed domain snapshot shared across the tween helpers. Keys are axis
// Ids known only at runtime, so the index signature stays open; the named
// Contract keeps return positions honest about what the map holds.
interface YDomainByAxis {
  readonly [axisId: string]: YDomain;
}

const lerpDomain = (from: Readonly<YDomain>, to: Readonly<YDomain>, progress: number): YDomain => [
    from[0] + (to[0] - from[0]) * progress,
    from[1] + (to[1] - from[1]) * progress,
  ];

// Axis records are built incrementally, so a known axis id may be absent from an older snapshot. The honest nullable return keeps the `??` fallbacks necessary.
const lookupYDomain = (byAxis: Readonly<Record<string, YDomain>>, axisId: string): YDomain | undefined => byAxis[axisId];

interface TweenControl {
  stop: () => void;
}

const snapDomains = (domains: Record<string, YDomain>, setAnimatedByAxis: (next: Record<string, YDomain>) => void, animatedRef: RefObject<Record<string, YDomain>>): void => {
  if (domainsEqual(animatedRef.current, domains)) {return;}
  setAnimatedByAxis(domains);
  animatedRef.current = domains;
};

// Start value for one axis: last animated frame, else the destination itself, else the fallback.
const resolveTweenStartAxis = (fromSnapshot: Readonly<Record<string, YDomain>>, destination: Readonly<Record<string, YDomain>>, axisId: string): YDomain =>
  lookupYDomain(fromSnapshot, axisId) ?? lookupYDomain(destination, axisId) ?? FALLBACK_DOMAIN;

interface TweenAxisScan {
  readonly axisIds: readonly string[];
  readonly fromSnapshot: Readonly<Record<string, YDomain>>;
  readonly destination: Readonly<Record<string, YDomain>>;
}

// True when at least one axis needs an animated tween rather than a snap.
const shouldTweenAnyAxis = (scan: Readonly<TweenAxisScan>): boolean => {
  for (const axisId of scan.axisIds) {
    const from = resolveTweenStartAxis(scan.fromSnapshot, scan.destination, axisId);
    const to = lookupYDomain(scan.destination, axisId) ?? from;
    if (shouldTweenYDomain(from, to)) {
      return true;
    }
  }
  return false;
};

// Freezes the per-axis start snapshot so the rAF loop reads stable inputs.
const snapshotTweenStart = (scan: Readonly<TweenAxisScan>): YDomainByAxis => {
  const fromByAxis: Record<string, YDomain> = {};
  for (const axisId of scan.axisIds) {
    fromByAxis[axisId] = resolveTweenStartAxis(scan.fromSnapshot, scan.destination, axisId);
  }
  return fromByAxis;
};

interface TweenFrame {
  readonly axisIds: readonly string[];
  readonly fromByAxis: Readonly<Record<string, YDomain>>;
  readonly destination: Readonly<Record<string, YDomain>>;
  readonly progress: number;
}

const interpolateTweenFrame = (frame: Readonly<TweenFrame>): YDomainByAxis => {
  const next: Record<string, YDomain> = {};
  for (const axisId of frame.axisIds) {
    const from = lookupYDomain(frame.fromByAxis, axisId) ?? lookupYDomain(frame.destination, axisId) ?? FALLBACK_DOMAIN;
    const to = lookupYDomain(frame.destination, axisId) ?? from;
    next[axisId] = shouldTweenYDomain(from, to) ? lerpDomain(from, to, frame.progress) : to;
  }
  return next;
};

// Builds the eased per-frame interpolator over the frozen start snapshot.
const buildFrameFor = (axisIds: readonly string[], fromByAxis: Readonly<Record<string, YDomain>>, destination: Readonly<Record<string, YDomain>>): ((progress: number) => Record<string, YDomain>) =>
  (progress: number): Record<string, YDomain> => interpolateTweenFrame({ axisIds, destination, fromByAxis, progress });

interface TweenSettle {
  readonly destination: Record<string, YDomain>;
  readonly animatedRef: RefObject<Record<string, YDomain>>;
  readonly setAnimatedByAxis: (next: Record<string, YDomain>) => void;
  readonly onSettled?: () => void;
}

// Final-frame snap shared by the instant path and the rAF completion path.
const settleTween = (settle: Readonly<TweenSettle>): void => {
  snapDomains(settle.destination, settle.setAnimatedByAxis, settle.animatedRef);
  settle.onSettled?.();
};

interface TweenLoopState {
  raf: number;
  stopped: boolean;
}

interface TweenTick extends TweenSettle {
  readonly loop: TweenLoopState;
  readonly start: number;
  readonly total: number;
  readonly frameFor: (progress: number) => Record<string, YDomain>;
}

// One rAF step; module scope so the loop owner stays a short setup function.
const tickTweenFrame = (tick: Readonly<TweenTick>, now: number): void => {
  if (tick.loop.stopped) {return;}
  const linear = Math.min(1, (now - tick.start) / tick.total);
  if (linear >= 1) {
    settleTween(tick);
    return;
  }
  const next = tick.frameFor(bezierEasing(linear));
  tick.animatedRef.current = next;
  tick.setAnimatedByAxis(next);
  tick.loop.raf = requestAnimationFrame((frameNow: number): void => { tickTweenFrame(tick, frameNow); });
};

interface TweenLoop extends TweenSettle {
  readonly durationMs: number;
  readonly frameFor: (progress: number) => Record<string, YDomain>;
}

// Owns the rAF loop; extracted so tweenDomains stays a short decision chain.
const runTweenLoop = (loop: Readonly<TweenLoop>): TweenControl => {
  const state: TweenLoopState = { raf: 0, stopped: false };
  const tick: TweenTick = { animatedRef: loop.animatedRef, destination: loop.destination, frameFor: loop.frameFor, loop: state, onSettled: loop.onSettled, setAnimatedByAxis: loop.setAnimatedByAxis, start: performance.now(), total: Math.max(1, loop.durationMs) };
  state.raf = requestAnimationFrame((now: number): void => { tickTweenFrame(tick, now); });
  return {
    stop: () => {
      state.stopped = true;
      cancelAnimationFrame(state.raf);
    },
  };
};

interface TweenDomainsArgs {
  readonly destination: Record<string, YDomain>;
  readonly durationMs: number;
  readonly enabled: boolean;
  readonly reducedMotion: boolean;
  readonly animatedRef: RefObject<Record<string, YDomain>>;
  readonly setAnimatedByAxis: (next: Record<string, YDomain>) => void;
  readonly onSettled?: () => void;
}

// Settles immediately and skips the loop; hoisted so tweenDomains stays short.
const settleAndSkip = (args: Readonly<TweenDomainsArgs>): undefined => {
  settleTween(args);
  return undefined;
};

const tweenDomains = (args: Readonly<TweenDomainsArgs>): TweenControl | undefined => {
  if (domainsEqual(args.animatedRef.current, args.destination)) {
    args.onSettled?.();
    return undefined;
  }
  if (args.enabled && !args.reducedMotion) {
    const scan: TweenAxisScan = { axisIds: Object.keys(args.destination), destination: args.destination, fromSnapshot: args.animatedRef.current };
    if (shouldTweenAnyAxis(scan)) {
      const frameFor = buildFrameFor(scan.axisIds, snapshotTweenStart(scan), args.destination);
      return runTweenLoop({ animatedRef: args.animatedRef, destination: args.destination, durationMs: args.durationMs, frameFor, onSettled: args.onSettled, setAnimatedByAxis: args.setAnimatedByAxis });
    }
  }
  settleAndSkip(args);
  return undefined;
};

export type { TweenControl, TweenDomainsArgs, TweenSettle, YDomainByAxis };
export {
  lookupYDomain,
  resolveTweenStartAxis,
  runTweenLoop,
  settleTween,
  shouldTweenAnyAxis,
  snapDomains,
  snapshotTweenStart,
  tweenDomains,
};
