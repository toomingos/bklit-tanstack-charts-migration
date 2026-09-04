import { useCallback, useRef, useState } from "react";
import type { RefObject } from "react";
import type { Focus } from "./sunburst-geometry";

interface UseSunburstZoomOptions {
  readonly rootId: string;
  readonly focus: Readonly<Focus>;
  readonly focusById: ReadonlyMap<string, Focus>;
  readonly focusId: string;
  readonly isFocusControlled: boolean;
  readonly onFocusChange: ((focusId: string) => void) | undefined;
  readonly setInternalFocusId: (id: string) => void;
  readonly prefersReducedMotion: boolean;
  readonly playKey: number;
  readonly zoomMs: number;
  readonly setHoveredArcIndex: (index: number | null) => void;
}

interface UseSunburstZoomState {
  readonly zoomT: number;
  readonly prevFocus: Readonly<Focus>;
  readonly playCycleRef: RefObject<string>;
  readonly revealDeadlineTimerRef: RefObject<number | null>;
  readonly zoomTo: (nextId: string) => void;
}

const useSunburstZoom = (options: Readonly<UseSunburstZoomOptions>): UseSunburstZoomState => {
  const {
    rootId,
    focus,
    focusById,
    focusId,
    isFocusControlled,
    onFocusChange,
    setInternalFocusId,
    prefersReducedMotion,
    playKey,
    zoomMs,
    setHoveredArcIndex,
  } = options;

  /*
   * Click commits focus immediately; the committed geometry renders under the in-flight morph so nothing jumps.
   */
  const [zoomT, setZoomT] = useState(1);
  const [prevFocusId, setPrevFocusId] = useState(rootId);
  const prevFocus = focusById.get(prevFocusId) ?? focus;
  const zoomGen = useRef(0);
  /*
   * Reveal-cycle identity: resets only the labels-reveal mount-vs-replay guard; arcs replay via the mark's own key.
   */
  const playCycleRef = useRef<string>(`${playKey}`);
  const revealDeadlineTimerRef = useRef<number | null>(null);

  /*
   * Reset during render so the first commit carries it; an effect would flash one stale-focus frame.
   */
  const [prevRootId, setPrevRootId] = useState(rootId);
  if (prevRootId !== rootId) {
    setPrevRootId(rootId);
    setPrevFocusId(rootId);
    setZoomT(1);
  }

  const commitFocus = useCallback(
    (nextId: string) => {
      if (isFocusControlled) {onFocusChange?.(nextId);}
      else {setInternalFocusId(nextId);}
    },
    [isFocusControlled, onFocusChange, setInternalFocusId],
  );

  /*
   * Native morph interpolates from the live `d`, so an interrupted zoom continues visually; the generation guard retires old ticks.
   */
  const beginZoomTween = useCallback((): void => {
    if (prefersReducedMotion) {
      setZoomT(1);
      return;
    }
    zoomGen.current += 1;
    const gen = zoomGen.current;
    setZoomT(0);
    requestAnimationFrame((): void => {
      if (zoomGen.current !== gen) {return;}
      const start = performance.now();
      const tick = (): void => {
        if (zoomGen.current !== gen) {return;}
        const elapsed = performance.now() - start;
        const progress = Math.min(1, elapsed / zoomMs);
        setZoomT(progress);
        if (progress < 1) {
          requestAnimationFrame(tick);
        } else {
          setZoomT(1);
        }
      };
      requestAnimationFrame(tick);
    });
  }, [prefersReducedMotion, zoomMs]);

  const zoomTo = useCallback(
    (nextId: string) => {
      if (nextId === focusId || !focusById.has(nextId)) {return;}

      // Midpoint-snapshot nuance (audit §4 row1): if a zoom is already
      // In-flight, bump the rAF generation so the old tick loop exits.
      if (zoomT < 1) {
        zoomGen.current += 1;
      }

      // Commit immediately — prevFocusId becomes the tween's FROM state.
      setPrevFocusId(focusId);
      commitFocus(nextId);
      setHoveredArcIndex(null);
      beginZoomTween();
    },
    [
      beginZoomTween,
      commitFocus,
      focusById,
      focusId,
      setHoveredArcIndex,
      zoomT,
    ],
  );

  return { playCycleRef, prevFocus, revealDeadlineTimerRef, zoomT, zoomTo };
};

export { useSunburstZoom };
export type { UseSunburstZoomOptions, UseSunburstZoomState };
