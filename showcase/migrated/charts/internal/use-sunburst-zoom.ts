import { useCallback, useRef } from "react";
import type { RefObject } from "react";
import type { ArcDatum } from "./sunburst-types";

interface UseSunburstZoomOptions {
  readonly focusId: string;
  readonly sectorById: ReadonlyMap<string, ArcDatum>;
  readonly isFocusControlled: boolean;
  readonly onFocusChange: ((focusId: string) => void) | undefined;
  readonly setInternalFocusId: (id: string) => void;
  readonly playKey: number;
  readonly setHoveredIndex: (index: number | null) => void;
}

interface UseSunburstZoomState {
  readonly playCycleRef: RefObject<string>;
  readonly revealDeadlineTimerRef: RefObject<number | null>;
  readonly zoomTo: (nextId: string) => void;
}

// Drill-down commits the new root; the package owns the zoom morph.
const useSunburstZoom = (options: Readonly<UseSunburstZoomOptions>): UseSunburstZoomState => {
  const {
    focusId,
    sectorById,
    isFocusControlled,
    onFocusChange,
    setInternalFocusId,
    playKey,
    setHoveredIndex,
  } = options;

  /*
   * Reveal-cycle identity: resets only the labels-reveal mount-vs-replay guard.
   */
  const playCycleRef = useRef<string>(`${playKey}`);
  const revealDeadlineTimerRef = useRef<number | null>(null);

  const commitFocus = useCallback(
    (nextId: string) => {
      if (isFocusControlled) {onFocusChange?.(nextId);}
      else {setInternalFocusId(nextId);}
    },
    [isFocusControlled, onFocusChange, setInternalFocusId],
  );

  const zoomTo = useCallback(
    (nextId: string) => {
      if (nextId === focusId || !sectorById.has(nextId)) {return;}
      commitFocus(nextId);
      setHoveredIndex(null);
    },
    [
      commitFocus,
      sectorById,
      focusId,
      setHoveredIndex,
    ],
  );

  return { playCycleRef, revealDeadlineTimerRef, zoomTo };
};

export { useSunburstZoom };
export type { UseSunburstZoomOptions, UseSunburstZoomState };
