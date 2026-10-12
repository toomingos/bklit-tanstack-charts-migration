import { useCallback, useRef } from "react";
import { raiseAttribute } from "../kit/host-write";
import type { RefObject } from "react";
import type { ChartPoint } from "@tanstack/charts";
import type { ArcDatum, Focus, SunburstModel } from "./arcs";
import { isHub } from "./hub";
import type { SunburstDatum } from "./hub";
import { setFlag } from "./push";

// A zoom's hover drop (zoomTo): `data-bk-snap` on the host and `data-bk-s` on the dropped path's sectors; overlays hide, pushes and the step-aside snap back, the dim keeps its fade (sunburst.css).

interface ZoomInput {
  readonly model: SunburstModel;
  readonly focus: Focus | undefined;
  readonly focusId: string;
  readonly setInternalFocusId: (id: string) => void;
  readonly isFocusControlled: boolean;
  readonly onFocusChange: ((focusId: string) => void) | undefined;
  readonly setHoveredArcIndex: (index: number | null) => void;
  readonly hostRef: RefObject<HTMLElement | null>;
  /** Arcs on the last hovered path (hover-grow.ts), for the snap. */
  readonly hoverPathRef: RefObject<readonly number[]>;
  readonly arcById: ReadonlyMap<string, ArcDatum>;
}

type SunburstPoint = ChartPoint<SunburstDatum, number, number>;

interface SunburstZoom {
  readonly selectZoom: (point: SunburstPoint | null) => void;
  readonly zoomTo: (nextId: string) => void;
  readonly zoomableRef: RefObject<(datum: SunburstDatum) => boolean>;
}

export const useSunburstZoom = ({ model, focus, focusId, setInternalFocusId, isFocusControlled, onFocusChange, setHoveredArcIndex, hostRef, hoverPathRef, arcById }: Readonly<ZoomInput>): SunburstZoom => {
  const zoomableRef = useRef<(datum: SunburstDatum) => boolean>(() => false);
  zoomableRef.current = (datum): boolean => (isHub(datum) ? (focus?.parentId ?? null) !== null : arcById.get(datum.id)?.hasChildren === true);

  const zoomTo = useCallback(
    (nextId: string) => {
      if (nextId === focusId || !model.focusById.has(nextId)) {
        return;
      }
      // bklit's zoomTo drops the hover and resets the grow at once (sunburst-chart.tsx:231-234), so only the dim eases (0.16s). The host keeps the dropped path in
      // `data-bk-snap` until the next hover (sunburst.css turns those transitions off); a hub click drops the hover (onFocusChange) earlier in the same click task.
      if (hostRef.current) {
        raiseAttribute(hostRef.current, "data-bk-snap");
        setFlag(hostRef.current, "a", "data-bk-s", hoverPathRef.current);
      }
      setHoveredArcIndex(null);
      if (isFocusControlled) {
        onFocusChange?.(nextId);
      } else {
        setInternalFocusId(nextId);
      }
    },
    [focusId, hostRef, hoverPathRef, isFocusControlled, model.focusById, onFocusChange, setHoveredArcIndex, setInternalFocusId],
  );

  const selectZoom = (point: SunburstPoint | null): void => {
    const datum = point?.datum;
    if (datum === undefined || focus === undefined) {
      return;
    }
    if (isHub(datum)) {
      if (focus.parentId !== null) {
        zoomTo(focus.parentId);
      }
      return;
    }
    if (arcById.get(datum.id)?.hasChildren === true) {
      zoomTo(datum.id);
    }
  };

  return { selectZoom, zoomTo, zoomableRef };
};
