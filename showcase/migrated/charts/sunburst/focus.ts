// Keyboard order for the sunburst: native pointer resolution is kept and only the navigation order is supplied, centre disc (when drilled in)
// then arcs in tree order (depth-first, siblings clockwise), which is bklit's arc index order.
import { useEffect } from "react";
import type { RefObject } from "react";
import { findNearestPoint } from "@tanstack/charts";
import type { ChartFocusStrategy, ChartInteractionController, ChartPoint, ChartScene } from "@tanstack/charts";

interface SunburstFocusOptions<TDatum> {
  /** Last rendered scene (read at pointer time; the strategy is built with the definition). */
  readonly scene: () => ChartScene<TDatum, number, number> | null;
  /** Navigation rank of a point's datum; undefined leaves it out of keyboard order. */
  readonly orderOf: (datum: TDatum) => number | undefined;
  /** False while the point's sector has not yet swept to the pointer (entrance only): bklit's hit path is the growing arc (sunburst-segment.tsx:98-100). */
  readonly swept: (datum: TDatum, x: number, y: number) => boolean;
  /** The point kept hovered when a pointer move lands off every sector (hub, gaps, corners): bklit's sectors only set the hover on pointerenter. Null for a click, a re-resolve or a pointer on a sector. */
  readonly heldAt: (x: number, y: number) => ChartPoint<TDatum, number, number> | null | undefined;
}

const createSunburstFocus = <TDatum>(options: Readonly<SunburstFocusOptions<TDatum>>): ChartFocusStrategy<TDatum, number, number> => {
  // Hit-testable points per scene: the sectors drawn in this view, and the hub only when it is drawn (drilled in). At the root the hub
  // is a hair-thin disc at the centre whose point would win the nearest-point race over the ring-1 sector the centre belongs to (bklit has no disc there).
  const hittable = new WeakMap<object, readonly ChartPoint<TDatum, number, number>[]>();
  return {
    group: (_points, context) => [context.point],
    navigation: (points) =>
      points
        .flatMap((point) => {
          const rank = options.orderOf(point.datum);
          return rank === undefined ? [] : [{ point, rank }];
        })
        .toSorted((left, right) => left.rank - right.rank)
        .map(({ point }) => point),
    // Hit-tests the latest scene without the presented `points`: findNearestPoint's `allowed` set would reject the tween-time points, so the
    // renderer's own re-resolve after each render/publish (and its clear on leave) works natively through a zoom.
    resolve: (_points, { x, y, maxDistance }) => {
      const scene = options.scene();
      if (scene === null) {
        return [];
      }
      const held = options.heldAt(x, y);
      if (held !== undefined) {
        return held === null ? [] : [held];
      }
      let allowed = hittable.get(scene);
      if (allowed === undefined) {
        allowed = scene.points.filter((point) => options.orderOf(point.datum) !== undefined);
        hittable.set(scene, allowed);
      }
      const point = findNearestPoint(scene, x, y, maxDistance, allowed);
      return point === null || !options.swept(point.datum, x, y) ? [] : [point];
    },
  };
};

interface PointerHoldInput<TDatum> {
  readonly hostRef: RefObject<HTMLElement | null>;
  readonly interactionRef: RefObject<ChartInteractionController<TDatum, number, number> | null>;
  /** True while a pointer move is being dispatched: the strategy holds the hover off sectors only then (a click on the hub must still resolve it). */
  readonly movingRef: { current: boolean };
  readonly zoomableRef: RefObject<(datum: TDatum) => boolean>;
}

// bklit's only click handlers are a branch sector's zoom and the hub's zoom-out. The click guard is a capture listener on the host, ahead of the renderer's;
// the move flag lets the focus strategy tell a move from a click (gap #46) without stopping the event.
const usePointerHold = <TDatum>({ hostRef, interactionRef, movingRef, zoomableRef }: Readonly<PointerHoldInput<TDatum>>): void => {
  useEffect(() => {
    const host = hostRef.current;
    if (host === null) {
      return undefined;
    }
    // A click on a leaf or the gaps does nothing in bklit. The native select would still re-render the chart (a no-op motion cycle),
    // so such clicks never reach the renderer.
    const clickOnlyZoom = (event: MouseEvent): void => {
      movingRef.current = false;
      const datum = interactionRef.current?.resolvePointer(event.clientX, event.clientY)?.point.datum;
      if (datum === undefined || ! zoomableRef.current(datum)) {
        event.stopPropagation();
      }
    };
    // Cleared by a task after the dispatch, so the renderer's re-resolve after a render never sees it.
    const markMoving = (): void => {
      movingRef.current = true;
      setTimeout(() => { movingRef.current = false; }, 0);
    };
    host.addEventListener("pointermove", markMoving, true);
    host.addEventListener("click", clickOnlyZoom, true);
    return (): void => {
      host.removeEventListener("pointermove", markMoving, true);
      host.removeEventListener("click", clickOnlyZoom, true);
    };
  }, [hostRef, interactionRef, movingRef, zoomableRef]);
};

export { createSunburstFocus, usePointerHold };
