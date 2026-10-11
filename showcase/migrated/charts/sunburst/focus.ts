// Keyboard order for the sunburst: native pointer resolution is kept and only the navigation order is supplied, centre disc (when drilled in)
// then arcs in tree order (depth-first, siblings clockwise), which is bklit's arc index order.
import { useEffect } from "react";
import type { RefObject } from "react";
import { findNearestPoint } from "@tanstack/charts";
import type { ChartFocusStrategy, ChartInteractionController, ChartPoint, ChartScene } from "@tanstack/charts";
import { sectorAtPoint } from "./push";
import type { SectorPush } from "./push";

interface SunburstFocusOptions<TDatum> {
  /** Last rendered scene (read at pointer time; the strategy is built with the definition). */
  readonly scene: () => ChartScene<TDatum, number, number> | null;
  /** Navigation rank of a point's datum; undefined leaves it out of keyboard order. */
  readonly orderOf: (datum: TDatum) => number | undefined;
  /** False while the point's sector has not yet swept to the pointer (entrance only): bklit's hit path is the growing arc (sunburst-segment.tsx:98-100). */
  readonly swept: (datum: TDatum, x: number, y: number) => boolean;
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
  /** Chart centre in scene coordinates, from the last render. */
  readonly centerRef: RefObject<{ readonly x: number; readonly y: number } | null>;
  readonly pushes: ReadonlyMap<string, SectorPush>;
  readonly zoomableRef: RefObject<(datum: TDatum) => boolean>;
}

// bklit's only click handlers are a branch sector's zoom and the hub's zoom-out, and its sectors only set the hover on pointerenter
// (the svg's pointerleave clears it). Both are capture listeners on the host, ahead of the renderer's own.
const usePointerHold = <TDatum>({ hostRef, interactionRef, centerRef, pushes, zoomableRef }: Readonly<PointerHoldInput<TDatum>>): void => {
  useEffect(() => {
    const host = hostRef.current;
    if (host === null) {
      return undefined;
    }
    // A click on a leaf or the gaps does nothing in bklit. The native select would still re-render the chart (a no-op motion cycle),
    // so such clicks never reach the renderer.
    const clickOnlyZoom = (event: MouseEvent): void => {
      const datum = interactionRef.current?.resolvePointer(event.clientX, event.clientY)?.point.datum;
      if (datum === undefined || ! zoomableRef.current(datum)) {
        event.stopPropagation();
      }
    };
    // Over the hub, gaps and empty corners the last sector stays hovered; the native chart would drop focus there. A capture listener, since the focus strategy
    // cannot tell a move from a click (gap #46), so a strategy-side hold would also hold on the hub click that must zoom out.
    const holdOffSector = (event: PointerEvent): void => {
      const center = centerRef.current;
      const at = interactionRef.current?.clientToScene(event.clientX, event.clientY);
      if (center === null || at === null || at === undefined) {
        return;
      }
      if (sectorAtPoint(pushes, at.x - center.x, at.y - center.y) === null) {
        event.stopPropagation();
      }
    };
    host.addEventListener("pointermove", holdOffSector, true);
    host.addEventListener("click", clickOnlyZoom, true);
    return (): void => {
      host.removeEventListener("pointermove", holdOffSector, true);
        host.removeEventListener("click", clickOnlyZoom, true);
    };
  }, [hostRef, interactionRef, centerRef, pushes, zoomableRef]);
};

export { createSunburstFocus, usePointerHold };
