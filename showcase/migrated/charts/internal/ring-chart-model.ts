// Ring child classification, renderer-owned track reveal, and chart state hooks.
import { Children, isValidElement, useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { RingCenter } from "./ring-center";
import type { RingData } from "./ring-context";
import { createHoverSource } from "./hover-motion";
import type { HoverSource } from "./hover-motion";
import { clipRevealTiming } from './parity/animation';
import type { ClipReveal, RingEnterTransition } from './parity/animation';
import { REVEAL_DURATION_MS, REVEAL_EASE_CSS } from "./design-tokens";
import { nativeStaggerDelayMs } from "./native-stagger";
// The hooks own contiguous state+effect groups; callers keep call order identical.

const MS_PER_SECOND = 1000;
const RING_TRACK_STAGGER_EACH_S = 0.08;

// Selector for the TanStack marks group rendered inside the chart container.
const MARKS_GROUP_SELECTOR = ".ts-chart__marks";

type RingLineCap = "round" | "butt";

interface RingProps {
  readonly index: number;
  readonly color?: string;
  readonly animate?: boolean;
  readonly showGlow?: boolean;
  readonly lineCap?: RingLineCap;
}

// Boundary predicates: React child types arrive as string-or-constructor unions; narrow once here.
const isFunctionType = <Value,>(value: Value): value is Value & ((...args: readonly never[]) => void) => typeof value === "function";
const isString = <Text,>(text: Text): text is Text & string => typeof text === "string";

const componentDisplayName = (child: Readonly<ReactNode>): string | undefined => {
  if (!isValidElement(child) || !isFunctionType(child.type)) {return undefined;}
  const componentType = child.type;
  return "displayName" in componentType && isString(componentType.displayName)
    ? componentType.displayName
    : undefined;
};

const isRingElement = (child: Readonly<ReactNode>): boolean => componentDisplayName(child) === "Ring"

const isRingCenterElement = (child: Readonly<ReactNode>): boolean => {
  if (isValidElement(child) && child.type === RingCenter) {return true;}
  return componentDisplayName(child) === "RingCenter";
}

interface RingChildConfig {
  readonly index: number;
  readonly color?: string;
  readonly animate: boolean;
  // ShowGlow extracted for prop parity only; glow rendering was dead code and is unread.
  readonly showGlow: boolean;
  readonly lineCap: RingLineCap;
}

interface ClassifiedChildren {
  readonly centerChildren: readonly ReactNode[];
  readonly ringConfigs: readonly RingChildConfig[];
}

const classifyChildren = (children: Readonly<ReactNode>, geometryScrubbing: boolean): ClassifiedChildren => {
  const centerChildren: ReactNode[] = [];
  const ringConfigs: RingChildConfig[] = [];

  for (const child of Children.toArray(children)) {
    if (!isValidElement(child)) {
      // Non-element children carry no ring configuration.
    } else if (isRingCenterElement(child)) {
      centerChildren.push(child);
    } else if (isRingElement(child) && isValidElement<RingProps>(child) && !geometryScrubbing) {
      const { props } = child;
      ringConfigs.push({
        animate: props.animate !== false,
        color: props.color,
        index: props.index,
        lineCap: props.lineCap ?? "round",
        showGlow: props.showGlow !== false,
      });
    } else {
      // Non-ring children and scrubbed rings carry no reveal geometry: only live rings populate the spec.
    }
  }

  return { centerChildren, ringConfigs };
}

const queryRingTrackGroup = (root: ParentNode, index: number): SVGGElement | null =>
  root.querySelector<SVGGElement>(`[data-ts-key="ring-${index}-track"]`);

const findRingTrackGroup = (container: HTMLElement, marksGroup: SVGGElement, index: number): SVGGElement | null =>
  queryRingTrackGroup(marksGroup, index) ?? queryRingTrackGroup(container, index);

const isRingTrackRevealable = (container: HTMLElement, marksGroup: SVGGElement, index: number): boolean =>
  findRingTrackGroup(container, marksGroup, index) !== null;

interface RingRevealQuery {
  readonly container: HTMLElement;
  readonly marksGroup: SVGGElement;
  readonly currData: readonly Readonly<RingData>[];
  readonly currMap: ReadonlyMap<number, RingChildConfig>;
  readonly seen: Set<number>;
}

const considerRingReveal = (params: Readonly<RingRevealQuery & { readonly index: number; readonly toReveal: number[] }>): void => {
  const ringData = params.seen.has(params.index) ? undefined : params.currData[params.index];
  const cfg = ringData ? params.currMap.get(params.index) : undefined;
  if (!ringData || cfg?.animate !== true) {
    if (ringData) {params.seen.add(params.index);}
    return;
  }
  if (!isRingTrackRevealable(params.container, params.marksGroup, params.index)) {return;}
  params.seen.add(params.index);
  params.toReveal.push(params.index);
};

const collectRingsToReveal = (params: Readonly<RingRevealQuery>): number[] => {
  const toReveal: number[] = [];
  for (let i = 0; i < params.currData.length; i += 1) {
    considerRingReveal({ ...params, index: i, toReveal });
  }
  return toReveal;
};

const markRevealStarted = (container: HTMLElement, _marksGroup: SVGGElement): void => {
  const svgForBkm = container.querySelector<SVGElement>("svg.ts-chart");
  if (svgForBkm && (svgForBkm.dataset.bkmRevealed ?? "") === "") {
    svgForBkm.dataset.bkmRevealed = "1";
  }
};

interface RingRevealRefs {
  readonly revealAnimsRef: RefObject<Animation[]>;
  readonly revealDeadlineTimerRef: RefObject<number | null>;
  readonly revealPostPaintCancelRef: RefObject<(() => void) | null>;
  readonly isMountedRef: RefObject<boolean>;
}

const armRingRevealDeadline = (params: Readonly<{ enterStaggerScale: number; revealAnimsRef: RefObject<Animation[]>; revealDeadlineTimerRef: RefObject<number | null>; timing: ClipReveal; toReveal: readonly number[] }>): void => {
  const maxDelayMs = Math.max(
    ...params.toReveal.map((i) => nativeStaggerDelayMs(RING_TRACK_STAGGER_EACH_S * params.enterStaggerScale * MS_PER_SECOND, 0, i, "arc")),
  );
  params.revealDeadlineTimerRef.current = window.setTimeout(() => {
    // No deadline fallback: tracks enter through the renderer now.
  }, params.timing.durationMs + maxDelayMs);
};

const resetRingTrackTransforms = (params: Readonly<{ container: HTMLElement; marksGroup: SVGGElement; toReveal: readonly number[] }>): void => {
  for (const i of params.toReveal) {
    const trackGroup = findRingTrackGroup(params.container, params.marksGroup, i);
    if (trackGroup) {trackGroup.style.transform = "";}
  }
};

interface RingRevealStarterInput {
  readonly container: HTMLElement;
  readonly currData: readonly Readonly<RingData>[];
  readonly currMap: ReadonlyMap<number, RingChildConfig>;
  readonly enterStaggerScale: number;
  readonly revealAnimsRef: RefObject<Animation[]>;
  readonly revealDeadlineTimerRef: RefObject<number | null>;
  readonly revealPostPaintCancelRef: RefObject<(() => void) | null>;
  readonly marksGroup: SVGGElement;
  readonly timing: ClipReveal;
  readonly toReveal: readonly number[];
}

const startRingRevealAnimations = (params: Readonly<RingRevealStarterInput>): void => {
  markRevealStarted(params.container, params.marksGroup);
  armRingRevealDeadline({ enterStaggerScale: params.enterStaggerScale, revealAnimsRef: params.revealAnimsRef, revealDeadlineTimerRef: params.revealDeadlineTimerRef, timing: params.timing, toReveal: params.toReveal });
  resetRingTrackTransforms({ container: params.container, marksGroup: params.marksGroup, toReveal: params.toReveal });
  params.revealPostPaintCancelRef.current = null;
};

interface RingRevealBeginInput {
  readonly container: HTMLElement;
  readonly currData: readonly Readonly<RingData>[];
  readonly currMap: ReadonlyMap<number, RingChildConfig>;
  readonly enterStaggerScale: number;
  readonly revealAnimsRef: RefObject<Animation[]>;
  readonly revealDeadlineTimerRef: RefObject<number | null>;
  readonly revealPostPaintCancelRef: RefObject<(() => void) | null>;
  readonly marksGroup: SVGGElement;
  readonly enterTransition: RingEnterTransition | undefined;
  readonly toReveal: readonly number[];
}

// Timing resolution plus reveal start, split out so the onRender callback stays small.
const beginRingReveal = (params: Readonly<RingRevealBeginInput>): void => {
  const timing = clipRevealTiming(params.enterTransition, REVEAL_DURATION_MS, REVEAL_EASE_CSS);
  startRingRevealAnimations({ container: params.container, currData: params.currData, currMap: params.currMap, enterStaggerScale: params.enterStaggerScale, marksGroup: params.marksGroup, revealAnimsRef: params.revealAnimsRef, revealDeadlineTimerRef: params.revealDeadlineTimerRef, revealPostPaintCancelRef: params.revealPostPaintCancelRef, timing, toReveal: params.toReveal });
};

const cancelRevealAnimations = (revealAnims: readonly Animation[]): void => {
  for (const anim of revealAnims) {
    try { anim.cancel(); } catch {
      // Cancelling a finished animation throws: the teardown already settled it.
    }
  }
};

const flushRingRevealTeardown = (params: Readonly<RingRevealRefs & { readonly revealAnims: Animation[] }>): void => {
  if (params.isMountedRef.current) {return;}
  if (params.revealDeadlineTimerRef.current !== null) {
    globalThis.clearTimeout(params.revealDeadlineTimerRef.current);
    params.revealDeadlineTimerRef.current = null;
  }
  params.revealPostPaintCancelRef.current?.();
  params.revealPostPaintCancelRef.current = null;
  cancelRevealAnimations(params.revealAnims);
  params.revealAnimsRef.current = [];
};

const cancelPendingRingReveal = (params: Readonly<RingRevealRefs & { readonly revealAnims: Animation[] }>): void => {
  const { isMountedRef } = params;
  isMountedRef.current = false;
  globalThis.setTimeout(() => {
    flushRingRevealTeardown(params);
  }, 0);
};

interface UseRingHoverStateOptions {
  readonly hoveredIndex?: number | null;
  readonly onHoverChange?: (index: number | null) => void;
}

interface RingHoverState {
  readonly hoverSource: HoverSource;
}

const useRingHoverState = (options: Readonly<UseRingHoverStateOptions>): RingHoverState => {
  const { hoveredIndex } = options;
  // Package-owned hover: host focus lands in the store below.
  // Center components subscribe to the same source (controlled: notify only).
  const [hoverSource] = useState<HoverSource>(() => createHoverSource());

  useEffect(() => {
    if (hoveredIndex !== undefined) {
      hoverSource.setHovered(hoveredIndex);
    }
  }, [hoveredIndex, hoverSource]);

  return { hoverSource };
};

interface UseRingRevealOptions {
  readonly data: readonly RingData[];
  readonly enterStaggerScale: number;
  readonly enterTransition: RingEnterTransition | undefined;
  readonly geometryScrubbing: boolean;
  readonly ringConfigMap: ReadonlyMap<number, RingChildConfig>;
}

interface RingRevealState {
  readonly handleRender: (args: { container: HTMLElement }) => void;
  readonly hasRevealedRings: () => boolean;
}

const useRingReveal = (options: Readonly<UseRingRevealOptions>): RingRevealState => {
  const { data, enterStaggerScale, enterTransition, geometryScrubbing, ringConfigMap } = options;
  const revealAnimsRef = useRef<Animation[]>([]);
  const revealDeadlineTimerRef = useRef<number | null>(null);
  const revealPostPaintCancelRef = useRef<(() => void) | null>(null);
  const seenRingRevealedRef = useRef<Set<number>>(new Set());
  const isMountedRef = useRef(true);

  /*
   * Stable onRender identity is load-bearing for benchmarked render performance, so inputs arrive via ref read at paint time; an Effect Event cannot be handed to the renderer.
   */
  const revealInputsRef = useRef({ data, enterStaggerScale, enterTransition, geometryScrubbing, ringConfigMap });
  useEffect(() => {
    revealInputsRef.current = { data, enterStaggerScale, enterTransition, geometryScrubbing, ringConfigMap };
  });

  const handleRender = useCallback(({ container }: { container: HTMLElement }): void => {
    const { data: currData, enterStaggerScale: currStagger, enterTransition: currTransition, geometryScrubbing: currScrubbing, ringConfigMap: currMap } = revealInputsRef.current;
    if (currScrubbing) {return;}
    const marksGroup = container.querySelector<SVGGElement>(MARKS_GROUP_SELECTOR);
    if (!marksGroup) {return;}

    const toReveal = collectRingsToReveal({ container, currData, currMap, marksGroup, seen: seenRingRevealedRef.current });
    if (toReveal.length === 0) {return;}

    beginRingReveal({ container, currData, currMap, enterStaggerScale: currStagger, enterTransition: currTransition, marksGroup, revealAnimsRef, revealDeadlineTimerRef, revealPostPaintCancelRef, toReveal });
  }, []);
  const hasRevealedRings = useCallback((): boolean => seenRingRevealedRef.current.size > 0, []);

  useEffect(() => {
    const revealAnims = revealAnimsRef.current;
    isMountedRef.current = true;
    return (): void => {
      cancelPendingRingReveal({ isMountedRef, revealAnims, revealAnimsRef, revealDeadlineTimerRef, revealPostPaintCancelRef });
    };
  }, []);
  return { handleRender, hasRevealedRings };
};

// App-authored mark-group keys only (renderer path keys never parsed).
const RING_MARK_KEY_RE = /^ring-(\d+)-(?:track|progress)$/u;

// Package focus reports markId (`ring-<i>-track|progress`); ring rows carry
// No index in the datum, so the hovered ring resolves from the focused mark.
const ringIndexFromMarkId = (markId: string): number | null => {
  const match = RING_MARK_KEY_RE.exec(markId);
  if (!match) {return null;}
  const index = Number(match[1]);
  return Number.isInteger(index) && index >= 0 ? index : null;
}

export {
  MARKS_GROUP_SELECTOR,
  cancelPendingRingReveal,
  classifyChildren,
  ringIndexFromMarkId,
  useRingHoverState,
  useRingReveal,
};
export type {
  ClassifiedChildren,
  RingChildConfig,
  RingHoverState,
  RingLineCap,
  RingProps,
  RingRevealState,
  UseRingHoverStateOptions,
  UseRingRevealOptions,
};
