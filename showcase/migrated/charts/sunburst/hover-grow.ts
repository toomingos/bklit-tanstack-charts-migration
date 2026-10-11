import { useCallback, useEffect, useMemo } from "react";
import type { RefObject } from "react";
import type { ChartCursorController, ChartPoint } from "@tanstack/charts";
import type { ArcDatum } from "./arcs";
import { createSunburstHoverStore } from "./context";
import type { SunburstHoverStore } from "./context";
import { setFlag, writePush } from "./push";
import type { SectorPush } from "./push";
import type { SunburstNativeNode } from "./sunburst-mark";
import { clearAttribute, raiseAttribute, writeAttribute } from "../kit/host-write";

// bklit's emphasis (dim unrelated sectors, step the hovered path aside) is CSS on the host's `data-bk-pop` and `data-bk-path` plus a flag on the sectors it exempts (sunburst.css),
// because the renderer does not paint native states during a zoom motion but never touches the host. Sector classes (`bk-sb-a<i>`) persist.

interface HoverState {
  /** Hover lives in a store (not React state): the root never re-renders on hover. Leaves subscribe; label visibility is mirrored onto the DOM by useHoverGrow. */
  readonly hoverStore: SunburstHoverStore;
  readonly isHoverControlled: boolean;
  readonly hoveredArc: ArcDatum | null;
  readonly setHoveredArcIndex: (index: number | null) => void;
}

export const useHoverState = (
  arcs: readonly ArcDatum[],
  hoveredIndexProp: number | null | undefined,
  onHoverChange: ((index: number | null) => void) | undefined,
): HoverState => {
  const isHoverControlled = hoveredIndexProp !== undefined;
  const hoverStore = useMemo(() => createSunburstHoverStore(), []);
  // oxlint-disable-next-line react/immutability -- the store is a stable useMemo handle; `arcs` lets its commit path read the latest arcs
  hoverStore.arcs.current = arcs;
  const setHoveredArcIndex = useCallback(
    (index: number | null) => {
      if (isHoverControlled) {
        onHoverChange?.(index);
      } else {
        hoverStore.commit(index);
      }
    },
    [hoverStore, isHoverControlled, onHoverChange],
  );
  // oxlint-disable-next-line react/immutability -- the store is a stable useMemo handle; `request` lets its commit path reach the latest setter
  hoverStore.request.current = setHoveredArcIndex;
  const hoveredArc = hoveredIndexProp === undefined || hoveredIndexProp === null ? null : (arcs[hoveredIndexProp] ?? null);
  useEffect(() => {
    if (isHoverControlled) {
      hoverStore.commit(hoveredIndexProp ?? null);
    }
  }, [hoverStore, isHoverControlled, hoveredIndexProp]);
  return { hoverStore, hoveredArc, isHoverControlled, setHoveredArcIndex };
};

/** A controlled hoveredIndex addresses the sector through the native cursor controller, so dimming/pop follow it. */
export const useControlledCursor = (
  controller: ChartCursorController<number, number>,
  registry: ReadonlyMap<string, ChartPoint<SunburstNativeNode, number, number>>,
  hoveredArcId: string | null,
  isHoverControlled: boolean,
  definition: unknown,
): void => {
  useEffect(() => {
    if (!isHoverControlled) {
      return;
    }
    const point = hoveredArcId === null ? undefined : registry.get(hoveredArcId);
    if (point === undefined) {
      controller.setState(null);
      return;
    }
    controller.setState({
      anchor: "value",
      origin: { datumIndex: point.datumIndex, key: point.key, markId: point.markId },
      pinned: false,
      source: "pointer",
      value: { x: point.xValue, y: point.yValue },
    });
  }, [controller, hoveredArcId, isHoverControlled, registry, definition]);
};

const FLAGS = [["a", "data-bk-d"], ["a", "data-bk-p"], ["p", "data-bk-p"], ["l", "data-bk-r"]] as const;

interface HoverGrowInput {
  readonly hostRef: RefObject<HTMLElement | null>;
  readonly hoverStore: SunburstHoverStore;
  readonly arcs: readonly ArcDatum[];
  readonly maxDepth: number;
  readonly focusDepth: number;
  readonly hoverPop: number;
  readonly pushes: ReadonlyMap<string, SectorPush>;
  /** The scene is rebuilt, so the hover is re-applied to the new sectors. */
  readonly definition: unknown;
  /** Written with the arcs on the hovered path, for the zoom's snap (zoom.ts). */
  readonly hoverPathRef: RefObject<readonly number[]>;
}

/** bklit drops unrelated sectors' labels the instant one is hovered: the host carries `data-bk-hov` and flags the related labels (sunburst.css rules are fixed),
 * and the same pass publishes the hover push (push.ts) as per-arc CSS vars. No render, no rebuild. */
export const useHoverGrow = ({ hostRef, hoverStore, arcs, maxDepth, focusDepth, hoverPop, pushes, definition, hoverPathRef }: Readonly<HoverGrowInput>): void => {
  useEffect(() => {
    const apply = (): void => {
      const host = hostRef.current;
      if (host === null) {
        return;
      }
      const index = hoverStore.getIndex();
      const arc = index === null ? null : (arcs[index] ?? null);
      writePush(host, { arcs, focusDepth, hovered: arc, maxDepth, popOut: hoverPop, sectors: pushes });
      if (arc === null) {
        for (const [kind, name] of FLAGS) { setFlag(host, kind, name, []); }
        clearAttribute(host, "data-bk-pop");
        clearAttribute(host, "data-bk-path");
        clearAttribute(host, "data-bk-hov");
        return;
      }
      const path: number[] = [];
      const below: number[] = [];
      for (const other of arcs) {
        if (other.id === arc.id || arc.id.startsWith(`${other.id} / `)) {
          path.push(other.arcIndex);
        } else if (other.id.startsWith(`${arc.id} / `)) {
          below.push(other.arcIndex);
        }
      }
      hoverPathRef.current = path;
      clearAttribute(host, "data-bk-snap");
      setFlag(host, "a", "data-bk-s", []);
      setFlag(host, "a", "data-bk-d", below);
      setFlag(host, "a", "data-bk-p", path);
      setFlag(host, "p", "data-bk-p", path);
      setFlag(host, "l", "data-bk-r", [...path, ...below]);
      writeAttribute(host, "data-bk-pop", String(arc.arcIndex));
      writeAttribute(host, "data-bk-path", path.join(" "));
      raiseAttribute(host, "data-bk-hov");
    };
    apply();
    return hoverStore.subscribe(apply);
  }, [hostRef, hoverStore, arcs, definition, pushes, focusDepth, maxDepth, hoverPop, hoverPathRef]);
};
