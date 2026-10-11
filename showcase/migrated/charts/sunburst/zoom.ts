import { useCallback, useEffect, useRef } from "react";
import { erase } from "../kit/erased-types";
import { writeAttribute } from "../kit/host-write";
import type { RefObject } from "react";
import type { ChartPoint, ChartScene } from "@tanstack/charts";
import type { useKeyboardFocusHold } from "../kit/keyboard-hold";
import type { ArcDatum, Focus, SunburstModel } from "./arcs";
import { isHub } from "./hub";
import type { SunburstDatum } from "./hub";
import { PUSH_CAP } from "./push";
import { DIM_TRANSITION_MS, SECTOR } from "./selectors";

const snapRule = (i: number): string => `[data-bk-snap~="${i}"] ${SECTOR}.bk-sb-a${i}{transition:none}`;

// The on-path overlay is the hovered arc's own group in bklit (one motion.g, opacity 1 <-> 0.25 over HOVER_DIM_TRANSITION 0.16s easeOut): it shows at once and fades with bklit's dim timing (push.ts); its opacity is a constant 0 in every scene.
// A zoom's hover drop (zoomTo, `data-bk-snap`): overlays hide, pushes and the dropped path's step-aside snap back; the dim keeps its fade.
export const zoomSnapCss = (count: number): string => `[data-bk-snap] g.bk-sb-pops path,[data-bk-snap] .bk-sunburst-label{transition:none}[data-bk-snap] ${SECTOR}{transition:opacity ${DIM_TRANSITION_MS}ms ease-out}${Array.from({ length: Math.min(count, PUSH_CAP) }, (_, i) => snapRule(i)).join("")}`;

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
  readonly hoverPathRef: RefObject<string>;
  readonly arcById: ReadonlyMap<string, ArcDatum>;
  readonly holdFocus: ReturnType<typeof useKeyboardFocusHold>;
}

type SunburstPoint = ChartPoint<SunburstDatum, number, number>;

interface SunburstZoom {
  readonly handFocusOver: (scene: ChartScene<SunburstDatum, number, number>) => void;
  readonly noteSource: (source: "pointer" | "keyboard") => void;
  readonly selectZoom: (point: SunburstPoint | null) => void;
  readonly zoomTo: (nextId: string) => void;
  readonly zoomableRef: RefObject<(datum: SunburstDatum) => boolean>;
}

export const useSunburstZoom = ({ model, focus, focusId, setInternalFocusId, isFocusControlled, onFocusChange, setHoveredArcIndex, hostRef, hoverPathRef, arcById, holdFocus }: Readonly<ZoomInput>): SunburstZoom => {
  // The node a keyboard zoom hands the focus to once the new view renders (null for a pointer zoom), and whether the last input was a key.
  const pendingFocusRef = useRef<string | null>(null);
  const keyZoomRef = useRef(false);
  const zoomableRef = useRef<(datum: SunburstDatum) => boolean>(() => false);
  zoomableRef.current = (datum): boolean => (isHub(datum) ? (focus?.parentId ?? null) !== null : arcById.get(datum.id)?.hasChildren === true);

  const zoomTo = useCallback(
    (nextId: string) => {
      if (nextId === focusId || !model.focusById.has(nextId)) {
        return;
      }
      // bklit's zoomTo drops the hover and resets the grow at once (sunburst-chart.tsx:231-234), so only the dim eases (0.16s). The host keeps the dropped path in
      // `data-bk-snap` until the next hover (zoomSnapCss turns those transitions off); a hub click drops the hover (onFocusChange) earlier in the same click task.
      if (hostRef.current) { writeAttribute(hostRef.current, "data-bk-snap", hoverPathRef.current); }
      setHoveredArcIndex(null);
      if (isFocusControlled) {
        onFocusChange?.(nextId);
      } else {
        setInternalFocusId(nextId);
      }
    },
    [focusId, hostRef, hoverPathRef, isFocusControlled, model.focusById, onFocusChange, setHoveredArcIndex, setInternalFocusId],
  );

  /** `change` runs before `onSelect` for both pointer and keyboard selects (renderer.ts:830,868). */
  const noteSource = useCallback((source: "pointer" | "keyboard"): void => {
    keyZoomRef.current = source === "keyboard";
  }, []);

  /** A keyboard zoom leaves the focus on the old view's point; hand it to the node chosen in `selectZoom` so it is visible at once. */
  const handFocusOver = (scene: ChartScene<SunburstDatum, number, number>): void => {
    const pendingId = pendingFocusRef.current;
    if (pendingId === null) {
      return;
    }
    pendingFocusRef.current = null;
    const target = scene.points.find((point) => !isHub(point.datum) && point.datum.id === pendingId) ?? scene.points.find((point) => isHub(point.datum));
    if (target !== undefined) {
      // Through the hold, so a blur clears it: a controller-set focus is skipped by the renderer's keyboard blur clear (renderer.ts:738).
      holdFocus.setKeyboardFocus(erase(target));
    }
  };

  const selectZoom = (point: SunburstPoint | null): void => {
    const datum = point?.datum;
    if (datum === undefined || focus === undefined) {
      return;
    }
    const byKey = keyZoomRef.current;
    if (isHub(datum)) {
      if (focus.parentId !== null) {
        // Zooming out lands on the node just left, which is drawn one level up.
        pendingFocusRef.current = byKey ? focus.id : null;
        zoomTo(focus.parentId);
      }
      return;
    }
    if (arcById.get(datum.id)?.hasChildren === true) {
      // Zooming in lands on the first drawn child (lowest arc index, as the keyboard order goes).
      const first = model.arcs.find((arc) => arc.parentId === datum.id);
      pendingFocusRef.current = byKey ? (first?.id ?? null) : null;
      zoomTo(datum.id);
    }
  };

  // No native drill-out exists (TanStack's Escape handling covers pinned tooltips, cursors, brushes and the continuous zoom only), so Escape
  // within the host takes the hub click's path, landing on the node just left. At the root it is left alone for the page.
  const zoomOutRef = useRef<() => boolean>(() => false);
  zoomOutRef.current = (): boolean => {
    const parentId = focus?.parentId ?? null;
    if (focus === undefined || parentId === null) {
      return false;
    }
    pendingFocusRef.current = focus.id;
    zoomTo(parentId);
    return true;
  };
  useEffect(() => {
    const host = hostRef.current;
    if (host === null) {
      return undefined;
    }
    const escape = (event: KeyboardEvent): void => {
      const plain = !(event.altKey || event.ctrlKey || event.metaKey || event.defaultPrevented);
      if (event.key === "Escape" && plain && zoomOutRef.current()) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    host.addEventListener("keydown", escape);
    return (): void => {
      host.removeEventListener("keydown", escape);
    };
  }, [hostRef]);

  return { handFocusOver, noteSource, selectZoom, zoomTo, zoomableRef };
};
