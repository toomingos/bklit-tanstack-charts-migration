import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import type { RefObject } from "react";
import type { ChartPhase } from "./chart-phase";

interface TerminalMarkerAnchor {
  readonly dataKey: string;
  readonly cx: number;
  readonly cy: number;
  readonly fill: string;
  readonly stroke: string;
  readonly radius: number;
  readonly ringGap: number;
  readonly strokeWidth: number;
  readonly outlineWidth: number;
  readonly outlineColor?: string;
}

interface ProjectionPhaseHandle {
  setPhase: (phase: ChartPhase) => void
}

// WAAPI/state transforms for the terminal-marker show/hide cycle.
const TERMINAL_MARKER_VISIBLE_TRANSFORM = "scale(1)";
const TERMINAL_MARKER_HIDDEN_TRANSFORM = "scale(0.55)";

const isTerminalMarkerPhaseVisible = (phase: ChartPhase): boolean => phase === "ready" || phase === "exitingReady";


const isProjectionEndMarkerPhaseVisible = (phase: ChartPhase): boolean => phase === "revealing" || phase === "ready" || phase === "exitingReady";


// Latest-value mirror so WAAPI callbacks read fresh props without re-subscribing.
// Synced in a layout effect: before paint, before any handler can run.
// Never assigned during render, so the render body stays pure.
const useFreshRef = <Value,>(value: Value): RefObject<Value> => {
  const ref = useRef<Value>(value);
  useLayoutEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}

interface TerminalMarkerRefs {
  readonly endGroupRef: RefObject<SVGGElement | null>;
  readonly markerRefs: RefObject<Map<string, SVGGElement>>;
  readonly lastPhaseRef: RefObject<ChartPhase | null>;
  readonly runningAnimsRef: RefObject<Map<string, Animation>>;
}

// Bundles the overlay's mutable refs so the component shell stays under the statement budget.
// Hook order matches the original inline useRefs.
const useTerminalMarkerRefs = (): TerminalMarkerRefs => {
  const endGroupRef = useRef<SVGGElement | null>(null);
  const markerRefs = useRef<Map<string, SVGGElement>>(new Map());
  const lastPhaseRef = useRef<ChartPhase | null>(null);
  const runningAnimsRef = useRef<Map<string, Animation>>(new Map());
  // Memoized so downstream useCallback/useLayoutEffect deps stay stable across renders.
  return useMemo(
    () => ({ endGroupRef, lastPhaseRef, markerRefs, runningAnimsRef }),
    [endGroupRef, markerRefs, lastPhaseRef, runningAnimsRef],
  );
}

// The maps and elements below are deliberately mutated in place: the WAAPI
// show/hide cycle writes element styles and the animation registry directly,
// exactly as the pre-split implementation did. Copies would desync the cycle.
const cancelRunningMarkerAnim = (runningAnims: Map<string, Animation>, key: string): void => {
  const existing = runningAnims.get(key);
  if (!existing) { return; }
  try {
    existing.cancel();
  } catch {
    // Detached-DOM teardown race.
  }
  runningAnims.delete(key);
}

const setMarkerReducedMotionState = (element: SVGGElement, visible: boolean): void => {
  element.style.opacity = visible ? "1" : "0";
  element.style.transform = visible ? TERMINAL_MARKER_VISIBLE_TRANSFORM : TERMINAL_MARKER_HIDDEN_TRANSFORM;
}

interface MarkerTransitionParams {
  readonly element: SVGGElement;
  readonly markerKey: string;
  readonly runningAnims: Map<string, Animation>;
  readonly durationMs: number;
  readonly easing: string;
}

const animateMarkerToVisible = (params: Readonly<MarkerTransitionParams>): void => {
  const { element, markerKey, runningAnims, durationMs, easing } = params;
  element.style.opacity = "0";
  element.style.transform = TERMINAL_MARKER_HIDDEN_TRANSFORM;
  const anim = element.animate(
    [
      { opacity: 0, transform: TERMINAL_MARKER_HIDDEN_TRANSFORM },
      { opacity: 1, transform: TERMINAL_MARKER_VISIBLE_TRANSFORM },
    ],
    { duration: durationMs, easing, fill: "forwards" },
  );
  runningAnims.set(markerKey, anim);
  anim.onfinish = (): void => {
    runningAnims.delete(markerKey);
    element.style.opacity = "1";
    element.style.transform = TERMINAL_MARKER_VISIBLE_TRANSFORM;
  };
  anim.addEventListener("cancel", (): void => {
    runningAnims.delete(markerKey);
  });
}

const animateMarkerToHidden = (params: Readonly<MarkerTransitionParams>): void => {
  const { element, markerKey, runningAnims, durationMs, easing } = params;
  element.style.opacity = "1";
  element.style.transform = TERMINAL_MARKER_VISIBLE_TRANSFORM;
  const anim = element.animate(
    [
      { opacity: 1, transform: TERMINAL_MARKER_VISIBLE_TRANSFORM },
      { opacity: 0, transform: TERMINAL_MARKER_HIDDEN_TRANSFORM },
    ],
    { duration: durationMs, easing, fill: "forwards" },
  );
  runningAnims.set(markerKey, anim);
  anim.onfinish = (): void => {
    runningAnims.delete(markerKey);
    element.style.opacity = "0";
    element.style.transform = TERMINAL_MARKER_HIDDEN_TRANSFORM;
  };
  anim.addEventListener("cancel", (): void => {
    runningAnims.delete(markerKey);
  });
}

interface TerminalVisibilityParams {
  readonly markers: ReadonlyMap<string, SVGGElement>;
  readonly runningAnims: Map<string, Animation>;
  readonly prefersReduced: boolean;
  readonly durationMs: number;
  readonly easing: string;
  readonly visible: boolean;
}

const applyTerminalVisibilityToAll = (params: Readonly<TerminalVisibilityParams>): void => {
  const { markers, runningAnims, prefersReduced, durationMs, easing, visible } = params;
  for (const [key, element] of markers) {
    cancelRunningMarkerAnim(runningAnims, key);
    if (prefersReduced) {
      setMarkerReducedMotionState(element, visible);
    } else if (visible) {
      animateMarkerToVisible({ durationMs, easing, element, markerKey: key, runningAnims });
    } else {
      animateMarkerToHidden({ durationMs, easing, element, markerKey: key, runningAnims });
    }
  }
}

interface ReplayMarkerParams extends MarkerTransitionParams {
  readonly prefersReduced: boolean;
}

const replayVisibleTerminalMarker = (params: Readonly<ReplayMarkerParams>): void => {
  const { element, prefersReduced } = params;
  if (params.runningAnims.has(params.markerKey)) { return; }
  if (element.style.opacity === "1") { return; }
  if (prefersReduced) {
    setMarkerReducedMotionState(element, true);
    return;
  }
  animateMarkerToVisible(params);
}

const isTerminalVisibilityChanged = (prev: ChartPhase | null, next: ChartPhase): boolean => {
  const terminalVisible = isTerminalMarkerPhaseVisible(next);
  if (!prev) { return terminalVisible; }
  return terminalVisible !== isTerminalMarkerPhaseVisible(prev);
}

const syncProjectionEndGroupVisibility = (endGroup: SVGGElement | null, phase: ChartPhase): void => {
  if (!endGroup) { return; }
  endGroup.style.opacity = isProjectionEndMarkerPhaseVisible(phase) ? "1" : "0";
}

interface TerminalMarkerClock {
  readonly durationMs: number;
  readonly easing: string;
}

interface PhaseApplierParams {
  readonly refs: Readonly<TerminalMarkerRefs>;
  readonly timingRef: RefObject<TerminalMarkerClock>;
  readonly prefersReducedRef: RefObject<boolean>;
}

const useTerminalMarkerPhaseApplier = (params: Readonly<PhaseApplierParams>): ((next: ChartPhase) => void) => {
  const { refs, timingRef, prefersReducedRef } = params;
  return useCallback((next: ChartPhase) => {
    const prev = refs.lastPhaseRef.current;
    refs.lastPhaseRef.current = next;
    if (!isTerminalVisibilityChanged(prev, next)) { return; }
    syncProjectionEndGroupVisibility(refs.endGroupRef.current, next);
    const { durationMs, easing } = timingRef.current;
    applyTerminalVisibilityToAll({
      durationMs,
      easing,
      markers: refs.markerRefs.current,
      prefersReduced: prefersReducedRef.current,
      runningAnims: refs.runningAnimsRef.current,
      visible: isTerminalMarkerPhaseVisible(next),
    });
  }, [refs, timingRef, prefersReducedRef]);
}

const useProjectionPhasePort = (
  phasePort: RefObject<ProjectionPhaseHandle | null>,
  applyPhase: (phase: ChartPhase) => void,
  runningAnimsRef: RefObject<Map<string, Animation>>,
): void => {
  useLayoutEffect(() => {
    const handle: ProjectionPhaseHandle = { setPhase: (phase) =>{  applyPhase(phase); } };
    phasePort.current = handle;
    const anims = runningAnimsRef.current;
    return (): void => {
      if (phasePort.current === handle) {phasePort.current = null;}
      for (const anim of anims.values()) {
        try {
          anim.cancel();
        } catch {
          // Detached-DOM teardown race.
        }
      }
      anims.clear();
    };
  }, [phasePort, applyPhase, runningAnimsRef]);
}

interface ReplayMarkersParams {
  readonly terminalMarkers: readonly TerminalMarkerAnchor[];
  readonly refs: Readonly<TerminalMarkerRefs>;
  readonly timingRef: RefObject<TerminalMarkerClock>;
  readonly prefersReducedRef: RefObject<boolean>;
}

const useReplayVisibleTerminalMarkers = (params: Readonly<ReplayMarkersParams>): void => {
  const { terminalMarkers, refs, timingRef, prefersReducedRef } = params;
  const { markerRefs, lastPhaseRef, runningAnimsRef } = refs;
  useLayoutEffect(() => {
    const phase = lastPhaseRef.current;
    // Anchors are read here so the effect honestly depends on terminalMarkers: no phase or no anchors, nothing to replay.
    if (!phase || terminalMarkers.length === 0) {return;}
    if (!isTerminalMarkerPhaseVisible(phase)) {return;}
    const { durationMs, easing } = timingRef.current;
    const prefersReduced = prefersReducedRef.current;
    for (const [key, element] of markerRefs.current) {
      replayVisibleTerminalMarker({ durationMs, easing, element, markerKey: key, prefersReduced, runningAnims: runningAnimsRef.current });
    }
  }, [terminalMarkers, markerRefs, lastPhaseRef, runningAnimsRef, timingRef, prefersReducedRef]);
}

export {
  applyTerminalVisibilityToAll,
  animateMarkerToHidden,
  animateMarkerToVisible,
  cancelRunningMarkerAnim,
  isProjectionEndMarkerPhaseVisible,
  isTerminalMarkerPhaseVisible,
  isTerminalVisibilityChanged,
  replayVisibleTerminalMarker,
  setMarkerReducedMotionState,
  syncProjectionEndGroupVisibility,
  TERMINAL_MARKER_HIDDEN_TRANSFORM,
  TERMINAL_MARKER_VISIBLE_TRANSFORM,
  useFreshRef,
  useProjectionPhasePort,
  useReplayVisibleTerminalMarkers,
  useTerminalMarkerPhaseApplier,
  useTerminalMarkerRefs,
};
export type {
  MarkerTransitionParams,
  PhaseApplierParams,
  ProjectionPhaseHandle,
  ReplayMarkerParams,
  ReplayMarkersParams,
  TerminalMarkerAnchor,
  TerminalMarkerClock,
  TerminalMarkerRefs,
  TerminalVisibilityParams,
};
